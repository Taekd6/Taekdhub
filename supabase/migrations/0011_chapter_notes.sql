-- ══════════════════════════════════════════════════════════════════
-- COURS RETAPÉ ET MÉTHODES PAR CHAPITRE — une nouvelle collection
-- synchronisée : `chapterNotes`
-- ══════════════════════════════════════════════════════════════════
--
-- `user_collections` n'accepte que les collections qu'elle connaît
-- (contrainte `user_collections_known`, 0006 puis 0008). On y ajoute :
--   chapterNotes   une entrée par chapitre du programme : le cours retapé
--                  et les méthodes (lib/chapter-notes.ts), écrits par le
--                  connecteur de Claude (outils `save_course`, `add_methods`).
-- Rien d'autre ne change : mêmes politiques RLS (chaque élève ne lit et
-- n'écrit que ses lignes), même garde-fou de taille (20 Mo par collection).
--
-- ORDRE DE DÉPLOIEMENT : appliquer cette migration AVANT de déployer le
-- code qui écrit ou synchronise cette collection. Sinon l'envoi de
-- `chapterNotes` est refusé par la contrainte (les autres collections
-- continuent de se synchroniser) et les outils du connecteur répondent
-- par une erreur.
--
-- Migration ADDITIVE : aucune donnée n'est supprimée ni réécrite.
--
-- RETOUR ARRIÈRE (à n'exécuter que si aucune ligne `chapterNotes` n'existe,
-- sinon la contrainte serait violée) :
--   alter table public.user_collections drop constraint user_collections_known;
--   alter table public.user_collections add constraint user_collections_known check (collection in (
--     'sessions', 'preferences', 'weekSnapshots', 'workItems', 'grades', 'dayPlans',
--     'reviewItems', 'errors', 'checkins', 'chapterMemory', 'nextMoves',
--     'attempts', 'ankiSnapshots'));

alter table public.user_collections drop constraint if exists user_collections_known;
alter table public.user_collections add constraint user_collections_known check (collection in (
  'sessions', 'preferences', 'weekSnapshots', 'workItems', 'grades', 'dayPlans',
  'reviewItems', 'errors', 'checkins', 'chapterMemory', 'nextMoves',
  'attempts', 'ankiSnapshots', 'chapterNotes'
));
