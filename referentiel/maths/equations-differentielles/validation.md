# Validation : Équations différentielles linéaires (equations-differentielles, préfixe ed)

Sources lues : PROST-EQUATIONSDIFFERENTIELLES (lu en entier, annexe HP comprise), PROST-FONCTIONS-VECTORIELLES (partie V, exponentielle), PROGRAMME-MP-2021 (section « Équations différentielles linéaires », via la copie `mp_mathematiques.txt`). Programme officiel non consulté directement ; aucune autre source web lue.

## Bilan chiffré
- Cartes existantes : 31 (ch18.jsonl : 11 « Démos » + 20 « Cours »). Aucune écartée : toutes figurent dans `anciennes`.
- Cartes produites : 82 (ed-01 à ed-82) = 47 issues des notes existantes + 35 nouvelles.
- Traitement des 31 notes : 23 réécrites, 8 scindées, 0 corrigées, 0 reprises telles quelles, 0 fusionnées, 0 écartées.
- Verso tous ≤ 450 caractères ; rectos tous en question ou verbe d'action.

## Remarques sur les cartes d'origine
- Aucune erreur mathématique trouvée (formules relues : Q″+(2α+a)Q′+(α²+aα+b)Q, wronskien, Cramer d'ordre 2, cascade 2×2).
- Note 1790095284914 : « Q sans terme jusqu'au degré m−1 » ambigu ; reformulé en Q=t^k R (ed-67).
- Note 1789338580045 : convention y′+a y=b (solution e^{−A}) alors que PROST écrit y′=a y+b (e^{A}) : signalé dans ed-51.

## Ajouts notables (nouvelles cartes)
Forme intégrale de Cauchy, solution maximale et contre-exemple y′=y² (hors sources, vérifié), wronskien (piège x₁=t², x₂=t|t|), exponentielle de matrice (définition, spectre, exp(A+B), contre-exemple non commutatif, calcul pratique, exemples), valeurs propres complexes réelles, coefficients variables (contre-exemple A(t)=[[0,1],[t,0]], contrôlé numériquement : 1,1723 contre 1,2606), raccordement (dimension 2 pour ty′−2y=0, 0 pour ty′+y=0), exemples de PROST (ty′+|t|y, tan, polynômes, séries entières, t=ln x).

## Divergences / points à confirmer
- Wronskien d'ordre n (ed-23, formule de Liouville) : PROST indique qu'elle ne figure pas au programme ; seul l'ordre 2 est démontré. Convention de signe différente de PROST (forme y^(n)+a_{n−1}y^(n−1)+…).
- Démonstration de exp(A+B)=exp(A)exp(B) (ed-34) : non exigible selon PROST ; énoncé exigible.
- Solution maximale (ed-11, ed-12) : notion absente des sources lues (cadre non linéaire hors programme) ; exemples vérifiés à la main.
- Calculs explicites des systèmes : le programme limite aux cas diagonalisable ou dimension ≤ 3 (symbole illisible dans l'extraction : à confirmer).
- ed-50 (coefficients variables) : absent des sources, contre-exemple numérique.

## Lacunes
Étude qualitative (signe des parties réelles des valeurs propres) non traitée ; preuve de Cauchy-Lipschitz linéaire (hors programme) : seule la forme intégrale est en carte.
