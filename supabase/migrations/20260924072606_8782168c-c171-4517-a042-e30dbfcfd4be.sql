CREATE TABLE public.tenant_workspaces (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_slug text NOT NULL,
  subtype text,
  location_mode text NOT NULL DEFAULT 'single' CHECK (location_mode IN ('single','multi','franchise')),
  business_description text,
  modules jsonb NOT NULL DEFAULT '[]',
  workflows jsonb NOT NULL DEFAULT '[]',
  whatsapp_templates jsonb NOT NULL DEFAULT '[]',
  reports jsonb NOT NULL DEFAULT '[]',
  roles jsonb NOT NULL DEFAULT '[]',
  integrations jsonb NOT NULL DEFAULT '[]',
  dashboard jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_workspaces TO authenticated;
GRANT ALL ON public.tenant_workspaces TO service_role;
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tw read" ON public.tenant_workspaces FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "tw write" ON public.tenant_workspaces FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(),'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = tenant_workspaces.tenant_id AND m.user_id = auth.uid() AND m.member_role IN ('owner','admin'))
)
WITH CHECK (
  private.has_role(auth.uid(),'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = tenant_workspaces.tenant_id AND m.user_id = auth.uid() AND m.member_role IN ('owner','admin'))
);

CREATE TABLE public.tenant_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'Location' CHECK (kind IN ('Head Office','Location','Franchise')),
  city text,
  state text,
  manager_name text,
  manager_phone text,
  royalty_pct numeric NOT NULL DEFAULT 0,
  marketing_fee_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  opened_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_locations TO authenticated;
GRANT ALL ON public.tenant_locations TO service_role;
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tl read" ON public.tenant_locations FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "tl write" ON public.tenant_locations FOR ALL TO authenticated
USING (
  private.has_role(auth.uid(),'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = tenant_locations.tenant_id AND m.user_id = auth.uid() AND m.member_role IN ('owner','admin'))
)
WITH CHECK (
  private.has_role(auth.uid(),'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = tenant_locations.tenant_id AND m.user_id = auth.uid() AND m.member_role IN ('owner','admin'))
);
CREATE INDEX ON public.tenant_locations(tenant_id);