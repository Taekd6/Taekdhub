# Validation : endomorphismes-euclidiens (ch. 15 « Endomorphismes d'un espace euclidien »)

Fichier : `cartes.jsonl`, 82 cartes `ee-01` à `ee-82`. Source lue citée : PROST-ENDO-EUCLIDIENS. Programme officiel non consulté.

## Bilan des 45 cartes existantes
- reprises telles quelles : 0 ; écartées : 0 ;
- corrigées : 2 (notes 1790095283816 et 1790095283862, voir ci-dessous) ;
- réécrites en une carte : 19 ; scindées en plusieurs cartes : 22 ; fusionnées : 2.
- nouvelles cartes : 12 (exercices de Prost, composée de deux réflexions, symétries orthogonales, spectre dim 3, O(n) compact, piège « coefficients positifs », etc.).

## Corrections apportées
1. Note 1790095283816 (caractérisation des isométries) : la remarque « une application qui conserve la norme avec u(0)=0 est automatiquement linéaire » est FAUSSE (contre-exemple x ↦ ‖x‖e₁). La propriété vraie : conservation des distances avec f(0)=0 ⇒ linéaire. Carte ee-22 corrigée, contre-exemple en ee-23.
2. Note 1790095283862 (méthode en dimension 3) : « négative : −id ou réflexion » est incomplet ; en général une isométrie négative est une rotation composée avec la réflexion de plan orthogonal à l'axe (« anti-rotation », hors programme chez Prost). Seul le cas symétrique donne −id ou réflexion. Carte ee-55 corrigée.
3. Note 1790095283838 (théorème spectral) : remarque sur les matrices « hermitiennes » supprimée (formulation confuse, hors programme) ; les deux contre-exemples complexes ([[0,1],[1,2i]] et [[i,1],[1,−i]]) sont vérifiés.

## Divergences entre sources / collection
- Forme réduite des isométries : Prost diag(I_p, −I_q, R(θᵢ)) avec θᵢ ∉ πℤ ; la collection diag(R(θᵢ), −I_p, I_q) avec θ quelconque. Équivalent.
- Prost (exemple symétrie de l'espace) écrit M ∈ O₂(ℝ) : coquille pour O₃.
- Prost classe produit mixte/vectoriel en HP ; le calcul pratique des éléments de SO₃(ℝ) est signalé non attendu dans la fiche de programme transcrite.

## À confirmer
- « O(n) compact », composée de deux réflexions, piège des coefficients positifs : absents de la source lue, contrôlés par preuve.
- PROST-MP-MATHEMATIQUES a été lu (section « Endomorphismes d'un espace euclidien » : adjoint, isométries, réduction, théorème spectral, positifs) mais n'est plus dans `sources.json` : non cité dans les cartes.
