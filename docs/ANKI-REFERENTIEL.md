# Anki et référentiel de cours : index et état des lieux

Point d'entrée unique. Il remplace la lecture croisée des rapports successifs et signale ce qui est périmé.
Dernière consolidation : voir `git log -- docs/ANKI-REFERENTIEL.md`.

## 1. Sources réellement accessibles (état vérifié le 2026-10-17)

| Ressource | Accessible ? | Utilisée pour |
|---|---|---|
| `data/course-cards.json` (117 cartes), `data/demonstrations*.json` (8) | oui, dans le dépôt | `AUDIT-ANKI-MATHS.md` |
| Export JSONL de ta collection **sans anglais** (Maths MP 1 309 notes, Physique 757, Chimie 96, Informatique 0) | oui, téléversé (hors dépôt, jamais committé) | audit, et **base de toutes les cartes de maths** : chaque note est reprise, corrigée ou complétée |
| Sauvegarde `.colpkg` d'origine | non | : |
| Cours de B. Landelle (CH01 à CH07), cahier-de-prepa.fr | **oui, lus** | recoupement (`LANDELLE-CH0k`) |
| Cours de Mickaël Prost (21 polycopiés), mickaelprost.fr | **oui, lus** | recoupement (`PROST-…`) |
| Programmes officiels MP et MPSI 2021 | **oui, lus sur une copie hébergée par mickaelprost.fr** (non comparée au BO ; le site du ministère répond 403) | exigibilité (`PROGRAMME-MP-2021`, `PROGRAMME-MPSI-2021`) |
| Colle ENS (Izquierdo), 1 page | oui, lue | exigibilité des séries |
| Programme officiel de physique-chimie MP (annexe 2, 2021) | **oui, lu sur une copie hébergée par cahier-de-prepa.fr (MP Buffon)**, non comparée au BO | exigibilité (`PROGRAMME-PC-MP-2021`) |
| Cours publics de physique-chimie (lycées ISM, La Fayette, Champollion, ENS/LPENS, Poincaré, autres), notes Lesbre 2018 (ancien programme) | **oui, lus** (un à deux cours par chapitre, voir `referentiel/sources/*.json`) | recoupement (`PC-…`, `ISM-PC-…`, `LESBRE-MP-2018`) |
| Informatique (cours) | non traitée au-delà de l'esquisse | : |

Aucun PDF n'est copié dans le dépôt (`referentiel/_cache/` est ignoré par git). Le détail est dans `referentiel/sources.json`.
L'anglais est hors périmètre : aucun fichier d'anglais n'a été lu.

## 2. Les documents, leur statut

