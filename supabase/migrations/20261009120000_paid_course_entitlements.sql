-- Accès aux livrables et au classeur après confirmation du règlement.
-- L'identité est celle de Supabase Auth ; les participants ne peuvent jamais s'accorder eux-mêmes un accès payé.

create or replace function public.is_fiscale_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as participant
    where participant.id = (select auth.uid())
      and lower(participant.email) = 'godwingobex@gmail.com'
      and participant.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_fiscale_admin() from public;
grant execute on function public.is_fiscale_admin() to authenticated;

-- Un statut par personne et par formation ; le statut payé ne peut être écrit que par l'administrateur.
create table if not exists public.participant_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_version text not null,
  status text not null default 'pending',
  payment_method text not null default 'manual_whatsapp',
  payment_reference text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_entitlements_user_id_fkey
    foreign key (user_id) references public.participant_profiles (id) on delete cascade,
  constraint participant_entitlements_user_course_key unique (user_id, course_version),
  constraint participant_entitlements_status_valid check (status in ('pending', 'paid', 'revoked')),
  constraint participant_entitlements_payment_method_valid check (payment_method in ('manual_whatsapp', 'provider')),
  constraint participant_entitlements_paid_confirmation_valid
    check (status <> 'paid' or (paid_at is not null and approved_by is not null))
);

create index if not exists participant_entitlements_course_status_idx
  on public.participant_entitlements (course_version, status);

alter table public.participant_entitlements enable row level security;
revoke all on table public.participant_entitlements from anon;
grant select, insert, update, delete on table public.participant_entitlements to authenticated;

drop policy if exists "Participants can read their own entitlements" on public.participant_entitlements;
create policy "Participants can read their own entitlements"
  on public.participant_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Administrators can read all entitlements" on public.participant_entitlements;
create policy "Administrators can read all entitlements"
  on public.participant_entitlements
  for select
  to authenticated
  using ((select public.is_fiscale_admin()));

drop policy if exists "Participants can request their own entitlements" on public.participant_entitlements;
create policy "Participants can request their own entitlements"
  on public.participant_entitlements
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and payment_method = 'manual_whatsapp'
    and payment_reference is null
    and paid_at is null
    and approved_by is null
  );

drop policy if exists "Administrators can create entitlements" on public.participant_entitlements;
create policy "Administrators can create entitlements"
  on public.participant_entitlements
  for insert
  to authenticated
  with check ((select public.is_fiscale_admin()));

drop policy if exists "Administrators can update entitlements" on public.participant_entitlements;
create policy "Administrators can update entitlements"
  on public.participant_entitlements
  for update
  to authenticated
  using ((select public.is_fiscale_admin()))
  with check ((select public.is_fiscale_admin()));

drop policy if exists "Administrators can delete entitlements" on public.participant_entitlements;
create policy "Administrators can delete entitlements"
  on public.participant_entitlements
  for delete
  to authenticated
  using ((select public.is_fiscale_admin()));

-- L'administrateur peut voir les coordonnées nécessaires à la confirmation manuelle du paiement.
drop policy if exists "Administrators can read participant profiles" on public.participant_profiles;
create policy "Administrators can read participant profiles"
  on public.participant_profiles
  for select
  to authenticated
  using ((select public.is_fiscale_admin()));

create table if not exists public.participant_entitlement_events (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null references public.participant_entitlements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_version text not null,
  previous_status text,
  new_status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  payment_reference text,
  created_at timestamptz not null default now()
);

alter table public.participant_entitlement_events enable row level security;
revoke all on table public.participant_entitlement_events from anon;
grant select on table public.participant_entitlement_events to authenticated;

drop policy if exists "Administrators can read entitlement events" on public.participant_entitlement_events;
create policy "Administrators can read entitlement events"
  on public.participant_entitlement_events
  for select
  to authenticated
  using ((select public.is_fiscale_admin()));

create or replace function public.audit_participant_entitlement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.participant_entitlement_events (
    entitlement_id,
    user_id,
    course_version,
    previous_status,
    new_status,
    actor_id,
    payment_reference
  ) values (
    new.id,
    new.user_id,
    new.course_version,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    (select auth.uid()),
    new.payment_reference
  );
  return new;
end;
$$;

revoke all on function public.audit_participant_entitlement_change() from public;
drop trigger if exists participant_entitlement_audit on public.participant_entitlements;
create trigger participant_entitlement_audit
  after insert or update on public.participant_entitlements
  for each row execute function public.audit_participant_entitlement_change();

drop trigger if exists participant_entitlements_updated_at on public.participant_entitlements;
create trigger participant_entitlements_updated_at
  before update on public.participant_entitlements
  for each row execute function public.set_participant_updated_at();
