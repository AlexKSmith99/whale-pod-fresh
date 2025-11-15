-- Initial Schema: Profiles, Pursuits, and Team Members

-- Profiles table (extends auth.users with additional info)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pursuits (Pods/Teams)
CREATE TABLE IF NOT EXISTS pursuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on pursuits
ALTER TABLE pursuits ENABLE ROW LEVEL SECURITY;

-- Pursuits policies
CREATE POLICY "Users can view pursuits they're part of"
  ON pursuits FOR SELECT
  USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.pursuit_id = pursuits.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create pursuits"
  ON pursuits FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own pursuits"
  ON pursuits FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own pursuits"
  ON pursuits FOR DELETE
  USING (auth.uid() = creator_id);

-- Team Members (who belongs to which pod)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pursuit_id, user_id)
);

-- Enable RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Team members policies
CREATE POLICY "Team members can view members of their team"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND (
        pursuits.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.pursuit_id = team_members.pursuit_id
          AND tm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Creators can manage team members"
  ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pursuits
      WHERE pursuits.id = team_members.pursuit_id
      AND pursuits.creator_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_pursuits_creator ON pursuits(creator_id);
CREATE INDEX idx_team_members_pursuit ON team_members(pursuit_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
