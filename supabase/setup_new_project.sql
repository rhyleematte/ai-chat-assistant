-- ============================================================
-- Full schema setup for: fapqwlvlnrvkttudfkij.supabase.co
-- Safe to run on a fresh OR partially-set-up project.
-- Uses DO blocks and IF NOT EXISTS guards throughout.
-- ============================================================

-- ── 1. Enum (safe: only creates if missing) ──────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. enquiries table ───────────────────────────────────────
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

-- ── 3. profiles table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. user_roles table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role  NOT NULL,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ── 5. Helper functions ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('staff', 'admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── 6. Triggers (drop-and-recreate is safe for triggers) ─────
DROP TRIGGER IF EXISTS trg_enquiries_updated_at ON public.enquiries;
CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 7. Row Level Security ────────────────────────────────────
ALTER TABLE public.enquiries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- enquiries policies (drop first so re-running is safe)
DROP POLICY IF EXISTS "Anyone can insert enquiries"  ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can view enquiries"    ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can update enquiries"  ON public.enquiries;
DROP POLICY IF EXISTS "Staff view enquiries"         ON public.enquiries;
DROP POLICY IF EXISTS "Staff update enquiries"       ON public.enquiries;
DROP POLICY IF EXISTS "Admins delete enquiries"      ON public.enquiries;

CREATE POLICY "Anyone can insert enquiries"
  ON public.enquiries FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff view enquiries"
  ON public.enquiries FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff update enquiries"
  ON public.enquiries FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins delete enquiries"
  ON public.enquiries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- profiles policies
DROP POLICY IF EXISTS "Users view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_roles policies
DROP POLICY IF EXISTS "Users view own roles"  ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles"   ON public.user_roles;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
