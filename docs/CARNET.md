# Carnet de bord TaekdHub

> Lu en premier à chaque session, avec `git status`. Si ce carnet et le dépôt divergent,
> le signaler et se fier au dépôt. Dernière mise à jour : 2026-10-14, commit de code `303553d`
> (PR #28 : dernière tête observée `5486d88`, avant les commits suivants).

## Objectif général
TaekdHub est l'outil de travail personnel d'un élève de prépa MP (PWA Next.js 15, React 19,
TypeScript). Les données vivent dans le navigateur (`localStorage`, clés `prepahub:*`) et se
synchronisent avec un compte Supabase (`user_collections`). Un connecteur MCP (`/api/mcp/<secret>`)
permet à Claude de lire et d'écrire certaines données.

But : maximiser les heures de travail réellement productives et réduire le temps passé à
planifier. Les tâches exigeantes vont aux meilleures plages, les légères aux autres ; réviser au
bon moment ; tenir compte des échéances et de la capacité ; intégrer plus tard le sommeil et la
fatigue, sans jamais diagnostiquer l'état de santé. Assistants possibles : ChatGPT, Gemini,
skills Claude, Hermes Agent. Leur collaboration n'est pas arrêtée et ils ne partagent ni mémoire
ni outils.

## Décisions prises
- Moteurs purs, recalculés à chaque affichage ; le plan n'est jamais stocké ; chaque score est
  expliqué. Aucun score global opaque de performance ou de santé.
- Pas de nouvelle base, collection ou API sans accord. Un champ optionnel dans une collection
  existante ne demande aucune migration SQL.
- Plages de performance (matin, après-midi, soir) : une hypothèse que l'élève règle ; `null` par
  défaut = comportement d'avant ; elles ne mesurent pas la performance.
- Le placement n'agit que sur les tâches déjà retenues par `buildDayAgenda`. Next Move, la
  sélection, les priorités, les échéances et les capacités ne changent pas.
- Journal de l'agenda : une nouvelle version à chaque changement de suggestion ; trace locale,
  non synchronisée, 7 jours et 40 versions par jour ; ce n'est pas une mesure de résultats.
- Aucun agent LLM dans le dépôt : le modèle est le client du MCP (pas de `/api/agent`).
- Le secret MCP de Claude donne lecture et écriture à tous les outils : il n'est pas donné à
  Hermes et reste inchangé.
- Hermes : accès séparé, `/api/mcp-hermes`, en lecture seule, jeton `MCP_HERMES_TOKEN` dans
  `Authorization: Bearer` (jamais dans l'URL ; fermé si absent ou de moins de 32 caractères). Le
  serveur n'enregistre que `get_today` et `list_echeances` : les outils d'écriture n'existent pas
  sur cette route.
- Aucun texte libre transmis à Hermes, même indirect (titres, notes, fiches, erreurs, libellés,
  clés d'exercices) et aucun identifiant d'échéance : la réponse est construite par liste blanche
  (`lib/hermes-snapshot.ts`). Les titres ne reviendront qu'après accord explicite.
- Résumé quotidien pour Hermes : `get_today` contient `agenda_du_jour` (tâches retenues dans l'ordre
  suggéré : matière, chapitre du programme officiel ou `null`, durée, priorité, niveau cognitif,
  plage suggérée, échéance ; capacité planifiable du jour et temps restant ; tâches reportées à
  demain par leur nature seulement). Il reprend `buildDayAgenda` et `placeDay` sans les modifier.
  Le temps restant vient de la capacité déclarée : le « il me reste… » de l'élève, propre à son
  appareil, n'existe pas côté serveur.
- Aucun signal de santé pour Hermes : les check-ins (sommeil, énergie, stress) ne sont ni lus (la
  route ne les demande pas à la base), ni transmis, ni cause d'un effet visible (le moteur tourne
  sans eux pour cette vue). Pas de séances non plus. Conséquence assumée : sur Hermes, une fatigue
  déclarée ne raccourcit pas la séance proposée comme dans l'application.
- Fraîcheur : `meta` (version, date de génération, dernière écriture par collection) et
  `donnees_anciennes` (aucune collection de travail écrite depuis plus de 48 h). Seuil provisoire :
  signale une absence de synchronisation récente, pas des données nécessairement incorrectes.
- Les docs `AUDIT.md` et `ROADMAP.md` sont partiellement périmées : se fier au code.

## État actuel
Branche `claude/loving-maxwell-oqm045`, dernier commit de code `303553d`, `main` = `1d75edd`.

**PR #28** (`Taekd6/Taekdhub`, créée par l'élève le 2026-10-14) : ouverte, non brouillon, non
fusionnée, `mergeable_state` propre, base `main`. Dernière tête observée avant ce travail :
`5486d88` (5 commits, 24 fichiers, +2777 / −13), contrôles terminés et verts (GitHub Actions
« Lint, types, tests, build », « Vercel Preview Comments », deux statuts Vercel). Depuis, des commits
ont été poussés (`e5e7dca` carnet, `b1676b7` résumé quotidien Hermes, puis la mise à jour de ce
carnet) : les contrôles et les Previews des deux projets se reconstruisent à chaque push, leur
résultat n'a pas été relu après ces pushs. Ni fusion ni déploiement en production sans accord.

**Deux projets Vercel** déploient ce dépôt, Previews prêts (« Ready ») sur les deux :
- `taekdhub` : `https://taekdhub-git-claude-loving-maxwell-oqm045-taekd.vercel.app`
- `taekdhub-vcrx` : `https://taekdhub-vcrx-git-claude-loving-maxwell-oqm045-taekd.vercel.app`

Le README place la production sur `taekdhub.vercel.app` : `taekdhub` est probablement le projet
principal et `taekdhub-vcrx` un doublon (inférence, non vérifiée). Les Previews sont protégés par le
SSO de Vercel (information de l'élève ; la session n'a pas pu les joindre, `vercel.app` y est bloqué).

| Mission | Résultat |
|---|---|
| 0 | Audit d'intégration IA (rapport en session, rien écrit) |
| 1 | Audit de la planification adaptative (rapport en session) |
| 2 | Phase 1 : exigence cognitive, plages, placement. Commit `c10d741` |
| 2.1 | Protocole de 14 jours, sans code |
| 2.2 | Suggestions dans l'historique de l'agenda. Commit `521cf28` |
| 3 | Accès Hermes en lecture seule (`/api/mcp-hermes`, jeton en en-tête). Commit `2dcd552` |
| 3b | Résumé quotidien pour Hermes (`agenda_du_jour`, sans santé ni texte libre). Commit `b1676b7` |
| 3c | `get_today` tolère des annales illisibles et le signale. Commit `303553d` |

Vérifications du dernier commit de code : 83 fichiers de tests, 1331 réussis + 1 échec attendu
(`it.fails` antérieur), `tsc`, lint et build sans erreur. Contrôles propres à Hermes : chaînes
témoin de texte libre absentes de toute la réponse, chaque chaîne de la réponse issue d'une liste
fermée (y compris journée chargée, tâches reportées et sans plages), clés exactes de l'agenda, un
check-in épuisé donne exactement la même réponse qu'aucun check-in, authentification (en-tête
manquant, mauvais schéma, mauvais jeton, jeton dans l'URL, variable absente, jeton trop court), liste
exacte des outils, absence d'appel d'écriture, essai HTTP local avec un jeton factice. Des mutations
volontaires (titre, clé, texte de report, séances, check-ins) sont bien détectées par ces tests.

**Branchement d'Hermes (2026-10-14) : connecté, `get_today` à revalider.** Projet Vercel `taekdhub`,
Preview de la branche. `MCP_HERMES_TOKEN` (Preview, cette branche, « sensitive ») et le contournement
de protection ont été créés par l'élève ; les valeurs sont dans le `.env` d'Hermes, jamais dans le
dépôt ni en conversation. Hermes liste exactement `get_today` et `list_echeances`.
- Réglages Vercel touchés cette session (à la demande de l'élève) : `SUPABASE_URL` et
  `SUPABASE_SECRET_KEY` remises en Production + Preview (une modification manuelle les avait
  retirées de la Production), valeurs inchangées ; Preview redéployé. **Production non redéployée :
  son dernier déploiement a été construit sans ces deux variables, donc le connecteur de Claude et
  les notifications serveur sont probablement cassés. À redéployer après accord explicite.**
- Constat sur la base : un seul compte, 8 collections. Depuis le Preview, la lecture d'`exercise_logs`
  reçoit un 401 alors que les autres lectures passent ; les droits SQL du rôle serveur sont corrects.
  Cause non trouvée (anomalie à creuser). Contournement `303553d` : `get_today` répond sans les
  annales et signale `donnees_indisponibles: ["annales"]`.
- Outil Vercel de la session : les appels avec `teamId`/`slug` renvoient 403, sans ces paramètres ils
  passent ; les journaux d'exécution restent illisibles.
- Reste à faire : vérifier `get_today` et `list_echeances` par un vrai appel d'Hermes sur le Preview
  reconstruit ; décider du redéploiement de la Production ; à la fin des essais, révoquer le
  contournement et le jeton.

Expérimentation de 14 jours : à mener par l'élève (avis O / T+ / T- / NP chaque soir, notés
à la main). Date de début : à renseigner. Phase 2 non lancée.

## Anomalies connues, non corrigées
- Fatigue définie de 3 façons ; le budget de l'agenda ignore les check-ins.
- Deux budgets du jour (capacité déclarée, capacité planifiable).
- Le matin, le moteur lit le sommeil de la nuit d'avant la veille.
- `exercise_logs` : migration 0009 à exécuter avant 0007 et 0008 sur une base neuve.

## Prochaine tâche envisagée
Aucune lancée. Candidats, chacun à proposer avec son périmètre, accord requis :
1. Premier branchement réel d'Hermes sur le Preview, par l'élève, sans code. Marche à suivre
   proposée (valeurs saisies par l'élève, jamais communiquées) :
   - choisir UN projet Vercel (`taekdhub` probable) et ne rien configurer sur l'autre ;
   - y ajouter `MCP_HERMES_TOKEN` (aléatoire, `openssl rand -hex 32`) pour l'environnement
     Preview seulement, limité à la branche `claude/loving-maxwell-oqm045` si possible ;
   - vérifier que `SUPABASE_URL` et `SUPABASE_SECRET_KEY` existent pour Preview (le Preview lira alors
     les vraies données) ; ne pas y mettre `MCP_SECRET` ;
   - Settings → Deployment Protection → « Protection Bypass for Automation » (le SSO reste actif ;
     contournement valable pour tout le projet, révocable ; disponibilité selon le plan non vérifiée) ;
   - redéployer le Preview (la variable ne s'applique qu'aux nouveaux déploiements) ;
   - dans Hermes : l'URL `…/api/mcp-hermes` avec les en-têtes `Authorization: Bearer …` et
     `x-vercel-protection-bypass: …` ;
   - vérifier : seuls `get_today` et `list_echeances`, `meta.fraicheur` présent, 401 sans `Authorization`.
2. Bilan des 14 jours, puis ajuster plages, classification ou placement.
3. Phase 2 : une seule règle de récupération (seulement après le bilan).
4. Plus tard, avec accord : un bilan périodique structuré pour Hermes (lecture seule), ou un
   rendu des échéances avec chapitres officiels (les tâches d'échéance n'ont pas de chapitre).

## Limites d'intervention
- Avant toute reprise : lire ce carnet, vérifier branche, HEAD et arbre ; signaler tout écart.
- Proposer la tâche et son périmètre, puis attendre l'accord avant de coder.
- Après accord : implémenter, vérifier (`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  `pnpm build`), puis deux commits : un pour le code, un pour la mise à jour de ce carnet
  (résultat et hash du commit de code).
- Ni nouvelle pull request, ni fusion, ni déploiement sans accord explicite. La PR #28 existe : ne
  pas la fusionner ni déployer en production sans accord explicite.
- Ne modifier ni réglage ni variable Vercel, ne créer aucun jeton, ne toucher à aucune configuration
  d'Hermes : ces actions sont faites par l'élève.
- Travailler sur la branche désignée ; ne jamais pousser sur `main`.
- Ne jamais afficher ni copier de secrets, clés ou données personnelles.
- Aucune phase 2 ni intégration Apple Watch sans demande.
- Hermes reste en lecture seule : aucun outil d'écriture, aucun texte libre, aucun titre ni
  identifiant d'échéance sans accord explicite ; ne pas toucher au secret MCP de Claude.
- Ne rien supprimer ni réécrire des changements de l'utilisateur.
- Signaler les anomalies sans les corriger hors périmètre.
