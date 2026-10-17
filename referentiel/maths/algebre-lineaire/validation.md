# Validation : chapitre « Révisions d'algèbre linéaire » (slug `algebre-lineaire`, préfixe `al`)

## Bilan chiffré
- Cartes produites : 283 (`al-01` à `al-283`), 15 groupes A à O plus P (interpolation de Lagrange). 67 démonstrations, 98 énoncés, 52 définitions, 22 formules, 20 pièges, 13 méthodes, 9 exemples, 2 contre-exemples.
- Cartes existantes : 180 (128 « Cours », 52 « Démos »). Chacune figure dans `anciennes` d'au moins une carte.
  - reprises telles quelles : 4 ; réécrites : 102 (surtout les titres sans question) ; corrigées : 1 ; scindées : 73 ; fusionnées : 0 ; écartées : 0.
  - Un classement unique par priorité (scindée > corrigée > réécrite > reprise) est utilisé quand une note alimente plusieurs cartes.
- Nouvelles cartes : 31 (« manquait à la collection »).

## Corrections et constats sur les cartes existantes
- Une seule correction : note 1790005454421 (inverser une matrice), méthode « résoudre AX = Y » sans quantificateur. Il faut « pour tout Y » (carte `al-177`).
- Les autres énoncés ont été contrôlés (hypothèses, quantificateurs, cas limites, contre-exemples calculés) : aucune erreur mathématique franche trouvée. Les contre-exemples numériques ont été recalculés (tr(ABC) = 2 et tr(BAC) = 1 ; I₂ et (1 1 ; 0 1) ; (x,u(x)) liée ; dérivation).
- Défauts de forme corrigés : rectos « Calcul matriciel · Propriété… » sans question, versos de plusieurs idées, démonstrations longues scindées en 2 ou 3 cartes.
- Les sections de preuve de la collection d'origine sont gardées (52 démos, retrouvées dans 67 cartes « démonstration »).
- Les matrices extraites, J_{n,p,r}, les affinités, la méthode (A ; Iₚ) sont reprises ; les affinités n'apparaissent dans aucune source lue.

## Divergences entre sources
- Notation de la matrice de passage : P_B^{B'} (Landelle) contre P_{B→B'} (Prost). Même convention (colonnes = coordonnées des vecteurs de B' dans B).
- Prost note Tr, la collection tr ; Prost note E_{i,j} comme la collection.
- Prost place la dualité (base duale) en « pour votre culture, HP » : cartes `al-` du groupe H correspondantes marquées « à confirmer ».
- Produit par blocs : démonstration non exigible d'après PROST-MP-MATHEMATIQUES (précisé en note).

## Points à confirmer (exigibilité) ou sans source lue
- Affinités (2 cartes), centre de Mₙ(K) (matrices commutant avec tout), (x,u(x)) liée ⟹ homothétie, noyaux/images itérés (démonstration Ker u∩Im u = {0} ⟺ Ker u = Ker u²), réciproque des projecteurs (somme = id et produits nuls), exemples de calcul : marqués « aucune consultée » pour la source, « à confirmer : absent des sources lues » ; énoncés vérifiés à la main.
- Programme officiel non consulté : aucune carte n'affirme la conformité au programme.

## Sources
- Citées dans les cartes : LANDELLE-CH05, PROST-REVISIONS-ALGEBRE-LINEAIRE (statut « lue » dans sources.json).
- Lues et utilisées mais **absentes de sources.json au moment du contrôle** (donc non citées dans `validation.source`, mentionnées dans `note`) : PROST-MP-MATHEMATIQUES (blocs : produit non exigible, déterminant triangulaire par blocs, transvections par blocs, nilpotents, projecteurs/somme directe) et PROST-MPSI-MATHEMATIQUES (trace d'un projecteur, J_r, interpolation de Lagrange, comatrice). À enregistrer pour pouvoir les citer.
- Aucune source web supplémentaire consultée.

## Contrôle
`python3 scripts/referentiel/referentiel.py check` : 0 erreur pour les cartes `al-*` (les erreurs restantes concernent d'autres chapitres).
