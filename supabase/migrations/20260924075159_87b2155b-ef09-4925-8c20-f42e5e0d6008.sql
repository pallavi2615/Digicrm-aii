-- ===== DISTRIBUTOR PORTAL =====
ALTER TABLE public.dist_partners ADD COLUMN IF NOT EXISTS portal_email text, ADD COLUMN IF NOT EXISTS portal_user_id uuid;
ALTER TABLE public.dist_collections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Confirmed';

CREATE OR REPLACE FUNCTION private.dist_my_partner_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.dist_partners WHERE portal_user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

CREATE TABLE public.dist_partner_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.dist_products(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, product_id)
);
CREATE TABLE public.dist_partner_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.dist_partners(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.dist_products(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  amount numeric NOT NULL DEFAULT 0,
  customer text,
  sold_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dist_partner_stock TO authenticated;
GRANT SELECT, INSERT ON public.dist_partner_sales TO authenticated;
GRANT ALL ON public.dist_partner_stock, public.dist_partner_sales TO service_role;
ALTER TABLE public.dist_partner_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dist_partner_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY dps_read ON public.dist_partner_stock FOR SELECT TO authenticated
  USING (private.dist_can(owner_id) OR partner_id IN (SELECT private.dist_my_partner_ids()));
CREATE POLICY dsl_read ON public.dist_partner_sales FOR SELECT TO authenticated
  USING (private.dist_can(owner_id) OR partner_id IN (SELECT private.dist_my_partner_ids()));
CREATE POLICY dsl_ins ON public.dist_partner_sales FOR INSERT TO authenticated
  WITH CHECK (partner_id IN (SELECT private.dist_my_partner_ids()));

-- owner + stock bookkeeping for sales
CREATE OR REPLACE FUNCTION private.dist_sale_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE have int;
BEGIN
  SELECT owner_id INTO NEW.owner_id FROM public.dist_partners WHERE id = NEW.partner_id;
  SELECT qty INTO have FROM public.dist_partner_stock WHERE partner_id = NEW.partner_id AND product_id = NEW.product_id;
  IF COALESCE(have,0) < NEW.qty THEN RAISE EXCEPTION 'Not enough stock: you have % units', COALESCE(have,0); END IF;
  UPDATE public.dist_partner_stock SET qty = qty - NEW.qty, updated_at = now() WHERE partner_id = NEW.partner_id AND product_id = NEW.product_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dist_sale_before BEFORE INSERT ON public.dist_partner_sales FOR EACH ROW EXECUTE FUNCTION private.dist_sale_before();

-- delivered orders add to partner stock
CREATE OR REPLACE FUNCTION private.dist_order_to_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'Delivered' AND OLD.status IS DISTINCT FROM 'Delivered' AND NEW.partner_id IS NOT NULL THEN
    INSERT INTO public.dist_partner_stock(owner_id, partner_id, product_id, qty)
    SELECT NEW.owner_id, NEW.partner_id, i.product_id, SUM(i.qty + i.free_qty)
      FROM public.dist_order_items i WHERE i.order_id = NEW.id AND i.product_id IS NOT NULL GROUP BY i.product_id
    ON CONFLICT (partner_id, product_id) DO UPDATE SET qty = public.dist_partner_stock.qty + EXCLUDED.qty, updated_at = now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dist_order_to_stock AFTER UPDATE ON public.dist_orders FOR EACH ROW EXECUTE FUNCTION private.dist_order_to_stock();

-- portal read access
CREATE POLICY dist_partners_portal ON public.dist_partners FOR SELECT TO authenticated USING (portal_user_id = auth.uid());
CREATE POLICY dist_orders_portal ON public.dist_orders FOR SELECT TO authenticated USING (partner_id IN (SELECT private.dist_my_partner_ids()));
CREATE POLICY dist_items_portal ON public.dist_order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.dist_orders WHERE partner_id IN (SELECT private.dist_my_partner_ids())));
CREATE POLICY dist_coll_portal ON public.dist_collections FOR SELECT TO authenticated USING (partner_id IN (SELECT private.dist_my_partner_ids()));
CREATE POLICY dist_products_portal ON public.dist_products FOR SELECT TO authenticated
  USING (owner_id IN (SELECT owner_id FROM public.dist_partners WHERE portal_user_id = auth.uid()));
