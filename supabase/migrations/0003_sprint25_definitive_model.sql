-- Sprint 2.5 : modèle de données définitif de la banque d'exercices.
-- Complète 0001_initial.sql et 0002_sprint2a_exercise_bank.sql sans les
-- modifier. Non branchée à l'application (voir lib/supabase/client.ts) : ce
-- fichier documente le schéma cible pour quand la persistance Supabase sera
-- activée dans un futur sprint. Les migrations de données correspondantes
-- sont implémentées côté client dans lib/storage.ts (normalizeExercise /
-- normalizeSession) pour les données locales déjà existantes.

-- Titre vs chapitre (décision produit Sprint 2.5) : `chapter` décrivait déjà
-- l'exercice lui-même (jamais un vrai chapitre du programme) — renommage pur.
-- `chapter_id` est un nouveau champ nullable qui référencera le futur
-- catalogue de chapitres. Ce catalogue n'existe pas encore côté base (côté
-- client, voir lib/chapters.ts, aujourd'hui vide) : pas de contrainte de clé
-- étrangère pour l'instant, à ajouter quand la table `chapters` sera créée.
alter table public.exercises rename column chapter to title;
alter table public.exercises add column chapter_id uuid;

-- Priorité (élève) et maîtrise (élève) — distinctes l'une de l'autre et de
-- `difficulty` (intrinsèque à l'exercice) et de `status` (cycle de vie).
-- Valeurs par défaut proposées au Sprint 2.5, à ajuster si besoin.
alter table public.exercises add column priority smallint not null default 3 check (priority between 1 and 5);
alter table public.exercises add column mastery smallint not null default 0 check (mastery in (0, 25, 50, 75, 100));

-- Année associée à la source (ex. 2022 pour "Centrale 2022"), distincte du
-- texte libre `source`. Nullable : non extraite automatiquement des sources
-- existantes (voir lib/storage.ts — aucune tentative de deviner une année à
-- partir du texte de `source`).
alter table public.exercises add column year integer check (year is null or year between 1900 and 2100);

-- Horodatage de dernière modification de la fiche.
alter table public.exercises add column updated_at timestamptz not null default now();

-- Renommage pur : la valeur ne change pas de sens, seulement son nom.
alter table public.exercises rename column last_opened_at to last_worked_at;

-- Lien réel entre une séance et l'exercice concerné (nullable : une séance
-- libre depuis le Timer principal n'est liée à aucun exercice). `duration_minutes`
-- sur `exercises` reste un cache d'affichage ; `work_sessions` (filtré par
-- `exercise_id`) est désormais la source de vérité du temps réellement passé.
alter table public.work_sessions add column exercise_id uuid references public.exercises(id) on delete set null;
create index work_sessions_exercise_idx on public.work_sessions(exercise_id);

-- Réservé pour de futurs sprints (non implémenté, architecture compatible) :
-- - next_revision (répétition espacée) : une date de prochaine révision sur `exercises`.
-- - attachments : table annexe reliée à `exercises` par exercise_id (photo/PDF de correction, énoncé scanné…).
-- - review_history : table annexe reliée à `exercises` par exercise_id, historique structuré des révisions.
-- Aucune de ces trois notions n'a de colonne ou de table dans cette migration.
