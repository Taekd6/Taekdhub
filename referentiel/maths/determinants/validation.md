# Validation : chapitre « Déterminants » (slug determinants, préfixe de)

Fichier : `cartes.jsonl`, 82 cartes (de-01 à de-82), groupes A à J.

## Bilan chiffré des 45 cartes existantes (ch06.jsonl)
- 45 notes traitées, 45 couvertes dans `anciennes`, 0 écartée.
- 0 reprise telle quelle (toutes passées en Unicode simple, recto question, verso ≤ 450).
- 2 corrigées : note 642 (hypothèse redondante « dimension finie n de dimension n »), note 702 (preuve des blocs : factorisation « C' = C » maladroite et cas « B non inversible » inutile).
- 24 réécrites en une carte.
- 19 scindées en 2 à 5 cartes (624, 628, 632, 644, 646, 650, 652, 654, 656, 658, 664, 666, 668, 670, 672, 674, 688, 696, 698) ; le piège « det(A+B) » fusionne les notes 652 et 656.
- Nouvelles : 13 (exemples numériques, Sarrus/2×2, piège « n vecteurs en dim n », bijectivité, antisymétrique d'ordre impair, transvection par blocs, compagnon, comatrice 3×3, det(Com A), méthode de développement, etc.).

## Sources
Lues et citées : PROST-DETERMINANTS, PROST-REVISIONS-ALGEBRE-LINEAIRE, LANDELLE-CH05 (blocs, transvections par blocs, semblables), PROST-MP-MATHEMATIQUES, PROST-MPSI-MATHEMATIQUES (permutations, signature, Vandermonde, comatrice). Aucune source supplémentaire consultée.

## Divergences et remarques
- PROST-DETERMINANTS définit la signature par la parité du nombre de transpositions ; la note d'origine utilise les inversions. Équivalence démontrée dans la carte de démonstration (formule produit).
- Vandermonde est absent du chapitre de Prost et de LANDELLE-CH05 ; présent dans PROST-MPSI-MATHEMATIQUES uniquement : à confirmer pour le programme MP.
- La comatrice 3×3 de l'exemple de Prost est illisible dans l'extraction ; recalculée à la main (A·Com(A)ᵀ = 0 vérifié).
- Piège blocs : « ≠ det(AD−BC) » est exact en général ; précisé que la formule devient vraie si C et D commutent.

## Points à confirmer (exigibilité : absent des sources lues)
de-04 (conjugué d'un cycle), de-11 (cycle en transpositions), de-15, de-17, de-18 (centre de Sₙ et preuve, conjugaison), de-49 (antisymétrique impair), de-69 (det Com A), de-75 (tridiagonal). Énoncés et preuves vérifiés mathématiquement. Programme officiel non consulté.
Démonstrations de signature et cycles : non exigibles d'après PROST-MPSI-MATHEMATIQUES.

## Contrôle
`python3 scripts/referentiel/referentiel.py check` : 0 erreur pour `determinants` ; erreurs restantes uniquement dans `integrales-parametre` (autre lot).
