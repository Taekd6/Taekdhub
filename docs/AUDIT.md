# Audit de TaekdHub — octobre 2026

> But : savoir **exactement** où en est le projet avant de le rendre fiable.
> Chaque constat est soit **vérifié** (commande lancée, code lu), soit marqué
> **à vérifier**. Rien n'est corrigé dans ce document : les corrections sont
> planifiées dans [`ROADMAP.md`](./ROADMAP.md).

Base auditée : `main` au commit `54f8f06` (« Bilan de séance au chrono, et cartes de cours maths MP pour Anki »).

---

## 1. État de santé (vérifié)

| Contrôle | Résultat | Durée |
|---|---|---|
| `pnpm install --frozen-lockfile` (pnpm 10.28, Node 22) | ✅ OK | 12 s |
| `pnpm lint` | ✅ 0 erreur — 1 avertissement Node (`MODULE_TYPELESS_PACKAGE_JSON`) | 7 s |
| `pnpm exec tsc --noEmit` | ✅ 0 erreur | 10 s |
| `pnpm test` (Vitest) | ✅ 62 fichiers, **976 tests** | 6 s |
| `pnpm build` (Next 15.5.23) | ✅ 34 pages, dont 1 dynamique (`/api/mcp/[key]`) | 41 s |

Taille : ≈ 42 000 lignes (hors tests). Plus gros fichiers : `lib/storage.ts` (2 233), `lib/next-move/engine.ts` (1 326), `app/globals.css` (1 352).
Hygiène : 0 `TODO`/`FIXME`, 0 `console.log`, 8 `eslint-disable` (tous `react-hooks/exhaustive-deps`).

