# Techniques asymptotiques : rapport de validation

Fichier : `cartes.jsonl` (53 cartes `ta-01` à `ta-53`, chapitre `techniques-asymptotiques`). Source de la collection : paquet « 01 - Techniques asymptotiques » (14 notes).

## Bilan chiffré des 14 notes existantes
- 14 notes traitées, 0 écartée, 0 reprise telle quelle.
- 2 **corrigées** (erreurs trouvées) : note 1790095283940 (propriétés de ∼ : puissance réelle α exige uₙ, vₙ > 0) ; note 1790095283948 (développement asymptotique : « on a toujours uₙ − v⁽¹⁾ − … ∼ v⁽ʳ⁺¹⁾ » est faux en général).
- 12 **réécrites ou scindées** en cartes à une seule idée (versos de 300 à 900 caractères d'origine, ramenés à ≤ 450).
- 16 cartes **nouvelles** (DL : définition, Taylor-Young, unicité, parité, primitivation, produit/quotient/composée, sh/ch/1/(1±x), équivalent par encadrement, polynômes, croissances comparées pour les fonctions, exemples, Stirling sous forme de ln n!, preuves de K = √(2π)).

## Sources
- Lues et enregistrées : PROST-MPSI-MATHEMATIQUES (programme : relations de comparaison, DL usuels, Stirling, « échelle de comparaison hors programme »), PROST-SOMMATION et LANDELLE-CH02 (sommation, ln(n!), Cesàro). **Constat : au moment du contrôle, `sources.json` ne contenait plus les ids PROST-MP-MATHEMATIQUES et PROST-MPSI-MATHEMATIQUES** : je n'ai donc mis aucun de ces deux ids dans le champ `source` (« aucune consultée … ») ; l'exigibilité mentionne « la fiche Prost mpsi_mathematiques (id non enregistré) ». À réenregistrer.
- Source supplémentaire réellement lue, à enregistrer : cours MP* du lycée Chaptal, chapitre 1 « Intégration » (rappels de sup sur l'analyse asymptotique), `https://cahier-de-prepa.fr/mp*-chaptal/download?id=2182`, 6 pages lues en entier (o, O, ∼, croissances comparées, équivalents usuels, pièges, DL usuels, Taylor-Young, opérations sur les DL), sha256 `eeb9f5d931780a7eaaef8a4daf3e1b86300bf33589f369aa9ad4ddeb07570932`.
- Aucun cours complet « analyse asymptotique des suites » n'est enregistré : les versos de la collection sont recoupés avec Chaptal (fonctions) et vérifiés par calcul.

## Divergences
- Puissance d'un équivalent : Chaptal exige f, g > 0 pour α réel ; la note d'origine ne le dit pas (corrigé, ta-17).
- DL de cos : la collection donne o(x^{2n+1}), Chaptal o(x^{2n}) : les deux sont vrais, le premier est plus précis.
- Exigibilité : « échelle de comparaison » hors programme (PROST-MPSI) ; Stirling : démonstration non exigible (ta-50 à ta-53 marquées en conséquence).

## À confirmer
Programme officiel non consulté. Propriétés « e^u ∼ e^v ⇔ u−v → 0 » et « ln u ∼ ln v » (ta-22 à ta-23) : notées non officielles dans la collection, absentes des sources enregistrées.
