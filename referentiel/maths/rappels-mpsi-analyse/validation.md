# Validation : rappels-mpsi-analyse (chapitre « 00 - Rappels MPSI », sous-paquets non algébriques)

Préfixe d'id `rn`, 245 cartes (`cartes.jsonl`). Lot : Continuité, Analyse réelle, Suites réelles, Convexité, Nombres réels, Primitives, Dérivation et intégration sur un segment (145 notes). Exclus : Arithmétique, Fractions rationnelles, Ensembles, Groupe symétrique, Dénombrement, Sommes finies.

## Bilan chiffré
- 145 notes existantes traitées, aucune écartée : 87 donnent une seule carte (66 cartes réécrites, 2 corrigées, 2 fusionnées de deux notes doublons, le reste des cartes mono-note étant issu de notes de démonstration réécrites) ; 58 notes sont scindées en plusieurs cartes (énoncé / piège / contre-exemple / démonstration).
- Cartes produites : 245 = 66 réécrites + 134 issues d'une scission + 2 corrigées + 2 fusionnées + 41 nouvelles.
- Motif des scissions : versos d'origine trop longs ou mêlant énoncé, piège et preuve.
- 17 groupes A à Q (nombres réels, suites, limites de fonctions, continuité, continuité uniforme, dérivation, Rolle/TAF, convexité, asymptotique et DL, Taylor, intégrale, primitives).

## Corrections apportées
  1. Note 1790095284118 (rn, groupe H) : « lipschitzienne ⇒ hölderienne » est faux pour un exposant < 1 sur un domaine non borné (x ↦ x sur ℝ). On garde lipschitzienne ⇒ UC et hölderienne ⇒ UC.
  2. Note 1790095284130 (démonstration « continue injective ⇒ strictement monotone ») : la fonction auxiliaire comparait des points non ordonnés ; paires (x<y), (x'<y') corrigées, avec q_t − p_t > 0.
  3. Note 1790095283932 (point fixe attractif) : la convergence quadratique si f'(ℓ)=0 demande f de classe C² (précisé).
  4. Note 1790095284254 (régularité d'une fonction convexe) : énoncé exact, mais absent de PROST-CONVEXITE, LANDELLE-CH03 et des programmes ; carte marquée « à confirmer ».
  5. Note 1790095284112 : réciproque « tangentes ⇒ convexe » réécrite via la tangente au point intermédiaire (méthode PROST-CONVEXITE).
  6. Exemples de contraction (note 1790095283930) : segments stables et k explicités et contrôlés.

## Divergences entre sources
- PROST-CONVEXITE (poids λ sur y) et LANDELLE-CH03 (poids λ sur a) : conventions de paramétrage différentes, équivalentes. LANDELLE-CH03 ajoute 1−e^(−x) ≤ x, ln x ≤ x−1, |·| convexe (repris). PROST-CONVEXITE traite le barycentre dans un ℝ-ev, le programme MPSI le déclare hors programme (« Tout développement général sur les barycentres est hors programme ») : cartes K gardées car présentes dans la collection et dans PROST-CONVEXITE.
- Heine, continue injective ⇒ strictement monotone, théorème de la bijection : démonstration déclarée non exigible dans PROGRAMME-MPSI-2021 (cartes de démonstration conservées car présentes dans la collection).
- Convexité sur ℝ-ev, valeurs d'adhérence unique pour suites bornées : le programme MP (compacts) justifie le cas borné.

## Exigibilité
- `source` en PROGRAMME-MPSI-2021 / PROGRAMME-MP-2021 : confirmé (texte officiel lu sur copie hébergée par mickaelprost.fr, non comparée octet à octet au BO).
- 30 cartes sans id de programme (surtout DL usuels, primitives usuelles) : formules vérifiées mathématiquement ; la liste des fonctions figure au programme mais pas les formules : marquées « à confirmer » pour l'exigibilité.
- 2 cartes (régularité des convexes) : source « aucune consultée » (absent des sources lues).

## Points à confirmer
- Formules des DL usuels et primitives usuelles : les sources extraites perdent les formules (extraction PDF) ; contrôlées par Taylor/dérivation.
- Stirling : formule exacte contrôlée, démonstration non exigible selon le programme.
- Aucune source web supplémentaire consultée.
