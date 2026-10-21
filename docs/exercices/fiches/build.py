import subprocess, os, textwrap

HEAD = r"""\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[french]{babel}
\usepackage{amsmath,amssymb,amsthm}
\usepackage[margin=2.2cm,top=2cm,bottom=2.2cm]{geometry}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{array}
\usepackage[hidelinks]{hyperref}
\setlist[enumerate,1]{label=\arabic*.,leftmargin=*,itemsep=0.6em}
\setlist[enumerate,2]{label=(\alph*),leftmargin=1.8em,itemsep=0.3em}
\newcommand{\R}{\mathbb{R}}
\newcommand{\N}{\mathbb{N}}
\newcommand{\C}{\mathbb{C}}
\newcommand{\sh}{\operatorname{sh}}
\newcommand{\ch}{\operatorname{ch}}
\newcommand{\ee}{\mathrm{e}}
\newcommand{\dd}{\,\mathrm{d}}
\pagestyle{fancy}\fancyhf{}
\fancyhead[L]{TITLE}
\fancyhead[R]{sans indice, sans corrigé}
\fancyfoot[C]{\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\newcommand{\exo}[3]{\vspace{1.1em}\noindent\textbf{\large #1}\hfill\textit{#2 \,·\, #3}\par\smallskip}
\begin{document}
"""

def doc(title, subtitle, consigne, body, sources):
    head = HEAD.replace("TITLE", title)
    return (head
        + "\\begin{center}\n{\\LARGE\\bfseries " + title + "}\\\\[0.3em]\n{\\large " + subtitle + "}\n\\end{center}\n\n"
        + "\\noindent\\fbox{\\parbox{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}{\\small " + consigne + "}}\n\n"
        + body
        + "\n\\vfill\n\\begin{small}\n\\noindent\\textbf{Sources.} " + sources + "\n\\end{small}\n\\end{document}\n")

CCINP = "banque publique d'exercices de mathématiques de l'épreuve orale du CCINP, filière MP, session 2022 (concours-commun-inp.fr), licence CC BY-NC-SA 3.0 FR ; les indications des énoncés d'origine ont été retirées volontairement."
MPSI = "« Feuille d'exercices n$^{\\circ}$17 : Analyse asymptotique », MPSI, lycée Camille Jullian, 14 mars 2023 (publiée sur normalesup.org/\\textasciitilde glafon) ; les parenthèses d'indice des énoncés d'origine ont été retirées volontairement. Aucun énoncé n'a été réécrit."
STD = ("Chronomètre lancé, sans cours ni notes, rédaction complète sur copie comme un oral ou un DS : hypothèses vérifiées, « à partir d'un certain rang », limites écrites avec leur flèche, "
       "aucun « $\\sim$ » utilisé comme une égalité. Quand une question est finie, relis-la avec la \\textbf{grille de rédaction}. Envoie-moi ta copie pour une correction ligne par ligne.")

fiches = {}

