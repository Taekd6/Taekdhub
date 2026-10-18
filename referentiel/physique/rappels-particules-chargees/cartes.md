# Cartes : rappels-particules-chargees

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Force de Lorentz

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpc-01 | formule | Donner la force de Lorentz sur une charge q de vitesse v dans (E, B) et ses unités ; quelle partie travaille ? | F = q (E + v ∧ B) (N) ; E en V/m, B en T. Puissance P = q E·v ; la force magnétique q v ∧ B ⊥ v ne travaille pas. Seule la force électrique modifie ‖v‖. Référentiel galiléen, vitesse non relativiste (Ec ≪ m c²). | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Base de la QC MPSI « Lorentz ». |
| rpc-02 | ordre de grandeur | Pourquoi néglige-t-on le poids d'un proton ou d'un électron dans E = 1 kV/m ou B = 1 mT, v = 10⁶ m/s ? | Poids du proton : m g ≈ 1,7·10⁻²⁷ × 9,8 ≈ 2·10⁻²⁶ N. Force électrique : e E ≈ 1,6·10⁻¹⁹ × 10³ ≈ 2·10⁻¹⁶ N ; magnétique : e v B ≈ 1,6·10⁻¹⁹×10⁶×10⁻³ ≈ 2·10⁻¹⁶ N. Rapport ≈ 10¹⁰ : poids négligeable. Idem pour l'électron. | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Chiffres recalculés, origine : condition donnée par PC-LAFAYETTE-CHARGE-EB (même exemple). |

### B. Champ E uniforme

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpc-03 | méthode | Quelle est la nature du mouvement d'une charge dans E uniforme et stationnaire ? Selon quelle condition est-il rectiligne ? | PFD : a = q E / m constant. Si v₀ = 0 ou v₀ // E : rectiligne (accélération q E/m). Sinon : plan contenant E et v₀, trajectoire parabolique (analogue du tir dans g, avec g remplacé par q E/m ; la parabole se courbe vers −E si q < 0). | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | « Parabole » d'origine précisée avec les conditions (QC MPSI n°2). |
| rpc-04 | méthode | Rappeler : une charge q part du repos et traverse une différence de potentiel U = V(A) − V(B) ; calculer sa vitesse finale (non relativiste). | TEC : ½ m v² = q U (poids négligé, force conservative) donc v = √(2 q U / m). Il faut q U > 0. Exemple : U = 2,0 kV : proton ≈ 6,1·10⁵ m/s ; électron ≈ 2,7·10⁷ m/s. Vérifier v ≪ c (électron : ≈ 9 % de c). | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Sens de U précisé et applications numériques recalculées (√(2·1,6e-19·2e3/1,7e-27) ≈ 6,1e5 ; électron 2,65e7). |
| rpc-05 | formule | Rappeler : entre deux plaques planes parallèles distantes de d et de tension U, donner E et son sens ; relier ΔEp à la tension. | ‖E‖ = U / d (V/m), perpendiculaire aux plaques, dirigé vers les potentiels décroissants. Ep = q V ; travail de A à B : W = q (V(A) − V(B)) = q u_AB. 1 eV = 1,6·10⁻¹⁹ J. Champ uniforme : effets de bord négligés. | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Source : PC-LAFAYETTE-CHARGE-EB § B.2. |

### C. Champ B uniforme

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| rpc-06 | méthode | Rappeler : dans B uniforme et stationnaire, quel est le mouvement général d'une charge ? Cas v₀ ⊥ B, v₀ // B, cas général. | Force ⊥ v : v constante en norme. v₀ ⊥ B : cercle ⊥ B. v₀ // B : droite uniforme. Cas général : hélice d'axe B (translation uniforme selon B + rotation uniforme dans le plan ⊥ B), angle (v, B) constant. Sens de rotation : −sgn(q) autour de B. | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Sens de rotation : q v ∧ B pour q > 0 tourne dans le sens indirect autour de B ; reformulé en sgn(q). |
| rpc-07 | formule | Rappeler : charge q dans B uniforme, v₀ ⊥ B : donner le rayon R et la pulsation cyclotron ω_c. | R = m v₀ /(\|q\| B) (m), ω_c = \|q\| B / m (rad/s) indépendante de v₀ ; période T = 2π m /(\|q\| B). Non relativiste, B stationnaire uniforme. Application : spectromètre, cyclotron. R proportionnel à v₀. | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Période ajoutée. |
| rpc-08 | démonstration | Démontrer la trajectoire circulaire d'une charge dans B uniforme avec v₀ ⊥ B. | PFD : m dv/dt = q v ∧ B. Puissance nulle donc ‖v‖ = v₀ cste. Projection sur B : m v̇_z = 0 donc v_z = 0 : mouvement plan. Frenet : m v₀²/R = \|q\| v₀ B donc R = m v₀/(\|q\| B) constant : cercle, ω_c = v₀/R = \|q\| B/m. Hypothèses : B uniforme stationnaire, non relativiste. | rappel MPSI : figure dans PC-LAFAYETTE-CHARGE-EB et PC-LAFAYETTE-QC-MPSI ; programme MP : cadre supposé acquis, détail MPSI absent de la copie : à confirmer | Contenu inchangé, mis en forme. |
