-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false);

-- Create policies for email attachments
CREATE POLICY "Users can upload their own email attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own email attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own email attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);