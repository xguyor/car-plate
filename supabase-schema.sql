-- Run this in Supabase SQL Editor
-- WARNING: This will reset the tables if they already exist

-- Drop existing tables and policies
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (no auth required)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  car_plate TEXT UNIQUE,
  push_subscription JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table (audit log)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  detected_plate TEXT NOT NULL,
  manual_correction BOOLEAN DEFAULT FALSE,
  ocr_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_alerts_receiver ON alerts(receiver_id, created_at DESC);
CREATE INDEX idx_alerts_sender ON alerts(sender_id, created_at DESC);
CREATE INDEX idx_users_plate ON users(car_plate);
CREATE INDEX idx_users_email ON users(email);

-- Disable RLS for public access (no auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