# ---------- Grille de rédaction ----------
fiches["grille-redaction"] = doc("Grille de rédaction", "à garder à côté de ta copie, à relire avant de rendre chaque question",
 "Ces 10 points viennent de \\textbf{tes} copies de la feuille 1 : ce sont tes erreurs, pas des généralités.",
 r"""
\begin{enumerate}[label=\textbf{\arabic*.},itemsep=0.9em]
\item \textbf{Négation et quantificateurs.} Avant une preuve par l'absurde, écris la négation \emph{exacte}. « Pas de même signe à partir d'un rang » ne veut pas dire « toujours de signe opposé ».
\item \textbf{Bornes d'une intégrale.} Une relation de Chasles n'est permise que si l'intégrande est défini et continu sur tout l'intervalle utilisé (ex. : $1/\ln t$ n'existe pas en $t=1$).
\item \textbf{Dérivée d'une composée.} Écris la formule ($F(x^2)'=2x\,F'(x^2)$) puis \emph{simplifie} ($\ln(x^2)=2\ln x$). Vérifie sur une valeur numérique.
\item \textbf{« $\sim$ » n'est pas une égalité.} On ne soustrait ni n'additionne des équivalents, on ne remplace pas un équivalent dans une différence. Pour une différence : un DL.
\item \textbf{Ordre d'un DL.} Si on multiplie par $n$ (ou $x$), garde un terme de plus. Ne tronque jamais une expression intermédiaire avant d'avoir regardé par quoi elle sera multipliée.
\item \textbf{Coefficients usuels.} Récite-les avant de les utiliser ($\sqrt{1+u}=1+\tfrac u2-\tfrac{u^2}8+\cdots$) : relis chaque DL une fois écrit.
\item \textbf{Limites écrites avec leur flèche.} Pas de « $1=n(u_n+1)$ en $+\infty$ » : écris $n(u_n+1)\longrightarrow 1$, donc $u_n+1\sim\frac1n$.
\item \textbf{« À partir d'un certain rang ».} Une inégalité vraie seulement pour $n\ge 3$ doit être dite ainsi. Et pour un critère d'équivalence sur des séries : vérifie la \emph{positivité} (ou passe aux modules).
\item \textbf{Croissances comparées précises.} $\ln n=o(n)$ ne suffit pas pour $\sum\frac{\ln n}{n^{3/2}}$ : il faut $\ln n=o(n^{\varepsilon})$ avec un $\varepsilon$ bien choisi.
\item \textbf{Contrôle de vraisemblance (10 secondes).} Signe, ordre de grandeur, $n=2$ ou $x=2$. Et relis chaque recopie : $t-1$ n'est pas $t+1$.
\end{enumerate}
""", "Établie à partir des copies manuscrites de la feuille 1 (21 octobre 2026) et vérifiée par calcul numérique.")

