# Séries numériques : cartes v2 (proposition)

**Proposition, rien n'est importé dans Anki ; les cartes d'origine ne sont ni modifiées ni supprimées.** Source de vérité : `cartes-v2.jsonl` (ce tableau en est généré).

Trois niveaux de validation, distingués :

| Niveau | Sens | État dans ce lot |
|---|---|---|
| Vérifié mathématiquement | contrôlé par raisonnement | **toutes les cartes** |
| Confirmé par une source | vérifié dans un document effectivement consulté, avec référence | **aucune** (aucune source consultée : accès réseau refusé) |
| Exigibilité à confirmer | présence au programme ou caractère exigible non établi | marqué sur 4 cartes (voir colonne « Exigibilité ») ; pour toutes les autres : « dans tes cartes d'origine, programme non consulté » |

`apcr` = à partir d'un certain rang. Colonne « v1 » : carte(s) du pilote initial dont elle provient (— = absente du pilote initial).


### A. Les bases : qu'est-ce qu'une série ?

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 01 | Qu'est-ce que la série ∑uₙ, et quand dit-on qu'elle converge ? | Suite des sommes partielles Sₙ = ∑ₖ₌₀ⁿ uₖ ; elle converge si (Sₙ) converge ; sa somme est alors lim Sₙ. | Série, sommes partielles, convergence, somme | 1 | dans tes cartes d'origine ; programme non consulté |  |
| 02 | Le symbole ∑ₙ₌₀^{+∞} uₙ est-il une somme ou une limite ? Quand existe-t-il ? | C'est une limite (de Sₙ) ; il n'existe que si la série converge. | Série, sommes partielles, convergence, somme (Piège) | 2 | dans tes cartes d'origine ; programme non consulté |  |
| 03 | On retire ou on modifie un nombre fini de termes : que deviennent la nature de la série et sa somme ? | La nature ne change pas. La somme varie de la somme des modifications (ajouter à S ce qui a été ajouté, retrancher ce qui a été retiré) : en général elle change. | Série, sommes partielles, convergence, somme (Piège) | 3 | dans tes cartes d'origine ; programme non consulté | P1 : « la somme change » n'est vrai qu'en général (elle ne change pas si les termes retirés ont une somme nulle). |
| 04 | Série géométrique ∑qⁿ : condition de convergence, somme et reste ? | Converge ⇔ \|q\| < 1 ; somme 1/(1−q) ; reste Rₙ = qⁿ⁺¹/(1−q). | Séries géométriques | 4 | dans tes cartes d'origine ; programme non consulté |  |
| 05 | Série télescopique ∑(vₙ₊₁ − vₙ) : nature et somme ? | Même nature que la suite (vₙ) ; si elle converge, somme = lim vₙ − v₀. | Lien suite-série : séries télescopiques | 5 | dans tes cartes d'origine ; programme non consulté |  |
| 06 | Exemple : nature et somme de ∑ₙ≥₁ 1/(n(n+1)) ? | Converge, de somme 1 (1/(n(n+1)) = 1/n − 1/(n+1), télescopique). | Lien suite-série : séries télescopiques (Remarque) | 6 | dans tes cartes d'origine ; programme non consulté |  |
| 07 | Reste d'ordre n d'une série convergente : définition et limite ? | Rₙ = S − Sₙ = ∑ₖ>ₙ uₖ ; Rₙ → 0. | Reste d'une série convergente | 7 | dans tes cartes d'origine ; programme non consulté |  |
| 08 | Si ∑uₙ et ∑vₙ convergent, que dire de ∑(uₙ + λvₙ) ? | Elle converge, de somme ∑uₙ + λ∑vₙ (linéarité). | Linéarité des séries convergentes | 8 | dans tes cartes d'origine ; programme non consulté | Carte 8 du pilote v1 scindée en trois (une connaissance par carte). |
| 09 | Que dire de ∑(uₙ + vₙ) si l'une des séries ∑uₙ, ∑vₙ converge et l'autre diverge ? Si les deux divergent ? | Convergente + divergente = divergente. Divergente + divergente : on ne peut rien dire (∑1 et ∑(−1) divergent et leur somme ∑0 converge ; ∑1 et ∑1 divergent et leur somme diverge). | Linéarité des séries convergentes (Piège) | 8 | dans tes cartes d'origine ; programme non consulté |  |
| 10 | Si ∑vₙ diverge, que dire de ∑λvₙ ? | Elle diverge si λ ≠ 0 ; pour λ = 0 c'est la série nulle, qui converge. | Linéarité des séries convergentes (Piège) | 8 | dans tes cartes d'origine ; programme non consulté | L5 réintégré. |
| 11 | Une série complexe ∑uₙ converge à quelle condition sur ses parties réelle et imaginaire ? | ∑uₙ converge ⇔ ∑Re uₙ et ∑Im uₙ convergent ; la somme vaut alors ∑Re uₙ + i∑Im uₙ. | Linéarité des séries convergentes ; parties réelle et imaginaire | 9 | dans tes cartes d'origine ; programme non consulté |  |

