# Réduction des endomorphismes : rapport de validation

Fichier : `cartes.jsonl`, 138 cartes (ids rd-01 à rd-138), chapitres Anki 07 (67 notes) et 08 (45 notes) traités ensemble. Les 112 notes existantes sont toutes couvertes dans `anciennes`.

## Bilan chiffré (par carte produite)

- Notes existantes : 112 (67 + 45). Écartées : 0. Reprises telles quelles : 0 (tous les rectos étaient des titres sans question, donc réécrits).
- Cartes produites : 99 réécrites, 15 scindées, 9 fusionnées (de 2 notes chacune : 5+6, 41+63, 49+67, 85+106, 91+92, 62+40, 56+21, 86+77, 75+99), 15 nouvelles.
- Problèmes de fond corrigés : rectos en titre (« Réduction · Propriété… ») remplacés par des questions autonomes ; versos tronqués à ≤ 450 caractères ; démonstrations ramenées à idée + étapes ; hypothèses explicitées. Aucune erreur mathématique trouvée dans les notes existantes ; les énoncés ont tous été relus (hypothèses, K sous-corps de ℂ, cas limites).

## Cartes nouvelles (manquaient à la collection)

Méthode d'éléments propres 2×2/3×3, calcul de χ_J, critère Δ pour les matrices 2×2 réelles, diagonalisable à une seule valeur propre, Ker u ⊕ Im u pour un diagonalisable, inversibilité par π_A(0), π_u d'un diagonalisable, Sp P(u) = P(Sp u), I ± N inversible, somme de nilpotents (commutants ou non), pièges (diagonalisable vs inversible, somme de diagonalisables), Aⁿ avec (A−aI)(A−bI)=0, puissances de λI+N, décomposition de Dunford.

## Divergences et points à confirmer

- Cayley-Hamilton : LANDELLE-CH06 le démontre ; PROST-REDUCTION2 et PROST-MP-MATHEMATIQUES indiquent que la démonstration n'est pas exigible. La carte de preuve est conservée, marquée non exigible.
- Codiagonalisation de deux diagonalisables qui commutent, commutant, racines carrées, sous-espaces stables d'un diagonalisable (caractérisation complète) : présents dans PROST-REDUCTION2 seulement, absents de PROST-MP-MATHEMATIQUES et LANDELLE-CH06 : marqués « à confirmer ». Dunford : donné hors programme (culturel) par PROST-REDUCTION2.
- Cartes sans source lue (résultat démontré directement, champ source « aucune consultée (accès impossible) » imposé par le schéma, bien que d'autres sources aient été lues pour le reste) : Ker u ⊕ Im u, I ± N, nilpotents commutants, Sp P(u) = P(Sp u). Exigibilité : « à confirmer ».
- Landelle écrit χ_A = det(XIₙ − A), comme Prost : pas de divergence de convention. Landelle note la proposition « χ scindé à racines simples ⟹ π = χ » comme « à refaire ».
- Le fichier `prost/mp_mathematiques.txt` (id PROST-MP-MATHEMATIQUES) reproduit en réalité le texte du programme officiel (mention « © Ministère… 2021 »). Je l'ai cité comme source de cours uniquement, sans écrire « conforme au programme ».

## Vérifications

- Contre-exemples contrôlés à la main : A = diag-type (1 0;0 0) + B = (0 1;0 1) donne (1 1;0 1) ; E₁₂ + E₂₁ de carré I₂ ; (0,E₁₂) même χ non semblables ; u : P ↦ XP sans valeur propre ; ∫₁^X / dérivation.
- `python3 scripts/referentiel/referentiel.py check` : 0 erreur pour `referentiel/maths/reduction/` (des erreurs subsistent dans d'autres chapitres, ignorées).

## Sources supplémentaires

Aucune source web consultée.
