CREATE TABLE public.creator_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  email text NOT NULL,
  member_user_id uuid,
  role text NOT NULL CHECK (role IN ('manager','finance','campaign_manager')),
  status text NOT NULL DEFAULT 'Invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_team_members TO authenticated;
GRANT ALL ON public.creator_team_members TO service_role;
ALTER TABLE public.creator_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY ctm_owner ON public.creator_team_members FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY ctm_self_read ON public.creator_team_members FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.creator_member_role(_owner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT role FROM public.creator_team_members
  WHERE owner_id = _owner AND member_user_id = auth.uid() AND status = 'Active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.creator_can(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.is_admin(auth.uid())
    OR (_owner = auth.uid() AND private.can_see_industry('creator-economy'))
    OR private.creator_member_role(_owner) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.creator_my_team_role()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('owner_id', owner_id, 'role', role)), '[]'::jsonb)
  FROM public.creator_team_members WHERE member_user_id = auth.uid() AND status = 'Active';
$$;
GRANT EXECUTE ON FUNCTION public.creator_my_team_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.creator_claim_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _email text; _n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  UPDATE public.creator_team_members SET member_user_id = auth.uid(), status = 'Active'
   WHERE lower(email) = _email AND member_user_id IS NULL AND status = 'Invited';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF EXISTS (SELECT 1 FROM public.creator_team_members WHERE member_user_id = auth.uid() AND status='Active') THEN
    INSERT INTO public.user_industry_access(user_id, industry_group) VALUES (auth.uid(), 'creator-economy')
    ON CONFLICT (user_id, industry_group) DO NOTHING;
  END IF;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.creator_claim_invites() TO authenticated;

