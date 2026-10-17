# Intégrales généralisées : rapport de validation

Fichier : `cartes.jsonl` (103 cartes, ids ig-01 à ig-103). Chapitre source : 36 notes de `_cache/anki/ch03.jsonl`.

## Bilan chiffré
- 36 cartes existantes : 0 écartée, 0 reprise telle quelle, 36 traitées (toutes ont un recto réécrit en vraie question, versos raccourcis).
  - 21 cartes « réécrites » (une note devient une carte), 62 cartes « scindées » issues de 25 notes à contenu multiple (la plupart des notes Propriété/Théorème/Méthode et les démonstrations longues), aucune fusion.
  - Notes réécrites avec correction ou doute signalé : 1675293432424 (faute « fonciton », recto sans question), 1790095284312 (Bertrand : « hors programme » non confirmé), 1790095284316 (exemple ∫₀ˣ e^{-t}sin(xt) retiré).
- 20 cartes nouvelles (manquait à la collection) : parité, primitive à limites finies, encadrement f≤g≤h, règle de divergence t^α f(t), exemples (e^{-t²}, √ln t/t, sin²(1/t), sin(te^{-t}), sin(1/t²)), norme ‖·‖₁, sous-intervalle/Chasles pour L¹, Cauchy-Schwarz, Cesàro continu, e^{-t²} reste, deux exemples de changement de variable, IPP/choix de primitive (Dirichlet), série de Riemann, contre-exemple série-intégrale sans décroissance, contre-exemple équivalents sans signe.
- Aucune erreur mathématique trouvée dans les 36 notes d'origine (énoncés, hypothèses et calculs recontrôlés : valeurs de Γ, B, ln(1+√2), π/4, équivalents, preuves).

## Sources lues
LANDELLE-CH01, PROST-INTEGRATION, PROST-MP-MATHEMATIQUES (reproduit le texte du programme ; je ne le compte pas comme « programme officiel consulté »), PROST-INTEGRALES-PARAMETRE (Γ). Aucune source web supplémentaire lue.

## Divergences et remarques entre sources
- Intervalle ouvert : Landelle « il existe c », Prost « quel que soit c » : équivalent (Chasles).
- Divergence grossière : Landelle ℓ réel ≠ 0 ; Prost « limite non nulle » ; j'ai vérifié que le cas limite infinie diverge aussi.
- Comparaison série-intégrale : Prost f continue ; collection c.p.m. ; équivalent (monotone ⇒ c.p.m.).
- Règle O/o : Landelle suppose f et g positives, Prost seulement g positive (f alors intégrable).
- Changement de variable : f continue (Landelle, programme) ; Prost remarque que c.p.m. marche aussi (hors programme).

## Points à confirmer
- Bertrand (ig démonstration et énoncé) : absent de LANDELLE-CH01 et PROST-INTEGRATION ; PROST-INTEGRALES-PARAMETRE ne fait que citer le nom. Vérifié par calcul, exigibilité à confirmer.
- Fonction B d'Euler (7 cartes) : absente de toutes les sources lues, vérifiée par calcul ; exigibilité à confirmer (probablement hors programme MP). Candidates à écarter si le programme ne la contient pas.
- Cauchy-Schwarz intégral : n'apparaît dans LANDELLE-CH01 que comme application à Γ.
- Contre-exemple « équivalents sans signe » (sin t/√t) : classique, vérifié à la main, pas dans les sources.
- Programme officiel non consulté : aucune carte ne prétend être « conforme au programme ».
