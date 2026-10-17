# Audit de la collection Anki personnelle (maths, physique, chimie)

Rapport distinct de `docs/AUDIT-ANKI-MATHS.md` (qui portait sur les cartes livrées par TaekdHub, pas sur ta collection).
Lecture seule : le fichier fourni n'a pas été modifié, aucune carte, aucun identifiant n'a été touché.

## 0. Source et périmètre réels

- **Source** : `toutes_cartes_sans_anglais.jsonl` (2 162 cartes, 2 162 notes, 0 ligne invalide). Ce n'est pas le `.colpkg`
  d'origine mais un export JSON de ta collection ; je n'ai donc ni l'historique de révision, ni les médias, ni l'état
  suspendu/archivé des cartes (non présent dans le fichier).
- **Anglais** : le fichier ne contient aucun paquet d'anglais (je l'ai vérifié sur les **noms de paquets** uniquement :
  Maths MP, Physique MP, M&P - Physique, Chimie MP). Aucune carte d'anglais n'a été lue.
- **Informatique** : **aucun paquet d'informatique dans le fichier.** Si tu en as, ils n'ont pas été exportés.
- **Aucun cours PDF n'a été fourni.** Je n'ai donc **vérifié aucune carte contre ton cours** : « exact » signifie
  « exact d'après ma connaissance du programme de MP », jamais « conforme à ton cours ».
- **Ce qui a été examiné** : 100 % des cartes pour les mesures automatiques (types, longueurs, structure, doublons,
  couverture par mots-clés) ; **lecture intégrale** des 104 cartes de type « Normal » et des 26 cartes « MP MathJax » ;
  **lecture détaillée** de 25 cartes de séries numériques et de 26 autres cartes de maths tirées au hasard (chapitres 03, 07, 08,
  09, 10, 12, 15, 16, 18, 19) ; 18 cartes de physique/chimie tirées au hasard. **Soit environ 200 cartes lues une à une
  sur 2 162.** Je ne prétends pas avoir relu les autres.

## 1. Inventaire (cartes réellement analysées)

| Matière | Cartes | Cours | Démonstrations | Autres | Paquets |
|---|---|---|---|---|---|
| Mathématiques | **1 309** | 857 | 452 | 0 | « Maths MP », chapitres 00 à 21 |
| Physique | **757** | 532 | 108 | 117 (« M&P - Physique ») | « Physique MP » (00 à 17) + « M&P - Physique » |
| Chimie | **96** | 86 | 10 | 0 | « Chimie MP » (rappels + 4 chapitres) |
| Informatique | **0** | — | — | — | aucun paquet |
| **Total analysé** | **2 162** | | | | |

Types de notes (6 modèles différents pour 3 matières) : « Maths MP - Recto/Verso » 1 181, « Physique MP » 503, « Basique+ » 231,
« Basique++ » 117, « Normal » 104, « MP MathJax » 26. Les maths mélangent trois générations de cartes :
tes cartes d'origine (« Normal », LaTeX, numérotation de ton cours), 26 cartes « MP MathJax » atomiques et 1 181 cartes
« Recto/Verso » à blocs « Hypothèses / Conclusion / Piège / Remarque ».

### Mathématiques par chapitre
| Chapitre | Cours | Démos | Autres | Total |
|---|---|---|---|---|
| 00 - Rappels MPSI | 147 | 62 |  | 209 |
| 01 - Techniques asymptotiques | 10 | 4 |  | 14 |
| 02 - Procédés sommatoires discrets | 48 | 35 |  | 83 |
| 03 - Intégrales généralisées | 19 | 17 |  | 36 |
| 04 - Norme sur un espace vectoriel | 16 | 3 |  | 19 |
| 05 - Révisions d'algèbre linéaire | 128 | 52 |  | 180 |
| 06 - Déterminants | 26 | 19 |  | 45 |
| 07 - Éléments propres et réduction | 52 | 15 |  | 67 |
| 08 - Polynômes d'endomorphismes et réduction | 30 | 15 |  | 45 |
| 09 - Suites et séries de fonctions | 19 | 19 |  | 38 |
| 10 - Séries entières | 22 | 16 |  | 38 |
| 11 - Fondements des probabilités | 12 | 0 |  | 12 |
| 12 - Moments d'une variable aléatoire | 31 | 21 |  | 52 |
| 13 - Topologie des espaces vectoriels normés | 46 | 20 |  | 66 |
| 14 - Espaces préhilbertiens réels | 37 | 18 |  | 55 |
| 15 - Endomorphismes d'un espace euclidien | 27 | 18 |  | 45 |
| 16 - Intégrales à paramètre | 15 | 19 |  | 34 |
| 17 - Fonctions vectorielles | 13 | 7 |  | 20 |
| 18 - Équations différentielles linéaires | 20 | 11 |  | 31 |
| 19 - Calcul différentiel | 23 | 15 |  | 38 |
| 20 - Structures algébriques usuelles | 75 | 43 |  | 118 |
| 21 - Nombres complexes et polynômes | 41 | 23 |  | 64 |

