ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS clarity_reason text,
  ADD COLUMN IF NOT EXISTS assigned_staff text,
  ADD COLUMN IF NOT EXISTS analysis_count integer NOT NULL DEFAULT 1;