import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function refreshAccessToken(refresh_token: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function listRecentMessageIds(access_token: string, max = 20) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`List messages failed: ${await res.text()}`);
  const json = await res.json();
  return (json.messages || []).map((m: any) => m.id as string);
}

function headerVal(headers: any[], name: string) {
  const h = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function parseAddresses(value: string): string[] | null {
  if (!value) return null;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getMessage(access_token: string, id: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Date`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`Get message failed: ${await res.text()}`);
  const json = await res.json();
  const headers = json.payload?.headers || [];
  return {
    id: json.id as string,
    threadId: json.threadId as string,
    snippet: json.snippet as string,
    labelIds: json.labelIds as string[] | undefined,
    internalDate: json.internalDate as string | undefined,
    subject: headerVal(headers, "Subject") || null,
    from: headerVal(headers, "From") || null,
    to: parseAddresses(headerVal(headers, "To")),
    cc: parseAddresses(headerVal(headers, "Cc")),
    bcc: parseAddresses(headerVal(headers, "Bcc")),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await client.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "import";
    const maxRequested = typeof body.max === "number" ? body.max : Number(body.max);
    const max = Math.min(Number.isFinite(maxRequested) ? maxRequested : 20, 100);
    if (action === "import") {
      // Find gmail account
      const { data: account, error: accErr } = await admin
        .from("email_accounts")
        .select("id, refresh_token")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();
      if (accErr) throw accErr;
      if (!account) return new Response(JSON.stringify({ error: "No Gmail account connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (!account.refresh_token) return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Refresh token
      let access_token: string;
      let expires_in = 0;
      try {
        const token = await refreshAccessToken(account.refresh_token);
        access_token = token.access_token as string;
        expires_in = (token.expires_in ?? 0) as number;
      } catch (err) {
        console.error("gmail-actions refreshAccessToken error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google access token. Please reconnect Gmail." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store latest access token
      await admin
        .from("email_accounts")
        .update({ access_token, access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString() })
        .eq("id", account.id);

      // Fetch recent messages
      let ids: string[] = [];
      try {
        ids = await listRecentMessageIds(access_token, max);
      } catch (err) {
        console.error("gmail-actions listRecentMessageIds error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to list Gmail messages. Please try importing again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Fetch each message (tolerate partial failures)
      const results = await Promise.allSettled(ids.map((id: string) => getMessage(access_token, id)));
      const messages = results
        .filter((r) => r.status === "fulfilled")
        .map((r: PromiseFulfilledResult<any>) => (r as PromiseFulfilledResult<any>).value);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (messages.length === 0) {
        console.error("gmail-actions getMessage failed for all ids");
        return new Response(
          JSON.stringify({ error: "Failed to fetch Gmail messages. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prepare rows
      const rows = messages.map((m) => ({
        user_id: user.id,
        account_id: account.id,
        gmail_message_id: m.id,
        thread_id: m.threadId || null,
        snippet: m.snippet || null,
        label_ids: m.labelIds || null,
        subject: m.subject,
        from_address: m.from,
        to_addresses: m.to,
        cc_addresses: m.cc,
        bcc_addresses: m.bcc,
        internal_date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
        is_read: !(m.labelIds || []).includes("UNREAD"),
      }));

      // De-dup by gmail_message_id (delete then insert)
      if (rows.length > 0) {
        await admin.from("email_messages").delete().in("gmail_message_id", rows.map((r) => r.gmail_message_id)).eq("user_id", user.id);
        const { error: insErr } = await admin.from("email_messages").insert(rows);
        if (insErr) throw insErr;
      }

      return new Response(JSON.stringify({ imported: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "modify") {
      // Modify labels on a Gmail message (e.g., mark read/unread, star/unstar)
      const { id, add = [], remove = [] } = body as { id?: string; add?: string[]; remove?: string[] };
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing 'id' (gmail_message_id) for modify action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find gmail account
      const { data: account, error: accErr } = await admin
        .from("email_accounts")
        .select("id, refresh_token")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();
      if (accErr) throw accErr;
      if (!account || !account.refresh_token) {
        return new Response(JSON.stringify({ error: "No Gmail account connected or missing refresh token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token
      let access_token: string;
      let expires_in = 0;
      try {
        const token = await refreshAccessToken(account.refresh_token);
        access_token = token.access_token as string;
        expires_in = (token.expires_in ?? 0) as number;
      } catch (err) {
        console.error("gmail-actions refreshAccessToken (modify) error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google access token. Please reconnect Gmail." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store latest access token
      await admin
        .from("email_accounts")
        .update({ access_token, access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString() })
        .eq("id", account.id);

      // Call Gmail modify API
      const modifyRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
      });
      if (!modifyRes.ok) {
        const text = await modifyRes.text();
        console.error("gmail-actions modify error:", text);
        return new Response(JSON.stringify({ error: "Failed to modify Gmail message labels." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updated = await modifyRes.json();
      const labels: string[] = updated.labelIds || [];

      // Update our DB mirror (best-effort)
      await admin
        .from("email_messages")
        .update({
          label_ids: labels,
          is_read: !labels.includes("UNREAD"),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("gmail_message_id", id);

      return new Response(
        JSON.stringify({ modified: true, labels }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "send") {
      // Send an email via Gmail API
      const { to, cc = [], bcc = [], subject = "", text = "", html = "" } = body as {
        to?: string[];
        cc?: string[];
        bcc?: string[];
        subject?: string;
        text?: string;
        html?: string;
      };

      if (!to || !Array.isArray(to) || to.length === 0) {
        return new Response(JSON.stringify({ error: "'to' must be a non-empty array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find gmail account
      const { data: account, error: accErr } = await admin
        .from("email_accounts")
        .select("id, refresh_token")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();
      if (accErr) throw accErr;
      if (!account || !account.refresh_token) {
        return new Response(JSON.stringify({ error: "No Gmail account connected or missing refresh token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token
      let access_token: string;
      let expires_in = 0;
      try {
        const token = await refreshAccessToken(account.refresh_token);
        access_token = token.access_token as string;
        expires_in = (token.expires_in ?? 0) as number;
      } catch (err) {
        console.error("gmail-actions refreshAccessToken (send) error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google access token. Please reconnect Gmail." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store latest access token
      await admin
        .from("email_accounts")
        .update({ access_token, access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString() })
        .eq("id", account.id);

      // Build raw MIME message
      function base64UrlEncode(str: string) {
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }

      const headers: string[] = [];
      if (to.length) headers.push(`To: ${to.join(', ')}`);
      if (cc.length) headers.push(`Cc: ${cc.join(', ')}`);
      if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`);
      headers.push(`Subject: ${subject}`);
      const contentType = html ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
      headers.push(`Content-Type: ${contentType}`);
      const bodyContent = html || text || '';
      const rawMessage = `${headers.join('\r\n')}\r\n\r\n${bodyContent}`;
      const raw = base64UrlEncode(rawMessage);

      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      if (!sendRes.ok) {
        const errTxt = await sendRes.text();
        console.error("gmail-actions send error:", errTxt);
        // Log failure
        await admin.from("outgoing_mail_logs").insert({
          user_id: user.id,
          account_id: account.id,
          to_addresses: to,
          cc_addresses: cc,
          bcc_addresses: bcc,
          subject,
          body_text: html ? null : (text || ''),
          body_html: html || null,
          status: 'failed',
          error_message: errTxt.substring(0, 500),
        });
        return new Response(JSON.stringify({ error: "Failed to send email." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sent = await sendRes.json();
      const gmail_message_id = sent.id as string | undefined;
      await admin.from("outgoing_mail_logs").insert({
        user_id: user.id,
        account_id: account.id,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        subject,
        body_text: html ? null : (text || ''),
        body_html: html || null,
        status: 'sent',
        gmail_message_id: gmail_message_id || null,
      });

      return new Response(
        JSON.stringify({ sent: true, id: gmail_message_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gmail-actions error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
