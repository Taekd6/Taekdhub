"""Génère pieges-redaction.tsv (import texte Anki, modèle « Prépa MP v3 - Atomique »)
à partir des cartes ci-dessous. Usage : python build_pieges_redaction.py"""
import csv, pathlib

PIE = '<span class="lab pie">Piège</span>'
MET = '<span class="lab met">Méthode</span>'
CTX = "Techniques asymptotiques · Pièges de rédaction"

# (étiquette, question, réponse, complément, type)
CARDS = [
    (PIE, r"Négation de \(u_n\to\ell\) avec quantificateurs ?",
     r"\(\exists\varepsilon>0,\ \forall N,\ \exists n\ge N,\ |u_n-\ell|>\varepsilon\).",
     r"Chaque \(\forall\) devient \(\exists\) et inversement, dans le même ordre ; l'inégalité finale est niée.", "piege"),
    (PIE, r"Négation de \(u=o(v)\) avec quantificateurs ?",
     r"\(\exists\varepsilon>0,\ \forall N,\ \exists n\ge N,\ |u_n|>\varepsilon|v_n|\).",
     r"Ne pas confondre avec \(u=O(v)\), dont la négation porte sur tout \(K\).", "piege"),
    (PIE, r"Négation de \(u=O(v)\) avec quantificateurs ?",
     r"\(\forall K\ge0,\ \forall N,\ \exists n\ge N,\ |u_n|>K|v_n|\).",
     "", "piege"),
    (PIE, r"Quelle différence entre « \(\forall\varepsilon\,\exists N\,\forall n\ge N\) » et « \(\exists N\,\forall\varepsilon\,\forall n\ge N\) » pour \(|u_n-\ell|\le\varepsilon\) ?",
     r"La seconde impose \(u_n=\ell\) pour tout \(n\ge N\) (puisque \(|u_n-\ell|\le\varepsilon\) pour tout \(\varepsilon>0\)) ; seule la première définit \(u_n\to\ell\).",
     r"Dans la première, \(N\) dépend de \(\varepsilon\).", "piege"),
    (PIE, r"Chasles : \(\int_a^cf=\int_a^bf+\int_b^cf\). Que faut-il vérifier sur \(f\) et sur \(b\) ?",
     r"\(f\) doit être définie et intégrable sur tout l'intervalle concerné, \(b\) compris.",
     r"Si \(f\) n'existe pas en \(b\) (ex. \(\frac1{\ln x}\) en \(1\)), on étudie séparément chaque morceau comme intégrale impropre.", "piege"),
    (PIE, r"Un équivalent s'écrit-il sans préciser le point ? Donner un exemple.",
     r"Non : il dépend du point. \(x+x^2\sim x\) en \(0\), mais \(x+x^2\sim x^2\) en \(+\infty\).",
     r"Toujours écrire « quand \(x\to a\) » ou « quand \(n\to+\infty\) ».", "piege"),
    (PIE, r"On a \(u_n<v_n\) pour tout \(n\), \(u_n\to a\), \(v_n\to b\). Que conclure ?",
     r"\(a\le b\) seulement (inégalité large).",
     r"Contre-exemple : \(0<\frac1n\) mais \(0\le0\), pas \(0<0\).", "piege"),
    (PIE, r"Pour montrer \(\ln n=o(n^{\varepsilon})\) avec \(\varepsilon>0\) petit, suffit-il de savoir \(\ln n=o(n)\) ?",
     r"Non : \(\ln n=o(n)\) ne dit rien sur \(n^{\varepsilon}\) avec \(\varepsilon<1\). Il faut \(\ln n=o(n^{\varepsilon})\) pour tout \(\varepsilon>0\).",
     r"Preuve : \(m=n^{\varepsilon}\), \(\ln n=\frac1\varepsilon\ln m=o(m)\).", "piege"),
    (PIE, r"Comparaison série-intégrale : quelle hypothèse sur \(f\) avant d'encadrer \(\sum f(k)\) par des intégrales ?",
     r"\(f\) monotone (au moins sur les intervalles \([k,k+1]\) utilisés).",
     r"Pour \(f\) décroissante : \(\int_k^{k+1}f\le f(k)\le\int_{k-1}^kf\).", "piege"),
    (PIE, r"Pour obtenir \(\dfrac{f(x)}{x^p}\) à l'ordre \(m\) en \(0\), à quel ordre développer \(f\) ?",
     r"À l'ordre \(m+p\).",
     r"Ex. : \(\frac{\sin x}{x^3}=\frac1{x^2}-\frac16+o(1)\) exige \(\sin x=x-\frac{x^3}6+o(x^3)\).", "piege"),
    (MET + "Équivalent d'une somme", r"Rédaction pour un équivalent de \(u_n+w_n\) avec \(u\sim a\) et \(w\sim b\) ?",
     r"Écrire \(u=a+o(a)\), \(w=b+o(b)\), additionner, et conclure seulement quand le terme dominant restant est non nul.",
     r"Si \(a+b\) se compense, pousser les développements plus loin avant de conclure.", "methode"),
    (MET + "Limite d'un quotient par DL", r"Jusqu'à quel ordre développer numérateur et dénominateur pour une limite en \(0\) ?",
     r"Jusqu'au premier terme non nul de chacun, puis comparer ces deux termes dominants.",
     r"Écrire les restes explicitement (\(o(x^k)\)) et simplifier avant de passer à la limite.", "methode"),
    (MET + "Résolution : ⇒ ou ⇔", r"Quand une chaîne de raisonnements doit-elle utiliser \(\Leftrightarrow\) et non \(\Rightarrow\) ?",
     r"Dès qu'on veut l'ensemble exact des solutions ; avec \(\Rightarrow\) seul on a des conditions nécessaires et il faut vérifier la réciproque.",
     "", "methode"),
    (MET + "Contrôle d'un DL", r"Test rapide avant de rendre un DL ou un équivalent ?",
     r"Remplacer \(x\) par une petite valeur (ex. \(0{,}1\)) et comparer, puis vérifier la parité.",
     r"Ex. : \(\frac{\sin 0{,}1}{0{,}1}\approx0{,}998334\) et \(1-\frac{0{,}01}6\approx0{,}998333\).", "methode"),
]

out = pathlib.Path(__file__).with_name("pieges-redaction.tsv")
with out.open("w", encoding="utf-8", newline="") as f:
    f.write("#separator:tab\n#html:true\n#notetype:Prépa MP v3 - Atomique\n#tags column:6\n")
    w = csv.writer(f, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    for i, (lab, q, a, c, t) in enumerate(CARDS, 1):
        w.writerow([f"PR-{i:03d} · {CTX}", lab, q, a, c, f"TA_v3 ch::01 type::{t} redaction"])
print(len(CARDS), "cartes ->", out.name)
