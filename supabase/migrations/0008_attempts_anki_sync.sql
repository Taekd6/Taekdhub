-- ══════════════════════════════════════════════════════════════════
-- TENTATIVES D'EXERCICE ET RELEVÉS ANKI — deux nouvelles collections
-- synchronisées, et l'aide utilisée sur une annale
-- ══════════════════════════════════════════════════════════════════
--
-- 1. `user_collections` n'accepte que les collections qu'elle connaît
--    (contrainte `user_collections_known`, 0006). On y ajoute :
--      attempts       tentatives d'exercice (lib/attempts.ts) ;
--      ankiSnapshots  relevés chiffrés de la collection Anki (lib/anki-snapshot.ts).
--    Rien d'autre ne change : mêmes politiques RLS (chaque élève ne lit et
--    n'écrit que ses lignes), même garde-fou de taille.
--
--    ORDRE DE DÉPLOIEMENT : appliquer cette migration AVANT de déployer le
--    code qui synchronise ces collections. Sinon l'envoi de ces deux
--    collections est refusé par la contrainte (les autres continuent de se
--    synchroniser, mais le compte affiche « en attente »).
--
-- 2. `exercise_logs.aide` : l'aide utilisée pendant l'essai d'une annale
--    corrigée par Claude — « sans », « indices » ou « correction ». Colonne
--    facultative : les lignes existantes restent `null` (aide inconnue), et
--    le connecteur MCP ne l'envoie que si elle est connue. Ignorée si la
--    table n'existe pas (projet sans connecteur).
--
-- Migration ADDITIVE : aucune donnée n'est supprimée ni réécrite.
--
-- RETOUR ARRIÈRE (à n'exécuter que si aucune ligne `attempts` /
-- `ankiSnapshots` n'existe, sinon la contrainte serait violée) :
--   alter table public.user_collections drop constraint user_collections_known;
--   alter table public.user_collections add constraint user_collections_known check (collection in (
--     'sessions', 'preferences', 'weekSnapshots', 'workItems', 'grades', 'dayPlans',
--     'reviewItems', 'errors', 'checkins', 'chapterMemory', 'nextMoves'));
--   alter table public.exercise_logs drop column if exists aide;

alter table public.user_collections drop constraint if exists user_collections_known;
alter table public.user_collections add constraint user_collections_known check (collection in (
  'sessions', 'preferences', 'weekSnapshots', 'workItems', 'grades', 'dayPlans',
  'reviewItems', 'errors', 'checkins', 'chapterMemory', 'nextMoves',
  'attempts', 'ankiSnapshots'
));

do $$
begin
  if to_regclass('public.exercise_logs') is not null then
    alter table public.exercise_logs add column if not exists aide text;
    if not exists (select 1 from pg_constraint where conname = 'exercise_logs_aide_known') then
      alter table public.exercise_logs
        add constraint exercise_logs_aide_known check (aide is null or aide in ('sans', 'indices', 'correction'));
    end if;
  end if;
end
$$;
