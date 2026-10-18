# Cartes : techniques-asymptotiques

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Relations de comparaison : définitions

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-01 | définition | Définir uₙ = O(vₙ), uₙ = o(vₙ) et uₙ ∼ vₙ pour des suites (vₙ non nul à partir d'un certain rang). | O : (uₙ/vₙ) est bornée. o : uₙ/vₙ → 0 (notation uₙ ≪ vₙ). ∼ : uₙ/vₙ → 1. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-02 | définition | Écrire uₙ = O(vₙ) et uₙ = o(vₙ) avec des inégalités (sans quotient). | O : ∃K, \|uₙ\| ≤ K\|vₙ\| à partir d'un certain rang. o : ∀ε>0, \|uₙ\| ≤ ε\|vₙ\| apcr. Forme équivalente : uₙ = vₙwₙ avec (wₙ) bornée (O), → 0 (o), → 1 (∼). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-03 | énoncé | Écrire uₙ ∼ vₙ avec un o. Pourquoi cette forme est-elle utile ? | uₙ ∼ vₙ ⇔ uₙ = vₙ + o(vₙ) ⇔ uₙ − vₙ = o(vₙ). C'est la forme à utiliser dans les calculs (on garde le terme d'erreur). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-04 | piège | Que signifie le signe « = » dans uₙ = o(vₙ) ? Exemple de piège ? | Une appartenance (uₙ fait partie des o(vₙ)), pas une égalité symétrique : n = o(n³) et n² = o(n³) mais n ≠ n². | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-05 | piège | uₙ ∼ vₙ équivaut-il à uₙ − vₙ → 0 ? Contre-exemples dans les deux sens. | Non. n²+n ∼ n² mais la différence → +∞. 1/n² et 1/n ont une différence → 0 mais 1/n² ≁ 1/n (quotient → 0). Une équivalence est une information relative, pas absolue. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-06 | piège | Peut-on écrire uₙ ∼ 0 ? Que signifierait-ce ? | Cela signifie uₙ = 0 + o(0), donc uₙ nul à partir d'un certain rang. Obtenir « ∼ 0 » pour une suite non nulle est une erreur de calcul. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | Chaptal : « on n'écrit jamais f ∼ 0 ». |
| ta-07 | énoncé | Entre O, o et ∼, quelles implications ? Les réciproques sont-elles vraies ? | uₙ = o(vₙ) ⇒ uₙ = O(vₙ) ; uₙ ∼ vₙ ⇒ uₙ = O(vₙ). Réciproques fausses : (−1)ⁿ = O(1) sans être o(1) ni ∼ 1 ; 2n = O(n) sans être ∼ n. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-08 | énoncé | Que signifient uₙ = o(1), uₙ = O(1) et uₙ = ℓ + o(1) ? Peut-on ignorer une constante non nulle dans o(·) ? | uₙ = o(1) ⇔ uₙ → 0 ; uₙ = O(1) ⇔ (uₙ) bornée ; uₙ = ℓ + o(1) ⇔ uₙ → ℓ. Pour α ≠ 0 : u = o(αv) ⇔ u = o(v) (idem O). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |

### B. Croissances comparées

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-09 | énoncé | Écrire les croissances comparées pour les suites (α > 0, β > 0, q > 1). Que deviennent-elles pour les inverses ? | lnᵝ n ≪ nᵅ ≪ qⁿ ≪ n! ≪ nⁿ. Pour les inverses l'ordre s'inverse : 1/nⁿ ≪ 1/n! ≪ 1/qⁿ ≪ 1/nᵅ ≪ 1/lnᵝ n. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-10 | exemple | Déterminer l'ordre de négligeabilité entre ln n, √n, n, n ln n et n². | ln n ≪ √n ≪ n ≪ n ln n ≪ n² (l'exemple vient de la comparaison ln n ≪ nᵅ et de la multiplication par n). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-11 | énoncé | Énoncer les croissances comparées pour les fonctions (α, β > 0) : en +∞, en 0⁺ et en −∞. | En +∞ : (ln x)ᵝ = o(xᵅ) et xᵅ = o(e^{βx}). En 0⁺ : xᵅ\|ln x\|ᵝ → 0. En −∞ : \|x\|ᵅe^{βx} → 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté (cas ln, xᵅ, exp en +∞ et ln, xᵅ en 0) |  |
| ta-12 | démonstration | Démontrer lnᵝ n ≪ nᵅ et nᵅ ≪ qⁿ (α, β > 0, q > 1). | 1) lnᵝn/nᵅ = (ln n/n^{α/β})ᵝ → 0 car ln x/x^γ → 0 (γ>0). 2) nᵅ/qⁿ = exp(α ln n − n ln q) → 0 car n ln q domine α ln n. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-13 | démonstration | Démontrer qⁿ ≪ n! ≪ nⁿ (q > 1). | qⁿ/n! : le rapport q/(n+1) → 0 donc ≤ 1/2 apcr, la suite décroît au moins comme (1/2)ⁿ : → 0. n!/nⁿ = (1/n)∏_{k=2}ⁿ(k/n) ≤ 1/n → 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |

### C. Règles sur o et O

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-14 | énoncé | Quelles règles de calcul sur o et O : combinaison linéaire, produit, transitivité ? | u = o(w), v = o(w) ⇒ αu + βv = o(w) ; u = o(v), a = o(b) ⇒ ua = o(vb) ; u = o(v), v = o(w) ⇒ u = o(w). Mêmes règles pour O (hyp. v, w, b non nuls apcr). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |

### D. Équivalents : règles et pièges

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-15 | énoncé | La relation ∼ est-elle une relation d'équivalence ? Sur quelles suites ? | Oui : réflexive, symétrique (vₙ/uₙ = 1/(uₙ/vₙ) → 1), transitive (produit des quotients), sur les suites non nulles à partir d'un certain rang. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-16 | énoncé | Quelles opérations sont licites sur les équivalents : produit, quotient, puissance, sous-suite ? | uₙ∼vₙ et aₙ∼bₙ ⇒ uₙaₙ ∼ vₙbₙ et uₙ/aₙ ∼ vₙ/bₙ ; uₙ∼vₙ ⇒ uₙᵅ ∼ vₙᵅ pour α FIXÉ (uₙ, vₙ > 0 apcr si α non entier) ; u_{φ(n)} ∼ v_{φ(n)} (φ extractrice). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | Divergence : la note d'origine n'exigeait pas uₙ, vₙ > 0 pour une puissance réelle quelconque ; Chaptal l'exige. |
| ta-17 | énoncé | Que conservent deux suites équivalentes (signe, limite) ? Quand uₙ ∼ ℓ ? | Même signe apcr ; si uₙ ∼ vₙ et vₙ → ℓ (fini ou infini) alors uₙ → ℓ ; pour ℓ fini non nul : uₙ → ℓ ⇔ uₙ ∼ ℓ. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-18 | piège | Peut-on additionner ou soustraire des équivalents ? Contre-exemple. | Non. n²+n ∼ n² et −n² ∼ −n², mais la somme n n'est pas équivalente à 0. Remède : revenir à uₙ = vₙ + o(vₙ), factoriser le terme dominant, utiliser un DL. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-19 | piège | Peut-on élever un équivalent à une puissance qui dépend de n ? Contre-exemple. | Non, l'exposant doit être fixe : 1+1/n ∼ 1 mais (1+1/n)ⁿ → e donc (1+1/n)ⁿ ≁ 1ⁿ = 1. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-20 | piège | Peut-on composer un équivalent par une fonction (exp, ln, ...) ? Contre-exemple. | En général non : n+1 ∼ n mais e^{n+1} = e·eⁿ ≁ eⁿ (quotient → e). Pour exp, la bonne condition porte sur la différence (carte suivante). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-21 | énoncé | Pour u, v réelles : quand a-t-on e^{uₙ} ∼ e^{vₙ} ? Et ln uₙ ∼ ln vₙ ? | e^{uₙ} ∼ e^{vₙ} ⇔ uₙ − vₙ → 0. Si uₙ ∼ vₙ, uₙ, vₙ > 0, vₙ → ℓ ∈ ℝ₊ ∪ {+∞}, ℓ ≠ 1 : ln uₙ ∼ ln vₙ. | à confirmer : propriété notée « non officiellement au programme » dans la collection ; absente des sources enregistrées |  |
| ta-22 | contre-exemple | Pourquoi exclure ℓ = 1 dans « uₙ ∼ vₙ, vₙ → ℓ ⇒ ln uₙ ∼ ln vₙ » ? | uₙ = 1+1/n et vₙ = 1+1/n² : uₙ/vₙ → 1 donc uₙ ∼ vₙ, mais ln uₙ ∼ 1/n et ln vₙ ∼ 1/n², dont le quotient → +∞. | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |
| ta-23 | énoncé | Obtention d'un équivalent par encadrement : hypothèses et conclusion ? | Si uₙ ≤ wₙ ≤ vₙ apcr, uₙ ∼ vₙ et vₙ ≠ 0 apcr, alors wₙ ∼ vₙ (diviser par vₙ et utiliser l'encadrement des quotients). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté (écrit pour les fonctions, adaptation aux suites) |  |
| ta-24 | méthode | Équivalent d'un polynôme ou d'une fraction rationnelle en +∞ et en 0 ? | En +∞ : terme de plus haut degré ; en 0 : terme de plus bas degré. Ex. 3n⁴ − n + 2 ∼ 3n⁴ ; (n²+n)/(2n³+1) ∼ 1/(2n). Pour une somme quelconque : factoriser le terme prépondérant. | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |
| ta-25 | démonstration | Démontrer : uₙ ∼ vₙ ⇔ uₙ = vₙ + o(vₙ) ; ∼ est symétrique et transitive. | 1) uₙ/vₙ → 1 ⇔ (uₙ−vₙ)/vₙ → 0 ⇔ uₙ−vₙ = o(vₙ). 2) Symétrie : vₙ/uₙ = 1/(uₙ/vₙ) → 1. 3) Transitivité : (uₙ/vₙ)(vₙ/wₙ) → 1. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-26 | démonstration | Démontrer : uₙ∼vₙ et aₙ∼bₙ ⇒ uₙaₙ ∼ vₙbₙ et uₙ/aₙ ∼ vₙ/bₙ. | (uₙaₙ)/(vₙbₙ) = (uₙ/vₙ)(aₙ/bₙ) → 1·1 ; (uₙ/aₙ)/(vₙ/bₙ) = (uₙ/vₙ)(bₙ/aₙ) → 1 (aₙ, bₙ non nuls apcr). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |

### E. Équivalents usuels et développements limités

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-27 | formule | Donner les équivalents usuels de sin, tan, arcsin, arctan, sh, th en une suite hₙ → 0. | sin hₙ ∼ hₙ ; tan hₙ ∼ hₙ ; arcsin hₙ ∼ hₙ ; arctan hₙ ∼ hₙ ; sh hₙ ∼ hₙ ; th hₙ ∼ hₙ (hₙ ≠ 0 apcr). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | Hypothèse hₙ ≠ 0 apcr ajoutée par prudence (quotient). |
| ta-28 | formule | Donner les équivalents usuels de ln(1+h), eʰ−1, (1+h)ᵅ−1 et cos h−1 en 0 (α ∈ ℝ* fixé). | ln(1+h) ∼ h ; eʰ − 1 ∼ h ; (1+h)ᵅ − 1 ∼ αh ; cos h − 1 ∼ −h²/2. Pour hₙ → 0 on remplace h par hₙ (hₙ ≠ 0 apcr). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-29 | méthode | Comment étudier une fonction ou suite en un point a fini, ou en l'infini, avec les équivalents usuels ? | En a fini : poser x = a + h et h → 0. En +∞ : poser x = 1/h, h → 0⁺. On applique ensuite les équivalents et DL en 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-30 | exemple | Équivalent de ln(cos(1/n)) quand n → +∞ ? | cos(1/n) − 1 ∼ −1/(2n²) → 0, donc ln(cos(1/n)) = ln(1+hₙ) ∼ hₙ ∼ −1/(2n²). | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |
| ta-31 | exemple | Déterminer un équivalent de sin x − tan x en 0 (une différence ne s'obtient pas par équivalents). | sin x = x − x³/6 + o(x³), tan x = x + x³/3 + o(x³) : sin x − tan x = −x³/2 + o(x³) ∼ −x³/2. Les équivalents sin x ∼ x, tan x ∼ x ne donnent rien (différence). | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |
| ta-32 | définition | Définir un développement limité à l'ordre n en a. Quelle propriété d'unicité ? | f(x) = ∑ₖ₌₀ⁿ aₖ(x−a)ᵏ + o((x−a)ⁿ). Les coefficients sont uniques, et on peut tronquer à tout ordre ≤ n. Pour a ≠ 0, on étudie h ↦ f(a+h) en 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-33 | énoncé | Énoncer la formule de Taylor-Young. | Si f est de classe Cⁿ au voisinage de a : f(a+h) = ∑ₖ₌₀ⁿ f⁽ᵏ⁾(a)hᵏ/k! + o(hⁿ) quand h → 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | Recouvre rn-207 (autre chapitre) : même question, notes d'origine différentes ; garder l'une des deux à l'import. |
| ta-34 | méthode | Comment obtenir un équivalent à partir d'un DL ? Quand l'utiliser ? | Si f(x) = aₚ(x−a)ᵖ + … + o((x−a)ⁿ) avec aₚ ≠ 0 (premier terme non nul) : f(x) ∼ aₚ(x−a)ᵖ. À utiliser quand une somme ou différence se compense. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-35 | formule | Donner les DL en 0 de eˣ, sh x et ch x. | eˣ = ∑ₖ₌₀ⁿ xᵏ/k! + o(xⁿ) ; sh x = ∑ₖ₌₀ⁿ x^{2k+1}/(2k+1)! + o(x^{2n+1}) ; ch x = ∑ₖ₌₀ⁿ x^{2k}/(2k)! + o(x^{2n}). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | sh et ch absents de la carte d'origine, présents dans la liste du programme. |
| ta-36 | formule | Donner les DL en 0 de cos x et sin x. | cos x = ∑ₖ₌₀ⁿ (−1)ᵏ x^{2k}/(2k)! + o(x^{2n+1}) ; sin x = ∑ₖ₌₀ⁿ (−1)ᵏ x^{2k+1}/(2k+1)! + o(x^{2n+2}) (le terme suivant est de degré pair/impair absent). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-37 | formule | Donner les DL en 0 de 1/(1−x), 1/(1+x), ln(1+x) et (1+x)ᵅ. | 1/(1−x) = ∑ₖ₌₀ⁿ xᵏ + o(xⁿ) ; 1/(1+x) = ∑ (−1)ᵏxᵏ + o(xⁿ) ; ln(1+x) = ∑ₖ₌₁ⁿ (−1)^{k−1}xᵏ/k + o(xⁿ) ; (1+x)ᵅ = ∑ₖ₌₀ⁿ C(α,k)xᵏ + o(xⁿ), C(α,k) = α(α−1)…(α−k+1)/k!. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | 1/(1±x) ajoutés (présents dans le programme). |
| ta-38 | formule | Donner les DL en 0 de arctan x (à l'ordre 2n+1) et de tan x (ordre 3 ou 4). | arctan x = ∑ₖ₌₀ⁿ (−1)ᵏ x^{2k+1}/(2k+1) + o(x^{2n+2}) ; tan x = x + x³/3 + o(x⁴). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-39 | énoncé | Forme du DL en 0 d'une fonction paire, d'une fonction impaire ? | Paire : seuls les exposants pairs interviennent. Impaire : seuls les exposants impairs (unicité du DL). Ex. cos pair, sin impaire. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-40 | énoncé | Primitivation d'un DL : hypothèses et résultat ? Peut-on dériver un DL ? | Si f′(x) = ∑ₖ₌₀ⁿ aₖ(x−a)ᵏ + o((x−a)ⁿ) alors f(x) = f(a) + ∑ aₖ(x−a)^{k+1}/(k+1) + o((x−a)^{n+1}). Dériver un DL est faux en général : x³sin(1/x) = o(x²) mais sa dérivée n'a pas de DL₁. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté (primitivation) ; contre-exemple de dérivation ajouté et vérifié |  |
| ta-41 | méthode | DL d'un produit, d'un quotient, d'une composée : quelles précautions ? | Produit : tronquer à l'ordre du DL le moins précis. Quotient : écrire 1/(1+u) avec u → 0. Composée g(f(x)), f(x) → 0 : substituer le DL de f (petit) dans celui de g. Factoriser le terme prépondérant pour prévoir l'ordre. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-42 | exemple | DL₃(0) de eˣcos x ? | eˣcos x = 1 + x − x³/3 + o(x³) (produit des DL d'ordre 3 : le terme en x² s'annule, x³ : 1/6 − 1/2 = −1/3). | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |

### F. Développements asymptotiques et méthodes

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-43 | définition | Définir un développement asymptotique à la précision v⁽ʳ⁾ d'une suite. | Avec v⁽ᵏ⁺¹⁾ₙ = o(v⁽ᵏ⁾ₙ) : uₙ = v⁽¹⁾ₙ + … + v⁽ʳ⁾ₙ + o(v⁽ʳ⁾ₙ). Les v⁽ᵏ⁾ forment des termes de plus en plus petits (échelle de comparaison, notion hors programme). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté | Erreur de la carte d'origine : u − v⁽¹⁾ − … − v⁽ʳ⁾ est o(v⁽ʳ⁾) mais n'est pas toujours équivalent à une puissance de l'échelle choisie ; on cherche un équivalent s'il existe. |
| ta-44 | méthode | Méthode pour obtenir un développement asymptotique d'une suite ? | Équivalent uₙ ∼ vₙ ; puis équivalent de uₙ − vₙ ; etc. Ou reconnaître un DL, ou réinjecter le développement partiel dans la relation qui définit uₙ. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-45 | exemple | Développement de (1+1/n)ⁿ en +∞ à deux termes ? | n ln(1+1/n) = 1 − 1/(2n) + O(1/n²), donc (1+1/n)ⁿ = e·exp(−1/(2n) + O(1/n²)) = e − e/(2n) + o(1/n). | à confirmer : absent des sources enregistrées ; programme officiel non consulté |  |
| ta-46 | exemple | xₙ unique solution de x + ln x = n (x>0) : développement asymptotique ? | xₙ ∼ n (xₙ → +∞, ln xₙ = o(xₙ)). Puis ln xₙ = ln n + o(1) et xₙ = n − ln xₙ, d'où xₙ = n − ln n + o(1). | à confirmer : exemple de suite implicite cité par le programme (« équations à paramètre ») ; énoncé précis absent des sources lues |  |
| ta-47 | formule | Donner la formule de Stirling et la forme asymptotique de ln(n!). | n! ∼ √(2πn)(n/e)ⁿ. Donc ln(n!) = n ln n − n + ½ ln n + ½ ln(2π) + o(1). Ex. (n!)^{1/n} ∼ n/e. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-48 | exemple | Équivalent de ln(n!) sans Stirling ? | ln(n!) = ∑ ln k ∼ ∫₁^{n+1} ln t dt ∼ n ln n par sommation des relations de comparaison (ln n ≤ ∫ₙ^{n+1} ln t dt ≤ ln(n+1)). | confirmé : figure dans LANDELLE-CH02 ; programme officiel non consulté |  |

### G. Wallis et Stirling

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| ta-49 | méthode | Méthode pour l'équivalent de l'intégrale de Wallis Iₙ = ∫₀^{π/2} sinⁿt dt ? | IPP : Iₙ = (n−1)/n·Iₙ₋₂ ; (Iₙ) décroît donc Iₙ ∼ Iₙ₋₁ ; nIₙIₙ₋₁ = π/2 est constant ; donc nIₙ² ∼ π/2 et Iₙ ∼ √(π/(2n)). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-50 | démonstration | Démontrer Iₙ ∼ √(π/(2n)) (Wallis). | 1) IPP : Iₙ = (n−1)/n Iₙ₋₂. 2) nIₙIₙ₋₁ = I₁I₀ = π/2. 3) 0 < Iₙ₊₁ ≤ Iₙ ≤ Iₙ₋₁ = n/(n−1)Iₙ₊₁ : Iₙ ∼ Iₙ₋₁. 4) nIₙ² ∼ π/2, Iₙ > 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-51 | exemple | Équivalent de C(2n,n) par Stirling ? | C(2n,n) = (2n)!/n!² ∼ √(4πn)(2n/e)^{2n} / (2πn (n/e)^{2n}) = 4ⁿ/√(πn). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté |  |
| ta-52 | démonstration | Stirling : pourquoi n! e^n / n^{n+1/2} converge-t-elle vers K > 0 ? | uₙ = n!eⁿ/n^{n+1/2} : ln(uₙ₊₁/uₙ) = 1 − (n+½)ln(1+1/n) = O(1/n²) (DL). Série télescopique convergente donc ln uₙ → L et uₙ → K = e^L > 0. | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté (Stirling : démonstration non exigible) | Carte tirée du paquet « séries numériques » (note 1790095284084) : démonstration de Stirling. |
| ta-53 | démonstration | Stirling : comment identifier K = √(2π) avec Wallis ? | I₂ₙ = (2n)!/(4ⁿn!²)·π/2 ∼ √(π/(4n)). Avec Stirling : (2n)!/n!² ∼ √2·4ⁿ/(K√n), donc (√2/(K√n))·π/2 ∼ √π/(2√n), d'où K = √(2π). | confirmé : figure dans PROGRAMME-MPSI-2021 ; programme officiel non consulté (Stirling : démonstration non exigible) |  |