### Physique par paquet
| Paquet | Cours | Démos | Autres | Total |
|---|---|---|---|---|
| 00 Rappels MPSI | 138 | 22 |  | 160 |
| 01 Mécanique - Référentiels non galiléens | 21 | 6 |  | 27 |
| 02 Mécanique - Système de points et solide | 38 | 8 |  | 46 |
| 03 Analyse vectorielle | 27 | 2 |  | 29 |
| 04 Électrostatique | 27 | 6 |  | 33 |
| 05 Dipôles électrostatique et magnétique | 17 | 4 |  | 21 |
| 06 Magnétostatique | 20 | 5 |  | 25 |
| 07 Équations de Maxwell | 18 | 4 |  | 22 |
| 08 Conducteurs et induction | 22 | 6 |  | 28 |
| 09 Ondes électromagnétiques dans le vide | 23 | 4 |  | 27 |
| 10 Ondes dans les plasmas et les conducteurs | 23 | 7 |  | 30 |
| 11 Diffusion thermique | 28 | 6 |  | 34 |
| 12 Thermodynamique - Principes et systèmes ouverts | 37 | 7 |  | 44 |
| 13 Physique statistique | 16 | 3 |  | 19 |
| 14 Optique ondulatoire - Interférences | 31 | 7 |  | 38 |
| 15 Physique quantique | 23 | 5 |  | 28 |
| 16 Électronique numérique | 12 | 3 |  | 15 |
| 17 Ondes mécaniques - Corde vibrante | 11 | 3 |  | 14 |

Les 117 cartes « M&P - Physique » sont réparties en 15 sous-paquets (Électrostat, Magnétostat, Thermo, Optique…).

### Chimie par paquet
| Paquet | Cours | Démos | Autres | Total |
|---|---|---|---|---|
| 00 Rappels MPSI | 27 | 0 |  | 27 |
| 01 Thermochimie - Premier principe | 11 | 2 |  | 13 |
| 02 Thermochimie - Second principe et équilibres | 28 | 4 |  | 32 |
| 03 Électrochimie - Rappels redox et piles | 7 | 2 |  | 9 |
| 04 Électrochimie - Courbes i-E et corrosion | 13 | 2 |  | 15 |

## 2. Ce que tu dis, confronté aux données

### « J'ai du mal à comprendre ce que la carte me demande » — **confirmé, et c'est le défaut principal**
- **Aucun des 857 rectos de cours de maths ne contient une question.** 832 sur 857 (97 %) sont un intitulé : « Séries
  numériques · Théorème Critère de d'Alembert », « Théorème 2.1.4 : Cas d'une famille de réel positifs indexée par N ».
  La carte ne dit pas si on attend l'énoncé, les hypothèses, la démonstration ou un exemple.
- **Le verso est un bloc entier** : « Hypothèses … Conclusion … Piège … Remarque … Preuve … » : médiane 383 caractères, 90 %
  des cartes sous 650, **120 cartes de cours au-dessus de 600 caractères**. On ne peut pas dire « je savais » ou « je ne savais
  pas » : une carte teste 4 ou 5 connaissances à la fois. Exemple : « Constante d'Euler » mélange l'énoncé, la généralisation à f
  positive décroissante, la preuve et le développement affiné.
- Les cartes de physique « Basique+ » (231) ont, elles, un recto-question court et un verso court : c'est le bon format.

