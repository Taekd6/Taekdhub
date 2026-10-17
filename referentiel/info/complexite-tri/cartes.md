# Cartes : complexite-tri

Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.

Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.


### A. Complexité

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-01 | définition | Que signifie f(n) = O(g(n)) en complexité ? | Il existe c>0 et n0 tels que pour tout n ≥ n0, \|f(n)\| ≤ c·\|g(n)\|. Borne supérieure asymptotique. | à confirmer |  |
| in-02 | définition | Que signifie f(n) = Θ(g(n)) ? | f = O(g) et g = O(f) : même ordre de grandeur asymptotique. | à confirmer |  |
| in-03 | méthode | Comment calculer la complexité d'une boucle for imbriquée ? | Compter le nombre d'exécutions du corps : pour i de 0 à n−1 et j de 0 à i−1, il s'exécute n(n−1)/2 fois, soit Θ(n²) opérations élémentaires. | à confirmer |  |
| in-04 | énoncé | Quelle est la complexité de la recherche séquentielle et de la recherche dichotomique dans un tableau de taille n ? | Séquentielle : O(n) dans le pire cas. Dichotomique (tableau trié) : O(log n). | à confirmer |  |
| in-05 | piège | Quelle précondition la recherche dichotomique exige-t-elle ? | Le tableau doit être trié ; sinon le résultat est faux. Pièges classiques : milieu mal calculé et boucle infinie (mauvaise mise à jour des bornes). | à confirmer |  |

### B. Tris

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-06 | énoncé | Quelle est la complexité du tri par insertion ? | Pire cas Θ(n²), meilleur cas Θ(n) (tableau déjà trié). Tri en place et stable. | à confirmer |  |
| in-07 | énoncé | Quelle est la complexité du tri fusion ? | Θ(n log n) dans tous les cas. Récurrence T(n)=2T(n/2)+Θ(n). Nécessite Θ(n) mémoire auxiliaire pour un tableau. | à confirmer |  |
| in-08 | énoncé | Quelle est la complexité du tri rapide (quicksort) ? | Moyenne O(n log n), pire cas Θ(n²) (par exemple pivot toujours extrême sur un tableau trié avec pivot choisi en premier). | à confirmer |  |
| in-09 | énoncé | Quelle borne inférieure vaut pour tout tri par comparaisons ? | Ω(n log n) dans le pire cas : l'arbre de décision a n! feuilles, donc hauteur ≥ log₂(n!) = Θ(n log n). | à confirmer |  |
| in-10 | définition | Qu'appelle-t-on tri stable ? | Un tri qui conserve l'ordre relatif des éléments de clés égales. | à confirmer |  |

### C. Diviser pour régner

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-11 | méthode | Comment résoudre T(n)=2T(n/2)+n pour n puissance de 2 ? | Dérouler : T(n)=n·log₂n + n·T(1) = Θ(n log n). | à confirmer |  |
| in-12 | énoncé | Quelle est la complexité de T(n)=T(n/2)+O(1) ? | Θ(log n) (recherche dichotomique). | à confirmer |  |

### D. Récursivité et invariants

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-13 | définition | Qu'est-ce qu'un invariant de boucle ? | Une propriété vraie avant la boucle, conservée à chaque itération, qui donne à la sortie le résultat voulu. | à confirmer |  |
| in-14 | méthode | Comment prouver la correction d'une boucle while ? | Trouver un invariant, le prouver (initialisation + conservation), puis montrer qu'à la sortie invariant ∧ ¬condition ⟹ résultat. Terminaison : exhiber un variant, entier naturel strictement décroissant. | à confirmer |  |
| in-15 | méthode | Comment prouver la terminaison d'un algorithme ? | Exhiber un variant : quantité entière positive qui décroît strictement à chaque itération ou appel récursif. | à confirmer |  |
| in-16 | piège | Quelle erreur courante dans une fonction récursive ? | Oublier le cas de base (récursion infinie) ou avoir des appels qui ne se rapprochent pas du cas de base (variant non décroissant). | à confirmer |  |

### E. Structures de données

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-17 | énoncé | Quelles sont les complexités des opérations d'une pile et d'une file implémentées par liste chaînée ? | Empiler/dépiler (pile) et enfiler/défiler (file avec pointeurs début et fin) : O(1). | à confirmer |  |
| in-18 | énoncé | Quelles sont les complexités d'un tas binaire pour insertion et extraction du minimum ? | Insertion O(log n), extraction du minimum O(log n), lecture du minimum O(1). Construction depuis un tableau en O(n). | à confirmer |  |
| in-19 | énoncé | Quelles sont les complexités moyennes d'une table de hachage ? | Insertion, recherche, suppression en O(1) en moyenne (hachage uniforme, facteur de charge borné), O(n) au pire. | à confirmer |  |

### F. Graphes

| # | Type | Recto | Verso | Exigibilité | Remarque |
|---|---|---|---|---|---|
| in-20 | définition | Quelle est la différence entre représentation par matrice d'adjacence et par listes d'adjacence ? | Matrice : Θ(n²) mémoire, test d'arête en O(1). Listes : Θ(n+m) mémoire, parcours des voisins en O(deg). | à confirmer |  |
| in-21 | énoncé | Quelle est la complexité d'un parcours en largeur ou en profondeur ? | Θ(n+m) avec listes d'adjacence (n sommets, m arêtes). | à confirmer |  |
| in-22 | énoncé | Que calcule un parcours en largeur depuis s dans un graphe non pondéré ? | Les plus courts chemins (en nombre d'arêtes) de s à tous les sommets atteignables. | à confirmer |  |
| in-23 | énoncé | Quelles hypothèses pour l'algorithme de Dijkstra ? | Poids des arêtes positifs ou nuls. Avec tas binaire : O((n+m) log n). Avec des poids négatifs il peut être faux. | à confirmer |  |
| in-24 | piège | Quel piège avec un graphe contenant un cycle dans un parcours en profondeur ? | Sans marquage des sommets visités, le parcours boucle. Marquer à l'entrée du sommet, pas à la sortie. | à confirmer |  |