# ---------- Fiche 1 : reprise ----------
fiches["fiche-1-reprise"] = doc("Fiche 1 — Reprise des erreurs", "jeudi 22 octobre · matin : exercices R1 à R3 · après-midi : R4 à R6",
 STD,
 r"""
\noindent\textbf{Matin (90 min) --- exercices R1 à R3.}

\exo{R1}{CCINP, banque 2022, exercice 1, question 1}{15 min}
\noindent On considère deux suites numériques $(u_n)_{n\in\N}$ et $(v_n)_{n\in\N}$ telles que $(v_n)_{n\in\N}$ est non nulle à partir d'un certain rang et $u_n \underset{+\infty}{\sim} v_n$.\\
Démontrer que $u_n$ et $v_n$ sont de même signe à partir d'un certain rang.

\exo{R2}{CCINP, banque 2022, exercice 56}{25 min}
\noindent On considère la fonction $H$ définie sur $]1;+\infty[$ par $H(x)=\displaystyle\int_x^{x^2}\dfrac{\dd t}{\ln t}$.
\begin{enumerate}
\item Montrer que $H$ est $\mathcal{C}^1$ sur $]1;+\infty[$ et calculer sa dérivée.
\item Montrer que la fonction $u$ définie par $u(x)=\dfrac{1}{\ln x}-\dfrac{1}{x-1}$ admet une limite finie en $x=1$.
\item En utilisant la fonction $u$ de la question 2., calculer la limite en $1^+$ de la fonction $H$.
\end{enumerate}

\exo{R3}{CCINP, banque 2022, exercice 46}{25 min}
\noindent On considère la série $\displaystyle\sum_{n\geqslant 1}\cos\!\left(\pi\sqrt{n^2+n+1}\right)$.
\begin{enumerate}
\item Prouver que, au voisinage de $+\infty$, $\;\pi\sqrt{n^2+n+1}=n\pi+\dfrac{\pi}{2}+\alpha\dfrac{\pi}{n}+O\!\left(\dfrac1{n^2}\right)\;$ où $\alpha$ est un réel que l'on déterminera.
\item En déduire que $\displaystyle\sum_{n\geqslant 1}\cos\!\left(\pi\sqrt{n^2+n+1}\right)$ converge.
\item $\displaystyle\sum_{n\geqslant 1}\cos\!\left(\pi\sqrt{n^2+n+1}\right)$ converge-t-elle absolument ?
\end{enumerate}

\newpage
\noindent\textbf{Après-midi (60 min) --- exercices R4 à R6.}

\exo{R4}{CCINP, banque 2022, exercice 5}{25 min}
\begin{enumerate}
\item On considère la série de terme général $u_n=\dfrac{1}{n(\ln n)^{\alpha}}$ où $n\geqslant 2$ et $\alpha\in\R$.
 \begin{enumerate}
 \item \textbf{Cas $\alpha\leqslant 0$} \quad En utilisant une minoration très simple de $u_n$, démontrer que la série diverge.
 \item \textbf{Cas $\alpha>0$} \quad Étudier la nature de la série.
 \end{enumerate}
\item Déterminer la nature de la série $\displaystyle\sum_{n\geqslant 2}\dfrac{\left(\ee-\left(1+\dfrac1n\right)^{n}\right)\ee^{\frac1n}}{\big(\ln(n^2+n)\big)^2}$.
\end{enumerate}

\exo{R5}{MPSI Camille Jullian 2023, ex. 11, questions 2 à 4}{20 min}
\noindent Pour tout entier naturel $n$, on note $I_n=\displaystyle\int_0^{\pi/4}\tan^n(x)\dd x$.
\begin{enumerate}
\setcounter{enumi}{1}
\item Simplifier l'expression de $I_n+I_{n+2}$. En déduire la convergence et la limite de $(I_n)$.
\item À l'aide d'une IPP, montrer que $\forall n\geqslant 1$, $\displaystyle\int_0^{\pi/4}\cos(2x)\tan^n(x)\dd x=\dfrac12-nI_n$.
\item En déduire un équivalent simple de $I_n$.
\end{enumerate}

\exo{R6}{MPSI Camille Jullian 2023, ex. 5, question 5 (seconde partie)}{15 min}
\noindent On considère, pour tout entier naturel $n$, la fonction $f_n : x\mapsto x^3+nx+n$, et $u_n$ l'unique solution de $f_n(x)=0$ sur $\R$. On admet que $u_n\to-1$ et que $u_n+1\sim\dfrac1n$.\\
Montrer que $u_n=-1+\dfrac1n-\dfrac{3}{n^2}+o\!\left(\dfrac1{n^2}\right)$.
""", "Exercices CCINP : " + CCINP + " Exercices MPSI : " + MPSI)

