-- Add is_admin column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark frodesa@gmail.com as administrator
UPDATE user_profiles SET is_admin = TRUE WHERE email = 'frodesa@gmail.com';
