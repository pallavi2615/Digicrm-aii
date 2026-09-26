ALTER TABLE public.payout_accounts ADD COLUMN IF NOT EXISTS channel_partner_id uuid REFERENCES public.re_channel_partners(id) ON DELETE SET NULL;
ALTER TABLE public.payout_transfers ADD COLUMN IF NOT EXISTS re_commission_id uuid UNIQUE REFERENCES public.re_commissions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.re_commission_to_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc uuid;
BEGIN
  IF lower(coalesce(NEW.status,'')) = 'paid' AND lower(coalesce(OLD.status,'')) <> 'paid' THEN
    SELECT id INTO acc FROM payout_accounts WHERE channel_partner_id = NEW.partner_id
      ORDER BY is_default DESC, created_at LIMIT 1;
    IF acc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payout_transfers WHERE re_commission_id = NEW.id) THEN
      INSERT INTO payout_transfers(account_id, amount, utr, note, sent_by, re_commission_id)
      VALUES (acc, round(NEW.amount * (1 - coalesce(NEW.tds_pct,0)/100), 2), NEW.reference,
              'Real estate commission (net of TDS)', auth.uid(), NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.re_commission_to_account() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_re_commission_to_account ON public.re_commissions;
CREATE TRIGGER trg_re_commission_to_account AFTER UPDATE ON public.re_commissions
FOR EACH ROW EXECUTE FUNCTION public.re_commission_to_account();