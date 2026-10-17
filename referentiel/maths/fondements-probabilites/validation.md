# Fondements des probabilités : rapport de validation

Statut : 49 cartes initiales `pr-01`…`pr-49` (`cartes.jsonl`, recoupées et corrigées en place) + 71 cartes nouvelles `pr-50`…`pr-120` (`cartes-suite.jsonl`) = **120 cartes**. Le chapitre 11 de la collection de l'utilisateur (« Fondements des probabilités », 12 cartes) est traité ici ; les cartes probabilistes rangées dans son chapitre 12 y sont aussi rapprochées (voir plus bas).

## Sources (toutes lues)
PROST-PROBAS1 (fondements), PROST-PROBAS2 (moments), PROST-SOMMATION (dénombrabilité), PROGRAMME-MP-2021 (copie hébergée du programme, non comparée au BO). Aucune autre source consultée. Chaque carte croise au moins le cours Prost et le programme quand celui-ci traite le point.

## Corrections apportées aux cartes pr-* (ids conservés)
- pr-10 : l'exemple « réel uniforme dans [0,1], {0,5} » sortait du cadre du cours ; remplacé par l'exemple de PROST-PROBAS1 (pile ou face indéfini, « que des faces »).
- pr-24 : domaine de p précisé (]0,1] chez Prost, ]0,1[ au programme).
- pr-27 : hypothèse manquante p<1 (sinon P(X>n)=0 et conditionnement indéfini) ; réciproque réécrite sans conditionnement (P(X>n+k)=P(X>n)P(X>k)), ce qui couvre aussi p=1.
- pr-28 : complétée (cas complexe, équivalence avec |X|, dépendance en la loi seulement).
- pr-38 : divergence signalée : cours et programme = i.i.d. de variance finie ; la carte (variables deux à deux non corrélées, même espérance et variance) est plus générale et correcte.
- pr-42 : Prost précise que la formule de V(X) via G''(1) n'est pas à retenir.
- Exigibilité / source mises à jour pour les 49 cartes. « À confirmer » : pr-20 (absent des sources), pr-27 (absence de mémoire : cours Prost seulement), pr-48 (exemple propre à la carte). Nuances : pr-26 (théorème de Poisson dans Prost, seule l'interprétation « événements rares » au programme), pr-45 (stabilité de Poisson marquée HP par Prost).

## Bilan des notes de l'utilisateur
**Chapitre 11 (12 notes)** : 12 prises en compte : 4 réécrites (réunions, injection, ℝ, négligeable/presque sûr…), 1 corrigée (surjection : hypothèse A≠∅ manquante, ∅ étant au plus dénombrable), 2 fusionnées en une carte (définitions dénombrable / au plus dénombrable), 1 scindée en 3 (note 1791291881148 : produit fini, piège produit infini, exemples), 0 écartée. Cartes `pr-50`…`pr-65`.
**Chapitre 12, notes sur les fondements (19 notes : tribu, probabilité, propriétés, continuité, s.c.e., probabilités totales, conditionnement, Bayes, indépendance, v.a. discrètes, loi, f(X)/couples, indépendance de v.a., six démonstrations)** : rapprochées des cartes pr-* existantes (champ `anciennes` ajouté à pr-01…pr-45), non dupliquées ; les aspects absents ont donné de nouvelles cartes (ex. pr-66…pr-110 : couples, loi conjointe, indépendance de v.a., lemme des coalitions, convolution, Kolmogorov, fonction de répartition…).
Les 33 autres notes du chapitre 12 (moments) sont traitées dans `moments-variables-aleatoires`.

## Nouvelles cartes (71)
Ensembles dénombrables et négligeables (16), compléments tribus/probabilités (8), conditionnement et indépendance (7), v.a. discrètes (11), couples et familles (12), lois usuelles et démonstrations (9), dénombrement/indicatrices (8).

## Points à confirmer
- Fonction de répartition (groupe K) : absente des trois sources lues ; propriétés contrôlées, exigibilité « à confirmer ».
- Démonstration de la non-dénombrabilité (argument diagonal) : indiquée non exigible par le programme (copie).
- Poisson/absence de mémoire : cours Prost seulement.
- Programme officiel : lu seulement sur une copie hébergée par mickaelprost.fr, non comparée au BO.

## Niveau de validation
« vérifié » = énoncés relus (hypothèses, quantificateurs, cas limites : p=1 pour la géométrique, A=∅ pour la surjection, X≥0 pour Markov…). Les contre-exemples ont été contrôlés par le calcul. `cartes.md` est régénéré depuis les `.jsonl`.
