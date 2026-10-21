# Carnet de bord TaekdHub

> Lu en premier à chaque session, avec `git status`. Si ce carnet et le dépôt divergent,
> le signaler et se fier au dépôt. Dernière mise à jour : 2026-10-21, commit de code `a2387b8`.
> Les PR #28 à #32 sont FUSIONNÉES dans `main` (PR #32 : merge `718084b`, production Vercel « Ready ») .
> Branche de travail actuelle : `claude/exciting-franklin-hiekk8`.

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
- Programme de révision (`lib/revision-program.ts`, `/revision`) : une VUE sur Next Move et le plan du jour,
  pas un moteur. Chaque élément dit quoi, pourquoi maintenant (palier + raisons chiffrées du moteur), combien
  (durée gardée, réduite le cas échéant), fiabilité et par où commencer ; ce qui ne tient pas est reporté à
  demain automatiquement. Fiabilité : « fiable » = fait enregistré (échéance datée, cartes dues, exercice raté,
  constat du diagnostic établi et récent) ; « à confirmer » = signal du diagnostic ou constat de plus de 21 jours,
  probabilité d'oubli sur moins de 3 rappels, échéance sans date. Notes sur les données au-dessus du
  programme : aucune séance depuis 3 jours, synchronisation en échec, annales illisibles, relevé Anki ancien,
  mémoire vide. « Commencer » écrit dans l'historique de Next Move comme la carte de l'accueil.
- Fiches d'exercice (`lib/exercise-sheets.ts`, `/entrainement`) : matière, chapitre du programme, compétence,
  difficulté, origine `ia` (original, sans source) ou `externe` (source obligatoire, lien http(s) seulement).
  L'énoncé vient d'abord ; indices un à un, correction après confirmation ; l'aide enregistrée est celle
  réellement ouverte et ne peut pas être déclarée plus légère (sinon « sans aide » prouverait ce qu'il ne prouve
  pas). Lire la correction APRÈS « J'ai fini » ne change pas l'aide. Fiches stockées sur l'appareil
  (`prepahub:exercise-sheets`, hors de `STORAGE_KEYS` : aucune collection synchronisée, aucune migration) et
  incluses dans la sauvegarde exportée ; les tentatives (`fiche:<id>`) se synchronisent.
- La suite d'une séance (`lib/follow-up.ts`, carte « Et maintenant ? » après le bilan du chrono et après un essai
  sur une fiche) : UN choix par défaut + sa raison + UNE autre idée (« Remplacer »), jamais une liste. Règles :
  temps restant nul ⇒ « assez pour aujourd'hui » ; réussi sans aide ⇒ on monte si `levelToRequest` le justifie ;
  réussi avec aide ou partiel ⇒ un autre exercice du même niveau ; échec ⇒ la notion d'abord si la cause est le
  cours, sinon un cran en dessous ; aucun exercice noté ⇒ un exercice pour mettre la notion à l'épreuve ; rien ne
  dit sur quoi l'élève a travaillé ⇒ le programme du jour, et on le dit. Le chapitre vient, dans l'ordre : du dernier
  exercice noté, de la recommandation commencée, du chapitre choisi au chrono, du travail planifié. L'exercice vient :
  d'une fiche de l'élève (jamais tentée d'abord), d'une annale à refaire, sinon d'un original à générer par IA
  (demande prête). Aucun catalogue de ressources externes vérifiées n'existe : aucun lien n'est inventé, une
  ressource externe passe par une fiche qui garde source et lien. Énoncé, indices, correction : jamais dans la carte.
- Évitement : repousser ou bloquer n'est ni une faute ni un abandon. Première étape de 5 à 10 minutes sans rien à
  résoudre (`lib/small-step.ts`) : carte de suite, tâche proposée 3 fois sans suite (le moteur la rétrograde 72 h :
  elle reste au programme avec un début plus petit), tâche mise de côté (« Pas maintenant » la retire du plan 24 h :
  elle est reportée à demain avec un début plus petit), lecteur d'exercice (« Je ne sais pas par où commencer »,
  qui ne révèle rien et ne compte pas comme une aide). Trois taps « terminé / partiel / j'ai bloqué » quand aucun
  exercice n'est noté ; après un rappel de cours, ils notent aussi le rappel dans Ma mémoire (Bien / Dur / Oublié).
