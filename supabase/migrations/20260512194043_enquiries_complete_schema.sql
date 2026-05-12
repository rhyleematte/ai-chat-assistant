-- ============================================================
-- Enquiries schema setup for: fapqwlvlnrvkttudfkij.supabase.co
-- Safe to run on a fresh OR partially-set-up project.
-- Only creates the enquiries table and its supporting objects.
-- ============================================================

-- ── 1. enquiries table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enquiries (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name              TEXT        NOT NULL,
  client_email             TEXT        NOT NULL,
  client_phone             TEXT,
  property_address         TEXT,
  message                  TEXT        NOT NULL,
  enquiry_type             TEXT,
  category                 TEXT,
  confidence               NUMERIC,
  priority                 TEXT,
  suggested_response       TEXT,
  recommended_action       TEXT,
  assigned_staff           TEXT,
  clarity_reason           TEXT,
  analysis_count           INTEGER     NOT NULL DEFAULT 1,
  ai_model                 TEXT,
  ai_error                 TEXT,
  status                   TEXT        NOT NULL DEFAULT 'new',
  resolved_at              TIMESTAMPTZ,
  resolution_email_sent_at TIMESTAMPTZ,
  crm_pushed_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add any columns that might be missing (safe on existing tables)
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS enquiry_type             TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS assigned_staff           TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS clarity_reason           TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS analysis_count           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS resolved_at              TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS resolution_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS crm_pushed_at            TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries(created_at DESC);

-- ── 2. updated_at auto-trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enquiries_updated_at ON public.enquiries;
CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Row Level Security ────────────────────────────────────
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert enquiries"  ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can view enquiries"    ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can update enquiries"  ON public.enquiries;
DROP POLICY IF EXISTS "Staff view enquiries"         ON public.enquiries;
DROP POLICY IF EXISTS "Staff update enquiries"       ON public.enquiries;
DROP POLICY IF EXISTS "Admins delete enquiries"      ON public.enquiries;

-- Allow anyone to submit an enquiry (public form)
CREATE POLICY "Anyone can insert enquiries"
  ON public.enquiries FOR INSERT WITH CHECK (true);

-- Allow anyone to view enquiries (dashboard is not auth-gated yet)
CREATE POLICY "Anyone can view enquiries"
  ON public.enquiries FOR SELECT USING (true);

-- Allow anyone to update enquiries (status changes from dashboard)
CREATE POLICY "Anyone can update enquiries"
  ON public.enquiries FOR UPDATE USING (true);
