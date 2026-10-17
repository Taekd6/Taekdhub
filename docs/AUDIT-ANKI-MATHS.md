# Audit pédagogique des cartes Anki scientifiques de TaekdHub

Rapport en lecture seule : aucune carte, aucun paquet, aucune collection n'a été modifié.
Aucune correction n'est appliquée ; ce document sert à décider ensemble de l'étape suivante.

## 0. Périmètre réellement audité (à lire en premier)

**Ta collection Anki réelle et ta sauvegarde `.colpkg` ne sont pas accessibles dans cet environnement.** J'ai cherché
partout où je pouvais lire : aucun `.colpkg`, aucune collection personnelle, aucun dossier de téléversement avec un
export, aucun PDF de cours. Les seules collections présentes dans `/tmp` sont des profils d'essai que j'ai moi-même
créés lors des tests avec Anki ; je ne les ai pas ouverts, ils ne contiennent rien qui vienne de toi.

Ce que j'ai pu auditer **en totalité** : les cartes livrées par TaekdHub dans le dépôt, c'est-à-dire ce que le
bouton « Télécharger le paquet (.apkg) » et « Envoyer vers Anki » fournissent.

| Source | Contenu | Audité |
|---|---|---|
| `data/course-cards.json` | 117 cartes, 13 chapitres de maths de spé (MP), matière « Mathématiques » uniquement | **les 117, une par une** |
| `data/demonstrations.json` + `.notes.json` | 8 démonstrations (6 chapitres de spé, 2 de sup) | **les 8, étape par étape** |
| Physique, chimie, informatique | aucune carte dans le dépôt | **non auditable** : rien à lire |
| Anglais | hors périmètre | **non inspecté** : je n'ai ouvert, compté ni comparé aucune donnée d'anglais |

Conséquences à garder en tête :
- Si tu as importé ces paquets, ce rapport concerne bien les cartes de ta collection. **Mais ta collection contient sans
  doute d'autres cartes (les tiennes, celles de physique/chimie/info) : elles ne sont pas couvertes.** Je ne prétends
  donc pas avoir audité ta collection.
- **Aucun cours PDF n'était disponible.** Je n'ai donc comparé aucune carte à ton cours. Mes jugements d'exactitude
  reposent sur la connaissance générale du programme de MP. Le mot « conforme » n'est jamais employé ici au sens
  « conforme à ton cours ».
- Niveaux de confiance : **haute** = énoncé standard sur lequel aucun cours sérieux ne diffère ; **moyenne** = dépend
  de la rédaction exacte du cours ; **faible** = préférence ou point à confirmer avec ton cours.

## 1. Synthèse exécutive

- **Aucune erreur de fond (CRITIQUE) trouvée** dans les 117 cartes ni dans les 8 démonstrations : pas de résultat
  faux, pas de formule fausse, pas de confusion de notions détectée (confiance haute sur les points vérifiés,
  jugement sans source de cours).
- **14 cartes à corriger** (hypothèses ou conditions manquantes qui rendent l'énoncé faux ou imprécis tel qu'écrit).
  Les deux plus importantes pour une khôlle : la condition nécessaire d'extremum sans « f différentiable en a », et
  l'extremum sous contrainte sans « f, g de classe C¹ ».
- **Le problème pédagogique principal n'est pas l'exactitude mais la forme des questions** : sur 82 cartes
  « théorème », **80 ont pour recto le seul nom du résultat** (« Théorème chinois », « Variance », « Lemme des noyaux »).
  Le recto ne dit pas ce qu'on attend (énoncé ? hypothèses ? conclusion ?), ce qui rend l'auto-évaluation subjective.
- **Les démonstrations ne sont pas dans les cartes de cours** : 82 théorèmes, 8 démonstrations en notes séparées,
  7 chapitres de spé sur 13 sans aucune démonstration. La liste interne de TaekdHub recense 25 « démontrer / montrer »
  dans ces chapitres.
