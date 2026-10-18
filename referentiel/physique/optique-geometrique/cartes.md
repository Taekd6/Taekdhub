# Cartes : optique-geometrique

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Lois de Descartes et réflexion totale

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| og-01 | énoncé | Énoncer les lois de Snell-Descartes de la réflexion et de la réfraction. | Rayons réfléchi et réfracté dans le plan d'incidence. Réflexion : i_r=−i (angles algébriques depuis la normale). Réfraction : n1 sin i1=n2 sin i2, n=c/v sans dimension. Le rayon se rapproche de la normale dans le milieu le plus réfringent. | confirmé : loi de la réflexion et propagation rectiligne dans PC-CHAMPOLLION-OPTIQUE-CH1 ; réfraction : hors programme MP 2021 explicite (rappel de première année) ; à confirmer : programme MPSI non lu | Source : Champollion cite les lois de Descartes sans les écrire ; formule vérifiée par raisonnement. |
| og-02 | énoncé | Quand y a-t-il réflexion totale ? Donner l'angle limite. | Passage vers un milieu moins réfringent (n1>n2) et i1>i_l=arcsin(n2/n1) (sinus ≤1 en réfraction impossible). Ex : verre (1,5)→air : i_l≈41,8°. Pas de rayon réfracté ; réflexion de coefficient 1. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |

### B. Conditions de Gauss et lentilles minces

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| og-03 | définition | Que sont les conditions de Gauss et que permettent-elles ? | Rayons proches de l'axe optique et peu inclinés (angles petits, sin≈tan≈angle). Elles donnent un stigmatisme et un aplanétisme approchés pour lentille mince ou miroir sphérique ; hors Gauss : aberrations (sphérique, chromatique). | confirmé : figure dans PROGRAMME-PC-MP-2021 (effet d'une lentille mince dans l'approximation de Gauss) et PC-CHAMPOLLION-OPTIQUE-CH1 |  |
| og-04 | interprétation | Comment une lentille mince convergente transforme-t-elle une onde plane en onde sphérique (point de vue des surfaces d'onde) ? | Onde plane parallèle à l'axe : surfaces d'onde planes. Le verre plus épais au centre retarde plus le centre : la surface d'onde sort en calotte sphérique convergeant vers F' (plan focal image si l'onde est oblique). Chemin optique égal sur tous les rayons jusqu'au point image. | confirmé : figure dans PROGRAMME-PC-MP-2021 (associer rayons et surfaces d'onde) et ISM-PC-O-1 | Carte d'origine ambiguë (« Fonctionnement d'une lentille ») : question déduite du paquet. |
| og-05 | formule | Écrire la relation de conjugaison de Descartes d'une lentille mince et le grandissement (origine O au centre). | 1/OA'−1/OA=1/f' (grandeurs algébriques, sens de la lumière positif), γ=A'B'/AB=OA'/OA. f'>0 convergente, f'<0 divergente. Valable dans les conditions de Gauss. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
| og-06 | formule | Écrire la relation de conjugaison de Newton (origines aux foyers) et le grandissement. | FA·F'A'=−f'² (mesures algébriques, m²) ; γ=f'/FA=−F'A'/f'. Équivalente à Descartes dans les conditions de Gauss ; pratique pour objet proche du foyer. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  | Corrigée au contrôle qualité : le grandissement s'écrit γ = f'/FA = −F'A'/f' (et non −f'/FA). Vérifié : f'=10, OA=−30 ⇒ OA'=15, γ=−0,5 = f'/FA = −F'A'/f'. |
| og-07 | définition | Définir la vergence V d'une lentille et le signe de f'. | V=1/f' en dioptries (δ=m⁻¹). V>0 : convergente (bords minces) ; V<0 : divergente. Vergences de lentilles accolées minces : V=V1+V2. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
| og-08 | méthode | Quels sont les trois rayons particuliers pour construire l'image d'un objet AB par une lentille mince ? | Rayon par le centre O : non dévié ; rayon parallèle à l'axe : émerge par F' ; rayon passant par F (ou dirigé vers F) : émerge parallèle à l'axe. Leur intersection donne B' ; prolongements pour les images virtuelles. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |

### C. Démonstrations et applications sur lentille mince

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| og-09 | démonstration | Démontrer la relation de conjugaison de Descartes par triangles semblables. | γ=A'B'/AB=OA'/OA (rayon BO non dévié). Rayon parallèle issu de B émergeant par F' : γ=F'A'/F'O=(OA'−f')/(−f')=1−OA'/f'. Égaler : OA'/OA=1−OA'/f' ; diviser par OA' : 1/OA'−1/OA=1/f'. Gauss, lentille mince. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
| og-10 | démonstration | Démontrer qu'on ne peut projeter une image réelle que si la distance objet-écran D≥4f'. | OA=−x, OA'=D−x : 1/(D−x)+1/x=1/f' donne x²−Dx+Df'=0. Racines réelles ssi D²−4Df'≥0, soit D≥4f'. D>4f' : deux positions (Bessel) ; D=4f' : une seule, γ=−1 ; D<4f' : aucune. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |

### D. Fibre optique

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| og-11 | démonstration | Démontrer l'ouverture numérique d'une fibre à saut d'indice (cœur n_c, gaine n_g<n_c, entrée dans l'air). | Entrée sous θ, réfraction θ' : sinθ=n_c sinθ'. Incidence sur la gaine i=π/2−θ' ; guidage si n_c cos θ'≥n_g (réflexion totale). Donc sinθ≤√(n_c²−n_g²) : ON=sinθ_max=√(n_c²−n_g²) (sans dimension, si ≤1). | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |

### E. Œil et instruments

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| og-12 | ordre de grandeur | Citer les caractéristiques de l'œil normal comme système optique. | Lentille de focale variable (cristallin, accommodation) et rétine à ≈17 mm (V≈60 δ au repos). Punctum remotum à l'infini, punctum proximum ≈25 cm. Pouvoir séparateur ≈1' ≈3·10⁻⁴ rad. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
| og-13 | formule | Donner le grossissement d'une lunette astronomique afocale (f1' objectif, f2' oculaire). | F1'=F2 : G=α'/α=−f1'/f2' (sans dimension), négatif : image renversée. Image à l'infini, observation sans accommodation ; α, α' diamètres angulaires (rad), angles petits. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
| og-14 | formule | Donner le grossissement commercial d'une loupe (focale f'), image à l'infini. | G=α'/α avec α=AB/0,25 m (vue à l'œil nu au punctum proximum) et α'=AB/f' : G=0,25/f' (f' en m)=V/4. Ex : f'=5 cm, G=5. | à confirmer : hors programme MP 2021 explicite (rappel de première année)  |  |
