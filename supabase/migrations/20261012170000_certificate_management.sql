-- Certificats : les donnees personnelles ne sont visibles que par l'administrateur.
-- La verification publique passe par une fonction qui ne publie que les champs d'un certificat valide.

create table if not exists public.certificates (
  reference text primary key,
  participant_name text not null,
  profile text not null default '',
  birth_date text not null default '',
  birth_place text not null default '',
  nationality text not null default '',
  payment_reference text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint certificates_reference_valid check (reference ~ '^[A-Za-z0-9-]{1,100}$'),
  constraint certificates_participant_name_length check (char_length(participant_name) between 1 and 180),
  constraint certificates_profile_length check (char_length(profile) <= 80),
  constraint certificates_birth_date_length check (char_length(birth_date) <= 30),
  constraint certificates_birth_place_length check (char_length(birth_place) <= 120),
  constraint certificates_nationality_length check (char_length(nationality) <= 80),
  constraint certificates_payment_reference_length check (payment_reference is null or char_length(payment_reference) <= 180),
  constraint certificates_status_valid check (status in ('pending', 'validated', 'revoked')),
  constraint certificates_validation_timestamp_valid check (status <> 'validated' or validated_at is not null)
);

create index if not exists certificates_status_updated_idx
  on public.certificates (status, updated_at desc);

alter table public.certificates enable row level security;
revoke all on table public.certificates from public, anon, authenticated;
grant select, insert, update on table public.certificates to authenticated;

drop policy if exists "Administrators can read certificates" on public.certificates;
create policy "Administrators can read certificates"
  on public.certificates
  for select
  to authenticated
  using ((select public.is_fiscale_admin()));

drop policy if exists "Administrators can create certificates" on public.certificates;
create policy "Administrators can create certificates"
  on public.certificates
  for insert
  to authenticated
  with check ((select public.is_fiscale_admin()));

drop policy if exists "Administrators can update certificates" on public.certificates;
create policy "Administrators can update certificates"
  on public.certificates
  for update
  to authenticated
  using ((select public.is_fiscale_admin()))
  with check ((select public.is_fiscale_admin()));

create or replace function public.set_certificate_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by = (select auth.uid());
  end if;
  if new.updated_by is null then
    new.updated_by = (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.set_certificate_updated_at() from public;

drop trigger if exists certificates_updated_at on public.certificates;
create trigger certificates_updated_at
  before insert or update on public.certificates
  for each row execute function public.set_certificate_updated_at();

create table if not exists public.certificate_events (
  id bigint generated always as identity primary key,
  certificate_reference text not null,
  previous_status text,
  new_status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  payment_reference text,
  created_at timestamptz not null default now()
);

create index if not exists certificate_events_reference_created_idx
  on public.certificate_events (certificate_reference, created_at desc);

alter table public.certificate_events enable row level security;
revoke all on table public.certificate_events from public, anon, authenticated;
grant select on table public.certificate_events to authenticated;

drop policy if exists "Administrators can read certificate events" on public.certificate_events;
create policy "Administrators can read certificate events"
  on public.certificate_events
  for select
  to authenticated
  using ((select public.is_fiscale_admin()));

create or replace function public.audit_certificate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.certificate_events (
    certificate_reference,
    previous_status,
    new_status,
    actor_id,
    payment_reference
  ) values (
    new.reference,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    coalesce((select auth.uid()), new.updated_by),
    new.payment_reference
  );
  return new;
end;
$$;

revoke all on function public.audit_certificate_change() from public;
drop trigger if exists certificates_audit on public.certificates;
create trigger certificates_audit
  after insert or update on public.certificates
  for each row execute function public.audit_certificate_change();

-- Aucune lecture directe des certificats par anon : cette fonction renvoie uniquement le minimum public.
create or replace function public.verify_certificate(p_reference text)
returns table (
  reference text,
  status text,
  participant_name text,
  profile text,
  validated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    certificate.reference,
    certificate.status,
    case when certificate.status = 'validated' then certificate.participant_name else null end,
    case when certificate.status = 'validated' then certificate.profile else null end,
    case when certificate.status = 'validated' then certificate.validated_at else null end
  from public.certificates as certificate
  where certificate.reference = pg_catalog.regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9-]', '', 'g')
  limit 1;
$$;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;
