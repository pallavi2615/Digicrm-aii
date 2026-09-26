
create table public.fin_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  owner_id uuid default auth.uid(),
  name text not null, bank_name text, account_number text, ifsc text, upi_id text,
  opening_balance numeric not null default 0, is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.fin_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  owner_id uuid default auth.uid(),
  number text not null, party_name text not null, party_email text,
  kind text not null default 'receivable' check (kind in ('receivable','payable')),
  category text not null default 'other',
  amount numeric not null check (amount >= 0), gst_pct numeric not null default 0,
  due_date date, status text not null default 'open' check (status in ('draft','open','paid','cancelled')),
  paid_at timestamptz, utr text, bank_account_id uuid references public.fin_bank_accounts(id) on delete set null,
  notes text, created_at timestamptz not null default now()
);
create table public.fin_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  owner_id uuid,
  entry_date timestamptz not null default now(),
  direction text not null check (direction in ('in','out')),
  category text not null,
  amount numeric not null check (amount >= 0),
  party text, utr text, method text,
  bank_account_id uuid references public.fin_bank_accounts(id) on delete set null,
  source_table text not null default 'manual', source_id uuid default gen_random_uuid(), memo text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (source_table, source_id)
);
grant select, insert, update, delete on public.fin_bank_accounts, public.fin_invoices, public.fin_ledger to authenticated;
grant all on public.fin_bank_accounts, public.fin_invoices, public.fin_ledger to service_role;
alter table public.fin_bank_accounts enable row level security;
alter table public.fin_invoices enable row level security;
alter table public.fin_ledger enable row level security;

create or replace function public.fin_can_access(_tenant uuid, _owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.has_role(auth.uid(),'super_admin'::public.app_role)
    or (_tenant is not null and public.is_tenant_member(_tenant, auth.uid()))
    or (_tenant is null and _owner = auth.uid())
$$;
grant execute on function public.fin_can_access(uuid,uuid) to authenticated;

create policy "fin bank access" on public.fin_bank_accounts for all to authenticated
  using (public.fin_can_access(tenant_id, owner_id)) with check (public.fin_can_access(tenant_id, owner_id));
create policy "fin invoice access" on public.fin_invoices for all to authenticated
  using (public.fin_can_access(tenant_id, owner_id)) with check (public.fin_can_access(tenant_id, owner_id));
create policy "fin ledger read" on public.fin_ledger for select to authenticated using (public.fin_can_access(tenant_id, owner_id));
create policy "fin ledger manual insert" on public.fin_ledger for insert to authenticated
  with check (source_table = 'manual' and public.fin_can_access(tenant_id, owner_id));
create policy "fin ledger manual delete" on public.fin_ledger for delete to authenticated
  using (source_table = 'manual' and public.fin_can_access(tenant_id, owner_id));

create or replace function public.fin_post(_tenant uuid, _owner uuid, _dir text, _cat text, _amt numeric, _party text, _utr text, _method text, _src text, _sid uuid, _memo text, _paid boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _paid and coalesce(_amt,0) > 0 then
    insert into public.fin_ledger(tenant_id, owner_id, direction, category, amount, party, utr, method, source_table, source_id, memo, bank_account_id, created_by)
    values (_tenant, _owner, _dir, _cat, _amt, _party, _utr, _method, _src, _sid, _memo,
      (select id from public.fin_bank_accounts b where (b.tenant_id = _tenant or (_tenant is null and b.owner_id = _owner)) order by is_default desc, created_at limit 1), auth.uid())
    on conflict (source_table, source_id) do update set amount = excluded.amount, utr = excluded.utr, direction = excluded.direction, party = excluded.party;
  else
    delete from public.fin_ledger where source_table = _src and source_id = _sid;
  end if;
end $$;
revoke execute on function public.fin_post(uuid,uuid,text,text,numeric,text,text,text,text,uuid,text,boolean) from public, anon, authenticated;

create or replace function public.fin_trg_edu_fees() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, null, 'in', 'student_fee', coalesce(new.paid_amount,0),
    (select coalesce(to_jsonb(s)->>'full_name', to_jsonb(s)->>'name') from public.edu_students s where s.id = new.student_id), null, new.method,
    'edu_fees', new.id, new.label, coalesce(new.paid_amount,0) > 0);
  return new;
end $$;
create trigger fin_edu_fees after insert or update on public.edu_fees for each row execute function public.fin_trg_edu_fees();

create or replace function public.fin_trg_edu_royalties() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, null, 'in', 'franchise_royalty', coalesce(new.royalty,0)+coalesce(new.marketing_fee,0),
    (select to_jsonb(b)->>'name' from public.edu_branches b where b.id = new.branch_id), new.reference, 'bank_transfer',
    'edu_royalties', new.id, 'Royalty ' || coalesce(new.period,''), new.status = 'paid');
  return new;