**Avec pnpm 11 (PC de l'élève) :** `pnpm lint`, `pnpm test` et `pnpm exec tsc` **échouent** tant que les scripts de construction de `sharp` et `unrs-resolver` ne sont pas approuvés. pnpm 11 remplace `onlyBuiltDependencies` par `allowBuilds`. Le dépôt n'épingle aucune version de pnpm (`packageManager` absent) : le résultat dépend donc de la machine.

---

## 2. Architecture en une page

```
Navigateur ── localStorage (13 collections « prepahub:* ») ── mémoire de travail, hors ligne
     │                     ▲
     │  lib/sync/engine.ts │  révision optimiste, fusion « ne rien perdre »
     ▼                     │
Supabase  user_collections (1 ligne JSON par collection et par élève, RLS)
          exercise_logs    (annales écrites par Claude via le connecteur MCP)
     ▲
     │ clé secrète (contourne la RLS)
Claude ── /api/mcp/<MCP_SECRET>  (log_exercise, get_progress, get_today)
```

- **Sans compte**, tout reste dans le navigateur. **Avec compte**, `user_collections` fait foi et le localStorage sert de cache.
- La logique métier est dans `lib/`, et elle est **pure et testée** : moteur Next Move, FSRS, diagnostic, plan du jour, synchro. Les composants React ne sont pas testés.
- Il n'y a pas de store partagé. Chaque composant qui appelle `usePrepahubData()` garde **sa propre copie** des données : il y en a 40.

---

## 3. Bugs et risques — classés

Légende : **P0** = à corriger avant toute nouvelle fonctionnalité · **P1** = important · **P2** = confort / finition.

### P0 — fiabilité de l'outillage et sécurité

| # | Constat | Preuve | Risque |
|---|---|---|---|
| P0-1 | **pnpm non épinglé, et configuration de build incompatible avec pnpm 11** | `package.json` sans `packageManager` ; `pnpm-workspace.yaml` avec seulement `onlyBuiltDependencies` | Sur le PC, les commandes de contrôle échouent. Vercel peut aussi changer de version sans prévenir. |
| P0-2 | **Secret MCP comparé avec `!==`** | `app/api/mcp/[key]/route.ts`, `guarded()` | Une comparaison non constante en temps laisse en théorie deviner le secret caractère par caractère. Le risque est faible sur Vercel (le bruit réseau domine), mais la correction coûte 5 lignes (`crypto.timingSafeEqual`). |
| P0-3 | **Le secret MCP est dans l'URL** | même fichier | Il apparaît dans les journaux Vercel et l'historique des requêtes. Il faut documenter la rotation (changer `MCP_SECRET`, puis mettre à jour le connecteur dans Claude). |
| P0-4 | **`exercise_logs` n'est créée par aucune migration** | 0007 et 0008 ne font que `ALTER` ; 0008 teste même `to_regclass(...)` | Un nouveau projet Supabase (ou une remise à zéro) ne peut pas être reconstruit depuis le dépôt. **Touche le schéma → question posée avant d'agir.** |
| P0-5 | **Aucune CI** | pas de `.github/workflows` | Rien n'empêche de fusionner une PR qui casse lint, types, tests ou build. Vercel ne vérifie que le build. |

### P1 — intégrité des données et robustesse

| # | Constat | Preuve | Risque |
|---|---|---|---|
| P1-1 | **40 copies indépendantes des données dans un même onglet** | `hooks/use-prepahub-data.ts` : `useState` local ; seul l'événement `storage` (autres onglets) ou la synchro déclenchent `refresh()` | Pour 9 collections écrites en **remplacement** (notes, erreurs, à revoir, tentatives, mémoire, check-ins, Next Move, Anki, préférences), une copie périmée qui écrit **efface** ce qu'une autre copie vient d'ajouter. Le code le sait et contourne au cas par cas : relire `localData.preferences()` avant d'écrire, « un seul appelant par écran ». La protection repose donc sur la discipline, pas sur l'architecture. Exemple à surveiller : l'accueil, où `DashboardOverview` et ses enfants écrivent `reviewItems` et `chapterMemory`. **À vérifier par un test de scénario** avant de corriger. |
| P1-2 | **Suppressions perdues à la fusion** | documenté dans `lib/sync/collections.ts` (« limite connue et assumée ») | Une entrée supprimée sur l'iPhone peut réapparaître si le PC modifiait la même collection hors ligne. C'est un choix conscient (mieux vaut ressusciter que perdre). Il faudra un jour des « pierres tombales » (`deletedAt`). |
| P1-3 | **Horodatage de fusion trop pauvre pour `errors`** | `STAMPS.errors = createdAt` | La modification d'une erreur sur deux appareils donne une égalité, et la version locale gagne toujours. Une correction faite sur l'autre appareil est ignorée en silence. |
| P1-4 | **Quota localStorage (5 Mo)** | estimation dans `lib/storage.ts` : ≈ 1,4 Mo/an | Ça tient pour 2 ans de prépa, mais sans élagage ni alerte préventive. L'échec est bien géré (`writeKey` renvoie `false`, `<StorageAlert>`), mais il arrive trop tard. |
| P1-5 | **`process.env.TZ` modifié au chargement du module MCP** | `route.ts`, ligne 20 | Effet de bord global sur tout le processus serveur. Inoffensif aujourd'hui (une seule route serveur), piégeux demain. |
| P1-6 | **Aucun test de composant ni de parcours** | `vitest.config.ts` : logique pure uniquement | Les bugs de câblage (mauvais `save*`, copie périmée, P1-1) passent les 976 tests. |
| P1-7 | **13 modules de `lib/` sans fichier de test** | dont `attempts.ts`, `anki-snapshot.ts`, `anki-mapping.ts`, `week-snapshot.ts`, `day-agenda-log.ts` | Certains sont peut-être couverts indirectement. **À mesurer** (couverture). |

### P2 — finition, cohérence, dette

| # | Constat | Preuve |
|---|---|---|
| P2-1 | Avertissement `MODULE_TYPELESS_PACKAGE_JSON` à chaque lint et build | `eslint.config.js` en syntaxe ESM sans `"type": "module"` → le renommer `eslint.config.mjs` |
| P2-2 | Le paquet s'appelle encore `prepahub` | `package.json` (les clés `prepahub:*` du localStorage, elles, **ne doivent pas** changer) |
| P2-3 | `.env.example` incomplet | il manque `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `MCP_SECRET`, `MCP_USER_ID`, `MCP_TIMEZONE`, `NEXT_PUBLIC_SITE_URL` |
| P2-4 | Aucun en-tête de sécurité HTTP | `next.config.ts` minimal : pas de `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` |
| P2-5 | ~~Dépendance inutile `@modelcontextprotocol/server`~~ **Faux positif** | aucun `import` direct, mais `mcp-handler` la déclare en *peer dependency* obligatoire → **à garder**, et à commenter pour ne pas la retirer par erreur |
| P2-6 | Code mort de l'ancienne banque | `lib/supabase/services.ts` (aucun import) ; tables `exercises`, `work_sessions`, `profiles` (0001–0005) jamais lues |
| P2-7 | `robots.ts` incomplet | 8 routes récentes absentes de `disallow` (`/anki`, `/annales`, `/bilan`, `/debrief`, `/epreuve`, `/formulaire`, `/kholle`, `/programme`) |
| P2-8 | Service worker en retard sur les routes | `public/sw.js` ne précache pas ces mêmes 8 routes ; son commentaire dit encore « aucune route `/api` » |
| P2-9 | Fichiers géants | `lib/storage.ts` (types + normalisation + E/S + sauvegarde dans un seul fichier) et `lib/next-move/engine.ts` |
| P2-10 | 8 `eslint-disable exhaustive-deps` | à revoir un par un : chacun peut cacher une valeur périmée |

---

## 4. Ce qui est déjà solide (à préserver)

- **Écritures blindées** : `writeKey` ne lève jamais. Un refus de quota est remonté à l'élève et l'état React reflète le disque réel.
- **Lectures blindées** : `readList`/`readRecord` + `normalize*` résistent à un localStorage corrompu.
- **Synchro** : révision optimiste (`UPDATE … WHERE revision = N`), fusion sans perte, décision explicite au premier login. Un appareil d'un autre compte n'envoie jamais rien en silence. Le tout est testé sans réseau (moteur injecté).
- **RLS** correcte sur `user_collections` et `exercise_logs`. La clé secrète ne sert que côté serveur.
- **Restauration de sauvegarde** : elle s'arrête au premier refus, pour éviter un état mi-fichier mi-appareil.
- **Moteur Next Move** déterministe et explicable : le score est la somme des termes affichés.

---

## 5. Audit des routes

| Route | Rôle | Données écrites | Remarques |
|---|---|---|---|
| `/` | Page d'accueil publique | — | seule page indexable |
| `/bienvenue` | Premier lancement guidé | préférences | |
| `/dashboard` | Accueil : Next Move, plan du jour, saisie rapide, check-in | séances, travaux, à revoir, mémoire, check-ins, Next Move | **écran le plus exposé à P1-1** (plusieurs copies écrivent) |
| `/point` | « Le point » du matin | Next Move, préférences | |
| `/timer` | Chrono + bilan de séance | séances, tentatives | fin de séance protégée par `mergeSessions` |
| `/preparation` | Hub par matière | mémoire, à revoir | |
| `/echeances` | Échéances, programme d'un DS | travaux, mémoire | |
| `/revoir`, `/revoir/session` | Carnet « À revoir » + séance espacée | à revoir | |
| `/memoire` | Mémoire des chapitres (FSRS) | mémoire | |
| `/erreurs` | Carnet d'erreurs | erreurs, à revoir | |
| `/annales` | Annales Claude + « À refaire » | tentatives, à revoir (lecture `exercise_logs`) | dépend du compte |
| `/debrief` | Débrief de copie | tentatives, erreurs, notes | |
| `/epreuve` | Épreuve blanche | notes | état en cours dans localStorage |
| `/kholle` | Mode khôlle | mémoire, à revoir, préférences | |
| `/programme` | Carte du programme + diagnostic | préférences | |
| `/anki` | Pont Anki | relevés Anki, à revoir, préférences | AnkiConnect sur `127.0.0.1` |
| `/formulaire` | Entraînement aux formules | — | |
| `/progress`, `/bilan` | Progression, notes, bilan hebdo | notes, préférences | |
| `/history` | Historique des séances | — | |
| `/settings` | Réglages, compte, sauvegardes | préférences | 4 composants écrivent les préférences en relisant le disque (contournement de P1-1) |
| `/api/mcp/[key]` | Connecteur Claude | `exercise_logs` | P0-2, P0-3, P1-5 |

---

## 6. Questions ouvertes (pour l'élève)

1. **`exercise_logs`** : puis-je lire sa structure réelle dans Supabase (lecture seule) pour écrire la migration `create table if not exists` qui la décrit ? Cette migration ne modifierait **rien** sur la base existante.
2. **Anciennes tables** (`exercises`, `work_sessions`, `profiles`) : elles sont inutilisées. On les garde (aucun risque) ou on prévoit une migration de suppression (irréversible) ?
3. **P1-1 (copies multiples)** : la vraie correction, c'est un store partagé unique. Elle touche tout l'écran d'accueil, d'où une phase dédiée, avec tests de scénario d'abord. D'accord pour la planifier ainsi ?
