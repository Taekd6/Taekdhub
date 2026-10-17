# Moments d'une variable aléatoire : rapport de validation

Statut : **51 cartes** `mv-01`…`mv-51` (`cartes.jsonl`), nées des 52 notes du chapitre 12 de l'utilisateur. Sources lues : PROST-PROBAS2 (cours de référence), PROST-PROBAS1, PROGRAMME-MP-2021 (copie hébergée du programme, non comparée au BO). Aucune autre source consultée.

## Bilan des 52 notes
- **33 notes « moments »** (espérance, linéarité, produit, moments, variance, covariance, Cauchy-Schwarz, corrélation, Markov/Bienaymé-Tchebychev, lois usuelles, fonctions génératrices, LFGN, ΣP(X≥n), démonstrations) : toutes reprises dans `mv-*` : 34 cartes **scindées**, 17 **réécrites**, 0 fusionnée, 0 écartée (voir `anciennes`). Quand une carte `pr-*` couvrait déjà l'énoncé (Markov, Bienaymé-Tchebychev, LFGN, définitions de ℬ, ℬ(n,p), 𝒢, 𝒫, G_X, transfert, linéarité…), la note est aussi listée dans `anciennes` de la carte pr-* et **aucun doublon n'a été recréé** : les cartes mv-* portent les démonstrations, pièges, contre-exemples et compléments absents de pr-*.
- **19 notes « fondements »** rangées dans son chapitre 12 : rapprochées de `pr-*` et complétées par `pr-50…pr-120` (voir `fondements-probabilites/validation.md`) ; aucune n'est écartée.
- Contenus ajoutés (loi 𝒰(⟦a,b⟧), V(aX+bY), taille d'échantillon par Tchebychev, Markov à l'ordre p, contre-exemple E(XY)=E(X)E(Y), cas d'égalité de Cauchy-Schwarz, fonction génératrice de 𝒰) : intégrés à des cartes « scindées » ou « réécrites » ; aucune carte purement nouvelle (0).

## Corrections par rapport aux cartes de l'utilisateur
- Loi géométrique : « p∈]0,1] » et absence de mémoire écrite « i.e. P(X>n)=(1−p)ⁿ » : la propriété n'a de sens que pour p<1 et le calcul de P(X>n) n'est pas une reformulation ; corrigé dans pr-24/27 et `mv-*`.
- Poisson : « converge en loi » : la convergence en loi est hors programme (programme : les modes de convergence ne figurent pas) ; remplacé par la convergence de chaque P(Xₙ=k) (voir `fondements-probabilites`, pr-*).
- Carte « Cov » : « Var(X)=0 seulement si p.s. constante » : formulation affaiblie (c'est une équivalence) ; reformulée en mv (piège sur le caractère non défini).
- Carte « Théorème de transfert pour l'espérance d'un produit » : mauvais intitulé (c'est E(XY)=E(X)E(Y) pour indépendantes) ; réécrite.
- Rectos « titres » (« Coefficient de corrélation linéaire. », « Probabilités · Définition… ») remplacés par de vraies questions ; versos multi-idées scindés.
- Démonstration de E(X)=G'(1) : l'intitulé citait le théorème d'Abel radial ; la preuve donnée utilise la convergence monotone de séries à termes positifs (le cours Prost utilise la convergence normale pour le sens direct) ; signalé dans `note`.

## Divergences entre sources
- LFGN : cours et programme = i.i.d. de variance finie ; la preuve ne demande que des variables deux à deux non corrélées (voir pr-38).
- Coefficient de corrélation : noté HP par Prost (seule l'inégalité de Cauchy-Schwarz figure au programme, avec cas d'égalité) ; cartes marquées en conséquence.
- Moments d'ordre p général (L^p) : HP chez Prost, seul L² au programme ; `mv-14` « à confirmer ».
- Uniforme 𝒰(⟦1,n⟧) : espérance/variance dans le cours Prost (la fiche de programme ne cite que géométrique et Poisson).

## Points à confirmer
- Markov à l'ordre p (`mv-` méthode) : calcul contrôlé mais absent des sources.
- Programme officiel : copie hébergée seulement.

## Niveau de validation
« vérifié » : hypothèses et cas limites relus ; contre-exemples (X uniforme sur {−1,0,1}, Y=X² ; X=±1 pour Markov) et calculs numériques (n≥2000 pour 0,05/5 %) contrôlés.
