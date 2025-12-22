-- Migration: Add status column to alerts table
-- Run this in Supabase SQL Editor if you already have the tables

-- Add status column
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CHECK (status IN ('active', 'leaving_soon', 'resolved'));

-- Add updated_at column if it doesn't exist
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing alerts to have 'active' status
UPDATE alerts SET status = 'active' WHERE status IS NULL;
