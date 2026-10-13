-- Textes juridiques publiés sur le site et modifiables depuis l'espace administrateur.
-- Le contenu est du texte brut (jamais du HTML) et seules les deux références prévues sont admises.

create table if not exists public.legal_documents (
  slug text primary key,
  title text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  constraint legal_documents_slug_valid check (slug in ('confidentialite', 'conditions-utilisation')),
  constraint legal_documents_title_length check (char_length(title) between 1 and 180),
  constraint legal_documents_content_length check (char_length(content) between 1 and 20000),
  constraint legal_documents_content_not_blank check (length(btrim(content)) > 0)
);

alter table public.legal_documents enable row level security;
revoke all on table public.legal_documents from public, anon, authenticated;
grant select on table public.legal_documents to anon, authenticated;
grant insert, update on table public.legal_documents to authenticated;

drop policy if exists "Legal documents are publicly readable" on public.legal_documents;
create policy "Legal documents are publicly readable"
  on public.legal_documents
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Administrators can create legal documents" on public.legal_documents;
create policy "Administrators can create legal documents"
  on public.legal_documents
  for insert
  to authenticated
  with check ((select public.is_fiscale_admin()));

drop policy if exists "Administrators can update legal documents" on public.legal_documents;
create policy "Administrators can update legal documents"
  on public.legal_documents
  for update
  to authenticated
  using ((select public.is_fiscale_admin()))
  with check ((select public.is_fiscale_admin()));

create or replace function public.set_legal_document_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_legal_document_updated_at() from public;

drop trigger if exists legal_documents_updated_at on public.legal_documents;
create trigger legal_documents_updated_at
  before update on public.legal_documents
  for each row execute function public.set_legal_document_updated_at();
