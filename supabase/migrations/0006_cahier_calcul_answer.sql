-- Ajoute la réponse brute, jusqu'ici absente du modèle : une fiche ne
-- portait qu'un `correction` (corrigé rédigé), jamais de réponse finale
-- distincte (voir lib/supabase/types.ts#Exercise.answer). Introduit pour
-- l'import du Cahier de calcul, qui fournit les deux séparément (réponse
-- brute pour chaque calcul, corrigé détaillé seulement pour une partie).
-- Complète 0001_initial.sql .. 0005_sprint_statement.sql sans les modifier.
-- Non branchée à l'application (voir lib/supabase/client.ts) : ce fichier
-- documente le schéma cible pour quand la persistance Supabase sera activée
-- dans un futur sprint.
alter table public.exercises add column answer text;
