-- Create tables for storing Gmail labels, contacts, and sync status

-- Gmail labels/folders table
CREATE TABLE public.gmail_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  gmail_label_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'user', -- system, user, category
  color_background text,
  color_text text,
  messages_total integer DEFAULT 0,
  messages_unread integer DEFAULT 0,
  threads_total integer DEFAULT 0,
  threads_unread integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Gmail contacts table  
CREATE TABLE public.gmail_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  gmail_contact_id text NOT NULL,
  display_name text,
  email_addresses jsonb DEFAULT '[]'::jsonb,
  phone_numbers jsonb DEFAULT '[]'::jsonb,
  photo_url text,
  organization text,
  job_title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sync status tracking table
CREATE TABLE public.sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  sync_type text NOT NULL, -- labels, contacts, messages, filters
  status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  total_items integer DEFAULT 0,
  synced_items integer DEFAULT 0,
  last_sync_token text,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.gmail_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for gmail_labels
CREATE POLICY "Users can view their own labels" ON public.gmail_labels
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own labels" ON public.gmail_labels  
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels" ON public.gmail_labels
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels" ON public.gmail_labels
FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for gmail_contacts
CREATE POLICY "Users can view their own contacts" ON public.gmail_contacts
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts" ON public.gmail_contacts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" ON public.gmail_contacts  
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" ON public.gmail_contacts
FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for sync_status  
CREATE POLICY "Users can view their own sync status" ON public.sync_status
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync status" ON public.sync_status
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync status" ON public.sync_status
FOR UPDATE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_gmail_labels_user_account ON public.gmail_labels(user_id, account_id);
CREATE INDEX idx_gmail_labels_gmail_id ON public.gmail_labels(gmail_label_id);
CREATE INDEX idx_gmail_contacts_user_account ON public.gmail_contacts(user_id, account_id);
CREATE INDEX idx_gmail_contacts_gmail_id ON public.gmail_contacts(gmail_contact_id);
CREATE INDEX idx_sync_status_user_account ON public.sync_status(user_id, account_id);

-- Add triggers for updated_at
CREATE TRIGGER update_gmail_labels_updated_at
BEFORE UPDATE ON public.gmail_labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gmail_contacts_updated_at  
BEFORE UPDATE ON public.gmail_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at
BEFORE UPDATE ON public.sync_status
FOR EACH ROW  
EXECUTE FUNCTION public.update_updated_at_column();