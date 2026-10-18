# Validation : diffusion thermique (dt)

Cartes : 44. Notes d'origine traitées : 34 (phys_11) + 8 (mp_thermo-m et mp_thermo-p relatives à la diffusion) = 42 ; aucune écartée.
Les 6 notes mp restantes (thermodynamique) sont traitées dans le chapitre `thermodynamique`.

## Sources lues
- PROGRAMME-PC-MP-2021 (section 5.2 Transferts thermiques) : exigibilité.
- PC-LAFAYETTE-CHT4 (MP La Fayette, transferts thermiques) : bilan local, Fourier, Newton, Rth, ARQS, schéma numérique.
- PC-CHAMPOLLION-THERMO-CH1 (MPI 2025/26) : même plan, valeurs de λ et D, conditions aux bords.
- PC-CHAMPOLLION-THERMO-CH2 (MPI 2022/23) : rayonnement, Stefan, Wien (hors programme MP).
- Anciens cours (Lesbre 2018) non utilisés ici.

## Bilan
Reprises quasi telles quelles : 0 (toutes reformulées avec unités et hypothèses) ; réécrites : majorité ; corrigées : 4 (ordres de grandeur de λ et h, condition ARQS, Stefan) ; fusionnées/scindées : bilans 1D, Rth cylindre/sphère, ailette ; nouvelles : 7 (profils stationnaires, flux/orientation, ARQS habitat, schéma numérique et stabilité, ordres de grandeur de D, ...).

## Erreurs ou lacunes des cartes d'origine
- Verso de la démo Rth cylindre/sphère correct ; carte Rth cylindre sans unité.
- Rayonnement : constante de Stefan absente ; loi hors programme.
- « air forcé ~ 100 » pour h : plage plutôt 10 à 100.
- ARQS : condition formulée de façon ambiguë.
- 6 cartes mp de diffusion à verso vide reconstruites (bilans 1D, Rth cyl/sph, ailette, équation de la chaleur, deux blocs, séparation des variables).

## Divergences entre sources
- Conductivité de l'acier : ≈ 16 (Champollion) ou ≈ 50 W·m⁻¹·K⁻¹ (Lafayette), selon l'alliage.
- Polystyrène : 0,004 chez Champollion (erreur manifeste), ≈ 0,04 attendu.
- Notation : D (Lafayette) ou a (Champollion) pour la diffusivité ; p_v ou ℙ_V ; Φ ou P_th.
- Champollion écrit la loi de Newton φ = h(T − Tf), Lafayette dΦ(fluide→solide) = h(T_fluide − T) : mêmes lois, sens opposés.

## Hors programme ou à confirmer (cartes marquées)
Rth cylindre/sphère (programme : cartésien), ailette, ondes thermiques, séparation des variables, Stefan/Wien, Fick, entropie créée par conduction. Ailette, ondes, séparation, Fick, entropie : aucune des sources lues ne contient le résultat ; vérifiés par calcul (dimension, limites).

## Manque
Aucun cours de 2022+ supplémentaire lu au-delà de Lafayette et Champollion (économie de session). Pas de carte sur la mesure de λ ni sur la caméra thermique (capacités expérimentales).