### B. Divergence grossière

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 12 | Si ∑uₙ converge, que dire de uₙ ? Que conclure si uₙ ne tend pas vers 0 ? | uₙ → 0 (car uₙ = Sₙ − Sₙ₋₁). Contraposée : si uₙ ne tend pas vers 0, ∑uₙ diverge grossièrement. | Divergence grossière | 10, 11 | dans tes cartes d'origine ; programme non consulté | Cartes 10 et 11 du pilote v1 fusionnées : l'une est la contraposée de l'autre (doublon pédagogique). |
| 13 | La réciproque (uₙ → 0 ⇒ ∑uₙ converge) est-elle vraie ? Contre-exemple ? | Non : ∑1/n diverge bien que 1/n → 0 (H₂ₙ − Hₙ ≥ 1/2). | Divergence grossière (Piège) | 12 | dans tes cartes d'origine ; programme non consulté |  |

### C. Séries à termes positifs

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 14 | Pour uₙ ≥ 0 (apcr), à quelle condition sur (Sₙ) la série ∑uₙ converge-t-elle ? | (Sₙ) est croissante (apcr), donc ∑uₙ converge ⇔ (Sₙ) est majorée. | Séries à termes réels positifs : sommes partielles | 13 | dans tes cartes d'origine ; programme non consulté |  |
| 15 | uₙ, vₙ ≥ 0 (apcr) et ∑vₙ converge. Quelles relations entre uₙ et vₙ garantissent que ∑uₙ converge ? | uₙ = O(vₙ), ou uₙ = o(vₙ), ou uₙ ≤ vₙ apcr, ou uₙ ~ vₙ. | Comparaison des séries à termes positifs | 14 | dans tes cartes d'origine ; programme non consulté |  |
| 16 | uₙ ~ vₙ avec uₙ, vₙ positifs : que dire de ∑uₙ et ∑vₙ ? | Elles sont de même nature (l'une converge si et seulement si l'autre converge). | Comparaison des séries à termes positifs | 15 | dans tes cartes d'origine ; programme non consulté |  |
| 17 | Pourquoi uₙ = O(vₙ) ne donne-t-il pas « même nature » ? | 1/n² = O(1) : ∑1/n² converge mais ∑1 diverge. Seule l'équivalence donne la même nature. | Comparaison des séries à termes positifs (Piège) | 16 | dans tes cartes d'origine ; programme non consulté |  |
| 18 | Équivalent de séries : quelle hypothèse de signe faut-il ? Exemple ? | L'une des deux suites doit être de signe constant apcr (l'autre l'est alors par équivalence). Exemple : ∑sin(1/n²) converge, ∑sin(1/√n) diverge (sin x ~ x et les termes sont positifs). | Comparaison des séries à termes positifs (Piège) | 17 | dans tes cartes d'origine ; programme non consulté | P4 : exemple de la carte d'origine ajouté. |
| 19 | Séries de Riemann : pour quels α la série ∑1/nᵅ converge-t-elle ? | Si et seulement si α > 1. | Séries de Riemann et règle du nᵅuₙ | 18 | dans tes cartes d'origine ; programme non consulté |  |
| 20 | Règle du nᵅuₙ (uₙ ≥ 0) : si ∃α > 1 tel que (nᵅuₙ) soit bornée, que dire de ∑uₙ ? | Elle converge (uₙ = O(1/nᵅ) avec α > 1). | Séries de Riemann et règle du nᵅuₙ | 19 | dans tes cartes d'origine ; programme non consulté | Carte 19 scindée ; le cas uₙ ~ ℓ/nᵅ est omis car il découle des cartes « uₙ ~ vₙ » et « Riemann » (doublon pédagogique). |
| 21 | Règle du nᵅuₙ (uₙ ≥ 0) : si ∃α ≤ 1 tel que nᵅuₙ → +∞, que dire de ∑uₙ ? | Elle diverge : apcr uₙ ≥ 1/nᵅ ≥ 1/n, comparaison avec la série harmonique. | Séries de Riemann et règle du nᵅuₙ | 19 | dans tes cartes d'origine ; programme non consulté |  |
| 22 | Critère de d'Alembert : hypothèses et conclusions ? | (aₙ) complexes non nuls apcr, \|aₙ₊₁\|/\|aₙ\| → ℓ ∈ [0, +∞]. Si ℓ < 1 : ∑aₙ converge absolument. Si ℓ > 1 : elle diverge grossièrement. Si ℓ = 1 : cas douteux. | Critère de d'Alembert | 20 | dans tes cartes d'origine ; programme non consulté |  |
| 23 | d'Alembert avec ℓ = 1 : pourquoi ne peut-on rien conclure ? | ∑1/n diverge et ∑1/n² converge, avec la même limite ℓ = 1. | Critère de d'Alembert | 21 | dans tes cartes d'origine ; programme non consulté |  |
| 24 | « \|aₙ₊₁/aₙ\| < 1 pour tout n » suffit-il pour conclure avec d'Alembert ? | Non : il faut une limite < 1. Contre-exemple : aₙ = 1/n, rapport < 1 pour tout n mais la série diverge. | Critère de d'Alembert (Piège) | 22 | dans tes cartes d'origine ; programme non consulté |  |
| 25 | Appliquer d'Alembert : nature de ∑n!/nⁿ et de ∑zⁿ/n! (z ∈ ℂ) ? | n!/nⁿ : rapport = (n/(n+1))ⁿ → 1/e < 1, converge. zⁿ/n! : rapport = \|z\|/(n+1) → 0 < 1, converge absolument pour tout z. | Critère de d'Alembert (exemples) | — | dans tes cartes d'origine ; programme non consulté | L3 réintégré (exemple d'application). |

