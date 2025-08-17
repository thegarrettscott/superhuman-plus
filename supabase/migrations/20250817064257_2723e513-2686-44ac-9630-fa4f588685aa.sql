-- Tighten RLS policy: remove overly permissive UPDATE policy on sync_jobs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'sync_jobs' AND policyname = 'Service role can update sync jobs'
  ) THEN
    DROP POLICY "Service role can update sync jobs" ON public.sync_jobs;
  END IF;
END $$;

-- (Optional) If we ever want users to update their own jobs (e.g., cancel), we can add a strict policy later.

-- Helpful indexes for tags mapping performance (optional but useful for speed)
CREATE INDEX IF NOT EXISTS idx_email_message_tags_message ON public.email_message_tags (message_id);
CREATE INDEX IF NOT EXISTS idx_email_message_tags_tag ON public.email_message_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_email_tags_user_name ON public.email_tags (user_id, name);
