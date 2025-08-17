-- Add initial import tracking to email_accounts table
ALTER TABLE public.email_accounts 
ADD COLUMN initial_import_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN initial_import_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries
CREATE INDEX idx_email_accounts_import_status ON public.email_accounts(user_id, initial_import_completed);