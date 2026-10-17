# Cartes : series-entieres

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Rayon de convergence

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-01 | définition | Définir une série entière (variable complexe ou réelle). | Série de fonctions ∑aₙzⁿ avec (aₙ)∈ℂ^ℕ (z∈ℂ, ou x∈ℝ) ; on confond zⁿ et z↦zⁿ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-02 | hypothèses | Énoncer le lemme d'Abel. | Si r>0 et si (aₙrⁿ) est bornée, alors pour tout z∈ℂ avec \|z\|<r, la série ∑aₙzⁿ converge absolument. (La convergence de ∑aₙrⁿ n'est pas exigée.) | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-03 | démonstration | Démontrer le lemme d'Abel. | \|aₙrⁿ\|≤M. Pour \|z\|<r : \|aₙzⁿ\|=\|aₙrⁿ\|(\|z\|/r)ⁿ≤M q^n avec q=\|z\|/r<1. Comparaison à une série géométrique convergente : convergence absolue. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-04 | définition | Définir le rayon de convergence R de ∑aₙzⁿ. | R=sup{r∈ℝ₊ \| (aₙrⁿ) bornée}∈[0,+∞]. C'est le seul réel tel que la série converge absolument pour \|z\|<R et diverge grossièrement pour \|z\|>R. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-05 | énoncé | Que dire de ∑aₙzⁿ selon que \|z\|<R, \|z\|>R ou \|z\|=R ? | \|z\|<R : convergence absolue. \|z\|>R : divergence grossière ((aₙzⁿ) non bornée). \|z\|=R : aucune conclusion générale (cas par cas). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-06 | énoncé | Comment déduire un encadrement de R de la convergence ou divergence de ∑aₙz₀ⁿ ? Et d'une propriété de (aₙ) ? | ∑aₙz₀ⁿ converge ⇒ R≥\|z₀\| ; diverge ⇒ R≤\|z₀\|. (aₙ) bornée ⇒ R≥1 ; aₙ↛0 ⇒ R≤1. Ex. : ∑cos(n)zⁿ a R=1. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-07 | démonstration | Démontrer : \|z\|<R ⇒ convergence absolue ; \|z\|>R ⇒ divergence grossière. | \|z\|<R : par définition du sup, ∃r∈]\|z\|,R[ avec (aₙrⁿ) bornée ; lemme d'Abel. \|z\|>R : (aₙzⁿ) non bornée (sinon \|z\|≤R), donc ne tend pas vers 0 : divergence grossière. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |

