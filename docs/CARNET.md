# Carnet de bord TaekdHub

> Lu en premier à chaque session, avec `git status`. Si ce carnet et le dépôt divergent,
> le signaler et se fier au dépôt. ÉCART CONSTATÉ le 2026-11-20 : ce paragraphe datait du 2026-10-27 alors que `main` était à `e4eccd9` (PR #38, mission 29) ; se fier au dépôt et à la section « Mission 30 » en bas. Ancienne mention : dernière mise à jour 2026-10-27, commit de code `b34f989` (mission 18, branche `claude/mission-18-semaine`, FUSIONNÉE dans `main` `2d74b8a` le 2026-10-27 sur accord explicite de l'élève ; déploiement Vercel automatique, non relu : accès Vercel refusé à la session).
> Les PR #28 à #31 sont FUSIONNÉES dans `main` ; les paragraphes « PR #28 ouverte » plus bas sont périmés.
> Branche de travail actuelle : `claude/clever-meitner-elomfy` (la PR #34, accueil « À faire », est fusionnée dans `main` : `65f5c06`). La PR #32 est fusionnée dans `main` (`718084b`). La PR #33 (missions 13 et 14) est FUSIONNÉE (`74a6d7c`) et déployée en production (déploiement `dpl_73ewod7zcU48zdTeHEyF3vjSPVJK`, READY).

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
- « Aujourd'hui » (2026-10-25, accord explicite de l'élève : revient sur « l'accueil ne propose rien », seulement dans ce cadre) : l'accueil
  montre 3 à 5 lignes avec leur raison (`lib/today-view.ts`) : les échéances de l'élève (14 jours à venir, ou en retard de moins de 7
  jours), puis les erreurs et le cours des chapitres « EN COURS » qu'il choisit lui-même (3 au plus, `Preferences.currentChapterIds`,
  bouton dans `/chapitres`). Rien ne vient d'un chapitre qui n'est pas en cours : le cours avance, on ne revient pas à un exercice
  vieux de trois mois. N'utilise PAS le moteur Next Move. Anki : ligne à part (cartes dues, âge du relevé), sans toucher à son planning.
- Les docs `AUDIT.md` et `ROADMAP.md` sont partiellement périmées : se fier au code.

## État actuel
Branche `claude/loving-maxwell-oqm045`, dernier commit de code `0401692`, `main` = `1d75edd`.

**PR #28** (`Taekd6/Taekdhub`, créée par l'élève le 2026-10-14) : ouverte, non brouillon, non
fusionnée, `mergeable_state` propre, base `main` (`1d75edd`). Relue avant la mission 4 : tête
`504b1ae` (= HEAD local), 10 commits, 24 fichiers, +3094 / −13 ; la mission 4 ajoute deux commits.
L'ancienne mention « tête `5486d88`, 5 commits » était périmée : ce carnet retardait de cinq commits.
Les contrôles GitHub n'ont pas été relus après les derniers pushs (outil de lecture des contrôles non
utilisé). Ni fusion ni déploiement en production sans accord.

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
| 4 | Fraîcheur honnête pour Hermes : plan provisoire, séances anciennes, liste d'échéances non concluante. Commit `7209ad4` |
| 5 | Programme de révision (`/revision`) et point d'entrée vers l'entraînement (`/entrainement`). Commit `e72480f` |
| 6 | La suite après chaque séance (`lib/follow-up.ts`), exercice prêt, premier pas plus petit, audit Anki. Commit `0401692` |
| 7 | Accueil « tableau de bord » sur grand écran (maquette de l'élève) : barre latérale, salutation, horloge, semaine, progression du jour, citation. Commit `41fb603` |

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
propre ; l'élève a créé `CAPTURE_TOKEN` et `MCP_USER_ID` (Production) ; fusion NON faite (accord explicite requis). Pas fait : appel réel
d'Hermes (hors de portée de Claude : l'agent est chez l'élève), révocation du jeton et du contournement de test (à faire par l'élève),
rappel d'import Anki au démarrage (AnkiConnect n'existe que sur ordinateur, Anki ouvert : rien à automatiser côté navigateur sans
l'élève présent).

**Mission 13 (2026-10-24) — « Mes erreurs d'anglais » (thème, concours CCMP).** Nouvelle page `/erreurs-anglais`
(`components/erreurs-anglais/erreurs-anglais.tsx`, logique pure `lib/erreurs-anglais.ts` + tests). Le contenu vient
UNIQUEMENT de `data/erreurs-anglais.json` (`categories` : id, nom, regle ; `erreurs` : date, source, categorie = id,
francais, faux, correct) : aucune erreur en dur, aucune collection, aucune migration, rien de stocké ni synchronisé.
Pour enrichir : ajouter des lignes au JSON (le format ne change pas) ; `lib/erreurs-anglais.test.ts` vérifie le fichier
(ids de catégorie uniques, chaque `categorie` existe, champs remplis, date AAAA-MM-JJ). Une `categorie` inconnue n'est pas
écartée : groupe « Catégorie inconnue » en dernier. Page : groupes (nom, règle en encadré, nombre), plus récente d'abord ;
carte = phrase, version fausse barrée en rouge, correction en vert (icônes ✗/✓ en plus de la couleur), source et date ;
mode révision (interrupteur) : correction cachée, révélée au toucher de la carte, version fausse toujours visible ; filtre par
catégorie ; « Mélanger » (révision seulement) = une seule pile au hasard sans groupes, la catégorie n'apparaît qu'avec la
correction ; « Par catégorie » revient aux groupes. 18 px minimum partout (source et date comprises, donc pas « en petit »),
cibles de 48 px, clair et sombre. Lien « Erreurs d'anglais » dans la colonne latérale (dès `lg`) et bouton depuis `/erreurs`
(la barre d'onglets mobile reste à 4 destinations : iPad en portrait passe par `/erreurs`). Distinct du carnet d'erreurs
`/erreurs` (saisi dans l'application, synchronisé).
- PAS d'export Anki, volontairement (l'élève l'a écarté et la condition « si c'est simple » n'est pas remplie) : le `.apkg`
  existant est fabriqué hors ligne par `scripts/build-course-deck.py` (genanki) ; un bouton qui le génère dans le navigateur
  demanderait d'embarquer SQLite et un zip. Si on le veut plus tard : un script jumeau lisant ce JSON, comme pour les cartes de cours.
- Idée de l'élève, non faite : répertorier aussi les erreurs des autres matières. Le format actuel (faux / correct) est pensé
  pour un thème ; maths-physique-chimie demanderont un autre format (oubli de cours, piège, chapitre), à décider. Les fiches A5
  « toujours avec moi » ne sont pas faites (les 117 cartes de maths sont déjà sur la page Anki).
- Vérifié : 91 fichiers de tests, 1473 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; captures Chromium réelles
  à 820 px (iPad portrait), clair et sombre, lecture / révision / mélange ; aucun texte sous 18 px mesuré dans `main`.
  Non vérifié : sur un vrai iPad (toucher, Safari), à 1024 px et plus (colonne latérale).

**Mission 14 (2026-10-24) — page d'un chapitre (demande de l'élève : travailler dans le chat claude.ai avec le connecteur ; cours du
prof, méthodes et erreurs rangés par chapitre, avec des PDF).** Accord explicite de l'élève : nouvelle collection + migration SQL,
bibliothèque PDF, texte retapé (pas le PDF du prof). Livré : `/chapitre/<id>` (`components/chapitre/chapter-page.tsx`, une page statique par
chapitre de `lib/programme-data.ts`, 404 sinon), quatre onglets : **Cours** (retapé, `parseCourse` : `#`, listes `-`, paragraphes),
**Méthodes** (quand → étapes → piège), **Erreurs** (celles de `errors` avec `programmeChapterId`, rien de dupliqué), **Cartes** (cartes
Anki du chapitre de `data/course-cards.json`, lien vers `/anki` et le `.apkg`). Lien « Page du chapitre » sur `/programme`.
- **Données** : nouvelle collection synchronisée `chapterNotes` (`lib/chapter-notes.ts`, une entrée par chapitre : `cours`, `methodes`),
  branchée comme `ankiSnapshots` (storage, sync, hook, sauvegarde exportée/restaurée). **Migration `0011_chapter_notes.sql` : à appliquer
  par l'élève AVANT de déployer** (sinon l'envoi de la collection est refusé par `user_collections_known` et les outils répondent en erreur).
  Cours ≤ 30 000 caractères par appel, 150 000 par chapitre, 40 méthodes par chapitre. Les deux tests qui lisent la migration
  (`lib/sync/collections.test.ts`) et le nombre d'étapes de restauration (`lib/storage.test.ts`, 14 → 15) ont été mis à jour.
