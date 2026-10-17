# Validation : rappels-mpsi-algebre (lot : Arithmétique, Fractions rationnelles, Ensembles, Groupe symétrique, Dénombrement, Sommes finies)

## Bilan chiffré
- Cartes produites : 140 (`cartes.jsonl`, ids ra-01 à ra-140).
- Cartes existantes traitées : 64 (note_id distincts). Aucune écartée.
  - reprises telles quelles : 0 (tous les rectos d'origine étaient de simples titres)
  - corrigées : 6 ; réécrites : 36 ; scindées : 20 ; fusionnées : 2 (notes 1652778489858 + 1652778590647 : permutation et nombre de permutations) ; écartées : 0
- Cartes nouvelles (manquaient à la collection) : 40.

## Erreurs corrigées dans les cartes d'origine
- 1660914205305 : injective ⟺ surjective ⟺ bijective énoncé sans « E, F finis ».
- 1657560954946 : formule de Pascal donnée pour n ∈ ℕ ; il faut n ≥ 1.
- 1671453772402 : k·C(n,k) = n·C(n−1,k−1) donné pour n ∈ ℕ ; il faut n ≥ 1.
- 1676882958924 : fraction rationnelle « expression P/Q » sans la condition d'égalité PQ' = P'Q.
- 1665529122379 : p-cycle sans « aᵢ deux à deux distincts ».
- 1676974599765 : transposition : « ∀x ∉ ⟦1,n⟧, τ(x) = x » au lieu de x ∉ {i,j} ; i ≠ j omis.
- Ajouts mineurs : x = 1 pour la somme géométrique ; piège « commutent ⇒ supports disjoints » faux (contre-exemple c et c²).

## Divergences / remarques sur les sources
- PROST-MPSI-MATHEMATIQUES : le texte lu est en réalité l'annexe « Programme de mathématiques MPSI/MP2I » (ministère, 2021), pas un cours. Les cartes citent donc ce texte pour l'exigibilité (notes : preuves non exigibles pour décomposition en cycles, signature, existence/unicité de la DES ; « technicité exclue » en DES). À faire acter par le coordinateur ; les formules de cartes restent « programme officiel non consulté » selon la consigne.
- PGCD : MPSI le définit comme plus grand diviseur commun, MP/STRUCTURES par l'idéal aℤ+bℤ = dℤ ; équivalents (deux cartes).
- Signature : DET la définit par la parité du nombre de transpositions ; la collection par les inversions et le produit ; équivalents (vérifié).
- LANDELLE-CH04 ne traite que K[X] (Bézout, Gauss, DES absente) ; ni Z ni S_n ; utilisé seulement pour recouper (Euclide, « dans leur ensemble » vs « deux à deux »).
- DES : seule PROST-MPSI-MATHEMATIQUES la contient dans mon lot (PROST-INTEGRATION ne fait que l'utiliser, non citée).

## Points à confirmer
- Identités k·C(n,k) = n·C(n−1,k−1), nombre de diviseurs ∏(v_p+1), formule du produit de signature : contrôlées à la main, absentes des sources lues (indiqué dans `note`).
- Carte de probabilité uniforme (ra-53) : à rattacher éventuellement au chapitre de probabilités.
- Hors lot, non traités : théorème chinois, indicatrice d'Euler, Z/nZ (MP).

## Contrôle
`python3 scripts/referentiel/referentiel.py check` : 0 erreur pour ce chapitre (les erreurs restantes concernent calcul-differentiel et integrales-generalisees).
