-- Comptes Google des participants et progression synchronisée.
-- À exécuter dans le SQL Editor Supabase ou avec `supabase db push`.

create table if not exists public.participant_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.participant_profiles enable row level security;
revoke all on table public.participant_profiles from anon;
grant select on table public.participant_profiles to authenticated;

drop policy if exists "Participants can read their own profile" on public.participant_profiles;
create policy "Participants can read their own profile"
  on public.participant_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_participant_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.participant_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_participant_profile() from public;
insert into public.participant_profiles (id, email, full_name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_participant_profile();

create table if not exists public.participant_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_version text not null,
  completed smallint[] not null default '{}'::smallint[],
  current_sequence smallint not null default 1,
  scroll_y integer not null default 0,
  quiz_answers jsonb not null default '{}'::jsonb,
  last_saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_progress_current_sequence_valid check (current_sequence >= 1),
  constraint participant_progress_scroll_nonnegative check (scroll_y >= 0),
  constraint participant_progress_answers_object check (jsonb_typeof(quiz_answers) = 'object'),
  constraint participant_progress_pkey primary key (user_id, course_version)
);

-- Une ligne de progression indépendante par participant et par formation.
-- Cette conversion préserve aussi les lignes d’une ancienne version à clé user_id seule.
alter table public.participant_progress drop constraint if exists participant_progress_pkey;
alter table public.participant_progress add constraint participant_progress_pkey primary key (user_id, course_version);
-- Ne pas imposer la taille actuelle du parcours à toutes les formations du catalogue.
alter table public.participant_progress drop constraint if exists participant_progress_current_sequence_valid;
alter table public.participant_progress add constraint participant_progress_current_sequence_valid check (current_sequence >= 1);
alter table public.participant_progress drop constraint if exists participant_progress_completed_valid;

alter table public.participant_progress enable row level security;
revoke all on table public.participant_progress from anon;
grant select, insert, update, delete on table public.participant_progress to authenticated;

drop policy if exists "Participants can read their own progress" on public.participant_progress;
create policy "Participants can read their own progress"
  on public.participant_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Participants can create their own progress" on public.participant_progress;
create policy "Participants can create their own progress"
  on public.participant_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can update their own progress" on public.participant_progress;
create policy "Participants can update their own progress"
  on public.participant_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can delete their own progress" on public.participant_progress;
create policy "Participants can delete their own progress"
  on public.participant_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_participant_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_participant_updated_at() from public;
drop trigger if exists participant_profiles_updated_at on public.participant_profiles;
create trigger participant_profiles_updated_at
  before update on public.participant_profiles
  for each row execute function public.set_participant_updated_at();
drop trigger if exists participant_progress_updated_at on public.participant_progress;
create trigger participant_progress_updated_at
  before update on public.participant_progress
  for each row execute function public.set_participant_updated_at();