### « Ces cartes me permettent pas d'apprendre le cours en vrai » — **fondé**
Le jeu est un **résumé de cours mis en cartes**, pas un parcours d'apprentissage :
- une seule carte par résultat, sans progression (définition → énoncé → hypothèses → exemple → contre-exemple → méthode) ;
- les démonstrations sont des plans de 3 à 5 lignes (452 en maths, toutes avec « Idée clé » et « Plan », 359 avec
  « Hypothèse qui sert ») : utiles pour réviser une preuve qu'on connaît, trop compactes pour la **comprendre**
  la première fois (le « pourquoi » de chaque étape est absent) ;
- pas de cartes « exemple / calcul type » séparées : les pièges et exemples sont enfouis dans le verso ;
- **Physique « M&P - Physique » : 114 des 117 cartes ont un verso vide ou « A retrouver »** (113 vides). Elles fonctionnent
  comme des invites à refaire au tableau, mais sans réponse on ne peut ni vérifier ni noter sa réussite.

### « Il n'y a pas tous les chapitres, typiquement rien sur les séries » — **en grande partie inexact pour les séries, plus nuancé ailleurs**
- **Séries numériques : 25 cartes de cours et 21 démonstrations existent**, mais elles sont rangées dans le paquet
  **« 02 - Procédés sommatoires discrets »**, dont le nom ne dit pas « séries » (série, reste, divergence grossière, alternées,
  d'Alembert, comparaison série-intégrale, Riemann, constante d'Euler, sommation des relations de comparaison, Cesàro, produit de
  Cauchy). Les séries entières (22 + 16) et les suites et séries de fonctions (19 + 19) ont aussi leurs paquets. Ce qui peut donner
  l'impression d'un manque : le nom du paquet, et le fait qu'il n'y a pas de parcours « séries numériques » séparé.
- **Suites dans les evn : présent mais mince et dispersé** : une carte « Convergence d'une suite dans un evn » et une
  « Convergence coordonnée par coordonnée » (paquet 04), « Suite de Cauchy », « Espace de Banach », deux cartes personnelles sur
  les valeurs d'adhérence, « Bolzano-Weierstrass » et « caractérisation séquentielle » (paquet 13). Je n'ai **pas trouvé** de carte
  dédiée à : suite extraite / sous-suite, unicité de la limite, opérations sur les suites convergentes d'un evn, complétude
  de 𝕂ⁿ. Ces absences viennent d'une recherche par mots-clés, à confirmer avec ton cours.
- **Chapitres maigres comparés à leur place dans le programme** : « 11 Fondements des probabilités » 12 cartes, **0 démonstration** ;
  « 01 Techniques asymptotiques » 14 ; « 17 Fonctions vectorielles » 20 ; « 18 Équations différentielles » 31 ; « 19 Calcul différentiel » 38.
  À côté, « 05 Révisions d'algèbre linéaire » en compte **180** et « 00 Rappels MPSI » 209.
- **Chimie** : 96 cartes seulement (rappels MPSI compris) : thermochimie et électrochimie sont les seuls chapitres MP présents.
- **Informatique** : aucune carte dans le fichier.
- **Ce que je ne peux pas dire** : si un chapitre manque par rapport au programme officiel ou à ton cours. Je n'ai ni l'un ni l'autre.

## 3. Erreurs vérifiées par lecture (cartes « Normal », tes cartes d'origine)

Sur les 104 cartes « Normal » lues en entier : **11 problèmes de fond ou de notation**, tous certains à la lecture du
texte (pas besoin du cours pour les établir), 4 d'entre eux sur des théorèmes majeurs. Les identifiants stables sont
les `card_id` du fichier.