- **Connecteur de Claude** (`/api/mcp/<secret>` seulement, JAMAIS Hermes : le cours est du texte libre) : `get_chapter` (cours, méthodes,
  erreurs ; dit explicitement quand aucun cours n'est rangé, pour ne pas supposer ce qui a été vu), `save_course` (`remplacer` puis
  `ajouter` par morceaux), `add_methods` (même titre = remplace), `add_errors` (carnet `errors`, sans doublon le même jour, une ligne ≤ 200
  caractères). Le chapitre se donne par titre, alias ou identifiant ; ambigu (sup/spé : « probabilités ») = erreur qui liste les identifiants,
  jamais deviné.
- **PDF** : « Télécharger le PDF » sur Méthodes et Erreurs ; fabriqués DANS LE NAVIGATEUR au clic (`lib/chapter-pdf.ts` décrit le document,
  `lib/chapter-pdf-render.ts` le met en page avec pdf-lib + fontkit, chargés au clic seulement). Nom fixe (`Reduction-des-endomorphismes-methodes.pdf`),
  toujours à jour. Police DejaVu Sans (et Bold) dans `public/fonts` avec sa licence, pour ⟺ ∑ χ 𝕂… ; un caractère absent de la police devient « ? ».
  Pas de fichier stocké côté serveur : Safari ne peut pas ouvrir un lien protégé par le compte, et ce serait un stockage de plus.
- Vérifié : 94 fichiers de tests, 1509 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; PDF réels relus (page A4, symboles de
  maths, plusieurs pages, carte plus haute qu'une page) ; navigateur réel à 820 px, clair et sombre : onglets, états vides, 404, et les deux
  téléchargements (noms de fichiers, PDF valides) ; parcours des outils avec un stockage en mémoire (cours → méthode → erreur → lecture).
- NON vérifié : les quatre outils contre la vraie base (la migration n'est pas appliquée ici), le téléchargement sur un vrai iPad (Safari →
  Fichiers), l'effet sur la lecture du cours par Claude en conversation réelle. Le PDF du prof n'est pas conservé : seul le texte retapé l'est.
- À faire par l'élève : appliquer la migration 0011, puis (accord explicite) fusionner et déployer ; ensuite envoyer le PDF de Réduction dans la
  conversation claude.ai. Idée de l'élève : un skill Claude qui décrit la routine (PDF reçu → `save_course`, méthode donnée → `add_methods`,
  erreur → `add_errors`, avant un exercice → `get_chapter`) : non fait, à créer une fois le pilote validé.