# ---------- Fiche 2 : équivalents & DL en rafale ----------
fiches["fiche-2-equivalents-dl"] = doc("Fiche 2 — Équivalents et DL en rafale", "vendredi 23 octobre · matin, 90 min",
 STD + " Pour les DL : écris d'abord l'ordre nécessaire, puis le calcul, puis relis les coefficients.",
 r"""
\exo{Exercice 1 — Développements limités}{MPSI Camille Jullian 2023, ex. 6 (sélection)}{45 min}
\noindent Calculer les développements limités suivants (on utilisera la notation $DL_n(a)$ pour indiquer le développement limité à l'ordre $n$ au point $a$) :
\begin{enumerate}[label=\arabic*.,itemsep=0.45em,leftmargin=*]
\item $DL_4(0)$, $f(x)=\dfrac{1}{\sqrt{1-x}}$
\item $DL_2(0)$, $f(x)=\sqrt{3+\cos(x)}$
\item $DL_3(0)$, $f(x)=\sqrt{\cos(x)}-\cos(\sqrt{x})$
\item $DL_4(0)$, $f(x)=(1+\sin(x))^x$
\item $DL_3(0)$, $f(x)=\dfrac{1}{\sin(x)}-\dfrac{1}{\sh(x)}$
\item $DL_4(0)$, $f(x)=\ln(1+\ee^x)$
\item $DL_5(0)$, $f(x)=\ee^{\sin(x)}$
\item $DL_3(0)$, $f(x)=\ln(\cos(3x))$
\item $DL_2(0)$, $f(x)=\dfrac{\ln(1+x)}{\ee^x-1}$
\item $DL_2(2)$, $f(x)=x^x$
\item $DL_3(0)$, $f(x)=\ln(2\ee^x+\ee^{-x})$
\item $DL_2(0)$, $f(x)=\arcsin\!\left(\dfrac{x+1}{x+2}\right)$
\end{enumerate}

\exo{Exercice 2 — Limites}{MPSI Camille Jullian 2023, ex. 8 (sélection)}{45 min}
\noindent Calculer (à l'aide de développements limités ou non) les limites suivantes.
\begin{enumerate}[label=\arabic*.,itemsep=0.45em,leftmargin=*]
\item $\displaystyle\lim_{x\to+\infty}x-x^2\ln\!\left(1+\dfrac1x\right)$
\item $\displaystyle\lim_{x\to 0}\left(\dfrac{\tan(x)}{x}\right)^{\frac{1}{x^2}}$
\item $\displaystyle\lim_{x\to 2}\dfrac{\sqrt{2x^2+1}-\sqrt{x^2+x+3}}{x^2-3x+2}$
\item $\displaystyle\lim_{x\to+\infty}\sqrt{x^2+3x+2}-x$
\item $\displaystyle\lim_{x\to 0}\dfrac{\ee^x-x-\cos(x)}{x^2}$
\item $\displaystyle\lim_{x\to+\infty}\dfrac{\sh(\ch(x))}{\ch(\sh(x))}$
\item $\displaystyle\lim_{x\to 0}\dfrac{1}{x^3}-\dfrac{1}{\sin^3(x)}$
\item $\displaystyle\lim_{x\to+\infty}\left(\ch\!\left(\dfrac1x\right)\right)^{x^2}$
\end{enumerate}
""", "MPSI : " + MPSI)

# ---------- Fiche 3 : suites implicites et DA ----------
fiches["fiche-3-suites-implicites"] = doc("Fiche 3 — Suites implicites et développements asymptotiques", "samedi 24 octobre · matin, 90 min",
 STD,
 r"""
\exo{Exercice 1}{MPSI Camille Jullian 2023, ex. 15}{25 min}
\noindent Pour tout entier naturel $n\geqslant 1$, on note $u_n$ l'unique solution sur $[0,+\infty[$ de l'équation $\ee^x=n-x$.
\begin{enumerate}
\item Montrer que la suite $(u_n)$ est correctement définie.
\item Déterminer la monotonie de la suite $(u_n)$, puis sa limite éventuelle.
\item Montrer que $u_n\sim\ln(n)$.
\item Montrer que $u_n=\ln(n)+\ln\!\left(1-\dfrac{u_n}{n}\right)$, en déduire un développement asymptotique de $u_n$ à la précision $\dfrac{\ln(n)}{n^2}$.
\end{enumerate}

\exo{Exercice 2}{MPSI Camille Jullian 2023, ex. 12}{35 min}
\begin{enumerate}
\item Montrer que l'équation $\tan(x)=x$ admet une unique solution sur l'intervalle $\left]n\pi-\dfrac\pi2,n\pi+\dfrac\pi2\right[$, qu'on notera désormais $u_n$ (on supposera $n\in\N$ pour la suite).
\item Quelle est la limite de la suite $(u_n)$ ? Donner un équivalent simple de $u_n$.
\item Montrer que $\arctan(u_n)=u_n-n\pi$, et en déduire un deuxième terme du développement asymptotique de $u_n$ quand $n$ tend vers $+\infty$.
\item Continuer les calculs jusqu'à obtenir un développement asymptotique de $u_n$ à la précision $\dfrac1{n^3}$.
\end{enumerate}

\exo{Exercice 3}{MPSI Camille Jullian 2023, ex. 7}{30 min}
\noindent On note $f$ la fonction définie sur $]-1,1[$ par $f(x)=\dfrac{1}{x-1}+\dfrac{1}{x+1}+\dfrac{1}{x+2}$. Montrer que $f$ est bijective et calculer un développement asymptotique à l'ordre $\dfrac{1}{x^2}$ au voisinage de $+\infty$ de sa réciproque $g$.
""", "MPSI : " + MPSI)

