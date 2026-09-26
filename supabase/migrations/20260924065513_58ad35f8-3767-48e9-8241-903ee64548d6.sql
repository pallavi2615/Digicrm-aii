
ALTER TABLE public.creator_deliverables
  ADD COLUMN IF NOT EXISTS reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagements integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_generated numeric NOT NULL DEFAULT 0;

CREATE TABLE public.creator_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  creator_id uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
  stream text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  received_on date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_income TO authenticated;
GRANT ALL ON public.creator_income TO service_role;
ALTER TABLE public.creator_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_income_own ON public.creator_income FOR ALL TO authenticated
  USING (private.creator_can(owner_id)) WITH CHECK (private.creator_can(owner_id));

CREATE TABLE public.brand_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id uuid NOT NULL DEFAULT auth.uid(),
  company text NOT NULL,
  title text NOT NULL,
  brief text,
  budget numeric,
  platform text,
  category text,
  min_followers integer NOT NULL DEFAULT 0,
  deadline date,
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_campaigns TO authenticated;
GRANT ALL ON public.brand_campaigns TO service_role;
ALTER TABLE public.brand_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_campaigns_own ON public.brand_campaigns FOR ALL TO authenticated
  USING (brand_user_id = auth.uid() OR private.is_admin(auth.uid())) WITH CHECK (brand_user_id = auth.uid());
CREATE POLICY brand_campaigns_open_read ON public.brand_campaigns FOR SELECT TO authenticated
  USING (status = 'Open' AND private.can_see_industry('creator-economy'));

CREATE TABLE public.brand_campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  creator_id uuid REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  pitch text,
  quote numeric,
  status text NOT NULL DEFAULT 'Applied',
  deal_id uuid REFERENCES public.creator_deals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, creator_id)
);
GRANT SELECT ON public.brand_campaign_applications TO authenticated;
GRANT ALL ON public.brand_campaign_applications TO service_role;
ALTER TABLE public.brand_campaign_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY bca_own_read ON public.brand_campaign_applications FOR SELECT TO authenticated
  USING (private.creator_can(owner_id));

-- Multi-step pitch follow-up sequence: Day 3, 7, 14 after last activity; Day 30 re-engagement.
CREATE OR REPLACE FUNCTION public.run_creator_sequences()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _uid uuid := auth.uid(); r record; _n int := 0; _ok boolean; _day int; _label text;
BEGIN
  IF _uid IS NOT NULL AND NOT private.can_see_industry('creator-economy') AND NOT private.is_admin(_uid) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  FOR r IN SELECT d.id, d.owner_id, d.campaign, d.stage, (current_date - d.updated_at::date) AS age, b.name AS brand
    FROM creator_deals d LEFT JOIN creator_brands b ON b.id = d.brand_id
    WHERE d.stage IN ('Contacted','Pitch Sent','Proposal Sent','Contract Sent','Negotiation')
      AND (_uid IS NULL OR d.owner_id = _uid)
  LOOP
    _day := CASE WHEN r.age >= 30 THEN 30 WHEN r.age >= 14 THEN 14 WHEN r.age >= 7 THEN 7 WHEN r.age >= 3 THEN 3 ELSE 0 END;
    CONTINUE WHEN _day = 0;
    _label := CASE _day WHEN 3 THEN 'First follow-up' WHEN 7 THEN 'Second follow-up' WHEN 14 THEN 'Final follow-up' ELSE 'Re-engagement' END;
    INSERT INTO creator_alert_log(owner_id, rule, ref_id, sent_on) VALUES (r.owner_id, 'seq' || _day, r.id, '2000-01-01')
      ON CONFLICT DO NOTHING RETURNING true INTO _ok;
    IF _ok THEN
      INSERT INTO notifications(user_id, title, body, link) VALUES (r.owner_id, _label || ' due: ' || coalesce(r.brand, r.campaign),
        'No reply for ' || r.age || ' days on ' || r.campaign || ' (' || r.stage || '). Draft the message with AI from the deal page.', '/creator/deal/' || r.id);
      _n := _n + 1;
    END IF;
    _ok := NULL;
  END LOOP;
  -- Renewal: campaigns ending within 30 days
  FOR r IN SELECT d.id, d.owner_id, d.campaign, d.end_date, b.name AS brand FROM creator_deals d LEFT JOIN creator_brands b ON b.id = d.brand_id
    WHERE d.end_date BETWEEN current_date AND current_date + 30 AND d.stage IN ('Published','Invoice Sent','Payment Pending','Paid')
      AND (_uid IS NULL OR d.owner_id = _uid)
  LOOP
    INSERT INTO creator_alert_log(owner_id, rule, ref_id, sent_on) VALUES (r.owner_id, 'renewal', r.id, '2000-01-01') ON CONFLICT DO NOTHING RETURNING true INTO _ok;
    IF _ok THEN
      INSERT INTO notifications(user_id, title, body, link) VALUES (r.owner_id, 'Renewal opportunity: ' || coalesce(r.brand, r.campaign),
        r.campaign || ' ends on ' || r.end_date || '. Contact the brand about a renewal.', '/creator/deal/' || r.id);
      _n := _n + 1;
    END IF;
    _ok := NULL;
  END LOOP;
  RETURN jsonb_build_object('sequence_alerts', _n);
END $$;
REVOKE ALL ON FUNCTION public.run_creator_sequences() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_creator_sequences() TO authenticated, service_role;
SELECT cron.schedule('creator-sequences-daily', '35 3 * * *', $$SELECT public.run_creator_sequences()$$);