- Restent à décider : un format d'erreur propre à la physique-chimie (les erreurs de maths utilisent `description` / `fix` / `type`) ; les cours
  des autres matières ; la suppression des cours du prof avant toute ouverture publique ou commerciale (décision de l'élève : « on les enlèvera »).

**Mise en service de la mission 14 (2026-10-24, sur demande explicite de l'élève : « fusionne, et permets à Claude de bosser dans TaekdHub »).**
- Migration `0011_chapter_notes` APPLIQUÉE par Claude sur la base (projet Supabase unique, via l'outil Supabase), contrainte `user_collections_known` relue ensuite : `chapterNotes` y figure. Le carnet disait « à appliquer par l'élève » : l'élève l'a autorisé.
- PR #33 fusionnée (merge commit `74a6d7c`), déploiement de production READY sur `taekdhub.vercel.app`. Aucune variable ni réglage Vercel touchés.
- **Cours de Réduction rangé** (chapitre `m2-reduction`, 64 215 caractères, parties I à VI, 4 morceaux) : écrit DIRECTEMENT dans `user_collections` (collection `chapterNotes`, révision 4) par SQL, avec la même forme que `save_course`, parce que les outils du connecteur ne sont pas appelables depuis une session de code. Retapé depuis le PDF du professeur (16 pages de 2 pages de cours) ; matrices en notation linéaire (lignes séparées par « ; ») ; les formules douteuses ont été confirmées avec la couche texte du PDF ou recalculées exactement (A^k de l'exemple 20, a_k/b_k/c_k de l'exemple 21 : vérifiés pour k = 1 à 4 et 1 à 6). Le PDF d'origine n'est pas conservé. Les méthodes et les erreurs de Réduction sont vides (aucun exercice fait).
- NON vérifié : les quatre outils (`get_chapter`, `save_course`, `add_methods`, `add_errors`) contre la vraie base depuis une conversation claude.ai ; le secret du connecteur n'est pas connu de Claude. À faire par l'élève : dans claude.ai, rafraîchir ou reconnecter le connecteur TaekdHub pour qu'il liste les quatre nouveaux outils, puis demander à Claude de lire `get_chapter` sur « Réduction ».

**Mission 15 (2026-10-24) — fonctionnel dès demain, physique comprise (demande de l'élève).** `/chapitres` (`lib/chapters-overview.ts`,
`components/chapitre/chapters-list.tsx`) : tous les chapitres par matière (maths, physique, chimie) et année (spé, sup), avec pour chacun cours
rangé / méthodes / erreurs / cartes ; chaque ligne ouvre `/chapitre/<id>`. Liens : colonne latérale (« Mes chapitres ») et rangée d'outils de
« Matières » (seul chemin sur iPad en portrait). PDF : lien de secours « Ouvrir le PDF » si Safari ne télécharge rien. `robots.ts` exclut `/chapitre`.
Commit de code `0c2baab`. Vérifié : 95 fichiers de tests, 1513 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; navigateur réel à 820 px (clair et
sombre, filtres, lien vers le chapitre, lien dans Matières). Physique et chimie fonctionnent avec les mêmes outils et le même format d'erreur
(`description` / `fix` / `type`) ; seules les cartes Anki n'existent que pour les maths.
- **Cours rangés (écrits directement en base, révision `chapterNotes` 8)** : Réduction (`m2-reduction`, 64 215 caractères) et Séries (`m2-series-compl`, 42 948 caractères, chapitre 5 « Séries » du polycopié, en espace vectoriel normé : il ne traite pas des familles sommables, que le titre du programme « Séries numériques et familles sommables » inclut). Les ★ du cours de Séries reprennent les ampoules du polycopié (« important en pratique »). Pour ce PDF le texte était lisible en image, page par page.
- **Diagnostic du connecteur** : un serveur local construit depuis `main` liste bien 13 outils, dont `get_chapter`, `save_course`, `add_methods`, `add_errors` ;
  les deux projets Vercel (`taekdhub`, `taekdhub-vcrx`) ont déployé `main` (`74a6d7c`) en production. Si claude.ai ne voit pas les nouveaux outils, la cause est
  côté claude.ai : liste d'outils gardée en mémoire par le connecteur (le retirer et le rajouter, puis nouvelle conversation) ou URL du connecteur qui pointe sur
  un ancien déploiement (Preview) ou sur l'autre projet. Non vérifié : l'URL réellement configurée dans claude.ai (le secret n'est pas connu de Claude).

**Mission 16 (2026-10-24) — fin des pop-ups et du suivi du temps sur l'accueil (demande explicite de l'élève : « supprime tout ce que je t'ai dit »).**
- Retirés de l'accueil (`components/dashboard-overview.tsx`) : la carte « Progression du jour », le check-in du sommeil du soir. Les composants existent toujours (`components/home/desktop-header.tsx`, `components/checkin`), sans appelant sur l'accueil.
- Carte « Ton prochain mouvement » : les raisons liées à l'objectif de la semaine, au minimum du soir et au sommeil ne sont plus AFFICHÉES (filtre d'affichage ; le moteur Next Move est inchangé), ni la ligne « Corrige » quand elle parle de l'objectif de la semaine.
- « Le point » ne s'ouvre plus tout seul au lancement (`components/briefing/briefing-gate.tsx` ne redirige plus ; `/point` reste accessible). Les lignes « X en retard sur la semaine » ont été retirées du briefing (`lib/briefing.ts`, test mis à jour).
- **Données (base, sur demande)** : les 4 exercices de Réduction du 1er octobre qui s'affichaient en boucle depuis un mois (Oraux CCP ex. 7, 12, 13, 14 ; 2 partiels, 2 échecs) ont été SUPPRIMÉS de `exercise_logs`. Leur contenu utile (erreurs et « à retenir ») a été transféré dans le carnet d'erreurs (`errors`, 4 entrées rattachées à `m2-reduction`, visibles dans l'onglet Erreurs du chapitre). Copie complète des 4 lignes d'origine : fichier de session `sauvegarde-exercise_logs-reduction.json` (non versionné ; à redemander si besoin de les remettre).
- ATTENTION : il reste 10 autres lignes dans `exercise_logs`, toutes ratées ou partielles : Next Move pourra proposer l'une d'elles à « refaire sans aide » (même mécanisme). Pas de bouton « ne plus me le proposer » (défaut connu) ; non traité sans accord.
- « Le reste de ta journée » (« Il me reste… avant 23 h ») est toujours affiché : l'élève n'en a pas parlé nommément.
- **Suite (même jour, « c'est juste un outil d'organisation, je ne veux pas qu'il me propose »)** : l'accueil ne propose plus rien. Retirés : « Ton prochain mouvement » (Next Move) et « Le reste de ta journée ». À la place : « Mes chapitres » (`components/home/chapters-card.tsx`, `recentChapters` dans `lib/chapters-overview.ts`, testé) et les échéances. Les bannières d'alerte animées sont retirées de `components/app-shell.tsx` (`AlertCenter` n'est plus monté ; `lib/alerts.ts` et le composant sont conservés). NON touchés, à demander : `/revision` (programme de révision), la carte « Et maintenant ? » après le chronomètre et après une fiche d'exercice, les notifications iPhone (cron serveur, réglables dans Réglages), les écrans `/entrainement` et `/point` (accessibles seulement à la demande). Vérifié : 95 fichiers de tests, 1515 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; navigateur réel (accueil à 1440 px et 390 px, 21 h simulées) : aucun « prochain mouvement », « reste de ta journée », progression, check-in ni « en retard ».
- **Un vrai outil d'organisation sur l'accueil (demande : « met ce qui me permet de m'organiser »)** : « À faire » (`components/home/todo-card.tsx`, `lib/todo-view.ts`, testé) = la liste de l'élève : il écrit une tâche (titre, date et matière facultatives), la coche, la supprime ; rangée En retard / Aujourd'hui / Demain / Cette semaine / Plus tard / Sans date. Ce sont les `workItems` de la page Échéances (kind « autre », 30 min par défaut non affichées) : une tâche ajoutée à l'accueil apparaît sur `/echeances` et inversement ; supprimer = statut « abandonné » (aucune ligne retirée). La carte « Échéances » de l'accueil est remplacée par « À faire » ; « Mes chapitres » passe dans la colonne de droite. La date de l'en-tête mobile n'ouvre plus « Le point ». Vérifié au navigateur (ordinateur et iPad 820 px, heure simulée) : ajout, groupes, cocher, supprimer, persistance après rechargement ; 96 fichiers de tests, 1523 réussis + 1 échec attendu antérieur, `tsc`, lint, build. Non vérifié : sur l'appareil de l'élève. Le planificateur de la page Échéances voit ces tâches (il les « case » dans les journées) ; rien n'est proposé sur l'accueil.

**Incident « JWT issued at future » (2026-10-25) — aucune correction de code.** L'élève a vu cette erreur en appelant `get_today` depuis claude.ai.
Le dépôt ne vérifie aucun JWT pour le connecteur (secret dans l'URL), ni pour Hermes ni pour la capture (jeton fixe en en-tête) ; les seuls
`getUser(token)` sont dans `app/api/account/delete` et `app/api/push/test` (Supabase vérifie, pas d'option d'horloge). Constaté : la production
(`65f5c06`) répond, les trois routes renvoient un 401 simple avec une fausse clé ; aucun message JWT dans les journaux Supabase (24 h). Journaux
d'exécution Vercel illisibles (403). Le connecteur Taekdhub (Web, Personnalisé) était coché dans claude.ai et `get_today` a fini par répondre :
l'erreur venait d'une couche extérieure (probable décalage d'horloge côté claude.ai, non prouvé) et s'est résorbée. Rien n'a été modifié.

**Mission 17 (2026-10-25) — « Aujourd'hui » sur l'accueil (demande de l'élève : « ouvrir le site, savoir exactement quoi faire, être prêt pour mes
échéances, sans décrocher du cours »).** Code : commit `f9fe538`. Nouveau bloc `components/home/today-card.tsx` au-dessus de « À faire » ; logique
pure `lib/today-view.ts` (+ tests) ; champ `currentChapterIds` dans les préférences (liste blanche de `normalizePreferences`, aucun SQL, déjà
synchronisé) ; bouton « En cours » par chapitre dans `/chapitres` (3 au plus, les autres boutons se désactivent). Règles : échéances d'abord
(3 au plus, les plus proches, l'important avant à date égale), puis « Relire tes erreurs » (si le chapitre en cours en a) et « Revoir / Ranger le
cours » ; 5 lignes au plus ; un travail en retard de plus de 7 jours n'est pas proposé (il reste dans « À faire »). Vérifié : 97 fichiers de tests,
1537 réussis + 1 échec attendu antérieur, `tsc`, lint, build ; navigateur réel (390 px et 1280 px) avec données de test : DM vieux de 30 jours
écarté, Anki ancien signalé, plafond de 3 chapitres enregistré et conservé au rechargement. NON vérifié : sur l'appareil de l'élève, avec ses
vraies données, en mode sombre.
- Limites assumées : une échéance n'est pas rattachée à un chapitre (aucun lien dans les données), donc « Aujourd'hui » ne dit pas quel exercice de TD
  faire, seulement quelles tâches de l'élève sont proches ; « erreurs notées » ne dit pas si elles sont corrigées (pas de date de retest) ; les
  exercices de fiches (locaux) et les annales ne sont pas dans ce bloc.
- Livraison : À FUSIONNER ET DÉPLOYER SUR ACCORD EXPLICITE de l'élève (rien n'est poussé sur `main`).

**Mission 18 (2026-10-27) — « Ma semaine », widgets, agendas et Rappels (demande de l'élève : « exactement » l'app Khallot ; style
widgets Revolut/Finary ; emploi du temps relié à son agenda ; cocher dans Rappels = coché dans TaekdHub).** Commit `b34f989`.
- `/semaine` (`components/week/*`, `lib/week-agenda.ts`, testé) : grille lundi → dimanche, 7 colonnes dès `md` (iPad), un jour à la fois
  sur téléphone (sélecteur de jours). Cours lus dans les agendas ; tâches (`WorkItem`, jour = `plan.day` sinon `dueDate`, heure =
  `plan.time` sinon `dueTime`) en dégradé, cochables d'un tap ; créneau vide → `TaskQuickAdd` (tâche planifiée à ce jour et cette heure).
  Couleurs PAR NATURE (cours, TD/TP, DS rouge, khôlle orange), jamais par matière (décision « Nuit » respectée). Chiffres en tête :
  agenda en journée (avant 18 h : le soir, l'agenda de l'élève porte ses propres créneaux de travail), tâches cochées, échéances de la
  semaine, prochaine épreuve. Entrée « Ma semaine » dans la barre latérale ; l'onglet « Séances » de la barre du bas devient « Semaine »
  (`/history` reste accessible).
- Accueil en widgets (`components/home/widgets.tsx`) : CE SOIR (planifié aujourd'hui, ou dû aujourd'hui/demain sans plan ailleurs ;
  les cochées du jour restent barrées ; tout coché → « Tout est prêt. »), PROCHAINE ÉPREUVE (agenda + échéances, « Préparation au DS »
  ignorée), EN CE MOMENT / ENSUITE, MA SEMAINE (barres). Le bandeau de la semaine (`WeekStrip`) n'est plus appelé sur l'accueil.
- Agendas (`lib/calendar.ts`, `app/api/calendar`, `hooks/use-calendar.ts`, testé) : préférence `calendarFeeds` (synchronisée avec les
  préférences, aucune migration) ; seule l'ADRESSE iCal est stockée, jamais le contenu (cache local `prepahub:calendar-cache`, 21 jours,
  non synchronisé). Hôtes en liste fermée (Google, iCloud, Outlook), redirections refusées, adresse en POST (jamais dans une URL),
  masquée à l'affichage. Réglage dans Réglages → « Mes agendas » (l'adresse est testée avant d'être enregistrée). `ical.js` ajouté.
- Rappels d'Apple (`lib/rappels.ts`, `lib/rappels-handler.ts`, `app/api/rappels`, testé) : un site ne peut pas écrire dans Rappels ;
  un raccourci iOS de l'élève fait le pont, UNE requête par passage (POST des URL cochées → coche ici, renvoie à créer et à cocher).
  Lien rappel ⇄ tâche = URL `<site>/echeances?t=<id>` (+ repère `[t:<id>]` dans les notes). Même jeton que la capture
  (`CAPTURE_TOKEN` + `MCP_USER_ID`). Guide pas à pas dans Réglages → « Synchro avec Rappels ». `toggleWorkItemDone` pose `updatedAt`
  dans les deux sens (une tâche rouverte ne se recoche plus à la fusion). Le store serveur de la capture est extrait dans
  `lib/server-collection-store.ts` (partagé).
- Côté Claude (hors dépôt) : tâche programmée « Exos des profs » (chaque soir 18 h 46) qui lit SEULEMENT les mails des professeurs de
  maths et de physique, en tire les exos et consignes et prévient l'élève ; règle de l'élève : rien du contenu des mails n'est mémorisé.
Vérifié : 100 fichiers de tests, 1579 réussis + 1 échec attendu antérieur, `tsc`, lint, build (polices Google simulées : réseau fermé
dans la session) ; captures Chromium à 390, 820 et 1280 px, sombre et clair ; parcours au navigateur : cocher dans la semaine, ajouter une
tâche, cocher dans « Ce soir » jusqu'à « Tout est prêt. ». Non vérifié : un vrai flux iCal Google (réseau fermé ; l'analyse est testée sur
un extrait au format Google), le raccourci iOS sur l'iPhone de l'élève, `CAPTURE_TOKEN` présent en production.

**Mission 19 (2026-10-27) — minimaliste (demande de l'élève : « les données dans le back end, pas dans ce que je vois »).** Commit `4908bdf`,
branche `claude/mission-19-minimal`, NON fusionnée. Nouvelle répartition des rôles, posée par l'élève : RAPPELS d'Apple est SON outil (il range
dans les listes qu'il veut, « Urgent »…, et coche) ; TAEKDHUB est celui de CLAUDE (Claude y entre le travail — mails des profs, conversations,
Anki — et vérifie ce qui est coché). Navigation réduite à Aujourd'hui, Ma semaine, Mes chapitres, Réglages (barre du bas : 4 onglets, sans le
disque du chrono) ; tous les autres écrans existent toujours à leur adresse. Accueil : les 4 widgets seuls (« Aujourd'hui », « À faire »,
« Mes chapitres » et le rappel de sauvegarde n'y sont plus appelés). Semaine : grille seule. Aucune donnée, collection ni moteur touché.
Raccourci iOS de l'élève (hors dépôt) : synchro en place et vérifiée en base (« Test Rappel » terminé) ; automatisations à la fermeture de
Rappels, 7 h et 18 h ; à faire par l'élève : chercher les rappels dans TOUTES les listes (retirer le filtre « Liste est Taekdhub »).
`CAPTURE_TOKEN` remplacé en production le 2026-10-27 (ancien jeton invalide) ; `MCP_USER_ID` non relu (valeur masquée), la synchro le valide.

**Mission 20 (2026-10-27) — palette « Studio » (demande de l'élève : « applique des templates GitHub »).** Commit `1738ca6`. Source :
gabarit Habit Tracker de Square UI (github.com/ln-dev7/square-ui, licence ln-dev UI : usage et modification autorisés). Nouvelle palette
`studio` (lib/theme.ts) et bloc `[data-palette="studio"]` d'app/globals.css : neutres chauds (crème / charbon chaud), accent terre cuite,
tuiles pleines à filet d'un pixel, verre et halos coupés, rayons 18 px, étiquettes en petites capitales, chiffres en 900. Aucune autre
palette ni aucun composant touché. Posée comme palette de l'élève dans ses préférences (Supabase) sur sa demande ; « Minuit » reste
choisissable dans Réglages. Vérifié : tests, lint, `tsc`, build ; captures 1280 px sombre et clair (accueil, semaine).

**Mission 21 (2026-10-27) — trois directions de couleur.** Commit `a500042`. L'élève n'aime pas « Studio » (« j'aime pas du tout les couleurs ») :
sa palette repasse à « Minuit » dans ses préférences ; Studio reste choisissable. Ajout de « Finance » (marine + émeraude, esprit Finary), « Lime »
(graphite + vert acide, esprit Linear) et « Glacier » (clair, bleu → violet, esprit Revolut), sans rien appliquer : planche de comparaison envoyée,
choix de l'élève attendu. Recherche Hugging Face (Spaces « dashboard ui ») : rien d'exploitable (pages générées, sans licence claire).

**Mission 22 (2026-10-27) — « premium » : animation et image (demande de l'élève : « pas premium, pas d'animation, pas d'image »).**
Commit `9288421`. `components/home/sky-hero.tsx` remplace la salutation de l'accueil : un ciel qui suit l'heure (aube 6-9 h, jour 9-17 h,
crépuscule 17-20 h, nuit), dégradés animés, étoiles, lune ou soleil, relief et grain, en CSS pur (aucun fichier image : léger, hors ligne).
Il porte la date, l'heure, « X/Y ce soir » et la prochaine épreuve. Widgets : cascade d'entrée (`.reveal`), `CountUp`, coche qui rebondit
avec un anneau, carte d'épreuve flottante, point vivant « En ce moment ». `prefers-reduced-motion` respecté. Vérifié : tests, lint, `tsc`,
captures 390 et 1280 px, GIF du parcours (cocher jusqu'à « Tout est prêt. »).

**Mission 23 (2026-10-27) — le contenu d'une séance (« je clique sur une séance de demain et je vois le contenu »).** Commit `7c8dd48`.
`components/week/task-detail.tsx` : un tap sur une tâche (« Ce soir », la semaine) ouvre sa fiche : matière, type, quand (plan), pour quand
(échéance, durée), CONTENU (`WorkItem.note`, lignes « - » en puces, liens cliquables), et « C'est fait » / « Demain » / « Rouvrir ». Dans la
semaine, un tap sur une tâche l'OUVRE (il la cochait directement). `Dialog` passe par un portail. Les 9 tâches de l'élève ont reçu leur contenu
(note) en base : exos du TD de séries, programme de colle, plan du rapport TIPE (consignes du prof), DS de physique, consignes de physique,
oral d'anglais, colle de français. La note part aussi dans Rappels (champ notes).

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
- Le matin, le moteur lit le sommeil de la nuit d'avant la veille.
- `exercise_logs` : migration 0009 à exécuter avant 0007 et 0008 sur une base neuve.

## Prochaine tâche envisagée
Aucune lancée. Candidats, chacun à proposer avec son périmètre, accord requis :
1. Essai réel pendant quelques jours : séance → bilan → « Et maintenant ? » → exercice. Noter ce qui bloque encore
   (trop de clics ? fiche manquante ? mauvais niveau ?). C'est ce qui dira s'il faut un catalogue ou un autre geste.
2. Alimenter la banque de fiches sans effort : catalogue de ressources externes vérifiées (source, lien, chapitre,
   compétence) ou import depuis un fichier ; ou synchroniser les fiches (collection, migration : accord explicite).
3. Rendre le relevé Anki moins manuel (rappel d'import au démarrage sur ordinateur, ou saisie des cartes dues en
   deux taps après une séance) — seulement si l'essai montre que le défaut de fraîcheur gêne vraiment.
4. Reprendre les anciens écrans que le programme recoupe (carte « À ne pas oublier », bannière de cartes, liste du
   jour) une fois l'usage confirmé : n'en retirer aucun avant.
5. Bilan des 14 jours, puis ajuster plages, classification ou placement ; phase 2 : une règle de récupération.
6. Hermes (reporté sur demande de l'élève) : production à redéployer après accord, jeton et contournement à révoquer.

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

## Mission 24 — finitions premium (ffc386f)
- Transition douce entre les pages (app/(app)/template.tsx, .page-in).
- Ciel de l'accueil : étoile filante la nuit, nuages le jour.
- Confettis quand la dernière tâche du soir est cochée.
- /semaine : bandeau dégradé animé (plage de dates, progression des tâches de la semaine, navigation).
- Bandeau d'erreur agenda masqué quand la copie hors ligne suffit.
- Tout respecte prefers-reduced-motion. Vérifié : vitest 1579 ok, tsc, eslint, captures 1440 et 390 px.

## Mission 25 — chapitres en tuiles, projecteur, faisceau (2a0052a)
- /chapitres : bandeau ciel (matière, chapitres épinglés, contenu, cartes Anki) et grille de tuiles numérotées ; jauge à 4 segments (cours, méthodes, erreurs, cartes) ; épingle « en cours » en bouton rond ; apparition en cascade.
- Projecteur au survol de la souris (.spot, components/ui/spotlight.tsx, un seul écouteur) sur les widgets de l'accueil et les tuiles.
- Faisceau de lumière autour de la bordure (.beam, CSS @property) : chapitres épinglés et widget « En ce moment » quand un cours a lieu.
- Idées reprises de Magic UI (MIT) — MagicCard, BorderBeam — réécrites en CSS pur, aucune dépendance ajoutée. Coupé sous reduced-motion.
- Vérifié : vitest 1579 ok, tsc, eslint, captures 1440 et 390 px.

## Mission 26 — vacances sans cours, réglages triés (701518a)
- lib/vacances.ts : vacances et jours fériés 2026-2027 relevés dans l'agenda du Cahier de Prépa (mp-pascal). Ces jours-là, les cours de l'emploi du temps disparaissent (semaine, accueil) ; restent les tâches, le perso, les créneaux du soir (dès 18 h 30) et du dimanche, que l'élève pose lui-même pour réviser. Filtre appliqué dans hooks/use-calendar.ts. Tests : lib/vacances.test.ts (indépendants du fuseau).
- Réglages : à l'écran, apparence, agendas, compte, Rappels ; le reste dans « Réglages avancés », replié. Rien de supprimé.
- Vérifié : vitest 1581 ok, tsc, eslint, captures.

## Mission 27 — session de travail en cycles (e52d2a3)
Demande de l'élève (2026-10-27, minuit) : « un chrono 50 min / pause, qui s'enchaîne tout seul, que chaque session aboutisse à quelque chose,
et qu'on puisse le lancer depuis la montre » ; code fait la nuit, déploiement autorisé explicitement par l'élève (« toutes les autorisations »).
- lib/focus-session.ts (testé) : phases calculées depuis l'heure de début (rien ne tourne en arrière-plan : verrouillage, rechargement sans effet),
  pas de pause après le dernier cycle, objectifs proposés (liste « Ce soir », puis le travail ouvert le plus urgent), alertes de fin de phase.
- /session (components/focus/focus-session.tsx) : 1) « Qu'est-ce que tu vas finir ? » (propositions ou texte libre), rythme 25-60 / 5-15 / 1-4 cycles
  (défaut 50/10 ×2, mémorisé) ; 2) anneau, phase, temps restant, objectif ; bascule = bip Web Audio + vibration + notification si la page vit ;
  « Reprendre maintenant » pendant la pause ; écran gardé allumé (Wake Lock) ; 3) « Objectif atteint ? » : enregistre une WorkSession (temps de travail
  seul), « Oui » coche la tâche (donc le rappel via la synchro Rappels), « Pas encore » la passe « en cours » ; victoires du jour (localStorage).
- /api/session (lib/focus-handler.ts, testé) : même porte que /api/rappels (CAPTURE_TOKEN + MCP_USER_ID), LECTURE SEULE. GET → objectifs + choix ;
  POST { objectif, cycles?, travail?, pause? } → horaire, alertes { titre, heure, date ISO locale, url } (la dernière porte l'URL de la tâche) et lien
  `/session?objectif=…&debut=…` qui reprend la même session dans la page.
- Navigation : onglet « Session » (5 onglets en bas, barre latérale).
Raccourci iOS « Start session » (hors dépôt, à monter par l'élève) : GET /api/session → « Choisir dans la liste » → POST → un rappel à l'heure de chaque
alerte dans une liste « Session » (ce sont eux qui font vibrer la montre, iPhone verrouillé) → focus Work. Une page web ne peut pas notifier de façon fiable
téléphone verrouillé sans serveur à la minute (le cron n'est qu'horaire).
Vérifié : vitest 1595 ok + 1 échec attendu, tsc, eslint, build (polices simulées), parcours Chromium 390 px sombre (choix → cycle → pause depuis le lien
du raccourci → « Objectif atteint ? » → victoire). Non vérifié : le raccourci sur l'iPhone, les notifications iOS réelles.

## Mission 28 — reprise sur « JWT issued at future », file de tâches entre agents (f4f3af3)
- Demande de l'élève (2026-11-01) : diagnostiquer l'erreur du connecteur et préparer une file de tâches partagée. Incident : get_today a échoué plusieurs fois alors que list_echeances et get_progress répondaient ; la route Hermes (même clé) répondait. Aucun JWT n'est fabriqué ni vérifié par le dépôt sur ce chemin : le message vient de Supabase. Cause racine NON démontrée ; l'erreur s'est résorbée seule, comme le 25/10.
- lib/supabase-retry.ts (testé) : une seule reprise sur 401 « JWT issued at future » / PGRST303, journal limité au code ; branché sur db() de /api/mcp/[key] uniquement.
- File de tâches : issues GitHub (modèle .github/ISSUE_TEMPLATE/tache-agent.yml, protocole docs/TACHES-AGENTS.md). Les trois labels gent:* restent à créer à la main dans GitHub.
- Vérifié : lint, tsc, vitest 1600 + 1 échec attendu, build. Non vérifié : en production (branche locale, ni poussée ni déployée).

## Mission 29 — Hermes : script et fiche alignés sur MCP_HERMES_TOKEN (aecc681)
- Constat (2026-11-01) : docs/HERMES.md et scripts/hermes-check.mjs n'existaient que sur la branche non fusionnée claude/finalisation-hermes-tests. Le script lisait TAEKDHUB_MCP_TOKEN (jeton d'un Preview) alors qu'Hermes et le serveur utilisent MCP_HERMES_TOKEN : faux 401. Corrigé ; seuls ces deux fichiers sont repris, rien d'autre de la branche.
- Production vérifiée : /api/mcp-hermes refuse sans jeton et avec un jeton inventé (401), annonce get_today et list_echeances seuls, et répond en 200 aux deux. Consigne de fraîcheur active : séances non récentes, plan à présenter comme provisoire.
- Vérifié : script contre la production, lint, tsc, vitest 1600 + 1 échec attendu. Non vérifié : aucune tâche Hermes planifiée n'a encore tourné.

## Mission 30 — écran Exos : catalogue annales / BEOS / manuels et suivi case par case (5bdde59)
Demande de l'élève (2026-11-20) : suivre dans TaekdHub les questions d'annales faites (Wikiprepa n'a pas de compte), les exos d'oral BEOS
(tous concours) et ceux de ses manuels, en cochant ; voir sa progression et travailler ses points faibles ; Claude branché dessus. Prototype
(artifact « Suivi des annales ») puis maquette validés par l'élève ; style CLAIR choisi par lui, forcé sur cet écran quel que soit le thème.
Branche `claude/mission-30-exos`, partie de `main` `e4eccd9`. FUSIONNÉE dans `main` (avance rapide, `3fcde4d`) le 2026-11-20 sur accord explicite de l'élève (« Fusionne ») ; production READY sur les deux projets Vercel (`dpl_7WHu5wsYX879TzVtTzkw1975wvBx`). Page en production non ouverte par la session (réseau fermé vers vercel.app).
- Données, AUCUNE migration : catalogue = champ facultatif `exos` de `chapterNotes` (une entrée = une RÉFÉRENCE : titre, lien http(s),
  questions, concours, année, niveau, page ; jamais d'énoncé recopié) ; une case cochée = une tentative `attempts`, clé
  `exo:<chapitre>:<entrée>[#<question>]`. L'état d'une case se recalcule (lib/exos.ts) : seul → 14, 30, 60, 120, 240 j ; indices → 7 j ;
  raté → 3 j. « Annuler » retire la dernière tentative seulement.
- Écrans : `/exos` (séance du jour, maîtrise, statuts, progression 12 semaines, radar, points faibles avec conseil, prévision 14 jours,
  chapitres), `/exos/<id>` (3 colonnes annales / BEOS / manuels, une case par question, filtres), onglet « Exos » de `/chapitre/<id>`,
  entrée « Exos » dans la barre latérale et la barre du bas (6 onglets). Coller un lien Wikiprepa range le sujet et sa question.
- Raté : le piège noté part dans le carnet d'erreurs du chapitre (`errors`, donc PDF et cartes Anki que Claude en tire) et une tâche
  « Refaire : … » est datée au jour du retour (`workItems`, donc Rappels par le raccourci).
- Connecteur de Claude : `get_exos`, `add_exos`, `log_exos` (`lib/mcp-exos.ts`). Hermes : rien.
- Vérifié : 105 fichiers de tests, 1618 réussis + 1 échec attendu antérieur, `tsc`, lint, build (polices Google simulées) ; navigateur réel
  à 1180 px et 390 px avec données fictives : écrans, case → Raté + piège (tentative, erreur, tâche datée créées), lien collé, séance.
- NON vérifié : sur l'iPad de l'élève, les trois outils contre la vraie base, un vrai lien BEOS (format d'adresse supposé).
- Attention avant le déploiement : l'ancienne version de l'app ne connaît pas `exos` ; ne pas remplir le catalogue en base avant que la
  nouvelle version soit en production sur tous les appareils.
- Mise en service (2026-11-20, demande de l'élève : « je veux qu'on l'utilise dès ce soir ») : catalogue écrit par SQL dans `chapterNotes`
  (révision 10 → 11, garde de révision, cours et méthodes conservés) : m2-evn 26 entrées (Freslon ch. 4 exos 4.1–4.17, BEOS 7094, TD du prof
  Suites–EVN exos 1–5, 15, 17, 19), m2-series-compl 14 (Freslon 7.1–7.6, 8.1–8.8), m2-suites-fonctions 9 (Freslon 9.1–9.8, BEOS 8900),
  m2-reduction 15 (Freslon 2.1–2.14, BEOS 8463). Questions comptées dans le corrigé du manuel (heuristique). Numéros BEOS relevés dans des
  oraux blancs publiés ; l'adresse exacte d'un exo BEOS n'est pas connue : le lien ouvre BEOS, on y cherche le numéro.
- 5 tâches ajoutées pour le soir du 2026-11-20 (`workItems`, révision 48 → 49, donc Rappels) : Freslon 4.3, 4.4, 4.11, 4.15 et BEOS 7094.
- À faire : sujets d'écrit Wikiprepa par chapitre (pages non lues : l'élève n'était pas là pour autoriser leur lecture), manuels de physique
  (Fiat 5,4 Mo et Beury 22 Mo, trop lourds pour la lecture Dropbox), Monier (5,9 Mo), Coutens et Gozard.
- Physique ce soir (demande de l'élève : thermo, diffusion, 1er principe en système ouvert) : catalogue `p2-thermo-ouverts` 9 entrées et
  `p2-diffusion` 7 (révision 11 → 12) ; `workItems` 49 → 50 : 20:00 cours systèmes ouverts + Anki physique, 20:30 CCINP MP 2021 III.2
  Q18–Q25, 21:15 cours diffusion thermique, 21:35 CCINP MP 2026 partie V Q20–Q29 ; les 5 tâches de maths décalées au 2026-11-21 14:00–15:35.
  Plusieurs adresses Wikiprepa construites sur le modèle d'adresses vérifiées : NON vérifiées.
- Correctif (`234c642`, 2026-11-20) : l'élève signale une erreur à l'ouverture d'Exos sur l'iPad, non reproduite sous Chromium. Corrections
  issues d'un audit : écran d'erreur lisible `app/(app)/exos/error.tsx` (message, digest, pile, bouton « Copier le message »), rendu côté
  client seul (montage), ids SVG sans « : » (Safari), service worker `v6`, colonnes de sources vides masquées. Vérifié : 1618 tests, `tsc`,
  lint, build ; déployé READY sur `taekdhub` et `taekdhub-vcrx`. Cause réelle NON confirmée : attendre le texte de l'écran d'erreur s'il revient.
- Liens directs (`8fc1d07`, 2026-11-20, accord de l'élève) : `questionUrl` (ancre Wikiprepa `#qN` par question) et `resumeQuestion`
  (première question jamais faite, sinon première à revoir) dans `lib/exos.ts` ; bouton « Ouvrir Qn ↗ » dans la fiche de notation et la
  séance ; le lien de la carte d'annale s'ouvre sur la question où reprendre. 3 tests ajoutés (1621 réussis). Déployé READY sur `taekdhub`.
- Données (`chapterNotes` 12 → 14) : liens BEOS directs `https://beos.prepas.org/sujet.php?id=N` pour 7094, 8463, 8900 (vérifiés : bons
  concours et chapitres) ; 53 exos Freslon reliés à l'aperçu Dropbox du livre (adresse d'aperçu du propriétaire, AUCUN lien de partage créé),
  la page reste affichée. Les 15 sujets Wikiprepa du catalogue ouverts un par un : tous existent, numéros de questions conformes
  (attention : sur certains sujets Banque PT B 2020-2021, l'ancre ne suit pas le numéro affiché ; aucun dans le catalogue).
- Reste : sujets Wikiprepa des autres chapitres, manuels de physique, ouverture d'un PDF à la bonne page (Dropbox ne le permet pas sur iPad).
- Onglet « Classiques » (`8bfac42` → `8a4ee98`, 2026-11-20, accord de l'élève) : `app/api/wikiprepa` lit côté serveur une page de
  chapitre Wikiprepa (`?chapitre=<slug>`, cache un jour ; `?liste` = tous les chapitres ; `?resume` = comptes), `lib/wikiprepa.ts` la
  réduit aux cartes de questions (épreuve, Qn, lien `#qN`, badge Incontournable, temps, difficulté) ; en maths, Wikiprepa ne liste que des
  sujets entiers (pas d'ancre par question, corrigés PDF externes) : on liste les sujets. `lib/wikiprepa-map.ts` : chapitre du programme →
  pages Wikiprepa (tous les chapitres sauf m1-logique). Écran `components/exos/exos-classiques.tsx` : incontournables groupés par sujet,
  MP/MPI d'abord, filtre « Toutes » et « MP seulement » ; tap = ouvre le corrigé à la question et la range dans le catalogue (comparaison
  des liens sans ancre corrigée dans `addLinks`), question déjà suivie = fiche de notation. Contrôlé en production : systèmes ouverts
  280 questions / 60 incontournables, diffusion thermique 654 / 135, oxydoréduction 240 / 58, topologie-evn 177 sujets. 1624 tests.
  NON vérifié : l'écran lui-même sur l'iPad (pas de capture faite, pour économiser).
- Booleanopera (`dacf18c`) : chaque chapitre de maths renvoie à son parcours « Cours » (`booleanoperaUrl`, `lib/wikiprepa-map.ts`) depuis les
  onglets d'Exos ; Booleanopera garde son propre suivi Acquis / À revoir, rien n'est recopié. Anki (PC de l'élève, 2026-11-20) : 92 notes
  en double jamais révisées supprimées, 1116 notes étiquetées `doublon-a-trier`, base vérifiée, envoi forcé vers AnkiWeb (choix de l'élève).
- Classiques maths et info (2026-11-20, l'élève : « tu as l'autorisation de tout faire ») : banque d'oral CCINP MP rangée par chapitre
  (répartition 2025-2026 publiée par le lycée Schweitzer) dans `chapterNotes` (révision 14 → 15, 113 cases « Banque CCINP · exo N »,
  source `autre`, lien vers la page officielle des oraux). Programme (`ed0b662`) : 7 chapitres Informatique TC et 5 Informatique Spé
  (OCaml), avec leurs algorithmes classiques en questions de cours ; Exos affiche « Info ». Catalogue info (révision 15 → 16) : 34 cases
  « Classique : … » écrites APRÈS la mise en ligne de `ed0b662`. NON fait : tri des 1116 notes Anki `doublon-a-trier` (choix de l'élève).
- Exos rangés par matière (2026-11-20, `7d63999`) : /exos ouvre sur un dossier par matière (Maths, Physique, Chimie, Info TC, Info Spé)
  avec chapitres avec exos, cases faites/total et à revoir ; chapitres spé puis sup dans l'ordre du programme, les chapitres sans exos
  repliés dans « Autres chapitres ». Graphiques en dessous ; le filtre Maths/Phys./Chimie/Info s'applique aussi aux dossiers.

## 2026-11-20 — Catalogue Exos enrichi (données Supabase, chapterNotes rev 18 → 20)
- Freslon, *Exercices incontournables MP* (manuel, sommaire du PDF Dropbox, questions = [] faute de décompte fiable) : 99 exos ajoutés — m2-groupes-anneaux 15 (ch. 1), m2-euclidiens 10 (ch. 3), m2-calcul-diff 18 (ch. 5 + 13), m1-convexite 3 (ch. 6), m2-series-entieres 14 (ch. 10), m2-integration 5 (11.1–11.5), m2-integrales-parametre 7 (11.6–11.12), m2-equadiff 11 (ch. 12), m2-probas 16 (ch. 14–15). Le livre est désormais couvert en entier.
- Annales Wikiprepa (parties entières vérifiées sur le corrigé) : CCINP PC MP 2022 P. I → p2-mecanique, P. VII → p2-diffusion ; CCINP PC MP 2023 P. III → p2-electrostatique, P. V → p2-electronique, P. VII → p2-optique-ondulatoire, P. VIII → c2-piles-electrolyse.
- Autres livres de /Prépa MP/ (Monier, Gozard, Beury, Fiat) > 5 Mo : non lisibles via Dropbox fetch, non traités.

## 2026-11-20 (soir) — Exos : rendu PC refait (`5293da6`, branche `claude/exos-pc-refonte`, NON fusionnée)
- Écran `/exos` (`components/exos/exos-overview.tsx`, `exos.css`) : séance du jour, maîtrise et statuts passent AU-DESSUS du catalogue ; filtre de matière (Tout / Maths / Physique / Chimie / Info) remonté dans l'en-tête ; dossiers par matière sans cadre blanc dans un cadre blanc ; cartes chapitre à hauteur égale (année, à revoir, cases faites/total, maîtrise, barre) avec les 4 sources toujours visibles (Annales, BEOS, Manuels, TD : pointillé « — » si rien n'est rangé) ; ligne « couverture » par matière ; police Inter à défaut de SF Pro (Windows). Aucune logique de calcul modifiée. Vérifié : captures Chrome 1440 / 1180 / 390 px avec un catalogue de test aux mêmes comptes que la base, tsc, eslint, 1625 tests.
- AUDIT du catalogue (Supabase `chapterNotes`, 2026-11-20) : maths = 0 annale, 3 entrées BEOS (evn, réduction, suites de fonctions), le reste en manuels (Freslon) et TD/CCINP ; physique = annales seules (diffusion 9, thermo ouverts 9, 4 chapitres à 1 sujet), aucun manuel/BEOS/TD ; chimie = 1 chapitre (piles) ; info = TD/classiques seulement. `p1-thermo` a une note sans exo. Wikiprepa « Classiques » : en direct, physique-chimie ; maths/info non marqués.
- Reste à décider avec l'élève : ordre de remplissage (annales de maths par chapitre, BEOS par chapitre, manuels de physique, Monier/Gozard/Beury/Fiat trop lourds pour Dropbox fetch).

### 2026-11-20 (nuit) — Catalogue : 148 annales de maths ajoutées (données, pas de code)
- Écriture directe dans Supabase `user_collections` (collection `chapterNotes`), révision 20 → 21, ajout seul (dédup par url), `updatedAt` des notes touchées mis à jour.
- 13 chapitres de maths (m2-*) ont maintenant 10 à 14 annales Wikiprepa chacune (CCINP, Centrale, Mines-Ponts, E3A, X-ENS, ENSAE) ; liens `/concours/ecrit/<slug>`.
- Chaque entrée = un sujet entier (cas unique, `questions` vide) ; le découpage par question reste à faire.
- Reste : BEOS par chapitre, annales physique-chimie (p1-thermo, c2-piles-electrolyse, etc. quasi vides), manuels physique, info/OCaml (0 annale), liens Hadamard/Booleanopera. Amélioration code possible : `exoFromUrl` pour les URLs maths sans `/corrige`.
- Ne pas fusionner `claude/exos-pc-refonte` sans accord explicite.

### 2026-11-20 (nuit, suite) — Catalogue : physique-chimie, chimie, info (données Supabase, pas de code)
- `chapterNotes` révision 21 → 24, ajout seul (dédup par préfixe d'url), 62 notes (7 créées vides pour les chapitres sans note : magnétostatique, Maxwell, ondes EM/mécaniques, quantique, thermo stat, courbes i-E).
- Physique-chimie : ~315 sujets Wikiprepa (`/concours/ecrit/<slug>/corrige`, MP/MPI en priorité, PC/PSI en complément) sur tous les chapitres p1-*, p2-*, c1-*, c2-* ; plus aucun chapitre à 0 exo (485 annales au total).
- Info : Wikiprepa n'a qu'un chapitre info (`informatique-en-mathematiques`) → 5 sujets CCINP Maths 2 MP ajoutés à `i-python-complexite`.
- Chaque entrée est un sujet entier (une case). Découpage question par question à faire plus tard (la page Wikiprepa donne les parties).
- Reste : BEOS (accès à beos.prepas.org non autorisé en session, à relancer), exos de manuels (physique, chimie) et oraux info/OCaml (BEOS), chapitres encore à ≤3 exos : i-sql, o-*, i-ia-jeux, i-prog-dyn, i-recursivite, m1-convexite, p1-circuits, p1-machines.

### 2026-11-20 (nuit, fin) — Catalogue : BEOS (62 oraux) + état des manuels
- `chapterNotes` révision 24 → 25 : 62 exos BEOS (MP/MPI, maths surtout, 4 en physique) rangés par chapitre, lien `https://beos.prepas.org/sujet.php?id=N`, mots-clés relevés sur la page. Total BEOS dans le catalogue : 65.
- BEOS n'a pas d'URL de recherche exploitable : les numéros viennent de recherches web ciblées (`allowed_domains=beos.prepas.org`) puis lecture des métadonnées. Couverture partielle, à compléter par thème.
- Manuels : Freslon déjà entièrement dans le catalogue (152 exos avec pages). Monier-Haberer, Fiat, Beury, Gozard, Coutens (Dropbox, `/Prépa MP/...`) dépassent la limite de lecture (5 Mio) et le shell n'a pas accès aux liens Dropbox (proxy 403) : non lisibles depuis la session. Piste : dossier connecté depuis l'app desktop, ou sommaires collés.
- Reste : BEOS info/OCaml et physique (peu indexés), manuels hors Freslon, chapitres de sup en maths.

### 2026-11-20 (nuit, fin 2) — Catalogue : 23 ressources web info/OCaml/circuits
- `chapterNotes` révision 25 → 26 : 23 entrées source "autre" (TP/TD/sujets corrigés de cahier-de-prepa.fr, fortierq.github.io, Doc-Solus Centrale 2025, ENS prépa oral…) dans o-automates, o-graphes, o-arbres-tas, o-logique, o-ocaml, i-sql, i-prog-dyn, i-recursivite, p1-circuits. Ids `web-*`. Liens vers documents entiers (`questions` vide).
- Toujours maigres : i-ia-jeux (3), i-recursivite (3), p1-machines (2) : rien de fiable trouvé.
- Reste ouvert : manuels hors Freslon (PDF Dropbox > 5 Mio).

### 2026-11-20 (nuit, fin 3) — Liaisons Booleanopera et Anki (code, commit d58fc91)
- Booleanopera : pas d'API (pages rendues côté serveur, aucun JSON). Signet `javascript:` à lancer sur booleanopera.fr connecté : il lit `/classe/<pseudo>` et rouvre TaekdHub sur `/exos#bo=…` (fragment, jamais envoyé à un serveur, aucun mot de passe). Relevé rangé dans `preferences.booleanopera` (collection `preferences`, donc synchronisé, pas de migration). Ligne « Booleanopera » + bouton « Mettre à jour » en haut de /exos. Le compte Taekd était quasi vide le 2026-11-20 (1 brique en cours).
- Anki : relevé AnkiConnect automatique à l'ouverture de /anki sur ordinateur si le dernier relevé complet a plus de 6 h ; silencieux si Anki est fermé. AnkiWeb n'a pas d'API : rien de ce côté.
- Vérifié : tsc, eslint, 108 fichiers de tests (1631 réussis + 1 échec attendu). NON vérifié : le signet sur le vrai site (page testée en lecture seulement), l'auto-relevé avec un vrai Anki, `next build` (polices Google inaccessibles dans le bac à sable). Non déployé, pas de PR.
- Cahier de prépa (mp-pascal) : connecté dans le navigateur intégré ; dossiers Informatique TC et Mathématiques, programme de colles, agenda. Rien de lu ni de relié.
