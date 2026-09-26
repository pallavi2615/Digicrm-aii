
ALTER TABLE public.creator_deals ADD COLUMN IF NOT EXISTS brand_email text, ADD COLUMN IF NOT EXISTS brand_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_creator_deals_brand_email ON public.creator_deals (lower(brand_email));
CREATE INDEX IF NOT EXISTS idx_creator_deals_brand_user ON public.creator_deals (brand_user_id);
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS followers integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS engagement_rate numeric NOT NULL DEFAULT 0;

CREATE TABLE public.brand_accounts (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  company text NOT NULL,
  contact_name text,
  email text,
  website text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_accounts TO authenticated;
GRANT ALL ON public.brand_accounts TO service_role;
ALTER TABLE public.brand_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_accounts_own ON public.brand_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.creator_deal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.creator_deals(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.creator_deliverables(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_role text NOT NULL DEFAULT 'creator',
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_deal_comments TO authenticated;
GRANT ALL ON public.creator_deal_comments TO service_role;
ALTER TABLE public.creator_deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_deal_comments_own ON public.creator_deal_comments FOR ALL TO authenticated
  USING (private.creator_can(owner_id)) WITH CHECK (private.creator_can(owner_id) AND author_id = auth.uid());
CREATE INDEX idx_cdc_deal ON public.creator_deal_comments(deal_id, created_at);

CREATE TABLE public.creator_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  rule text NOT NULL,
  ref_id uuid NOT NULL,
  sent_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule, ref_id, sent_on)
);
GRANT SELECT ON public.creator_alert_log TO authenticated;
GRANT ALL ON public.creator_alert_log TO service_role;
ALTER TABLE public.creator_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_alert_log_own ON public.creator_alert_log FOR SELECT TO authenticated USING (private.creator_can(owner_id));

CREATE TABLE public.creator_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  to_email text NOT NULL,
  audience text NOT NULL DEFAULT 'creator',
  rule text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  link text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_email_outbox TO authenticated;
GRANT ALL ON public.creator_email_outbox TO service_role;
ALTER TABLE public.creator_email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_email_outbox_own ON public.creator_email_outbox FOR SELECT TO authenticated USING (private.creator_can(owner_id));

CREATE OR REPLACE FUNCTION public.run_creator_followups()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE
  _uid uuid := auth.uid();
  r record; _brand_email text; _owner_email text; _n int := 0; _e int := 0; _ok boolean;
BEGIN
  IF _uid IS NOT NULL AND NOT private.can_see_industry('creator-economy') AND NOT private.is_admin(_uid) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- 1. Overdue follow-ups on deals
  FOR r IN SELECT d.id, d.owner_id, d.campaign, d.next_action, d.next_action_at, b.name AS brand
    FROM creator_deals d LEFT JOIN creator_brands b ON b.id = d.brand_id
    WHERE d.next_action_at < current_date AND d.stage NOT IN ('Paid','Lost','Renewal')
      AND (_uid IS NULL OR d.owner_id = _uid)
  LOOP
    INSERT INTO creator_alert_log(owner_id, rule, ref_id) VALUES (r.owner_id, 'followup', r.id) ON CONFLICT DO NOTHING RETURNING true INTO _ok;
    IF _ok THEN
      INSERT INTO notifications(user_id, title, body, link) VALUES (r.owner_id, 'Follow-up overdue: ' || r.campaign,
        coalesce(r.next_action, 'Follow up') || ' with ' || coalesce(r.brand, 'the brand') || ' was due ' || r.next_action_at, '/creator/deal/' || r.id);
      SELECT email INTO _owner_email FROM auth.users WHERE id = r.owner_id;
      IF _owner_email IS NOT NULL THEN
        INSERT INTO creator_email_outbox(owner_id, to_email, audience, rule, subject, body, link) VALUES (r.owner_id, _owner_email, 'creator', 'followup',
          'Follow-up overdue: ' || r.campaign, coalesce(r.next_action, 'Follow up') || ' with ' || coalesce(r.brand, 'the brand') || ' was due on ' || r.next_action_at || '.', '/creator/deal/' || r.id);
        _e := _e + 1;
      END IF;
      _n := _n + 1;
    END IF;
    _ok := NULL;
  END LOOP;

  -- 2. Approvals waiting more than 3 days
  FOR r IN SELECT v.id, v.owner_id, v.content_type, d.id AS deal_id, d.campaign, d.brand_email, d.brand_id, d.brand_user_id
    FROM creator_deliverables v JOIN creator_deals d ON d.id = v.deal_id
    WHERE v.status = 'Submitted' AND v.updated_at < now() - interval '3 days'
      AND (_uid IS NULL OR v.owner_id = _uid)
  LOOP
    INSERT INTO creator_alert_log(owner_id, rule, ref_id) VALUES (r.owner_id, 'approval', r.id) ON CONFLICT DO NOTHING RETURNING true INTO _ok;
    IF _ok THEN
      INSERT INTO notifications(user_id, title, body, link) VALUES (r.owner_id, 'Approval pending: ' || r.campaign,
        r.content_type || ' has been waiting for brand approval for over 3 days.', '/creator/deal/' || r.deal_id);
      IF r.brand_user_id IS NOT NULL THEN
        INSERT INTO notifications(user_id, title, body, link) VALUES (r.brand_user_id, 'Content awaiting your approval', r.content_type || ' for ' || r.campaign, '/brand/campaign/' || r.deal_id);
      END IF;
      _brand_email := coalesce(r.brand_email, (SELECT email FROM creator_brand_contacts WHERE brand_id = r.brand_id AND email IS NOT NULL ORDER BY created_at LIMIT 1));
      IF _brand_email IS NOT NULL THEN
        INSERT INTO creator_email_outbox(owner_id, to_email, audience, rule, subject, body, link) VALUES (r.owner_id, _brand_email, 'brand', 'approval',
          'Content awaiting your approval: ' || r.campaign, 'A ' || r.content_type || ' for ' || r.campaign || ' is ready for your review. Please approve or leave comments in your brand portal.', '/brand/campaign/' || r.deal_id);
        _e := _e + 1;
      END IF;
      _n := _n + 1;
    END IF;
    _ok := NULL;
  END LOOP;

  -- 3. Overdue invoices
  UPDATE creator_invoices SET status = 'Overdue', updated_at = now()
    WHERE due_date < current_date AND status IN ('Sent','Viewed','Partially Paid') AND (_uid IS NULL OR owner_id = _uid);
  FOR r IN SELECT i.id, i.owner_id, i.number, i.amount, i.tax_pct, i.paid_amount, i.due_date, d.id AS deal_id, d.campaign, d.brand_email, d.brand_id, d.brand_user_id
    FROM creator_invoices i JOIN creator_deals d ON d.id = i.deal_id
    WHERE i.status = 'Overdue' AND (_uid IS NULL OR i.owner_id = _uid)
  LOOP
    INSERT INTO creator_alert_log(owner_id, rule, ref_id) VALUES (r.owner_id, 'invoice', r.id) ON CONFLICT DO NOTHING RETURNING true INTO _ok;
    IF _ok THEN
      INSERT INTO notifications(user_id, title, body, link) VALUES (r.owner_id, 'Invoice overdue: ' || r.number,
        r.campaign || ' — due ' || r.due_date, '/creator/invoices');
      IF r.brand_user_id IS NOT NULL THEN
        INSERT INTO notifications(user_id, title, body, link) VALUES (r.brand_user_id, 'Invoice overdue: ' || r.number, r.campaign || ' — due ' || r.due_date, '/brand/campaign/' || r.deal_id);
      END IF;
      _brand_email := coalesce(r.brand_email, (SELECT email FROM creator_brand_contacts WHERE brand_id = r.brand_id AND email IS NOT NULL ORDER BY created_at LIMIT 1));
      IF _brand_email IS NOT NULL THEN
        INSERT INTO creator_email_outbox(owner_id, to_email, audience, rule, subject, body, link) VALUES (r.owner_id, _brand_email, 'brand', 'invoice',
          'Payment reminder: invoice ' || r.number, 'Invoice ' || r.number || ' for ' || r.campaign || ' of ₹' || round(r.amount * (1 + r.tax_pct/100) - r.paid_amount) || ' was due on ' || r.due_date || '. Kindly arrange payment.', '/brand/campaign/' || r.deal_id);
        _e := _e + 1;
      END IF;
      _n := _n + 1;
    END IF;
    _ok := NULL;
  END LOOP;

  RETURN jsonb_build_object('alerts', _n, 'emails_queued', _e);
END $$;
REVOKE ALL ON FUNCTION public.run_creator_followups() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_creator_followups() TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('creator-followups-daily', '30 3 * * *', $$SELECT public.run_creator_followups()$$);