### D. Séries à termes quelconques

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 26 | Convergence absolue : que peut-on affirmer sur ∑uₙ ? | ∑uₙ converge et \|∑ₙ₌₀^{+∞} uₙ\| ≤ ∑ₙ₌₀^{+∞} \|uₙ\|. | Convergence absolue implique convergence | 23 | dans tes cartes d'origine ; programme non consulté |  |
| 27 | La réciproque (convergente ⇒ absolument convergente) est-elle vraie ? Exemple ? | Non : ∑(−1)ⁿ/n converge sans converger absolument (série semi-convergente). | Convergence absolue implique convergence (Piège) | 24 | dans tes cartes d'origine ; programme non consulté |  |
| 28 | Méthode : comment étudier une série à termes quelconques par comparaison ? | Comparer \|uₙ\| à vₙ ≥ 0 terme d'une série convergente (O, o, ≤ apcr, ~) : alors ∑uₙ converge absolument. Cette méthode ne donne aucun critère de divergence. | Méthode : étudier une série quelconque par comparaison avec \|uₙ\| | 25 | dans tes cartes d'origine ; programme non consulté |  |
| 29 | Critère spécial des séries alternées : hypothèses et conclusion ? | (uₙ) décroissante de limite 0 (donc uₙ ≥ 0) ⇒ ∑(−1)ⁿuₙ converge. | Critère spécial des séries alternées | 26 | dans tes cartes d'origine ; programme non consulté | Carte 26 scindée : convergence / signe et reste. |
| 30 | Série alternée du critère spécial : signe de la somme, signe et majoration du reste ? | La somme S est du signe de u₀ (au sens large : S ≥ 0). Le reste Rₙ est du signe de son premier terme (−1)ⁿ⁺¹uₙ₊₁ (au sens large) et \|Rₙ\| ≤ uₙ₊₁. | Critère spécial des séries alternées | 26 | dans tes cartes d'origine ; programme non consulté | P2 : signes au sens large. |
| 31 | Critère des séries alternées : quelles hypothèses sont nécessaires, et que ne donne-t-il pas ? | La décroissance et la limite nulle. Il ne donne que la convergence, pas la convergence absolue. | Critère spécial des séries alternées (Piège) | 27 | dans tes cartes d'origine ; programme non consulté |  |
| 32 | Nature et somme de la série harmonique alternée ∑ₙ≥₁ (−1)ⁿ⁻¹/n ? | Converge, de somme ln 2. | Série harmonique alternée | 28 | dans tes cartes d'origine ; programme non consulté |  |

