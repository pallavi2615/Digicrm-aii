ALTER TABLE public.edu_branches
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'Company-owned',
  ADD COLUMN IF NOT EXISTS franchisee_name text, ADD COLUMN IF NOT EXISTS franchisee_phone text,
  ADD COLUMN IF NOT EXISTS royalty_pct numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS marketing_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS territory text, ADD COLUMN IF NOT EXISTS agreement_end date;

CREATE TABLE public.edu_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.edu_branches(id) ON DELETE CASCADE,
  period text NOT NULL, collection numeric NOT NULL DEFAULT 0, royalty numeric NOT NULL DEFAULT 0, marketing_fee numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Due', paid_on date, reference text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edu_royalties TO authenticated;
GRANT ALL ON public.edu_royalties TO service_role;
ALTER TABLE public.edu_royalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY edu_royalties_member ON public.edu_royalties FOR ALL TO authenticated USING (private.rest_member(tenant_id)) WITH CHECK (private.rest_member(tenant_id));