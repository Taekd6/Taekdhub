-- ══════════════════════════════════════════════════════════════════
-- COMPTE ET SYNCHRONISATION — une ligne par collection et par élève
-- ══════════════════════════════════════════════════════════════════
--
-- Les données de l'élève (séances, échéances, notes, carnets, mémoire des
-- chapitres, check-ins, préférences, historique Next Move…) vivent dans le
-- localStorage du navigateur, déjà normalisées par lib/storage.ts. Pour les
-- retrouver sur un autre appareil, chaque COLLECTION est synchronisée en bloc
-- dans UNE ligne : `items` porte exactement le JSON local.
--
-- Pourquoi pas une table par objet : voir lib/sync/collections.ts. En bref,
-- l'application lit et écrit ces collections en bloc, les normalise à la
-- lecture, et ne requête jamais un objet seul côté serveur.
--
-- CONCURRENCE : `revision` augmente de 1 à chaque écriture. Le client
-- n'écrit que « si la révision est encore N » (UPDATE … WHERE revision = N,
-- ou INSERT quand la ligne n'existe pas) : deux appareils ne s'écrasent
-- jamais, le second est refusé et fusionne (lib/sync/engine.ts).
--
-- ISOLATION : RLS. Un élève ne voit, ne crée, ne modifie et ne supprime QUE
-- ses propres lignes. `user_id` vaut `auth.uid()` par défaut et la politique
-- WITH CHECK interdit d'écrire pour quelqu'un d'autre.
--
-- Les tables des migrations 0001 à 0005 (ancien modèle « banque
-- d'exercices ») ne sont ni lues ni écrites par l'application : cette
-- migration n'y touche pas.

create table if not exists public.user_collections (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  collection text        not null,
  items      jsonb       not null,
  revision   integer     not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection),
  -- Seules les collections connues de l'application : rien d'autre ne peut être stocké.
  constraint user_collections_known check (collection in (
    'sessions', 'preferences', 'weekSnapshots', 'workItems', 'grades', 'dayPlans',
    'reviewItems', 'errors', 'checkins', 'chapterMemory', 'nextMoves'
  )),
  -- Garde-fou de taille (≈ 10 ans de séances) : une erreur client ne remplit pas la base.
  constraint user_collections_size check (pg_column_size(items) < 20 * 1024 * 1024)
);

alter table public.user_collections enable row level security;

drop policy if exists "user_collections: lecture par le propriétaire" on public.user_collections;
drop policy if exists "user_collections: création par le propriétaire" on public.user_collections;
drop policy if exists "user_collections: modification par le propriétaire" on public.user_collections;
drop policy if exists "user_collections: suppression par le propriétaire" on public.user_collections;

create policy "user_collections: lecture par le propriétaire"
  on public.user_collections for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_collections: création par le propriétaire"
  on public.user_collections for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_collections: modification par le propriétaire"
  on public.user_collections for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_collections: suppression par le propriétaire"
  on public.user_collections for delete
  to authenticated
  using (user_id = auth.uid());

-- `updated_at` est posé par le SERVEUR, jamais par l'horloge du client.
create or replace function public.user_collections_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_collections_touch on public.user_collections;
create trigger user_collections_touch
  before insert or update on public.user_collections
  for each row execute function public.user_collections_touch();

-- Les rôles anonymes n'ont rien à faire ici (RLS le refuse déjà ; on ferme aussi les droits).
revoke all on public.user_collections from anon;
grant select, insert, update, delete on public.user_collections to authenticated;
