# Séries entières : rapport de validation

Source : chapitre « 10 - Séries entières » (38 cartes, `_cache/anki/ch10.jsonl`) → **71 cartes** (`cartes.jsonl`, ids se-01 à se-71).

## Bilan des 38 cartes existantes
- reprises telles quelles : 1 (lemme d'Abel, note 1790095284496) ;
- corrigées : 0 (aucune erreur mathématique trouvée : exemples recalculés, notamment fractions rationnelles, ∑P(n)xⁿ, arcsin/√(1−x²)) ;
- réécrites (1 carte) : 10 ; scindées (2 cartes ou plus) : 27 ; fusionnées : 0 ; écartées : 0.
- Toutes les notes figurent dans `anciennes` (contrôle automatique fait).
- **Nouvelles : 6** (rayons usuels, rayon de ∑aₙz²ⁿ, e^{z+z'}=eᶻe^{z'} par produit de Cauchy, notion d'analytique, méthodes de DSE, exemple y''+y=0).

## Sources et divergences
- Lues et croisées : PROST-SERIES-ENTIERES (principale), PROGRAMME-MP-2021 (section B).
- Écart de présentation : le programme donne ln(1+x) sur ]−1,1] et arctan sur [−1,1] (Abel) ; la carte d'origine disait « valable aussi en 1 » : cohérent.
- À confirmer : analyticité de la somme en x₀≠0 (absente des sources lues et du programme lu) ; formule de Cauchy des coefficients (présente dans Prost, non repérée dans le programme) ; rayon de ∑aₙz²ⁿ (énoncé général non explicité).

## Contrôles
- `referentiel.py check` : 0 erreur pour ce fichier.