| Document | Contenu | Statut |
|---|---|---|
| `docs/AUDIT-ANKI-MATHS.md` | audit des 117 cartes + 8 démonstrations **livrées par TaekdHub** | **Valable** pour ces cartes. Son §0 (« ta collection n'est pas accessible ») est **périmé** : voir `AUDIT-COLLECTION-ANKI.md`. |
| `docs/AUDIT-COLLECTION-ANKI.md` | audit de **ta** collection (export sans anglais) : inventaire, erreurs vérifiées, couverture, forme des cartes | **Valable** (≈ 200 cartes lues une à une, le reste par mesures automatiques). |
| `docs/ANKI-PILOTE-SERIES-NUMERIQUES.md` | pilote v1, 46 cartes | **Remplacé** par la v2 (conservé pour mémoire). |
| `referentiel/` | méthode, registre des sources, cartes par chapitre | **Référence vivante.** |
| `referentiel/maths/algebre-lineaire/` | `cartes*.jsonl` (283) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/calcul-differentiel/` | `cartes*.jsonl` (83) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/complexes-polynomes/` | `cartes*.jsonl` (122) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/determinants/` | `cartes*.jsonl` (82) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/endomorphismes-euclidiens/` | `cartes*.jsonl` (82) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/equations-differentielles/` | `cartes*.jsonl` (82) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/espaces-prehilbertiens/` | `cartes*.jsonl` (100) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/espaces-vectoriels-normes/` | `cartes*.jsonl` (198) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/fonctions-vectorielles/` | `cartes*.jsonl` (48) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/fondements-probabilites/` | `cartes*.jsonl` (120) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/integrales-generalisees/` | `cartes*.jsonl` (103) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/integrales-parametre/` | `cartes*.jsonl` (63) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/moments-variables-aleatoires/` | `cartes*.jsonl` (51) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/rappels-mpsi-algebre/` | `cartes*.jsonl` (140) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/rappels-mpsi-analyse/` | `cartes*.jsonl` (245) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/reduction/` | `cartes*.jsonl` (138) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/series-entieres/` | `cartes*.jsonl` (71) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/series-numeriques/` | `cartes*.jsonl` (123) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/structures-algebriques/` | `cartes*.jsonl` (172) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/suites-series-fonctions/` | `cartes*.jsonl` (76) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/maths/techniques-asymptotiques/` | `cartes*.jsonl` (53) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/info/complexite-tri/` | `cartes*.jsonl` (24) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |

| `referentiel/physique/analyse-vectorielle/` | `cartes*.jsonl` (30) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/conducteurs-induction/` | `cartes*.jsonl` (38) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/diffusion-thermique/` | `cartes*.jsonl` (44) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/dipole-rayonnant/` | `cartes*.jsonl` (13) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/dipoles/` | `cartes*.jsonl` (23) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/electrocinetique-alo/` | `cartes*.jsonl` (58) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/electronique-numerique/` | `cartes*.jsonl` (22) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/electrostatique/` | `cartes*.jsonl` (43) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/equations-de-maxwell/` | `cartes*.jsonl` (49) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/magnetostatique/` | `cartes*.jsonl` (29) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/ondes-em-vide/` | `cartes*.jsonl` (36) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/ondes-mecaniques/` | `cartes*.jsonl` (19) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/ondes-plasmas-conducteurs/` | `cartes*.jsonl` (34) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/optique-geometrique/` | `cartes*.jsonl` (14) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/optique-ondulatoire/` | `cartes*.jsonl` (52) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/physique-quantique/` | `cartes*.jsonl` (37) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/physique-statistique/` | `cartes*.jsonl` (27) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-induction-mpsi/` | `cartes*.jsonl` (7) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-mecanique-point/` | `cartes*.jsonl` (26) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-mpsi-physique/` | `cartes*.jsonl` (0) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-ordres-de-grandeur/` | `cartes*.jsonl` (19) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-particules-chargees/` | `cartes*.jsonl` (8) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-physique-quantique-mpsi/` | `cartes*.jsonl` (3) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/rappels-thermodynamique-mpsi/` | `cartes*.jsonl` (28) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/referentiels-non-galileens/` | `cartes*.jsonl` (36) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/signaux-filtrage/` | `cartes*.jsonl` (30) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/systemes-de-points-solide/` | `cartes*.jsonl` (54) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/physique/thermodynamique/` | `cartes*.jsonl` (57) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/chimie/electrochimie-courbes-iE-corrosion/` | `cartes*.jsonl` (25) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/chimie/electrochimie-redox-piles/` | `cartes*.jsonl` (13) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/chimie/rappels-mpsi-chimie/` | `cartes*.jsonl` (38) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/chimie/thermochimie-premier-principe/` | `cartes*.jsonl` (18) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |
| `referentiel/chimie/thermochimie-second-principe-equilibres/` | `cartes*.jsonl` (34) + `validation.md` | Cartes reprises de ta collection, recoupées ; voir le rapport du dossier. |

## 2 bis. Bilan chiffré (2 435 cartes de maths + 24 d'informatique)
- 1 309 notes de ta collection (maths) : 1 260 retrouvées dans le champ `anciennes` de cartes du référentiel ; les 49 autres sont les 5 notes écartées avec motif (hors programme) dans `espaces-vectoriels-normes/validation.md`, plus les 46 notes de séries numériques traitées dans `cartes-v2.jsonl` (qui n'a pas de champ `anciennes`).
- Origine des cartes : 938 scindées, 784 réécrites, 518 nouvelles, 37 corrigées, 34 fusionnées, 18 reprises telles quelles, le reste rédigé sans note d'origine.
- Validation : 2 317 cartes citent au moins une source lue, 118 n'en citent aucune (résultat vérifié à la main) ; 2 244 ont une exigibilité « confirmée : figure dans … », 175 sont « à confirmer ».
- Les erreurs de ta collection trouvées au passage (une trentaine, voir les `validation.md`) sont corrigées dans les nouvelles cartes ; ta collection n'a pas été modifiée.
- Contrôle qualité : voir `docs/CONTROLE-QUALITE-REFERENTIEL.md`.
- Paquet à importer à la main : `public/anki/taekdhub-referentiel.apkg` (identifiants dérivés de l'id de carte). Régénération : `python3 scripts/referentiel/referentiel.py deck`.

## 2 ter. Bilan physique-chimie (962 + 2 cartes)
- 853 notes de ta collection (757 de physique dont 117 « M&P - Physique » presque toutes sans verso, 96 de chimie) : **toutes** retrouvées dans le champ `anciennes` des cartes du référentiel (aucune écartée sauf motif documenté dans les `validation.md`).
- 834 cartes de physique (23 chapitres) et 128 de chimie (5 chapitres) ; 906 citent au moins une source lue, 56 non (résultat vérifié à la main) ; 616 ont une exigibilité confirmée par le programme 2021, 346 sont « à confirmer » ou hors programme (rappels MPSI, hors programme explicite, absent des sources).
- Erreurs de ta collection corrigées (une soixantaine, détaillées dans chaque `validation.md`) : unités manquantes ou fausses, signes `<` `>` perdus à l'export, formules sans condition de validité, ordres de grandeur faux (ex. nombre d'oscillations d'un RLC ≈ Q/π, moment dipolaire de l'eau ≈ 1,85 D).
- **Limites réelles** : un seul cours rédigé récent pour plusieurs chapitres (économie de ressources) ; l'électrochimie (Nernst, piles) et le dipôle magnétique n'ont qu'une source partielle ; l'induction n'a que des questions de cours comme source ; plusieurs cours Champollion/La Fayette sont des PDF image sans texte (non lus) ; les ordres de grandeur ajoutés sont à recouper.

## 3. Contradictions relevées et résolues
- **« Ta collection n'est pas accessible »** (`AUDIT-ANKI-MATHS.md`) contre un audit de ta collection (`AUDIT-COLLECTION-ANKI.md`) : l'export JSONL a été fourni entre les deux ; le premier rapport porte sur les cartes du dépôt, le second sur ta collection.
- **Nombre de cartes de séries numériques** : 31 + 24 (première version du rapport de collection) corrigé en **25 cartes de cours + 21 démonstrations** après recomptage.
- **Pilote v1 (46 cartes) contre v2 (61)** : la v2 corrige P1 à P5, scinde des cartes à plusieurs faits et réintègre les faits perdus ; la v1 n'était pas un sur-ensemble des 25 cartes d'origine.

## 4. Règles qui s'appliquent à tout le chantier
1. Anglais : jamais lu, compté, exporté, modifié (un garde-fou automatique refuse tout fichier qui en porte le nom : `lib/referentiel-cartes.test.ts`).
2. Aucune modification de ta collection Anki personnelle ; aucun import automatique ; les identifiants des cartes existantes ne changent pas.
3. Trois niveaux de validation par carte : vérifié mathématiquement / confirmé par une source / exigibilité à confirmer.
4. Une carte = une connaissance. Pas de recto qui n'est qu'un nom de théorème.
5. Pas de déploiement, pas de fusion dans `main`.

## 5. Intégration à TaekdHub (état du 2026-10-19)
- **Diagnostic.** Les paquets `TaekdHub::Référentiel::<matière>::<chapitre>` sont rattachés aux chapitres du programme par une table EXPLICITE (`lib/referentiel-decks.ts`, 43 chapitres) consultée par le pont Anki (`lib/anki-mapping.ts`). 14 paquets restent « non classés » (plusieurs chapitres possibles, ou aucun). Le choix manuel de l'élève prime ; les alias historiques du programme ne sont pas modifiés. Les révisions et échecs du référentiel s'additionnent à ceux des paquets de cours du même chapitre (`ankiByChapter`, utilisé par le diagnostic et Next Move). Garde : `lib/referentiel-decks.test.ts`.
- **Recherche pour les assistants.** Outil MCP en lecture seule `chercher_referentiel` (`lib/referentiel-search.ts`) : matière, chapitre, id de carte, recto/verso, exigibilité, sources LUES (titre, auteur, url publique ; jamais de page) et avertissements explicites (aucun résultat, résultats partiels, sans source, « à confirmer »). Index : `data/referentiel-index.json`, généré par `python3 scripts/referentiel/referentiel.py index` ; `lib/referentiel-search.test.ts` échoue s'il diverge des `.jsonl`. **Après toute modification d'un `cartes*.jsonl` ou d'un registre de sources, relancer la commande `index`.**
- **Reste à faire.** Aucun lien dans l'interface entre une erreur du journal et les cartes ciblées du référentiel (seul l'outil MCP le permet) ; aucune ingestion de documents de cours : les pages et sections précises ne sont pas conservées.