| # | Carte | Constat | Correction proposée | Gravité |
|---|---|---|---|---|
| E1 | Corollaire 2.3.4 : **Fubini** (famille complexe) | Énoncé incohérent : « (I_j) partition de I » n'a rien à faire dans Fubini sur I×J ; l'hypothèse « (u_{i,j})_{i∈I} sommable » devrait être « (u_{i,j})_{(i,j)∈I×J} sommable ». Telle quelle, la carte fait apprendre un énoncé faux. | « Si (u_{i,j})_{(i,j)∈I×J} est sommable, alors pour tout i, (u_{i,j})_{j∈J} est sommable, (∑_j u_{i,j})_i est sommable et ∑_{(i,j)} u_{i,j} = ∑_i ∑_j u_{i,j} » (et symétriquement). | **À CORRIGER – prioritaire** |
| E2 | Théorèmes 2.1.8 : comparaison de familles sommables | Indices incohérents : « I ⊂ J », « (u_i, v_j)_{(i,j)∈I} », « ∀(i,j)∈I², u_i ≤ v_i », puis u_j pour j ∈ J alors que u est indexée par I. Le point 2 n'a pas de sens tel quel. | Reformuler avec une seule famille d'indices et l'inclusion I ⊂ J explicite. | **À CORRIGER – prioritaire** |
| E3 | Définition : **Transposition** | « ∀x ∉ ⟦1,n⟧, τ(x)=x » : devrait être ∀x ∈ ⟦1,n⟧∖{i,j} ; et i ≠ j manque. | Corriger les deux. | À CORRIGER |
| E4 | Définition : **Valeur d'adhérence** | La limite est notée l dans l'hypothèse et a dans la formule (`d(u_n, a) ≤ ε`). | a → l. | À CORRIGER |
| E5 | Théorème 2.1.5 : **Convergence dans un espace produit** | « u_n → l ⇔ ∀i, u_n^{(i)} → l » : il faut l_i, pas l. | l → l_i. | À CORRIGER |
| E6 | Théorème 1.1.7 : **Au plus dénombrable et surjections** | « A au plus dénombrable ⇔ ∃ surjection de ℕ vers A » est faux pour A = ∅ (aucune surjection depuis ℕ). | Ajouter « A non vide ». | À CORRIGER |
| E7 | Théorème 2.2.1 : **Sommation par paquets** | Dans la somme : « ∑_{i∈I_1} u_1 » au lieu de u_i. | u_1 → u_i. | À CORRIGER (coquille) |
| E8 | Théorème 2.1.5 : **Changement d'indice** | « (u_{φ(j)})_{j∈I} » au lieu de j∈J. | I → J. | À CORRIGER (coquille) |
| E9 | Définition : **p-cycle** | Les a_1,…,a_p ne sont pas dits deux à deux distincts. | Ajouter. | À CORRIGER |
| E10 | Définitions 3.2.2 : **monôme, polynôme** (applications) | Quantificateurs « ∀f ∈ 𝓕(E,𝕂), ∃(α_i)… » : lu littéralement, toute application serait un monôme. | « f est un monôme lorsque ∃ … ». | À CORRIGER |
| E11 | **Pascal** et **k·C(n,k) = n·C(n−1,k−1)** | Condition n ≥ 1 (resp. k ≥ 1) non dite. | Ajouter. | À CORRIGER (mineur) |

Autres observations (non critiques) : deux cartes portent le même numéro « 2.3.4 » (Fubini et inégalité triangulaire) ;
« Proposition 1.2.2 » et « Théorème 1.2.5 » : intitulés tronqués ; plusieurs fautes d'orthographe (« fonciton », « commutentes »,
« Propositon », « résprésente »). Les cartes « Donner les caractéristiques de l'air / de l'eau » testent 7 valeurs d'un coup (valeurs numériques exactes
d'après ce que je connais). **Aucune de ces cartes n'est CRITIQUE** au sens « résultat faux appris en confiance »,
mais E1 et E2 s'en approchent : ce sont des théorèmes de ton chapitre « Procédés sommatoires ».

## 4. Qualité des cartes générées (« Recto/Verso » et « MathJax »)

