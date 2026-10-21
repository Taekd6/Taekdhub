# Corrections demandées à ChatGPT — paquet « Techniques asymptotiques » (chapitre 01)

Relecture de `chapitre_01.apkg` (130 cartes, 2026-10-21). Ne rien changer d'autre : GUID, modèle, champs et planification restent identiques. Après correction, renvoyer l'`.apkg` et la liste des cartes modifiées (Contexte `TA-xxx`) pour contrôle.

## 1. Cartes inutilisables (à réparer en priorité)
La suppression de l'étiquette sur les cartes d'exemples a retiré l'énoncé. Remettre la fonction dans la **Question** :
- **TA-072** : « Limite en 0 de \(\frac{\tan x-x}{x-\sin x}\) ? » (réponse inchangée : 2).
- **TA-075** : « Développement de \(\sqrt{n^2+n+1}\) à trois termes ? » (réponse inchangée).

## 2. Contenu à corriger
- **TA-048** : remplacer le complément « th : mêmes coefficients avec \(-\frac{x^3}3\) » par « \(\mathrm{th}\,x=x-\frac{x^3}3+\frac{2x^5}{15}-\dots\) : les signes alternent ».
- **TA-111** : \(x_n=n-\ln n+o(\ln n)\) est vrai mais trop faible ; écrire \(x_n=n-\ln n+o(1)\).
- **TA-126** : préciser l'hypothèse \(\ell=0\) (et \(\alpha<0\)) ; pour \(\ell\ne0\), travailler sur \((u_n-\ell)^\alpha\).

## 3. Formulations à préciser
- **TA-063** : ne pas réutiliser \(\beta\) pour deux rôles ; donner \(\alpha,\beta>0\) dans la question.
- **TA-040, TA-045** : question « ordre 4 » / « ordre 5 » mais reste \(o(x^5)\) / \(o(x^6)\). Rendre cohérent (reste \(o(x^4)\), ou mentionner la parité).
- **TA-071** : la question ne demande que \(I_n\) et \(I_{n-2}\) ; soit retirer \(nI_nI_{n-1}=\frac\pi2\) de la réponse, soit le demander. Préciser \(n\ge2\).
- **TA-099** : écrire « \(\frac1{n^2}\) et \(\frac1{n^3}\) ont une différence \(\to0\) mais ne sont pas équivalentes ».
- **TA-122** : indiquer que « de même signe » est une condition suffisante, pas nécessaire.
- **TA-068** : ajouter les hypothèses \(f(0)=0\), \(f'(0)\ne0\), \(f\) de classe \(C^n\), et le principe de récurrence sur l'ordre.
- **TA-009** : l'injection dans l'équation suppose que \(f\) admet déjà un DL (Taylor-Young, \(f\in C^n\)).
- **TA-039** : « pas de somme » est trop fort (voir TA-122) ; écrire « pas de somme sans condition de signe ».
- **TA-010** : traiter le cas où \(\varphi\) atteint \(a\) (alors \(h(a)\) peut différer de 1).
- **TA-052** : un DL en \(+\infty\) en puissances de \(1/x\) suppose une limite finie ; sinon DL généralisé (facteur \(x^p\)).
- **TA-053** : ajouter « \(f,g\) localement intégrables ».
- **TA-093** (Taylor-Young, version fine) : « \(n\) fois dérivable en \(a\) » suffit, sans \(C^{n-1}\).
- **TA-062** : préciser \(\beta>0\) pour \(|x|^\alpha e^{\beta x}\to0\) en \(-\infty\).

## 4. À vérifier par ChatGPT, sans me croire sur parole
- **TA-049** : l'affirmation « hors programme officiel » (le résultat est exact).

Vérifié exact, ne pas toucher : la correction de \(u_0\in]0,\pi[\) pour \(u_{n+1}=\sin u_n\).
