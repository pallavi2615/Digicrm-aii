CREATE OR REPLACE FUNCTION public.re_docs_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v int; f int;
BEGIN
  NEW.updated_at := now();
  SELECT count(*) FILTER (WHERE status = 'Verified'), count(*) FILTER (WHERE status = 'Failed') INTO v, f
    FROM (SELECT status FROM public.re_booking_docs WHERE deal_id = NEW.deal_id AND id <> NEW.id UNION ALL SELECT NEW.status) s;
  UPDATE public.re_deals SET
    doc_status = CASE WHEN v >= 3 THEN 'Verified' WHEN f > 0 THEN 'Failed' ELSE 'In review' END,
    stage = CASE WHEN v >= 3 AND stage = 'booking' THEN 'registration' ELSE stage END,
    updated_at = now()
  WHERE id = NEW.deal_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.re_docs_sync() FROM public, anon, authenticated;