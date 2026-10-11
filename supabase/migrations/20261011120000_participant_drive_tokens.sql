-- Jeton Google du participant : il permet au serveur de redemander, à la demande,
-- un accès limité aux fichiers que l'application a créés dans le Google Drive du
-- participant (portée drive.file). Aucun fichier n'est copié chez nous.
-- Le jeton reste dans une ligne protégée par RLS : chaque participant n'accède qu'à la sienne.

create table if not exists public.participant_drive_tokens (
  user_id uuid primary key,
  refresh_token text not null,
  google_email text,
  granted_scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_drive_tokens_user_id_fkey
    foreign key (user_id) references public.participant_profiles (id) on delete cascade
);

alter table public.participant_drive_tokens enable row level security;
revoke all on table public.participant_drive_tokens from anon;
grant select, insert, update, delete on table public.participant_drive_tokens to authenticated;

drop policy if exists "Participants can read their own drive token" on public.participant_drive_tokens;
create policy "Participants can read their own drive token"
  on public.participant_drive_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Participants can record their own drive token" on public.participant_drive_tokens;
create policy "Participants can record their own drive token"
  on public.participant_drive_tokens
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can refresh their own drive token" on public.participant_drive_tokens;
create policy "Participants can refresh their own drive token"
  on public.participant_drive_tokens
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can remove their own drive token" on public.participant_drive_tokens;
create policy "Participants can remove their own drive token"
  on public.participant_drive_tokens
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.participant_drive_tokens is
  'Jeton Google hors ligne du participant, utilisé par la fonction api/drive-token pour ouvrir un accès temporaire à son Google Drive (dossier « Fiscale — Dossier »).';
comment on column public.participant_drive_tokens.refresh_token is
  'Jeton de rafraîchissement Google (portée https://www.googleapis.com/auth/drive.file), échangeable seulement avec le secret client conservé côté serveur.';
