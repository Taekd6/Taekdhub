# Validation : ondes dans les plasmas et les conducteurs (préfixe op)

## Sources lues
Programme PROGRAMME-PC-MP-2021 (section 4.5 Propagation et rayonnement, 4.4 Énergie). Cours : PC-CHAMPOLLION-EM-CH8, PC-CHAMPOLLION-EM-CH9 (extraction de texte dégradée, relue par calcul), PC-LAFAYETTE-CHEM6, PC-CHAMPOLLION-EM-CH7 pour la réflexion.
Aucune copie dans le dépôt ; cartes rédigées en mots propres.

## Bilan des notes
Notes d'origine : phys_10 (30), phys_09 « pression de radiation » (1), mp_ondes-em-m « Cavité résonnante » (1), mp_ondes-em-p « Champ E et B réfléchis » (1). 34 cartes.
Reprises telles quelles : 4 ; réécrites ou précisées : 21 ; scindée : 1 (note 1790858881439) ; fusionnées : 5 groupes ; verso vide reconstruit : 2 ; nouvelles : 5 (relaxation de charge, paquet d'ondes Δω·Δt, doublet spectral, bilan Joule/Poynting, ...). Aucune note écartée.

## Erreurs ou imprécisions des cartes d'origine
- « Conducteur parfait (ou ohmique en HF) » : confusion ; un ohmique n'est parfait qu'à la limite δ → 0 (corrigée).
- Vitesse de groupe « et en général de l'énergie » : vrai seulement en milieu transparent faiblement dispersif (nuancée).
- Plusieurs inégalités (ω > ωp, v_g < c) perdues dans l'export (symboles < >) : rétablies.
- Relations de passage : orientation de n⃗ non précisée.
- Pression de radiation et Drude : hors PROGRAMME-PC-MP-2021 (Drude : aucun modèle de loi d'Ohm exigible).

## Divergences
- τ = ε0/γ : Champollion ≈ 10⁻¹⁸ s ; calcul avec γ = 6×10⁷ S/m : 1,5×10⁻¹⁹ s (même ordre, ≪ T).
- Densités de l'ionosphère : n ≈ 10¹² m⁻³ (Lafayette, 10⁶ cm⁻³) ⇒ fp ≈ 9 MHz.
- Convention e^{+iωt} partout (Champollion et Lafayette) ; signes à inverser avec e^{−iωt}.

## Vérifications par raisonnement
k² = (ω² − ωp²)/c², v_φ v_g = c², δ = √(2/(μ0γω)) (cuivre : 9 mm à 50 Hz, 20 µm à 10 MHz), P_J/S = ⟨Π(0)⟩ = γδE0²/4, B réfléchi, j_s = 2E0 cos ωt/(μ0c), pression de radiation 2I/c = ε0E0².