Sur les **51 cartes de maths lues** (25 séries numériques + 26 autres chapitres) et les 26 cartes MathJax : **aucune erreur
mathématique relevée**. Hypothèses explicites, pièges pertinents (ex. « scindé sur 𝕂 : X²+1 est à racines simples mais non
scindé sur ℝ », « la dimension finie n'est pas requise » pour le lemme des noyaux). Le contenu est solide ; **le défaut est
la forme (§2)**, pas l'exactitude. Réserve : 51 cartes sur 1 181 ; un taux d'erreur nul sur l'échantillon ne prouve pas
qu'il n'y en a aucune ailleurs.

## 5. Physique et chimie (échantillon de 18 cartes + mesures automatiques)

- Les cartes courtes sont bien formées. Aucune erreur relevée sur l'échantillon (valeurs : ε_H ≈ 10–50 kJ/mol, Michelson en coin d'air,
  déphasage par réflexion, premier principe industriel, dG, c_v/c_p de l'air…).
- **Problèmes réels** : (1) les 114 cartes sans verso de « M&P - Physique » (voir §2) ; (2) coquilles dans plusieurs cartes personnelles
  de chimie (« la somme est faites », « Ou la somme »), `mol{-1}` sans exposant correct dans la carte de l'air ; (3) cartes de
  chimie à plusieurs faits (« Donner la propriété de l'enthalpie molaire » : gaz parfait et phase condensée mélangés) ;
  (4) un doublon probable entre « Théorème d'Ampère généralisé » (Équations de Maxwell) et la carte de « Electromag - P ».
- **Non vérifiable ici** : conformité aux cours de physique et de chimie (aucun PDF), exactitude des 740 autres cartes
  que je n'ai pas lues.

## 6. Doublons

4 groupes de rectos identiques ou très proches sur 2 162 cartes (normalisation des 80 premiers caractères) :
« Algèbre et sous-algèbre » (2 cartes dans le même paquet), « Croissance comparée de exp en +∞ » (2), « Théorème d'Ampère généralisé »
(Maxwell / Electromag - P), « Filtre passe-bas » (2 sous-paquets M&P). **À examiner, rien à supprimer automatiquement** : deux
d'entre eux sont peut-être volontaires (révision depuis deux angles).

## 7. Priorités et plan d'action

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 1 | Corriger E1 et E2 (Fubini, comparaison de familles sommables), puis E3 à E11 | faible (≈ 15 cartes) | élevé : tu apprends sinon des énoncés faux |
| 2 | **Réécrire la forme des cartes de cours de maths** : un recto = une question précise (« Énoncer le critère de d'Alembert : hypothèses et conclusion ? »), un verso court ; scinder « Hypothèses / Conclusion / Piège / Exemple » en cartes séparées quand elles testent des faits différents | élevé | **le plus élevé** : c'est ta plainte principale |
| 3 | **Construire un parcours d'apprentissage par chapitre** (ordre : définition → énoncé → contre-exemple → méthode → démonstration en étapes), en commençant par un chapitre que tu veux vraiment apprendre | élevé | élevé pour « apprendre le cours en vrai » |
| 4 | Donner un verso aux 114 cartes « M&P - Physique » ou les assumer comme cartes « à refaire au tableau » avec un critère de réussite | moyen | moyen |
| 5 | Étoffer les chapitres maigres (probabilités fondements, fonctions vectorielles, équations différentielles, suites dans les evn) à partir de ton cours | moyen | selon ton cours |
| 6 | Renommer ou ajouter un sous-paquet « Séries numériques » dans « 02 - Procédés sommatoires » | très faible | retrouve ce que tu croyais absent |
| 7 | Informatique : à créer si tu veux des cartes ; à fournir si elles existent déjà | — | — |

Aucune de ces actions n'est appliquée : il s'agit de décider ensemble de l'ordre. Un exemple concret du format proposé (priorité 2 et 3) est dans `docs/ANKI-PILOTE-SERIES-NUMERIQUES.md` : 46 cartes dérivées de tes 25 cartes de séries numériques, sans rien ajouter qui n'y soit déjà.

## 8. Limites de l'audit

- Export JSON, pas le `.colpkg` : pas d'historique de révision, pas de suspensions, pas de médias ni d'images.
- **Aucun cours** : aucune conformité vérifiée, aucune exigibilité de démonstration affirmée.
- **≈ 200 cartes sur 2 162 lues individuellement** ; le reste par mesures automatiques (types, longueurs, doublons, mots-clés).
  Les résultats de couverture par mots-clés sont indicatifs (les expressions régulières peuvent rater une formulation).
- Physique et chimie : 18 cartes lues sur 853 ; chimie notamment très peu examinée.
- Aucune vérification sur AnkiMobile/AnkiDroid ; le rendu du HTML (`<div class="ch">`, `lab met`…) dépend du modèle de note
  de ta collection, que je n'ai pas.
- L'anglais n'a pas été ouvert, comparé ni compté.
