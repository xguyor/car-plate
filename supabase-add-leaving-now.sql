-- Migration: Add 'leaving_now' status option to alerts table
-- Run this in Supabase SQL Editor

-- Drop the existing CHECK constraint and add a new one with 'leaving_now'
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_status_check;

ALTER TABLE alerts
ADD CONSTRAINT alerts_status_check
CHECK (status IN ('active', 'leaving_soon', 'leaving_now', 'resolved'));
