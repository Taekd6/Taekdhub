# TaekdHub

Système de suivi personnel pour prépa scientifique. L'élève travaille sur ses propres feuilles ; TaekdHub garde la trace de son travail : chrono et saisie rapide du temps, objectifs par jour, par semaine et par matière, échéances et planning, notes (et calibration de ses prédictions), carnet « À revoir » en révision espacée, carnet d'erreurs, check-in du soir. Next.js 15 + React 19 + TypeScript, données stockées en `localStorage` du navigateur.

> **Pas de banque d'exercices.** TaekdHub en a longtemps embarqué une (≈ 540 énoncés, lecteur PDF, import de feuilles, recommandations, copilote IA d'indices, page Concours). Elle a été retirée : l'élève n'en avait pas besoin. Au premier chargement, l'ancienne banque encore présente dans le navigateur (`prepahub:exercises`, ≈ 2,8 Mo) est effacée — voir `purgeRetiredBankData` dans `lib/storage.ts`.

**Application en ligne (stable) : [https://taekdhub.vercel.app](https://taekdhub.vercel.app)** — déploiement Vercel automatique depuis la branche `main`.

## Next Move — « qu'est-ce que je fais maintenant ? »

En tête de l'accueil, une carte propose **une** action : la matière, l'objet (un chapitre, une échéance, un type d'erreur), la durée, et **pourquoi**. On peut dire « J'ai 30 min / 1 h / 2 h » : le moteur compose alors une courte session (avec une pause au-delà de ≈ 50 min). « Commencer » ouvre le chrono sur la bonne matière (ou la séance de révision) ; « Pas maintenant » est respecté pendant 24 h (la proposition sort de la session et de « Autre idée », mais reste dans « Détails ») ; « Détails » montre le calcul point par point.

Le moteur (`lib/next-move/engine.ts`) est **déterministe et explicable** — aucun apprentissage automatique. Il génère des candidats à partir des données réellement saisies :

| Candidat | Source | Ce qui le fait monter |
|---|---|---|
| Échéance | travaux planifiés (`lib/deadlines.ts`) | échéance proche, peu de marge, marqué important, plan « si… alors… » du jour |
| Rappel actif | mémoire des chapitres (FSRS) | probabilité de s'en souvenir sous 85 % |
| Reprise ciblée | carnet d'erreurs (14 derniers jours) | ≥ 2 erreurs, surtout de méthode/cours, sans « bonne idée », erreur d'hier |
| Révisions espacées | carnet « À revoir » | cartes arrivées à échéance |
| Bloc de travail | minimum du soir, budget hebdo par matière | minimum pas atteint (le soir surtout), retard sur le rythme de la semaine |

Puis des modulateurs, chacun avec sa phrase : DS/concours blanc dans les 7 jours (+ sur la préparation de la matière), notes en baisse ou sous la moyenne générale, surestimation répétée (calibration), déjà ≥ 1 h / ≥ 2 h de la même matière dans les 3 dernières heures (−), énergie ou sommeil bas au dernier check-in, heure tardive, déjà fait / écarté / ignoré plusieurs fois (historique). **Le score est exactement la somme des termes affichés.**

L'historique (`prepahub:next-moves`, `lib/next-move/history.ts`) garde ce qui a été proposé, commencé, fait (constaté d'après les séances et révisions, ou déclaré) et écarté. Les statistiques se taisent sous 8 propositions et ne prétendent à aucune causalité. Il voyage dans la sauvegarde et la synchronisation.

## Prêt pour le DS ? — le programme d'une épreuve

Un DS ou un concours blanc peut porter la liste de ses chapitres (`WorkItem.scope`, choisis parmi ceux de Mémoire — un chapitre manquant s'ajoute sur place). Pour chacun, `lib/exam-prep.ts` lit dans FSRS la chance de le retrouver sans ses notes **aujourd'hui**, **le jour J sans révision**, et **le jour J avec un rappel aujourd'hui** ; puis propose un plan : les chapitres sous 90 % le jour J, du plus menacé au moins menacé, répartis jusqu'à la veille, et la veille la relecture des erreurs récentes de la matière. Ce n'est jamais présenté comme une note prédite.

- **Où** : en tête de l'Aperçu de la matière (prochaine épreuve à ≤ 3 semaines), et bouton « Programme » sur chaque DS / concours blanc dans Échéances. « C'est révisé » note le rappel sur place.
- **Next Move** : un chapitre au programme d'une épreuve à ≤ 7 jours devient un rappel actif même s'il n'est pas encore menacé, avec la raison « Au programme du DS … : 61 % le jour J sans rappel, 93 % avec un rappel aujourd'hui ».
- **Le point** : la ligne « DS dans 3 j » dit combien de chapitres passeront sous 90 % et mène à la préparation.

## Annales — les exercices corrigés avec Claude

Quand Claude corrige un exercice de concours, le connecteur MCP (`app/api/mcp/[key]/route.ts`, outil `log_exercise`) l'enregistre dans la table Supabase `exercise_logs` : matière, chapitre, source, niveau, résultat (réussi / partiel / échec), indices, temps prévu et réel, erreurs relevées. L'application les **lit** quand l'élève est connecté (`hooks/use-annales.ts`, `lib/annales.ts`) :

- **`/annales`** : bilan (taux de réussite, un partiel comptant pour moitié ; indices moyens), chapitres du plus fragile au plus solide avec la frise des essais, réussite par niveau (CCINP → X-ENS), **calibration du temps** (médiane de temps réel / temps prévu, à partir de 3 exercices), erreurs qui reviennent, journal (supprimable). On y arrive depuis l'onglet « Erreurs » de chaque matière et depuis Next Move.
- **Next Move** : un chapitre dont la dernière annale (30 derniers jours) est un échec, ou qui compte au moins deux essais non réussis, devient une **reprise ciblée** (« Annales sur « Réduction » : 1 échec, 1 partiel sur 2 essais »), qui ouvre le chrono sur le chapitre de Mémoire correspondant s'il existe. Un dernier essai réussi l'efface.

### Connecteur MCP : `get_today`

Outre `log_exercise` et `get_progress`, le connecteur expose **`get_today`** : la recommandation Next Move et ses raisons, Le point (ce qui presse, ce qui est repoussé), les échéances à 14 jours, les chapitres qui s'effacent (FSRS), les erreurs récentes et les chapitres où les annales bloquent (`lib/today-snapshot.ts`). Claude l'appelle avant de proposer un exercice, pour viser le vrai point faible. Il lit les collections synchronisées (`user_collections`) : il faut donc être connecté au compte dans l'application.

Mise en service (une fois) :

1. Exécuter `supabase/migrations/0007_exercise_logs_owner.sql` (SQL Editor). Elle ajoute `user_id` à `exercise_logs`, rattache les lignes existantes au compte s'il n'y en a qu'un, et pose la RLS : l'élève **lit et supprime** ses seules lignes ; seul le connecteur (clé secrète) écrit.
2. Vercel → variables **serveur** (jamais `NEXT_PUBLIC_*`) : `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `MCP_SECRET` ; facultatif : `MCP_USER_ID` (identifiant du compte — indispensable seulement s'il y a plusieurs comptes) et `MCP_TIMEZONE` (`Europe/Paris` par défaut).

### Changer le secret du connecteur

Le secret fait partie de l'URL du connecteur : il apparaît dans les journaux de Vercel. Change-le s'il a pu être vu (capture d'écran, journal partagé), ou par précaution chaque trimestre :

1. Générer un nouveau secret : `openssl rand -hex 32` (ou un gestionnaire de mots de passe, 40 caractères ou plus).
2. Vercel → Settings → Environment Variables → `MCP_SECRET` → nouvelle valeur, puis **Redeploy**.
3. Claude → Réglages → Connecteurs → TaekdHub : remplacer l'URL par `https://taekdhub.vercel.app/api/mcp/<nouveau secret>`.

L'ancien secret cesse de fonctionner dès que le redéploiement est en ligne.

## Carte du programme, khôlle, épreuve blanche

Trois outils atteints depuis l'écran **Matières** (rangée de boutons ronds).

### Carte du programme (`/programme`)

Le programme MPSI → MP de maths, physique et chimie (`lib/programme-data.ts` : ≈ 70 chapitres, avec alias et questions de cours) confronté aux traces réelles (`lib/programme.ts`) : la mémoire FSRS du chapitre de Mémoire correspondant, la réussite des annales, et la déclaration « Vu en cours » (`Preferences.programmeSeen`). Chaque trace est rattachée à **un seul** chapitre, le rapprochement le plus fort (« Séries entières » ne compte pas pour « Séries numériques »). Statuts : **fragile** (mémoire < 85 % ou annales < 50 %), **jamais revu** (vu en cours, aucune trace), **en cours**, **solide** (mémoire ≥ 90 % ou ≥ 2 annales, et annales ≥ 70 %), **pas encore vu**. Le **rétroplanning** répartit ce qui n'est pas solide jusqu'à la date de concours (Réglages), le plus fragile d'abord, la dernière semaine gardée pour une relecture générale. `get_today` (MCP) en donne le résumé à Claude.

### Mode khôlle (`/kholle`)

Le programme de colle de la semaine (`Preferences.colleChapters`, ou `?chapitre=` depuis la carte) ; une question de cours tirée au sort — **pondérée** : une question ratée revient plus souvent, une question sue moins, une question posée dans les 24 h presque jamais (`lib/kholle.ts`, historique des tirages sur l'appareil) — un chrono (objectif 15 min) et l'auto-évaluation **su / hésitant / pas su**. Ce qui n'est pas su devient une carte « à apprendre » dans À revoir ; le rappel est noté dans Mémoire (une fois par chapitre et par khôlle) ; le temps devient une séance.

### Épreuve blanche (`/epreuve`)

Un sujet en conditions réelles (`lib/epreuve.ts`) : compte à rebours (1 à 4 h), questions avec barème, et **temps par question** (toucher une question y bascule le chrono). L'épreuve en cours survit à un rechargement (localStorage). À la correction : faite / partielle (½) / fausse / pas abordée, note **brute** ramenée sur 20 (pas une note harmonisée), et les questions où l'on s'est enlisé (> 1,5 × le temps justifié par le barème). Enregistrement : une note « concours » dans Progression — ou une note en attente avec la note estimée en pronostic, quand un professeur corrige (calibration) —, une séance pour le temps passé, et le lien vers le carnet d'erreurs.

## Système de progression : Anki, diagnostic, débrief, refaire sans aide

La boucle : **identifier le point faible → choisir l'action → la faire → vérifier quelques jours plus tard, par une nouvelle tentative sans aide.** Anki reste l'outil de mémorisation : TaekdHub n'y modifie ni ne planifie aucune carte, et n'en crée que sur un clic explicite (« Envoyer vers Anki », ci-dessous).

### Pont Anki (`/anki`, `lib/anki-connect.ts`, `lib/anki-snapshot.ts`, `lib/anki-mapping.ts`)

- **Relevé** des chiffres par paquet (sous-paquets exclus) : cartes, dues (hors nouvelles), révisées sur 30 j, ratées au moins une fois sur 30 j, mûres, oubliées ≥ 4 fois ; et le volume de révisions par jour. Trois sources : **AnkiConnect** (ordinateur, Anki ouvert ; lecture seule : `requestPermission`, `deckNames`, `findCards` via `multi`, `getNumCardsReviewedByDay`), **fichier** d'échange JSON (export/import entre navigateurs), **saisie rapide** depuis AnkiMobile (cartes dues, révisées aujourd'hui).
- Collection synchronisée `ankiSnapshots` : un relevé fait sur l'ordinateur se lit sur l'iPhone. Un relevé par jour et par source (`anki:<jour>`, `anki-manuel:<jour>`) : réimporter **remplace**, jamais de doublon ; 14 jours gardés. Chaque chiffre est daté ; « dues » n'est utilisé que si le relevé a moins de 24 h, le reste moins de 7 jours.
- **Paquets → chapitres** : *certaine* (le nom du paquet est exactement un titre ou un alias de chapitre, dans la matière lue dans le chemin, sans ambiguïté), *héritée* (sous-paquet d'un paquet associé), *proposée* (rapprochement partiel : **à confirmer**, jamais utilisée seule), *non classé*, et le **choix de l'élève** (`Preferences.ankiDeckChapters`, y compris « aucun chapitre », qui écarte toute la branche). On associe des paquets, jamais des cartes d'après leur texte.
- **Envoyer vers Anki** (`lib/anki-export.ts`) : les fiches nées dans TaekdHub qui ont un verso (méthodes tirées d'un blocage, notes « À revoir ») deviennent des cartes, sur un clic : AnkiConnect `createDeck`, `canAddNotes`, `addNotes` avec le modèle « Basique » / « Basic » de la collection, paquets `TaekdHub::<matière>`, étiquette `taekdhub`. Une carte déjà présente (même recto dans le paquet) n'est pas recréée. Sans AnkiConnect : fichier texte à importer (Fichier › Importer). Option : marquer faites dans TaekdHub les notes arrivées dans Anki, pour ne pas réviser deux fois.
- Limites : voir « Limites de l'intégration Anki » plus bas.

### Tentatives et « refaire sans aide » (`lib/attempts.ts`, `lib/exercises.ts`, « À refaire » sur `/annales`)

- Collection synchronisée `attempts` (fonctionne sans compte et hors ligne) : résultat, **aide** (sans / indices / correction ouverte), temps, cause (cours, méthode, calcul, compréhension, démarrage, temps, rédaction), manque de temps.
- Un exercice = toutes les tentatives d'une même clé, annales (Supabase) et tentatives de l'app **réunies à la lecture**, sans copie.
- Règles : seul « réussi **sans aide** » prouve la maîtrise ; sinon nouvelle tentative à J+2, J+5 puis J+12 (`Preferences.retryDelaysDays`) ; après 3 échecs d'affilée, une **autre action** est proposée selon la cause (rappel de cours, méthode expliquée puis exercice plus accessible…). L'écran de tentative cache la correction et chronomètre.
- Une erreur du carnet reliée à un exercice n'est « corrigée » qu'après une réussite sans aide postérieure (badge dans le carnet).

### Diagnostic des lacunes (`lib/diagnostic.ts`, en tête de `/programme`)

Par chapitre, des constats **seulement au-delà d'un seuil d'observations** (fenêtre 60 j) : cours (mémoire < 85 %, ou Anki ≥ 20 % d'échecs sur ≥ 20 cartes, ou ≥ 2 causes/erreurs « cours »), démonstrations (≥ 2 questions de khôlle ratées), méthode, application (≥ 3 tentatives, < 50 % sans aide), calcul, temps, démarrage. « Établi » = ≥ 2 sources ou ≥ 4 observations, « signal » sinon. **Le cours tient mais l'application rate** est dit explicitement (priorité à l'exercice). Pas de score composite : ordre = établi d'abord, puis épreuve dans 14 j, puis nombre de constats, puis récence. Chaque constat donne son action et son critère de fin.

### Débrief de copie (`/debrief`, `lib/debrief.ts`)

Depuis une note (Progression → icône débrief), une épreuve blanche (questions, barème et temps pré-remplis) ou une note saisie sur place : par question, chapitre, résultat, cause, manque de temps, barème, exercice/annale relié. Chaque question devient une tentative (elle revient dans « À refaire ») et chaque échec causé une erreur du **carnet existant**. Identifiants dérivés de la note et du libellé : réenregistrer remplace. Plan en 6 étapes : priorités, cours, exercices, cartes Anki, nouvelle tentative, vérification.

### Next Move v2 (`lib/next-move/engine.ts`)

Nouveaux candidats : **refaire** (exercices à leur date ; exercice ciblé quand le diagnostic établit un problème d'application sans exercice en attente) et **anki** (paquet d'un chapitre dont le cours résiste ; cartes dues d'un relevé < 24 h). Chaque proposition dit **ce qu'elle corrige** et **quand elle est terminée** ; « refaire » et « anki » ne sont constatés faits que sur preuve (tentative notée, relevé sans carte due), jamais au temps passé. Un exercice à refaire **remplace** le bloc générique de sa matière et en reprend les objectifs de temps. **Mode repos** : capacité déclarée du jour atteinte (ou fatigue forte et moitié faite) et rien d'urgent ⇒ la carte dit « Assez pour aujourd'hui » (la proposition reste à un geste). Fatigue forte ⇒ séance par défaut de 25 min.

### Phase 2 — le moteur adaptatif

**Plan de la journée qui se recalcule** (`lib/day-agenda.ts`, `lib/day-agenda-log.ts`, carte « Le reste de ta journée » sous Next Move). Le temps restant vient de la capacité déclarée du jour et de l'heure (jamais au-delà de 23 h), ou de « Il me reste… ». Trois paliers : **indispensable** (échéance à rendre demain au plus tard — gardée en entier, jamais compressée —, minimum du soir, révisions dues, épreuve demain), **important déplaçable** (exercices à refaire, transferts, actions du diagnostic, priorités du bilan, échéances de la semaine), **secondaire**. Quand le temps manque, on retire d'abord le moins prioritaire ; une tâche est gardée, réduite jusqu'à son minimum ou déplacée à demain, toujours avec sa raison ; rien n'est supprimé (« Confirmer le report » repousse une échéance à demain). Chaque changement réel du plan laisse une version datée sur l'appareil (non synchronisée : tout se recalcule) ; la carte dit « Recalculé depuis HH:MM. Pourquoi : Physique : 3 h faites pour 2 h prévues (+1 h) », « Nouvelle urgence : … », « Temps restant ramené à … ».

**Boucle d'apprentissage** (`lib/diagnostic.ts`). Causes distinguées : cours, démonstration, méthode, application, problèmes difficiles (niveau de l'exercice : direct / classique / difficile), calcul, temps, démarrage. Chaque constat sépare les **faits** chiffrés de l'**hypothèse** qu'ils suggèrent ; une observation de plus de 21 jours redevient un simple signal « à confirmer ». Next Move choisit l'action selon la cause (exercice ciblé, problème difficile découpé, exercice chronométré, reprise des calculs, khôlle, rappel de cours).

**Comprendre pourquoi je bloque, puis vérifier le transfert** (`lib/transfer.ts`, « À refaire » sur `/annales`). Après un échec : ce que je n'ai pas compris, où j'ai déraillé, le réflexe à mobiliser, ce que je dois reconnaître → une fiche de méthode dans « À revoir ». Une semaine après une correction vérifiée, un **exercice de transfert** (énoncé différent, même méthode) est demandé ; réussi sans aide ⇒ méthode acquise, sinon reprogrammé. Pas de nouveau carnet : ce sont des tentatives (`attempts`) avec deux champs facultatifs (`analysis`, `transferOf`).

**Bilan hebdomadaire opérationnel** (`lib/weekly-learning.ts`, Progression › Bilan, « Ce que tu sais faire »). Compétences vérifiées (preuves uniquement), difficultés récurrentes (même cause sur au moins deux exercices différents en 14 jours), progrès (comparé seulement avec au moins 3 tentatives de chaque côté), chapitres à travailler (fait + hypothèse), ajustements. « Adopter ces priorités pour 7 jours » enregistre `preferences.weeklyFocus` : Next Move ajoute alors un terme visible (+12) aux actions déjà justifiées de ces chapitres, et le plan du jour les classe « important ». Une priorité sans constat ne crée aucune tâche.

**Contrôle qualité des exercices** (`lib/exercise-quality.ts`). TaekdHub ne stocke ni énoncés ni corrigés ; il contrôle ce qu'il peut : (1) les données d'un exercice noté — sans chapitre, sans niveau, échec sans cause, aide déduite — avec « Données à compléter » dans « À refaire » pour fixer chapitre et niveau sur place ; (2) le niveau à viser : on monte d'un cran après deux réussites sans aide au niveau inférieur, jamais au temps passé ; (3) la variété : trois réussites ou plus toutes faciles ne prouvent pas la méthode (signalé dans Next Move et dans le bilan hebdomadaire) ; (4) « Copier la demande pour Claude » (Next Move, formulaire de transfert) : chapitre et sous-thème, niveau, prérequis, objectif, correction complète et rigoureuse demandée seulement après l'essai, puis `log_exercise`.

**Bilan de séance** (`lib/session-debrief.ts`, chrono). À l'arrêt du chrono : « qu'as-tu fait ? ». Quelques gestes par exercice (résultat, aide, cause, chapitre, difficulté), pré-remplis d'après la recommandation Next Move commencée (refaire ⇒ même exercice ; transfert ⇒ `transferOf` ; exercice ciblé ⇒ son chapitre). Chaque ligne devient une tentative : diagnostic, « À refaire », transferts et bilan sont nourris, et Next Move clôt sa recommandation sur cette preuve. « Rien à noter » pour une séance de cours.

**Cartes de cours maths MP** (`data/course-cards.json`, `lib/course-cards.ts`, page Anki). 117 cartes sur les 13 chapitres de spé : définitions, théorèmes avec hypothèses, méthodes « Quand je vois… ». Paquets `TaekdHub::Mathématiques::<chapitre>`, associés automatiquement au bon chapitre. Paquet complet `public/anki/taekdhub-maths-mp.apkg` (iPhone : ouvrir depuis Fichiers), ou envoi chapitre par chapitre via AnkiConnect. Après modification du JSON : `pip install genanki && python3 scripts/build-course-deck.py` (identifiants stables : réimporter met à jour sans dupliquer).

**Données** : aucune nouvelle collection, aucune nouvelle migration. `analysis`, `transferOf`, `level` vivent dans `attempts` (migration 0008, déjà prévue) ; `weeklyFocus` dans le document `preferences`, déjà synchronisé ; la trace du plan reste sur l'appareil.

### Limites de l'intégration Anki

- **iPhone / iPad** : AnkiMobile n'expose aucune donnée (pas d'API, pas d'AnkiConnect). Depuis le téléphone : saisie rapide (deux chiffres) ou lecture d'un relevé fait sur l'ordinateur et synchronisé par le compte. Pour que ce relevé inclue les révisions faites sur iPhone : synchroniser AnkiMobile puis Anki (ordinateur) avec AnkiWeb, comme d'habitude. TaekdHub ne parle jamais à AnkiWeb et ne demande aucun identifiant.
- **AnkiConnect** : Anki ouvert sur le même ordinateur ; l'adresse de TaekdHub dans `webCorsOriginList` (configuration affichée et copiable sur `/anki`) ; Chrome, Edge ou Firefox (Safari peut bloquer l'accès d'une page https à `127.0.0.1` ; Chrome peut demander l'autorisation « réseau local »).
- Les fichiers `.apkg` / `.colpkg` ne sont pas lus. Les chiffres sont ceux de l'instant du relevé, jamais du temps réel ; la planification d'Anki n'est jamais recalculée.

### Mise en production (ordre impératif)

1. Supabase → SQL Editor : `0007_exercise_logs_owner.sql`, puis `0008_attempts_anki_sync.sql` (additives ; retour arrière de 0008 en commentaire dans le fichier).
2. Vérifier : `select pg_get_constraintdef(oid) from pg_constraint where conname = 'user_collections_known';` liste `attempts` et `ankiSnapshots`.
3. Seulement ensuite, fusionner la branche dans `main` (Vercel déploie). Déployer avant 0008 : la synchronisation des deux nouvelles collections serait refusée (« en attente »), les autres continuent.
4. Aucune nouvelle variable d'environnement. Facultatif : `MCP_USER_ID`, `MCP_TIMEZONE`.

## Formulaire flash et bilan imprimable

### Formulaire (`/formulaire`)

Ce qui se sait par cœur (`lib/formulaire-data.ts`, ≈ 90 cartes) : DL usuels, primitives, trigonométrie, sommes et séries, algèbre linéaire, probabilités ; mécanique, électricité, thermodynamique, électromagnétisme, ondes et optique, quantique ; cinétique, solutions aqueuses, cristallographie. **S'entraîner** : une série de 10 cartes tirées avec le même tirage pondéré que la khôlle (`lib/formulaire.ts`) — on écrit la formule de tête, on retourne, on s'évalue. **Fiche** : tout le formulaire de la matière d'un coup d'œil, avec la pastille du dernier résultat de chaque carte. Historique sur l'appareil.

### Bilan (`/bilan`)

Une page par période (7 jours, 30 jours, trimestre, année scolaire depuis le 1er septembre) : temps total, jours travaillés, temps et moyenne par matière, écart avec la période précédente, notes et calibration, erreurs par type, annales, et l'état actuel de la carte du programme (`lib/bilan.ts`). « Imprimer ou PDF » : à l'impression, la navigation et les contrôles disparaissent et toutes les sections sont rendues d'emblée (`@media print` dans `app/globals.css`). Atteint depuis Progression → Bilan.

## Le point — l'écran d'ouverture

À la première ouverture de la journée (et après 4 h d'absence, mesurée depuis la dernière activité dans l'application — `components/activity-tracker.tsx`), l'accueil s'ouvre sur **Le point** (`/point`, `lib/briefing.ts`) : une salutation, une phrase de résumé, le prochain mouvement de Next Move avec « Commencer », puis trois sections d'au plus trois lignes chacune — **Ce qui presse** (retard, échéance du jour ou du lendemain, travail qui ne tient plus, DS dans ≤ 3 j), **Tu repousses** (travail reporté ≥ 2 fois, plan « si… alors… » manqué, matière proposée ≥ 3 fois sans suite, cartes en retard, objectif de la semaine qui décroche ; puis, à surveiller : chapitre qui s'efface, erreurs sans « bonne idée », note en attente) et **Aujourd'hui** (minimum du soir, plans du jour, cartes du jour). On y revient en touchant la date de l'accueil ; Réglages → À l'ouverture le désactive.

## Séances et chrono

- **Corriger une séance** : Séances → crayon sur la ligne — matière, début, durée, note, ou suppression (`lib/session-edit.ts`). Une séance corrigée porte `updated_at`, qui l'emporte à la synchronisation.
- **Chrono oublié** : au-delà de 3 h, « Terminer » demande la durée réelle avant d'enregistrer.
- **Onglet perdu** : le chrono en cours (`sessionStorage`) est doublé d'un miroir en `localStorage` ; un onglet fermé ou déchargé par le téléphone laisse un chrono à « reprendre » au prochain passage sur le Chrono (`lib/timer-recovery.ts`). Stockage bloqué : le chrono fonctionne en mémoire, sans planter.

## Temps par chapitre

Au chrono, un chapitre de la mémoire peut être choisi (facultatif) : la séance porte alors `chapter_id`. Mémoire affiche le temps passé par chapitre, et Next Move propose un rappel actif sur un chapitre travaillé cette semaine sans rappel depuis. Les anciennes séances se relisent sans changement.

## Compte et synchronisation (Supabase)

Facultatif. **Non connecté**, rien ne change : les données vivent dans le navigateur. **Connecté**, le compte fait foi et le navigateur en garde une copie de travail : l'application reste instantanée et utilisable hors ligne, et chaque modification part au serveur dès que possible (après une courte accalmie, au retour du réseau, au retour sur l'onglet, et toutes les 2 min pour recevoir les autres appareils).

- **Connexion** : Réglages → Compte. E-mail + mot de passe, ou lien de connexion par e-mail. « Mot de passe oublié ? » envoie un lien pour en choisir un nouveau.
- **Premier login avec des données sur l'appareil** : TaekdHub demande avant tout envoi — *Importer mes données* / *Commencer sans elles* (compte vide), ou *Fusionner les deux* / *Garder seulement le compte* (compte déjà rempli). Toute option qui remplace l'appareil **télécharge d'abord une sauvegarde complète**.
- **Cycle léger** : chaque cycle lit d'abord les seules révisions, puis ne télécharge que les collections qui ont bougé.
- **Écriture locale refusée** (quota) : la révision serveur n'est pas adoptée et rien n'est envoyé — jamais un cache périmé présenté comme à jour.
- **Conflits** : chaque collection porte une `revision` ; un envoi n'écrase jamais une version plus récente d'un autre appareil — il est refusé, puis fusionné (union par identifiant, la version la plus récente d'un même objet). Limite assumée : une entrée supprimée sur un appareil pendant qu'un autre modifiait hors ligne la même collection peut réapparaître.
- **Déconnexion** : les données restent sur l'appareil (option « Déconnecter et effacer cet appareil », refusée tant que des modifications n'ont pas été envoyées).
- **Reste local** : le chrono en cours (`sessionStorage`), la date du dernier export, les mémoires de saisie.

Mise en service (une fois) :

1. Dans le projet Supabase, exécuter `supabase/migrations/0006_user_collections_sync.sql` (SQL Editor, ou `supabase db push`). Elle crée `public.user_collections` avec RLS : un élève ne lit et n'écrit **que** ses lignes.
2. Authentication → URL Configuration : ajouter `https://taekdhub.vercel.app/settings` (et `http://localhost:3000/settings` en local) aux Redirect URLs, pour les liens de connexion.
3. Vercel → Environment Variables : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clé *anon/publishable*). **Jamais** la clé `service_role` : elle contourne la RLS.

## Changer d'ordinateur

**Le plus simple : se connecter** (Réglages → Compte) sur les deux machines — voir « Compte et synchronisation » ci-dessus.

Sans compte, tes données (séances, échéances, notes, carnets, préférences) vivent dans le `localStorage` du navigateur, pas sur un serveur. Pour les emporter sur une autre machine :

**Sur l'ancien ordinateur — exporter :**
1. Ouvrir [https://taekdhub.vercel.app](https://taekdhub.vercel.app) → **Réglages** → **Exporter**.
2. Un fichier `taekdhub-sauvegarde-AAAA-MM-JJ.json` est téléchargé. Il contient **tout** : séances, échéances, intentions de planning, notes, carnet « À revoir » (dont les cartouches de méthode), carnet d'erreurs, check-ins du soir, préférences (dont la couleur d'accent) et les bilans de semaine figés (weekSnapshots). Garde ce fichier (clé USB, cloud, e-mail à toi-même…).

**Sur le nouvel ordinateur — importer :**
1. Ouvrir [https://taekdhub.vercel.app](https://taekdhub.vercel.app) (aucune installation nécessaire — c'est un site web ; optionnellement « Installer l'application » depuis le navigateur pour l'avoir comme une app).
2. **Réglages** → **Restaurer** → choisir le fichier `.json`. Par sécurité, l'état actuel de l'appareil est d'abord téléchargé (`taekdhub-sauvegarde-avant-restauration-….json`).
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

Node.js 20+ recommandé (testé avec Node 22 et 24). La version de pnpm est épinglée dans `package.json` (`packageManager`) : pnpm 10 l'utilise directement, pnpm 11 et suivants basculent tout seuls sur elle. Ainsi le PC, Vercel et Claude Code utilisent la même version.

## Lancement local

```bash
pnpm dev
```

App disponible sur `http://localhost:3000`.

Aucune variable d'environnement n'est requise pour utiliser l'app : les données vivent en `localStorage` par défaut.

## Variables d'environnement (optionnel)

Copier `.env.example` vers `.env.local` : chaque variable y est commentée. Les deux premières activent la synchronisation Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

(`NEXT_PUBLIC_SUPABASE_ANON_KEY`, l'ancien nom de la même clé, est aussi accepté.)

Sans ces variables, `lib/supabase/client.ts` désactive proprement le client Supabase et l'app continue de fonctionner en local uniquement (Réglages → Compte l'indique). Voir « Compte et synchronisation » pour la migration SQL à appliquer.

## Build

```bash
pnpm build
```

Génère un build de production : toutes les pages sont prérendues ; seule la route du connecteur MCP (`/api/mcp/[key]`) s'exécute côté serveur. Vérifié avec `tsc --noEmit`, `pnpm test`, `pnpm lint` et `next build` sans erreur.

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
app/(app)/annales         Annales corrigées avec Claude (lues dans Supabase)
app/(app)/programme       Carte du programme MP et rétroplanning
app/(app)/kholle          Mode khôlle : questions de cours tirées au sort
app/(app)/epreuve         Épreuve blanche chronométrée
app/(app)/formulaire      Formulaire en cartes flash
app/(app)/bilan           Bilan imprimable d'une période
app/(app)/anki            Pont Anki : relevés, paquets → chapitres
app/(app)/debrief         Débrief d'une copie, plan d'action
app/api/mcp/[key]         Connecteur MCP : log_exercise, get_progress, get_today
components/               Composants UI et par domaine (work, review, errors, progress, history, hub, ui)
lib/                      Logique métier : storage (localStorage), planning, échéances, suivi du temps, notes, carnets, supabase/
lib/next-move/            Moteur Next Move (recommandation explicable) et son historique
lib/exam-prep.ts          « Prêt pour le DS ? » : programme d'une épreuve lu à travers la mémoire (FSRS)
components/exam/          Panneau « Prêt pour le DS ? » (Aperçu de la matière, Échéances)
lib/sync/                 Synchronisation compte ↔ appareil (moteur pur + adaptateur Supabase)
components/account/       Compte (Réglages), fournisseur de session, décision du premier login
supabase/migrations/      0008 : collections `attempts` et `ankiSnapshots`, colonne `exercise_logs.aide`. 0007 : `exercise_logs` rattachée à son élève + RLS. 0006 : table `user_collections` + RLS (synchronisation). 0001–0005 : schéma historique de l'ancienne banque, non utilisé
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