# ---------- Fiche 4 : étude de fonctions ----------
fiches["fiche-4-etude-fonctions"] = doc("Fiche 4 — Étude locale et globale de fonctions", "lundi 26 octobre · matin, 90 min",
 STD + " Une courbe soignée est demandée : règle, repères, tangentes et asymptotes tracées.",
 r"""
\exo{Exercice 1 — Comportements locaux}{MPSI Camille Jullian 2023, ex. 9 (questions 1 à 6)}{25 min}
\noindent Étudier le comportement des fonctions suivantes (existence d'asymptote ou de tangente et position relative) à l'endroit indiqué :
\begin{enumerate}[itemsep=0.4em]
\item $f(x)=\ln(1+x+x^2)$ au voisinage de $0$.
\item $f(x)=\dfrac{x}{\ee^x-1}$ au voisinage de $0$.
\item $f(x)=2\sqrt{x}-\sqrt{x+1}-\sqrt{x-1}$ en $+\infty$.
\item $f(x)=\dfrac{x}{1+\ee^{\frac1x}}$ en $+\infty$.
\item $f(x)=x^2\arctan\!\left(\dfrac{1}{1+x}\right)$ en $+\infty$.
\item $f(x)=\dfrac{\arctan(x)}{\sin^3(x)}-\dfrac{1}{x^2}$ au voisinage de $0$.
\end{enumerate}

\exo{Exercice 2}{MPSI Camille Jullian 2023, ex. 13}{40 min}
\noindent On souhaite dans cet exercice étudier la fonction $f : x\mapsto(x^2-1)\ln\left|\dfrac{1+x}{1-x}\right|$. On notera $\mathcal{C}$ la courbe représentative de la fonction $f$.
\begin{enumerate}
\item Déterminer rigoureusement l'ensemble de définition de la fonction $f$. Étudier la parité de $f$.
\item Calculer un développement limité à l'ordre 4 en $0$ de $f(x)$. En déduire en particulier l'équation de la tangente en $\mathcal{C}$ à l'origine, ainsi que la position relative de $\mathcal{C}$ et de cette tangente au voisinage de $0$.
\item Étude locale au voisinage de $+\infty$.
 \begin{enumerate}
 \item Calculer un développement limité à l'ordre 3 en $0$ de $(1-X^2)\ln\left(1+\dfrac{2X}{1-X}\right)$.
 \item En déduire un développement asymptotique de $f$ à l'ordre $\dfrac1x$ quand $x$ tend vers $+\infty$.
 \item La courbe $\mathcal{C}$ admet-elle une asymptote en $+\infty$ ? Si oui, préciser la position relative de $\mathcal{C}$ et de cette asymptote.
 \item Que se passe-t-il en $-\infty$ ?
 \end{enumerate}
\item La fonction $f$ est-elle prolongeable par continuité en $1$ ? Si oui, étudier sa dérivabilité à cet endroit.
\item Calculer la dérivée $f'$ de la fonction $f$ et l'exprimer en fonction de $g(x)=\ln\left|\dfrac{1+x}{1-x}\right|-\dfrac1x$.
\item Étudier les variations et le signe de $g$ sur les intervalles $]0,1[$ et $]1,+\infty[$. On prouvera en particulier que $g$ s'annule en une seule valeur $\alpha$ vérifiant $\dfrac12<\alpha<\dfrac34$. En déduire le tableau de variations complet de $f$.
\item Tracer une allure soignée de la courbe $\mathcal{C}$ (on donne $\alpha\simeq 0.65$ et $f(\alpha)\simeq-0.9$).
\end{enumerate}

\exo{Exercice 3}{MPSI Camille Jullian 2023, ex. 14}{25 min}
\noindent On souhaite étudier la fonction $f : x\mapsto\dfrac{(x^2+1)\arctan(x)}{x}$. On notera $\mathcal{C}_f$ sa courbe représentative.
\begin{enumerate}
\item Étudier la parité de la fonction $f$.
\item Calculer le développement limité à l'ordre 3 en $0$ de $f(x)$.
\item En déduire que $f$ est prolongeable par continuité et dérivable en $0$. Donner l'équation de sa tangente en $0$, et la position relative de $\mathcal{C}_f$ et de cette tangente au voisinage de $0$.
\item Montrer que, $\forall x>0$, $\arctan(x)+\arctan\left(\dfrac1x\right)=\dfrac\pi2$.
\item Montrer que $\mathcal{C}_f$ admet une asymptote en $+\infty$, donner son équation ainsi que sa position relative par rapport à $\mathcal{C}_f$. Que se passe-t-il en $-\infty$ ?
\item On pose $h(x)=\arctan(x)+\dfrac{x}{x^2-1}$. Étudier les variations de la fonction $h$ sur $\R^{+*}$.
\item En déduire les variations de $f$.
\item Tracer une allure de la courbe $\mathcal{C}_f$.
\end{enumerate}
""", "MPSI : " + MPSI)

