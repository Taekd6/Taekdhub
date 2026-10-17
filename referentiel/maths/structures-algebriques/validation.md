# Validation — chapitre « 20 - Structures algébriques usuelles » (slug `structures-algebriques`, préfixe `sa`)

Fichier produit : `cartes.jsonl` (172 cartes, ids `sa-01` à `sa-172`). Entrée : `referentiel/_cache/anki/ch20.jsonl` (118 cartes : 75 « Cours », 43 « Démos »).

## Bilan chiffré des 118 cartes existantes
- 83 réécrites une pour une (recto transformé en vraie question, verso reformulé et ≤ 450 caractères).
- 31 scindées en plusieurs cartes (définition / piège / exemple séparés, ou démonstration à part).
- 4 fusionnées (2 fusions) : notes 1681825703852 + 1681825817195 (nilpotent + indice de nilpotence) ; notes 1790095283150 + 1791291880012 (doublons « Algèbre et sous-algèbre »). La note 1790095283150 est aussi scindée (caractérisation, exemples).
- 0 écartée : chaque note apparaît dans `anciennes` d'au moins une carte.
- Nouvelles cartes : 19 (« manquait à la collection »).
- Aucune erreur mathématique trouvée dans les cartes d'origine. Le défaut est la forme : recto = titre sans question, versos de 600 à 900 caractères pour les démonstrations (condensées ici), deux doublons.
- Répartition des 172 cartes : 54 énoncés, 45 démonstrations, 29 définitions, 21 pièges, 12 exemples, 5 formules, 5 méthodes, 1 contre-exemple.

## Nouvelles cartes
Éléments ajoutés : groupe où tout x vérifie x² = e (abélien) ; centre Z(G) ; automorphismes intérieurs (Z(G) comme noyau) ; théorème de Lagrange et sa démonstration ; anneau intègre fini = corps ; trois cartes sur les nilpotents (1−a inversible, nilpotents d'un anneau intègre, somme et produit) ; idéaux de 𝕂[X] et sa démonstration ; principe « division euclidienne » ; noyau d'un morphisme d'algèbres ; exemples (φ(360), 3¹⁰⁰ mod 7, ⟨k̄⟩ dans ℤ/4ℤ) ; signature et sa valeur sur un cycle ; ordre de 𝒜ₙ ; ordre d'une permutation (ppcm).

## Sources
Lues et citées (statut « lue » dans `sources.json`) : PROST-STRUCTURES-ALGEBRIQUES (chap. 19 de Prost), LANDELLE-CH04, PROGRAMME-MP-2021 et PROGRAMME-MPSI-2021 (copies du programme hébergées par mickaelprost.fr). Aucune autre source web consultée.

## Divergences et remarques entre sources
- Algèbre : PROST écrit (ax)(by) = ab(xy), LANDELLE (λx)y = λ(xy) = x(λy) : équivalents.
- Anneau principal : LANDELLE exige un anneau intègre dont tous les idéaux sont engendrés par un élément ; PROST énonce seulement que les idéaux de ℤ et 𝕂[X] sont principaux. La carte suit LANDELLE.
- LANDELLE ne définit les idéaux que dans un anneau commutatif et prend 𝕂 = ℝ ou ℂ ; PROST prend 𝕂 sous-corps de ℂ.
- Ordre d'un élément divisant |G| : preuve exigible seulement pour G commutatif (PROST 19.21 et programme MP). Le théorème de Lagrange général est absent des sources lues ; la carte correspondante a source « aucune consultée » et exigibilité « à confirmer ».
- ℤ/nℤ est absent du programme MPSI : seulement au programme MP (PROGRAMME-MPSI-2021 le dit explicitement).

## Points à confirmer (exigibilité « à confirmer : absent des sources lues »)
Lagrange (énoncé et preuve) ; élément régulier (mot) ; idéal engendré par une partie quelconque ; idéaux premiers entre eux dans un anneau commutatif général ; idéaux de ℤ/nℤ ; réciproque du théorème chinois ; 𝒜ₙ engendré par les 3-cycles et |𝒜ₙ| = n!/2 ; ordre d'une permutation par ppcm ; anneau intègre fini ; applications aux nilpotents ; centre et automorphismes intérieurs (exercices de PROST sans réponse donnée). Les résultats de cette liste ont été démontrés ici (mathématique « vérifié »).

## Contrôle
`python3 scripts/referentiel/referentiel.py check` : aucune erreur sur les cartes `sa-*`. Les erreurs restantes concernent d'autres chapitres.
