# Validation : Fonctions vectorielles (fonctions-vectorielles, préfixe fv)

Sources lues : PROST-FONCTIONS-VECTORIELLES (lu en entier), PROGRAMME-MP-2021 (section « Fonctions vectorielles », via la copie `mp_mathematiques.txt`), PROST-CALCUL-DIFFERENTIEL (partie « Arcs paramétrés », pour les cartes d'arcs). Programme officiel non consulté directement ; aucune autre source web lue.

## Bilan chiffré
- Cartes existantes : 20 (ch17.jsonl : 7 « Démos » + 13 « Cours »). Aucune écartée : toutes figurent dans `anciennes`.
- Cartes produites : 48 (fv-01 à fv-48) = 31 issues des notes existantes + 17 nouvelles.
- Traitement des 20 notes : 9 réécrites, 9 scindées, 2 corrigées, 0 reprises telles quelles (le LaTeX a été converti en Unicode et les rectos-titres remplacés par des questions), 0 fusionnées, 0 écartées.
- Verso tous ≤ 450 caractères ; rectos tous en question ou verbe d'action.

## Corrections
- Note 1790095284852 (réduction du domaine d'un arc) : « x, y paires ⇒ M(−t) symétrique par rapport à l'axe des y » est faux : M(−t)=M(t). Corrigée (fv-46) et complétée (x paire/y impaire, etc.).
- Note 1790095284842 (Taylor-Lagrange) : sup pris sur [a,x], faux si x<a ; remplacé par le segment d'extrémités a et x (fv-38).

## Divergences entre sources
- Taylor-Lagrange : PROST-FONCTIONS-VECTORIELLES écrit M=sup‖f^(n)‖ sur [a,b] (coquille, il faut f^(n+1) sur le segment entre a et x).
- Taylor-Young : PROST-FONCTIONS-VECTORIELLES suppose 𝒞^{n+1} pour les trois formules ; le programme (copie lue) indique 𝒞^n pour Young. Retenu : 𝒞^n (vrai dès que f est n fois dérivable en a).
- IAF : le cours et le programme la donnent pour 𝒞¹ ; la version « continue sur [a,b], dérivable sur ]a,b[ » de la carte d'origine est vraie mais plus générale (signalée dans fv-32).
- Leibniz : énoncé dans PROST pour f réelle ; étendu ici à f vectorielle (λ réelle), preuve identique.

## Points à confirmer
- Arcs paramétrés cas p>1 (fv-44, fv-45) : absent de PROST-CALCUL-DIFFERENTIEL (cas f′(t₀)≠0 seulement) ; démonstration vérifiée.
- Réduction du domaine d'étude (fv-46) : absente des sources lues.
- Définition de « continue par morceaux » (fv-03) : citée mais non détaillée dans les sources.
- fv-23 : méthode rédigée ici (seul l'énoncé de l'exercice 4 est dans la source).
- La convergence dominée ne s'appliquerait pas aux fonctions vectorielles selon PROST : non reprise en carte.

## Lacunes
Limite/continuité traitées brièvement ; suites de fonctions vectorielles (Th. 16.18-16.22) seulement par deux cartes sur les séries. Exponentielle de matrice : cartes dans le chapitre `equations-differentielles` (groupe E).
