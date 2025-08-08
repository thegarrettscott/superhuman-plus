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
      const token = await refreshAccessToken(account.refresh_token);
      const access_token: string = token.access_token;
      const expires_in: number = token.expires_in ?? 0;

      // Store latest access token
      await admin
        .from("email_accounts")
        .update({ access_token, access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString() })
        .eq("id", account.id);

      // Fetch recent messages
      const ids = await listRecentMessageIds(access_token, max);
      const messages = await Promise.all(ids.map((id: string) => getMessage(access_token, id)));

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

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gmail-actions error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
