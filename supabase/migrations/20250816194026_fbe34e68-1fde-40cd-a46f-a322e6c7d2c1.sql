-- Add signature support to email accounts table
ALTER TABLE public.email_accounts 
ADD COLUMN signature_text TEXT,
ADD COLUMN signature_html TEXT;