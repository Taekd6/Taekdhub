# Cartes : fondements-probabilites

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Espaces probabilisés

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-01 | définition | Qu'est-ce qu'une tribu sur un ensemble Ω ? | Une partie 𝒜 de 𝒫(Ω) qui contient Ω, est stable par passage au complémentaire et par réunion dénombrable. Conséquences : ∅ ∈ 𝒜, stable par intersection dénombrable et réunion finie. | standard du programme MP ; programme officiel non consulté |  |
| pr-02 | définition | Qu'est-ce qu'une probabilité sur un espace probabilisable (Ω, 𝒜) ? | Une application P : 𝒜 → [0,1] telle que P(Ω)=1 et σ-additive : pour (A_n) deux à deux disjoints, P(⋃A_n)=Σ P(A_n). | standard du programme MP ; programme officiel non consulté |  |
| pr-03 | définition | Qu'appelle-t-on système complet d'événements ? | Une famille finie ou dénombrable (A_i) d'événements deux à deux incompatibles dont la réunion est Ω. (On accepte parfois « presque sûrement » : réunion de probabilité 1.) | standard du programme MP ; programme officiel non consulté |  |
| pr-04 | énoncé | Énoncer la propriété de continuité croissante d'une probabilité. | Si (A_n) est croissante pour l'inclusion, P(⋃A_n) = lim P(A_n) (limite d'une suite croissante). | standard du programme MP ; programme officiel non consulté |  |
| pr-05 | énoncé | Énoncer la propriété de continuité décroissante d'une probabilité. | Si (A_n) est décroissante pour l'inclusion, P(⋂A_n) = lim P(A_n). | standard du programme MP ; programme officiel non consulté |  |
| pr-06 | énoncé | Énoncer la sous-additivité d'une probabilité sur une famille dénombrable. | Pour (A_n) quelconque : P(⋃A_n) ≤ Σ P(A_n) (inégalité vraie dans [0,+∞], même si la série diverge). | standard du programme MP ; programme officiel non consulté |  |
| pr-07 | démonstration | Comment démontre-t-on la continuité décroissante à partir de la continuité croissante ? | Passer aux complémentaires : (Ā_n) est croissante, P(⋃Ā_n) = lim P(Ā_n), et ⋃Ā_n est le complémentaire de ⋂A_n, donc P(⋂A_n) = 1 − lim(1−P(A_n)) = lim P(A_n). | standard du programme MP ; programme officiel non consulté |  |
| pr-08 | démonstration | Comment démontre-t-on la continuité croissante ? | Poser B_0=A_0 et B_n=A_n∖A_{n−1} : les B_n sont deux à deux disjoints, A_n=B_0⊔…⊔B_n et ⋃A_n=⊔B_n. Par σ-additivité, P(⋃A_n)=ΣP(B_k)=lim Σ_{k≤n}P(B_k)=lim P(A_n). | standard du programme MP ; programme officiel non consulté |  |
| pr-09 | énoncé | Quelle formule donne P(A ∪ B) pour deux événements quelconques ? | P(A∪B) = P(A) + P(B) − P(A∩B). | standard du programme MP ; programme officiel non consulté |  |
| pr-10 | piège | Que dire d'un événement de probabilité 1 ou 0 ? | P(A)=1 n'implique pas A=Ω : on dit « presque sûr ». De même P(A)=0 n'implique pas A=∅ (« négligeable »). Exemple : tirer un réel uniformément dans [0,1], l'événement {0,5} est de probabilité 0 mais possible. | standard du programme MP ; programme officiel non consulté |  |

### B. Probabilités conditionnelles

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-11 | définition | Comment définit-on P_B(A) (probabilité de A sachant B) ? | Si P(B) > 0 : P_B(A) = P(A∩B)/P(B). P_B est une probabilité sur (Ω, 𝒜). | standard du programme MP ; programme officiel non consulté |  |
| pr-12 | énoncé | Énoncer la formule des probabilités composées. | Si P(A_1∩…∩A_{n−1}) > 0 : P(A_1∩…∩A_n) = P(A_1)·P_{A_1}(A_2)·P_{A_1∩A_2}(A_3)···P_{A_1∩…∩A_{n−1}}(A_n). | standard du programme MP ; programme officiel non consulté |  |
| pr-13 | énoncé | Énoncer la formule des probabilités totales (système complet dénombrable). | Si (A_n) est un système complet d'événements (au plus dénombrable), P(B) = Σ P(B∩A_n) = Σ P(A_n)·P_{A_n}(B), avec la convention P(B∩A_n)=0 si P(A_n)=0. La série converge. | standard du programme MP ; programme officiel non consulté |  |
| pr-14 | énoncé | Énoncer la formule de Bayes. | Si P(A)>0, P(B)>0 : P_B(A) = P_A(B)·P(A)/P(B). Avec un système complet (A_i) : P_B(A_j) = P(A_j)P_{A_j}(B) / Σ_i P(A_i)P_{A_i}(B). | standard du programme MP ; programme officiel non consulté |  |
| pr-15 | piège | Quelle erreur éviter dans la formule des probabilités totales avec P(A_n)=0 ? | P_{A_n}(B) n'est pas défini si P(A_n)=0. On utilise la convention P(A_n)·P_{A_n}(B)=0, ou on écrit directement P(B∩A_n) qui est toujours défini. | standard du programme MP ; programme officiel non consulté |  |

### C. Indépendance

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-16 | définition | Quand deux événements A et B sont-ils indépendants ? | Quand P(A∩B)=P(A)P(B). Si P(B)>0, c'est équivalent à P_B(A)=P(A). | standard du programme MP ; programme officiel non consulté |  |
| pr-17 | définition | Quand une famille (A_i)_{i∈I} d'événements est-elle mutuellement indépendante ? | Quand pour toute partie finie J de I : P(⋂_{j∈J}A_j) = Π_{j∈J}P(A_j). | standard du programme MP ; programme officiel non consulté |  |
| pr-18 | piège | Deux à deux indépendants implique-t-il mutuellement indépendants ? | Non. Contre-exemple : deux lancers de pièce équilibrée ; A « pile au 1er », B « pile au 2e », C « les deux lancers donnent le même résultat ». Deux à deux indépendants, mais P(A∩B∩C)=1/4 ≠ 1/8. | standard du programme MP ; programme officiel non consulté |  |
| pr-19 | énoncé | Si A et B sont indépendants, que dire de Ā et B ? | Ā et B sont indépendants (donc aussi Ā et B̄). Preuve : P(Ā∩B)=P(B)−P(A∩B)=P(B)(1−P(A)). | standard du programme MP ; programme officiel non consulté |  |
| pr-20 | piège | Incompatibles et indépendants sont-ils la même notion ? | Non. Si A∩B=∅ et P(A),P(B)>0, alors P(A∩B)=0 ≠ P(A)P(B) : A et B sont dépendants. | standard du programme MP ; programme officiel non consulté |  |

### D. Variables aléatoires discrètes

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-21 | définition | Qu'est-ce qu'une variable aléatoire discrète ? | Une application X : Ω → E telle que X(Ω) est au plus dénombrable et, pour tout x, {X=x} est un événement. Sa loi est la famille (P(X=x))_{x∈X(Ω)}, de somme 1. | standard du programme MP ; programme officiel non consulté |  |
| pr-22 | définition | Quelle est la loi de Bernoulli de paramètre p ? | X ∈ {0,1}, P(X=1)=p, P(X=0)=1−p. Espérance p, variance p(1−p). | standard du programme MP ; programme officiel non consulté |  |
| pr-23 | définition | Quelle est la loi binomiale ℬ(n,p) ? | X ∈ ⟦0,n⟩, P(X=k)=C(n,k)p^k(1−p)^{n−k}. Nombre de succès sur n épreuves de Bernoulli indépendantes. E(X)=np, V(X)=np(1−p). | standard du programme MP ; programme officiel non consulté |  |
| pr-24 | définition | Quelle est la loi géométrique de paramètre p ? | X ∈ ℕ*, P(X=k)=(1−p)^{k−1}p : rang du premier succès dans une suite d'épreuves de Bernoulli indépendantes. E(X)=1/p, V(X)=(1−p)/p². | standard du programme MP ; programme officiel non consulté |  |
| pr-25 | définition | Quelle est la loi de Poisson de paramètre λ>0 ? | X ∈ ℕ, P(X=k)=e^{−λ}λ^k/k!. E(X)=V(X)=λ. | standard du programme MP ; programme officiel non consulté |  |
| pr-26 | énoncé | Quel lien entre loi binomiale et loi de Poisson (approximation) ? | Si X_n ~ ℬ(n,p_n) avec n·p_n → λ, alors P(X_n=k) → e^{−λ}λ^k/k! pour tout k fixé (convergence de chaque probabilité). | à confirmer |  |
| pr-27 | énoncé | Quelle propriété d'absence de mémoire caractérise la loi géométrique ? | Si X suit une loi géométrique, P(X>n+k \| X>n) = P(X>k). Réciproquement, une variable à valeurs dans ℕ* vérifiant cela est géométrique. | à confirmer |  |

### E. Espérance et variance

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-28 | définition | Quand une variable aléatoire discrète réelle X admet-elle une espérance ? | Quand la famille (x·P(X=x)) est sommable, i.e. Σ\|x\|P(X=x) < +∞ ; alors E(X)=Σ x P(X=x). | standard du programme MP ; programme officiel non consulté |  |
| pr-29 | énoncé | Énoncer le théorème de transfert. | Si φ est une fonction définie sur X(Ω), φ(X) est d'espérance finie ssi Σ\|φ(x)\|P(X=x)<∞, et E(φ(X))=Σ φ(x)P(X=x). | standard du programme MP ; programme officiel non consulté |  |
| pr-30 | énoncé | Quelles sont les propriétés de l'espérance (linéarité, positivité, croissance) ? | Linéaire sur les variables d'espérance finie ; si X ≥ 0 alors E(X) ≥ 0 ; si X ≤ Y alors E(X) ≤ E(Y). Si X ≥ 0 est discrète et E(X)=0, alors X=0 presque sûrement. | standard du programme MP ; programme officiel non consulté |  |
| pr-31 | énoncé | Quelle est l'espérance d'un produit de variables indépendantes ? | Si X, Y indépendantes d'espérance finie, XY est d'espérance finie et E(XY)=E(X)E(Y). La réciproque est fausse. | standard du programme MP ; programme officiel non consulté |  |
| pr-32 | définition | Comment définit-on la variance et l'écart type ? | Si X² est d'espérance finie : V(X)=E((X−E(X))²)=E(X²)−E(X)², σ(X)=√V(X). | standard du programme MP ; programme officiel non consulté |  |
| pr-33 | énoncé | Quelle est la variance de aX+b ? De X+Y ? | V(aX+b)=a²V(X). V(X+Y)=V(X)+V(Y)+2Cov(X,Y) ; si X,Y indépendantes, V(X+Y)=V(X)+V(Y). | standard du programme MP ; programme officiel non consulté |  |
| pr-34 | énoncé | Énoncer l'inégalité de Markov. | Si X ≥ 0 est d'espérance finie et a>0 : P(X ≥ a) ≤ E(X)/a. | standard du programme MP ; programme officiel non consulté |  |
| pr-35 | énoncé | Énoncer l'inégalité de Bienaymé-Tchebychev. | Si X admet un moment d'ordre 2 et ε>0 : P(\|X−E(X)\| ≥ ε) ≤ V(X)/ε². | standard du programme MP ; programme officiel non consulté |  |
| pr-36 | démonstration | Comment démontre-t-on l'inégalité de Markov ? | Pour X ≥ 0 : a·1_{X≥a} ≤ X. On prend l'espérance : a·P(X≥a) ≤ E(X). | standard du programme MP ; programme officiel non consulté |  |
| pr-37 | démonstration | Comment déduit-on Bienaymé-Tchebychev de Markov ? | Appliquer Markov à (X−E(X))² ≥ 0 et au réel ε²>0 : P(\|X−E(X)\|≥ε)=P((X−E(X))²≥ε²) ≤ V(X)/ε². | standard du programme MP ; programme officiel non consulté |  |
| pr-38 | énoncé | Énoncer la loi faible des grands nombres. | Si (X_n) sont indépendantes (ou deux à deux non corrélées), de même espérance m et de même variance finie, alors pour tout ε>0, P(\|S_n/n − m\| ≥ ε) → 0, où S_n=X_1+…+X_n. | standard du programme MP ; programme officiel non consulté |  |
| pr-39 | démonstration | Comment démontre-t-on la loi faible des grands nombres ? | E(S_n/n)=m et V(S_n/n)=σ²/n (indépendance). Bienaymé-Tchebychev : P(\|S_n/n−m\|≥ε) ≤ σ²/(nε²) → 0. | standard du programme MP ; programme officiel non consulté |  |

### F. Fonctions génératrices

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-40 | définition | Qu'est-ce que la fonction génératrice d'une variable X à valeurs dans ℕ ? | G_X(t)=E(t^X)=Σ P(X=n)t^n. Rayon de convergence ≥ 1, et G_X est définie et continue sur [−1,1], avec G_X(1)=1. | standard du programme MP ; programme officiel non consulté |  |
| pr-41 | énoncé | Qu'apporte la fonction génératrice pour caractériser la loi ? | La loi est déterminée par G_X (unicité des coefficients d'une série entière) : si G_X=G_Y sur un voisinage de 0, alors X et Y ont même loi. | à confirmer |  |
| pr-42 | énoncé | Comment lit-on l'espérance et la variance sur G_X ? | X a une espérance finie ssi G_X est dérivable en 1, et E(X)=G_X'(1). X a un moment d'ordre 2 ssi G_X est deux fois dérivable en 1, et V(X)=G_X''(1)+G_X'(1)−G_X'(1)². | standard du programme MP ; programme officiel non consulté |  |
| pr-43 | énoncé | Quelle est la fonction génératrice d'une somme de variables indépendantes ? | Si X et Y sont indépendantes à valeurs dans ℕ, G_{X+Y}=G_X·G_Y. | standard du programme MP ; programme officiel non consulté |  |
| pr-44 | exemple | Quelles sont les fonctions génératrices des lois usuelles ? | Bernoulli(p) : 1−p+pt. ℬ(n,p) : (1−p+pt)^n. Géométrique(p) : pt/(1−(1−p)t). Poisson(λ) : e^{λ(t−1)}. | standard du programme MP ; programme officiel non consulté |  |
| pr-45 | méthode | Comment montrer que la somme de deux Poisson indépendantes est de Poisson ? | Si X~𝒫(λ), Y~𝒫(μ) indépendantes : G_{X+Y}(t)=e^{λ(t−1)}e^{μ(t−1)}=e^{(λ+μ)(t−1)} : c'est la fonction génératrice de 𝒫(λ+μ), donc X+Y~𝒫(λ+μ). | standard du programme MP ; programme officiel non consulté |  |

