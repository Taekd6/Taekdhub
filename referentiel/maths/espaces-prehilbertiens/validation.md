# Validation : espaces-prehilbertiens (ch. 14 « Espaces préhilbertiens réels »)

Fichier : `cartes.jsonl`, 100 cartes `ph-01` à `ph-100`. Sources lues citées : PROST-PREHILBERTIENS (toutes les cartes sauf indication), PROST-ENDO-EUCLIDIENS (Riesz, orientation, produit mixte et vectoriel). Programme officiel non consulté.

## Bilan des 55 cartes existantes
- reprises telles quelles : 0 (tous les rectos étaient des titres sans question ; tous les versos dépassaient 450 caractères ou mélangeaient plusieurs idées) ;
- corrigées : 0 (aucune erreur mathématique trouvée) ;
- réécrites en une carte : 23 notes ; scindées en plusieurs cartes : 28 notes ; fusionnées : 4 notes (1 et 18, 2 et 18, 20 et 21 : orthogonal / base orthonormée incomplète ; produit mixte) ;
- écartées : 0.
- nouvelles cartes : 15 (exercices 1, 2, 5, 6, 8, 9, 11, 12 de Prost, régression linéaire, Legendre, contre-exemple de Riesz, pièges d'orthogonalité, produit vectoriel).

## Contrôles mathématiques
Tous les énoncés ont été relus (hypothèses, quantificateurs, cas limites). Points contrôlés par calcul : Gram-Schmidt de ((2,1,0),(0,1,1),(1,2,1)) ; projecteur sur x+y+z=0 ; distance (1,2,3) au plan = 2√3 ; majoration de ∫₀¹√x e^{−x} par √(1−e^{−2})/2 (valeur réelle 0,379) ; ε₂ = X²−1/3 pour ∫_{−1}^{1}.

## Divergences et remarques sur les sources
- PROST-PREHILBERTIENS énonce Cauchy-Schwarz « égalité ⟺ colinéaires » ; la carte garde la forme précise « liés (y = 0 ou x = λy) » de la collection.
- Riesz, produit mixte et produit vectoriel sont dans le chapitre « endomorphismes » de Prost ; conservés ici car présents dans les cartes de la collection (chapitre 14). Produit mixte et vectoriel : marqués « pour votre culture, HP » chez Prost.
- Suites totales, Parseval et moindres carrés : « pour votre culture, HP » chez Prost ; exigibilité à confirmer.
- Prost énonce A = QR pour toute A ∈ Mₙ(ℝ) ; la carte se limite au cas inversible.

## À confirmer
- Matrice de Gram, contre-exemple de Riesz et calcul de Legendre : absents des sources lues (contrôlés par calcul ou preuve).
- Les polycopiés de programme (PROST-MP/MPSI-MATHEMATIQUES) ne figurent plus dans `sources.json` : ils ne sont pas cités dans les cartes, même s'ils ont été lus (MPSI : section « Espaces préhilbertiens réels » du programme, y compris Gram-Schmidt, projection, distance ; polynômes orthogonaux mentionnés comme illustrations).
