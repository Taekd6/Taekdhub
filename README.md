# TaekdHub

Système de suivi personnel pour prépa scientifique. L'élève travaille sur ses propres feuilles ; TaekdHub garde la trace de son travail : chrono et saisie rapide du temps, objectifs par jour, par semaine et par matière, échéances et planning, notes (et calibration de ses prédictions), carnet « À revoir » en révision espacée, carnet d'erreurs, check-in du soir. Next.js 15 + React 19 + TypeScript, données stockées en `localStorage` du navigateur.

> **Pas de banque d'exercices.** TaekdHub en a longtemps embarqué une (≈ 540 énoncés, lecteur PDF, import de feuilles, recommandations, copilote IA d'indices, page Concours). Elle a été retirée : l'élève n'en avait pas besoin. Au premier chargement, l'ancienne banque encore présente dans le navigateur (`prepahub:exercises`, ≈ 2,8 Mo) est effacée — voir `purgeRetiredBankData` dans `lib/storage.ts`.

**Application en ligne (stable) : [https://taekdhub.vercel.app](https://taekdhub.vercel.app)** — déploiement Vercel automatique depuis la branche `main`.

## Changer d'ordinateur

Tes données (séances, échéances, notes, carnets, préférences) vivent dans le `localStorage` du navigateur, pas sur un serveur. Pour les emporter sur une autre machine :

**Sur l'ancien ordinateur — exporter :**
1. Ouvrir [https://taekdhub.vercel.app](https://taekdhub.vercel.app) → **Réglages** → **Exporter**.
2. Un fichier `taekdhub-sauvegarde-AAAA-MM-JJ.json` est téléchargé. Il contient **tout** : séances, échéances, intentions de planning, notes, carnet « À revoir » (dont les cartouches de méthode), carnet d'erreurs, check-ins du soir, préférences (dont la couleur d'accent) et les bilans de semaine figés (weekSnapshots). Garde ce fichier (clé USB, cloud, e-mail à toi-même…).

**Sur le nouvel ordinateur — importer :**
1. Ouvrir [https://taekdhub.vercel.app](https://taekdhub.vercel.app) (aucune installation nécessaire — c'est un site web ; optionnellement « Installer l'application » depuis le navigateur pour l'avoir comme une app).
2. **Réglages** → **Restaurer** → choisir le fichier `.json`.
3. Confirmer le remplacement, puis recharger la page. Toutes tes données sont là, à l'identique.

> Le format de sauvegarde est rétrocompatible : un fichier exporté par une ancienne version reste importable (les champs absents sont restaurés à vide sans erreur). Une sauvegarde de l'époque de la banque d'exercices contient encore `exercises` et `chapters` : elle s'importe normalement, ces deux champs sont simplement ignorés.

**Pour continuer le développement sur le nouvel ordinateur :**

```bash
git clone https://github.com/Taekd6/Taekdhub.git
cd Taekdhub
pnpm install
pnpm dev
```

Puis lancer `claude` dans le dossier. Le dépôt GitHub est la source complète — aucune donnée personnelle n'y est stockée (elle reste dans ton navigateur / ta sauvegarde JSON).

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

Génère un build de production statique (toutes les routes sont prérendues, aucune route serveur). Vérifié avec `tsc --noEmit`, `pnpm test`, `pnpm lint` et `next build` sans erreur.

## Déploiement (Vercel)

1. Importer le repo GitHub `Taekd6/Taekdhub` sur [vercel.com/new](https://vercel.com/new).
2. Framework détecté automatiquement : Next.js. Aucune config supplémentaire nécessaire.
3. (Optionnel) Ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les Environment Variables du projet Vercel si la sync cloud est souhaitée.
4. Déployer.

## Structure du projet

```
app/(app)/dashboard       Aujourd'hui : ma journée, échéances, révisions du jour, semaine
app/(app)/preparation     Matières : suivi par matière (temps, budget, échéances, notes, carnet)
app/(app)/progress        Progression : temps, régularité, répartition, notes, sommeil
app/(app)/history         Séances : journal des séances
app/(app)/echeances       Échéances et planning (atteint depuis l'accueil)
app/(app)/revoir          Carnet « À revoir » (+ /revoir/session : révisions espacées)
app/(app)/erreurs         Carnet d'erreurs
app/(app)/timer           Chronomètre
app/(app)/settings        Réglages, sauvegarde et restauration
components/               Composants UI et par domaine (work, review, errors, progress, history, hub, ui)
lib/                      Logique métier : storage (localStorage), planning, échéances, suivi du temps, notes, carnets, supabase/
supabase/migrations/      Schéma SQL historique pour la synchronisation cloud optionnelle (non branchée)
```

## Reprendre le développement avec Claude Code

Le repo GitHub est la source complète : `git clone` + `pnpm install` suffit pour repartir sur n'importe quelle machine.

```bash
git clone https://github.com/Taekd6/Taekdhub.git
cd Taekdhub
pnpm install
pnpm dev
```

Ensuite, lancer `claude` dans le dossier du projet. Aucune donnée personnelle ou sauvegarde utilisateur n'est versionnée — le contexte métier (séances, échéances, notes, préférences) vit uniquement dans le `localStorage` du navigateur de chaque utilisateur.

## Budget de stockage local

TaekdHub vit intégralement dans le `localStorage`, dont le quota est d'environ
5 Mo par origine sur la plupart des navigateurs. Voici où va cet espace,
**mesuré** et non estimé.

### Au premier démarrage : presque rien

L'ancienne banque d'exercices occupait à elle seule **2,81 Mo** dès le
premier lancement (`prepahub:exercises`, 537 fiches, plus 0,01 Mo de
chapitres). Elle a été retirée, et `purgeRetiredBankData` (`lib/storage.ts`)
efface ces clés d'un appareil qui les avait encore, une fois pour toutes, au
chargement suivant : tout le quota revient aux données de l'élève.

### Ce qui grossit avec le temps

Poids unitaires mesurés en UTF-16, l'unité réellement facturée :

| Donnée | Par enregistrement | Par année scolaire |
|---|---|---|
| Séance | 742 o | **1,03 Mo** |
| Travail / échéance | 828 o | 0,16 Mo |
| Instantané hebdomadaire | 1 982 o (moins depuis qu'il ne fige plus que du temps) | 0,10 Mo |
| Intention de planning | 164 o | 0,06 Mo |
| Note | 402 o | 0,02 Mo |
| **Total** | | **≈ 1,37 Mo/an** |

Les **séances représentent les trois quarts de la croissance**. Tout le reste
est marginal.

### Pas de plafond en vue sur deux ans de prépa

- fin de la première année : **≈ 1,4 Mo** ;
- fin de la seconde année : **≈ 2,8 Mo** — encore bien sous les 5 Mo.

L'écriture reste de toute façon blindée : un refus (stockage bloqué, disque
plein) ne lève jamais, `writeKey` renvoie `false`, `<StorageAlert>` le dit,
et la restauration d'une sauvegarde s'arrête net et rend compte — voir
`restoreBackup`.

Si un jour la marge venait à manquer, **ne pas élaguer les données de
l'élève** : ses séances, ses notes et ses échéances sont précisément ce que
rien ne peut recréer, et les compacter casserait la rétro-agrégation
(`computeWorkTimeSeries` recalcule n'importe quelle période à la demande) et
le journal.
