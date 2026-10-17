# Validation — Calcul différentiel (calcul-differentiel, préfixe cd)

Sources lues : PROST-CALCUL-DIFFERENTIEL (chapitre « 18 » du cours Prost, relu pour les parties I à IV), PROST-MP-MATHEMATIQUES (section calcul différentiel et optimisation). Programme officiel non consulté. Aucune autre source web lue.

## Bilan chiffré
- Cartes existantes : 38 (ch19.jsonl, 15 « Démos » + 23 « Cours »). Aucune écartée : toutes figurent dans `anciennes`.
- Cartes produites : 83 (cd-01 à cd-83) = 54 issues des notes existantes + 29 nouvelles.
  - reprises telle quelles : 6 ; réécrites : 20 ; corrigées : 2 ; scindées : 26 ; fusionnées : 0 ; nouvelles : 29.
- Verso tous ≤ 450 caractères ; recto tous en forme de question ou verbe d'action.

## Corrections apportées
- Note 1790095284966 (chaîne en polaires) : notations f et g inversées (« g(x,y) = f(r,θ) ») ; formules justes. Corrigée en cd-33.
- Note 1790095284986 (EDP x∂ₓf + y∂_yf = 0) : « droites issues de l'origine » ; sur x > 0 on n'obtient que des demi-droites. Corrigée en cd-76.
- Note 1790095285000 : intitulée « démonstration » alors que Schwarz est admis ; réécrite en contre-exemple (cd-43). Calcul refait : ∂_y∂ₓf(0) = −1, ∂ₓ∂_yf(0) = 1.
- Note 1790095285012 : mêlait trois résultats ; scindée (cd-58, cd-59). Note 1789338580259 et 1790095284956 etc. : rectos remplacés par de vraies questions.
- Contrôle mathématique refait pour l'exemple x²y/(x⁴+y²) (correct), x²−y², Lagrange, déterminant, Euler, polaires (domaine et difféomorphisme corrects).

## Divergences entre sources
- C¹ : PROST-CALCUL-DIFFERENTIEL et programme = différentiable à différentielle continue ; équivalent à « partielles continues » (théorème, preuve non exigible). Signalé en cd-19.
- Condition suffisante d'ordre 2 : Prost « minimum local », programme « minimum local strict ». Le strict est exact (cd-55).
- Point critique : défini pour f de classe C¹ (Prost) ou différentiable (programme) (cd-46).
- Fonctions constantes : énoncé pour C¹ dans les sources ; vrai aussi pour f différentiable (cd-39).

## Points à confirmer (absents des sources lues)
- IAF à plusieurs variables (cd-37, cd-38) : seule l'IAF à une variable et la formule intégrale figurent. Énoncé vérifié.
- Théorème d'inversion locale : absent ; fonctions implicites : hors programme (cd-82).
- Terme « C¹-difféomorphisme » (cd-80, cd-81) et différentielle du déterminant (cd-83, cd-84 selon numérotation du fichier : voir les deux dernières cartes) : absents des sources lues, vérifiés par calcul.
- Contre-exemples de rédaction personnelle, vérifiés par calcul : f différentiable non C¹ (cd-21), x²y/(x⁴+y²) (cd-15), piège Lagrange avec ∇g = 0, piège domaine des EDP, xy/(x²+y²) (cd-16).
- Laplacien, équation de la chaleur, extrema liés à plusieurs contraintes (hors programme chez Prost) : non traités.