### B. Calcul pratique du rayon

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-08 | hypothèses | Énoncer la règle de d'Alembert pour le rayon de convergence d'une série entière. | Si aₙ≠0 à partir d'un rang et \|aₙ₊₁\|/\|aₙ\|→ℓ∈[0,+∞], alors R=1/ℓ (R=+∞ si ℓ=0, R=0 si ℓ=+∞). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-09 | démonstration | Démontrer R=1/ℓ sous les hypothèses de d'Alembert. | \|aₙ₊₁zⁿ⁺¹\|/\|aₙzⁿ\|→ℓ\|z\|. Si ℓ\|z\|<1, d'Alembert numérique : convergence ; si ℓ\|z\|>1 : divergence. Donc la série converge pour \|z\|<1/ℓ et diverge pour \|z\|>1/ℓ : R=1/ℓ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-10 | piège | Que faire pour calculer R quand \|aₙ₊₁/aₙ\| n'a pas de limite ou quand aₙ s'annule une infinité de fois ? | (i) Étudier la bornitude de (aₙrⁿ) (définition de R) ; (ii) appliquer d'Alembert aux termes \|aₙzⁿ\| à z fixé (série lacunaire) ; (iii) encadrer par comparaison (aₙ=O(bₙ)). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-11 | exemple | Donner les rayons de ∑zⁿ, ∑zⁿ/n!, ∑n!zⁿ et ∑zⁿ/n. | Par d'Alembert : R=1 ; R=+∞ ; R=0 (le rapport vaut n+1→+∞) ; R=1. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-12 | exemple | Calculer le rayon de ∑C(2n,n)zⁿ. | aₙ₊₁/aₙ=(2n+1)(2n+2)/(n+1)²=2(2n+1)/(n+1)→4. Donc R=1/4. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-13 | exemple | Rayon de ∑aₙzⁿ avec aₙ=2ⁿ (n pair), 3ⁿ (n impair) ? Pourquoi d'Alembert échoue-t-il ? | Le rapport aₙ₊₁/aₙ vaut 3(3/2)ⁿ (n pair, →+∞) ou 2(2/3)ⁿ (n impair, →0) : pas de limite. (aₙrⁿ) bornée ⇔ (2r)^{2k} et (3r)^{2k+1} bornées ⇔ r≤1/3 : R=1/3 (encadrement 2ⁿ≤aₙ≤3ⁿ). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-14 | exemple | Rayon de la série lacunaire ∑2ⁿz^{n²} ? Pourquoi pas 1/2 ? | D'Alembert sur les termes : \|2ⁿ⁺¹z^{(n+1)²}\|/\|2ⁿzⁿ²\|=2\|z\|^{2n+1}→0 si \|z\|<1, →+∞ si \|z\|>1 : R=1 (et non 1/2 : les coefficients, nuls hors des carrés, ne forment pas (2ⁿ)). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-15 | énoncé | Quel est le rayon de ∑aₙz^{2n} en fonction du rayon R de ∑aₙzⁿ ? | √R (avec √(+∞)=+∞). Car ∑aₙz^{2n}=∑aₙ(z²)ⁿ converge si \|z\|²<R et diverge si \|z\|²>R. | à confirmer : énoncé général absent des sources lues et de PROGRAMME-MP-2021 | Conséquence directe de la définition ; énoncé général non explicité dans les sources (technique de d'Alembert sur les termes seulement). |

