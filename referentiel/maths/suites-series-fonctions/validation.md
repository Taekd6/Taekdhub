# Suites et séries de fonctions : rapport de validation

Source : chapitre « 09 - Suites et séries de fonctions » (38 cartes, `_cache/anki/ch09.jsonl`) → **76 cartes** (`cartes.jsonl`, ids sf-01 à sf-76).

## Bilan des 38 cartes existantes
- reprises telles quelles : 0 (aucun verso ne tenait sous 450 caractères avec un recto-question) ;
- corrigées : 1 (note 1790095284640) ;
- réécrites (1 carte) : 16 ; scindées (en 2 cartes ou plus) : 20 ; fusionnées : 1 (la note 1790095284610 est regroupée avec les notes 568 et 574 dans des cartes fusionnées ; voir `anciennes`) ;
- écartées : 0. Toutes les notes figurent dans `anciennes` (contrôle automatique fait).
- **Nouvelles : 9** (contre-exemples fₙ=e⁻ˣxⁿ/n!, sin(nx)/n ; majoration du reste d'une série alternée ; application de Weierstrass ; interversion série-intégrale générale : 4 cartes).

## Erreur corrigée
- Note 640 : « f(x)=∑(−1)ⁿ/(n+x) : dérivées en CN sur ℝ₊* » est faux si la série part de n=0 (‖1/x²‖∞=+∞). Carte réécrite avec n≥1.

## Sources et divergences
- Lues et croisées : PROST-SERIES-FONCTIONS (principale), PROGRAMME-MP-2021 (théorèmes de a) à f)), PROST-INTEGRATION (Th. 2.36, convergence dominée).
- Divergence mineure : double limite, programme = CU sur A entier ; cours Prost = CU au voisinage de a (version plus forte). Signalé dans la note de sf-26.
- Le « critère de Weierstrass » (majoration normale) n'est pas nommé ainsi dans les sources ; il est couvert par la méthode de convergence normale. Le critère d'Abel pour la convergence uniforme est absent des sources lues : non traité (à confirmer).

## Contrôles
- Vérification mathématique faite pour chaque énoncé (hypothèses, calculs : sup de x/(1+n⁴x⁴), ∫ de (1−x)²/(1+x), 2e−3, télescopage, contre-exemples).
- `referentiel.py check` : 0 erreur pour ce fichier.
