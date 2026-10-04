-- ══════════════════════════════════════════════════════════════════
-- EXERCISE_LOGS — la table elle-même, enfin décrite dans le dépôt
-- ══════════════════════════════════════════════════════════════════
--
-- `exercise_logs` (annales corrigées par Claude, écrites par le connecteur
-- MCP) avait été créée À LA MAIN dans Supabase : 0007 et 0008 ne faisaient
-- que la modifier. Un nouveau projet ne pouvait donc pas être reconstruit
-- depuis le dépôt (docs/AUDIT.md, P0-4).
--
-- Cette migration recopie EXACTEMENT la structure relevée sur le projet de
-- production le 4 octobre 2026. `if not exists` partout : sur la base
-- existante, elle ne change RIEN. Sur une base neuve, elle crée la table
-- telle que 0007 et 0008 l'attendent — à exécuter AVANT elles.
--
-- (Numérotée 0009 parce que 0007/0008 existent déjà ; sur une base neuve,
-- l'ordre d'exécution est : 0001 → 0006, 0009, 0007, 0008, 0010.)

create table if not exists public.exercise_logs (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  matiere     text        not null,
  chapitre    text        not null,
  source      text,
  niveau      text,
  resultat    text,
  indices     integer     default 0,
  temps_min   integer,
  temps_prevu integer,
  erreurs     text[],
  commentaire text,
  user_id     uuid        references auth.users(id) on delete cascade,
  aide        text
);

alter table public.exercise_logs enable row level security;
