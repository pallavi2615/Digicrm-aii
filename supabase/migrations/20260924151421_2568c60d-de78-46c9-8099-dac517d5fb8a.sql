
CREATE OR REPLACE FUNCTION public.re_docs_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v int; f int;
BEGIN
  NEW.updated_at := now();
  SELECT count(*) FILTER (WHERE lower(status)='verified'), count(*) FILTER (WHERE lower(status)='failed') INTO v, f
    FROM (SELECT status FROM public.re_booking_docs WHERE deal_id=NEW.deal_id AND id<>NEW.id UNION ALL SELECT NEW.status) s;
  UPDATE public.re_deals SET
    doc_status = CASE WHEN v>=3 THEN 'Verified' WHEN f>0 THEN 'Failed' ELSE 'In review' END,
    stage = CASE WHEN v>=3 AND lower(stage) IN ('booking','token_paid','agreement') THEN 'registration' ELSE stage END,
    updated_at = now()
  WHERE id=NEW.deal_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.edu_doc_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v int; f int; s public.edu_students;
BEGIN
  SELECT count(*) FILTER (WHERE lower(status)='verified'), count(*) FILTER (WHERE lower(status)='failed') INTO v, f FROM public.edu_documents WHERE student_id=NEW.student_id;
  SELECT * INTO s FROM public.edu_students WHERE id=NEW.student_id;
  IF v>=3 THEN
    UPDATE public.edu_students SET doc_status='Verified',
      stage = CASE WHEN lower(coalesce(stage,'')) IN ('admission','batch allocation','active student','class allotted','enrolled','onboarded','active learner','renewal','visa','visa filed','visa approved','departed','lost','alumni') THEN stage ELSE 'Admission' END
      WHERE id=NEW.student_id;
    IF lower(coalesce(s.doc_status,'')) <> 'verified' THEN
      INSERT INTO public.edu_actions (tenant_id, student_id, kind, audience, reason, agent, priority)
        VALUES (s.tenant_id, s.id, 'Admission confirmed', 'Parent', 'All documents verified — send welcome and batch details', 'Admission Agent', 1);
    END IF;
  ELSE
    UPDATE public.edu_students SET doc_status = CASE WHEN f>0 THEN 'Action needed' ELSE 'In review' END WHERE id=NEW.student_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.edu_fee_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.paid_amount >= NEW.amount THEN NEW.status := 'Paid'; NEW.paid_at := coalesce(NEW.paid_at, now());
  ELSIF NEW.paid_amount > 0 THEN NEW.status := 'Partial';
  ELSIF lower(coalesce(NEW.status,'')) <> 'waived' THEN NEW.status := 'Due'; END IF;
  RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.affiliate_payout_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.status := lower(NEW.status);
  IF NEW.status IS DISTINCT FROM lower(OLD.status) THEN
    IF NEW.status='approved' THEN NEW.approved_at := COALESCE(NEW.approved_at, now());
    ELSIF NEW.status='paid' THEN NEW.approved_at := COALESCE(NEW.approved_at, now()); NEW.paid_at := COALESCE(NEW.paid_at, now());
    END IF;
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  holder_name text NOT NULL,
  bank_name text, account_number text, ifsc text, upi_id text,
  balance numeric NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read" ON public.payout_accounts FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "own insert" ON public.payout_accounts FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND balance=0);
CREATE POLICY "own delete" ON public.payout_accounts FOR DELETE TO authenticated USING (user_id=auth.uid());
CREATE TRIGGER payout_accounts_updated BEFORE UPDATE ON public.payout_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payout_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.payout_accounts(id) ON DELETE CASCADE,
  payout_request_id uuid REFERENCES public.affiliate_payout_requests(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  utr text,
  note text,
  sent_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payout_transfers TO authenticated;
GRANT ALL ON public.payout_transfers TO service_role;
ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account owner or admin read" ON public.payout_transfers FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.payout_accounts a WHERE a.id=account_id AND a.user_id=auth.uid()));
CREATE POLICY "admin send" ON public.payout_transfers FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.payout_transfer_credit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.payout_accounts SET balance = balance + NEW.amount WHERE id=NEW.account_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.payout_transfer_credit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payout_transfers_credit AFTER INSERT ON public.payout_transfers FOR EACH ROW EXECUTE FUNCTION public.payout_transfer_credit();

CREATE OR REPLACE FUNCTION public.payout_request_to_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acc uuid;
BEGIN
  IF lower(NEW.status)='paid' AND lower(coalesce(OLD.status,''))<>'paid' THEN
    SELECT pa.id INTO acc FROM public.payout_accounts pa JOIN public.affiliates af ON af.user_id=pa.user_id
      WHERE af.id=NEW.affiliate_id ORDER BY pa.is_default DESC, pa.created_at LIMIT 1;
    IF acc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.payout_transfers WHERE payout_request_id=NEW.id) THEN
      INSERT INTO public.payout_transfers(account_id, payout_request_id, amount, utr, note, sent_by)
        VALUES (acc, NEW.id, NEW.amount, NEW.reference, 'Partner payout', auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.payout_request_to_account() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER affiliate_payout_to_account AFTER UPDATE ON public.affiliate_payout_requests FOR EACH ROW EXECUTE FUNCTION public.payout_request_to_account();

ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_accounts, public.payout_transfers;