### E. Comparaison série-intégrale

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 33 | f décroissante, continue par morceaux sur ℝ₊ : encadrement de ∫ₖᵏ⁺¹ f ? | f(k+1) ≤ ∫ₖᵏ⁺¹ f ≤ f(k). À retrouver sur un dessin (rectangles), pas par cœur. | Comparaison série-intégrale : encadrements | 29 | dans tes cartes d'origine ; programme non consulté |  |
| 34 | Sommer cet encadrement : quel encadrement de ∑ₖ₌₀ⁿ f(k) ? | ∫₀ⁿ f + f(n) ≤ ∑ₖ₌₀ⁿ f(k) ≤ f(0) + ∫₀ⁿ f. | Comparaison série-intégrale : encadrements | 30 | dans tes cartes d'origine ; programme non consulté |  |
| 35 | Même hypothèse, p ≥ 1 : encadrement de ∑ₖ₌ₚⁿ f(k) ? | ∫ₚⁿ⁺¹ f ≤ ∑ₖ₌ₚⁿ f(k) ≤ ∫ₚ₋₁ⁿ f (utile pour les restes et les sommes partielles de Riemann). | Comparaison série-intégrale : encadrements | — | dans tes cartes d'origine ; programme non consulté | L1 réintégré. Complémentaire de la carte précédente (bornes différentes), pas un doublon. |
| 36 | Si f est croissante au lieu de décroissante, que deviennent ces encadrements ? | Les inégalités s'inversent : par exemple ∑ₖ₌ₚⁿ f(k) ≤ ∫ₚⁿ⁺¹ f et ∑ₖ₌ₚⁿ f(k) ≥ ∫ₚ₋₁ⁿ f (p ≥ 1). | Comparaison série-intégrale : encadrements | — | à confirmer | L1 réintégré. Le cas croissant figure dans tes cartes ; le programme n'a pas été consulté sur ce point. |
| 37 | f décroissante, positive, continue par morceaux : quand ∑f(n) converge-t-elle, et quel encadrement de sa somme ? | ∑f(n) converge ⇔ la suite (∫₀ⁿ f)ₙ converge ; alors ∫₀^{+∞} f ≤ ∑ₙ₌₀^{+∞} f(n) ≤ f(0) + ∫₀^{+∞} f. | Comparaison série-intégrale : nature et série des wₙ | 31 | dans tes cartes d'origine ; programme non consulté | P3 : « continue par morceaux » ajouté. |
| 38 | Mêmes hypothèses : que dire de ∑wₙ avec wₙ = ∫ₙ₋₁ⁿ f − f(n) ? | Elle converge : 0 ≤ wₙ ≤ f(n−1) − f(n), terme d'une série télescopique convergente. | Comparaison série-intégrale : nature et série des wₙ | 32 | dans tes cartes d'origine ; programme non consulté |  |
| 39 | Méthode : estimer une somme partielle ou un reste par comparaison série-intégrale ? | Encadrer f sur [k, k+1], intégrer, puis sommer ; pour un reste, sommer de n+1 à N puis faire N → +∞. | Méthode : estimer des sommes partielles et des restes | 33 | dans tes cartes d'origine ; programme non consulté |  |
| 40 | f décroissante, positive, c.p.m. avec ∑f(n) divergente : équivalent de Sₙ ? | Sₙ ~ ∫₀ⁿ f (on divise l'encadrement de la somme par ∫₀ⁿ f → +∞). | Méthode : estimer des sommes partielles et des restes | 34 | dans tes cartes d'origine ; programme non consulté | Carte 34 scindée : divergence / reste. |
| 41 | f décroissante, positive, c.p.m. avec ∑f(n) convergente : encadrement du reste Rₙ ? | Avec I = ∫₀^{+∞} f et Iₙ = ∫₀ⁿ f : I − Iₙ₊₁ ≤ Rₙ ≤ I − Iₙ. | Méthode : estimer des sommes partielles et des restes | 34 | dans tes cartes d'origine ; programme non consulté |  |
| 42 | Exemple : encadrement de Hₙ = ∑ₖ₌₁ⁿ 1/k, puis équivalent ? | ln(n+1) ≤ Hₙ ≤ 1 + ln n, donc Hₙ ~ ln n. | Méthode : estimer des sommes partielles et des restes (Remarque) | 35 | dans tes cartes d'origine ; programme non consulté |  |
| 43 | Exemple : équivalent de ∑ₖ₌₂ⁿ 1/(k ln k) ? | ln ln n : f(t) = 1/(t ln t) est décroissante positive sur [2, +∞[, de primitive ln ln t, donc ∑ₖ₌₂ⁿ f(k) ~ ∫₂ⁿ f ~ ln ln n. | Méthode : estimer des sommes partielles et des restes (Remarque) | — | dans tes cartes d'origine ; programme non consulté | L9 réintégré (exemple de la carte d'origine, absent du pilote v1). |
| 44 | Équivalents des sommes partielles de Riemann ∑ₖ₌₁ⁿ 1/kᵅ pour α < 1 et pour α = 1 ? | α < 1 : ∑ₖ₌₁ⁿ 1/kᵅ ~ n¹⁻ᵅ/(1−α). α = 1 : Hₙ ~ ln n. | Équivalents des sommes partielles et restes de séries de Riemann | 36 | dans tes cartes d'origine ; programme non consulté | Carte 36 scindée : sommes partielles / reste. |
| 45 | Équivalent du reste de Riemann ∑ₖ>ₙ 1/kᵅ pour α > 1 ? | ∑ₖ₌ₙ₊₁^{+∞} 1/kᵅ ~ 1/((α−1)nᵅ⁻¹). | Équivalents des sommes partielles et restes de séries de Riemann | 36 | dans tes cartes d'origine ; programme non consulté |  |
| 46 | Équivalent de ζ(x) quand x → 1⁺ ? | ζ(x) ~ 1/(x−1) (encadrement 1/(x−1) ≤ ζ(x) ≤ 1 + 1/(x−1) par comparaison série-intégrale). | Équivalents des sommes partielles et restes de séries de Riemann | — | dans tes cartes d'origine ; programme non consulté | L8 : fait de la carte d'origine, non repéré dans le rapport v1 ; réintégré. |
| 47 | Constante d'Euler : énoncé ? | Il existe γ ∈ ℝ tel que Hₙ = ln n + γ + o(1) (la suite Hₙ − ln n converge). | Constante d'Euler | 37 | dans tes cartes d'origine ; programme non consulté |  |
| 48 | Constante d'Euler : idée de la preuve ? | vₙ = Hₙ − ln n ; vₙ₊₁ − vₙ = 1/(n+1) − ln(1 + 1/n) = O(1/n²), terme d'une série convergente, donc (vₙ) converge. | Constante d'Euler (Remarque) | 38 | dans tes cartes d'origine ; programme non consulté |  |
| 49 | Développement affiné de Hₙ ? | Hₙ = ln n + γ + 1/(2n) + o(1/n). | Constante d'Euler (Remarque) | — | à confirmer | L2 réintégré comme complément ; exigibilité non établie (programme non consulté). |
| 50 | Accélération pour ∑1/k² : majoration de \|S − (Sₙ + 1/n)\| ? | \|S − (Sₙ + 1/n)\| ≤ 1/(n(n+1)) (car 1/(n+1) ≤ Rₙ ≤ 1/n). | Méthode : estimer des sommes partielles et des restes (Remarque) | — | à confirmer | L4 réintégré comme complément ; technique d'exercice, exigibilité non établie. |

### F. Sommation des relations de comparaison

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 51 | Sommation, cas de divergence : hypothèses et conclusions ? | v ≥ 0 apcr avec ∑vₙ divergente ; Σₙ = ∑ₖ≤ₙ vₖ. Si uₙ = O(vₙ), alors Sₙ = O(Σₙ) ; si uₙ = o(vₙ), alors Sₙ = o(Σₙ) ; si uₙ ~ vₙ, alors Sₙ ~ Σₙ. | Sommation des relations de comparaison : cas de divergence | 39 | dans tes cartes d'origine ; programme non consulté |  |
| 52 | Sommation, cas de convergence : hypothèses et conclusions ? | v ≥ 0 apcr avec ∑vₙ convergente ; ρₙ = ∑ₖ>ₙ vₖ. Si uₙ = O(vₙ), o(vₙ) ou ~ vₙ, alors ∑uₙ converge et Rₙ = O(ρₙ), o(ρₙ) ou ~ ρₙ respectivement. | Sommation des relations de comparaison : cas de convergence | 40 | dans tes cartes d'origine ; programme non consulté |  |
| 53 | Sommation (cas de divergence) : contre-exemple si la suite de référence n'est pas de signe constant ? | uₙ = (−1)ⁿ + 1/n et vₙ = (−1)ⁿ (n ≥ 1) : uₙ ~ vₙ, ∑vₙ diverge, mais Sₙ ~ ln n alors que Σₙ ∈ {−1, 0} est bornée : on n'a pas Sₙ ~ Σₙ. | Sommation des relations de comparaison : cas de divergence (Piège) | 41 | dans tes cartes d'origine ; programme non consulté | P5 : remplace la carte 41 (« sans cela c'est faux »). Contre-exemple construit et vérifié par calcul ; il n'est pas dans tes cartes d'origine. |
| 54 | Lemme de Cesàro : énoncé ? | Si uₙ → ℓ, alors la moyenne vₙ = (1/(n+1)) ∑ₖ≤ₙ uₖ tend vers ℓ. | Lemme de Cesàro | 42 | dans tes cartes d'origine ; programme non consulté |  |
| 55 | Lemme de Cesàro : que se passe-t-il si uₙ → +∞ ? | Les moyennes tendent aussi vers +∞. | Lemme de Cesàro | 43 | dans tes cartes d'origine ; programme non consulté |  |
| 56 | Méthode : équivalent d'une somme partielle ou d'un reste par sommation d'équivalents ? | Trouver vₙ ~ uₙ télescopique : 1/n ~ ln(n+1) − ln n donc Hₙ ~ ln n ; 1/n² ~ 1/(n−1) − 1/n donc Rₙ ~ 1/n ; 1/√n ~ 2(√(n+1) − √n) donc ∑ₖ≤ₙ 1/√k ~ 2√n. | Méthode : équivalent d'une somme partielle ou d'un reste par sommation des équivalents | 44 | dans tes cartes d'origine ; programme non consulté |  |

### G. Produit de Cauchy

| # | Recto | Verso | Carte d'origine | v1 | Exigibilité | Remarque |
|---|---|---|---|---|---|---|
| 57 | Définition du produit de Cauchy de ∑uₙ et ∑vₙ ? | ∑wₙ avec wₙ = ∑ₖ₌₀ⁿ uₖvₙ₋ₖ = ∑ₚ₊q₌ₙ uₚvq (sommation par diagonales). | Produit de Cauchy de deux séries | 45 | dans tes cartes d'origine ; programme non consulté |  |
| 58 | Théorème du produit de Cauchy : hypothèses et conclusion ? | ∑uₙ et ∑vₙ absolument convergentes ⇒ ∑wₙ absolument convergente et ∑ₙ₌₀^{+∞} wₙ = (∑ₙ₌₀^{+∞} uₙ)(∑ₙ₌₀^{+∞} vₙ). | Produit de Cauchy de séries absolument convergentes | 46 | dans tes cartes d'origine ; programme non consulté |  |
| 59 | Deux applications du produit de Cauchy ? | exp(z + z′) = exp z · exp z′ ; pour \|a\| < 1, 1/(1−a)² = ∑ₙ≥₀ (n+1)aⁿ. | Produit de Cauchy de séries absolument convergentes (Ex.) | 46 | dans tes cartes d'origine ; programme non consulté | Carte 46 scindée : théorème / exemples. |
| 60 | Pourquoi l'absolue convergence est-elle indispensable au produit de Cauchy ? | uₙ = vₙ = (−1)ⁿ/√(n+1) : les séries convergent (critère des séries alternées) mais \|wₙ\| ≥ 1, donc ∑wₙ diverge grossièrement. | Produit de Cauchy de séries absolument convergentes (Piège) | 47 | dans tes cartes d'origine ; programme non consulté | Carte optionnelle 47 du pilote v1, promue. |
| 61 | Exponentielle de matrices : exp(A + B) pour A, B ∈ 𝓜ₙ(𝕂) ? | Si AB = BA, alors exp(A + B) = exp A · exp B (où exp A = ∑ Aᵏ/k!, absolument convergente). | Produit de Cauchy de séries absolument convergentes (Remarque) | — | à confirmer | L6 réintégré comme complément ; à relier au chapitre « Équations différentielles ». Exigibilité à confirmer. |
