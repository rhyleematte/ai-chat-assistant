ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS enquiry_type TEXT;
