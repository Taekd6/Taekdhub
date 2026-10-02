-- ══════════════════════════════════════════════════════════════════
-- ANNALES — les exercices corrigés par Claude, lisibles par leur élève
-- ══════════════════════════════════════════════════════════════════
--
-- `exercise_logs` est remplie par le connecteur MCP
-- (app/api/mcp/[key]/route.ts) avec la clé SECRÈTE, qui contourne la RLS.
-- La table avait bien la RLS active, mais AUCUNE politique : pour le
-- navigateur (clé publique + session de l'élève), Postgres ne renvoyait
-- donc rien — RLS sans politique = tout refuser.
--
-- On ne peut pas écrire « tout utilisateur connecté lit la table » : le
-- premier inscrit venu lirait les annales de tout le monde. Il faut savoir
-- À QUI appartient chaque ligne : d'où `user_id`, exactement comme
-- `user_collections` (0006).
--
-- L'ÉCRITURE reste réservée au connecteur (clé secrète) : le navigateur ne
-- peut que LIRE et SUPPRIMER ses propres lignes (une saisie erronée).

alter table public.exercise_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Lignes déjà présentes : elles appartiennent au seul compte du projet, s'il
-- n'y en a qu'un. Avec plusieurs comptes, on ne devine pas : elles restent
-- sans propriétaire (invisibles), à rattacher à la main.
update public.exercise_logs
set user_id = (select id from auth.users limit 1)
where user_id is null
  and (select count(*) from auth.users) = 1;

create index if not exists exercise_logs_user_created_idx
  on public.exercise_logs (user_id, created_at desc);

alter table public.exercise_logs enable row level security;

drop policy if exists "exercise_logs: lecture par le propriétaire" on public.exercise_logs;
drop policy if exists "exercise_logs: suppression par le propriétaire" on public.exercise_logs;

create policy "exercise_logs: lecture par le propriétaire"
  on public.exercise_logs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "exercise_logs: suppression par le propriétaire"
  on public.exercise_logs for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.exercise_logs from anon;
revoke insert, update on public.exercise_logs from authenticated;
grant select, delete on public.exercise_logs to authenticated;