# ---------- Fiche 5 : compléments ----------
fiches["fiche-5-complements"] = doc("Fiche 5 — Compléments", "mardi 27 octobre · matin, 90 min",
 STD,
 r"""
\exo{Exercice 1 — Équivalents de suites}{MPSI Camille Jullian 2023, ex. 1}{20 min}
\noindent Déterminer un équivalent simple de chacune des suites suivantes :
\begin{enumerate}[itemsep=0.4em]
\item $u_n=\dfrac{n^2+\ee^{-2n}+\sqrt{n^5}}{\ln(2n)+2n-3}$
\item $u_n=(n+3\ln(n))\ee^{-(n+1)}$
\item $u_n=\dfrac{\ln(n^2+1)}{n^2+1}$
\item $u_n=\ln\left(\dfrac{n^2+1}{n^2+2}\right)$
\item $u_n=\sqrt{n^2+n+1}-\sqrt{n^2-n+1}$
\item $u_n=\displaystyle\sum_{k=0}^{n}k!$
\item $u_n=\dfrac{n^{\sqrt{n+1}}}{(n+1)^{\sqrt{n}}}$
\end{enumerate}

\exo{Exercice 2}{MPSI Camille Jullian 2023, ex. 2}{20 min}
\noindent Soit $(u_n)$ une suite décroissante vérifiant $u_n+u_{n+1}\sim\dfrac1n$. Montrer que la suite converge nécessairement vers $0$ et en donner un équivalent simple. Le résultat reste-t-il vrai si la suite n'est pas supposée décroissante ?

\exo{Exercice 3}{MPSI Camille Jullian 2023, ex. 10}{20 min}
\noindent Montrer que les suites $(u_n)$ et $(v_n)$ définies par $u_n=n-\displaystyle\sum_{k=1}^{n}\cos\left(\dfrac1k\right)$ et $v_n=u_n+\sin\left(\dfrac1n\right)$ sont adjacentes (au moins à partir d'un certain rang).

\exo{Exercice 4}{MPSI Camille Jullian 2023, ex. 3}{30 min}
\noindent On considère la suite $(u_n)$ définie pour $n\geqslant 1$ par $u_n=\sqrt{n+\sqrt{n-1+\sqrt{n-2+\cdots+\sqrt{2+\sqrt{1}}}}}$.
\begin{enumerate}
\item Montrer que $(u_n)$ diverge vers $+\infty$.
\item Déterminer une relation simple entre $u_{n+1}$ et $u_n$.
\item Prouver par récurrence que $u_n\leqslant n$ puis que $u_n=o(n)$.
\item Déterminer un équivalent simple de $u_n$.
\item Déterminer $\displaystyle\lim_{n\to+\infty}u_n-\sqrt n$.
\end{enumerate}
""", "MPSI : " + MPSI)

