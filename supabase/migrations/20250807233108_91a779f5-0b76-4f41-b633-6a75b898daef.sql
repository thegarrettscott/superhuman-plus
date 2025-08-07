-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reusable updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Email accounts table for Gmail connections
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email_address TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT,
  history_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_is_gmail CHECK (provider = 'gmail'),
  CONSTRAINT email_accounts_user_email_unique UNIQUE (user_id, email_address)
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_accounts
DROP POLICY IF EXISTS "Users can view their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can view their own email accounts"
ON public.email_accounts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can insert their own email accounts"
ON public.email_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can update their own email accounts"
ON public.email_accounts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can delete their own email accounts"
ON public.email_accounts FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER trg_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email messages table for storing Gmail messages
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  snippet TEXT,
  internal_date TIMESTAMPTZ,
  label_ids TEXT[],
  is_read BOOLEAN NOT NULL DEFAULT false,
  body_text TEXT,
  body_html TEXT,
  size_estimate INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_user ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account ON public.email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_internal_date ON public.email_messages(internal_date DESC);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.email_messages;
CREATE POLICY "Users can view their own messages"
ON public.email_messages FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.email_messages;
CREATE POLICY "Users can insert their own messages"
ON public.email_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.email_messages;
CREATE POLICY "Users can update their own messages"
ON public.email_messages FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.email_messages;
CREATE POLICY "Users can delete their own messages"
ON public.email_messages FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_email_messages_updated_at ON public.email_messages;
CREATE TRIGGER trg_email_messages_updated_at
BEFORE UPDATE ON public.email_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outgoing email logs
CREATE TABLE IF NOT EXISTS public.outgoing_mail_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error_message TEXT,
  gmail_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outgoing_mail_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own send logs" ON public.outgoing_mail_logs;
CREATE POLICY "Users can view their own send logs"
ON public.outgoing_mail_logs FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own send logs" ON public.outgoing_mail_logs;
CREATE POLICY "Users can insert their own send logs"
ON public.outgoing_mail_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own send logs" ON public.outgoing_mail_logs;
CREATE POLICY "Users can update their own send logs"
ON public.outgoing_mail_logs FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own send logs" ON public.outgoing_mail_logs;
CREATE POLICY "Users can delete their own send logs"
ON public.outgoing_mail_logs FOR DELETE
USING (auth.uid() = user_id);
