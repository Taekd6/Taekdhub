# Carnet de bord TaekdHub

> Lu en premier à chaque session, avec `git status`. Si ce carnet et le dépôt divergent,
> le signaler et se fier au dépôt. Dernière mise à jour : 2026-10-21, commit de code `7213c06`.
> Les PR #28 à #32 sont FUSIONNÉES dans `main` (PR #32 : merge `718084b`, production Vercel « Ready ») ; les paragraphes « PR #28 ouverte » plus bas sont périmés.
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
propre ; l'élève a créé `CAPTURE_TOKEN` et `MCP_USER_ID` (Production) ; PR #32 FUSIONNÉE le 2026-10-21 sur accord explicite de l'élève (« fusionne toi ») après contrôles verts sur la dernière tête ; déploiement de production `Ready` (commit `718084b`), appels réels de la route non testés. Pas fait : appel réel
d'Hermes (hors de portée de Claude : l'agent est chez l'élève), révocation du jeton et du contournement de test (à faire par l'élève),
rappel d'import Anki au démarrage (AnkiConnect n'existe que sur ordinateur, Anki ouvert : rien à automatiser côté navigateur sans
l'élève présent).

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
