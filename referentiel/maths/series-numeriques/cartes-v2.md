# Cartes : series-numeriques

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Les bases : qu'est-ce qu'une série ?

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-01 | définition | Qu'est-ce que la série ∑uₙ, et quand dit-on qu'elle converge ? | Suite des sommes partielles Sₙ = ∑ₖ₌₀ⁿ uₖ ; elle converge si (Sₙ) converge ; sa somme est alors lim Sₙ. | dans tes cartes d'origine ; programme non consulté |  |
| sn-02 | définition | Le symbole ∑ₙ₌₀^{+∞} uₙ est-il une somme ou une limite ? Quand existe-t-il ? | C'est une limite (de Sₙ) ; il n'existe que si la série converge. | dans tes cartes d'origine ; programme non consulté |  |
| sn-03 | énoncé | On retire ou on modifie un nombre fini de termes : que deviennent la nature de la série et sa somme ? | La nature ne change pas. La somme varie de la somme des modifications (ajouter à S ce qui a été ajouté, retrancher ce qui a été retiré) : en général elle change. | dans tes cartes d'origine ; programme non consulté | P1 : « la somme change » n'est vrai qu'en général (elle ne change pas si les termes retirés ont une somme nulle). |
| sn-04 | énoncé | Série géométrique ∑qⁿ : condition de convergence, somme et reste ? | Converge ⇔ \|q\| < 1 ; somme 1/(1−q) ; reste Rₙ = qⁿ⁺¹/(1−q). | dans tes cartes d'origine ; programme non consulté |  |
| sn-05 | énoncé | Série télescopique ∑(vₙ₊₁ − vₙ) : nature et somme ? | Même nature que la suite (vₙ) ; si elle converge, somme = lim vₙ − v₀. | dans tes cartes d'origine ; programme non consulté |  |
| sn-06 | exemple | Exemple : nature et somme de ∑ₙ≥₁ 1/(n(n+1)) ? | Converge, de somme 1 (1/(n(n+1)) = 1/n − 1/(n+1), télescopique). | dans tes cartes d'origine ; programme non consulté |  |
| sn-07 | définition | Reste d'ordre n d'une série convergente : définition et limite ? | Rₙ = S − Sₙ = ∑ₖ>ₙ uₖ ; Rₙ → 0. | dans tes cartes d'origine ; programme non consulté |  |
| sn-08 | énoncé | Si ∑uₙ et ∑vₙ convergent, que dire de ∑(uₙ + λvₙ) ? | Elle converge, de somme ∑uₙ + λ∑vₙ (linéarité). | dans tes cartes d'origine ; programme non consulté | Carte 8 du pilote v1 scindée en trois (une connaissance par carte). |
| sn-09 | énoncé | Que dire de ∑(uₙ + vₙ) si l'une des séries ∑uₙ, ∑vₙ converge et l'autre diverge ? Si les deux divergent ? | Convergente + divergente = divergente. Divergente + divergente : on ne peut rien dire (∑1 et ∑(−1) divergent et leur somme ∑0 converge ; ∑1 et ∑1 divergent et leur somme diverge). | dans tes cartes d'origine ; programme non consulté |  |
| sn-10 | énoncé | Si ∑vₙ diverge, que dire de ∑λvₙ ? | Elle diverge si λ ≠ 0 ; pour λ = 0 c'est la série nulle, qui converge. | dans tes cartes d'origine ; programme non consulté | L5 réintégré. |
| sn-11 | énoncé | Une série complexe ∑uₙ converge à quelle condition sur ses parties réelle et imaginaire ? | ∑uₙ converge ⇔ ∑Re uₙ et ∑Im uₙ convergent ; la somme vaut alors ∑Re uₙ + i∑Im uₙ. | dans tes cartes d'origine ; programme non consulté |  |

### B. Divergence grossière

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-12 | énoncé | Si ∑uₙ converge, que dire de uₙ ? Que conclure si uₙ ne tend pas vers 0 ? | uₙ → 0 (car uₙ = Sₙ − Sₙ₋₁). Contraposée : si uₙ ne tend pas vers 0, ∑uₙ diverge grossièrement. | dans tes cartes d'origine ; programme non consulté | Cartes 10 et 11 du pilote v1 fusionnées : l'une est la contraposée de l'autre (doublon pédagogique). |
| sn-13 | piège | La réciproque (uₙ → 0 ⇒ ∑uₙ converge) est-elle vraie ? Contre-exemple ? | Non : ∑1/n diverge bien que 1/n → 0 (H₂ₙ − Hₙ ≥ 1/2). | dans tes cartes d'origine ; programme non consulté |  |

