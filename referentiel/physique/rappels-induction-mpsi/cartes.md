# Cartes : rappels-induction-mpsi

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Flux et lois de l'induction

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpi-01 | définition | Définir le flux de B à travers un circuit orienté ; quelle est la convention d'orientation ? | Φ = ∬ B·dS (Wb = T·m²), sur une surface s'appuyant sur le circuit. Le vecteur normal dS est orienté par le sens choisi pour i selon la règle de la main droite. Changer l'orientation change le signe de Φ. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | Unité ajoutée. |
| rpi-02 | énoncé | Énoncer les lois de Faraday et de Lenz, avec les orientations. | Faraday : e = −dΦ/dt, fém induite orientée comme i (convention générateur), courant induit i = e/R. Lenz : le courant induit, par ses effets, s'oppose à la cause qui lui donne naissance (variation de flux ou mouvement). Φ calculé avec la même orientation que e. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | QC MPSI n°3 (Faraday-Lenz). |
| rpi-03 | définition | Distinguer le cas de Neumann et le cas de Lorentz de l'induction. | Neumann : circuit fixe dans un champ B(t) variable ; champ électromoteur E_m = −∂A/∂t (non conservatif). Lorentz : circuit mobile ou déformable dans un B stationnaire ; champ électromoteur v ∧ B. Dans les deux cas e = −dΦ/dt. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | Précision du champ électromoteur. E_m = −∂A/∂t est hors programme MPSI. |

### B. Auto-induction et mutuelle

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpi-04 | formule | Donner la relation tension-courant d'une bobine idéale en convention récepteur et la fém d'auto-induction. | Flux propre Φ = L i (L en henry, > 0). Récepteur : u = L di/dt (u et i fléchés en sens opposés). fém d'auto-induction : e = −L di/dt (i et e orientés de même sens). Énergie stockée : ½ L i² (J). Bobine longue : L = μ₀ N² S / ℓ. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | Orientation, énergie et L d'une bobine longue ajoutées (L = μ0 n² V ; ordre de grandeur 1 mH à 1 H). |
| rpi-05 | démonstration | Démontrer les équations de deux circuits couplés (inductance mutuelle M) fixes, en ARQS. | Flux : Φ₁ = L₁i₁ + M i₂, Φ₂ = L₂i₂ + M i₁ ; Faraday : e_k = −dΦ_k/dt. Mailles : u₁ = R₁i₁ + L₁ di₁/dt + M di₂/dt (idem pour 2). Bilan en multipliant par i₁, i₂ : apparaît d/dt(½L₁i₁² + ½L₂i₂² + M i₁i₂). Hypothèses : ARQS, circuits fixes, M identique dans les deux sens. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | Contenu inchangé ; M de signe algébrique selon l'orientation, \|M\| ≤ √(L₁L₂). |

### C. Applications

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpi-06 | formule | Rappeler : spire plane de surface S tournant à ω constant dans B uniforme ⊥ à l'axe : flux et fém (alternateur). | Φ = B S cos(ωt) (normale initialement // B), e = −dΦ/dt = B S ω sin(ωt) (V). Fém alternative de pulsation ω ; N spires : multiplier par N. Le moment des forces de Laplace s'oppose à la rotation : un opérateur fournit la puissance mécanique. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | N spires et signification énergétique ajoutées. |
| rpi-07 | démonstration | Rappeler : rails de Laplace générateurs : établir v(t) pour une barre lancée à v₀ (rails fermés par R, B uniforme ⊥). | Orientation du circuit : e = −B ℓ v ; i = e/R. Laplace : F = i ℓ B = −(B²ℓ²/R) v (freinage, Lenz). PFD : m v̇ = −(B²ℓ²/R) v donc v = v₀ e^(−t/τ), τ = m R /(B²ℓ²). Énergie cinétique entièrement dissipée par effet Joule. Hypothèses : auto-induction et frottements négligés. | rappel MPSI : figure dans PC-LAFAYETTE-QC-MPSI (induction, QC n°3 à 7) ; PROGRAMME-PC-MP-2021 (équations de Maxwell) revient sur les lois de l'induction de MPSI | Contenu inchangé, mis en forme ; signe relatif à l'orientation choisie. |
