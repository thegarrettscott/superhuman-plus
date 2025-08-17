-- Create a background sync job table to manage email ingestion
CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  job_type text NOT NULL, -- 'initial_import', 'incremental_sync', 'full_refresh'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb, -- stores job-specific config like mailbox, batch_size, etc
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for sync_jobs
CREATE POLICY "Users can view their own sync jobs" 
ON public.sync_jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync jobs" 
ON public.sync_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update sync jobs" 
ON public.sync_jobs 
FOR UPDATE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_sync_jobs_user_status ON public.sync_jobs (user_id, status);
CREATE INDEX idx_sync_jobs_account ON public.sync_jobs (account_id);

-- Add trigger for timestamp updates
CREATE TRIGGER update_sync_jobs_updated_at
BEFORE UPDATE ON public.sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance email_messages table with better indexing for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_user_date ON public.email_messages (user_id, internal_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_labels ON public.email_messages USING GIN (label_ids);
CREATE INDEX IF NOT EXISTS idx_email_messages_search ON public.email_messages USING GIN (
  to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(from_address, '') || ' ' || coalesce(snippet, '') || ' ' || coalesce(body_text, ''))
);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON public.email_messages (user_id, is_read);

-- Add realtime functionality for sync_jobs
ALTER TABLE public.sync_jobs REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.sync_jobs;