-- ============================================================
-- Filmoteka — roles, profiles, access requests
-- Run in Supabase SQL Editor
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
CREATE TABLE profiles (
  id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (to check their own role)
CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- ── Helper: check if calling user is admin ──────────────────
-- SECURITY DEFINER avoids recursive RLS on the profiles table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-create profile with role='user' when a new user is created
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();

-- Create profiles for all users already in the system
INSERT INTO profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Make morethansilver@gmail.com the admin
UPDATE profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'morethansilver@gmail.com');

-- ── access_requests ─────────────────────────────────────────
CREATE TABLE access_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  message    text,
  status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'invited', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (unauthenticated too) can submit a request
CREATE POLICY "public_insert" ON access_requests
  FOR INSERT WITH CHECK (true);

-- Only admins can view and manage requests
CREATE POLICY "admin_select" ON access_requests
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_update" ON access_requests
  FOR UPDATE USING (is_admin());

CREATE POLICY "admin_delete" ON access_requests
  FOR DELETE USING (is_admin());
