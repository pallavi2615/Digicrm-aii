ALTER TABLE public.edu_fees ADD COLUMN IF NOT EXISTS reported_amount numeric, ADD COLUMN IF NOT EXISTS reported_reference text, ADD COLUMN IF NOT EXISTS reported_at timestamptz;

CREATE OR REPLACE FUNCTION public.edu_report_fee_payment(_fee uuid, _amount numeric, _ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 OR coalesce(trim(_ref),'') = '' THEN RAISE EXCEPTION 'Amount and UTR are required'; END IF;
  UPDATE public.edu_fees f SET reported_amount = _amount, reported_reference = trim(_ref), reported_at = now()
  WHERE f.id = _fee AND EXISTS (SELECT 1 FROM public.edu_students s WHERE s.id = f.student_id AND s.applicant_user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Fee not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.edu_report_fee_payment(uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edu_report_fee_payment(uuid,numeric,text) TO authenticated;

-- Approving a reported payment: staff set approve flag by moving reported into paid
CREATE OR REPLACE FUNCTION public.edu_approve_fee_payment(_fee uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.edu_fees SET paid_amount = coalesce(paid_amount,0) + coalesce(reported_amount,0),
    method = 'UTR ' || coalesce(reported_reference,''), paid_at = now(),
    reported_amount = NULL, reported_reference = NULL, reported_at = NULL
  WHERE id = _fee AND reported_amount IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'No reported payment to approve'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.edu_approve_fee_payment(uuid) TO authenticated;