# Feuille de route — rendre TaekdHub fiable

> Objectif : passer de « beaucoup de fonctionnalités » à « un produit sur
> lequel on peut compter tous les jours ». **Aucune nouvelle fonctionnalité**
> tant que les phases 1 à 3 ne sont pas terminées.
>
> Les numéros (P0-1…) renvoient à [`AUDIT.md`](./AUDIT.md).

## Règles de travail (valables pour chaque phase)

- Jamais de push sur `main`. Chaque phase a sa branche `claude/<phase>` et sa PR avec description.
- Avant chaque PR, ces quatre commandes doivent passer : `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` et `pnpm build`.
- **Zéro perte de données** : on ne renomme jamais une clé `prepahub:*`, et une migration SQL est additive ou précédée d'une question.
- Des petits commits, en français, chacun avec une raison claire.
- Avant une phase qui touche **le modèle de données** (schéma SQL, forme des collections, store), on fait une pause et on pose les questions.

## Ordre des phases

| Phase | Branche | Contenu | Touche les données ? |
|---|---|---|---|
| 0 | `claude/phase-0-audit` | `AUDIT.md` + `ROADMAP.md` | non |
| 1 | `claude/phase-1-fondations` | P0-1, P0-2, P0-3, P2-1 à P2-5 | non |
| 2 | `claude/phase-2-ci-tests` | P0-5, P1-7, tests de scénario qui **reproduisent** P1-1 | non |
| 3 | `claude/phase-3-store` | P1-1 : un store partagé unique (`useSyncExternalStore`) | **oui → pause** |
| 4 | `claude/phase-4-schema` | P0-4 (migration `exercise_logs`), P2-6 (code et tables mortes) | **oui → pause** |
| 5 | `claude/phase-5-synchro` | P1-2 (pierres tombales), P1-3 (horodatage `updatedAt`), P1-4 (alerte quota) | **oui → pause** |
| 6 | `claude/phase-6-finition` | P1-5, P2-7, P2-8, P2-9, P2-10, découpage de `storage.ts` | non |

Pourquoi cet ordre :
1. **D'abord les outils** (phase 1). Tant que `pnpm test` échoue sur le PC, aucun contrôle n'est fiable.
2. **Ensuite le filet** (phase 2). La CI bloque toute régression, et les tests de scénario *prouvent* le bug P1-1 avant qu'on y touche.
3. **Enfin les changements risqués** (phases 3 à 5), un par un, chacun protégé par le filet.

## Backlog détaillé

### P0
- [ ] **P0-1** Épingler pnpm (`packageManager`), passer à `allowBuilds` (pnpm 11) en gardant `onlyBuiltDependencies` (pnpm 10 / Vercel), épingler Node (`engines`).
- [ ] **P0-2** Comparer le secret MCP avec `crypto.timingSafeEqual`.
- [ ] **P0-3** Documenter la rotation du secret MCP (README).
- [ ] **P0-4** Migration `0009` : `create table if not exists exercise_logs` fidèle au schéma réel *(question 1 de l'audit)*.
- [ ] **P0-5** GitHub Actions : lint, types, tests et build sur chaque PR.

### P1
- [ ] **P1-1** Store partagé : une seule copie des données par onglet, notifiée à chaque écriture.
- [ ] **P1-2** Suppressions synchronisées (`deletedAt`) sans risque de perte.
- [ ] **P1-3** Vrai `updatedAt` sur les erreurs (et les autres collections modifiables).
- [ ] **P1-4** Jauge d'occupation du localStorage et alerte à 70 %.
- [ ] **P1-5** Fuseau horaire du MCP passé en paramètre, sans modifier `process.env.TZ`. *(Reporté en phase 6 : les fonctions de date de `lib/` lisent toutes l'heure locale, donc la correction les touche toutes.)*
- [ ] **P1-6** Premiers tests de composants (accueil, chrono) avec un DOM simulé.
- [ ] **P1-7** ~~Mesurer la couverture~~ (fait : `pnpm test:coverage`) ; `week-snapshot` testé en phase 2 ; restent `sync/collections` (branches de fusion), `next-move/history`, `sync/supabase-remote`.

### P2
- [ ] **P2-1** `eslint.config.js` → `eslint.config.mjs`.
- [ ] **P2-2** Nom du paquet : `taekdhub`.
- [ ] **P2-3** `.env.example` complet et commenté.
- [ ] **P2-4** En-têtes de sécurité HTTP dans `next.config.ts`.
- [ ] **P2-5** Commenter pourquoi `@modelcontextprotocol/server` reste (peer de `mcp-handler`).
- [ ] **P2-6** Supprimer `lib/supabase/services.ts` ; décider du sort des tables 0001–0005.
- [ ] **P2-7** `robots.ts` : interdire toutes les routes de l'application.
- [ ] **P2-8** Service worker : précacher les routes récentes, puis passer en `v5`.
- [ ] **P2-9** Découper `lib/storage.ts` (types / normalisation / E/S / sauvegarde).
- [ ] **P2-10** Revoir les 8 `eslint-disable`.