# ---------- Fiche 6 : problème de synthèse ----------
fiches["fiche-6-probleme"] = doc("Fiche 6 — Problème de synthèse", "jeudi 29 octobre · matin, 2 h (conditions de DS)",
 "Comme un devoir surveillé : \\textbf{2 heures}, sans cours ni notes, une copie rédigée au propre, courbe soignée. Gère ton temps : si une question bloque, passe à la suivante et reviens-y. "
 "La partie 2 utilise les résultats de la partie 1. Envoie-moi ta copie.",
 r"""
\noindent\textbf{Problème} \hfill\textit{MPSI Camille Jullian 2023, « Problème 1 »}\par\medskip
\noindent On s'intéresse dans tout cet exercice à la fonction $g : x\mapsto \ee^{\frac1x}\sqrt{1+x+x^2}$.
\begin{enumerate}
\item Étude de la fonction $g$.
 \begin{enumerate}
 \item Déterminer le domaine de définition de $g$.
 \item Calculer la dérivée de $g$ et prouver que $g'(x)=\dfrac{\ee^{\frac1x}}{2x^2\sqrt{1+x+x^2}}\,(2x^3-x^2-2x-2)$.
 \item Sans chercher à résoudre d'équation du troisième degré, montrer que $g'$ s'annule une seule fois sur $\R$, en une valeur $\alpha$ vérifiant $1<\alpha<2$.
 \item Déterminer les limites de $g$ aux bornes de son ensemble de définition.
 \item La fonction $g$ prolongée à gauche en $0$ admet-elle une demi-tangente à gauche en $0$ (si oui, déterminer sa pente) ?
 \item Donner un équivalent simple de $g(x)$ lorsque $x$ tend vers $+\infty$.
 \item Effectuer un développement asymptotique de $g$ à l'ordre $\dfrac1{x^2}$ quand $x$ tend vers $+\infty$. En déduire la présence d'une asymptote oblique dont on donnera l'équation, ainsi que la position relative de la courbe de $g$ et de cette asymptote au voisinage de $+\infty$.
 \item La même droite est-elle asymptote quand $x$ tend vers $-\infty$ ? Sinon, que se passe-t-il de ce côté-là ?
 \item Tracer une allure soignée de la courbe représentative de $g$. On donne $\alpha\simeq 1{,}55$ et $g(\alpha)\simeq 4{,}2$.
 \end{enumerate}
\item Un peu de suites implicites.
 \begin{enumerate}
 \item Justifier que, $\forall n\geqslant 5$, l'équation $g(x)=n$ admet deux solutions distinctes $u_n$ et $v_n$ sur $\R^{+*}$ vérifiant $u_n<\alpha$ et $v_n>\alpha$.
 \item Montrer que les deux suites $(u_n)$ et $(v_n)$ sont monotones et prouver rigoureusement que $\displaystyle\lim_{n\to+\infty}u_n=0$ et $\displaystyle\lim_{n\to+\infty}v_n=+\infty$.
 \item En partant de l'équation $g(u_n)=n$, montrer que $\ln(n)\,u_n=1+\dfrac{u_n}{2}\ln(1+u_n+u_n^2)$. En déduire un équivalent simple de $u_n$.
 \item Montrer que $u_n=\dfrac{1}{\ln(n)}+\dfrac{1}{2\ln^3(n)}+o\!\left(\dfrac{1}{\ln^3(n)}\right)$ (attention à la rédaction !).
 \item Utiliser l'expression précédente pour obtenir le terme suivant du développement asymptotique de la suite $(u_n)$.
 \item Donner un équivalent simple de $v_n$ quand $n$ tend vers $+\infty$.
 \item Montrer que $v_n=n\,\ee^{-\frac{1}{v_n}}\left(1+\dfrac{1}{v_n}+\dfrac{1}{v_n^2}\right)^{-\frac12}$, et en déduire la limite de $v_n-n$ quand $n$ tend vers $+\infty$.
 \item Calculer un développement asymptotique de $v_n$ sous la forme $v_n=n+a+\dfrac bn+\dfrac c{n^2}+o\!\left(\dfrac1{n^2}\right)$.
 \end{enumerate}
\end{enumerate}
""", "MPSI : " + MPSI)

for name, tex in fiches.items():
    open(name + ".tex", "w", encoding="utf8").write(tex)
print(sorted(fiches))
