-- Create email filters table
CREATE TABLE public.email_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email tags table
CREATE TABLE public.email_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_message_tags junction table
CREATE TABLE public.email_message_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_message_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_filters
CREATE POLICY "Users can view their own filters" 
ON public.email_filters 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own filters" 
ON public.email_filters 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own filters" 
ON public.email_filters 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own filters" 
ON public.email_filters 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for email_tags
CREATE POLICY "Users can view their own tags" 
ON public.email_tags 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags" 
ON public.email_tags 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" 
ON public.email_tags 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" 
ON public.email_tags 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for email_message_tags
CREATE POLICY "Users can view their own message tags" 
ON public.email_message_tags 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own message tags" 
ON public.email_message_tags 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own message tags" 
ON public.email_message_tags 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message tags" 
ON public.email_message_tags 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_email_filters_updated_at
BEFORE UPDATE ON public.email_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_tags_updated_at
BEFORE UPDATE ON public.email_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();