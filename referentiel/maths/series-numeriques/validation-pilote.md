# Séries numériques : rapport de validation du pilote

**Mise à jour : version 2 des cartes produite (voir §8 et `cartes-v2.md`).** Les §1 à §7 décrivent l'état du pilote v1 et restent valables pour les sources.

Statut : **validation partielle. Le croisement de sources n'a pas pu être fait** (voir §1). Ce rapport contient ce qui a pu être vérifié
sans sources externes, et il le dit à chaque ligne. Aucune généralisation à d'autres chapitres tant que tu n'as pas tranché (§7).

Documents liés : cartes d'origine (ta collection, paquet « 02 - Procédés sommatoires discrets », 25 cartes « Séries numériques »),
pilote proposé (`docs/ANKI-PILOTE-SERIES-NUMERIQUES.md`, 46 cartes), registre des sources (`referentiel/sources.json`).

## 1. Sources : ce qui a réellement été fait

| Étape demandée | Résultat |
|---|---|
| Retrouver les cartes du pilote et les sources déjà utilisées | **Fait.** Le pilote dérive uniquement des 25 cartes d'origine ; **aucune source externe n'avait été utilisée** (le pilote le disait). |
| Programme officiel de MP | **Non lu.** Une recherche a remonté une URL candidate (`education.gouv.fr/media/25094/download`) dont je ne peux pas confirmer l'identité, et un arrêté de 2013 qui est un **ancien** programme. |
| Au moins deux cours de professeurs de CPGE | **Identifiés, non lus** : polycopié de B. Landelle (deux versions du même auteur, donc une seule source indépendante), programme de colle du lycée Buffon (MP*), feuille de colle de l'ENS (Izquierdo). |
| Manuels de référence | **Non consultables.** Je n'en cite aucun : je n'en ai consulté aucun. |
| Sources complémentaires pour les démonstrations | Un cours universitaire (A. Yger, 2007) repéré ; non lu. |

**Cause : la politique réseau de cet environnement refuse l'accès à tous ces hôtes** (réponse 403 à la connexion, constatée pour
`cahier-de-prepa.fr`, `www.education.gouv.fr`, `cache.media.education.gouv.fr`, `www.math.ens.psl.eu`, `fr.wikipedia.org`, `arxiv.org`).
Je ne contourne pas cette règle. La recherche web fonctionne, mais elle ne renvoie que des titres, des adresses et des résumés :
**un résumé de moteur de recherche n'est pas une source** (je ne m'en sers pas pour confirmer un énoncé).

Conséquence : **aucun résultat n'est « confirmé par plusieurs sources »**, il n'y a ni « source unique », ni « divergence entre
sources » à rapporter. Annoncer le contraire serait inventer.

## 2. Ce qui a pu être fait sans sources : vérification interne

Méthode : relecture des 25 cartes d'origine et des 46 cartes du pilote, démonstration ou contre-exemple de chaque énoncé par raisonnement
mathématique. **Statut : `vérifié en interne` (plus faible que `confirmé`)** : c'est mon raisonnement, pas un croisement de sources, et
il ne dit rien sur ce que ton cours ou le programme exigent.

### 2.1 Les 46 cartes : exactitude
- **Aucune erreur mathématique trouvée** dans les 46 cartes. Vérifications faites en détail, par exemple :
  encadrement série-intégrale (cartes 29 et 30 : le calcul de la somme redonne bien `∫₀ⁿ f + f(n) ≤ ∑ ≤ f(0) + ∫₀ⁿ f`) ;
  `I − Iₙ₊₁ ≤ Rₙ ≤ I − Iₙ` (carte 34) ; `Hₙ` encadré par `ln(n+1)` et `1 + ln n` (35) ; équivalent de ∑1/kᵅ pour α < 1, y compris
  α ≤ 0 (36) ; règle du nᵅuₙ avec α ≤ 1 (19) : `nᵅuₙ → +∞` donne `uₙ ≥ 1/n` à partir d'un rang, donc divergence ;
  `1/n² ~ 1/(n−1) − 1/n` donne `Rₙ ~ 1/n` (44).
