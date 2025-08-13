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
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET")!;

// Utilities
const b64url = (input: ArrayBuffer | string) => {
  const str = typeof input === "string" ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const b64urlToBytes = (str: string) => {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (str.length % 4)) % 4);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

// Constant-time compare for Deno (no crypto.timingSafeEqual available)
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function hmacSign(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OAUTH_STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // POST action=start -> returns Google auth URL
    if (req.method === "POST") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { redirect_url } = await req.json().catch(() => ({ redirect_url: undefined }));
      const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth`;

      // Create signed state
      const payload = { user_id: user.id, ts: Date.now(), redirect_url: redirect_url || "" };
      const payloadStr = JSON.stringify(payload);
      const sig = await hmacSign(payloadStr);
      const state = `${b64url(payloadStr)}.${b64url(sig)}`;

      const scopes = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email", 
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/contacts.readonly",
        "openid",
      ].join(" ");

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

      return new Response(JSON.stringify({ authUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET callback from Google
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`OAuth error: ${error}`, { status: 400, headers: corsHeaders });
      }
      if (!code || !state) {
        return new Response("Missing code/state", { status: 400, headers: corsHeaders });
      }

      // Verify state
      const parts = state.split(".");
      if (parts.length !== 2) return new Response("Invalid state", { status: 400, headers: corsHeaders });
      const [payloadB64, sigB64] = parts;
      const payloadStr = new TextDecoder().decode(new Uint8Array(b64urlToBytes(payloadB64)));
      const sigBytes = b64urlToBytes(sigB64);

const expectedSig = await hmacSign(payloadStr);
      const sigOk = timingSafeEqual(new Uint8Array(expectedSig), new Uint8Array(sigBytes));
      if (!sigOk) return new Response("Invalid state signature", { status: 400, headers: corsHeaders });
      const payload = JSON.parse(payloadStr) as { user_id: string; ts: number; redirect_url?: string };
      const redirectBack = payload.redirect_url || "/";
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${SUPABASE_URL}/functions/v1/gmail-oauth`,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        console.error("Token exchange failed:", txt);
        return new Response("Token exchange failed", { status: 500, headers: corsHeaders });
      }
      const tokenJson = await tokenRes.json();
      const { access_token, refresh_token, expires_in, scope, token_type, id_token } = tokenJson;

      // Get profile email
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const profile = await profileRes.json().catch(() => ({}));
      const email = profile?.email ?? "";

      // Store tokens (service role bypasses RLS)
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      // Try to find existing account for this user/provider
      const { data: existing, error: selErr } = await admin
        .from("email_accounts")
        .select("id")
        .eq("user_id", payload.user_id)
        .eq("provider", "gmail")
        .maybeSingle();

      const upsertData = {
        user_id: payload.user_id,
        provider: "gmail",
        email_address: email,
        refresh_token: refresh_token ?? null,
        access_token: access_token ?? null,
        token_type: token_type ?? null,
        scope: scope ?? null,
        access_token_expires_at: new Date(Date.now() + (Number(expires_in || 0) * 1000)).toISOString(),
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      let accountId: string;
      if (existing?.id) {
        const { error: updErr } = await admin
          .from("email_accounts")
          .update(upsertData)
          .eq("id", existing.id);
        if (updErr) console.error("Update email_accounts error:", updErr);
        accountId = existing.id;
      } else {
        const { data: newAccount, error: insErr } = await admin
          .from("email_accounts")
          .insert({ ...upsertData, created_at: new Date().toISOString() })
          .select('id')
          .single();
        if (insErr) {
          console.error("Insert email_accounts error:", insErr);
          accountId = '';
        } else {
          accountId = newAccount.id;
        }
      }

      // Trigger directory sync for new or updated accounts
      if (accountId && access_token) {
        console.log('Triggering directory sync...');
        try {
          const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/directory-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              userId: payload.user_id,
              accountId: accountId,
              accessToken: access_token
            }),
          });
          
          if (!syncResponse.ok) {
            console.error('Failed to trigger directory sync:', await syncResponse.text());
          } else {
            console.log('Directory sync triggered successfully');
          }
        } catch (syncError) {
          console.error('Error triggering directory sync:', syncError);
        }
      }

      // Redirect back to app
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${redirectBack}?gmail=connected`,
          ...corsHeaders,
        },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    console.error("gmail-oauth error:", e);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
