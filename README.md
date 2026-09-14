# TaekdHub

**Le système d'exploitation personnel d'une prépa scientifique.**

TaekdHub répond à une seule question, et il la répond avec des chiffres vérifiables :

> Avec tout ce que j'ai à faire, mes échéances, mon retard et le temps dont je dispose
> réellement — qu'est-ce que je devrais faire **maintenant**, et est-ce que ma semaine
> tient debout ?

Next.js 15 · React 19 · TypeScript strict · Tailwind. Toutes les données vivent dans le
`localStorage` du navigateur : pas de compte, pas de serveur, rien à configurer.

**En ligne : [taekdhub.vercel.app](https://taekdhub.vercel.app)** — déploiement automatique depuis `main`.

---

## Ce que TaekdHub n'est pas

Ce n'est **pas une banque d'exercices**, et il ne le redeviendra pas. Les cours, les TD,
les DM, les livres, les cahiers de calcul et les annales vivent là où ils sont déjà.

Une tâche dit :

> « Faire les exercices 12 à 18 du TD 4 de maths » — 45 min — pour jeudi

et, au mieux, porte un lien vers la ressource. Le contenu pédagogique reste dehors ;
TaekdHub **organise le travail**, il ne l'héberge pas.

## Les six écrans

| Écran | La question à laquelle il répond |
| --- | --- |
| **Aujourd'hui** | Qu'est-ce que je fais maintenant ? Une tâche, sa durée, la raison pour laquelle c'est elle. |
| **Calendrier** | À quoi ressemblent mes prochains jours ? Vue jour / semaine / mois. |
| **Tâches** | Qu'est-ce que j'ai à faire, en entier ? Groupé par urgence, pas par date de saisie. |
| **Planning** | Est-ce que ça tient ? Charge jour par jour, planification automatique, adaptation au réel. |
| **Bilan** | Est-ce que j'ai avancé, et que changer ? Prévu / réel, échéances, matières, habitudes. |
| **Objectifs** | Vers quoi je travaille, et ce qui revient chaque semaine (routines). |

Plus les **Réglages** : disponibilités, matières, apparence, sauvegarde.

## Les cinq idées qui font le produit

1. **Échéance ≠ créneau.** `dueAt` dit *pour quand c'est* ; les créneaux disent *quand
   je le fais*. Reporter déplace le créneau, jamais l'échéance.
2. **La capacité est déclarée, donc réelle.** Sans savoir de combien d'heures on dispose,
   « est-ce que ça tient ? » n'a pas de réponse. Les disponibilités sont le premier réglage.
3. **Une tâche longue se répartit.** 3 h de DM deviennent 1 h 30 mercredi et 1 h 30 jeudi.
   Ce qui ne rentre pas n'est pas tassé dans la dernière soirée : c'est **dit**.
4. **Le temps réel est la seule vérité.** Ce qui était prévu et ce qui a été fait sont deux
   choses différentes ; les jours suivants sont replanifiés à partir de la seconde.
5. **Une évaluation est un événement, pas du travail.** Un DS de 4 h a lieu en classe :
   il apparaît au calendrier, il n'occupe aucune soirée. Ce qui se planifie, c'est
   « préparer le DS ».

## Installation

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Node 20+ (testé avec Node 22, pnpm 10). Aucune variable d'environnement requise.

```bash
pnpm check        # tsc --noEmit && eslint && vitest run
pnpm build
```

## Architecture

```
lib/domain/     LOGIQUE MÉTIER — fonctions pures, zéro React, zéro stockage.
  types.ts        Task, TimeEntry, Goal, Routine, Availability, Settings
  date.ts         instants ISO ↔ jours locaux (toutes les dates passent par ici)
  tasks.ts        création, transitions, créneaux, retard, travail restant
  availability.ts capacité déclarée → créneaux libres réels
  workload.ts     charge par jour, verdict de faisabilité
  priority.ts     score + RAISONS, prochaine action
  scheduling.ts   planification, découpage, report intelligent, adaptation au réel
  goals.ts        progression d'un objectif (jamais déclarée, toujours calculée)
  routines.ts     matérialisation idempotente des tâches récurrentes
  review.ts       bilan hebdomadaire + constats chiffrés
  habits.ts       justesse des estimations, reports, rythme réel

lib/store/      PERSISTANCE
  schema.ts       frontière de confiance : rien d'invalide n'en ressort
  repository.ts   interface `Repository` (localStorage aujourd'hui)
  store.tsx       magasin React unique, partagé par toute l'application

lib/agent/      INTERFACE AGENT
  snapshot.ts     instantané structuré et auto-descriptif des données

app/api/agent/  point d'entrée d'analyse (optionnel, voir ci-dessous)
components/     UI par domaine + système visuel (components/ui)
```

La séparation n'est pas décorative : **toute** la logique de priorisation, de charge et de
planification est testable sans navigateur (`lib/**/*.test.ts`, 152 tests), et l'interface
ne fait que l'afficher.

### Migration vers Supabase

L'application ne connaît que l'interface `Repository` (`load` / `save` / `lastFailure`),
jamais `localStorage`. Brancher un stockage distant = écrire une seconde implémentation et
la passer à `<TaekdhubProvider repository={…}>`. L'état persisté est un objet unique et
versionné (`AppState`, `STATE_VERSION`), qui se range aussi bien dans une colonne `jsonb`
que dans des tables dérivées.

### Analyse par un agent

`lib/agent/snapshot.ts` produit un instantané **structuré et auto-descriptif** (il embarque
son propre schéma) : tâches, échéances, disponibilités, charge par jour, temps réellement
travaillé, habitudes. Aucun chiffre n'y est recalculé — tout vient de `lib/domain`, donc
un agent et l'écran disent toujours la même chose.

Deux chemins, depuis l'écran **Bilan** :

- une clé `ANTHROPIC_API_KEY` est configurée sur le déploiement → la question part vers
  `POST /api/agent`, qui n'entrepose rien ;
- sinon → **Copier le contexte** met l'instantané dans le presse-papiers, à coller dans
  l'assistant de son choix.

Dans les deux cas, rien ne part sans un clic.

## Sauvegarde et changement d'ordinateur

Les données vivent dans **ce navigateur**, nulle part ailleurs — il n'y a donc aucune
récupération possible en cas de perte. L'export est la seule vraie assurance.

1. **Réglages → Exporter** : un fichier `taekdhub-sauvegarde-AAAA-MM-JJ.json` est téléchargé.
2. Sur l'autre machine : **Réglages → Restaurer**, choisir le fichier.

Le format est tolérant : un fichier d'une version plus ancienne (ou plus récente) reste
importable, et une sauvegarde éditée à la main aussi.

## Déploiement (Vercel)

1. Importer le dépôt sur [vercel.com/new](https://vercel.com/new) — framework détecté
   automatiquement, aucune configuration.
2. (Optionnel) ajouter `ANTHROPIC_API_KEY` pour l'analyse par un agent, et
   `NEXT_PUBLIC_SITE_URL` pour les métadonnées.