- **Aucun doublon strict.** Trois paires proches à examiner (compléments, à conserver séparées).
- **Couverture** : les 13 chapitres de spé ont des cartes. Il manque des notions que la liste interne de TaekdHub
  cite (polynôme minimal, isométries de l'espace, théorème de continuité croissante…). Voir §4 et §6.
- **Formules en texte brut** (aucun MathJax) : indices et sommes écrits à la main (`∑_{k=0}^n a_k b_{n−k}`), plus
  difficiles à lire et ambigus sur téléphone.

## 2. Inventaire non anglophone

| Matière | Paquet / source | Notes | Cartes | Chapitres identifiés | Suspendues / archivées |
|---|---|---|---|---|---|
| Mathématiques (spé MP) | `TaekdHub::Mathématiques::<chapitre>` (13 paquets, 1 par chapitre) | 117 | 117 (1 note = 1 carte, modèle Basic) | 13 / 13, tous reconnus | non vérifiable (cartes livrées, pas ta collection) |
| Mathématiques (démonstrations) | note de type « TaekdHub — Démonstration » | 8 | 8 | 8 (6 de spé, 2 de sup) | non vérifiable |
| Physique | — | 0 | 0 | — | rien dans le dépôt |
| Chimie | — | 0 | 0 | — | rien dans le dépôt |
| Informatique | — | 0 | 0 | — | rien dans le dépôt |

Types des 117 cartes (champ `kind`, devenu étiquette Anki) : **82 théorème, 18 méthode, 17 définition**.
Cartes sans chapitre déterminable : **0** (les 117 sont rattachées à un chapitre).
Cartes par chapitre : de 7 (intégrales à paramètre) à 12 (réduction). Le programme de maths compte 36 chapitres
(23 de sup + 13 de spé) : **13 sont couverts, 23 ne le sont pas** (chapitres de sup, hors spé).

| Chapitre (spé) | Cartes | Définition | Théorème | Méthode | Démonstration (banque) |
|---|---|---|---|---|---|
| Groupes, anneaux, idéaux | 10 | 2 | 7 | 1 | non |
| Compléments d'algèbre linéaire | 8 | 3 | 4 | 1 | non |
| Réduction des endomorphismes | 12 | 2 | 8 | 2 | oui (sous-espaces propres) |
| Espaces euclidiens | 9 | 1 | 7 | 1 | oui (valeurs propres d'un symétrique) |
| Espaces vectoriels normés | 9 | 2 | 6 | 1 | oui (image d'un compact) |
| Séries numériques et familles sommables | 9 | 1 | 7 | 1 | non |
| Suites et séries de fonctions | 9 | 2 | 5 | 2 | oui (limite uniforme continue) |
| Séries entières | 10 | 1 | 7 | 2 | oui (lemme d'Abel) |
| Intégration sur un intervalle quelconque | 8 | 1 | 6 | 1 | non |
| Intégrales à paramètre | 7 | 0 | 5 | 2 | non |
| Probabilités discrètes | 9 | 0 | **9** | **0** | oui (Markov, Bienaymé-Tchebychev) |
| Calcul différentiel | 9 | 1 | 7 | 1 | non |
| Équations différentielles linéaires | 8 | 1 | 4 | 3 | non |

Identifiants stables : pour les cartes de cours, le GUID Anki est `guid_for("taekdhub", chapterId, recto)` ; il est
donné ci-dessous pour chaque carte signalée. **Corriger un recto change le GUID, donc crée un doublon à la
réimportation** (voir §7, priorité 0). Les démonstrations ont des GUID stables `th-demo-<id>`.

## 3. Audit détaillé

Aucune anomalie CRITIQUE. Toutes les sources sont « connaissance générale, sans cours ». Format : `chapitre#n`
(rang de la carte dans le chapitre).

### 3.1 À CORRIGER — hypothèse ou condition manquante

| # | Carte (GUID) | Verso actuel (extrait) | Problème | Correction proposée | Confiance |
|---|---|---|---|---|---|
| C1 | `m2-calcul-diff#5` (`y7EaI86/Vh`) Condition nécessaire d'extremum local | « Extremum local en un point a intérieur (ouvert) ⇒ ∇f(a) = 0. Point critique ≠ extremum ! » | Manque « f différentiable en a ». Sans cela l'énoncé est faux (x ↦ \|x\| a un minimum en 0, pas de gradient). | « f différentiable en a (intérieur), extremum local en a ⇒ df(a) = 0, soit ∇f(a) = 0. Réciproque fausse. » | haute |
| C2 | `m2-calcul-diff#8` (`f(QK@o6=LE`) Extremum sous contrainte | « Si f\|g=0 a un extremum en a et ∇g(a) ≠ 0, alors ∇f(a) colinéaire à ∇g(a). » | Manque « f, g de classe C¹ sur un ouvert » ; « extremum » devrait être « extremum local ». | Ajouter les deux conditions. | haute |
| C3 | `m2-integration#5` (`PaCpo#lTA3`) Changement de variable | φ bijective C¹ strictement monotone, intégrales de même nature et égales | Manque « f continue (ou continue par morceaux) sur ]a, b[ ». | Ajouter l'hypothèse sur f. | haute |
| C4 | `m2-integration#6` (`D0*;)x:)mk`) IPP généralisée | « Si fg a des limites finies aux bornes : … » | Manque « f, g de classe C¹ sur ]a, b[ ». | Ajouter. | haute |
| C5 | `m2-probas#8` (`sT~i)XyPS]`) Fonction génératrice | « G_X(t) = E(t^X), rayon ≥ 1 … » | Manque « X à valeurs dans ℕ » (la définition n'a de sens que là). | « X à valeurs dans ℕ : G_X(t) = ∑ P(X=n) tⁿ. » | haute |
| C6 | `m2-series-entieres#3` (`L!vi%lU/4f`) Rayon par d'Alembert | « si \|a_{n+1}/a_n\| → ℓ, alors R = 1/ℓ » | Manque « a_n ≠ 0 à partir d'un rang » ; conventions 1/0 = +∞, 1/+∞ = 0 non rappelées. | Ajouter. | haute |
| C7 | `m2-series-entieres#5` (`O]M8,.)wSI`) Régularité de la somme | « C^∞ sur ]−R, R[ … ∑ n a_n z^{n−1} … » | Mélange la variable réelle (]−R, R[) et complexe (z) dans la même phrase. | Écrire en x réel sur ]−R, R[. | moyenne |
| C8 | `m2-series-compl#3` (`smGge=-#I3`) Comparaison série-intégrale | « ∫_n^{n+1} f ≤ f(n) ≤ ∫_{n−1}^n f » | La seconde inégalité n'a de sens que pour n ≥ n₀ + 1. | « pour n ≥ n₀ + 1 ». | haute |
| C9 | `m2-series-compl#7` (`be6Q0OFzhp`) Famille sommable | « Les sommes finies des \|aᵢ\| sont majorées. » | Manque « I dénombrable ». | Ajouter. | moyenne |
| C10 | `m2-probas#9` (`Ji>bH-Me]+`) Variance | « V(X) = E(X²) − E(X)² … V(X+Y) = V(X)+V(Y) » | Manque « X admet un moment d'ordre 2 » ; carte à trois faits (voir A2). | Ajouter l'hypothèse. | haute |
| C11 | `m2-integrales-parametre#3` (`B]:htsNwiC`) et `#4` (`BnLjaPDlJ%`) Continuité / dérivation | domination par φ intégrable | Préciser : φ continue par morceaux, positive, **indépendante de x** ; en #4, ∂f/∂x(x,·) continue par morceaux. | Compléter les hypothèses. | moyenne |
| C12 | `m2-suites-fonctions#4` (`b%T:g:SqT:`) Dérivation d'une limite | f_n C¹, … ⇒ f C¹ et f′ = g | Manque « I intervalle ». | Ajouter. | moyenne |
| C13 | `m2-groupes-anneaux#1` (`CW9c)o0.I7`) Ordre d'un élément | « xᵏ = e ⇔ ordre(x) divise k » | Vrai pour un ordre fini seulement ; le cas infini n'est pas dit. | « (x d'ordre fini) ». | moyenne |

### 3.2 À AMÉLIORER — carte correcte, peu efficace

| # | Constat | Cartes | Pourquoi c'est un problème | Amélioration proposée |
|---|---|---|---|---|
| A1 | **Rectos qui sont des étiquettes** | **80 des 82 cartes « théorème »** (ex. `m2-groupes-anneaux#7` « Théorème chinois », `m2-reduction#4` « Lemme des noyaux », `m2-probas#9` « Variance », `m2-equadiff#1` « Cauchy-Lipschitz linéaire »). Seules deux ont une vraie question (`m2-groupes-anneaux#2` et `#6`). | Le recto n'indique pas ce qu'il faut restituer (énoncé complet ? hypothèses seules ? conclusion ?). Impossible de juger la réponse « correcte ou incorrecte » objectivement. | Une question par connaissance : « Théorème chinois : hypothèse sur m, n et conclusion ? ». Pour les définitions (17), le recto « notion à définir » est acceptable. |
| A2 | **Versos à plusieurs faits** | 14 cartes avec ≥ 3 assertions : `m2-groupes-anneaux#1`, `#4` ; `m2-euclidiens#8` ; `m2-evn#6`, `#8` ; `m2-series-compl#1`, `#9` ; `m2-series-entieres#7`, `#8` ; `m2-probas#2`, `#3`, `#8` ; `m2-calcul-diff#7` ; `m2-equadiff#4` | Une carte qui teste trois faits est notée « ratée » dès qu'un seul manque, sans dire lequel. Cas typiques : `m2-equadiff#4` (définition de e^A, produit si commutation, det e^A = e^{tr A}) ; `m2-integration#2` et `#3` (deux intégrales par carte). | Scinder : une carte par fait, en gardant les cartes complémentaires séparées. Le critère est pédagogique, pas esthétique. |
| A3 | **Étiquettes de type inexactes** | au moins 9 cartes « théorème » qui sont des formules, lois ou valeurs de référence : `m2-series-entieres#7`, `#8`, `#9` (développements usuels), `m2-probas#2`, `#3` (lois), `m2-probas#9` (variance), `m2-integrales-parametre#6` (Gauss), `m2-integration#7` (Γ), `m2-integration#3` (références) | Le champ sert d'étiquette Anki (`taekdhub`, `cours`, `<type>`) : filtrer « théorème » mélange des lois de probabilité et des développements en série entière avec de vrais théorèmes. | Distinguer au moins « formule / loi » de « théorème ». Comptage fait à la main sur les cartes citées ; d'autres cas limites existent (ex. `m2-calcul-diff#2`). |
| A4 | **Pas de MathJax** | tout le jeu (16 occurrences d'indices `_{…}`, sommes, exposants en Unicode) | `∑_{k=0}^n a_k b_{n−k}` ou `a_{n+1}/a_n` sont lisibles sur grand écran mais ambigus sur téléphone et n'importent pas dans un éditeur LaTeX. | Écrire les formules en `\( … \)` (MathJax, pris en charge par Anki ; non testé ici sur AnkiMobile). |
| A5 | **Déséquilibre des types** | `m2-probas` : 9 théorèmes, **0 méthode, 0 définition** ; `m2-integrales-parametre` : 0 définition | Aucune carte « quand je vois… » pour les probabilités (ex. une somme de variables indépendantes, calculer E par ∑ P(X ≥ n)). | Ajouter quelques cartes méthode (voir §6). |
| A6 | `m2-lemme-abel` (démonstration, étape 4) | La conséquence « R ≥ \|z₀\| » est justifiée par « pour tout r < \|z₀\| la série converge » alors qu'elle découle directement de la définition de R (\|z₀\| appartient à l'ensemble dont R est la borne supérieure). | Correcte mais détournée ; la justification la plus courte est mieux mémorisable. | Réécrire l'étape 4. Confiance moyenne. |

### 3.3 Cartes proches, à examiner (aucune n'est à supprimer)

| Paire | Similarité | Verdict |
|---|---|---|
| `m2-integration#2` (Riemann) et `#3` (références) | 0,72 | Complémentaires (deux familles d'intégrales) ; à reformuler plutôt qu'à fusionner (voir A2). |
| `m2-probas#5` (Markov) et `#6` (Bienaymé-Tchebychev) | 0,62 | Complémentaires : la seconde se déduit de la première. À conserver séparées. |
| `m2-evn#4` (Heine) et `m2-suites-fonctions#7` (Weierstrass) | 0,62 | Faux positif : énoncés sans lien (formulation « toute fonction continue sur… »). |

**Doublons stricts (recto ou verso identiques) : 0.**

### 3.4 Les 8 démonstrations

Toutes relues pas à pas (hypothèses, ordre des étapes, justification de chaque passage, points critiques) :
**exactes**, hypothèses explicites, étapes dans l'ordre, cas limites signalés (y = 0 dans Cauchy-Schwarz, hypothèse de
dimension finie sur E seulement dans le théorème du rang, conjugaison dans le cas des matrices symétriques…).
Seule remarque : A6. **Limite importante** : chaque note précise que la rédaction est « à comparer avec TON cours » ;
je n'ai pas pu le faire. Un cours peut ordonner autrement les étapes sans que ce soit une erreur.

### 3.5 À CONSERVER

103 des 117 cartes n'ont aucun écart de contenu relevé (exactes, hypothèses suffisantes pour un énoncé de MP,
notations cohérentes). Exemples particulièrement solides : `m2-reduction#5` à `#7` (CNS de diagonalisabilité,
distinctes et complémentaires), `m2-reduction#9` (le spectre est inclus dans les racines, pas égal), `m2-reduction#12`
(méthode à partir d'une relation polynomiale), `m2-series-compl#5` (équivalent : « faux sans signe constant »),
`m2-series-entieres#3` pour la remarque sur les séries lacunaires, `m2-suites-fonctions#8` (non-convergence uniforme
par une suite x_n), `m2-evn#7` (ouvert/fermé par image réciproque).
Ces cartes restent à reformuler si A1 est retenu, mais leur contenu est à conserver.

## 4. Analyse de couverture

Référence utilisée : **la liste interne « questions de cours » de TaekdHub** (`lib/programme-data.ts`), pas ton cours
ni le programme officiel (non disponibles). Ce que j'affirme est donc : « la liste de TaekdHub le cite et aucune carte
ne le teste », rien de plus.

1. **Bien couvert** : groupes et anneaux (tous les points de la liste), réduction (CNS, Cayley-Hamilton, lemme des
   noyaux, trigonalisabilité), espaces euclidiens (hors espace), EVN, séries entières, convergence dominée, équations
   différentielles linéaires.
2. **Présent mais mal testé** : tout ce qui est visé par A1/A2/C1–C13, notamment le calcul différentiel (hypothèses
   manquantes en C1, C2), les intégrales à paramètre (C11), les probabilités (A5 et C5, C10).
3. **Insuffisamment couvert** : démonstrations (7 chapitres sur 13 sans aucune ; 8 démonstrations pour 25 « démontrer »
   dans la liste), et chapitres traités en une seule carte par résultat sans cas particuliers ni contre-exemples
   (suites/séries de fonctions : peu de contre-exemples classiques).
4. **Absent (cité par la liste interne)** : voir §6.
5. **Impossible à vérifier faute de source** : conformité à ton cours, exigibilité d'une démonstration (je n'ai pas
   le texte du programme officiel ni ton cours), niveau de détail attendu par ton professeur, chapitres de sup, et
   toute la physique, la chimie et l'informatique (aucune donnée).

## 5. Liste des cartes à corriger, par priorité

1. **Priorité 1** (l'énoncé est faux ou ambigu tel qu'écrit) : C1, C2 (calcul différentiel), C5 (fonction génératrice),
   C3, C4 (intégration), C10 (variance).
2. **Priorité 2** (hypothèse standard manquante) : C6, C8, C13.
3. **Priorité 3** (précision de cadre, dépend de ta rédaction de cours) : C7, C9, C11, C12.

Chaque correction change le recto ou le verso : **le GUID ne change que si le recto change** (voir §7).

## 6. Cartes à créer (justifiées par la liste interne de TaekdHub)

À confirmer avec ton cours avant d'écrire quoi que ce soit.

| # | Notion absente | Justification | Chapitre | Confiance |
|---|---|---|---|---|
| N1 | Polynôme minimal : existence, unicité, divise tout polynôme annulateur | « Existence et propriétés du polynôme minimal » est dans la liste ; les cartes `m2-reduction#3`, `#5` utilisent π_u sans le définir | algèbre linéaire / réduction | moyenne |
| N2 | Ker P(u) ∩ Ker Q(u) = Ker (P∧Q)(u) | listé | algèbre linéaire | moyenne |
| N3 | Réduction des isométries de l'espace (O₃) | liste : « du plan et de l'espace » ; seule O₂ a une carte (`m2-euclidiens#8`) | euclidiens | moyenne |
| N4 | Sommation des relations de comparaison | listé, aucune carte | séries numériques | moyenne |
| N5 | Dérivation et intégration terme à terme d'une série de fonctions | listé pour la dérivation ; seule la version « suite » existe (`m2-suites-fonctions#3`, `#4`) | suites et séries de fonctions | moyenne |
| N6 | Théorème de continuité croissante (et décroissante) | listé, aucune carte | probabilités | moyenne |
| N7 | Cartes « méthode » en probabilités (3 à 4) | A5 : 0 méthode sur 9 cartes | probabilités | moyenne |
| N8 | `dim E_λ ≤ multiplicité de λ` | **non listé ; ajout fondé sur mon seul jugement** : la carte `m2-reduction#6` n'en parle pas, or c'est le piège classique | réduction | faible, à confirmer |
| N9 | Formule de Taylor-Young à l'ordre 2 pour la hessienne | **non listé, jugement seul** : `m2-calcul-diff#7` l'utilise sans qu'elle soit testée | calcul différentiel | faible, à confirmer |

Démonstrations à ajouter à la banque : uniquement après avoir vérifié sur ton cours lesquelles sont exigibles ; je ne
les propose pas ici pour ne pas inventer une exigibilité.

## 7. Plan d'action recommandé (impact pédagogique / effort)

0. **Avant toute correction** : rendre les identifiants stables (un `id` par carte dans `course-cards.json`, GUID
   dérivé de cet id et non du recto). Sans cela, reformuler un recto crée un doublon dans Anki à la réimportation.
   Effort moyen, impact : protège les révisions déjà faites.
1. **Corriger les hypothèses** (C1 à C13) : ~14 cartes, effort faible, gain élevé en rigueur (c'est ce que sanctionne
   un khôlleur).
2. **Reformuler les rectos** (A1), en commençant par les chapitres les plus proches de tes échéances ; effort moyen,
   impact le plus fort sur l'efficacité de mémorisation.
3. **Scinder les cartes à plusieurs faits** (A2) puis passer les formules en MathJax (A4) ; vérifier le rendu sur
   ton téléphone.
4. **Créer N1 à N7** après confirmation avec ton cours.
5. **Auditer le reste de ta collection** (physique, chimie, informatique, tes propres cartes) : demande ton export,
   voir la méthode ci-dessous.

**Méthode pour la suite, sans écrire dans ta collection** : exporter la collection (Fichier › Exporter › « Collection
entière (.colpkg) »), la déposer dans le dépôt ou la téléverser, **ne pas me donner l'original**. Je travaillerais sur
une copie ouverte en lecture seule (SQLite `mode=ro`), en lisant d'abord uniquement les **noms de paquets** pour écarter
l'anglais avant d'ouvrir le contenu d'une seule note, puis en relevant notes, cartes, suspensions et étiquettes.
Si tu as les PDF de cours, dépose-les aussi : ils permettraient de vérifier la conformité et l'exigibilité.

## 8. Limites de l'audit

- **Pas ta collection** : seuls les 117 + 8 éléments livrés par TaekdHub ont été lus. Ta collection réelle (autres
  matières, cartes personnelles, suspensions, historique de révision, doublons éventuels) n'a pas été vue.
- **Pas de cours** : aucune carte n'a été comparée à un document de cours ; l'exactitude est un jugement fondé sur
  ma connaissance générale du programme de MP, non une vérification contre ta source.
- **Pas de physique, chimie, informatique** : aucune donnée à analyser.
- **Chapitres de sup** : aucune carte de cours livrée (13 chapitres de spé seulement) ; non audités.
- **Anglais** : volontairement non ouvert, non compté, non comparé.
- **Rendu réel** : pas de vérification du rendu des cartes sur AnkiMobile/AnkiDroid ; MathJax non testé.
- **Heuristiques** : les comptes de rectos « étiquette » (A1) et de versos « multi-faits » (A2) sont issus d'un test
  automatique simple, relu à la main sur les exemples cités ; l'ordre de grandeur est fiable, pas chaque cas limite.
- **Exigibilité** : je n'ai pas inventé d'exigibilité ; ce qui est dit « listé » vient de la seule liste interne de
  TaekdHub, qui n'est pas un texte officiel.
