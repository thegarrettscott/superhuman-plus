import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to trigger email filtering
async function triggerEmailFiltering(emailId: string, userId: string) {
  try {
    // Get the email data for filtering
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: email } = await admin
      .from('email_messages')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', userId)
      .single();

    if (!email) return;

    // Call the email-filter function
    const { error } = await admin.functions.invoke('email-filter', {
      body: {
        action: 'process-email',
        emailData: email
      }
    });

    if (error) {
      console.warn('Email filtering failed for email', emailId, ':', error);
    }
  } catch (error) {
    console.warn('Error triggering email filtering:', error);
  }
}

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

async function listRecentMessageIds(access_token: string, max = 20, labelId = "INBOX") {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=${labelId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`List messages failed: ${await res.text()}`);
  const json = await res.json();
  return (json.messages || []).map((m: any) => m.id as string);
}

async function listDrafts(access_token: string, max = 20) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=${max}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`List drafts failed: ${await res.text()}`);
  const json = await res.json();
  return (json.drafts || []).map((d: any) => ({ id: d.id, messageId: d.message.id }));
}

async function createDraft(access_token: string, emailData: any) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/drafts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw: emailData
      }
    })
  });
  if (!res.ok) throw new Error(`Create draft failed: ${await res.text()}`);
  return res.json();
}

async function updateDraft(access_token: string, draftId: string, emailData: any) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw: emailData
      }
    })
  });
  if (!res.ok) throw new Error(`Update draft failed: ${await res.text()}`);
  return res.json();
}

async function createLabel(access_token: string, labelName: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    })
  });
  if (!res.ok) throw new Error(`Create label failed: ${await res.text()}`);
  return res.json();
}

