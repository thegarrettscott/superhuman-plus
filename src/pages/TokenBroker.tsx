import React, { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Configure which external origins are allowed to request a token.
// IMPORTANT: Add only trusted origins.
const allowedOrigins: string[] = [
  // Example:
  // "https://your-external-app.example.com",
];

const TokenBroker: React.FC = () => {
  useEffect(() => {
    document.title = "Token Broker";

    const handler = async (event: MessageEvent) => {
      try {
        if (!event.origin || !allowedOrigins.includes(event.origin)) return;

        const data: any = event.data || {};

        if (data?.type === "PING") {
          (event.source as Window | null)?.postMessage({ type: "PONG" }, event.origin);
          return;
        }

        if (data?.type === "REQUEST_SUPABASE_TOKEN") {
          const { data: { session } } = await supabase.auth.getSession();
          const payload = session
            ? { access_token: session.access_token, expires_at: session.expires_at }
            : { access_token: null, expires_at: null };

          (event.source as Window | null)?.postMessage(
            { type: "SUPABASE_TOKEN", ...payload },
            event.origin
          );
        }
      } catch (err) {
        // Silently ignore errors to avoid leaking info across origins
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Token broker is active.</p>
    </main>
  );
};

export default TokenBroker;
