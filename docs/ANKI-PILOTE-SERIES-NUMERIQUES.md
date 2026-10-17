# Pilote : « Séries numériques » en cartes qui se laissent apprendre

**Proposition, rien n'est appliqué.** Aucune carte n'a été ajoutée, modifiée ni importée dans ta collection ;
ce fichier montre seulement à quoi pourrait ressembler un chapitre repris avec les défauts de l'audit en moins
(voir `docs/AUDIT-COLLECTION-ANKI.md`, §2).

## D'où vient le contenu

Uniquement des 25 cartes de cours « Séries numériques » du paquet `Maths MP :: 02 - Procédés sommatoires discrets`
(plus leurs « Pièges » et « Remarques »). **Je n'ai rien ajouté qui n'y soit pas.** Aucun cours PDF n'a été fourni : je n'ai pas
comparé à ton cours, seulement redécoupé ce que tes cartes disent (elles m'ont paru exactes à la lecture ; une carte lue ne vaut pas
conformité à ton cours).

## Ce qui change par rapport aux cartes actuelles

| Avant | Après |
|---|---|
| Recto : « Séries numériques · Théorème Critère de d'Alembert » (un titre) | Recto : une **question précise** qui dit ce qu'on attend (énoncé ? hypothèses ? contre-exemple ?) |
| Verso : bloc « Hypothèses, Conclusion, Piège, Remarque » (jusqu'à 650 caractères) | Verso : **une seule connaissance**, 1 à 3 lignes |
| Un résultat = une carte | Un résultat = 2 à 4 cartes : l'énoncé, la condition, le piège, l'exemple |
| Ordre quelconque | **Ordre d'apprentissage** (A → H), chaque groupe s'appuie sur le précédent |

Convention : `apcr` = à partir d'un certain rang. Les formules sont en texte brut ici ; dans Anki elles
se saisiraient en MathJax `\( … \)`.

## Les cartes (46)

### A. Les bases : qu'est-ce qu'une série ?
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 1 | Qu'est-ce que la série ∑uₙ, et quand dit-on qu'elle converge ? | Suite des sommes partielles Sₙ = ∑ₖ₌₀ⁿ uₖ ; elle converge si (Sₙ) converge ; sa somme est alors lim Sₙ. | Définition « Série, sommes partielles, convergence, somme » |
| 2 | Le symbole ∑ₙ₌₀^{+∞} uₙ est-il une somme ou une limite ? Quand existe-t-il ? | C'est une **limite** (de Sₙ) ; il n'existe que si la série converge. | Même carte (Piège) |
| 3 | On retire ou on modifie un nombre fini de termes : que deviennent la nature et la somme ? | La nature ne change pas ; la somme, si. | Même carte (Piège) |
| 4 | ∑qⁿ : condition de convergence, somme et reste ? | Converge ⇔ \|q\| < 1 ; somme 1/(1−q) ; reste Rₙ = qⁿ⁺¹/(1−q). | Propriété « Séries géométriques » |
| 5 | Série télescopique ∑(vₙ₊₁ − vₙ) : nature et somme ? | Même nature que (vₙ) ; si elle converge, somme = lim vₙ − v₀. | Propriété « Lien suite-série » |
| 6 | Exemple : nature et somme de ∑ 1/(n(n+1)) (n ≥ 1) ? | Converge, somme 1 (1/n − 1/(n+1) télescope). | Même carte (Remarque) |
| 7 | Reste d'ordre n d'une série convergente : définition, limite ? | Rₙ = S − Sₙ = ∑ₖ>ₙ uₖ ; Rₙ → 0. | Définition « Reste d'une série convergente » |
| 8 | Si ∑uₙ et ∑vₙ convergent : que dire de ∑(uₙ + λvₙ) ? Convergente + divergente ? Divergente + divergente ? | Converge, somme ∑uₙ + λ∑vₙ. Convergente + divergente = divergente. Divergente + divergente : on ne peut rien dire. | Propriété « Linéarité… » |
| 9 | Une série complexe converge à quelle condition sur ses parties réelle et imaginaire ? | ∑uₙ converge ⇔ ∑Re uₙ et ∑Im uₙ convergent (somme = ∑Re + i∑Im). | Même carte |

### B. Divergence grossière
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 10 | Si ∑uₙ converge, que dire de uₙ ? Pourquoi ? | uₙ → 0, car uₙ = Sₙ − Sₙ₋₁. | Propriété « Divergence grossière » |
| 11 | Que conclut-on si uₙ ne tend pas vers 0 ? | ∑uₙ diverge grossièrement (contraposée de 10). | Même carte |
| 12 | La réciproque de 10 est-elle vraie ? Contre-exemple ? | Non : ∑1/n diverge (H₂ₙ − Hₙ ≥ 1/2). | Même carte (Piège) |

### C. Séries à termes positifs
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 13 | Pour uₙ ≥ 0 (apcr), à quelle condition sur (Sₙ) la série converge-t-elle ? | (Sₙ) est croissante, donc ∑uₙ converge ⇔ (Sₙ) est majorée. | Propriété « Séries à termes réels positifs » |
| 14 | uₙ, vₙ ≥ 0 et ∑vₙ converge. Quelles relations entre uₙ et vₙ garantissent que ∑uₙ converge ? | uₙ = O(vₙ), ou uₙ = o(vₙ), ou uₙ ≤ vₙ apcr, ou uₙ ~ vₙ. | Théorème « Comparaison des séries à termes positifs » |
| 15 | uₙ ~ vₙ avec uₙ, vₙ positifs : que dire de ∑uₙ et ∑vₙ ? | Même nature. | Même carte |
| 16 | Pourquoi uₙ = O(vₙ) ne donne-t-il pas « même nature » ? | 1/n² = O(1) : ∑1/n² converge mais ∑1 diverge. Seule l'équivalence donne la même nature. | Même carte (Piège) |
| 17 | Hypothèse de signe nécessaire pour comparer par équivalent ? | L'une des deux séries doit être de signe constant apcr (l'autre l'est alors par équivalence). | Même carte (Piège) |
| 18 | ∑1/nᵅ : à quelle condition converge-t-elle ? | ⇔ α > 1. | Théorème « Séries de Riemann… » |
| 19 | Règle du nᵅuₙ (uₙ ≥ 0) : énoncé ? | ∃α > 1 avec (nᵅuₙ) bornée ⇒ converge ; ∃α ≤ 1 avec nᵅuₙ → +∞ ⇒ diverge ; uₙ ~ ℓ/nᵅ (ℓ > 0) : converge ⇔ α > 1. | Même carte |
| 20 | Critère de d'Alembert : hypothèses et conclusions ? | aₙ complexes non nuls (apcr), \|aₙ₊₁\|/\|aₙ\| → ℓ ∈ [0, +∞] : ℓ < 1 ⇒ converge absolument ; ℓ > 1 ⇒ diverge grossièrement ; ℓ = 1 : cas douteux. | Théorème « Critère de d'Alembert » |
| 21 | d'Alembert avec ℓ = 1 : pourquoi est-ce « douteux » ? | ∑1/n diverge et ∑1/n² converge, avec la même limite 1. | Même carte |
| 22 | « \|aₙ₊₁/aₙ\| < 1 pour tout n » suffit-il pour d'Alembert ? | Non, il faut une **limite** < 1 : aₙ = 1/n diverge bien que le rapport soit < 1. | Même carte (Piège) |

### D. Séries à termes quelconques
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 23 | Convergence absolue : que peut-on affirmer ? | ∑uₙ converge et \|∑uₙ\| ≤ ∑\|uₙ\|. | Théorème « Convergence absolue implique convergence » |
| 24 | La réciproque est-elle vraie ? Exemple ? | Non : ∑(−1)ⁿ/n converge sans converger absolument (semi-convergente). | Même carte (Piège) |
| 25 | Méthode : étudier une série quelconque par comparaison ? | Comparer \|uₙ\| à un vₙ ≥ 0 terme d'une série convergente (O, o, ≤ apcr, ~) ⇒ absolue convergence. Aucun critère de divergence ainsi. | Méthode « Étudier une série quelconque… » |
| 26 | Critère spécial des séries alternées : hypothèses et conclusions ? | uₙ décroissante de limite 0 : ∑(−1)ⁿuₙ converge ; la somme a le signe de u₀ ; le reste Rₙ a le signe de son premier terme et \|Rₙ\| ≤ uₙ₊₁. | Théorème « Critère spécial des séries alternées » |
| 27 | Critère des séries alternées : quelles hypothèses sont nécessaires, et que ne donne-t-il pas ? | La décroissance **et** la limite nulle ; il ne donne que la convergence, pas la convergence absolue. | Même carte (Piège) |
| 28 | Nature et somme de la série harmonique alternée ∑ₙ≥₁(−1)ⁿ⁻¹/n ? | Converge, de somme ln 2. | Propriété « Série harmonique alternée » |

### E. Comparaison série-intégrale
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 29 | f décroissante, continue par morceaux sur ℝ₊ : encadrement de ∫ₖᵏ⁺¹ f ? | f(k+1) ≤ ∫ₖᵏ⁺¹ f ≤ f(k). (À retrouver sur un dessin, pas par cœur.) | Propriété « Comparaison série-intégrale : encadrements » |
| 30 | Sommer cet encadrement : quel encadrement de ∑ₖ₌₀ⁿ f(k) ? | ∫₀ⁿ f + f(n) ≤ ∑ₖ₌₀ⁿ f(k) ≤ f(0) + ∫₀ⁿ f. | Même carte |
| 31 | f décroissante, positive : quand ∑f(n) converge-t-elle ? | ⇔ (∫₀ⁿ f)ₙ converge ; alors ∫₀^{+∞} f ≤ ∑f(n) ≤ f(0) + ∫₀^{+∞} f. | Théorème « Comparaison série-intégrale : nature… » |
| 32 | Que dire de ∑wₙ avec wₙ = ∫ₙ₋₁ⁿ f − f(n) (f décroissante positive) ? | Elle converge (0 ≤ wₙ ≤ f(n−1) − f(n), télescopique). | Même carte |
| 33 | Méthode : estimer une somme partielle ou un reste par comparaison série-intégrale ? | Encadrer f sur [k, k+1], intégrer, sommer ; pour un reste, sommer de n+1 à N puis N → +∞. | Méthode « Estimer des sommes partielles… » |
| 34 | Si ∑f(n) diverge et f(n) → 0 (f décroissante) : équivalent de Sₙ ? Si elle converge : encadrement du reste ? | Sₙ ~ F(n) (F primitive de f) ; I − Iₙ₊₁ ≤ Rₙ ≤ I − Iₙ avec Iₙ = ∫₀ⁿ f. | Même carte |
| 35 | Exemple : encadrement de Hₙ, puis équivalent ? | ln(n+1) ≤ Hₙ ≤ 1 + ln n, donc Hₙ ~ ln n. | Même carte (Remarque) |
| 36 | Équivalents des sommes partielles et restes de Riemann (selon α) ? | α < 1 : ∑ₖ≤ₙ 1/kᵅ ~ n¹⁻ᵅ/(1−α) ; α = 1 : Hₙ ~ ln n ; α > 1 : reste ~ 1/((α−1)nᵅ⁻¹). | Propriété « Équivalents… séries de Riemann » |
| 37 | Constante d'Euler : énoncé ? | ∃γ ∈ ℝ, Hₙ = ln n + γ + o(1). | Théorème « Constante d'Euler » |
| 38 | Idée de la preuve de la constante d'Euler ? | vₙ = Hₙ − ln n ; vₙ₊₁ − vₙ = 1/(n+1) − ln(1+1/n) = O(1/n²), terme d'une série convergente. | Même carte (Remarque) |

### F. Sommation des relations de comparaison
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 39 | Sommation, cas de divergence : hypothèses et conclusions ? | ∑vₙ diverge, v ≥ 0 apcr ; uₙ = O(vₙ) ⇒ Sₙ = O(Σₙ) ; o ⇒ o ; ~ ⇒ ~ (Σₙ sommes partielles de v). | Théorème « …cas de divergence » |
| 40 | Sommation, cas de convergence : hypothèses et conclusions ? | ∑vₙ converge, v ≥ 0 apcr ; uₙ = O/o/~ vₙ ⇒ ∑uₙ converge et Rₙ = O/o/~ ρₙ (ρₙ restes de v). | Théorème « …cas de convergence » |
| 41 | Sommation : pourquoi la suite de référence doit-elle être de signe constant ? | Sans cela le résultat est faux (condition à ne pas oublier). | Cas de divergence (Piège) |
| 42 | Lemme de Cesàro : énoncé ? | uₙ → ℓ ⇒ vₙ = (1/(n+1))∑ₖ≤ₙ uₖ → ℓ. | Théorème « Lemme de Cesàro » |
| 43 | Cesàro si uₙ → +∞ ? | Les moyennes tendent aussi vers +∞. | Même carte |
| 44 | Méthode : équivalent d'une somme partielle ou d'un reste par sommation d'équivalents ? | Trouver vₙ ~ uₙ télescopique : 1/n ~ ln(n+1) − ln n ⇒ Hₙ ~ ln n ; 1/n² ~ 1/(n−1) − 1/n ⇒ Rₙ ~ 1/n ; 1/√n ~ 2(√(n+1) − √n) ⇒ ∑ₖ≤ₙ 1/√k ~ 2√n. | Méthode « Équivalent d'une somme partielle… » |

### G. Produit de Cauchy
| # | Recto | Verso | Carte d'origine |
|---|---|---|---|
| 45 | Définition du produit de Cauchy de ∑uₙ et ∑vₙ ? | ∑wₙ avec wₙ = ∑ₖ₌₀ⁿ uₖvₙ₋ₖ = ∑ₚ₊q₌ₙ uₚvq (sommation par diagonales). | Définition « Produit de Cauchy… » |
| 46 | Théorème du produit de Cauchy : hypothèses et conclusion ? | ∑uₙ et ∑vₙ absolument convergentes ⇒ ∑wₙ absolument convergente et ∑wₙ = (∑uₙ)(∑vₙ). Exemples : exp(z+z′) = exp z · exp z′ ; 1/(1−a)² = ∑(n+1)aⁿ pour \|a\| < 1. | Théorème « Produit de Cauchy de séries absolument convergentes » |

Carte supplémentaire possible (carte n° 47) : « Pourquoi l'absolue convergence est-elle indispensable au produit de Cauchy ? » —
Verso : pour uₙ = vₙ = (−1)ⁿ/√(n+1), \|wₙ\| ≥ 1, donc ∑wₙ diverge grossièrement (piège de la carte d'origine).

## Ce qui n'est pas dans ce pilote (à décider ensemble)

- **Les démonstrations** : tes 21 cartes de démonstrations de ce chapitre ont déjà un « Idée clé + Plan » ; il faudrait, pour apprendre une preuve la
  première fois, ajouter le **pourquoi** de chaque étape. Je ne l'ai pas fait sans ton cours : je risquerais d'écrire une preuve
  différente de la tienne.
- **Les cartes « famille sommable »** (chapitre voisin, même paquet) : même traitement possible, à faire après validation du format.
- **Le rendu MathJax** et le choix du modèle de note (ton paquet utilise déjà « MP MathJax » pour 26 cartes).
- **La vérification contre ton cours** : impossible sans les PDF.

Si le format te convient, la suite logique est de le reproduire chapitre par chapitre, dans l'ordre que tu choisis.
