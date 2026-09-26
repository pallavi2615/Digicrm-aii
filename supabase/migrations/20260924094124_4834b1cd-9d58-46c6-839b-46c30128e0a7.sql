ALTER TABLE public.re_deals ADD COLUMN IF NOT EXISTS buyer_email text, ADD COLUMN IF NOT EXISTS buyer_user_id uuid, ADD COLUMN IF NOT EXISTS doc_status text NOT NULL DEFAULT 'Pending';
ALTER TABLE public.re_payment_schedule ADD COLUMN IF NOT EXISTS reported_amount numeric, ADD COLUMN IF NOT EXISTS reported_reference text, ADD COLUMN IF NOT EXISTS reported_at timestamptz;

CREATE TABLE public.re_booking_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.re_deals(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  identifier_masked text,
  status text NOT NULL DEFAULT 'Pending',
  provider text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  verification_id uuid,
  submitted_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, doc_type)
);
GRANT SELECT ON public.re_booking_docs TO authenticated;
GRANT ALL ON public.re_booking_docs TO service_role;
ALTER TABLE public.re_booking_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY re_booking_docs_read ON public.re_booking_docs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.re_deals d WHERE d.id = deal_id AND (d.owner_id = auth.uid() OR d.agent_id = auth.uid() OR d.buyer_user_id = auth.uid() OR private.is_manager_or_above(auth.uid())))
);

CREATE POLICY re_deal_buyer_read ON public.re_deals FOR SELECT TO authenticated USING (buyer_user_id = auth.uid());
CREATE POLICY re_pay_buyer_read ON public.re_payment_schedule FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.re_deals d WHERE d.id = deal_id AND d.buyer_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.re_buyer_claim() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text := lower(coalesce(auth.jwt() ->> 'email', '')); n int;
BEGIN
  IF auth.uid() IS NULL OR em = '' THEN RETURN 0; END IF;
  UPDATE public.re_deals SET buyer_user_id = auth.uid() WHERE lower(buyer_email) = em AND buyer_user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.re_buyer_claim() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.re_buyer_claim() TO authenticated;

CREATE OR REPLACE FUNCTION public.re_buyer_report_payment(_id uuid, _amount numeric, _ref text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter the amount paid'; END IF;
  UPDATE public.re_payment_schedule p SET reported_amount = _amount, reported_reference = left(_ref, 120), reported_at = now()
   WHERE p.id = _id AND EXISTS (SELECT 1 FROM public.re_deals d WHERE d.id = p.deal_id AND d.buyer_user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.re_buyer_report_payment(uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.re_buyer_report_payment(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.re_docs_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int; f int; tot int;
BEGIN
  NEW.updated_at := now();
  SELECT count(*) FILTER (WHERE status = 'Verified'), count(*) FILTER (WHERE status = 'Failed'), count(*) INTO v, f, tot
    FROM (SELECT doc_type, status FROM public.re_booking_docs WHERE deal_id = NEW.deal_id AND id <> NEW.id UNION ALL SELECT NEW.doc_type, NEW.status) s;
  UPDATE public.re_deals SET
    doc_status = CASE WHEN v >= 3 THEN 'Verified' WHEN f > 0 THEN 'Failed' ELSE 'In review' END,
    stage = CASE WHEN v >= 3 AND stage IN ('booking','Booking') THEN CASE WHEN stage = 'booking' THEN 'documentation' ELSE 'Documentation' END ELSE stage END,
    updated_at = now()
  WHERE id = NEW.deal_id;
  RETURN NEW;
END $$;
CREATE TRIGGER re_booking_docs_sync BEFORE INSERT OR UPDATE ON public.re_booking_docs FOR EACH ROW EXECUTE FUNCTION public.re_docs_sync();