### G. Pièges et méthodes

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| pr-46 | méthode | Comment calculer P(A) quand A est une réunion croissante d'événements « jusqu'à l'instant n » ? | Écrire A=⋃A_n avec (A_n) croissante, puis P(A)=lim P(A_n) (continuité croissante). Typiquement : « on obtient pile au moins une fois » est la réunion des événements « pile avant le lancer n ». | standard du programme MP ; programme officiel non consulté |  |
| pr-47 | méthode | Comment étudier un événement « jamais » dans une infinité d'épreuves indépendantes ? | Écrire cet événement comme intersection décroissante des « pas de succès jusqu'au rang n », de probabilité (1−p)^n → 0 pour p>0 : l'événement est de probabilité 0 (continuité décroissante). | standard du programme MP ; programme officiel non consulté |  |
| pr-48 | piège | Que vérifier avant d'écrire E(X) = Σ x P(X=x) ? | L'existence : la série doit converger absolument. Exemple : P(X=2^k)=2^{−k} (k≥1) a Σ x P(X=x) = Σ1 = +∞, donc pas d'espérance. | standard du programme MP ; programme officiel non consulté |  |
| pr-49 | piège | Indépendance et V(X+Y)=V(X)+V(Y) : que penser de la réciproque ? | V(X+Y)=V(X)+V(Y) équivaut à Cov(X,Y)=0 (non corrélation), plus faible que l'indépendance. | standard du programme MP ; programme officiel non consulté |  |
