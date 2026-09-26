
create or replace function public.fin_trg_edu_royalties() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, null, 'in', 'franchise_royalty', coalesce(new.royalty,0)+coalesce(new.marketing_fee,0),
    (select to_jsonb(b)->>'name' from public.edu_branches b where b.id = new.branch_id), new.reference, 'bank_transfer',
    'edu_royalties', new.id, 'Royalty ' || coalesce(new.period,''), lower(new.status) = 'paid');
  return new;
end $$;
create or replace function public.fin_trg_re_comm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(null, new.owner_id, 'out', 'partner_commission', coalesce(new.amount,0) * (1 - coalesce(new.tds_pct,0)/100),
    (select to_jsonb(p)->>'name' from public.re_channel_partners p where p.id = new.partner_id), new.reference, 'bank_transfer',
    're_commissions', new.id, 'Channel partner payout', lower(new.status) = 'paid');
  return new;
end $$;
create or replace function public.fin_trg_aff() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, null, 'out', 'affiliate_payout', new.amount, null, new.reference, new.method,
    'affiliate_payout_requests', new.id, 'Affiliate payout', lower(new.status) = 'paid');
  return new;
end $$;
create or replace function public.fin_trg_pack() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select tenant_id, owner_id, contact_name into r from public.pack_records where id = new.record_id;
  perform public.fin_post(r.tenant_id, r.owner_id, 'in', 'client_fee', new.amount, r.contact_name, new.reference, new.method,
    'pack_payments', new.id, new.label, lower(new.status) in ('paid','confirmed'));
  return new;
end $$;
revoke execute on function public.fin_trg_edu_royalties(), public.fin_trg_re_comm(), public.fin_trg_aff(), public.fin_trg_pack() from public, anon, authenticated;
update public.edu_royalties set status = status;
update public.re_commissions set status = status;
