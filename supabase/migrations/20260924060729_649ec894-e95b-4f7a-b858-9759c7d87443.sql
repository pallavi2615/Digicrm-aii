
CREATE OR REPLACE FUNCTION private.creator_can(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.is_admin(auth.uid())
    OR (_owner = auth.uid() AND private.can_see_industry('creator-economy'));
$$;

CREATE TABLE public.creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  handle text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text, avatar_url text, niche text, location text,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  categories text[] NOT NULL DEFAULT '{}',
  past_brands text[] NOT NULL DEFAULT '{}',
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  agency_commission_pct numeric NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, company text, industry text, website text, logo_url text,
  location text, category text, company_size text, marketing_budget numeric,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_platforms text[] NOT NULL DEFAULT '{}',
  preferred_content text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_brand_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  brand_id uuid NOT NULL REFERENCES public.creator_brands(id) ON DELETE CASCADE,
  name text NOT NULL, role text, designation text, email text, phone text, whatsapp text, linkedin text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  creator_id uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.creator_brands(id) ON DELETE SET NULL,
  campaign text NOT NULL,
  objective text, agency text, campaign_manager text,
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  platform text, deal_type text,
  stage text NOT NULL DEFAULT 'New Lead',
  probability integer NOT NULL DEFAULT 10,
  next_action text, next_action_at date, deadline date,
  start_date date, end_date date,
  payment_terms text, gst_pct numeric NOT NULL DEFAULT 18, commission_pct numeric NOT NULL DEFAULT 0,
  usage_rights text, exclusivity text, source text NOT NULL DEFAULT 'Manual',
  requirements text, notes text,
  approval_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.creator_deals(id) ON DELETE CASCADE,
  content_type text NOT NULL, platform text, quantity integer NOT NULL DEFAULT 1,
  due_date date, status text NOT NULL DEFAULT 'Draft',
  caption text, script text, draft_url text,
  revision_count integer NOT NULL DEFAULT 0, brand_comment text, posted_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  creator_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  item text NOT NULL, platform text, kind text NOT NULL DEFAULT 'base', price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.creator_deals(id) ON DELETE CASCADE,
  number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0, tax_pct numeric NOT NULL DEFAULT 18,
  status text NOT NULL DEFAULT 'Draft',
  issued_at date DEFAULT current_date, due_date date,
  paid_amount numeric NOT NULL DEFAULT 0, paid_at date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.creator_deals(id) ON DELETE CASCADE,
  title text NOT NULL, body text, status text NOT NULL DEFAULT 'Draft',
  analysis jsonb, signed_at date, expires_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid REFERENCES public.creator_deals(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.creator_brands(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note', body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['creator_profiles','creator_brands','creator_brand_contacts','creator_deals','creator_deliverables','creator_rate_cards','creator_invoices','creator_contracts','creator_activities'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.creator_can(owner_id)) WITH CHECK (private.creator_can(owner_id))', t || '_own', t);
    EXECUTE format('CREATE INDEX ON public.%I (owner_id)', t);
  END LOOP;
END $$;