- **Nuances à corriger** (formulations trop catégoriques ou incomplètes) :

| # | Carte | Problème | Correction proposée | Confiance |
|---|---|---|---|---|
| P1 | 3 : « Que deviennent la nature et la somme si on retire un nombre fini de termes ? » | « La somme change » est vrai *en général* ; elle ne change pas si les termes retirés ont pour somme 0. | « La nature ne change pas ; la somme varie de la somme des termes modifiés (donc en général). » | haute |
| P2 | 26 : critère des séries alternées | « La somme a le signe de u₀ » : à entendre au sens large (≥ 0). | Préciser « au sens large » (ou : S est du signe de u₀). | haute |
| P3 | 31 : f décroissante positive | Il manque « continue par morceaux » (hypothèse de l'intégrale). | Ajouter l'hypothèse. | haute |
| P4 | 17 : signe constant pour comparer par équivalent | Pas d'exemple. La carte d'origine en donne un. | Ajouter : ∑sin(1/n²) converge, ∑sin(1/√n) diverge. | haute |
| P5 | 41 : « pourquoi la suite de référence doit-elle être de signe constant ? » | Le verso (« sans cela c'est faux ») ne dit rien d'apprenable. | Remplacer par un contre-exemple, ou fusionner avec les cartes 39/40 (hypothèse « v ≥ 0 apcr »). Je n'en ai pas rédigé : je n'ai pas de contre-exemple dans les cartes d'origine. | moyenne |

### 2.2 Les 25 cartes d'origine → les 46 cartes : ce qui a été perdu
Les 25 cartes d'origine sont **toutes** couvertes (correspondance ci-dessous), mais le pilote **n'est pas un sur-ensemble** : il a laissé tomber des
faits présents dans les versos d'origine. **Ce que le pilote ne dit pas à tort (« rien ajouté ») ne veut pas dire « tout repris ».**

| Carte d'origine | Cartes du pilote |
|---|---|
| Série, sommes partielles, convergence | 1, 2, 3 |
| Séries géométriques | 4 |
| Lien suite-série : télescopiques | 5, 6 |
| Linéarité ; parties réelle et imaginaire | 8, 9 |
| Divergence grossière | 10, 11, 12 |
| Reste d'une série convergente | 7 |
| Séries à termes positifs : sommes partielles | 13 |
| Critère spécial des séries alternées | 26, 27 |
| Série harmonique alternée | 28 |
| Convergence absolue ⇒ convergence | 23, 24 |
| Comparaison des séries à termes positifs | 14, 15, 16, 17 |
| Méthode : série quelconque par comparaison avec \|uₙ\| | 25 |
| Critère de d'Alembert | 20, 21, 22 |
| Comparaison série-intégrale : encadrements | 29, 30 |
| Comparaison série-intégrale : nature et série des wₙ | 31, 32 |
| Séries de Riemann et règle du nᵅuₙ | 18, 19 |
| Méthode : estimer sommes partielles et restes | 33, 34, 35 |
| Équivalents des sommes partielles et restes de Riemann | 36 |
| Constante d'Euler | 37, 38 |
| Sommation des relations de comparaison : divergence | 39, 41 |
| Sommation des relations de comparaison : convergence | 40 |
| Lemme de Cesàro | 42, 43 |
| Méthode : équivalent par sommation des équivalents | 44 |
| Produit de Cauchy : définition | 45 |
| Produit de Cauchy : séries absolument convergentes | 46 (+ 47 optionnelle) |

**Faits des cartes d'origine absents du pilote** (à décider carte par carte) :

| # | Fait perdu | Carte d'origine | Proposition |
|---|---|---|---|
| L1 | Encadrement avec p ≥ 1 : `∫ₚⁿ⁺¹ f ≤ ∑ₖ₌ₚⁿ f(k) ≤ ∫ₚ₋₁ⁿ f` ; et inégalités **inversées** pour f croissante | Comparaison série-intégrale : encadrements | Créer une carte (la version p = 0 seule ne suffit pas pour Riemann). |
| L2 | Développement affiné `Hₙ = ln n + γ + 1/(2n) + o(1/n)` | Constante d'Euler | Carte à part, marquée **exigibilité non établie** (je ne sais pas si le programme l'exige). |
| L3 | Exemples d'application de d'Alembert : ∑n!/nⁿ converge ; ∑zⁿ/n! converge absolument ∀z∈ℂ | Critère de d'Alembert | Carte « exemple ». |
| L4 | « Accélération » : `\|S − (Sₙ + 1/n)\| ≤ 1/(n(n+1))` pour ∑1/k² | Méthode : estimer sommes partielles et restes | Carte à part, exigibilité non établie. |
| L5 | Si ∑vₙ diverge, ∑λvₙ diverge ⇔ λ ≠ 0 | Linéarité | Intégrer à la carte 8. |
| L6 | Dans une algèbre de dimension finie, si ab = ba : exp(a+b) = exp a · exp b | Produit de Cauchy | Carte à part ; à relier au chapitre « Équations différentielles » (exponentielle de matrice). |
| L7 | **Preuves** : série harmonique alternée (intégrale `∫₀¹ (1−(−t)ⁿ)/(1+t) dt`), règle du nᵅuₙ, Cesàro, constante d'Euler. | Versos « Preuve / Remarque » | Hors cartes de cours : tes **21 cartes de démonstration** les traitent déjà ; non reprises ici volontairement. |

## 3. Couverture du chapitre

Ce que je peux dire **sans le programme** : le pilote couvre ce que tes cartes d'origine couvrent, et rien de plus. Ce que je ne peux pas dire :
si le programme exige autre chose. Pistes à confirmer **sur le programme officiel lu** (ne sont pas des constats) :

- **Séries à valeurs vectorielles** (dimension finie) : les titres de section de l'ancien programme de 2013 parlaient de « séries numériques et vectorielles » ;
  tes cartes ne traitent que ℝ et ℂ. À vérifier dans le programme actuel avant de créer quoi que ce soit.
- **Familles sommables, dénombrabilité** : traitées dans le même paquet, hors du périmètre « séries numériques » de ce pilote.
- Notions que **je pense** hors programme de MP (séries de Bertrand, règle de Raabe-Duhamel, transformation d'Abel) : non vérifié, donc rien n'est écarté ni ajouté.

## 4. Divergences détectées entre sources

**Aucune : aucune source n'a été lue.** Pas de divergence de notation, de formulation ni de mathématiques à rapporter. Les points du §2 sont des
défauts internes des cartes, pas des écarts entre sources.

## 5. Conformité au cours

Non évaluée, et ne le sera pas : je n'ai pas ton cours. Le référentiel final ne prétendra pas reproduire ton professeur.

## 6. Ce qui est prêt maintenant

- La structure `referentiel/` et ses règles (`referentiel/README.md`), le registre des sources (`referentiel/sources.json`).
- Les corrections P1 à P5 et les faits perdus L1 à L7 : prêts à être intégrés dans une version 2 des cartes du pilote (non appliqués : rien n'a été
  modifié dans les cartes).

## 7. Ce qu'il me faut pour continuer

**Option A (la plus simple)** : autoriser l'accès réseau à ces hôtes dans les réglages de l'environnement (Network access, Allowed domains) :
`cahier-de-prepa.fr`, `www.education.gouv.fr`, `cache.media.education.gouv.fr`, `www.math.ens.psl.eu`. Optionnel : `cours.ip2i.in2p3.fr`.

**Option B** : téléverser toi-même dans la conversation les PDF utiles : le programme officiel de MP (section séries et familles sommables), au moins deux
polycopiés de professeurs de CPGE différents (pas deux versions du même auteur), et, si tu y as accès, le chapitre « séries » d'un manuel (pages choisies par toi).

**Option C** : je poursuis sans sources externes (vérification interne seulement). Je ne recommande pas de l'appeler « référentiel croisé ».

Je ne passe à un autre chapitre qu'après ton accord sur ce rapport.


## 8. Version 2 : corrections, faits réintégrés, doublons

Fichiers : `cartes-v2.jsonl` (source de vérité, une carte par ligne) et `cartes-v2.md` (tableau généré). Les 25 cartes d'origine de ta collection
ne sont ni modifiées ni supprimées ; le pilote v1 (`docs/ANKI-PILOTE-SERIES-NUMERIQUES.md`) est conservé tel quel.

### 8.1 Les trois niveaux de validation
| Niveau | État final |
|---|---|
| **Vérifié mathématiquement** (par raisonnement) | **61 cartes sur 61**. |
| **Confirmé par une source** (document effectivement consulté, avec référence) | **0 carte.** Aucune source consultée : l'accès réseau reste refusé. Aucune référence n'est donnée, aucune conformité au programme n'est affirmée. |
| **Exigibilité à confirmer** | **4 cartes** explicitement marquées : `sn-36` (f croissante), `sn-49` (développement affiné de Hₙ), `sn-50` (accélération pour ∑1/k²), `sn-61` (exp(A+B)). Pour les 57 autres : « dans tes cartes d'origine ; programme non consulté », ce qui n'établit **pas** l'exigibilité. |

### 8.2 P1 à P5 : corrections appliquées
| # | Problème résolu | Correction | Contrôle mathématique |
|---|---|---|---|
| P1 | « La somme change » est faux si les termes retirés ont une somme nulle. | « La nature ne change pas ; la somme varie de la somme des modifications ; en général elle change. » | S′ = S + ∑(u′ₖ − uₖ) sur les rangs modifiés : la nature ne change pas (un nombre fini de termes), la somme varie de cette quantité, nulle seulement si les modifications se compensent. |
| P2 | « Signe de u₀ » ambigu. | S du signe de u₀ au sens large (S ≥ 0) ; Rₙ du signe de (−1)ⁿ⁺¹uₙ₊₁ au sens large ; \|Rₙ\| ≤ uₙ₊₁ ; carte scindée (convergence / signes et reste). | uₙ ≥ 0 décroissante vers 0 : S ≥ 0 ; Rₙ est encore une série alternée du même type, de premier terme (−1)ⁿ⁺¹uₙ₊₁. Au sens large : si u₀ = 0 alors uₙ = 0 pour tout n. |
| P3 | Hypothèse « continue par morceaux » manquante (carte 31). | Ajoutée à la carte. | Nécessaire pour que ∫ₙ₋₁ⁿ f existe. |
| P4 | Pas d'exemple pour la comparaison par équivalent. | Ajout : ∑sin(1/n²) converge, ∑sin(1/√n) diverge. | sin x ~ x en 0 et les termes sont positifs (apcr) : équivalents à 1/n² (convergente) et 1/√n (divergente). |
| P5 | Verso « sans cela c'est faux » n'apprend rien. | Remplacée par un contre-exemple : uₙ = (−1)ⁿ + 1/n, vₙ = (−1)ⁿ (n ≥ 1). | uₙ/vₙ = 1 + (−1)ⁿ/n → 1 donc uₙ ~ vₙ ; ∑vₙ diverge grossièrement ; Sₙ = ∑ₖ₌₁ⁿ(−1)ᵏ + Hₙ ~ ln n ; Σₙ = ∑ₖ₌₁ⁿ(−1)ᵏ ∈ {−1, 0} est bornée, donc Sₙ n'est pas équivalente à Σₙ. Contre-exemple de ma construction, **il n'est pas dans tes cartes**. |

### 8.3 L1 à L9 : décision pour chaque fait perdu
(L8 et L9 sont deux faits perdus de plus que j'ai trouvés en recomparant les versos d'origine : `ζ(x) ~ 1/(x−1)` et l'exemple ∑1/(k ln k).)

| # | Fait | Décision | Raison |
|---|---|---|---|
| L1 | Encadrement avec p ≥ 1 ; cas f croissante | **Réintégré** (2 cartes) ; le cas croissant marqué « exigibilité à confirmer » | Nécessaire pour les restes de Riemann ; la carte p ≥ 1 donne d'autres bornes que la carte p = 0 (complémentaires, pas doublons). |
| L2 | Hₙ = ln n + γ + 1/(2n) + o(1/n) | **Réintégré**, « exigibilité à confirmer » | Vrai ; hors énoncé principal de la constante d'Euler. |
| L3 | Exemples de d'Alembert | **Réintégré** (1 carte) | Montre comment calculer le rapport ; un seul exemple par type suffit. |
| L4 | Accélération de ∑1/k² | **Réintégré**, « exigibilité à confirmer » | Technique d'exercice, valeur pédagogique moyenne ; à supprimer si le programme ne la demande pas. |
| L5 | ∑λvₙ diverge ⇔ λ ≠ 0 | **Réintégré** (carte à part) | Évite une carte à trois faits (carte 8 scindée en trois). |
| L6 | exp(a+b) = exp a · exp b si ab = ba | **Réintégré**, « exigibilité à confirmer » | Vrai pour des matrices (produit de Cauchy + binôme) ; relève aussi du chapitre sur les équations différentielles. |
| L7 | Preuves (harmonique alternée, Cesàro, Euler, d'Alembert…) | **Non réintégré** | Les 21 cartes de démonstration du paquet les traitent déjà (intitulés vérifiés). **À vérifier** : je n'ai pas vu de carte de démonstration dédiée à la règle du nᵅuₙ ni à l'accélération. |
| L8 | ζ(x) ~ 1/(x−1) en 1⁺ | **Réintégré** (1 carte) | Vrai : 1/(x−1) ≤ ζ(x) ≤ 1 + 1/(x−1) donc (x−1)ζ(x) → 1. |
| L9 | ∑ₖ₌₂ⁿ 1/(k ln k) ~ ln ln n | **Réintégré** (1 carte) | Exemple type de la méthode série-intégrale avec une primitive non puissance. |

### 8.4 Doublons pédagogiques traités
- Cartes 10 et 11 du pilote v1 (« si ∑uₙ converge alors uₙ → 0 » et sa contraposée) : **fusionnées** en une carte, c'est une seule connaissance.
- Règle du nᵅuₙ : le troisième cas (uₙ ~ ℓ/nᵅ) **supprimé** de la règle, car il se déduit de « uₙ ~ vₙ ⇒ même nature » et de la règle de Riemann.
- Cartes complémentaires **conservées séparées** (bornes ou questions différentes) : encadrements p = 0 et p ≥ 1 ; d'Alembert (énoncé / ℓ = 1 / rapport < 1 ne suffit pas / exemples) ; sommation (énoncé / contre-exemple de signe).
- **Recouvrements restants à surveiller** : la carte « exemple Hₙ » et « Riemann α = 1 » disent toutes deux Hₙ ~ ln n (la première montre la méthode, la seconde le résultat général) ; le piège « uₙ = O(vₙ) » et le contre-exemple du produit de Cauchy sont indépendants.

### 8.5 Différences avec le pilote v1
| | v1 | v2 |
|---|---|---|
| Nombre de cartes | 46 (+ 1 optionnelle) | **61** |
| Cartes scindées (une connaissance par carte) | — | carte 8 (en 3), 19 (en 2), 26 (en 2), 34 (en 2), 36 (en 2), 46 (en 2) |
| Cartes fusionnées | — | 10 + 11 |
| Cartes remplacées | — | 41 (par un contre-exemple) |
| Faits réintégrés | — | L1 (2), L2, L3, L4, L5, L6, L8, L9 |
| Corrections de formulation | — | P1 à P4 |

### 8.6 Ce qui reste à vérifier
1. **Programme officiel non consulté** : exigibilité de tout ce chapitre à confirmer, en particulier `sn-36`, `sn-49`, `sn-50`, `sn-61`, la constante d'Euler, la sommation des relations de comparaison et le produit de Cauchy.
2. **Séries à valeurs vectorielles** : absentes des cartes d'origine ; à confirmer sur le programme actuel.
3. **Conformité à ton cours** : non évaluée.
4. **Rendu Anki** (MathJax, indices Unicode) : non testé ; aucun import.
5. **Démonstrations** : pas de carte dédiée pour la règle du nᵅuₙ, la carte d'accélération et le développement affiné de Hₙ.
6. **Croisement de sources** : toujours 0 source lue (accès réseau refusé) ; aucune divergence entre sources à rapporter.


## 9. Complément (sources lues)

Fichier : `cartes-suite.jsonl`, 62 cartes `sn-62` à `sn-123` (chapitre `series-numeriques`). Les 61 cartes de `cartes-v2.jsonl` ne sont pas modifiées. Revue des 83 notes du paquet « 02 - Procédés sommatoires discrets », de PROST-SOMMATION et de LANDELLE-CH02.

### 9.1 Sources lues
LANDELLE-CH02 et PROST-SOMMATION lus en entier (sections I à VII pour Prost ; I et II pour Landelle). Les fiches `mp_mathematiques.txt` et `mpsi_mathematiques.txt` (sections séries, familles sommables, dénombrabilité) ont été lues mais leurs ids PROST-MP-MATHEMATIQUES et PROST-MPSI-MATHEMATIQUES sont **absents de `sources.json` au moment du contrôle** : non cités dans les champs `source`. Aucune source web supplémentaire n'a été utilisée pour ce chapitre.

### 9.2 Ce qui manquait (62 cartes)
- **Dénombrabilité et familles sommables** (cartes `sn-86` à `sn-123`) : les 31 notes de la collection sur ce thème (ensembles dénombrables, sommabilité positive et complexe, paquets, Fubini, contre-exemples, réarrangement) n'avaient aucune carte dans les 61 ; elles sont reprises ici, avec en plus des exercices de PROST-SOMMATION (exercices 12 à 15).
- **Compléments sur les séries** (`sn-62` à `sn-85`) : inégalité sur les sommes, encadrement u ≤ v ≤ w, structure d'espace vectoriel, séries vectorielles (programme MP), plan d'étude, série de Bertrand, alternées (définition, encadrement de Rₙ, approximation, contre-exemple sans décroissance, Abel/Dirichlet HP), comparaison série-intégrale (piège e^{−t}, √k, f′ intégrable), développement affiné de Hₙ (démonstration), Cesàro et suites récurrentes (Landelle).
- Total : 62 cartes, dont 27 sans note d'origine (nouvelles).
- Notes ch02 toutes traitées : séries (25 + 21 démonstrations) → `cartes-v2.jsonl` ; dénombrabilité/familles (8 « Cours 2.x » et 31 notes) → `cartes-suite.jsonl`.

### 9.3 Erreurs et défauts dans les 61 cartes existantes (non corrigés)
1. `sn-31` : « quelles hypothèses sont nécessaires ? » : la décroissance et la limite nulle sont **suffisantes**, pas nécessaires (la limite nulle l'est ; la décroissance ne l'est pas, ex. une alternée non monotone peut converger). Contre-exemple utile pour la décroissance : voir `sn-75`.
2. `sn-48` : preuve seulement esquissée (le O(1/n²) de 1/(n+1) − ln(1+1/n) n'est pas justifié) ; compléter par le DL de ln(1+x).
3. `sn-16` : demande des termes positifs alors qu'un signe constant à partir d'un rang suffit (nuance, pas une erreur).
4. `cartes-v2.jsonl` n'a pas le champ `anciennes` (schéma v1) : le lien note → carte n'y est pas porté.
Aucune erreur mathématique grave trouvée dans les 61 cartes (chaque énoncé a été recalculé).

### 9.4 Défauts des notes d'origine de la collection (ch02)
- Note 1667856646656 (sommation par paquets) : « u₁ » au lieu de « uᵢ » ; énoncé seulement pour I = I₁ ⊔ I₂.
- Note 1668809953864 (comparaison de familles) : énoncé mal formé (indices I ⊂ J, (uᵢ, vⱼ)).
- Notes 1668813179550 (Fubini) et 1668817308292 : même numéro « 2.3.4 » ; l'hypothèse « (u_{i,j})_{i∈I} sommable » est mal écrite.
- Note 1790095284030 (paquets) : correcte.