CREATE OR REPLACE FUNCTION private.creator_set_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _o uuid;
BEGIN
  IF NEW.owner_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.creator_profiles WHERE owner_id = auth.uid()) THEN
    SELECT owner_id INTO _o FROM public.creator_team_members WHERE member_user_id = auth.uid() AND status='Active' LIMIT 1;
    IF _o IS NOT NULL THEN NEW.owner_id := _o; END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['creator_deals','creator_deliverables','creator_invoices','creator_contracts','creator_activities','creator_brands','creator_brand_contacts','creator_income'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_creator_set_owner ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_creator_set_owner BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.creator_set_owner()', t);
  END LOOP;
END $$;

ALTER TABLE public.creator_contracts ADD COLUMN IF NOT EXISTS approved_by uuid, ADD COLUMN IF NOT EXISTS approved_at timestamptz, ADD COLUMN IF NOT EXISTS approved_by_name text;
ALTER TABLE public.creator_invoices ADD COLUMN IF NOT EXISTS approved_by uuid, ADD COLUMN IF NOT EXISTS approved_at timestamptz, ADD COLUMN IF NOT EXISTS approved_by_name text;

CREATE OR REPLACE FUNCTION private.creator_guard_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _r text;
BEGIN
  IF private.is_admin(auth.uid()) OR NEW.owner_id = auth.uid() THEN RETURN NEW; END IF;
  _r := private.creator_member_role(NEW.owner_id);
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    IF TG_TABLE_NAME = 'creator_contracts' AND _r = 'manager' THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'creator_invoices' AND _r IN ('manager','finance') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Your team role (%) cannot approve this', COALESCE(_r,'none');
  END IF;
  IF _r = 'campaign_manager' AND TG_TABLE_NAME = 'creator_invoices' THEN
    RAISE EXCEPTION 'Campaign managers cannot edit invoices';
  END IF;
  IF _r = 'finance' AND TG_TABLE_NAME = 'creator_contracts' THEN
    RAISE EXCEPTION 'Finance cannot edit contracts';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_approval ON public.creator_contracts;
CREATE TRIGGER trg_guard_approval BEFORE UPDATE ON public.creator_contracts FOR EACH ROW EXECUTE FUNCTION private.creator_guard_approval();
DROP TRIGGER IF EXISTS trg_guard_approval ON public.creator_invoices;
CREATE TRIGGER trg_guard_approval BEFORE UPDATE ON public.creator_invoices FOR EACH ROW EXECUTE FUNCTION private.creator_guard_approval();

CREATE TABLE public.creator_instagram (
  profile_id uuid PRIMARY KEY REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  ig_user_id text, username text,
  access_token_ciphertext text,
  token_expires_at timestamptz,
  followers integer, engagement_rate numeric, media_count integer,
  synced_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.creator_instagram TO service_role;
ALTER TABLE public.creator_instagram ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.dist_can(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.is_admin(auth.uid()) OR (_owner = auth.uid() AND private.can_see_industry('distribution'));
$$;

CREATE TABLE public.dist_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  parent_id uuid REFERENCES public.dist_partners(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'Retailer' CHECK (level IN ('Super Distributor','Distributor','Dealer','Retailer')),
  name text NOT NULL, owner_name text, phone text, email text, gstin text, pan text,
  address text, city text, state text, territory text, category text,
  credit_limit numeric NOT NULL DEFAULT 0, payment_terms_days integer NOT NULL DEFAULT 30,
  onboarding_stage text NOT NULL DEFAULT 'Active',
  sales_rep text, lat numeric, lng numeric, loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sku text NOT NULL, name text NOT NULL, category text, unit text NOT NULL DEFAULT 'carton',
  price numeric NOT NULL DEFAULT 0, stock integer NOT NULL DEFAULT 0, reorder_level integer NOT NULL DEFAULT 0,
  daily_run_rate numeric NOT NULL DEFAULT 0, expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, kind text NOT NULL DEFAULT 'Quantity' CHECK (kind IN ('Quantity','Value','Target')),
  applies_to text NOT NULL DEFAULT 'All', product_id uuid REFERENCES public.dist_products(id) ON DELETE CASCADE,
  buy_qty integer, free_qty integer, min_value numeric, discount_pct numeric,
  starts_on date, ends_on date, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  partner_id uuid REFERENCES public.dist_partners(id) ON DELETE SET NULL,
  number text NOT NULL DEFAULT ('ORD-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,4)),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Dispatched','Delivered','Cancelled')),
  source text NOT NULL DEFAULT 'Manual', raw_message text,
  subtotal numeric NOT NULL DEFAULT 0, discount numeric NOT NULL DEFAULT 0, total numeric NOT NULL DEFAULT 0,
  sales_rep text, order_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  order_id uuid NOT NULL REFERENCES public.dist_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.dist_products(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 1, free_qty integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0, scheme text, line_total numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.dist_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  partner_id uuid NOT NULL REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL, method text NOT NULL DEFAULT 'UPI', reference text,
  collected_by text, collected_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  scope text NOT NULL DEFAULT 'Salesperson' CHECK (scope IN ('Company','Region','Territory','Distributor','Dealer','Salesperson','Retailer')),
  scope_name text NOT NULL, partner_id uuid REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  period_end date NOT NULL DEFAULT (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  target numeric NOT NULL DEFAULT 0,
  incentive_type text, incentive_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  partner_id uuid NOT NULL REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  sales_rep text NOT NULL, checked_in_at timestamptz NOT NULL DEFAULT now(),
  lat numeric, lng numeric, photo_path text, notes text, ai_summary text,
  outcome text, next_visit date, order_id uuid REFERENCES public.dist_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sales_rep text NOT NULL, weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  area text NOT NULL, partner_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dist_loyalty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  partner_id uuid NOT NULL REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  points integer NOT NULL, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dist_partners','dist_products','dist_schemes','dist_orders','dist_order_items','dist_collections','dist_targets','dist_visits','dist_beats','dist_loyalty'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.dist_can(owner_id)) WITH CHECK (private.dist_can(owner_id))', t || '_own', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.dist_loyalty_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.dist_partners SET loyalty_points = (SELECT COALESCE(SUM(points),0) FROM public.dist_loyalty WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id))
   WHERE id = COALESCE(NEW.partner_id, OLD.partner_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_dist_loyalty AFTER INSERT OR DELETE ON public.dist_loyalty FOR EACH ROW EXECUTE FUNCTION private.dist_loyalty_sync();

CREATE OR REPLACE FUNCTION private.dist_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'Delivered' AND OLD.status IS DISTINCT FROM 'Delivered' AND NEW.partner_id IS NOT NULL THEN
    INSERT INTO public.dist_loyalty(owner_id, partner_id, points, reason)
    VALUES (NEW.owner_id, NEW.partner_id, floor(NEW.total/100)::int, 'Order ' || NEW.number);
  END IF;
  IF NEW.status = 'Dispatched' AND OLD.status IS DISTINCT FROM 'Dispatched' THEN
    UPDATE public.dist_products p SET stock = GREATEST(0, p.stock - (i.qty + i.free_qty))
      FROM public.dist_order_items i WHERE i.order_id = NEW.id AND i.product_id = p.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dist_order_status AFTER UPDATE ON public.dist_orders FOR EACH ROW EXECUTE FUNCTION private.dist_order_status();

CREATE POLICY "dist visits own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dist-visits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "dist visits own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dist-visits' AND (storage.foldername(name))[1] = auth.uid()::text);
