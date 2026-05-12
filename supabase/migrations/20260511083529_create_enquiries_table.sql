CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  property_address TEXT,
  message TEXT NOT NULL,
  category TEXT,
  confidence NUMERIC,
  priority TEXT,
  suggested_response TEXT,
  recommended_action TEXT,
  ai_model TEXT,
  ai_error TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert enquiries" ON public.enquiries;
CREATE POLICY "Anyone can insert enquiries"
  ON public.enquiries FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view enquiries" ON public.enquiries;
CREATE POLICY "Anyone can view enquiries"
  ON public.enquiries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can update enquiries" ON public.enquiries;
CREATE POLICY "Anyone can update enquiries"
  ON public.enquiries FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries(created_at DESC);
