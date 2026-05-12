-- ============================================================
-- Full enquiries schema — consolidated from all migrations.
-- Safe to run on a FRESH or EXISTING Supabase project.
-- All statements use IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- so this can be re-run at any time without errors.
-- ============================================================

-- ── 1. enquiries table (all columns) ─────────────────────────
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

-- ── 2. Add any missing columns (safe on existing tables) ──────
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS enquiry_type             TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS assigned_staff           TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS clarity_reason           TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS analysis_count           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS resolved_at              TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS resolution_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS crm_pushed_at            TIMESTAMPTZ;

-- ── 3. Index ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at
  ON public.enquiries(created_at DESC);

-- ── 4. updated_at trigger ─────────────────────────────────────
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

-- ── 5. Row Level Security ─────────────────────────────────────
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first (idempotent)
DROP POLICY IF EXISTS "Anyone can insert enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can view enquiries"   ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Staff view enquiries"        ON public.enquiries;
DROP POLICY IF EXISTS "Staff update enquiries"      ON public.enquiries;
DROP POLICY IF EXISTS "Admins delete enquiries"     ON public.enquiries;

-- Public: anyone can submit an enquiry via the form
CREATE POLICY "Anyone can insert enquiries"
  ON public.enquiries FOR INSERT WITH CHECK (true);

-- Public: anyone can view enquiries (dashboard not auth-gated yet)
CREATE POLICY "Anyone can view enquiries"
  ON public.enquiries FOR SELECT USING (true);

-- Public: anyone can update status (dashboard not auth-gated yet)
CREATE POLICY "Anyone can update enquiries"
  ON public.enquiries FOR UPDATE USING (true);
