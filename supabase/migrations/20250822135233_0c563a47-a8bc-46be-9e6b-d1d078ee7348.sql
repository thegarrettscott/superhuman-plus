-- Fix malformed array literals in email_messages table
-- Convert string label_ids to proper arrays
UPDATE email_messages 
SET label_ids = ARRAY[label_ids::text]
WHERE label_ids IS NOT NULL 
  AND array_length(label_ids, 1) IS NULL
  AND label_ids::text != '';

-- Set empty arrays for null label_ids
UPDATE email_messages 
SET label_ids = ARRAY[]::text[]
WHERE label_ids IS NULL;

-- Add a constraint to ensure label_ids is always an array
ALTER TABLE email_messages 
ADD CONSTRAINT check_label_ids_is_array 
CHECK (label_ids IS NOT NULL);