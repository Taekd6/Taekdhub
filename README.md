# TaekdHub

Système de travail personnel pour prépa scientifique (timer, banque d'exercices, progression, gamification). Next.js 15 + React 19 + TypeScript, données stockées en `localStorage` (Supabase optionnel pour la sauvegarde cloud).

## Installation

```bash
pnpm install
```

Node.js 20+ recommandé (testé avec Node 24, pnpm 11).

## Lancement local

```bash
pnpm dev
```

App disponible sur `http://localhost:3000`.

Aucune variable d'environnement n'est requise pour utiliser l'app : les données vivent en `localStorage` par défaut.

## Variables d'environnement (optionnel)

Copier `.env.example` vers `.env.local` pour activer la synchronisation Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Sans ces variables, `lib/supabase/client.ts` désactive proprement le client Supabase et l'app continue de fonctionner en local uniquement.

## Build

```bash
pnpm build
```

Génère un build de production statique (toutes les routes sont prérendues). Vérifié avec `tsc --noEmit` et `next build` sans erreur.

## Déploiement (Vercel)

1. Importer le repo GitHub `Taekd6/Taekdhub` sur [vercel.com/new](https://vercel.com/new).
2. Framework détecté automatiquement : Next.js. Aucune config supplémentaire nécessaire.
3. (Optionnel) Ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les Environment Variables du projet Vercel si la sync cloud est souhaitée.
4. Déployer.

## Structure du projet

```
app/(app)/dashboard   Tableau de bord
app/(app)/exercises   Banque d'exercices
app/(app)/history     Historique des séances
app/(app)/progress    Progression / statistiques
app/(app)/session     Séance de travail
app/(app)/timer       Focus timer
app/(app)/settings    Réglages
components/           Composants UI et par domaine (exercises, history, session, ui)
lib/                  Logique métier : storage (localStorage), progression, recommandations, gamification, supabase/
supabase/migrations/  Schéma SQL pour la synchronisation cloud optionnelle
```

## Reprendre le développement avec Claude Code

Le repo GitHub est la source complète : `git clone` + `pnpm install` suffit pour repartir sur n'importe quelle machine.

```bash
git clone https://github.com/Taekd6/Taekdhub.git
cd Taekdhub
pnpm install
pnpm dev
```

Ensuite, lancer `claude` dans le dossier du projet. Aucune donnée personnelle ou sauvegarde utilisateur n'est versionnée — le contexte métier (exercices, séances, préférences) vit uniquement dans le `localStorage` du navigateur de chaque utilisateur.
