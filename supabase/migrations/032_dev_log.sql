-- Development session log: captures Claude Code prompts + deploy outcomes
CREATE TABLE IF NOT EXISTS dev_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt        text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  deploy_status text NOT NULL DEFAULT 'pending'
                  CHECK (deploy_status IN ('pending', 'success', 'failed', 'none')),
  commit_hash   text,
  commit_message text,
  deployed_at   timestamptz,
  project       text NOT NULL DEFAULT 'roadtrip-planner',
  session_id    text
);

-- Only service role can write; no RLS needed (admin-only table, no user data)
ALTER TABLE dev_log ENABLE ROW LEVEL SECURITY;

-- Block all access through normal client – API uses service role key
CREATE POLICY "deny all" ON dev_log FOR ALL USING (false);