### C. Domaine de convergence et comparaison

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-16 | définition | Définir le disque ouvert et l'intervalle ouvert de convergence. | Disque ouvert D(0,R)={\|z\|<R} ; intervalle ouvert ]−R,R[ (ℂ, resp. ℝ, si R=+∞). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-17 | piège | Que se passe-t-il sur le bord \|z\|=R ? Exemple avec ∑zⁿ/n. | Aucune conclusion générale. ∑zⁿ/n : R=1 ; diverge en z=1 (harmonique), converge en z=−1 ; en fait converge pour tout \|z\|=1, z≠1. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-18 | énoncé | Quel encadrement du domaine de convergence de ∑aₙzⁿ (resp. ∑aₙxⁿ) donne R ? | D(0,R)⊂𝒟_ℂ⊂D̄(0,R) ; ]−R,R[⊂𝒟_ℝ⊂[−R,R]. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-19 | exemple | Déterminer le domaine de définition réel de x↦∑_{n≥1}xⁿ/n. | R=1 (d'Alembert). x=1 : série harmonique, diverge. x=−1 : série alternée, converge (CSSA). Domaine : [−1,1[. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-20 | énoncé | Comment comparer les rayons de ∑aₙzⁿ et ∑bₙzⁿ lorsque \|aₙ\|≤\|bₙ\|, aₙ=O(bₙ), ou \|aₙ\|∼\|bₙ\| ? | \|aₙ\|≤\|bₙ\| apcr ou aₙ=O(bₙ) (a fortiori o(bₙ)) ⇒ R_a≥R_b. \|aₙ\|∼\|bₙ\| ⇒ R_a=R_b. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-21 | énoncé | Quelle relation lie les rayons de ∑aₙzⁿ et ∑nᵅaₙzⁿ (α∈ℝ) ? | Ils sont égaux. En particulier ∑aₙzⁿ, ∑naₙzⁿ⁻¹ et ∑aₙzⁿ⁺¹/(n+1) ont le même rayon. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-22 | démonstration | Démontrer la comparaison des rayons (O) et que ∑nᵅaₙzⁿ a même rayon que ∑aₙzⁿ. | aₙ=O(bₙ) : pour r<R_b, (bₙrⁿ) bornée donc (aₙrⁿ) aussi : R_a≥R_b. ∼ : O dans les deux sens. nᵅaₙ : pour r<r'<R, nᵅrⁿ=o(r'ⁿ) donc R'≥R ; symétrique avec −α. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |

### D. Somme, produit de Cauchy

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-23 | hypothèses | Que dire du rayon et de la somme de ∑(aₙ+bₙ)zⁿ ? | R≥min(R_a,R_b) et, pour \|z\|<min(R_a,R_b), ∑(aₙ+bₙ)zⁿ=∑aₙzⁿ+∑bₙzⁿ. Si R_a≠R_b : R=min(R_a,R_b). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-24 | piège | Peut-on avoir R>min(R_a,R_b) pour la somme ? Exemple. | Oui si R_a=R_b : aₙ=1, bₙ=−1 donnent R=+∞ alors que R_a=R_b=1. (Pour R_a≠R_b, R=min exactement.) | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-25 | définition | Définir le produit de Cauchy de ∑aₙzⁿ et ∑bₙzⁿ. | ∑cₙzⁿ avec cₙ=∑_{k=0}^n aₖbₙ₋ₖ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-26 | hypothèses | Que dire du rayon et de la somme du produit de Cauchy de deux séries entières ? | R≥min(R_a,R_b) et pour \|z\|<min(R_a,R_b) : ∑cₙzⁿ=(∑aₙzⁿ)(∑bₙzⁿ). Le rayon peut dépasser min (ex. (1−z)·∑zⁿ=1). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-27 | démonstration | Démontrer l'énoncé sur la somme et le produit de Cauchy de séries entières. | Somme : pour \|z\|<min, deux séries absolument convergentes. Si R_a<\|z\|<R_b, ∑aₙzⁿ diverge et ∑bₙzⁿ converge donc la somme diverge : R≤R_a. Produit : produit de Cauchy de deux séries absolument convergentes de termes aₙzⁿ, bₙzⁿ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-28 | exemple | Donner le rayon et la somme de ∑(∑_{k≤n}1/k!)zⁿ. | Produit de Cauchy de ∑zⁿ/n! (R=∞) et ∑zⁿ (R=1) : R≥1 et somme eᶻ/(1−z) sur D(0,1). Comme aₙ→e≠0, R≤1, donc R=1. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-29 | exemple | Donner la somme et le rayon de ∑Hₙxⁿ (Hₙ=∑_{k=1}^n1/k). | Produit de Cauchy de −ln(1−x)=∑_{n≥1}xⁿ/n et 1/(1−x)=∑xⁿ : ∑Hₙxⁿ=−ln(1−x)/(1−x) sur ]−1,1[. R=1 (1≤Hₙ≤n pour n≥1). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-30 | démonstration | Démontrer e^{z+z'}=eᶻ·e^{z'} avec le produit de Cauchy. | ∑zⁿ/n! et ∑z'ⁿ/n! sont absolument convergentes. Produit de Cauchy : cₙ=∑ₖzᵏz'ⁿ⁻ᵏ/(k!(n−k)!)=(z+z')ⁿ/n! (binôme). Donc eᶻe^{z'}=∑(z+z')ⁿ/n!=e^{z+z'}. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |

### E. Régularité de la somme (continuité, dérivation, primitivation)

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-31 | hypothèses | Que dire de la convergence normale de ∑aₙzⁿ sur un disque fermé de centre 0 ? | Pour tout r<R, ∑aₙzⁿ converge normalement sur D̄(0,r) (‖aₙzⁿ‖∞=\|aₙ\|rⁿ et ∑\|aₙ\|rⁿ converge). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-32 | énoncé | Que dire de la continuité de la somme d'une série entière ? | f=∑aₙzⁿ est continue sur D(0,R) (CN sur tout D̄(0,r), r<R, donc CU sur tout disque fermé inclus). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-33 | piège | La série entière ∑aₙzⁿ converge-t-elle normalement sur le disque ouvert D(0,R) ? | En général non : ∑zⁿ a ‖zⁿ‖∞,D(0,1)=1 pour tout n. La CN n'a lieu que sur les disques fermés de rayon r<R. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-34 | hypothèses | Si ∑\|aₙ\|Rⁿ converge (R fini non nul), que dire de la convergence et de la somme sur D̄(0,R) ? | ∑aₙzⁿ converge normalement sur D̄(0,R) et sa somme est continue sur D̄(0,R). Ex. : ∑zⁿ/n² sur D̄(0,1). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-35 | formule | Énoncer la formule de Cauchy donnant les coefficients d'une série entière. | Pour 0<r<R et f=∑aₙzⁿ : aₙ=(1/2π)∫₀^{2π}f(re^{it})e^{−int}dt. (Preuve : CN en t, intégration terme à terme, ∫₀^{2π}e^{i(k−n)t}dt=2πδ_{kn}.) | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-36 | hypothèses | Que dire de la dérivation terme à terme d'une série entière réelle ? | ∑naₙxⁿ⁻¹ a le même rayon R ; f est C¹ sur ]−R,R[ et f'(x)=∑_{n≥1}naₙxⁿ⁻¹. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-37 | formule | Que dire de la classe de f=∑aₙxⁿ et de ses dérivées successives ? | f est C^∞ sur ]−R,R[ et f^{(p)}(x)=∑_{n≥p}n!/(n−p)!·aₙxⁿ⁻ᵖ (même rayon). Ex. 1/(1−x)^{q+1}=∑_{n≥q}C(n,q)xⁿ⁻ᵠ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-38 | hypothèses | Que dire de la primitivation terme à terme d'une série entière ? | ∑aₙxⁿ⁺¹/(n+1) a le même rayon R et F(x)=F(0)+∑_{n≥0}aₙxⁿ⁺¹/(n+1) sur ]−R,R[ pour toute primitive F de f. Ex. ln(1+x)=∑_{n≥1}(−1)ⁿ⁻¹xⁿ/n. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-39 | démonstration | Démontrer la dérivation et la primitivation terme à terme d'une série entière. | Même rayon (nᵅ aₙ). CN des dérivées sur [−r,r], r<R : théorème de dérivation des séries de fonctions : C¹ et f'=∑naₙxⁿ⁻¹ ; récurrence : C^∞. Primitive : ∑aₙxⁿ⁺¹/(n+1) a pour dérivée f. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-40 | exemple | Écrire le développement en série entière de 1/(1−x)² et de 1/(1−x)^{q+1} sur ]−1,1[. | Dériver 1/(1−x)=∑xⁿ : 1/(1−x)²=∑_{n≥0}(n+1)xⁿ ; en dérivant q fois et divisant par q! : 1/(1−x)^{q+1}=∑_{n≥q}C(n,q)xⁿ⁻ᵠ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |

### F. Coefficients, unicité, théorème d'Abel

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-41 | formule | Si f=∑aₙxⁿ a un rayon R>0, que valent les coefficients aₙ ? | aₙ=f^{(n)}(0)/n! (dériver n fois terme à terme et évaluer en 0). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-42 | hypothèses | Énoncer l'unicité du développement en série entière. | Si ∑aₙxⁿ et ∑bₙxⁿ (rayons >0) ont même somme sur un ]0,α] (α>0), alors aₙ=bₙ pour tout n ; ces séries ont alors même rayon. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-43 | démonstration | Démontrer aₙ=f^{(n)}(0)/n! puis l'unicité. | f^{(n)}(x)=∑_{k≥n}k!/(k−n)!·aₖxᵏ⁻ⁿ ; en 0 il reste n!aₙ. Unicité : ∑(aₙ−bₙ)xⁿ nulle au voisinage de 0 a toutes ses dérivées nulles en 0, donc aₙ=bₙ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-44 | hypothèses | Énoncer le théorème d'Abel (convergence radiale). | Si ∑aₙxⁿ a un rayon R∈]0,+∞[ et si ∑aₙRⁿ converge, alors ∑_{n=0}^{+∞}aₙxⁿ→∑_{n=0}^{+∞}aₙRⁿ quand x→R⁻ (la somme est continue sur ]−R,R]). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-45 | exemple | Calculer ∑_{n≥1}(−1)ⁿ⁻¹/n par le théorème d'Abel. | ln(1+x)=∑(−1)ⁿ⁻¹xⁿ/n sur ]−1,1[ ; la série converge en x=1 (CSSA) : ∑(−1)ⁿ⁻¹/n=lim_{x→1⁻}ln(1+x)=ln 2. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-46 | piège | La réciproque du théorème d'Abel est-elle vraie ? Dans quel cas l'est-elle ? | Non en général : ∑(−1)ⁿxⁿ=1/(1+x)→1/2 en 1⁻ mais ∑(−1)ⁿ diverge. Vraie si aₙ≥0 : si f a une limite finie en R⁻, ∑aₙRⁿ converge (sommes partielles ≤ f(x)≤L). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-47 | démonstration | Expliquer comment prouver le théorème d'Abel (hors programme) et sa réciproque pour aₙ≥0. | R=1, S=∑aₙ, rₙ reste : f(x)−S=(x−1)∑rₙxⁿ ; couper n≤N / n>N avec \|rₙ\|≤ε. Réciproque (aₙ≥0) : ∑_{k≤N}aₖxᵏ≤f(x)≤L, x→1⁻ : ∑_{k≤N}aₖ≤L, sommes partielles majorées. | confirmé : figure dans PROST-SERIES-ENTIERES (preuve hors programme selon PROGRAMME-MP-2021) |  |

### G. Fonctions développables en série entière

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-48 | définition | Définir « f est développable en série entière sur ]−r,r[ » (resp. D(0,r)). | ∃(aₙ), ∀x∈]−r,r[ (resp. ∀z∈D(0,r)), f(x)=∑_{n=0}^{+∞}aₙxⁿ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-49 | énoncé | Quelles propriétés a une fonction développable en série entière sur ]−r,r[ ? | Elle est C^∞ sur ]−r,r[ ; somme et produit de fonctions développables sont développables ; deux fonctions développables égales au voisinage de 0 ont même développement. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-50 | exemple | La fonction z↦z̄ est-elle développable en série entière sur ℂ ? | Non : sur ℝ elle vaut x, donc a₁=1 et aₙ=0 sinon (unicité) ; mais en z=iy la série donne iy≠−iy=z̄. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-51 | hypothèses | Si f est développable en série entière sur ]−r,r[, que valent ses coefficients ? Quel lien avec le DL ? | f est C^∞ et f(x)=∑f^{(n)}(0)/n!·xⁿ (somme de sa série de Taylor). Alors f(x)=∑_{k≤n}aₖxᵏ+o(xⁿ) : le DL en 0 est la troncature. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-52 | contre-exemple | Une fonction C^∞ est-elle toujours somme de sa série de Taylor ? Contre-exemple. | Non : f(x)=e^{−1/x²}, f(0)=0, est C^∞ avec f^{(n)}(0)=0 pour tout n ; sa série de Taylor est nulle mais f n'est nulle sur aucun voisinage de 0. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-53 | démonstration | Montrer que f(x)=e^{−1/x²} (f(0)=0) est C^∞, f^{(n)}(0)=0, et n'est pas développable en série entière. | Récurrence : sur ℝ*, f^{(n)}(x)=Pₙ(1/x)e^{−1/x²}, Pₙ polynôme. Croissances comparées : f^{(n)}(x)→0 en 0, d'où f^{(n)}(0)=0 (limite de la dérivée). Si f=∑aₙxⁿ, aₙ=f^{(n)}(0)/n!=0 : f=0 près de 0, faux. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-54 | définition | Qu'appelle-t-on fonction analytique, et quel est le statut de ce résultat dans les sources ? | Fonction développable en série entière au voisinage de tout point de son domaine (Prost y renvoie en introduction). L'analyticité de la somme d'une série entière en x₀≠0 n'est pas démontrée dans les sources lues. | à confirmer : théorème d'analyticité absent des sources lues et de PROGRAMME-MP-2021 | Le cours PROST-SERIES-ENTIERES ne mentionne l'analyticité qu'en introduction. |

### H. Développements usuels

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-55 | formule | Donner les développements en série entière de exp, ch, sh et leurs domaines. | eˣ=∑xⁿ/n! ; ch x=∑x²ⁿ/(2n)! ; sh x=∑x²ⁿ⁺¹/(2n+1)!. Rayon +∞ : valables sur ℝ (eᶻ sur ℂ). | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-56 | formule | Donner les développements de cos, sin et sin x/x sur ℝ. | cos x=∑(−1)ⁿx²ⁿ/(2n)! ; sin x=∑(−1)ⁿx²ⁿ⁺¹/(2n+1)! ; sin x/x=∑(−1)ⁿx²ⁿ/(2n+1)! (prolongée par 1 en 0, donc C^∞ sur ℝ). Rayon +∞. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-57 | formule | Donner les développements de 1/(1−x), ln(1+x) et ln(1−x) et leurs domaines de validité. | 1/(1−x)=∑xⁿ sur ]−1,1[ ; ln(1+x)=∑_{n≥1}(−1)ⁿ⁻¹xⁿ/n sur ]−1,1] (Abel en 1) ; ln(1−x)=−∑_{n≥1}xⁿ/n sur [−1,1[. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-58 | formule | Donner le développement de arctan x et son domaine de validité. Que vaut-il en x=1 ? | arctan x=∑(−1)ⁿx²ⁿ⁺¹/(2n+1) sur [−1,1] (Abel aux bornes). En x=1 : ∑(−1)ⁿ/(2n+1)=π/4. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-59 | formule | Donner le développement de (1+x)^α (α∈ℝ), la définition de C(α,n) et le rayon. | (1+x)^α=∑C(α,n)xⁿ sur ]−1,1[, C(α,n)=α(α−1)…(α−n+1)/n!, C(α,0)=1. R=1 si α∉ℕ (d'Alembert) ; si α∈ℕ, polynôme (binôme), R=+∞. Ex. 1/(1+x)=∑(−1)ⁿxⁿ. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-60 | démonstration | Comment obtenir les développements de exp, cos, sin ? De ln(1+x), arctan ? De (1+x)^α ? | exp : reste de Taylor \|Rₙ(x)\|≤\|x\|ⁿ⁺¹e^{\|x\|}/(n+1)!→0, puis ch, sh, cos, sin par combinaison. ln, arctan : primitiver 1/(1+x), 1/(1+x²) (puis Abel aux bornes). (1+x)^α : voir la carte suivante. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |
| se-61 | démonstration | Démontrer le développement de (1+x)^α par équation différentielle. | y=(1+x)^α est l'unique solution de (1+x)y'=αy, y(0)=1. Pour y=∑aₙxⁿ : (n+1)aₙ₊₁=(α−n)aₙ, a₀=1, donc aₙ=C(α,n). R=1 (d'Alembert, α∉ℕ), et par unicité de Cauchy la somme égale (1+x)^α sur ]−1,1[. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 |  |

### J. Méthodes de calcul de sommes et de développements

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-62 | méthode | Citer les méthodes pour obtenir un développement en série entière. | (1) Développements usuels, somme, produit. (2) Dérivation ou intégration terme à terme. (3) Taylor-Lagrange (reste →0). (4) Éléments simples pour les fractions rationnelles. (5) Équation différentielle (analyse-synthèse). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-63 | méthode | Comment développer en série entière une fraction rationnelle F sans pôle en 0 ? Quel est le rayon ? | Éléments simples ; pour \|z\|<\|a\| : 1/(z−a)=−(1/a)∑(z/a)ⁿ ; les 1/(z−a)ᵖ s'obtiennent par dérivation. Le rayon est la distance du pôle le plus proche de 0. | confirmé : figure dans PROST-SERIES-ENTIERES, PROGRAMME-MP-2021 | Distance au pôle le plus proche (pôle réel de F, fraction écrite sous forme irréductible). |
| se-64 | exemple | Écrire le développement en série entière de F=(X²−9X+5)/(X³−3X+2) sur ]−1,1[. | X³−3X+2=(X−1)²(X+2), F=2/(1−X)−1/(1−X)²+(3/2)/(1+X/2). Donc F(x)=∑(1−n+3(−1)ⁿ/2ⁿ⁺¹)xⁿ, rayon 1 (pôle 1 le plus proche). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-65 | méthode | Comment calculer la somme de ∑P(n)xⁿ (P polynôme) ? | Décomposer P sur la base 1, n, n(n−1), … puis ∑nxⁿ=x(1/(1−x))', ∑n(n−1)xⁿ=x²(1/(1−x))''. Rayon 1 pour P≠0. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-66 | exemple | Calculer ∑(n²+2n+3)xⁿ sur ]−1,1[. | n²+2n+3=n(n−1)+3n+3 ; ∑n(n−1)xⁿ=2x²/(1−x)³, ∑nxⁿ=x/(1−x)², ∑xⁿ=1/(1−x). Somme : (2x²−3x+3)/(1−x)³. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-67 | méthode | Comment calculer ∑F(n)xⁿ avec F fraction rationnelle ? Exemple : ∑_{n≥3}(n+1)/(n²−3n+2)xⁿ. | Éléments simples : (n+1)/((n−1)(n−2))=3/(n−2)−2/(n−1). ∑_{n≥3}xⁿ/(n−2)=−x²ln(1−x), ∑_{n≥3}xⁿ/(n−1)=−x ln(1−x)−x². Somme : (2x−3x²)ln(1−x)+2x². | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |

### L. Équations différentielles et séries entières

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| se-68 | méthode | Comment développer une fonction en série entière à l'aide d'une équation différentielle ? | Analyse-synthèse : y=∑aₙxⁿ reporté dans l'équation (dérivation terme à terme), identification par unicité : récurrence sur (aₙ), conditions initiales. Synthèse : rayon non nul pour la série trouvée, puis unicité de Cauchy. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-69 | exemple | Déterminer le développement en série entière de la solution de y''+y=0, y(0)=a, y'(0)=b. | (n+2)(n+1)aₙ₊₂+aₙ=0, a₀=a, a₁=b : a₂ₖ=(−1)ᵏa/(2k)!, a₂ₖ₊₁=(−1)ᵏb/(2k+1)!, R=+∞. Donc y=a cos x+b sin x. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) | Exemple d'application de la méthode d'analyse-synthèse exposée dans PROST-SERIES-ENTIERES ; calcul vérifié. |
| se-70 | exemple | Montrer que f=arcsin x/√(1−x²) vérifie une équation différentielle et en déduire une récurrence sur les coefficients. | f'=1/(1−x²)+x arcsin x/(1−x²)^{3/2} donne (1−x²)f'−xf=1, f(0)=0. Pour ∑aₙxⁿ : (n+1)aₙ₊₁=naₙ₋₁ (n≥1), a₀=0, a₁=1, donc a₂ₖ=0. | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
| se-71 | exemple | Donner le développement de arcsin x/√(1−x²) et justifier l'égalité. | a₂ₙ₊₁=2n/(2n+1)·a₂ₙ₋₁=4ⁿ/((2n+1)C(2n,n)). R=1 (d'Alembert sur x²). f et la somme S résolvent le même problème de Cauchy linéaire sur ]−1,1[ : f=S=∑4ⁿx²ⁿ⁺¹/((2n+1)C(2n,n)). | confirmé : figure dans PROST-SERIES-ENTIERES ; à confirmer dans PROGRAMME-MP-2021 (point non repéré) |  |
