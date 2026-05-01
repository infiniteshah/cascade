-- Cascade Database Schema
-- Phase 1: Households and Profiles

-- Create households table
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  location_lat FLOAT,
  location_lng FLOAT,
  weather_zip TEXT,
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMPTZ
);

-- Create profiles table (links to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profiles_household ON profiles(household_id);
CREATE INDEX idx_households_invite_token ON households(invite_token) WHERE invite_token IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for households
-- Users can view their own household
CREATE POLICY "Users can view their household"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update their own household
CREATE POLICY "Users can update their household"
  ON households FOR UPDATE
  USING (
    id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Anyone can create a household (for new users)
CREATE POLICY "Anyone can create a household"
  ON households FOR INSERT
  WITH CHECK (true);

-- Anyone can read households by invite token (for joining)
CREATE POLICY "Anyone can read household by invite token"
  ON households FOR SELECT
  USING (invite_token IS NOT NULL);

-- Helper function to get user's household_id without triggering RLS
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view household members"
  ON profiles FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function on new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
