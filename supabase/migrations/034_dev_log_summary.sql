-- Add summary column to dev_log for storing Claude's response after each session
ALTER TABLE dev_log ADD COLUMN IF NOT EXISTS summary text;
