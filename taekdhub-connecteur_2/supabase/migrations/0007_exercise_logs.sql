-- Journal des exercices d'annales corrigés par Claude (écrit via /api/mcp).
create table if not exists exercise_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  matiere     text not null,
  chapitre    text not null,
  source      text,
  niveau      text,
  resultat    text not null,
  indices     int not null default 0,
  temps_min   int,
  temps_prevu int,
  erreurs     text[] not null default '{}',
  commentaire text
);
-- RLS activée sans politique : seule la clé secrète (serveur) peut lire/écrire.
alter table exercise_logs enable row level security;
