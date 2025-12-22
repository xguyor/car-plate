-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  car_plate TEXT UNIQUE,
  push_subscription JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table (audit log)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  detected_plate TEXT NOT NULL,
  manual_correction BOOLEAN DEFAULT FALSE,
  ocr_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_alerts_sender ON alerts(sender_id, created_at DESC);
CREATE INDEX idx_alerts_receiver ON alerts(receiver_id, created_at DESC);
CREATE INDEX idx_users_plate ON users(car_plate);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own profile
CREATE POLICY "Users view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- All authenticated users can view all users (to find by plate)
CREATE POLICY "Authenticated users view all users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can view alerts they sent or received
CREATE POLICY "Users view own alerts" ON alerts
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Users can insert alerts
CREATE POLICY "Users create alerts" ON alerts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Function to sync auth.users with public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();