end $$;
create trigger fin_edu_royalties after insert or update on public.edu_royalties for each row execute function public.fin_trg_edu_royalties();

create or replace function public.fin_trg_re_schedule() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(null, new.owner_id, 'in', 'property_payment', coalesce(new.paid_amount,0), null, new.reference, 'bank_transfer',
    're_payment_schedule', new.id, new.milestone, coalesce(new.paid_amount,0) > 0);
  return new;
end $$;
create trigger fin_re_schedule after insert or update on public.re_payment_schedule for each row execute function public.fin_trg_re_schedule();

create or replace function public.fin_trg_re_comm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(null, new.owner_id, 'out', 'partner_commission', coalesce(new.amount,0) * (1 - coalesce(new.tds_pct,0)/100),
    (select to_jsonb(p)->>'name' from public.re_channel_partners p where p.id = new.partner_id), new.reference, 'bank_transfer',
    're_commissions', new.id, 'Channel partner payout', new.status = 'paid');
  return new;
end $$;
create trigger fin_re_comm after insert or update on public.re_commissions for each row execute function public.fin_trg_re_comm();

create or replace function public.fin_trg_aff() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, null, 'out', 'affiliate_payout', new.amount, null, new.reference, new.method,
    'affiliate_payout_requests', new.id, 'Affiliate payout', new.status = 'paid');
  return new;
end $$;
create trigger fin_aff after insert or update on public.affiliate_payout_requests for each row execute function public.fin_trg_aff();

create or replace function public.fin_trg_pack() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select tenant_id, owner_id, contact_name into r from public.pack_records where id = new.record_id;
  perform public.fin_post(r.tenant_id, r.owner_id, 'in', 'client_fee', new.amount, r.contact_name, new.reference, new.method,
    'pack_payments', new.id, new.label, new.status in ('paid','confirmed'));
  return new;
end $$;
create trigger fin_pack after insert or update on public.pack_payments for each row execute function public.fin_trg_pack();

create or replace function public.fin_trg_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_post(new.tenant_id, new.owner_id, case when new.kind='payable' then 'out' else 'in' end, new.category,
    new.amount * (1 + new.gst_pct/100), new.party_name, new.utr, 'bank_transfer', 'fin_invoices', new.id, 'Invoice ' || new.number, new.status = 'paid');
  return new;
end $$;
create trigger fin_invoice after insert or update on public.fin_invoices for each row execute function public.fin_trg_invoice();

-- backfill existing paid items
update public.edu_fees set paid_amount = paid_amount where coalesce(paid_amount,0) > 0;
update public.edu_royalties set status = status where status = 'paid';
update public.re_payment_schedule set paid_amount = paid_amount where coalesce(paid_amount,0) > 0;
update public.re_commissions set status = status where status = 'paid';
update public.affiliate_payout_requests set status = status where status = 'paid';
update public.pack_payments set status = status where status in ('paid','confirmed');
