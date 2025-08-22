-- Revert strict NOT NULL constraint added previously
ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS check_label_ids_is_array;