- COÛT IA ZÉRO (décision de l'élève, 2026-10-21) : l'objectif est une ouverture publique, mais l'élève ne dépense rien en IA et il est
  le seul à disposer de son compte Claude : aucune fonction publique ne peut dépendre de celui-ci, ni être en libre service. Conséquences :
  (1) le produit public = les moteurs déterministes, sans appel à un modèle ; (2) pas de route serveur qui appelle une API de modèle ;
  (3) l'IA reste FACULTATIVE et au compte de chacun : demandes prêtes à copier vers l'assistant de l'élève (déjà en place), ou son propre
  connecteur MCP (demande un secret par compte : migration, accord requis) ; (4) le contenu qui exigerait un modèle (exercices originaux) se
  produit HORS LIGNE, une fois, par l'élève, puis se livre comme contenu statique relu : un coût unique, pas un coût par utilisateur
  (droits et qualité à vérifier). Le connecteur de Claude et Hermes restent des accès personnels de l'élève.
- NIVEAU DE L'ÉLÈVE (2026-10-21) : il est en PREMIÈRE année (sup), pas en MP2. Ne jamais supposer le programme de deuxième année : séries entières,
  séries de fonctions, intégrales à paramètre, convergence dominée, intégrales généralisées, probabilités (MP), réduction approfondie… Les sources
  « MP » (banque d'oraux CCINP, Mines, Centrale) ne se prennent qu'exercice par exercice, après vérification des outils requis. Demander l'avancement
  du cours AVANT de choisir une source ; prévoir des parties facultatives pour ce qui n'est pas sûr. (Il a déjà une partie « séries numériques » : à
  confirmer chapitre par chapitre.)
- Les docs `AUDIT.md` et `ROADMAP.md` sont partiellement périmées : se fier au code.

## État actuel
(Mis à jour le 2026-10-21.) **Production** : Vercel, projet `taekdhub` (le projet `taekdhub-vcrx` semble un doublon, inférence non vérifiée), commit `718084b` = merge de la PR #32
(« Ready »). Elle contient : palette Minuit et thème sombre par défaut, onglet Exercices de `/progress`, suppression de compte, page de confidentialité, capture rapide `POST /api/capture`.
**Branche de travail** `claude/exciting-franklin-hiekk8` : 12 commits d'avance sur `main` (fusion à blanc propre, 17 fichiers, +709 / −17), PAS en production : « Mes données », « As-tu avancé ? » (Anki),
correctif de contraste des cartes, correctif du moteur sur le sommeil, rattachement « asymptotique », feuille d'exercices, carnet. PR et fusion : accord explicite requis.
Variables Vercel créées par l'élève : `CAPTURE_TOKEN`, `MCP_USER_ID` (Production). Un seul compte Supabase ; RLS active sur les 3 tables ; inscriptions et protection des mots de passe compromis : réglages de l'élève,
non vérifiés. Hermes : branché en lecture seule (voir ci-dessous), jamais encore validé par un vrai appel après la mission 4.
Les anciens paragraphes sur la PR #28 et les deux Previews ont été retirés : la PR #28 est fusionnée depuis le 2026-10-16.

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
| 4 | Fraîcheur honnête pour Hermes : plan provisoire, séances anciennes, liste d'échéances non concluante. Commit `7209ad4` |
| 5 | Programme de révision (`/revision`) et point d'entrée vers l'entraînement (`/entrainement`). Commit `e72480f` |
| 6 | La suite après chaque séance (`lib/follow-up.ts`), exercice prêt, premier pas plus petit, audit Anki. Commit `0401692` |
| 7 | Accueil « tableau de bord » sur grand écran (maquette de l'élève) : barre latérale, salutation, horloge, semaine, progression du jour, citation. Commit `41fb603` |
| 7b | Accueil mobile. Commit `22b7729` |
| 8 | Sobriété visuelle (graphite). Commit `49d8961` ; jugée terne, remplacée par la mission 9 |
| 9 | « Minuit » (indigo/cyan, sombre par défaut) et onglet Exercices de `/progress` |
| 10 | Suppression de compte, confidentialité, consentement (sans migration) |
| 11 | Capture rapide depuis l'Apple Watch (`/api/capture`, écriture seule). Commit `b091460` |
| 12 | « Mes données » (séances, exercices, relevé Anki) dans Réglages. Commit `7213c06` |
| 13 | Anki : cartes apprises et « as-tu avancé ? ». Commit `f79dd9b` |
| 14 | Contraste des cartes `tone-brand` et sommeil du check-in. Commits `a10b3f6`, `18b38b9` |
| 15 | Paquet de ChatGPT audité, feuille d'exercices (v3, 1re année), bilan des copies |
| 16 | `exercise_logs` lisible (401 non reproduit), rattachement « asymptotique ». Commit `a2387b8` |

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
- **Mission 4 — chemin des données et fraîcheur.** Établi depuis le code : toute écriture locale d'une
  collection la marque « à envoyer » (`SyncEngine.markDirty`), un envoi part après un court délai, puis
  à chaque cycle (2 min, retour sur l'onglet, retour du réseau) ; un envoi est conditionnel à la
  révision serveur (refus puis fusion, jamais d'écrasement) ; `updated_at` est posé par un déclencheur
  serveur à chaque écriture. Aucun défaut de synchronisation n'est démontrable depuis le code : rien
  n'a été corrigé de ce côté. Constaté en base (noms, révisions, dates seulement, jamais le contenu) :
  `reviewItems` et `nextMoves` écrits le 14 octobre à 20:09 UTC (l'appli venait d'être ouverte),
  `sessions` le 11 octobre à 20:14 UTC, aucune ligne `workItems` (aucune échéance jamais envoyée, ou
  jamais créée : indécidable sans l'appareil), aucune ligne `attempts`, `errors`, `dayPlans`. La
  contrainte `user_collections_known` accepte bien `attempts` et `ankiSnapshots` (migration 0008
  appliquée). Défaut démontré : `donnees_anciennes` prenait la collection de travail la plus récente,
  donc des cartes écrites aujourd'hui masquaient des séances vieilles de trois jours alors que les
  séances fixent le « temps restant ». Corrigé par `7209ad4` : `seances_anciennes`, `echeances_synchronisees`,
  `consigne` (phrase fixe), `agenda_du_jour.provisoire`, `liste_concluante`. Limite assumée : l'absence
  d'écriture ne distingue pas une synchro défaillante d'une absence d'activité (il n'y a pas de
  battement de cœur serveur ; en ajouter un exigerait une écriture ou une collection, hors périmètre).
  Non vérifié : ce que l'appareil de l'élève contient, et si les séances du 12 au 14 octobre existent.
- Outil Vercel de la session : les appels avec `teamId`/`slug` renvoient 403, sans ces paramètres ils
  passent ; les journaux d'exécution restent illisibles.
- Reste à faire : vérifier `get_today` et `list_echeances` par un vrai appel d'Hermes sur le Preview
  reconstruit ; décider du redéploiement de la Production ; à la fin des essais, révoquer le
  contournement et le jeton.

Expérimentation de 14 jours : à mener par l'élève (avis O / T+ / T- / NP chaque soir, notés
à la main). Date de début : à renseigner. Phase 2 non lancée.

**Mission 5 (2026-10-14).** Audit : tout existait en pièces (Next Move = une action avec son pourquoi ; liste du
jour = toutes les actions sans pourquoi ni lien ; bannière de cartes ; carte mémoire ; échéances ; « refaire » =
copier une demande vers Claude puis revenir noter). Livré : `/revision` (lien « Voir le programme de révision »
dans « Le reste de ta journée »), `/entrainement`, sauvegarde étendue (champ optionnel `exerciseSheets`,
revalidé à la restauration). Vérifié : 85 fichiers de tests, 1380 réussis + 1 échec attendu antérieur, `tsc`,
lint, build ; parcours réel sous Chromium (390 px) sur la version construite avec des données de test :
programme, validation du formulaire (source obligatoire, lien `javascript:` refusé), énoncé avant indices et
correction, aide « correction » imposée après ouverture, tentative et séance écrites, retour dans la liste.
Non vérifié : sur un vrai compte (annales, synchronisation), sur l'appareil de l'élève, et en usage prolongé.

**Mission 6 (2026-10-14) — audit du parcours séance → suite, et d'Anki.**
- Ce que la séance enregistre : sujet, début, fin, durée, travail planifié, chapitre de MÉMOIRE (facultatif, choisi au
  chrono) ; `note`, `result` et `hints_used` restent à `null` (hérités). Le résultat n'est pas dans la séance : il est
  dans les TENTATIVES du bilan (résultat, aide, cause, chapitre, niveau → `attempts`, synchronisées), lues par
  « À refaire », le diagnostic et Next Move. Avant : après le bilan, un simple message ; une séance de cours ou de
  fiches (« Rien à noter ») ne laissait rien, et un rappel de cours n'entrait pas dans Ma mémoire sans resaisie.
- Chapitres : `WorkSession.chapter_id` = identifiant de chapitre de MÉMOIRE, pas du programme. L'essai sur fiche
  (mission 5) y écrivait un chapitre du programme : corrigé (plus de `chapter_id` pour ces séances).
- Anki (audit du code, rien de modifié, aucune carte ni réglage touchés ; non vérifié sur un vrai Anki) :
  lecture seule via AnkiConnect (`deckNames`, `findCards`, `getNumCardsReviewedByDay`) ; import MANUEL (bouton de
  `/anki`, aucune fréquence automatique), seulement sur ordinateur (AnkiConnect n'existe pas sur iPhone ; saisie
  manuelle des cartes dues ou fichier d'échange sinon) ; un relevé par jour et par source, 14 jours gardés,
  collection `ankiSnapshots` synchronisée. Par paquet : cartes totales, dues, révisées sur 30 jours, ratées sur
  30 jours, mûres, « sangsues ». Association paquet → chapitre prudente (manuelle, nom exact, héritée ; un
  rapprochement partiel est seulement PROPOSÉ à l'élève). Fraîcheur : cartes dues utilisées par le moteur jusqu'à
  24 h, tendances jusqu'à 7 jours. Limite : le relevé ne bouge pas quand l'élève fait ses cartes ; une séance Anki
  n'est donc pas vue avant le prochain import. Réponse : l'élément Anki du programme devient « à confirmer » au-delà
  de 6 h (« tu as pu faire des cartes depuis »), la suite de séance ne repropose pas Anki juste après une séance Anki
  et dit de mettre le relevé à jour. TaekdHub ne duplique pas la répétition espacée d'Anki (aucune carte créée).
- Vérifié : 86 fichiers de tests, 1404 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; parcours réel sous
  Chromium (390 px, horloge simulée) : chrono 6 min → bilan « rien à noter » → carte de suite → tap « partiel » qui
  note « Dur » dans Ma mémoire → proposition de fiche externe avec source et lien → « Remplacer » → début plus petit →
  lecteur → « Je ne sais pas par où commencer » (énoncé, indices, correction restent cachés dans la carte).
  Non vérifié : sur un vrai compte, sur l'appareil de l'élève, ni l'effet réel sur l'évitement (usage à observer).

**Mission 7 (2026-10-19) — maquette de l'accueil.** Présentation seulement, aucun moteur ni donnée touchés. Dès `lg` : barre
latérale fixe (`components/app-nav.tsx`, largeur `--sidebar-w`) qui remplace la barre haute ; accueil avec salutation (« Bonsoir » dès
18 h), horloge, bandeau de la semaine, « Progression du jour » (anneau = temps / objectif, répartition par matière) et citation
(`components/home/desktop-header.tsx`). Next Move tient lieu de « Prochaine séance », `DayAgendaCard` de « Ma journée ». Téléphone
inchangé (barre d'onglets, héros « Revolut clair »). Non repris : recherche ⌘K, cloche, bascule de mode sombre (fonctions à construire ;
le thème reste dans Réglages), semaine glissante de 9 jours (la semaine lundi → dimanche est affichée). Les liens de la barre pointent
vers `/programme`, `/entrainement`, `/preparation`, `/revision`, `/anki`, `/echeances`, `/progress`. Vérifié : 86 fichiers de tests,
1404 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; capture réelle sous Chromium à 1536 px. Non vérifié : sur l'appareil de
l'élève, en mode sombre, entre 1024 et 1280 px.

**Mission 7b (2026-10-19) — accueil mobile.** Salutation courte, bandeau de la semaine, Next Move, reste de la journée, puis « Progression du jour » (remplace `TodayHero`, désormais sans appelant dans `components/home/hero.tsx`). Horloge, date longue et citation restent à partir de `lg`. Barre d'onglets du bas inchangée (4 destinations ; Révisions, Anki, Échéances restent atteignables par les cartes de l'accueil). Commit `22b7729`. Vérifié : 86 fichiers de tests, 1404 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; capture réelle à 390 px. Non vérifié : sur iPhone, en mode sombre.

**Mission 8 (2026-10-19) — sobriété visuelle (demande de l'élève : « sobre, efficace, pas chargé, couleurs laides »).** Décidé avec lui :
fond blanc cassé + noir, sans accent coloré ; accueil, vitrine et couleurs de toutes les pages. Il veut AUSSI garder le liquid glass, des
animations et des images : conservés (verre, `reveal`, `floaty`), mais neutres. Palette `aurora` (id conservé, aucune migration) devient
« Sobre » (graphite, `lib/theme.ts`) ; fond `#faf9f6`, ombres neutres, halos à 6–10 %. Les autres palettes colorées restent choisissables
dans Réglages. Accueil : Next Move (une seule raison visible, le reste dans « Détails », dessin de la matière en filigrane), le reste de
la journée, progression du jour, échéances, check-in du soir (conditionnel), rappel de sauvegarde. RETIRÉS de l'accueil, toujours
disponibles sur leurs pages : gestes rapides, minimum du soir, cartes par matière, « Noter du temps », « À reprendre », courbe, bannière
de révisions, « À ne pas oublier », plans « si… alors… », série et semaine, citation, salutation d'encouragement. Composants conservés
mais sans appelant sur l'accueil (`components/home/cards.tsx` en partie, `hero.tsx`, `evening-card.tsx`, `intentions-card.tsx`).
Attention : « Noter du temps » n'est plus sur l'accueil (reste via le chrono). Vérifié : 86 fichiers de tests, 1404 réussis + 1 échec
attendu antérieur, `tsc`, lint, build ; captures à 1536 px (accueil, vitrine). Non vérifié : mobile après cette mission, mode sombre,
iPhone. Commit `49d8961`.

**Mission 9 (2026-10-21) — « Minuit » et graphiques d'exercices (demande de l'élève : version premium, sombre, plus de couleurs ;
la sobriété de la mission 8 est jugée terne).** Palette `aurora` (id inchangé) devient « Minuit » : indigo `#818cf8` → cyan `#22d3ee`,
boutons et cartes en indigo/violet/cyan profonds ; thème SOMBRE par défaut (`DEFAULT_THEME_MODE`, script anti-flash), fond bleu-nuit
`8 9 20`, tuiles `19 21 38`. Les paliers de gris par matière sont CONSERVÉS (`lib/subject-colors.test.ts` : l'élève avait rejeté les
couleurs par matière avec la palette « Nuit ») : à rouvrir seulement sur demande. Nouvel onglet « Exercices » de `/progress`
(`components/progress/exercise-results.tsx`, `lib/analytics/attempt-trend.ts`) : tentatives des 6 dernières semaines empilées par résultat,
et part réussie SANS aide par semaine (`null`, donc courbe interrompue, sous 3 tentatives) ; aucun lien de cause affirmé. Aucun moteur,
collection ni route modifié ; Hermes inchangé. Constat : `/progress` avait déjà des graphiques du temps (barres, courbes, matières) ; seul le
côté exercices n'en avait pas. Vérifié : 87 fichiers de tests, 1409 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; captures
Chromium à 1280 px (onglet Exercices, avec tentatives de test ; accueil sombre). Vérifié ensuite par captures : mobile 390 px (sombre) et mode clair
(1280 px, états vides de l'onglet Exercices). Non vérifié : iPhone réel, pages autres que l'écran de bienvenue et `/progress`. ATTENTION : un appareil qui a déjà enregistré `themeMode: "light"` reste en clair
(Réglages > apparence). L'historique des rejets (Papier, Nuit, Apple, Revolut sombre « le noir ça rend pas envie », Revolut clair, Sobre)
est dans `lib/theme.ts` : l'élève a choisi le sombre cette fois, à confirmer à l'usage. Hermes (agent qui prompte) : reporté, non commencé.

**Mission 10 (2026-10-21) — prêt pour plusieurs comptes (l'objectif est une ouverture publique ; pour l'instant le site reste privé).**
Audit : RLS présente sur toutes les tables utilisateur ; toutes reliées à `auth.users` en `on delete cascade`. Livré SANS migration :
`POST /api/account/delete` (`app/api/account/delete/route.ts` : jeton de session vérifié, supprime seulement le compte du jeton,
confirmation écrite « SUPPRIMER » exigée, 503 si le serveur n'est pas configuré) ; dans Réglages > Compte, « Supprimer mon compte » ;
case de consentement à la création d'un compte ; page `/confidentialite` (PROJET : à faire relire, éditeur, contact et durées légales
à compléter ; l'engagement « aucune revente » est à confirmer). Les données de l'appareil ne sont pas touchées par la suppression
(« Déconnecter et effacer cet appareil » reste à part). Vérifié : 88 fichiers de tests, 1418 réussis + 1 échec attendu antérieur, `tsc`,
lint, build ; capture de `/confidentialite`. Non vérifié : suppression réelle sur un compte (aucun appel fait à la vraie base), le formulaire
de compte (Supabase non configuré sur la session). NON FAIT, décision requise : (1) connecteur MCP de Claude mono-élève (`ownerId()` : un seul
compte ou `MCP_USER_ID`) ; plusieurs comptes demandent un secret par compte, donc une table et une migration ; (2) l'export serveur
(l'export actuel est la sauvegarde locale, identique aux données synchronisées) ; (3) synchronisation des fiches d'exercice (collection,
migration) ; (4) droits des annales ; (5) IA payante côté serveur (contredit « aucun agent LLM dans le dépôt », coût par utilisateur).

**Mission 11 (2026-10-21) — capture rapide depuis l'Apple Watch (accord de l'élève ; usage PERSONNEL : sécuriser son compte et le rendre
100 % effectif).** Audit de la vraie base (lecture seule) : un compte, RLS active sur les 3 tables (`exercise_logs`, `push_subscriptions`,
`user_collections`), un seul avertissement Supabase (protection contre les mots de passe compromis désactivée : réglage de l'élève) ; la
production est à jour (PR #31, déduction : non testée en vrai). Constat qui motive la mission : `sessions` écrites jusqu'au 16 octobre,
`attempts`, `errors` et `dayPlans` VIDES (aucun résultat d'exercice jamais reçu), `ankiSnapshots` un seul relevé (4 octobre) : l'évaluation
n'a pas de données. Livré : `POST /api/capture` (`app/api/capture/route.ts`, `lib/capture-handler.ts`, `lib/capture.ts`), ÉCRITURE SEULE :
ajoute une séance (saisie rapide) ou une tentative, ne lit rien, ne modifie ni ne supprime rien. Jeton `CAPTURE_TOKEN` dans
`Authorization: Bearer` (jamais l'URL ; ≥ 32 caractères), distinct de `MCP_SECRET` et `MCP_HERMES_TOKEN` ; fermé aussi sans `MCP_USER_ID`
(ici on ne devine pas le compte). Listes fermées, durées 1–240 min, aucun texte libre, corps ≤ 2 Ko ; idempotent par `id` de requête
(relance du raccourci sans doublon) ; même règle de révision que les appareils (aucun écrasement). Réponse : `{ enregistre, doublon }`.
Mode d'emploi du raccourci dans Réglages (`components/capture-guide.tsx`). Vérifié : 89 fichiers de tests, 1448 réussis + 1 échec attendu
antérieur, `tsc`, lint, build ; 30 tests de la capture, deux mutations volontaires (authentification retirée, idempotence cassée) détectées ;
appels HTTP réels (sans jeton, faux jeton, jeton en URL : 401 ; valeur hors liste : 400 ; base injoignable : 500 sans fuite ; GET : 405).
NON vérifié : un appel réel vers la vraie base, le raccourci sur une vraie Apple Watch. Reste À FAIRE PAR L'ÉLÈVE (Vercel, jamais par
Claude) : créer `CAPTURE_TOKEN` et `MCP_USER_ID`, redéployer, fabriquer le raccourci ; désactiver les inscriptions Supabase (ou fixer
`MCP_USER_ID`, ce qui sert aussi le connecteur de Claude) ; activer la protection des mots de passe compromis. Reste à faire côté
code : Hermes (valider un vrai appel `get_today`, révoquer le jeton et le contournement de test), rappel d'import Anki, écran « état de
mes données ». Limites assumées : pas de limitation de débit ; un jeton volé permettrait d'ajouter des lignes parasites (supprimables
dans l'application), pas de lire quoi que ce soit.

**Mission 12 (2026-10-21) — « Mes données » (usage personnel).** Section dans Réglages (sous l'apparence), `lib/data-health.ts` +
`components/data-health.tsx` : trois lignes (séances, résultats d'exercice, relevé Anki), chacune un FAIT (date) et un GESTE (lien vers le
chrono, les exercices, Anki). Seuils écrits : séance « ancienne » au-delà de 2 jours, exercice au-delà de 7 jours, Anki au-delà de 24 h (le
seuil du moteur, `ANKI_DUE_STALE_HOURS`) ; « vide » sans aucune donnée. Aucun score. Vérifié : 90 fichiers de tests, 1454 réussis + 1 échec
attendu antérieur, `tsc`, lint, build ; capture réelle (séance de test vieille de 5 jours). PR #32 : contrôles GitHub verts, mergeable
propre ; l'élève a créé `CAPTURE_TOKEN` et `MCP_USER_ID` (Production) ; PR #32 FUSIONNÉE le 2026-10-21 sur accord explicite de l'élève (« fusionne toi ») après contrôles verts sur la dernière tête ; déploiement de production `Ready` (commit `718084b`), appels réels de la route non testés. Pas fait : appel réel
d'Hermes (hors de portée de Claude : l'agent est chez l'élève), révocation du jeton et du contournement de test (à faire par l'élève),
rappel d'import Anki au démarrage (AnkiConnect n'existe que sur ordinateur, Anki ouvert : rien à automatiser côté navigateur sans
l'élève présent).

**Mission 13 (2026-10-21) — Anki : cartes apprises et « as-tu avancé ? » (demande de l'élève : qu'Anki soit connecté pour que TaekdHub voie
quelles cartes sont apprises et dise si l'élève a bien avancé ; modifier des cartes Anki viendra APRÈS, non commencé).** Le relevé
AnkiConnect (lecture seule, aucune écriture) ajoute par paquet, en champs FACULTATIFS de `AnkiDeckStat` (donc aucune migration, la collection
`ankiSnapshots` existe) : `reviewed7`, `failed7`, `introduced7` (cartes nouvelles vues = apprises), `reviewedToday`, `introducedToday`. Absents
d'un relevé antérieur ou d'un Anki sans la requête `introduced:` : jamais remplacés par 0. `lib/anki-progress.ts` : par paquet un mot
(solide ≥ 80 % de cartes sans « À revoir », correct, fragile < 70 %, « trop peu pour juger » sous 10 cartes révisées, « rien cette semaine »),
totaux, variation des cartes mûres (intervalle ≥ 21 jours) sur les paquets communs au plus ancien relevé d'un autre jour, une phrase qui cite
les chiffres, drapeau « relevé de plus de 24 h ». SEUILS PROVISOIRES, dits à l'écran ; ce n'est pas la rétention d'Anki (part des cartes
révisées sans « À revoir ») ; AUCUNE note globale. Section « As-tu avancé ? » en tête de `/anki`. Vérifié : 91 fichiers de tests, 1468
réussis + 1 échec attendu antérieur, `tsc`, lint, build ; mutation sur la borne des 80 % détectée ; capture réelle avec un faux relevé. NON vérifié :
un vrai Anki (la requête `introduced:` et `rated:7:1` n'ont été testées que contre un Anki simulé), l'effet sur l'appareil de l'élève. Limite
assumée : le relevé reste manuel et sur ordinateur (Anki ouvert) ; il ne bouge pas quand l'élève fait ses cartes.

**Mission 14 (2026-10-21) — revue du thème sombre et premier défaut du moteur (mandat de l'élève : « fais tout ce que toi ou ChatGPT peut gérer »).**
(a) Revue visuelle de 10 pages en sombre, bureau et mobile (captures) : une seule anomalie réelle, MESURÉE sur les pixels : la carte « Maintenant »
(et toutes les `tone-brand` : bilan d'historique, échéances, briefing, erreurs) portait du texte blanc sur le dégradé CLAIR indigo/cyan, contraste
1,9 à 2,9:1 (défaut introduit par la palette Minuit). Corrigé : `.tone-brand` reprend les teintes profondes des boutons (testées ≥ 4,5:1), 2e teinte de
Minuit en bleu-vert profond ; re-mesuré 5 à 7,8:1 (hors reflet animé) ; test de garde dans `lib/theme.test.ts`. Commit `a10b3f6`.
(b) Moteur (`lib/next-move/engine.ts#latestCheckin`) : `sleepHours` d'un check-in daté J décrit la nuit PRÉCÉDANT J ; le matin, on reprenait celui
d'HIER, donc le sommeil de l'avant-veille. Désormais le check-in d'hier ne garde que son énergie ; le sommeil et « fatigue forte » (énergie ≤ 2 ET
sommeil < 6 h) ne viennent que du check-in d'AUJOURD'HUI. 4 tests, mutation vérifiée, snapshots inchangés. Commit `18b38b9`. Effet visible : moins de
« séance courte » le matin après un soir de fatigue ; Hermes n'est pas concerné (il ne lit aucun check-in).
NON fait, volontairement (changent le classement des conseils, à décider avec l'élève plutôt qu'à corriger seul) : fatigue définie de 3 façons ;
deux budgets du jour (capacité déclarée / planifiable). Vérifié : 91 fichiers de tests, 1473 réussis + 1 échec attendu antérieur, `tsc`, lint, build.

**Mission 15 (2026-10-21) — environnement de travail : paquet Anki de ChatGPT, feuille d'exercices (mandat de l'élève).**
(a) Audit du `.apkg` de ChatGPT (« Maths MP - Techniques asymptotiques », 130 cartes toutes NOUVELLES, type « Prépa MP v3 - Atomique »,
champs Contexte/Etiquette/Question/Reponse/Complement) : les 130 cartes ont été relues une par une, UNE seule erreur mathématique (carte
`u_{n+1}=sin u_n`, `u_0∈]0,π]` à corriger en `]0,π[`). Défauts de structure : champ de tri (Contexte) à 10 valeurs pour 130 notes ; sous-paquets par
TYPE de carte au lieu de par chapitre (TaekdHub lit les paquets : pas de bilan par chapitre) ; étiquettes qui soufflent la réponse (contre-exemples) ;
6 redondances contre-exemple/piège ; paquets vides. Prompt de correction et prompt « travail autonome sur tout le paquet » donnés à l'élève ;
ChatGPT produit, Claude VÉRIFIE (rapport + contrôle + .apkg à renvoyer), ChatGPT ne travaille que sur les maths. Avertissements donnés : sauvegarder la
collection Anki avant d'importer, GUID stables, 30 nouvelles cartes par jour. Gemini = tuteur (indices un à un, correction seulement à la demande,
fin d'exercice par « Matière · résultat · aide · cause »), prompt fourni.
(b) Feuille `docs/exercices/techniques-asymptotiques-feuille-1.pdf` (+ `.tex`) : 10 exercices RÉELS, sans indice ni corrigé, VERSION 3 le même jour après deux remarques de
l'élève (« pas encore fait séries entières ni séries de fonctions », puis « c'est la 1re année »). V1 contenait CCINP 51 et un extrait Mines 2019 (séries entières) et CCINP 50
(intégrale à paramètre) ; V2 supposait encore les séries numériques et les intégrales généralisées (programme de 2e année) et un « niveau Mines ». V3 (actuelle) : cœur sûr en
1re année = A (équivalents/DL : CCINP 1, MPSI Camille Jullian 2023 ex. 4 q. 1-6) + B (CCINP 56, MPSI ex. 11, 5, 15) ≈ 2 h 15 ; C facultatif (MPSI ex. 2) ; D « séries numériques, seulement si
déjà vues » (CCINP 46, 7, 5). Énoncés relus sur les pages en image et vérifiés numériquement (identité de l'ex. 11, DA de l'ex. 5, équation de l'ex. 15) ; « indications » CCINP retirées ;
aucun énoncé réécrit ; tableau de suivi « résultat · aide · cause ». LaTeX installé dans la session (texlive, apt). Limites : ni suites récurrentes ni DA à plusieurs termes d'ordre élevé ; l'historique
`exercise_logs` ne contient que 4 lignes (réduction, 1er octobre) : pas de ciblage par les données. Non fait : import de fiches JSON dans TaekdHub (fonction à construire, sans migration).

**Bilan de la feuille 1 (2026-10-21, copies manuscrites de l'élève, 7 exercices).** Enregistré dans `exercise_logs` (7 lignes, chapitre « analyse asymptotique », 6 « partiel » + 1 « échec »,
aide « sans », temps réel inconnu). Constats (corrigés par calcul numérique : H(1,001) = 0,694 donc lim H = ln 2 et non 1/2 ; H'(x) = (x-1)/ln x ; α = 3/8 et non -1/4) :
ce n'est PAS un problème de calcul ni d'outils (DL, équivalents, découpage Re/Im, monotonie par f_{n+1} = f_n + x + 1 : bien menés), mais de JUSTIFICATION et de rigueur : (1) négation de quantificateurs
(Ex. 1) ; (2) Chasles avec une borne où l'intégrande n'existe pas (Ex. 5) ; (3) « ∼ » utilisé comme une égalité (différence d'équivalents, Ex. 3 ; équivalent d'une somme, Ex. 2) ; (4) ordre de troncature quand on
multiplie par n (Ex. 4) ; (5) passage à la limite écrit sans limite (Ex. 7) ; (6) ln n = o(n) insuffisant (il faut o(n^ε)) ; (7) étourderies de recopie (t+1 pour t-1) et coefficient du DL de √(1+u). Points forts : il
repère lui-même ses zones d'ombre (annotations rouges toutes fondées), propose des constructions propres. À faire ensuite : reprendre les questions faussées, sans indice d'abord ; feuille 2 centrée sur
la rédaction (hypothèses, rang, ordre des DL) ; cartes Anki « pièges de rédaction ». Les « indications » CCINP retirées de la feuille ont privé l'élève de l'outil série-intégrale (Ex. 3, 1b) : c'est un manque d'outil, pas de travail.

**Mission 16 (2026-10-21) — la lecture des exercices corrigés par Claude, et le rattachement au programme.** (a) Anomalie « `exercise_logs` : 401 depuis le Preview » : NON REPRODUITE.
Droits vérifiés (SELECT pour `authenticated`, tout pour `service_role`, politiques « propriétaire » en lecture et suppression) ; journaux de l'API : la lecture `/rest/v1/exercise_logs` répond 200 ;
colonne `aide` présente. À considérer comme résolue jusqu'à nouvelle observation. Rappel : ces lignes ne sont écrites que par Claude (skill `exo-annales-mp`, `execute_sql` : pas de route d'écriture dans l'application),
et ne sont visibles du navigateur que si `user_id` est renseigné (les 7 lignes du 21 octobre le sont). (b) Défaut corrigé : le chapitre d'une annale ou d'un paquet Anki est rattaché au programme par mots-clés
(`bestProgrammeMatch`) ; « Techniques asymptotiques » (nom du paquet de ChatGPT et de la feuille) ne correspondait à rien (`null`), alors que « analyse asymptotique » donne `m1-asymptotique`. Mot-clé « asymptotique »
ajouté au chapitre, tests (ne vole pas d'autre chapitre ; « Séries entières » et « Séries numériques » inchangés). Vérifié : 91 fichiers de tests, 1473 réussis + 1 échec attendu antérieur, `tsc`, lint.
NON fait : PR des missions 13 à 16 (la branche a 7 commits de plus que `main` ; PR et fusion demandent l'accord explicite de l'élève).

**Mission 17 (2026-10-21) — le calendrier de fin de vacances, relié à l'agenda Apple.** Code `4b03413` (+ `3da002c`, majuscule des jours).
(a) Programme statique `lib/holiday-program.ts` (22 octobre → 1er novembre : 17 séances, 21 h 15, 9 jours de travail, 2 jours de repos complet, jamais plus de 3 h 30 par jour ; problème de 2 h en conditions le 29, correction avec Claude le 30, bilan le 31) :
des DONNÉES, pas une collection, donc aucune migration. (b) `lib/ics.ts` : fichier iCalendar (heures en UTC, UID stable, alarme 15 min avant, pliage à 75 octets) ; le passage à l'heure d'hiver du 25 octobre
(UTC+2 → UTC+1) est testé (une séance à 09:30 est à 07:30Z avant, 08:30Z après). (c) Flux d'abonnement `GET /api/calendar/<CALENDAR_TOKEN>.ics` (`lib/calendar-feed.ts`) : FERMÉ tant que `CALENDAR_TOKEN` (≥ 32 caractères) n'est pas posé
dans Vercel, lecture seule, sens unique TaekdHub → Calendrier Apple. (d) Pages `/calendrier` et `/seance/[id]` (étapes, fiche PDF, grille de rédaction, chrono, Anki), entrée « Calendrier » dans la barre latérale,
carte « prochaine séance » sur l'accueil (si aujourd'hui ou demain). (e) Six fiches + une grille de rédaction (10 règles tirées de ses propres erreurs) en PDF dans `public/exercices/`, sources LaTeX et `build.py` dans `docs/exercices/fiches/` ;
énoncés réels (feuille MPSI Camille Jullian, banque CCINP), sans indice ni corrigé. Vérifié : 94 fichiers de tests, 1512 réussis + 1 échec attendu antérieur, `tsc`, lint, build, captures bureau et mobile, carte d'accueil
(contournement du premier lancement : `onboardingCompletedAt` dans `prepahub:preferences`, et du point du jour : `prepahub:briefing:seen`). Fichier importable à la main : `taekdhub-fin-de-vacances.ics` (19 événements, 17 alarmes).
NON fait : PR et fusion (accord explicite de l'élève requis) ; sans déploiement, les liens des événements (`/seance/<id>`, `/exercices/*.pdf`) n'existent pas en production ; `CALENDAR_TOKEN` à créer par l'élève (Vercel, Production), jamais partagé.

**Mission 18 (2026-10-21) — le programme refait sur le socle de l'année, et les échéances.** Code `1e4d8dc`.
L'élève (MP, groupe G9) a corrigé le cadrage : le travail porte sur ce qui a été fait CETTE année (algèbre linéaire, réduction, evn, suites dans les evn, séries ; physique : électrostatique, électronique et filtres, thermodynamique jusqu'au 2e principe pour un système ouvert),
avec anticipation des séries entières et de fonctions, au niveau des TD (Centrale, Mines-Ponts, CCINP) ; les fiches de première année ne servent plus qu'aux points faibles. (a) `lib/holiday-program.ts` : 35 séances sur 11 jours (44 h, jamais plus de 5 h 40 par jour), maths le matin, physique l'après-midi,
DM (maths et physique) en trois séances, DS de français en conditions le 24, DS blanc de physique de 4 h le 29, vocabulaire d'anglais TOUS LES JOURS (partie 10, p. 435-453, test du 5 novembre, avec révisions à J+1 et J+3), un dimanche de repos (25) et un dimanche léger (1er).
Les séances de maths citent les exercices des TD de l'élève ; une séance sans fiche reçoit la sienne LA VEILLE (circuit prévu avec Hermès, pas encore branché). (b) 25 ÉCHÉANCES (`DEADLINES`) : DS, colles G9 (SC6 à SC9), tests de vocabulaire, devoirs du lundi 2 novembre, jusqu'au 25 janvier ;
alarmes à 14, 7, 3 et 1 jour (7, 3 et 1 pour une colle ou un devoir), 9 h pour un événement sur la journée, plus 60 min avant une colle ou un oral ; aucune alarme déjà passée n'est écrite. Plafond voulu par l'élève : pas d'autre notification. (c) Défaut corrigé dans `lib/ics.ts` : le « ; » n'était pas échappé
(`"\;"` en JavaScript vaut « ; ») ; le test passait à tort. (d) Page `/calendrier` : section « Les échéances » avec J-n. Vérifié : 94 fichiers de tests, 1518 réussis + 1 échec attendu antérieur, `tsc`, lint, build, captures, mutation (alarme sans décalage de 9 h : détectée).
HYPOTHÈSES à confirmer : DS de physique du 2 novembre de 4 h (heure inconnue) ; DS de français de 4 h ; programme de la colle de maths du 3 novembre (cahier de prépa) ; SC10 non reprise (colles de maths et de physique à la même heure le mardi 1er décembre : lecture du tableau à vérifier) ; la ligne « Mme Ouhadia » du 5 novembre est l'intervention d'anglais.
NON fait : Apple Rappels (ne lit pas un .ics ; test à faire avec un seul événement), alarmes des calendriers à abonnement non vérifiées sur iPhone, programme dans Supabase (tâche suivante), prompt d'Hermès, cahier de prépa (flux RSS : adresse introuvable par l'élève), PR et fusion (accord explicite requis).

**Mission 18 (suite, 2026-10-21) — code `ce759a1`.** À la demande de l'élève : l'intervention d'anglais du 5 novembre est SUPPRIMÉE du programme (trois séances de préparation et l'échéance) ; un créneau Anki de 30 min est ajouté chaque jour de travail, pendant une pause (12 h 15, ou 13 h 30 les jours de DS de 4 h) — 9 séances, total 46 h 45, jamais plus de 6 h par jour. Le test de vocabulaire du 5 novembre reste. Les séances sont triées par date dans `HOLIDAY_PROGRAM`
(ordre « précédente / suivante » de la page d'une séance). Vérifié : 94 fichiers de tests, 1518 réussis + 1 échec attendu antérieur, `tsc`, lint, build. À FAIRE (accord de l'élève) : cartes Anki de ChatGPT à relire AVANT import (sauvegarde de la collection d'abord) ; PR et fusion ; programme dans Supabase ; prompt d'Hermès.

**Mission 18 (suite 2, 2026-10-21) — code `e00ed53`.** Charge relevée à la demande de l'élève (« 4 h par jour, c'est meh ») : AU MOINS 5 h de maths ou de physique par jour de travail (hors Anki), 2 h le samedi 24 (le matin est pris par le DS de français) et 4 h le samedi 31 ; en plus, de l'anglais « écrit » (24 et 28 octobre), du français-philo (26 et 30) et de l'informatique (27, 29, 31), chacun à préciser par l'élève ; total 61 h 45 sur 51 séances, jusqu'à 7 h 40 le samedi 24 (DS de 4 h compris). Conseil donné et laissé à sa décision : la qualité de ce qui est retenu compte plus que le total ; ajuster dès le troisième jour d'après le constat (Hermès).
Vérifié : 94 fichiers de tests, 1519 réussis + 1 échec attendu antérieur, `tsc`, lint, build. Contenus de français et d'informatique à PRÉCISER (programme du DS de français-philo du 30 novembre, TD d'informatique).

**Mission 19 (2026-10-21, session locale) — relecture des cartes Anki de ChatGPT, contenu `a78e624`.** Relecture une par une des 130 cartes de `chapitre_01.apkg` (v2), comparées à la v1 et vérifiées sous SymPy. La correction `u_0∈]0,π[` est juste. Régression de la v2 : TA-072 et TA-075 ont perdu leur énoncé (l'étiquette vidée le portait). Faux ou trompeur : TA-048 (th), TA-111 (o(ln n) trop faible), TA-126 (ℓ=0 implicite) ; une douzaine de formulations à préciser. Liste dans `docs/anki/prompt-corrections-chatgpt.md` (à donner à ChatGPT, puis Claude contrôle l'`.apkg` renvoyé). Ajout de 14 cartes « pièges de rédaction » (`docs/anki/pieges-redaction.tsv`, import texte, modèle v3, générées par `build_pieges_redaction.py`) tirées des erreurs de la feuille 1. RIEN importé dans Anki ; les 4 294 cartes des chapitres 00 et 02 à 21 (anciens modèles, `a_verifier`) ne sont PAS auditées. Écarts carnet/dépôt constatés : en-tête sur `a2387b8` (obsolète), la branche a 23 commits d'avance sur `origin/main` et non 12 ; `main` local en retard de 74 commits, `pnpm-workspace.yaml` modifié localement (non touché, travail dans le worktree `C:/Users/elkha/Taekdhub-wt`).

**Mission 20 (2026-10-21, session locale) — écran Séances et notification, code `a50e620`.** À la demande de l'élève (captures de l'écran Séances) : (a) la carte « Temps total » (`components/history/history-summary.tsx`) débordait sur « Séances » (chiffre en `nowrap` à côté d'une colonne non réductible) : « Séances » passe sous le temps, chiffre réduit ; (b) en thème clair les tuiles « verre » (`.surface`) n'avaient ni bord ni ombre visibles sur le fond : bord gris 9 % et ombre renforcée (`--surface-border`, `--surface-lift-*`, nouvelle `--surface-border-strong` pour le survol ; `--surface-border-hover` inchangée car le bouton secondaire l'utilise comme fond) ; (c) la notification « Minimum du soir pas encore atteint » est SUPPRIMÉE (`eveningAlert` retirée de `lib/alerts.ts`, deux tests adaptés) ; le minimum du soir reste affiché sur l'accueil. Vérifié : `tsc`, lint, 94 fichiers de tests (1519 réussis + 1 échec attendu), build, aperçu en clair. NON fait : l'alerte « Rien de noté aujourd'hui » (même nature, à demander à l'élève) ; vue du jeudi (Planification, Exercices, révisions, « Physique 20 min ») : captures attendues ; fatigue : décision de l'élève en attente.

## Anomalies connues, non corrigées
- Fatigue définie de 3 façons ; le budget de l'agenda ignore les check-ins.
- Les propositions de suite dépendent de fiches saisies par l'élève : sans fiche ni annale, il reste à demander un
  original à Claude (copier la demande, coller l'énoncé), le seul geste manuel restant. Un catalogue de ressources
  vérifiées supprimerait ce geste mais demande d'être maintenu et vérifié (liens, droits) : décision à prendre.
- Un tap « terminé / partiel / j'ai bloqué » n'est conservé que pour un rappel de cours (Ma mémoire) et pour
  « terminé » (historique Next Move) ; pour les autres séances il ne sert qu'à la suite affichée.
- Les fiches d'exercice sont locales : changer d'appareil perd les énoncés (pas les essais). Les fiches ne sont
  pas dans Hermes ni dans le connecteur de Claude. L'ordre des tâches du programme est celui du plan (palier,
  poids), sans les plages de performance ; le placement horaire reste sur l'accueil.
- Deux budgets du jour (capacité déclarée, capacité planifiable).
- (CORRIGÉE mission 14) Le matin, le moteur lisait le sommeil de la nuit d'avant la veille.
- `exercise_logs` : migration 0009 à exécuter avant 0007 et 0008 sur une base neuve.

## Prochaine tâche envisagée
**REPRISE DE SESSION (2026-10-21, soir).** L'élève passe sur une session locale (son PC Windows) pour que Claude lise ses fichiers. Lire d'abord ce qui suit, puis proposer et attendre l'accord. État : branche `claude/exciting-franklin-hiekk8`, aucune PR ouverte, rien de la mission 17 ni 18 en production.

*Préférences de l'élève, à respecter :* il veut APPRENDRE (pas de solutions toutes faites) ; les fiches d'exercices n'ont NI indice NI corrigé ; il est en MP (2e année) ; il ne veut pas être dérangé pendant qu'il code (« fais ce que tu as à faire ») ; il délègue les choix de planning mais décide de la charge (a demandé au moins 5 h de maths ou de physique par jour) ; pas de notifications en excès (plafond : alertes d'échéance et alarme de séance).

*En attente de l'accord EXPLICITE de l'élève (jamais fait sans lui) :* (1) PR et fusion de la branche en production (nécessaire pour que `/seance/<id>`, `/exercices/*.pdf`, `/calendrier` et `/api/calendar/<CALENDAR_TOKEN>.ics` existent sur l'iPhone ; il doit aussi créer `CALENDAR_TOKEN` dans Vercel, Production, ≥ 32 caractères, jamais partagé) ; (2) déplacer le programme (`lib/holiday-program.ts`, aujourd'hui du code) dans Supabase, plus le stockage des PDF, pour ajouter une séance ou une fiche SANS redéployer — modification de sa base, accord requis ; (3) brancher Hermes : il se programme tout seul (chaque soir il lit ce qui a été fait et dépose un « constat » : prévu, fait, bien ou mal, erreurs, échéances proches), une tâche planifiée lance Claude, qui écrit la fiche du lendemain (PDF) et la range dans le créneau ; le format du constat et le prompt d'Hermes restent À DÉFINIR ENSEMBLE.

*À faire dès que les fichiers sont lisibles :* relire les CARTES ANKI de ChatGPT (dossier de l'élève : `C:\Users\elkha\Documents\Codex\2026-10-21\referenced-chatgpt-conversation-this-is-an\outputs`) AVANT import, signaler les erreurs de maths, ne rien importer à sa place ; il doit sauvegarder sa collection Anki d'abord.

*Données à compléter (hypothèses du programme) :* programme de la colle de maths du 3 novembre (cahier de prépa) ; heure du DS de physique-chimie du 2 novembre (4 h) et durée du DS de français (4 h supposées) ; programme du DS de français-philo du 30 novembre ; contenu des séances d'informatique ; SC10 non reprise (lecture du tableau de colles à vérifier) ; ligne « Mme Ouhadia » du 5 novembre : l'élève dit d'OUBLIER l'intervention d'anglais (retirée). Cahier de prépa : flux RSS introuvable par l'élève, Gmail non connecté (erreur d'authentification) : il colle ou envoie les documents.

*Côté élève, encore ouvert :* ajouter le dernier `.ics` à l'iPhone (supprimer l'ancien calendrier d'abord, sinon doublons) ; essai réel de la capture par la montre (`/api/capture`) ; validation d'Hermes (prompt 1 donné), puis révoquer le jeton et le contournement de test ; essai d'Apple Rappels (ne lit pas un .ics : à tester avec UN événement) et des alarmes d'un calendrier à abonnement.

*Autres candidats (rappel) :*
1. Feuille 2 de rédaction et rigueur ; cartes Anki « pièges de rédaction » ; reprise des questions faussées sans indice d'abord.
2. Décisions du moteur (changent les conseils) : fatigue définie de 3 façons ; deux budgets du jour.
3. Import de fiches d'exercice depuis un fichier JSON (sans migration), puis synchronisation (migration, accord explicite).
4. Ouverture publique (reportée, site privé pour l'instant) : connecteur à un secret par compte (migration), droits des annales, politique de confidentialité à faire relire ; aucune IA payante côté serveur (« coût IA zéro »).
5. Bilan des 14 jours, puis ajuster plages, classification ou placement ; phase 2 : une règle de récupération.

## Limites d'intervention
- Avant toute reprise : lire ce carnet, vérifier branche, HEAD et arbre ; signaler tout écart.
- Proposer la tâche et son périmètre, puis attendre l'accord avant de coder.
- Après accord : implémenter, vérifier (`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  `pnpm build`), puis deux commits : un pour le code, un pour la mise à jour de ce carnet
  (résultat et hash du commit de code).
- Ni nouvelle pull request, ni fusion, ni déploiement sans accord explicite (la branche de travail a 12 commits d'avance sur `main` : PR groupée à valider).
- Ne modifier ni réglage ni variable Vercel, ne créer aucun jeton, ne toucher à aucune configuration
  d'Hermes : ces actions sont faites par l'élève.
- Travailler sur la branche désignée ; ne jamais pousser sur `main`.
- Ne jamais afficher ni copier de secrets, clés ou données personnelles.
- Aucune phase 2 ni intégration Apple Watch sans demande.
- Hermes reste en lecture seule : aucun outil d'écriture, aucun texte libre, aucun titre ni
  identifiant d'échéance sans accord explicite ; ne pas toucher au secret MCP de Claude.
- Ne rien supprimer ni réécrire des changements de l'utilisateur.
- Signaler les anomalies sans les corriger hors périmètre.
