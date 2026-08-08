-- Sprint 2A : banque d'exercices — matières étendues, statuts enrichis,
-- type d'exercice, temps estimé, tentatives. Complète 0001_initial.sql sans
-- le modifier. Non branchée à l'application (voir lib/supabase/client.ts) :
-- ce fichier documente le schéma cible pour quand la persistance Supabase
-- sera activée dans un futur sprint. Le mapping des anciennes valeurs
-- (Informatique -> Informatique TC, terminé -> maîtrisé) est implémenté côté
-- client dans lib/storage.ts (migrateSubject / migrateStatus) pour les
-- données locales déjà existantes.

alter type public.subject rename value 'Informatique' to 'Informatique TC';
alter type public.subject add value 'Chimie';
alter type public.subject add value 'Informatique Spé';

alter type public.exercise_status rename value 'terminé' to 'maîtrisé';
alter type public.exercise_status add value 'à revoir';

create type public.exercise_type as enum ('TD','DM','DS','Colle','TP','Annale','Concours','Personnel');

alter table public.exercises
  add column type public.exercise_type not null default 'Personnel',
  add column estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  add column attempts integer not null default 0 check (attempts >= 0);

alter table public.exercises alter column type drop default;
