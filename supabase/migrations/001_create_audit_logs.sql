-- Supabase migration: Create audit_logs table
-- Run this in the Supabase SQL Editor or via CLI: supabase db push

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  detection_type text NOT NULL CHECK (detection_type IN ('image', 'video', 'webcam')),
  media_type    text NOT NULL,
  file_name     text,
  file_size     bigint,
  detection_result text NOT NULL CHECK (detection_result IN ('deepfake', 'real', 'uncertain')),
  confidence_score double precision NOT NULL,
  processing_time_ms integer NOT NULL,
  ip_address    text,
  user_agent    text,
  session_id    text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_detection_type ON public.audit_logs(detection_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_detection_result ON public.audit_logs(detection_result);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read/insert their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
