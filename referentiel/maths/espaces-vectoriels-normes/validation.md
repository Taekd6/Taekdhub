# Espaces vectoriels normés : rapport de validation

Chapitres Anki traités ensemble : « 04 - Norme sur un espace vectoriel » (19 notes) et « 13 - Topologie des espaces vectoriels normés » (66 notes), soit 85 notes.
Sortie : `cartes.jsonl`, **198 cartes** (`ev-01` à `ev-198`), groupes A à P.

## Bilan chiffré des 85 cartes existantes

| Sort | Notes |
|---|---|
| reprises/réécrites (recto transformé en question, verso reformulé) | 31 |
| corrigées (erreur ou imprécision réparée, voir ci-dessous) | 12 |
| scindées (une note donne plusieurs cartes) | 33 |
| fusionnées | 4 (notes 30+65 ; 33+34) |
| écartées | 5 |
| **Total** | **85** |

Ces 80 notes conservées alimentent 119 cartes ; **79 cartes nouvelles** s'y ajoutent (198 = 119 + 79).

### Notes écartées (motif)
- 1666794951003 (« Définition : Distance », cadre espace métrique) : les espaces métriques sont hors programme (PROGRAMME-MP-2021) ; la distance associée à une norme est couverte (ev-05).
- 1790095284744 (suite de Cauchy), 1790095284746 (espace de Banach, complétude), 1790095284792 (démonstration : C([a,b]) complet pour ‖·‖∞) et 1790095284764 (compact ⇒ complet) : « suite de Cauchy » et « espace de Banach » sont explicitement hors programme (PROGRAMME-MP-2021) et absents de LANDELLE-CH07, PROST-EVN1, PROST-EVN2. À suspendre dans Anki si tu suis le programme à la lettre. Les parties « Cauchy » des notes 1790095284790 (convergente ⇒ bornée) et 1790095284768 (équivalence : complet) ont été retirées.

(5 notes écartées : 1666794951003, 1790095284744, 1790095284746, 1790095284764, 1790095284792.)

### Corrections apportées (12 notes)
- 1662906961155 : formule avec d(u_n,a) au lieu de l, cadre métrique ; reformulée avec la norme.
- 1666069551744 (convexe) : quantificateur ∀(x,y)∈C² manquant.
- 1666819218354 (produit) : limite notée l au lieu de l_i.
- 1668873307835 (opérations sur les limites) : variable mal liée ; le produit exige un produit continu (algèbre de dimension finie).
- 1668874525278 (composition) : coquille « E,F et F » ; points adhérents précisés.
- 1668872991129 (coordonnées) : continuité écrite C_a(A,F) au lieu de C_a(A,𝕂).
- 1668882167343 (composée continue) : notation A,B,C ⊂ F³ incohérente, condition f(A)⊂B absente.
- 1668887906312 (applications coordonnées) : base et norme non précisées.
- 1669051126404 (p-linéarité) : f notée ℒ_p(E,F) sans préciser multilinéaire sur le produit ni F evn.
- 1679267580628 (limite) : domaine noté E avec a∈Ē ; en fait partie A et a∈Ā.
- 1790095284810 (non-équivalence 1/∞) : titre « triangles » mais plan avec xⁿ.
- 1790095284820 (dérivation non continue) : idée clé sin(nx) mais plan avec xⁿ.
Notes 1669024588037 et 1669025002608 (monôme, polynôme) : indices incohérents ((e_i)∈E^ℕ, λ dans 𝕂^m indexé par n) corrigés dans la fusion ev (groupe P).

## Divergences entre sources
- Convention d'ε : LANDELLE-CH07 (≤ ε) et PROST-EVN1 (< ε) : équivalentes ; cartes avec ≤ ou « < : équivalent ».
- Limite en un point : PROST-EVN2 écrit a ∈ A (déf. 12.11) alors que le programme et la suite du cours exigent a adhérent à A ; carte écrite avec a∈Ā.
- Étoilée : PROST-EVN2 écrit « ∃x∈E, ∀y∈E, [x,y]⊂E » (A oublié) ; corrigé.
- ‖Iₙ‖ pour la norme √Tr(AᵀA) : PROST-EVN2 écrit n ; le calcul donne √n (conclusion ≠ 1 inchangée).
- Normes produit : PROST-EVN1 définit seulement le max ; LANDELLE-CH07 donne N₁, N₂, N∞ (équivalentes) ; la carte donne les trois.
- Critère de continuité linéaire : C>0 (PROST-EVN2) vs C≥0 : sans importance (C=0 si u=0).
- Valeur d'adhérence : définie par sous-suites (LANDELLE-CH07, PROST-EVN1) ou par ε (PROST-EVN2) ; l'équivalence est démontrée (carte ev-52).

## Sources
Citées : LANDELLE-CH07, PROST-EVN1, PROST-EVN2, PROGRAMME-MP-2021 (registre sources.json : « lue »). Le texte du programme a été lu dans `referentiel/_cache/prost/mp_mathematiques.txt`, copie hébergée par mickaelprost.fr non comparée au BO (voir limite dans sources.json). Aucune source supplémentaire consultée.

## Points à confirmer (champ exigibilité « à confirmer : absent des sources lues »)
- Prolongement par continuité ; application localement constante sur un connexe par arcs (anciennes cartes de la collection, non listés au programme lu).
- Réunion finie / intersection de compacts ; méthode d'existence d'un minimum par coercivité (esprit seulement dans le programme) ; GLₙ(ℝ) non connexe par arcs ; d(x,A)=0 ⇔ x adhérent ; contre-exemple de ∫|f| sur les fonctions continues par morceaux ; adhérence d'une boule ouverte (démonstration).
- Démonstrations non exigibles d'après le programme : équivalence des normes en dimension finie (ev-166, ev-167) et critère multilinéaire (ev-145).
- Diamètre (ancienne note 11) : absent des sources lues, non repris.

## Couverture « suites dans un evn » (point signalé par l'utilisateur)
Groupes D et E (30 cartes) : définition de la convergence, unicité (énoncé + preuve), bornée (énoncé + preuve), opérations (combinaison linéaire, produit par une suite scalaire, norme), produit fini d'evn, coordonnées en dimension finie (convergence et caractère borné, preuve), suites complexes, O/o, exemple de calcul dans ℝ³, dépendance à la norme (tⁿ), suites extraites (définition, φ(n) ≥ n, même limite, preuve), valeurs d'adhérence (définition par sous-suite, par ε, preuve de l'équivalence, unicité pour une suite convergente, deux valeurs ⇒ divergence, piège « une seule valeur d'adhérence », exemples, ‖u_n‖→∞), Bolzano-Weierstrass (ℝ, ℂ, dimension finie), critères pour un compact et en dimension finie. Les suites de Cauchy sont hors programme et omises.
