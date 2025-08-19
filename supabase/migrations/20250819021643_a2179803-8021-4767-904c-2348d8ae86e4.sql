-- Add auto_filtering_enabled column to email_accounts table
ALTER TABLE public.email_accounts 
ADD COLUMN auto_filtering_enabled boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.email_accounts.auto_filtering_enabled IS 'Whether automatic email filtering is enabled for this account';