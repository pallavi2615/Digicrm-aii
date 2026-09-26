
revoke execute on function public.fin_trg_edu_fees(), public.fin_trg_edu_royalties(), public.fin_trg_re_schedule(), public.fin_trg_re_comm(), public.fin_trg_aff(), public.fin_trg_pack(), public.fin_trg_invoice() from public, anon, authenticated;
revoke execute on function public.fin_can_access(uuid,uuid) from public, anon;