CREATE POLICY dist_schemes_portal ON public.dist_schemes FOR SELECT TO authenticated
  USING (active AND owner_id IN (SELECT owner_id FROM public.dist_partners WHERE portal_user_id = auth.uid()));

-- claim invite by email
CREATE OR REPLACE FUNCTION public.dist_portal_claim()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE em text; n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  em := lower(auth.jwt() ->> 'email');
  IF em IS NULL THEN RETURN 0; END IF;
  UPDATE public.dist_partners SET portal_user_id = auth.uid()
   WHERE portal_user_id IS NULL AND lower(portal_email) = em;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN (SELECT count(*) FROM public.dist_partners WHERE portal_user_id = auth.uid())::int;
END $$;
REVOKE ALL ON FUNCTION public.dist_portal_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dist_portal_claim() TO authenticated;

-- place order from portal
CREATE OR REPLACE FUNCTION public.dist_portal_place_order(_partner uuid, _items jsonb, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record; oid uuid; it jsonb; pr record; sub numeric := 0; q int;
BEGIN
  SELECT * INTO p FROM public.dist_partners WHERE id = _partner AND portal_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF jsonb_array_length(COALESCE(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
  INSERT INTO public.dist_orders(owner_id, partner_id, status, source, raw_message)
  VALUES (p.owner_id, p.id, 'Pending', 'Distributor Portal', left(_note, 1000)) RETURNING id INTO oid;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := GREATEST(1, LEAST(100000, (it->>'qty')::int));
    SELECT * INTO pr FROM public.dist_products WHERE id = (it->>'product_id')::uuid AND owner_id = p.owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown product'; END IF;
    INSERT INTO public.dist_order_items(owner_id, order_id, product_id, qty, price, line_total)
    VALUES (p.owner_id, oid, pr.id, q, pr.price, pr.price * q);
    sub := sub + pr.price * q;
  END LOOP;
  UPDATE public.dist_orders SET subtotal = sub, total = sub WHERE id = oid;
  RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.dist_portal_place_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dist_portal_place_order(uuid, jsonb, text) TO authenticated;

-- report payment from portal (pending until HQ confirms)
CREATE OR REPLACE FUNCTION public.dist_portal_report_payment(_partner uuid, _amount numeric, _method text, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record; cid uuid;
BEGIN
  SELECT * INTO p FROM public.dist_partners WHERE id = _partner AND portal_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  INSERT INTO public.dist_collections(owner_id, partner_id, amount, method, reference, collected_by, status)
  VALUES (p.owner_id, p.id, _amount, left(COALESCE(_method,'UPI'),30), left(_reference,100), 'Reported by distributor', 'Pending')
  RETURNING id INTO cid;
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.dist_portal_report_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dist_portal_report_payment(uuid, numeric, text, text) TO authenticated;

-- ===== REAL ESTATE GROWTH OS =====
CREATE TABLE public.re_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, developer text, city text, location text, address text,
  rera_number text, project_type text DEFAULT 'Residential', total_units integer DEFAULT 0,
  towers integer DEFAULT 1, floors integer, amenities text, possession_date date,
  price_min numeric, price_max numeric, payment_plans text, brochure_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.re_properties
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.re_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tower text, ADD COLUMN IF NOT EXISTS floor_no integer, ADD COLUMN IF NOT EXISTS unit_no text,
  ADD COLUMN IF NOT EXISTS bhk integer, ADD COLUMN IF NOT EXISTS carpet_area numeric, ADD COLUMN IF NOT EXISTS super_area numeric,
  ADD COLUMN IF NOT EXISTS facing text, ADD COLUMN IF NOT EXISTS parking integer, ADD COLUMN IF NOT EXISTS furnishing text,
  ADD COLUMN IF NOT EXISTS construction_status text, ADD COLUMN IF NOT EXISTS possession_date date,
  ADD COLUMN IF NOT EXISTS rera_number text, ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS inventory_status text NOT NULL DEFAULT 'Available',
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'Sale',
  ADD COLUMN IF NOT EXISTS highlights text;

ALTER TABLE public.re_clients
  ADD COLUMN IF NOT EXISTS source text, ADD COLUMN IF NOT EXISTS alt_phone text, ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS occupation text, ADD COLUMN IF NOT EXISTS intent text DEFAULT 'Buy',
  ADD COLUMN IF NOT EXISTS segment text DEFAULT 'Residential', ADD COLUMN IF NOT EXISTS preferred_location text,
  ADD COLUMN IF NOT EXISTS bhk integer, ADD COLUMN IF NOT EXISTS size_min numeric,
  ADD COLUMN IF NOT EXISTS possession_pref text, ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS timeline_days integer, ADD COLUMN IF NOT EXISTS loan_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS down_payment numeric, ADD COLUMN IF NOT EXISTS temperature text DEFAULT 'Warm',
  ADD COLUMN IF NOT EXISTS ai_score integer, ADD COLUMN IF NOT EXISTS ai_score_reason text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Open', ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS assigned_team text, ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel_partner_id uuid, ADD COLUMN IF NOT EXISTS referred_by text;

ALTER TABLE public.re_deals
  ADD COLUMN IF NOT EXISTS lost_reason text, ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS channel_partner_id uuid;

CREATE TABLE public.re_site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.re_clients(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.re_properties(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.re_projects(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL, agent_name text, meeting_point text,
  status text NOT NULL DEFAULT 'Scheduled',
  checkin_at timestamptz, checkout_at timestamptz, checkin_method text, lat numeric, lng numeric,
  interest integer, feedback jsonb DEFAULT '{}'::jsonb, notes text, ai_summary text, next_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.re_clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'Call', due_at timestamptz NOT NULL, done boolean NOT NULL DEFAULT false,
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.re_deals(id) ON DELETE CASCADE,
  list_price numeric NOT NULL, customer_offer numeric, seller_quote numeric, final_price numeric NOT NULL,
  discount_pct numeric GENERATED ALWAYS AS (CASE WHEN list_price > 0 THEN round((list_price - final_price) * 100 / list_price, 2) ELSE 0 END) STORED,
  approval_level text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'Pending',
  decided_by uuid, decided_at timestamptz, note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.re_deals(id) ON DELETE CASCADE,
  milestone text NOT NULL, amount numeric NOT NULL, due_date date NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0, paid_on date, reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid REFERENCES public.re_deals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.re_clients(id) ON DELETE CASCADE,
  bank text NOT NULL, amount numeric, officer text,
  status text NOT NULL DEFAULT 'Applied', notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_channel_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, company text, phone text, email text, city text, rera_number text,
  specialization text, commission_pct numeric NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id uuid NOT NULL REFERENCES public.re_deals(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.re_channel_partners(id) ON DELETE CASCADE,
  booking_value numeric NOT NULL, pct numeric NOT NULL,
  amount numeric GENERATED ALWAYS AS (round(booking_value * pct / 100, 2)) STORED,
  tds_pct numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'Pending approval', paid_on date, reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.re_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL, city text, segment text, budget_min numeric, budget_max numeric,
  team text NOT NULL, agent_id uuid, priority integer NOT NULL DEFAULT 10, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['re_projects','re_site_visits','re_followups','re_negotiations','re_payment_schedule','re_loans','re_channel_partners','re_commissions','re_assignment_rules'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()))', t||'_r', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())', t||'_i', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()))', t||'_u', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (owner_id = auth.uid() OR private.is_admin(auth.uid()))', t||'_d', t);
  END LOOP;
END $$;

-- discount approvals: >5% manager, >8% admin (director); approver cannot be the requester
CREATE OR REPLACE FUNCTION private.re_negotiation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE d numeric;
BEGIN
  d := CASE WHEN NEW.list_price > 0 THEN (NEW.list_price - NEW.final_price) * 100 / NEW.list_price ELSE 0 END;
  IF TG_OP = 'INSERT' THEN
    NEW.approval_level := CASE WHEN d > 8 THEN 'director' WHEN d > 5 THEN 'manager' ELSE 'none' END;
    NEW.status := CASE WHEN NEW.approval_level = 'none' THEN 'Approved' ELSE 'Pending' END;
    NEW.decided_by := NULL; NEW.decided_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.list_price <> OLD.list_price OR NEW.final_price <> OLD.final_price THEN
    RAISE EXCEPTION 'Create a new offer instead of changing prices on an existing one';
  END IF;
  NEW.approval_level := OLD.approval_level;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.approval_level = 'director' AND NOT private.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Discounts above 8%% need a director (admin) to decide';
    ELSIF OLD.approval_level = 'manager' AND NOT private.is_manager_or_above(auth.uid()) THEN
      RAISE EXCEPTION 'Discounts above 5%% need a sales manager to decide';
    END IF;
    IF OLD.owner_id = auth.uid() AND OLD.approval_level <> 'none' AND NOT private.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'You cannot approve your own discount request';
    END IF;
    NEW.decided_by := auth.uid(); NEW.decided_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_re_negotiation_guard BEFORE INSERT OR UPDATE ON public.re_negotiations FOR EACH ROW EXECUTE FUNCTION private.re_negotiation_guard();

-- commissions can only be approved/paid by managers
CREATE OR REPLACE FUNCTION private.re_commission_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.status := 'Pending approval'; RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT private.is_manager_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Only a manager can approve or pay commissions';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_re_commission_guard BEFORE INSERT OR UPDATE ON public.re_commissions FOR EACH ROW EXECUTE FUNCTION private.re_commission_guard();

-- seed: project + inventory details + partners for existing property owners
DO $$ DECLARE o uuid; pid uuid; i int := 0; r record; BEGIN
  FOR o IN SELECT DISTINCT owner_id FROM public.re_properties WHERE owner_id IS NOT NULL LOOP
    INSERT INTO public.re_projects(owner_id, name, developer, city, location, rera_number, total_units, towers, floors, amenities, possession_date, price_min, price_max, payment_plans)
    VALUES (o, 'Skyline Greens', 'ABC Realty', 'Greater Noida', 'Greater Noida West', 'UPRERAPRJ123456', 240, 4, 22, 'Clubhouse, Pool, School nearby, Park, Gym', '2027-06-30', 8500000, 21000000, '10:80:10 construction-linked; 25:75 flexi')
    RETURNING id INTO pid;
    i := 0;
    FOR r IN SELECT id FROM public.re_properties WHERE owner_id = o ORDER BY created_at LOOP
      i := i + 1;
      UPDATE public.re_properties SET project_id = COALESCE(project_id, pid), tower = COALESCE(tower, 'T' || (1 + i % 4)),
        floor_no = COALESCE(floor_no, 2 + i * 3), unit_no = COALESCE(unit_no, (2 + i * 3)::text || '0' || i),
        bhk = COALESCE(bhk, bedrooms), facing = COALESCE(facing, (ARRAY['Park','East','North','Road','Pool'])[1 + i % 5]),
        carpet_area = COALESCE(carpet_area, round(area_sqft * 0.72)), super_area = COALESCE(super_area, area_sqft),
        parking = COALESCE(parking, 1), construction_status = COALESCE(construction_status, CASE WHEN i % 2 = 0 THEN 'Ready to move' ELSE 'Under construction' END),
        possession_date = COALESCE(possession_date, CASE WHEN i % 2 = 0 THEN current_date ELSE '2027-06-30'::date END),
        inventory_status = CASE status WHEN 'sold' THEN 'Sold' WHEN 'booked' THEN 'Booked' WHEN 'hold' THEN 'Hold' ELSE inventory_status END
      WHERE id = r.id;
    END LOOP;
    INSERT INTO public.re_channel_partners(owner_id, name, company, phone, city, rera_number, specialization, commission_pct) VALUES
      (o, 'Vikram Mehta', 'PropNest Advisors', '9811000001', 'Noida', 'UPRERAAGT10021', 'Residential resale', 2),
      (o, 'Sana Qureshi', 'NRI HomeLink', '9811000002', 'Gurgaon', 'HRERAAGT20455', 'NRI buyers', 2.5);
    INSERT INTO public.re_assignment_rules(owner_id, name, city, segment, budget_min, budget_max, team, priority) VALUES
      (o, 'Greater Noida residential 1–2 Cr', 'Greater Noida', 'Residential', 10000000, 20000000, 'Greater Noida Residential Team', 1),
      (o, 'Luxury above 3 Cr', NULL, 'Residential', 30000000, NULL, 'Luxury Desk', 2),
      (o, 'Commercial', NULL, 'Commercial', NULL, NULL, 'Commercial Team', 3);
  END LOOP;
END $$;