async function getGmailSignature(access_token: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/me`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`Get signature failed: ${await res.text()}`);
  const json = await res.json();
  return {
    signature: json.signature || '',
    signatureHtml: json.signature || ''
  };
}

async function updateGmailSignature(access_token: string, signature: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/me`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      signature: signature
    })
  });
  if (!res.ok) throw new Error(`Update signature failed: ${await res.text()}`);
  return res.json();
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
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Date`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`Get message failed: ${await res.text()}`);
  const json = await res.json();
  const headers = json.payload?.headers || [];

  function decodeBody(data?: string) {
    if (!data) return "";
    const str = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    try {
      // Attempt to decode as UTF-8
      return new TextDecoder('utf-8').decode(new Uint8Array([...str].map(c => c.charCodeAt(0))));
    } catch {
      return str;
    }
  }

  function collectParts(payload: any): { text: string; html: string } {
    let text = "";
    let html = "";
    if (!payload) return { text, html };
    const mime = payload.mimeType as string | undefined;
    const bodyData = payload.body?.data as string | undefined;
    if (mime === 'text/plain' && bodyData) text += decodeBody(bodyData);
    if (mime === 'text/html' && bodyData) html += decodeBody(bodyData);
    const parts = payload.parts as any[] | undefined;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const res = collectParts(p);
        text += res.text;
        html += res.html;
      }
    }
    return { text, html };
  }

  const bodies = collectParts(json.payload);

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
    body_text: bodies.text || null,
    body_html: bodies.html || null,
  };
}

// Gmail History API helpers for cursor-based sync
async function getProfileHistoryId(access_token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error(`Get profile failed: ${await res.text()}`);
  const json = await res.json();
  return json.historyId as string | undefined;
}

async function listHistoryMessageIds(
  access_token: string,
  startHistoryId: string,
  labelId?: string
) {
  const base = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/history`);
  base.searchParams.set("startHistoryId", String(startHistoryId));
  base.searchParams.set("historyTypes", "messageAdded");
  if (labelId) base.searchParams.set("labelId", labelId);

  let nextPageToken: string | undefined;
  const ids = new Set<string>();
  let latestHistoryId: string | undefined;

  do {
    const url = new URL(base);
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      const invalid = res.status === 404 || text.toLowerCase().includes("starthistoryid");
      throw new Error(`HISTORY_ERROR:${invalid ? "INVALID_START" : "OTHER"}:${text}`);
    }

    const json = await res.json();
    const history: any[] = json.history || [];

    for (const h of history) {
      if (h.id) {
        if (!latestHistoryId || BigInt(h.id) > BigInt(latestHistoryId)) latestHistoryId = String(h.id);
      }
      const msgs = h.messagesAdded || [];
      for (const ma of msgs) {
        const mid = ma?.message?.id;
        if (mid) ids.add(String(mid));
      }
    }

    // Some responses include a top-level historyId representing the most recent history record id
    if (json.historyId && (!latestHistoryId || BigInt(json.historyId) > BigInt(latestHistoryId))) {
      latestHistoryId = String(json.historyId);
    }

    nextPageToken = json.nextPageToken;
  } while (nextPageToken);

  return { ids: Array.from(ids), latestHistoryId };
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
    const mailbox: string = body.mailbox || "inbox";
    const maxRequested = typeof body.max === "number" ? body.max : Number(body.max);
    const max = Math.min(Number.isFinite(maxRequested) ? maxRequested : 20, 100);
    if (action === "import") {
      // Queue background import job and return immediately
      // Find gmail account
      const { data: account, error: accErr } = await admin
        .from("email_accounts")
        .select("id, refresh_token, history_id, initial_import_completed")
        .eq("user_id", user.id)
        .eq("provider", "gmail")
        .maybeSingle();
      if (accErr) throw accErr;
      if (!account) return new Response(JSON.stringify({ error: "No Gmail account connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!account.refresh_token) return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const isIncremental = !!account.history_id && mailbox !== 'drafts';

      // Create sync job + initial sync status row
      const { data: job, error: jobErr } = await admin
        .from('sync_jobs')
        .insert({
          user_id: user.id,
          account_id: account.id,
          job_type: isIncremental ? 'incremental_sync' : 'initial_import',
          status: 'running',
          started_at: new Date().toISOString(),
          metadata: { mailbox, max }
        })
        .select('id')
        .single();
      if (jobErr) throw jobErr;

      // Create status tracker row (used by UI component SyncProgress)
      const { error: statusErr } = await admin
        .from('sync_status')
        .insert({
          user_id: user.id,
          account_id: account.id,
          sync_type: mailbox === 'drafts' ? 'drafts' : (mailbox === 'sent' ? 'sent' : 'inbox'),
          status: 'running',
          total_items: 0,
          synced_items: 0,
          started_at: new Date().toISOString(),
        });
      if (statusErr) console.warn('sync_status insert warn:', statusErr);

      // Background task: refresh token, list ids, fetch messages, upsert DB, update progress
      const backgroundTask = async () => {
        try {
          // Refresh token
          const token = await refreshAccessToken(account.refresh_token);
          const access_token = token.access_token as string;
          const expires_in = (token.expires_in ?? 0) as number;

          // Store latest access token
          await admin
            .from("email_accounts")
            .update({ access_token, access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString() })
            .eq("id", account.id);

          // List message/draft ids with cursor-based strategy for Gmail (History API)
          let ids: string[] = [];
          let newHistoryId: string | undefined;

          if (mailbox === 'drafts') {
            const drafts = await listDrafts(access_token, max);
            ids = drafts.map(d => d.messageId);
          } else {
            const labelId = mailbox === 'sent' ? 'SENT' : 'INBOX';

            if (account.history_id) {
              try {
                const hist = await listHistoryMessageIds(access_token, String(account.history_id), labelId);
                ids = hist.ids;
                newHistoryId = hist.latestHistoryId || (await getProfileHistoryId(access_token));
              } catch (e) {
                const msg = String(e);
                const invalidStart = msg.includes('HISTORY_ERROR:INVALID_START');
                console.warn('History API error, falling back to baseline list:', msg);
                // If the cursor is too old/invalid, fall back to baseline list of recent messages
                ids = await listRecentMessageIds(access_token, max, labelId);
                newHistoryId = await getProfileHistoryId(access_token);
              }
            } else {
              // No cursor yet: perform baseline import then set the latest historyId as baseline
              ids = await listRecentMessageIds(access_token, max, labelId);
              newHistoryId = await getProfileHistoryId(access_token);
            }
          }

          // Update total
          await admin
            .from('sync_status')
            .update({ total_items: ids.length, status: 'running' })
            .eq('user_id', user.id)
            .eq('account_id', account.id)
            .eq('sync_type', mailbox === 'drafts' ? 'drafts' : (mailbox === 'sent' ? 'sent' : 'inbox'));

          // Fetch each message
          let synced = 0;
          for (const id of ids) {
            try {
              const m = await getMessage(access_token, id);
              const row = {
                user_id: user.id,
                account_id: account.id,
                gmail_message_id: m.id,
                thread_id: m.threadId || null,
                snippet: m.snippet || null,
                label_ids: m.labelIds || [],
                subject: m.subject,
                from_address: m.from,
                to_addresses: m.to,
                cc_addresses: m.cc,
                bcc_addresses: m.bcc,
                internal_date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
                is_read: !(m.labelIds || []).includes('UNREAD'),
                body_text: m.body_text || null,
                body_html: m.body_html || null,
              } as const;
              // Upsert by unique gmail_message_id per user (simple delete+insert)
              await admin.from('email_messages').delete()
                .eq('user_id', user.id)
                .eq('gmail_message_id', row.gmail_message_id);
              const { data: insertedEmail } = await admin.from('email_messages').insert(row).select('id').single();
              synced++;

              // Trigger automatic filtering for INBOX emails if enabled
              if (mailbox === 'inbox' && account.auto_filtering_enabled && insertedEmail) {
                // Queue filtering without blocking the import process
                EdgeRuntime.waitUntil(triggerEmailFiltering(insertedEmail.id, user.id));
              }

              // Throttle progress updates
              if (synced % 5 === 0 || synced === ids.length) {
                await admin
                  .from('sync_status')
                  .update({ synced_items: synced })
                  .eq('user_id', user.id)
                  .eq('account_id', account.id)
                  .eq('sync_type', mailbox === 'drafts' ? 'drafts' : (mailbox === 'sent' ? 'sent' : 'inbox'));
              }
            } catch (e) {
              console.error('Background fetch/insert error for id', id, e);
            }
          }

          // Persist the new cursor if available
          if (newHistoryId) {
            await admin
              .from('email_accounts')
              .update({ history_id: newHistoryId })
              .eq('id', account.id);
          }

          // Mark complete
          await admin
            .from('sync_status')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('account_id', account.id)
            .eq('sync_type', mailbox === 'drafts' ? 'drafts' : (mailbox === 'sent' ? 'sent' : 'inbox'));

          await admin
            .from('sync_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', job.id);

          // Mark initial import as completed for inbox imports (first time user connects)
          if (mailbox === 'inbox') {
            await admin
              .from('email_accounts')
              .update({ 
                initial_import_completed: true,
                initial_import_completed_at: new Date().toISOString()
              })
              .eq('id', account.id);
          }
        } catch (err) {
          console.error('Background import failed:', err);
          await admin
            .from('sync_status')
            .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('account_id', account.id)
            .eq('sync_type', mailbox === 'drafts' ? 'drafts' : (mailbox === 'sent' ? 'sent' : 'inbox'));
          await admin
            .from('sync_jobs')
            .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
            .eq('id', job.id);
        }
      };

      // Kick off background task
      // @ts-ignore - EdgeRuntime is available in the Edge Functions environment
      // deno-lint-ignore no-undef
      EdgeRuntime.waitUntil(backgroundTask());

      return new Response(
        JSON.stringify({ started: true, jobId: job.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      const { to, cc = [], bcc = [], subject = "", text = "", html = "", attachments = [] } = body as {
        to?: string[];
        cc?: string[];
        bcc?: string[];
        subject?: string;
        text?: string;
        html?: string;
        attachments?: string[];
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

      // Download attachments from storage
      const attachmentData: { filename: string; content: string; contentType: string }[] = [];
      if (attachments.length > 0) {
        const storageClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        
        for (const path of attachments) {
          try {
            const { data: fileData, error: downloadError } = await storageClient.storage
              .from('email-attachments')
              .download(path);

            if (downloadError) {
              console.error('Failed to download attachment:', downloadError);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            const filename = path.split('/').pop() || 'attachment';
            
            // Simple content type detection
            const ext = filename.split('.').pop()?.toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === 'pdf') contentType = 'application/pdf';
            else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
            else if (ext === 'png') contentType = 'image/png';
            else if (ext === 'gif') contentType = 'image/gif';
            else if (ext === 'txt') contentType = 'text/plain';
            else if (ext === 'doc') contentType = 'application/msword';
            else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

            attachmentData.push({
              filename,
              content: base64Content,
              contentType
            });
          } catch (error) {
            console.error('Error processing attachment:', error);
          }
        }
      }

      let rawMessage: string;

      if (attachmentData.length === 0) {
        // Simple message without attachments
        const headers: string[] = [];
        if (to.length) headers.push(`To: ${to.join(', ')}`);
        if (cc.length) headers.push(`Cc: ${cc.join(', ')}`);
        if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`);
        headers.push(`Subject: ${subject}`);
        const contentType = html ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
        headers.push(`Content-Type: ${contentType}`);
        const bodyContent = html || text || '';
        rawMessage = `${headers.join('\r\n')}\r\n\r\n${bodyContent}`;
      } else {
        // Multipart message with attachments
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
        const headers: string[] = [];
        if (to.length) headers.push(`To: ${to.join(', ')}`);
        if (cc.length) headers.push(`Cc: ${cc.join(', ')}`);
        if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`);
        headers.push(`Subject: ${subject}`);
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        headers.push(`MIME-Version: 1.0`);

        let body = `${headers.join('\r\n')}\r\n\r\n`;
        
        // Add text/html content
        body += `--${boundary}\r\n`;
        const contentType = html ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
        body += `Content-Type: ${contentType}\r\n\r\n`;
        body += `${html || text || ''}\r\n\r\n`;

        // Add attachments
        for (const attachment of attachmentData) {
          body += `--${boundary}\r\n`;
          body += `Content-Type: ${attachment.contentType}\r\n`;
          body += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
          body += `Content-Transfer-Encoding: base64\r\n\r\n`;
          body += `${attachment.content}\r\n\r\n`;
        }

        body += `--${boundary}--\r\n`;
        rawMessage = body;
      }

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
    } else if (action === "get") {
      const { id } = body as { id?: string };
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing 'id' (gmail_message_id) for get action" }), {
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
        console.error("gmail-actions refreshAccessToken (get) error:", err);
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

      // Get full message
      try {
        const m = await getMessage(access_token, id);
        await admin
          .from("email_messages")
          .update({ body_text: m.body_text || null, body_html: m.body_html || null })
          .eq("user_id", user.id)
          .eq("gmail_message_id", id);

        return new Response(JSON.stringify({ body_text: m.body_text, body_html: m.body_html }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("gmail-actions get error:", e);
        return new Response(JSON.stringify({ error: "Failed to fetch message body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (action === "draft") {
      // Create or update a draft
      const { to, cc = [], bcc = [], subject = "", text = "", html = "", draftId } = body as {
        to?: string[];
        cc?: string[];
        bcc?: string[];
        subject?: string;
        text?: string;
        html?: string;
        draftId?: string;
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
        console.error("gmail-actions refreshAccessToken (draft) error:", err);
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

      // Build raw MIME message for draft
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

      let draftResponse;
      try {
        if (draftId) {
          // Update existing draft
          draftResponse = await updateDraft(access_token, draftId, raw);
        } else {
          // Create new draft
          draftResponse = await createDraft(access_token, raw);
        }
      } catch (err) {
        console.error("gmail-actions draft error:", err);
        return new Response(JSON.stringify({ error: "Failed to create/update draft." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ draft: true, id: draftResponse.id, message: draftResponse.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "create-label") {
      // Create a new label in Gmail
      const { name } = body as { name?: string };
      if (!name || !name.trim()) {
        return new Response(JSON.stringify({ error: "Label name is required" }), {
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
        console.error("gmail-actions refreshAccessToken (create-label) error:", err);
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

      try {
        const labelData = await createLabel(access_token, name.trim());
        
        // Store the label in our database
        await admin.from("gmail_labels").upsert({
          user_id: user.id,
          account_id: account.id,
          gmail_label_id: labelData.id,
          name: labelData.name,
          type: 'user',
        });

        return new Response(
          JSON.stringify({ created: true, label: labelData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("gmail-actions create-label error:", err);
        return new Response(JSON.stringify({ error: "Failed to create label in Gmail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (action === "sync-signature") {
      // Sync signature from Gmail
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
        console.error("gmail-actions refreshAccessToken (sync-signature) error:", err);
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

      try {
        const signatureData = await getGmailSignature(access_token);
        
        // Store the signature in our database
        await admin.from("email_accounts").update({
          signature_text: signatureData.signature,
          signature_html: signatureData.signatureHtml,
        }).eq("id", account.id);

        return new Response(
          JSON.stringify({ synced: true, signature: signatureData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("gmail-actions sync-signature error:", err);
        return new Response(JSON.stringify({ error: "Failed to sync signature from Gmail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (action === "update-signature") {
      // Update signature both locally and in Gmail
      const { signature } = body as { signature?: string };
      if (signature === undefined) {
        return new Response(JSON.stringify({ error: "Signature is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
        console.error("gmail-actions refreshAccessToken (update-signature) error:", err);
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

      try {
        // Update signature in Gmail
        await updateGmailSignature(access_token, signature);
        
        // Store the signature in our database
        await admin.from("email_accounts").update({
          signature_text: signature,
          signature_html: signature,
        }).eq("id", account.id);

        return new Response(
          JSON.stringify({ updated: true, signature }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("gmail-actions update-signature error:", err);
        return new Response(JSON.stringify({ error: "Failed to update signature in Gmail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gmail-actions error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