### C. Séries à termes positifs

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-14 | énoncé | Pour uₙ ≥ 0 (apcr), à quelle condition sur (Sₙ) la série ∑uₙ converge-t-elle ? | (Sₙ) est croissante (apcr), donc ∑uₙ converge ⇔ (Sₙ) est majorée. | dans tes cartes d'origine ; programme non consulté |  |
| sn-15 | énoncé | uₙ, vₙ ≥ 0 (apcr) et ∑vₙ converge. Quelles relations entre uₙ et vₙ garantissent que ∑uₙ converge ? | uₙ = O(vₙ), ou uₙ = o(vₙ), ou uₙ ≤ vₙ apcr, ou uₙ ~ vₙ. | dans tes cartes d'origine ; programme non consulté |  |
| sn-16 | énoncé | uₙ ~ vₙ avec uₙ, vₙ positifs : que dire de ∑uₙ et ∑vₙ ? | Elles sont de même nature (l'une converge si et seulement si l'autre converge). | dans tes cartes d'origine ; programme non consulté |  |
| sn-17 | piège | Pourquoi uₙ = O(vₙ) ne donne-t-il pas « même nature » ? | 1/n² = O(1) : ∑1/n² converge mais ∑1 diverge. Seule l'équivalence donne la même nature. | dans tes cartes d'origine ; programme non consulté |  |
| sn-18 | énoncé | Équivalent de séries : quelle hypothèse de signe faut-il ? Exemple ? | L'une des deux suites doit être de signe constant apcr (l'autre l'est alors par équivalence). Exemple : ∑sin(1/n²) converge, ∑sin(1/√n) diverge (sin x ~ x et les termes sont positifs). | dans tes cartes d'origine ; programme non consulté | P4 : exemple de la carte d'origine ajouté. |
| sn-19 | énoncé | Séries de Riemann : pour quels α la série ∑1/nᵅ converge-t-elle ? | Si et seulement si α > 1. | dans tes cartes d'origine ; programme non consulté |  |
| sn-20 | énoncé | Règle du nᵅuₙ (uₙ ≥ 0) : si ∃α > 1 tel que (nᵅuₙ) soit bornée, que dire de ∑uₙ ? | Elle converge (uₙ = O(1/nᵅ) avec α > 1). | dans tes cartes d'origine ; programme non consulté | Carte 19 scindée ; le cas uₙ ~ ℓ/nᵅ est omis car il découle des cartes « uₙ ~ vₙ » et « Riemann » (doublon pédagogique). |
| sn-21 | énoncé | Règle du nᵅuₙ (uₙ ≥ 0) : si ∃α ≤ 1 tel que nᵅuₙ → +∞, que dire de ∑uₙ ? | Elle diverge : apcr uₙ ≥ 1/nᵅ ≥ 1/n, comparaison avec la série harmonique. | dans tes cartes d'origine ; programme non consulté |  |
| sn-22 | énoncé | Critère de d'Alembert : hypothèses et conclusions ? | (aₙ) complexes non nuls apcr, \|aₙ₊₁\|/\|aₙ\| → ℓ ∈ [0, +∞]. Si ℓ < 1 : ∑aₙ converge absolument. Si ℓ > 1 : elle diverge grossièrement. Si ℓ = 1 : cas douteux. | dans tes cartes d'origine ; programme non consulté |  |
| sn-23 | piège | d'Alembert avec ℓ = 1 : pourquoi ne peut-on rien conclure ? | ∑1/n diverge et ∑1/n² converge, avec la même limite ℓ = 1. | dans tes cartes d'origine ; programme non consulté |  |
| sn-24 | piège | « \|aₙ₊₁/aₙ\| < 1 pour tout n » suffit-il pour conclure avec d'Alembert ? | Non : il faut une limite < 1. Contre-exemple : aₙ = 1/n, rapport < 1 pour tout n mais la série diverge. | dans tes cartes d'origine ; programme non consulté |  |
| sn-25 | exemple | Appliquer d'Alembert : nature de ∑n!/nⁿ et de ∑zⁿ/n! (z ∈ ℂ) ? | n!/nⁿ : rapport = (n/(n+1))ⁿ → 1/e < 1, converge. zⁿ/n! : rapport = \|z\|/(n+1) → 0 < 1, converge absolument pour tout z. | dans tes cartes d'origine ; programme non consulté | L3 réintégré (exemple d'application). |

### D. Séries à termes quelconques

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-26 | énoncé | Convergence absolue : que peut-on affirmer sur ∑uₙ ? | ∑uₙ converge et \|∑ₙ₌₀^{+∞} uₙ\| ≤ ∑ₙ₌₀^{+∞} \|uₙ\|. | dans tes cartes d'origine ; programme non consulté |  |
| sn-27 | piège | La réciproque (convergente ⇒ absolument convergente) est-elle vraie ? Exemple ? | Non : ∑(−1)ⁿ/n converge sans converger absolument (série semi-convergente). | dans tes cartes d'origine ; programme non consulté |  |
| sn-28 | méthode | Méthode : comment étudier une série à termes quelconques par comparaison ? | Comparer \|uₙ\| à vₙ ≥ 0 terme d'une série convergente (O, o, ≤ apcr, ~) : alors ∑uₙ converge absolument. Cette méthode ne donne aucun critère de divergence. | dans tes cartes d'origine ; programme non consulté |  |
| sn-29 | énoncé | Critère spécial des séries alternées : hypothèses et conclusion ? | (uₙ) décroissante de limite 0 (donc uₙ ≥ 0) ⇒ ∑(−1)ⁿuₙ converge. | dans tes cartes d'origine ; programme non consulté | Carte 26 scindée : convergence / signe et reste. |
| sn-30 | énoncé | Série alternée du critère spécial : signe de la somme, signe et majoration du reste ? | La somme S est du signe de u₀ (au sens large : S ≥ 0). Le reste Rₙ est du signe de son premier terme (−1)ⁿ⁺¹uₙ₊₁ (au sens large) et \|Rₙ\| ≤ uₙ₊₁. | dans tes cartes d'origine ; programme non consulté | P2 : signes au sens large. |
| sn-31 | piège | Critère des séries alternées : quelles hypothèses sont nécessaires, et que ne donne-t-il pas ? | La décroissance et la limite nulle. Il ne donne que la convergence, pas la convergence absolue. | dans tes cartes d'origine ; programme non consulté |  |
| sn-32 | énoncé | Nature et somme de la série harmonique alternée ∑ₙ≥₁ (−1)ⁿ⁻¹/n ? | Converge, de somme ln 2. | dans tes cartes d'origine ; programme non consulté |  |

### E. Comparaison série-intégrale

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-33 | énoncé | f décroissante, continue par morceaux sur ℝ₊ : encadrement de ∫ₖᵏ⁺¹ f ? | f(k+1) ≤ ∫ₖᵏ⁺¹ f ≤ f(k). À retrouver sur un dessin (rectangles), pas par cœur. | dans tes cartes d'origine ; programme non consulté |  |
| sn-34 | énoncé | Sommer cet encadrement : quel encadrement de ∑ₖ₌₀ⁿ f(k) ? | ∫₀ⁿ f + f(n) ≤ ∑ₖ₌₀ⁿ f(k) ≤ f(0) + ∫₀ⁿ f. | dans tes cartes d'origine ; programme non consulté |  |
| sn-35 | énoncé | Même hypothèse, p ≥ 1 : encadrement de ∑ₖ₌ₚⁿ f(k) ? | ∫ₚⁿ⁺¹ f ≤ ∑ₖ₌ₚⁿ f(k) ≤ ∫ₚ₋₁ⁿ f (utile pour les restes et les sommes partielles de Riemann). | dans tes cartes d'origine ; programme non consulté | L1 réintégré. Complémentaire de la carte précédente (bornes différentes), pas un doublon. |
| sn-36 | énoncé | Si f est croissante au lieu de décroissante, que deviennent ces encadrements ? | Les inégalités s'inversent : par exemple ∑ₖ₌ₚⁿ f(k) ≤ ∫ₚⁿ⁺¹ f et ∑ₖ₌ₚⁿ f(k) ≥ ∫ₚ₋₁ⁿ f (p ≥ 1). | à confirmer | L1 réintégré. Le cas croissant figure dans tes cartes ; le programme n'a pas été consulté sur ce point. |
| sn-37 | énoncé | f décroissante, positive, continue par morceaux : quand ∑f(n) converge-t-elle, et quel encadrement de sa somme ? | ∑f(n) converge ⇔ la suite (∫₀ⁿ f)ₙ converge ; alors ∫₀^{+∞} f ≤ ∑ₙ₌₀^{+∞} f(n) ≤ f(0) + ∫₀^{+∞} f. | dans tes cartes d'origine ; programme non consulté | P3 : « continue par morceaux » ajouté. |
| sn-38 | énoncé | Mêmes hypothèses : que dire de ∑wₙ avec wₙ = ∫ₙ₋₁ⁿ f − f(n) ? | Elle converge : 0 ≤ wₙ ≤ f(n−1) − f(n), terme d'une série télescopique convergente. | dans tes cartes d'origine ; programme non consulté |  |
| sn-39 | méthode | Méthode : estimer une somme partielle ou un reste par comparaison série-intégrale ? | Encadrer f sur [k, k+1], intégrer, puis sommer ; pour un reste, sommer de n+1 à N puis faire N → +∞. | dans tes cartes d'origine ; programme non consulté |  |
| sn-40 | énoncé | f décroissante, positive, c.p.m. avec ∑f(n) divergente : équivalent de Sₙ ? | Sₙ ~ ∫₀ⁿ f (on divise l'encadrement de la somme par ∫₀ⁿ f → +∞). | dans tes cartes d'origine ; programme non consulté | Carte 34 scindée : divergence / reste. |
| sn-41 | énoncé | f décroissante, positive, c.p.m. avec ∑f(n) convergente : encadrement du reste Rₙ ? | Avec I = ∫₀^{+∞} f et Iₙ = ∫₀ⁿ f : I − Iₙ₊₁ ≤ Rₙ ≤ I − Iₙ. | dans tes cartes d'origine ; programme non consulté |  |
| sn-42 | exemple | Exemple : encadrement de Hₙ = ∑ₖ₌₁ⁿ 1/k, puis équivalent ? | ln(n+1) ≤ Hₙ ≤ 1 + ln n, donc Hₙ ~ ln n. | dans tes cartes d'origine ; programme non consulté |  |
| sn-43 | exemple | Exemple : équivalent de ∑ₖ₌₂ⁿ 1/(k ln k) ? | ln ln n : f(t) = 1/(t ln t) est décroissante positive sur [2, +∞[, de primitive ln ln t, donc ∑ₖ₌₂ⁿ f(k) ~ ∫₂ⁿ f ~ ln ln n. | dans tes cartes d'origine ; programme non consulté | L9 réintégré (exemple de la carte d'origine, absent du pilote v1). |
| sn-44 | énoncé | Équivalents des sommes partielles de Riemann ∑ₖ₌₁ⁿ 1/kᵅ pour α < 1 et pour α = 1 ? | α < 1 : ∑ₖ₌₁ⁿ 1/kᵅ ~ n¹⁻ᵅ/(1−α). α = 1 : Hₙ ~ ln n. | dans tes cartes d'origine ; programme non consulté | Carte 36 scindée : sommes partielles / reste. |
| sn-45 | énoncé | Équivalent du reste de Riemann ∑ₖ>ₙ 1/kᵅ pour α > 1 ? | ∑ₖ₌ₙ₊₁^{+∞} 1/kᵅ ~ 1/((α−1)nᵅ⁻¹). | dans tes cartes d'origine ; programme non consulté |  |
| sn-46 | énoncé | Équivalent de ζ(x) quand x → 1⁺ ? | ζ(x) ~ 1/(x−1) (encadrement 1/(x−1) ≤ ζ(x) ≤ 1 + 1/(x−1) par comparaison série-intégrale). | dans tes cartes d'origine ; programme non consulté | L8 : fait de la carte d'origine, non repéré dans le rapport v1 ; réintégré. |
| sn-47 | énoncé | Constante d'Euler : énoncé ? | Il existe γ ∈ ℝ tel que Hₙ = ln n + γ + o(1) (la suite Hₙ − ln n converge). | dans tes cartes d'origine ; programme non consulté |  |
| sn-48 | démonstration | Constante d'Euler : idée de la preuve ? | vₙ = Hₙ − ln n ; vₙ₊₁ − vₙ = 1/(n+1) − ln(1 + 1/n) = O(1/n²), terme d'une série convergente, donc (vₙ) converge. | dans tes cartes d'origine ; programme non consulté |  |
| sn-49 | énoncé | Développement affiné de Hₙ ? | Hₙ = ln n + γ + 1/(2n) + o(1/n). | à confirmer | L2 réintégré comme complément ; exigibilité non établie (programme non consulté). |
| sn-50 | énoncé | Accélération pour ∑1/k² : majoration de \|S − (Sₙ + 1/n)\| ? | \|S − (Sₙ + 1/n)\| ≤ 1/(n(n+1)) (car 1/(n+1) ≤ Rₙ ≤ 1/n). | à confirmer | L4 réintégré comme complément ; technique d'exercice, exigibilité non établie. |

### F. Sommation des relations de comparaison

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-51 | énoncé | Sommation, cas de divergence : hypothèses et conclusions ? | v ≥ 0 apcr avec ∑vₙ divergente ; Σₙ = ∑ₖ≤ₙ vₖ. Si uₙ = O(vₙ), alors Sₙ = O(Σₙ) ; si uₙ = o(vₙ), alors Sₙ = o(Σₙ) ; si uₙ ~ vₙ, alors Sₙ ~ Σₙ. | dans tes cartes d'origine ; programme non consulté |  |
| sn-52 | énoncé | Sommation, cas de convergence : hypothèses et conclusions ? | v ≥ 0 apcr avec ∑vₙ convergente ; ρₙ = ∑ₖ>ₙ vₖ. Si uₙ = O(vₙ), o(vₙ) ou ~ vₙ, alors ∑uₙ converge et Rₙ = O(ρₙ), o(ρₙ) ou ~ ρₙ respectivement. | dans tes cartes d'origine ; programme non consulté |  |
| sn-53 | piège | Sommation (cas de divergence) : contre-exemple si la suite de référence n'est pas de signe constant ? | uₙ = (−1)ⁿ + 1/n et vₙ = (−1)ⁿ (n ≥ 1) : uₙ ~ vₙ, ∑vₙ diverge, mais Sₙ ~ ln n alors que Σₙ ∈ {−1, 0} est bornée : on n'a pas Sₙ ~ Σₙ. | dans tes cartes d'origine ; programme non consulté | P5 : remplace la carte 41 (« sans cela c'est faux »). Contre-exemple construit et vérifié par calcul ; il n'est pas dans tes cartes d'origine. |
| sn-54 | énoncé | Lemme de Cesàro : énoncé ? | Si uₙ → ℓ, alors la moyenne vₙ = (1/(n+1)) ∑ₖ≤ₙ uₖ tend vers ℓ. | dans tes cartes d'origine ; programme non consulté |  |
| sn-55 | énoncé | Lemme de Cesàro : que se passe-t-il si uₙ → +∞ ? | Les moyennes tendent aussi vers +∞. | dans tes cartes d'origine ; programme non consulté |  |
| sn-56 | méthode | Méthode : équivalent d'une somme partielle ou d'un reste par sommation d'équivalents ? | Trouver vₙ ~ uₙ télescopique : 1/n ~ ln(n+1) − ln n donc Hₙ ~ ln n ; 1/n² ~ 1/(n−1) − 1/n donc Rₙ ~ 1/n ; 1/√n ~ 2(√(n+1) − √n) donc ∑ₖ≤ₙ 1/√k ~ 2√n. | dans tes cartes d'origine ; programme non consulté |  |

### G. Produit de Cauchy

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| sn-57 | définition | Définition du produit de Cauchy de ∑uₙ et ∑vₙ ? | ∑wₙ avec wₙ = ∑ₖ₌₀ⁿ uₖvₙ₋ₖ = ∑ₚ₊q₌ₙ uₚvq (sommation par diagonales). | dans tes cartes d'origine ; programme non consulté |  |
| sn-58 | énoncé | Théorème du produit de Cauchy : hypothèses et conclusion ? | ∑uₙ et ∑vₙ absolument convergentes ⇒ ∑wₙ absolument convergente et ∑ₙ₌₀^{+∞} wₙ = (∑ₙ₌₀^{+∞} uₙ)(∑ₙ₌₀^{+∞} vₙ). | dans tes cartes d'origine ; programme non consulté |  |
| sn-59 | exemple | Deux applications du produit de Cauchy ? | exp(z + z′) = exp z · exp z′ ; pour \|a\| < 1, 1/(1−a)² = ∑ₙ≥₀ (n+1)aⁿ. | dans tes cartes d'origine ; programme non consulté | Carte 46 scindée : théorème / exemples. |
| sn-60 | piège | Pourquoi l'absolue convergence est-elle indispensable au produit de Cauchy ? | uₙ = vₙ = (−1)ⁿ/√(n+1) : les séries convergent (critère des séries alternées) mais \|wₙ\| ≥ 1, donc ∑wₙ diverge grossièrement. | dans tes cartes d'origine ; programme non consulté | Carte optionnelle 47 du pilote v1, promue. |
| sn-61 | exemple | Exponentielle de matrices : exp(A + B) pour A, B ∈ 𝓜ₙ(𝕂) ? | Si AB = BA, alors exp(A + B) = exp A · exp B (où exp A = ∑ Aᵏ/k!, absolument convergente). | à confirmer | L6 réintégré comme complément ; à relier au chapitre « Équations différentielles ». Exigibilité à confirmer. |
