CREATE TABLE public.workspace_template_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  based_on text,
  definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_template_library TO authenticated;
GRANT ALL ON public.workspace_template_library TO service_role;
ALTER TABLE public.workspace_template_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY wtl_read ON public.workspace_template_library FOR SELECT TO authenticated
  USING (status = 'published' OR private.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY wtl_ins ON public.workspace_template_library FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY wtl_upd ON public.workspace_template_library FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY wtl_del ON public.workspace_template_library FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.tenant_workspaces
  ADD COLUMN IF NOT EXISTS template_config jsonb,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===== RESTAURANT =====
CREATE OR REPLACE FUNCTION private.rest_member(_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT public.is_tenant_member(_tenant, auth.uid()) OR private.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = _tenant AND t.owner_id = auth.uid());
$$;

CREATE TABLE public.rest_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL, city text, seats integer NOT NULL DEFAULT 40, monthly_target numeric NOT NULL DEFAULT 0,
  manager text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL, phone text, email text, birthday date, anniversary date,
  favourite_dishes text, preferences text, tier text NOT NULL DEFAULT 'Silver',
  loyalty_points integer NOT NULL DEFAULT 0, visits integer NOT NULL DEFAULT 0, total_spend numeric NOT NULL DEFAULT 0,
  last_visit_at timestamptz, home_outlet_id uuid REFERENCES public.rest_outlets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.rest_outlets(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.rest_guests(id) ON DELETE SET NULL,
  guest_name text NOT NULL, phone text, party_size integer NOT NULL DEFAULT 2, reserved_for timestamptz NOT NULL,
  table_no text, occasion text, notes text,
  status text NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked','Confirmed','Waitlist','Seated','Completed','No-show','Cancelled')),
  source text DEFAULT 'Phone', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.rest_outlets(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.rest_guests(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'Dine-in' CHECK (channel IN ('Dine-in','Takeaway','Delivery','Zomato','Swiggy','Catering','Corporate')),
  items text, amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0), covers integer,
  status text NOT NULL DEFAULT 'Completed' CHECK (status IN ('Open','Completed','Cancelled')),
  ordered_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_loyalty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.rest_guests(id) ON DELETE CASCADE,
  points integer NOT NULL, reason text, order_id uuid REFERENCES public.rest_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.rest_outlets(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.rest_guests(id) ON DELETE SET NULL,
  reviewer text, platform text NOT NULL DEFAULT 'Google', rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text, reply text, replied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rest_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.rest_guests(id) ON DELETE CASCADE,
  kind text NOT NULL, reason text, message text, priority integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Sent','Done','Dismissed')),
  source text NOT NULL DEFAULT 'Rule', due_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['rest_outlets','rest_guests','rest_reservations','rest_orders','rest_loyalty','rest_reviews','rest_actions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.rest_member(tenant_id)) WITH CHECK (private.rest_member(tenant_id))', t||'_member', t);
    EXECUTE format('CREATE INDEX ON public.%I (tenant_id)', t);
  END LOOP;
END $$;

-- completed orders update guest stats + award points (1 pt / ₹100)
CREATE OR REPLACE FUNCTION private.rest_order_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pts int;
BEGIN
  IF NEW.guest_id IS NOT NULL AND NEW.status = 'Completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Completed') THEN
    pts := floor(NEW.amount / 100)::int;
    UPDATE public.rest_guests SET visits = visits + 1, total_spend = total_spend + NEW.amount,
      last_visit_at = GREATEST(COALESCE(last_visit_at, NEW.ordered_at), NEW.ordered_at) WHERE id = NEW.guest_id;
    IF pts > 0 THEN
      INSERT INTO public.rest_loyalty(tenant_id, guest_id, points, reason, order_id) VALUES (NEW.tenant_id, NEW.guest_id, pts, 'Order ₹' || NEW.amount, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rest_order_after AFTER INSERT OR UPDATE ON public.rest_orders FOR EACH ROW EXECUTE FUNCTION private.rest_order_after();

CREATE OR REPLACE FUNCTION private.rest_loyalty_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid := COALESCE(NEW.guest_id, OLD.guest_id); total int;
BEGIN
  SELECT COALESCE(SUM(points),0) INTO total FROM public.rest_loyalty WHERE guest_id = g;
  IF total < 0 THEN RAISE EXCEPTION 'Not enough loyalty points'; END IF;
  UPDATE public.rest_guests SET loyalty_points = total,
    tier = CASE WHEN total >= 2000 THEN 'Platinum' WHEN total >= 800 THEN 'Gold' ELSE 'Silver' END WHERE id = g;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_rest_loyalty_sync AFTER INSERT OR DELETE ON public.rest_loyalty FOR EACH ROW EXECUTE FUNCTION private.rest_loyalty_sync();