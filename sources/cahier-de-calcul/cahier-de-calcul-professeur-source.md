# Cahier de calcul — source exacte fournie par l'utilisateur

> **Source de vérité pour l'intégration TaekdHub.** Ce fichier est une transcription texte structurée du PDF fourni dans la conversation. Il ne s'agit pas d'une version complétée ou sélectionnée depuis Internet.

- PDF original : `cahier_de_calcul(1).pdf`
- Pages : 119
- SHA-256 du PDF original : `2e4597642bf1e658ed5ef4b7e0639de0e863730e48c8b4bfd475d89e453aec87`
- Méthode : extraction PDF avec conservation de la mise en page (`pdftotext -layout`).
- **Important :** le texte ci-dessous est une représentation de travail ; pour toute ambiguïté mathématique, la page originale du PDF fait foi.

---

## PAGE 001

```text
       Cahier de calcul
        — pratique et entraînement —




Plimpton 322, tablette d’argile babylonienne (1 800 av. JC)

  Cette tablette, vieille de près de 4 000 ans, donne une liste
  de triplets pythagoriciens, c’est-à-dire de triplets (a, b, c) de
  nombres entiers vérifiant a2 + b2 = c2 .
```

---
## PAGE 002

```text
                                           Page web du Cahier de calcul,
                                                dernières versions




Ce cahier de calcul a été écrit collectivement.

Coordination
Colas Bardavid
Équipe des participants
Vincent Bayle, Romain Basson, Olivier Bertrand, Ménard Bourgade, Julien Bureaux,
Alain Camanes, Mathieu Charlot, Mathilde Colin de Verdière, Keven Commault, Miguel Concy,
Rémy Eupherte, Hélène Gros, Audrey Hechner, Florian Hechner, Marie Hézard, Nicolas Laillet,
Valérie Le Blanc, Thierry Limoges, Quang-Thai Ngo, Xavier Pellegrin, Fabien Pellegrini,
Jean-Louis Pourtier, Valérie Robert, Jean-Pierre Técourt, Guillaume Tomasini, Marc Tenti
Le pictogramme      de l’horloge a été créé par Ralf Schmitzer (The Noun Project).
La photographie de la couverture vient de Wikipedia.

Version 1.3.2 — 2 juillet 2026
```

---
## PAGE 003

```text
    Sommaire

    Mode d’emploi . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . v


□       Fiche 1.               Trigonométrie . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 3
□       Fiche 2.               Dérivation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 6
□       Fiche 3.               Primitives . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
□       Fiche 4.               Calcul d’intégrales . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 13
□       Fiche 5.               Intégration par parties . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 16
□       Fiche 6.               Changements de variable . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 18
□       Fiche 7.               Intégration des fractions rationnelles . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 20
□       Fiche 8.               Trigonométrie et nombres complexes . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 23
□       Fiche 9.               Sommes et produits . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 25
□       Fiche 10.              Suites numériques . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 28
□       Fiche 11.              Développements limités . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 31
□       Fiche 12.              Décomposition en éléments simples . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 33
□       Fiche 13.              Calcul matriciel . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 36
□       Fiche 14.              Algèbre linéaire. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .41

□       Fiche 15.              Équations différentielles . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 44
□       Fiche 16.              Séries numériques . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 46


    Réponses et corrigés . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 49




                                                                                                                                                                                                             iii
```

---
## PAGE 004

```text

```

---
## PAGE 005

```text
Mode d’emploi



Qu’est-ce que ce cahier ?
Ce cahier est un cahier de calcul, basé sur le programme de mathématiques collège/lycée ainsi que sur le
programme de première année post-Bac. Il ne se substitue en aucun cas aux TD donnés par votre professeur de
maths mais est un outil pour vous aider à vous améliorer en calcul.


À quoi sert-il ?
En mathématiques, la technique et le calcul sont fondamentaux.
Sans technique, il est impossible de correctement appréhender une question mathématique. De même que l’on
doit faire des gammes et beaucoup pratiquer lorsque l’on apprend un instrument, on doit calculer régulièrement
lorsque l’on pratique les mathématiques, notamment en CPGE et dans les études post-Bac.


Comment est-il organisé ?
Ce cahier comporte plusieurs parties :
  • Un sommaire vous permettant de voir d’un seul coup d’œil les différentes fiches et de noter celles que vous
    avez déjà faites ou pas.
  • Une partie de calculs élémentaires, faisables dès le début de la première année, centrée sur les calculs
    « de base » : développement, factorisation, racines carrées, fractions, etc. Cela peut vous paraître simple,
    mais sachez que ce type d’erreur de calcul est toujours fréquent, même en spé, même sur les copies de
    concours. Travailler les techniques élémentaires de calcul vous facilitera grandement la vie !
  • Une partie liée au programme de première année.
  • Les réponses brutes ainsi que les corrigés détaillés, qui sont à la fin du cahier.
Chaque fiche de calcul est organisée ainsi :
  • Une présentation du thème de la fiche et des prérequis (notamment, pour des techniques propres à certaines
    filières, on précise de quelle filière il s’agit).
  • Une liste de calculs, dont le temps de résolution (incluant la longueur et la technicité du calcul) est
    symbolisé par une (            ), deux (           ), trois (  ) ou quatre (          ) horloges.
  • Vous êtes invité à écrire directement les réponses dans les cadres prévus à cet effet.




                                                                                                              v
```

---
## PAGE 006

```text
Comment l’utiliser ?
Un travail personnalisé.
     Ce cahier de calcul est prévu pour être utilisé en autonomie.
     Choisissez les calculs que vous faites en fonction des difficultés que vous rencontrez et des chapitres que
     vous étudiez, ou bien en fonction des conseils de votre professeur de mathématiques.
     Pensez aussi à l’utiliser à l’issue d’un DS ou d’une colle, lorsque vous vous êtes rendu compte que certains
     points de calcul étaient mal maîtrisés.
     Enfin, ne cherchez pas à faire linéairement ce cahier : les fiches ne sont pas à faire dans l’ordre, mais en
     fonction des points que vous souhaitez travailler.

Un travail régulier.
     Essayez de pratiquer les calculs à un rythme régulier : une quinzaine de minutes par jour par exemple.
     Privilégiez un travail régulier sur le long terme plutôt qu’un objectif du type « faire 10 fiches par jour
     pendant les vacances ».
     Point important : pour réussir à calculer, il faut répéter. C’est pour cela que nous avons mis plusieurs
     exemples illustrant chaque technique de calcul.
     Il peut être utile de parfois refaire certains calculs : n’hésitez pas à cacher les réponses déjà écrites dans
     les cadres, ou à écrire vos réponses dans les cadres au crayon à papier.

Un travail efficace.
     Attention à l’utilisation des réponses et des corrigés : il est important de chercher suffisamment par vous-
     même avant de regarder les réponses et/ou les corrigés. Il faut vraiment faire les calculs afin que le
     corrigé vous soit profitable.
     N’hésitez pas à ne faire qu’en partie une feuille de calculs : il peut être utile de revenir plusieurs fois à une
     même feuille, afin de voir à quel point telle technique a bien été assimilée.


La progression
Avoir une solide technique de calcul s’acquiert sur le long terme, mais si vous étudiez sérieusement les fiches de
ce cahier, vous verrez assez rapidement des progrès apparaître, en colle, en DS, etc. Une bonne connaissance
du cours combinée à une plus grande aisance en calcul, c’est un très beau tremplin vers la réussite en prépa ou
dans vos études !


Une erreur ? Une remarque ?
Si jamais vous voyez une erreur d’énoncé ou de corrigé, ou bien si vous avez une remarque à faire, n’hésitez pas
à écrire à l’adresse cahierdecalcul@gmail.com. Si vous pensez avoir décelé une erreur, merci de donner aussi
l’identifiant de la fiche, écrit en gris clair en haut à droite de chaque fiche.




vi
```

---
## PAGE 007

```text
Énoncés
```

---
## PAGE 008

```text

```

---
## PAGE 009

```text
                                                                 Fiche de calcul no 1                                          007A

                                                              Trigonométrie

                          Prérequis
                          Relation cos2 + sin2 = 1. Symétrie et périodicité de sin et cos.
                          Formules d’addition et de duplication. Fonction tangente.

Dans toute cette fiche, x désigne une quantité réelle.

Valeurs remarquables de cosinus et sinus

Calcul 1.1
Simplifier :
          5π       7π                                                                        4π        4π
a) sin       + sin    ...................                                        c) cos2        − sin2    .................
           6        6                                                                         3         3

b) cos π4 + cos 3π       5π      7π
                 4 + cos 4 + cos 4 . . .                                         d) tan 2π       3π      5π      7π
                                                                                         3 + tan 4 + tan 6 + tan 6 .




Propriétés remarquables de cosinus et sinus

Calcul 1.2
Simplifier :
                   π                                                                     π       π    
a) sin(π − x) + cos   + x ..........                                             c) sin   − x + sin     + x .........
                    2                                                                   2             2
                              π                                                                    π    
b) sin(−x) + cos(π + x) + sin    −x                                              d) cos(x − π) + sin − − x . . . . . . . .
                               2                                                                      2


Formules d’addition

Calcul 1.3
Calculer les quantités suivantes.
          5π      π π  5π                                                                   π
a) cos       (on a + =    ) ........                                             c) sin        .............................
          12      6 4  12                                                                   12
          π                                                                                 π
b) cos       ............................                                        d) tan        ............................
          12                                                                                12

Calcul 1.4

a) Simplifier : sin(4x) cos(5x) − sin(5x) cos(4x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

                      sin 2x cos 2x           i πh
b) Simplifier :              −       (pour x ∈ 0, ) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                       sin x   cos x             2

Fiche no 1. Trigonométrie                                                                                                         3
```

---
## PAGE 010

```text
Calcul 1.5
                                               
                                2π             4π
a) Simplifier : cos x + cos x +      + cos x +      ..............................
                                 3              3

b) Expliciter cos(3x) en fonction de cos x . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Formules de duplication

Calcul 1.6
                                     π      π
En remarquant qu’on a                  = 2 × , calculer :
                                     4      8
           π                                                                                        π
a) cos       .............................                                              b) sin        .............................
           8                                                                                        8

Calcul 1.7
                1 − cos(2x)            i πh
a) Simplifier :               (pour x ∈ 0, ) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                   sin(2x)                2
                sin 3x cos 3x             i πh
b) Simplifier :         −        (pour x ∈ 0, ) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                 sin x     cos x             2

c) Expliciter cos(4x) en fonction de cos x . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Équations trigonométriques

Calcul 1.8
Résoudre dans [0, 2π], dans [−π, π], puis dans R les équations suivantes :


                  1                                                                                       1
a) cos x =          ............                                                        f)    | tan x| = √ . . . . . . . .
                  2                                                                                        3
                     √                                                                                         √
              3                                                                                                  3
b) sin x = −    .........                                                               g) cos(2x) =               ........
             2                                                                                                  2

                       2π
c) sin x = cos            ........                                                      h) 2 sin2 x + sin x − 1 = 0
                        3

                                                                                                                π
d) tan x = −1 . . . . . . . . . . .                                                     i)    cos x = cos         ........
                                                                                                                7

                    1                                                                                           π
e) cos2 x =           ...........                                                       j)    sin x = cos         .........
                    2                                                                                           7




4                                                                                                                                       Fiche no 1. Trigonométrie
```

---
## PAGE 011

```text
Inéquations trigonométriques

Calcul 1.9
Résoudre dans [0, 2π], puis dans [−π, π], les inéquations suivantes :
             √
               2
a) cos x ⩾ −      ........                                 e) tan x ⩾ 1 . . . . . . . . . . . .
              2
                   π
b) cos x ⩽ cos       ........                                               f)    |tan x| ⩾ 1 . . . . . . . . . . .
                   3
              1                                                                       π
c) sin x ⩽      ............                                                g) cos x −     ⩾ 0 ......
              2                                                                        4
                1                                                                      π
d) |sin x| ⩽      ...........                                               h) cos 2x −     ⩾ 0 .....
                2                                                                        4
                                                          Réponses mélangées
                                                                                            √        √
                                n
                                    π
                                                     o    n
                                                              11π
                                                                                 o              2+       6
       {4π/3, 5π/3}                   + kπ, k ∈ Z ∪               + kπ, k ∈ Z                                      [0, 3π/4] ∪ [5π/4, 2π]
                                    12                        12
                                                                                                4
                                            3π π π 3π
             [−π/4, 3π/4]               −      ,− , ,                    {−π/2, π/6, 5π/6}                   0            {7π/6, 11π/6}
                                             4   4 4 4                                                                              √      √
                                                                4               2
                                                                                                   nπ          π          o           6− 2
       {π/7, 13π/7}           [π/3, 5π/3]                8 cos x − 8 cos x + 1                            + k ,k ∈ Z
                                                                                                    4        2                         4
                             3π                                   n
                                                                     4π
                                                                                           o     n
                                                                                                    5π
                                                                                                                         o
            tan x                  + kπ, k ∈ Z                           + 2kπ, k ∈ Z ∪                   + 2kπ, k ∈ Z            − sin x
                              4                                       3                               3
         n π πo                                                                                                            
                                                                                5π π                    h πi         5π                  1
            − ,              4 cos3 x − 3 cos x                 2            − ,−                        0,      ∪       , 2π
              3 3                                                                 6      6                   6
                                                                                              h π i  5π 7π   11π
                                                                                                                      6                  x
                                                                                                                                      cos
             n
               π
                                   o n
                                              π
                                                                     o              1
                   + 2kπ, k ∈ Z ∪ − + 2kπ, k ∈ Z                                −               0,       ∪       ,       ∪         , 2π
                7                             7                                     2               6          6 6              6
                                                                                                                                          √
                               
         h       π  i     5π               h
                                             π π
                                                     h    i
                                                            π 3π
                                                                      i   h
                                                                             5π 3π
                                                                                       h    i
                                                                                              3π 7π
                                                                                                         i
           −π,        ∪      ,π                 ,      ∪      ,         ∪        ,       ∪        ,              −2 cos x          −1 − 3
                 6         6                 4 2            2 4               4 2              2 4
                                                                                                                                  √      √
         n
           π
                            o n
                                    5π
                                                          o                                                                          6− 2
             + kπ, k ∈ Z ∪               + kπ, k ∈ Z                   2 cos x           {π/4, 3π/4, 5π/4, 7π/4}
           6                         6                                                     
                                                                                                 5π π π 5π
                                                                                                                              n π 4π o
              3π      π        π      π        π π           π 3π
           h            h i             i h            h i            i
            − ,−         ∪ − ,−           ∪        ,    ∪       ,               0             − ,− , ,                            − ,
               4      2        2      4        4 2           2 4                                  6        6 6 6                    7 7
                                              h           π i      h  π    i          n
                                                                                        7π
                                                                                                               o   n
                                                                                                                      11π
                                                                                                                                           o
         0         [−3π/4, 3π/4]               −π, −           ∪        ,π                   + 2kπ, k ∈ Z ∪                 + 2kπ, k ∈ Z
                                                                                         6                             6
                                                    3  3                                                                      p      √
                        π 11π 13π 23π                             π 5π 7π 11π                             3π        7π                   2+ 2
     − sin x              ,       ,      ,                          ,     ,      ,                    0,        ∪       , 2π
              h 12 12             12 12                       6 6 6              6                    4         4                    2
          5π            π πi         5π                                                       11π          π π 11π
    −π, −       ∪ − ,          ∪         ,π             {5π/14, 9π/14}                     −        ,− , ,                        {5π/14, 9π/14}
           6            6 6           6                                                  12             12 12 12
                                                                                                                                           √
                                                                                                                            
                                                                                    3π         7π 11π              15π
        {π/6, 5π/6, 3π/2}               {π/3, 5π/3}                0           0,         ∪         ,          ∪        , 2π          2− 3
                        h                                                        8           8       8          8
             3π π             π πh                   π       2π                         n
                                                                                          5π
                                                                                                                 o n
                                                                                                                        9π
                                                                                                                                           o
           − ,−           ∪     ,                       + k ,k ∈ Z                             + 2kπ, k ∈ Z ∪                + 2kπ, k ∈ Z
              4       2       4 2                    6        3                            14                           14
                                                                                h π π h  5π 3π 
                                                                                                                     p       √
                                                                                                                        2− 2
                      {3π/4, 7π/4}                {−π/4, 3π/4}                       ,      ∪         ,
                                                                            4 2           4 2                      2
              5π            π 3π            7π                      −2π −π                   n
                                                                                                π
                                                                                                                    o n
                                                                                                                              π
                                                                                                                                              o
      −π, −           ∪ − ,            ∪          ,π                       ,                        + 2kπ, k ∈ Z ∪ − + 2kπ, k ∈ Z
               8            8 8              8                         3       3                3                             3

                                                                                                                 ▶ Réponses et corrigés page 51

Fiche no 1. Trigonométrie                                                                                                                          5
```

---
## PAGE 012

```text
                                                                      Fiche de calcul no 2                                     008A

                                                                       Dérivation


Application des formules usuelles

Calcul 2.1 — Avec des produits.
Déterminer l’expression de f ′ (x) pour f définie par :

a) x ∈ R et f (x) = (x2 + 3x + 2)(2x − 5) . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) x ∈ R et f (x) = (x3 + 3x + 2)(x2 − 5) . . . . . . . . . . . . . . . . . . . . . . . . . . . .


c) x ∈ R et f (x) = (x2 − 2x + 6) exp (2x) . . . . . . . . . . . . . . . . . . . . . . . . . . . .


d) x ∈ ]2, +∞[ et f (x) = (3x2 − x) ln(x − 2) . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 2.2 — Avec des puissances.
Déterminer l’expression de f ′ (x) pour f définie par :

a) x ∈ R et f (x) = (x2 − 5x)5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) x ∈ R et f (x) = (2x3 + 4x − 1)2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


c) x ∈ R et f (x) = (sin(x) + 2 cos(x))2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


d) x ∈ R et f (x) = (3 cos(x) − sin(x))3 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 2.3 — Avec des fonctions composées (I).
Déterminer l’expression de f ′ (x) pour f définie par :

a) x ∈ R et f (x) = ln(x2 + 1) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) x ∈ ]1, +∞[ et f (x) = ln(ln(x)) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


c) x ∈ R et f (x) = (2 − x) exp (x2 + x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


d) x ∈ R et f (x) = exp(3 sin(2x)) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

6                                                                                                              Fiche no 2. Dérivation
```

---
## PAGE 013

```text
Calcul 2.4 — Avec des fonctions composées (II).
Déterminer l’expression de f ′ (x) pour f définie par :
                         2        
                         2x − 1
a) x ∈ R et f (x) = sin              ...................................
                          x2 + 1
                               
                         2x + 1
b) x ∈ R et f (x) = cos 2         ....................................
                         x +4

                           p
c) x ∈ ]0, π[ et f (x) =       sin(x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


                                        √ 
d) x ∈ ]0, +∞[ et f (x) = sin            x ...................................


Calcul 2.5 — Avec des quotients.
Déterminer l’expression de f ′ (x) pour f définie par :

                           x2 + 3x
a) x ∈ R et f (x) =                   .....................................
                         2 sin(x) + 3
                                   √
                                   x
b) x ∈ ]0, +∞[ et f (x) =              .....................................
                                3x + 2

                         cos(2x + 1)
c) x ∈ R et f (x) =                  ......................................
                           x2 + 1

                                2x2 + 3x
d) x ∈ ]1, +∞[ et f (x) =                ..................................
                                  ln(x)

Opérations et fonctions composées

Calcul 2.6
Déterminer l’expression de f ′ (x) pour f définie par :
                             
                              1
a) x ∈ R∗ et f (x) = x2 sin        ......................................
                              x

                                     x
b) x ∈ ] − 3, 3[ et f (x) = √             ...................................
                                   9 − x2

                                   r x + 1 
c) x ∈ ]1, +∞[ et f (x) = ln                              ..............................
                                           x−1

                                sin x 
d) x ∈ ]0, π[ et f (x) = ln                    ....................................
                                    x


Fiche no 2. Dérivation                                                                                              7
```

---
## PAGE 014

```text
Dériver pour étudier une fonction

Calcul 2.7
Calculer f ′ (x) et écrire le résultat sous forme factorisée.

                                       1   1
a) x ∈ R \ 3, −2 et f (x) =              +    ............................
                                      3−x 2+x


b) x ∈ ] − 1, +∞[ et f (x) = x2 − ln(x + 1) . . . . . . . . . . . . . . . . . . . . . . . . . . .


                                                           x+2
c) x ∈ ]1, +∞[ et f (x) = ln(x2 + x − 2) −                     .....................
                                                           x−1

                                         x
d) x ∈ ] − 1, +∞[ et f (x) =                + x − 2 ln(x + 1) . . . . . . . . . . . . . . . . . .
                                        x+1

                                             1 + ln(x)
e) x ∈ ]0, e[ ∪ ]e, +∞[ et f (x) =                     ...........................
                                             1 − ln(x)




                                                            Réponses mélangées
                                                                               2x2 + 2x − 8
                                                                                                            
                          2 − 3x                       2                      1                      2x + 1
                        √                                                                     sin 2
                       2 x(3x + 2)2              x(1 − ln(x))2             1 − x2(x2 + 4)2           x +4
                                                   2x2 + 2x + 5                             3x 2
                                                                                                 − x            1
            5(x2 − 5x)4 (2x − 5)                                    (6x − 1) ln(x − 2) +
                                                  (x + 2)(x − 1)2                            x −2         x ln(x)
                                                                                                                
            (2x + 3)(2 sin(x) + 3) − (x2 + 3x) × 2 cos(x)        x cos(x) − sin(x)                  1             1
                                                                                          2x sin        −  cos
                            (2 sin(x) + 3)2                           x sin(x)                     x              x
                           √                  √                                                            2        
           2         1 + 3            1 − 3              2                                 6x             2x − 1
                  x+                x+                   (2x − 2x + 10) exp(2x)                        cos
         x+1              2                  2                                             (x2 + 1)2          x2 + 1
                                                                                                            2
                     10x − 5                                                          cos(x)              x
                                            8 cos2 (x) − 6 cos(x) sin(x) − 4
                 (3 − x)2 (2 + x)2                                                                    (x + 1)2
                                                                                     p
                                                   √                                2 sin(x)
                                               cos( x)
      (−2x2 + 3x + 1) exp(x2 + x)                 √           6 cos(2x) exp(3 sin(2x))         4(2x3 + 4x − 1)(3x2 + 2)
                                                 2 x
       (4x + 3) ln(x) − 2x − 3              2x                                   (x2 + 1) sin(2x + 1) + x cos(2x + 1)
                      2                    2
                                                       6x2 + 2x − 11         −2
              (ln(x))                    x +1                                                    (x2 + 1)2
                                                                                                        9
             5x4 − 6x2 + 4x − 15              −3(3 cos(x) − sin(x))2 (3 sin(x) + cos(x))                 √
                                                                                               (9 − x ) 9 − x2
                                                                                                      2



                                                                                                    ▶ Réponses et corrigés page 55

8                                                                                                              Fiche no 2. Dérivation
```

---
## PAGE 015

```text
                                                             Fiche de calcul no 3                                                   009A

                                                              Primitives

                                Prérequis
                                Intégration de Terminale. Dérivée d’une fonction composée.
                                Trigonométrie directe et réciproque. Trigonométrie hyperbolique.


Pour chaque fonction à intégrer, on pourra commencer par chercher les domaines où elle admet des primitives.


Calculs directs

Calcul 3.1
Déterminer directement une primitive des expressions suivantes.
       1                                                                          3
a)        ........................                                       c)            ......................
      t+1                                                                     (t + 2)3
          3
b)             ......................                                    d) sin(4t) . . . . . . . . . . . . . . . . . . . . . . .
      (t + 2)2


Calcul 3.2
Même exercice.
     √                √
                      3                                                             1
a)       1+t−             t .................                            c) √             ....................
                                                                                  1 − 4t2

b) e2t+1 . . . . . . . . . . . . . . . . . . . . . . . . .                       1
                                                                         d)           ......................
                                                                              1 + 9t2


Utilisation des formulaires

Calcul 3.3 — Dérivée d’une fonction composée (I).
Déterminer une primitive des expressions suivantes en reconnaissant la dérivée d’une fonction composée.
        2t2                                                                         7t
a)           .......................                                     d) √             ....................
      1 + t3                                                                3
                                                                                  1 + 7t2
       p                                                                         t
b) t    1 + 2t2 . . . . . . . . . . . . . . . . . . . .                  e)           ......................
                                                                              1 + 3t2
           t                                                                     12t
c) √            .....................                                    f)               ...................
         1 − t2                                                               (1 + 3t2 )3




Fiche no 3. Primitives                                                                                                                 9
```

---
## PAGE 016

```text
Calcul 3.4 — Dérivée d’une fonction composée (II).
Même exercice.
      ln3 t                                                                                     1
a)          .........................                                                     d)    √ ........................
        t                                                                                      t2 t

b) √
     1
          .......................                                                                et + e−t
                                                                                          e)                .................
   t ln t                                                                                      1 − e−t + et
                                                                                                1
         8e2t                                                                                  et
c)                ....................                                                    f)      ...........................
      (3 − e2t )3                                                                              t2


Calcul 3.5 — Trigonométrie (I).
Déterminer une primitive des expressions suivantes en reconnaissant la dérivée d’une fonction composée.
                                                                  cos(π ln t)                                        1 + tan2 t
a) cos2 t sin t . . . . . . .                                f)               .......                           k)              .......
                                                                      t                                                tan2 t
                                                                                                                        cos t
b) cos(t)esin t . . . . . . .                                g) tan2 t . . . . . . . . . . .                    l)                ......
                                                                                                                     (1 − sin t)3

c) tan t . . . . . . . . . . . .                             h) tan3 t . . . . . . . . . . .                            1
                                                                                                                m)           ..........
                                                                                                                     1 + 4t2
     cos t                                                        tan3 t                                               et
d)           ........                                        i)          ...........                            n)           ..........
   1 − sin t                                                      cos2 t                                             1 + e2t
      √
   sin t                                                                   1
e) √ . . . . . . . . . . .                                   j)             √           ...
       t                                                          cos2 (t)      tan t


Calcul 3.6 — Trigonométrie réciproque.
Même exercice, pour ceux qui connaissent la fonction arcsin.
   arcsin(t)
a) √         .......................................................................
     1 − t2
                   1
b) √                               ................................................................
         1 − t2 arcsin(t)

Calcul 3.7 — Trigonométrie (II).
Déterminer une primitive des expressions suivantes en utilisant d’abord le formulaire de trigonométrie.
                                                                                                    1
a) cos2 t . . . . . . . . . . . . . . . . . . . . . . . .                                 e)               ....................
                                                                                               sin t cos t
                                                                                                       1
b) cos(t) sin(3t) . . . . . . . . . . . . . . . . .                                       f)                     ................
                                                                                               sin2 (t) cos2 (t)

c) sin3 t. . . . . . . . . . . . . . . . . . . . . . . . .                                        1
                                                                                          g)           ......................
                                                                                               sin(4t)
       sin(2t)
d)               ....................
      1 + sin2 t


10                                                                                                                                  Fiche no 3. Primitives
```

---
## PAGE 017

```text
Calcul 3.8 — Fractions rationnelles.
Déterminer une primitive des expressions suivantes après quelques manipulations algébriques simples.

     t2 + t + 1                                              t−1
a)              .............                           e)       ..................
         t2                                                  t+1

     t2 + 1                                                   t3
b)          .................                           f)       ..................
       t3                                                    t+1

     1 − t6                                                   t−1
c)          .................                           g)          .................
     1 − t2                                                  t2 + 1

     t3 + 1                                                      t
d)          .................                           h)            ...............
      t+1                                                    (t + 1)2


Dériver puis intégrer, intégrer puis dériver

Calcul 3.9
Pour chacune des expressions suivantes :
     • dériver puis factoriser l’expression ;
     • intégrer l’expression.

                                                              1      1
a) t2 − 2t + 5 . . . . .                                j)     2
                                                                 sin   .......
                                                              t      t
     1   1                                                     et
b)      + .........                                     k)          ..........
     t2  t                                                   2 + et
     √        1                                                 sin t
c)       t−      ........                               l)               ......
              t3                                             2 + 3 cos t
     1    1                                                      t
d)      + √ .......                                     m) √          ........
     t4  t t                                                   1 − t2
                                                               sin 2t
e) e2t + e−3t . . . . . .                               n)              ......
                                                             1 + cos2 t
                                                                  2
f) e3t−2 . . . . . . . . . . .                          o) te−t . . . . . . . . . . .

       t2                                                    1 − ln t
g)          ..........                                  p)            ........
     t3 − 1                                                     t
     3t − 1                                                     1
h)          .........                                   q)          ...........
     t2 + 1                                                  t ln t
                                                             sin(ln t)
i) sin(t) cos2 (t) . . .                                r)             ........
                                                                 t




Fiche no 3. Primitives                                                                                 11
```

---
## PAGE 018

```text
Calcul 3.10 — Bis repetita.
Reprendre l’exercice précédent en commençant par intégrer puis en dérivant et factorisant.
Les calculs seront évidemment les mêmes, mais ce sera un bon entraînement supplémentaire !

Calcul 3.11 — Trigonométrie réciproque et hyperbolique.
Pour chacune des expressions suivantes :
     • dériver puis factoriser l’expression ;
     • intégrer l’expression.
       et
a)           ...............                                                 b) sinh(t) cosh(t) . . . . . . . .
     1 + e2t




                                                            Réponses mélangées
                             t2     t3                                              1                2 cos t + 3              1
      arctan(et )        t−      + − ln |t + 1|                 3e3t−2 puis e3t−2                                    puis − ln |2 + 3 cos t|
                              2      3                                              3              (2 + 3 cos t)2             3
                     1                      1              cos(4t) cos(2t)                  1                                          t2     t3
      t + ln |t| −             ln |t| − 2               −              −                       ln(1 + t2 ) − arctan(t)            t− +
                     t                    2t                  8                 4          2                                          2       3
                                                                                  √
               
            1 2                     1                                                         1 2t+1         1                        1 4
        − 2        + 1 puis − + ln |t|                   ln | tan t|            2 ln t           e              ln(1 + 3t2 )            ln t
            t t                     t                                                         2              6                        4
     cos(4t)                              1                                                      1                                 1         1
   −                 ln |t + 1|             arcsin(2t)           ln(1 + sin2 t)            −               2e2t − 3e−3t puis e2t − e−3t
         4                                2                                                   tan t                                2         3
                                                     2          1 2                  4     3 1              11        2            p
         − ln |1 − sin t|         (1 − 2t2 )e−t puis − e−t                         − 5 − 5/2 puis − 3 − √                        − 1 − t2
                                                                2                    t     2t               3t         t
                         1            cos ln t − sin ln t                                     1        1                  2               3
        ln |t + 1| +                                           puis − cos(ln t))                                      − 3           −
                       t+1                        t2                                          2 (1 − sin t)2            3t 2           t+2
      t3      t5       t     sin(2t)                 1                                           1                  1
  t+ +                   +                      −e t         sinh(t)2 + cosh2 (t) puis sinh2 (t)                      arctan(2t)           tan t − t
      3       5        2        4                                                                2                  2
         1               √                ln t − 2                    1                        3                                             1
−                      2 tan t                         puis ln t − ln2 t               −                    cos t(3 cos2 t − 2) puis − cos3 t
   (1 + 3t2 )2                                 t2                     2                   2(t + 2)2                                          3
                           1      3                      −t       t                                     1       3         2 3       1
               − cos t + cos t                ln |1 − e + e |                 t − 2 ln |t + 1|          √ +        puis t 2 + 2
                           3                                                                           2 t t4             3        2t
                 2                           3                                                                1 3
                                         t(t + 2)                    1
                              −                              puis ln(|t − 1|)  3
                                                                                             2(t − 1) puis t − t + 5t  2
                                                                                                                                      esin t
           (3 − e2t )2          (t − 1)2 (t2 + t + 1)2               3                                        3
            1                p                     2         3      3 4                                               √          1
                    puis   −    1  −  t 2            (1 + t) 2 −      t 3          −cotant   +   tan t       −2  cos    t          ln | tan 2t|
     (1 − t2 )3/2                                  3                4                                                            4
1                      1                          1                                                              3             2        1
  (arcsin(t))2           arctan(3t)                 tan4 t          − ln | cos t|         ln |arcsin(t)|           (1 + 7t2 ) 3            sin(π ln t)
2                      3                          4                                                              4                      π
                                                                          t                                    t 2t
      1 + ln t                           2                            2e                                     e (e − 1)
   − 2 2 puis ln | ln t|                    ln |1 + t3 |                    t  2
                                                                                  puis ln(2 + et )         −                ) puis arctan(et )
      t ln t                             3                        (2 + e )                                    (1 + e2t )2
          1                                   1                1                 3         3t2 − 2t − 3          3
             tan2 t + ln | cos t|          − cos3 t               (1 + 2t2 ) 2           −      2 + 1)2
                                                                                                          puis ln(t2 + 1) − arctan(t)
          2                                   3                6                             (t                  2
                             2t sin 1t + cos 1t                  1              3 cos2 t − 1
                          −                           puis cos               2                  puis − ln(1 + cos2 (t))
                                      t4                         t             (1 + cos2 t)2

                                                                                                            ▶ Réponses et corrigés page 59

12                                                                                                                          Fiche no 3. Primitives
```

---
## PAGE 019

```text
                                                                                  Fiche de calcul no 4                                                                                010A

                                                                       Calcul d’intégrales


Intégrales et aires algébriques

Calcul 4.1
Sans chercher à calculer les intégrales suivantes, donner leur signe.
     ˆ 3
a)          x2 + ex dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      −2

     ˆ −3
b)           | sin 7x| dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      5
     ˆ −1
c)           sin x dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      0


Calcul 4.2
En se ramenant à des aires, calculer les intégrales suivantes.

     ˆ 3                                                                                                        ˆ 8
a)         7 dx . . . . . . . . . . . . . . . . . . . .                                                 d)            (1 − 2x) dx . . . . . . . . . . . . . .
      1                                                                                                           2

     ˆ −3                                                                                                       ˆ 2
b)           −5 dx . . . . . . . . . . . . . . . . .                                                    e)             sin x dx . . . . . . . . . . . . . . . . .
      7                                                                                                           −2

     ˆ 7                                                                                                        ˆ 1
c)         3x dx . . . . . . . . . . . . . . . . . . .                                                  f)             |x| dx . . . . . . . . . . . . . . . . . .
      0                                                                                                           −2



Calcul d’intégrales

Calcul 4.3 — Polynômes.
Calculer les intégrales suivantes.

     ˆ 3                                                                                                        ˆ 1
a)          2 dx . . . . . . . . . . . . . . . . . . . .                                                d)             (3x5 − 5x3 ) dx . . . . . . . . . .
      −1                                                                                                          −1

     ˆ 3                                                                                                        ˆ 1
b)         (2x − 5) dx . . . . . . . . . . . . . .                                                      e)            (x5 − x4 ) dx . . . . . . . . . . . . .
      1                                                                                                           0

     ˆ 0                                                                                                        ˆ −1
c)         (x2 + x + 1) dx . . . . . . . . .                                                            f)               x100 dx . . . . . . . . . . . . . . . .
      −2                                                                                                          1




Fiche no 4. Calcul d’intégrales                                                                                                                                                         13
```

---
## PAGE 020

```text
Calcul 4.4 — Fonctions usuelles.
Calculer les intégrales suivantes.
    ˆ π6                                                                                                              ˆ 100
                                                                                                                                  1
a)       sin x dx . . . . . . . . . . . . . . . . . . . . . .                                                 d)                 √ dx . . . . . . . . . . . . . . . . . . . . . .
        −π
         6                                                                                                              1          x
      ˆ     π                                                                                                         ˆ 2
            6
b)               cos x dx . . . . . . . . . . . . . . . . . . . . . .                                         e)             ex dx . . . . . . . . . . . . . . . . . . . . . . . . .
        −π                                                                                                              −3
         6

      ˆ 2                                                                                                             ˆ −1
                dx                                                                                                              dx
c)                 ............................                                                               f)                   ..........................
                x2                                                                                                      −3      x
        1



Calcul 4.5 — De la forme f (ax + b).
Calculer les intégrales suivantes.
    ˆ 2                                                                                                               ˆ π6
a)      (2x + 1)3 dx . . . . . . . . . . . .                                                                  d)                sin(3x) dx . . . . . . . . . . . . .
                                                                                                                          π
        −1                                                                                                              − 12

      ˆ 4                                                                                                             ˆ 33
                   1                                                                                                                1
b)              e 2 x+1 dx . . . . . . . . . . . . . . .                                                      e)               √          dx . . . . . . . . . . . .
        −2                                                                                                              0          3x + 1
      ˆ 1                                                                                                             ˆ π2
                 dx                                                                                                           π    
c)                     .................                                                                      f)           cos   − x dx . . . . . . . . .
        0       πx + 2                                                                                                  −π     3


Calcul 4.6 — Fonctions composées.
Calculer les intégrales suivantes.
      ˆ 3
                       x−2
a)                                     dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        1       x2 − 4x + 5
      ˆ π4
b)               x sin(x2 + 1) dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        −π
         4


      ˆ π6
c)               tan x dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        0

      ˆ π3
d)               sin x(cos x)5 dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        −π
         2


      ˆ 1
                       2
e)              xex −1 dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        0

      ˆ 1
                    x
f)                        dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        0       (x2 + 1)4




14                                                                                                                                                                  Fiche no 4. Calcul d’intégrales
```

---
## PAGE 021

```text
Calcul 4.7 — Divers.
Calculer les intégrales suivantes.
     ˆ 1
                 ex
a)                        dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      0     e2x + 2ex + 1

     ˆ 3
b)          |x + 1| dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      −2

     ˆ 2
c)          max(1, ex ) dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      −1

     ˆ e
            3x − 2 ln x
d)                      dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      1         x

     ˆ π2
e)          cos(2x) sin(x) dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      0

     ˆ π4
f)           | cos x sin x| dx . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
      −π
       3



Calcul 4.8 — Avec les nouvelles fonctions de référence.

     ˆ π4                                                                                                    ˆ 1
a)           arcsin x dx . . . . . .                                                                 d)             ch(x) dx . . . . . . . . . .
      −π
       4                                                                                                       0

     ˆ 1                                                                                                     ˆ 1
               1                                                                                                    √
b)                 dx . . . . . . . .                                                                e)                 x dx . . . . . . . . . . . .
      0     1 + x2                                                                                             0

     ˆ 2                                                                                                     ˆ √33
                                                                                                                           2
c)          10x dx . . . . . . . . . . . .                                                           f)                         dx . . . . .
      0                                                                                                        0        1 + 9x2




                                                                              Réponses mélangées
                  99                                                                                                              1        17          e − 1e
     − ln 3               Positif     50      Positif                                             14            1           −                                     0   0
                ln
                  10 √                                                                                                          30       √2             2
        1      1         2              1       π                                                2              1                   1     3          8      1     1
           1−                   e2        ln 1 +                                                                −                       −                       −
        2      e        6              π         2                                                 3             384                  2    2          3     2 e+1
       5       2     −3    π       2π             5                                               1              2                                  2
              e −e                          8                                                                 −                   −2            ln √         18     0
       2                    4       9             8                                               2             101                                  3
                    147       3             1                                                                                                                        7
     Négatif               2(e − 1)       −        0                                              78            3e − 4                −54         0    0      6
                     2                      3                                                                                                                       48

                                                                                                                                             ▶ Réponses et corrigés page 62

Fiche no 4. Calcul d’intégrales                                                                                                                                           15
```

---
## PAGE 022

```text
                                                                          Fiche de calcul no 5                                                                 011A

                                                                   Intégration par parties

                                  Prérequis
                                  Primitives, dérivées, intégration par parties.


On rappelle le théorème d’intégration par parties. Si (a, b) ∈ R2 , si u ∈ C 1 ([a, b], R) et si v ∈ C 1 ([a, b], R), alors
                                                         ˆ b                  h        ib ˆ b
                                                               u′ (t)v(t) dt = u(t)v(t) −     u(t)v ′ (t) dt.
                                                           a                               a        a




Intégrales

Calcul 5.1
Calculer :
    ˆ π2                                                                                       ˆ 1
a)       t cos t dt . . . . . . . . . . . . . . . . . . .                             g)              ln(1 + t2 ) dt . . . . . . . . . . . . . . . .
        0                                                                                       0
      ˆ 1                                                                                      ˆ 1
b)          (2t + 3)sh(2t) dt . . . . . . . . . . . .                                 h)              t arctan t dt . . . . . . . . . . . . . . . .
        0                                                                                       0
      ˆ 2                                                                                      ˆ 21
                t
c)          te 2 dt . . . . . . . . . . . . . . . . . . . . . .                       i)                arcsin t dt . . . . . . . . . . . . . . . . . .
        0                                                                                       0
      ˆ ln(2)                                                                                  ˆ 1
                                                                                                           t
d)                  t2t dt . . . . . . . . . . . . . . . . . . .                      j)              √       dt . . . . . . . . . . . . . . . . . .
        1                                                                                       0         1+t
      ˆ e                                                                                      ˆ 1
                                                                                                      √
e)          ln t dt . . . . . . . . . . . . . . . . . . . . . .                       k)                  1 + t ln(1 + t) dt . . . . . . . . . .
        1                                                                                       0
      ˆ 2                                                                                      ˆ π4
f)          t ln t dt . . . . . . . . . . . . . . . . . . . . .                       l)                t tan2 t dt . . . . . . . . . . . . . . . . . .
        1                                                                                       0



Primitives

Calcul 5.2
Pour chaque fonction suivante, préciser sur quel ensemble elle est définie, puis en déterminer une primitive.


a) x 7−→ (−x + 1)ex . . . .                                                           c) x 7−→ arctan(x) . . . . . .


                    ln x
b) x 7−→                 ...........                                                  d) x 7−→ xch(x) . . . . . . . . .
                     x2


16                                                                                                                                Fiche no 5. Intégration par parties
```

---
## PAGE 023

```text
Intégrations par parties successives

Pour ces calculs de primitives et d’intégrales, on pourra réaliser plusieurs intégrations par parties successives.

Calcul 5.3 — Calcul d’intégrales.
      ˆ 1
a)          (t2 + 3t − 4)e2t dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        0

      ˆ π2
b)           et sin t dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        0


Calcul 5.4 — Calcul de primitives.
Calculer des primitives des fonctions suivantes.


a) x 7−→ sin(x)sh(x) . . . .                                                                            c) x 7−→ (x ln x)2 . . . . . . .



b) x 7−→ ln2 x . . . . . . . . . . .                                                                    d) x 7−→ earccos(x) . . . . . . .




                                                  Réponses mélangées
                   R→ R
                          (                                             √
                                                                       2 2 4           π 1          π2
                          1                                         −      +             − ln(2) −
                    x→7     (− cos(x)sh(x) + sin(x)ch(x))               3     3        4   2        32
                 ∗       2                                                        
                   R+ → R                                                  3          R → R
                                                         4       2 ln(2) −
                     x 7→ x ln2 x − 2x ln x + 2x                           4          x 7→ (−x + 2)ex
                                                 √                         
                                   π        π      3          π 1             R → R
                    ln(2) − 2 +               +      −1          −
      ∗                           2       12     2           4      2        x 7→ xsh(x) − ch(x)
      R+ → R                                                                ] − 1, 1[ → R
                                                               π
                                                                            (
                                                 π          e2 + 1
              3 1           2          2             −1                                    1              p    
                     2
      x 7→ x      ln x − ln x +                  2              2                   x 7→ earccos(x) x − 1 − x2
                 3          9         27                                                   2
                        2 ln(2)
                (ln(2)) 2       − 2 ln(2) − 2ln(2) + 2      5      2      4√             8√    4
                                        2                     −e              2 ln(2) −     2+        1
                                (ln(2))                     2             3              9     9
                                                                                        ( ∗
                                              R→ R                                        R+ → R
                                           (
            5           1          3
              ch(2) − sh(2) −                                      1                              1 + ln x
            2           2          2          x 7→ x arctan(x) − ln(1 + x2 )               x 7→ −
                                                                   2                                 x

                                                                                                                                     ▶ Réponses et corrigés page 66

Fiche no 5. Intégration par parties                                                                                                                              17
```

---
## PAGE 024

```text
                                                           Fiche de calcul no 6                                                     012A

                                               Changements de variable

                              Prérequis
                              Primitives, dérivées. Changements de variables. Intégration par parties.



Changements de variable

Calcul 6.1
Effectuer le changement de variable indiqué et en déduire la valeur de l’intégrale.
    ˆ 1p                                                      ˆ π2
a)         1 − t2 dt       avec t = sin θ                d)        sin3 t cos t dt                           avec u = sin t
      −1                                                                      0


..............................                                          ..............................
     ˆ 3                                                                     ˆ π2
                 1                                √
b)         √         √        dt       avec u =    t                    e)          sin3 t cos3 t dt         avec u = sin t
      1        t+        t3                                                   0


..............................                                          ..............................
     ˆ 1                                                                     ˆ 4
            1                                                                         1                                 √
c)             dt                      avec u = e   t
                                                                        f)             √ dt                  avec u =    t
      0    cht                                                                1     t+ t

..............................                                          ..............................


Calcul 6.2
Même exercice.
   ˆ π                                                                       ˆ 1
          sin t                                                                         1
a)                 dt                  avec u = cos t                   d)                     dt            avec t = tan u
    0  3 +  cos2 t                                                            0     (1 + t2 )2

..............................                                          ..............................
     ˆ 1                                                                     ˆ 2
              1                                                                           1                             1
b)                 dt                  avec u = et                      e)            √       dt             avec u =
      0    2 + e−t                                                            √
                                                                                  2 t   t 2−1                           t

..............................                                          ..............................
     ˆ 4                                                                     ˆ e2
                 1                                t                                    ln t
c)         √           dt              avec u =     −1                  f)                      dt           avec u = ln t
               4t − t2                            2
      2
                                                                              e     t + t ln2 t

..............................                                          ..............................




18                                                                                                     Fiche no 6. Changements de variable
```

---
## PAGE 025

```text
Changements de variable et intégrations par parties

Calcul 6.3
Effectuer le changement de variable indiqué, continuer avec une intégration par parties et en déduire la valeur
de l’intégrale.
     ˆ 4 √                                                   ˆ 4    √      
           t
                                    √                            ln t − 1                     √
a)       e dt              avec u = t                    b)          √       dt      avec u = t
      1                                                       3        t

....................                                            ....................



Calculs de primitives par changement de variable

Calcul 6.4
Déterminer une primitive de f en utilisant le changement de variable donné.
       i πh       cos x + sin x                                             1                                 √
a) x ∈ 0,    7−→            2
                                    avec u = tan x      d) x ∈ R∗+ 7−→       √                       avec u = 3 x
           2       sin x cos x                                          x+ 3x


....................                                            ....................
                    1                                                          1
b) x ∈ R 7−→                               avec u = ex
                                                                                                          p
                1 + th(x)                                       e) x > 1 7−→ √                 avec u =       x2 − 1
                                                                            x x2 − 1


....................                                            ....................
                 1                                    √
c) x ∈ R∗+ 7−→ √ x                         avec u =    ex − 1
                e −1


....................


                                                   Réponses mélangées
                                                                                         
      
          R∗+ → R                                               π     1 5        π        R    →    R
                          √                      2 arctan(e) −        ln                            x e−2x
            x 7→ 2 arctan ex − 1                                2     2 2        2        x    7→     −
                                                                                                     2   4
                                                 ]1, +∞[ → R
                                            
                       3                                                           1 π           π
                 2 ln       2e2                                      p
                                                                         2
                                                                                      +
                       2                                 x 7→ arctan x − 1         4     8      12
                                              ( i πh                                             
                    1       1         π            0,      → R                      1      2e + 1
                                                      2                               ln
                    4      12         6                 x 7→ tan x + ln tan(x)      2         3
                          ( ∗
                π             R+      →    R                      √          √              √       π
                √                          3      2          −2(( 3 − 1) ln( 3 − 1) − 4 + 2 3
               3 3             x      7→     ln(x + 1)
                                                  3                                                 2
                                           2

                                                                                       ▶ Réponses et corrigés page 69

Fiche no 6. Changements de variable                                                                                    19
```

---
## PAGE 026

```text
                                                                 Fiche de calcul no 7                                                              013A

                                        Intégration des fractions rationnelles

                             Prérequis
                             Fonctions ln et arctan. Division euclidienne entre polynômes.
                             Petites décompositions en éléments simples.
                             Forme canonique d’un trinôme du second degré.
                             Changements de variable affines dans les intégrales.


Cas élémentaires

Calcul 7.1 — Premier cas (I).
Calculer les intégrales suivantes.
    ˆ 2                                                                           ˆ 2
          1                                                                                   1
a)            dt . . . . . . . . . . . . . . . . . . . . . . .               b)                   dt . . . . . . . . . . . . . . . . . . . . . .
     1  t + 1                                                                      1       2t + 1


Calcul 7.2 — Premiers cas (II).
Soit a ∈ R∗+ . Calculer les intégrales suivantes.
    ˆ 1                                                                           ˆ a2
        16   1                                                                               1
a)         t   1 dt . . . . . . . . . . . . . . . . . . . . .                b)                 dt . . . . . . . . . . . . . . . . . . . . . .
      1
           2 + 4                                                                   0        t+a
        8



Calcul 7.3 — Deuxième cas.
Calculer les intégrales suivantes, en effectuant d’abord une division euclidienne entre le numérateur et le déno-
minateur des fractions en jeu.
    ˆ 2                                                        ˆ 1
        1 + t + t2                                                 2 1 + 2t + 3t2
a)                 dt . . . . . . . . . . . .              b)                     dt . . . . . . . . .
     1     1+t                                                   1      4t + 5
                                                                                   3



Calcul 7.4 — Troisième cas (I).
                                                                                                        ′
Dans ce troisième cas, il s’agit de reconnaître une expression du type uu .
Calculer les intégrales suivantes.
    ˆ 2                                                                           ˆ 1
          2t + 1                                                                       2        t
a)       2+t+1
                   dt . . . . . . . . . . . .                                b)             t2  1
                                                                                                            dt . . . . . . . . . . . . . .
     1  t                                                                          1
                                                                                            2 + 3
                                                                                   3



Calcul 7.5 — Troisième cas (II).
Soit a ∈ R∗+ . Calculer les intégrales suivantes.
    ˆ √2 t + √1                                                                   ˆ 1
                                                                                                    t
a)              √2 dt . . . . . . . . . . .                                  b)         2
                                                                                                              dt . . . . . . . . . . . . .
     1   t2 + 2t                                                                   √1 at + 1
                                                                                     a




20                                                                                               Fiche no 7. Intégration des fractions rationnelles
```

---
## PAGE 027

```text
Cas plus avancés

Calcul 7.6 — Exemple détaillé d’un calcul d’intégrale.

a) Quels sont les deux zéros de t 7−→ t2 − 3t + 2 ? . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

                                                                                                                                 1           A   B
b) Trouver deux réels A et B tels que, pour tout t ∈ R \ {1, 2}, on ait                                                                   =    +    .
                                                                                                                           (t − 1)(t − 2)   t−1 t−2

..........................................................................................

                  ˆ 4
                              2
c) Calculer                          dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                    3    t2 − 3t + 2

Calcul 7.7
Calculer les intégrales suivantes, en procédant comme ci-dessus.
    ˆ 1                                                      ˆ 1
           4                                                         1
a)       2
               dt . . . . . . . . . . . . . . . .         c)      2
                                                                            dt . . . . . . . . . . .
     0 t −4                                                    0 t + 4t + 3
     ˆ 3                                                                                                ˆ 1
              2                                                                                                3      1
b)          2
                dt . . . . . . . . . . . . . . . .                                               d)                           dt . . . . . . . . . . . . . .
       2   t −t                                                                                            0       4t2 − 1


Calcul 7.8
                                     ˆ a
                                               1
Soit a ∈ ]0, 1[. Calculer                          dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                       0    t2 − a

Cinquième cas

Calcul 7.9 — Une primitive à retenir.
Soit a ∈ R∗ .

                                                     1        x
a) Calculer la dérivée de x 7−→                        arctan     ............................................
                                                     a         a

                                                             1
b) Donner une primitive de x 7−→                                   ..............................................
                                                          a2 + x 2

Calcul 7.10
Calculer les intégrales suivantes.
    ˆ 1                                                                                                                   ˆ 2
           1                                                                                                                         1
a)       2
               dt . . . . . . . . .                                                              c) Calculer                                dt
     0 t +1                                                                                                                −1    t2 + 2
     ˆ 1
              1
b)                   dt . . . . . . . . .
       0   t2 + 3

Fiche no 7. Intégration des fractions rationnelles                                                                                                              21
```

---
## PAGE 028

```text
Synthèse

Calcul 7.11 — Mise sous forme canonique.
Soit a ∈ R∗ . Mettre sous forme canonique les expressions suivantes (où x ∈ R).

                                                                                                                √          1   √
a) x2 + x + 1 . . . . . . . . . . . . . . . . . .                                                        c)         2x2 + √ x + 2 . . . . . . . . .
                                                                                                                            2

b) 2x2 − 3x + 1 . . . . . . . . . . . . . . .                                                            d) ax2 + a2 x + a3 . . . . . . . . . . . . .


Calcul 7.12
Calculer les intégrales suivantes.
    ˆ 1                                                                                                         ˆ 1
              1                                                                                                                1
a)                   dt . . . . . . . . . . .                                                            c)                           dt . . . . . . . . . . . .
     0  1 + 2t  + t2                                                                                               0       1 − t + t2
     ˆ 0                                                                                                        ˆ 1
              1                                                                                                        4        1
b)                   dt . . . . . . . . . . . .                                                          d)                             dt . . . . . . . . .
       −1 1 + t + t2                                                                                               0       6t2 − 5t + 1

Calcul 7.13
Soit a > 1. Calculer les intégrales suivantes.
     ˆ 2
           3           1
a)                             dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        1
       −3        3t2 + 2t + 10
                             3

     ˆ 1
                          1
b)                                     dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
       0       t2 − (2a + 1)t + a2 + a

Calcul 7.14 — Un calcul plus difficile.
                ˆ 1
                         1
Calculer                      dt . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                  0    1 + t3


                                                Réponses mélangées
                                                                       2                  
          3        π          1            π           33               1       3       1     5        1         x
      ln                                   √        ln            x  +       +            ln              arctan
          2       12       a2 + x2        6 3          28           2  4              2     3   a             a
                      1 1                           9        1       a+1            2π             7          π
          1 et 2       ln        − ln(3)      2 ln              ln                   √        ln              √
                      4 5                     q 10        2a          2 √ 3        3           3         2 2
                                   1              √                   1         a−a              1    51 21
            A = −1 et B = 1                ln 2      2−1             √ ln         √           − +         ln
                                   2                                2 a        a+ a             48 64 19
                   2
                                                                                          a 2 3a3
                                              
                 3       1      1            π           3                                                  2π
          2 x−         −            ln(2) + √              + ln(3) − ln(2)        a x+         +              √
                 4  8          3             3          2                                2        4        3 3
                          a2                                                                    √          2 √ 15
                              
                                           4           4       1 3           π
     ln(a + 1)      ln 2              2 ln        2 ln           ln                 ln(2)         2 x + 14 + 2
                        a −1               3           3       2 2           4                                     16

                                                                                                                                                   ▶ Réponses et corrigés page 72

22                                                                                                                               Fiche no 7. Intégration des fractions rationnelles
```

---
## PAGE 029

```text
                                                 Fiche de calcul no 8                                     016A

                                      Trigonométrie et nombres complexes
Dans toute cette fiche, x désigne une quantité réelle.

Arc-moitié, arc-moyen

Calcul 8.1
Écrire sous forme trigonométrique (c’est-à-dire sous la forme reiθ , avec r > 0 et θ ∈ R) :
                π                                                               π
a) 1 + ei 6 . . . . . . . . . . . . . . .                    e) −1 − ei 6 . . . . . . . . . . . . .

                7π                                                          π
b) 1 + ei 6 . . . . . . . . . . . . . .                      f)   1 − ei 12 . . . . . . . . . . . . . .
                                                                            π
            π                                                      1 + ei 6
c) e−i 6 − 1 . . . . . . . . . . . . .                       g)           π  .............
                                                                   1 − ei 12
                π                                                            π   27
d) 1 + iei 3 . . . . . . . . . . . . . .                     h)     1 + ei 6           ..........


Calcul 8.2
Écrire sous forme trigonométrique (c’est-à-dire sous la forme reiθ , avec r > 0 et θ ∈ R) :
        π            π                                               π           π
a) ei 3 + ei 2 . . . . . . . . . . . .                       b) ei 3 − ei 2 . . . . . . . . . . . .



Linéarisations et délinéarisations

Calcul 8.3 — Linéarisations.
Linéariser :

a) cos3 (x) . . . . . . . . . . .                            d) cos(3x) sin3 (2x) . . .


b) cos(2x) sin2 (x) . . . .                                  e) cos3 (2x) cos(3x) . .


c) cos2 (2x) sin2 (x) . . .                                  f)   sin2 (4x) sin(3x) . . .


Calcul 8.4 — Délinéarisations.
Exprimer en fonction des puissances de cos(x) et de sin(x) :

a) cos(3x) . . . . . . . . . . . . . .                       b) sin(4x) . . . . . . . . . . . . . . .



Fiche no 8. Trigonométrie et nombres complexes                                                              23
```

---
## PAGE 030

```text
Factorisations

Calcul 8.5
Factoriser :

a) cos(x) + cos(3x) . . . . .                                                               c) cos(x) − cos(3x) . . . . .


b) sin(5x) − sin(3x) . . . . .                                                              d) sin(3x) + sin(5x) . . . . .


Calcul 8.6
Factoriser :

a) sin(x) + sin(2x) + sin(3x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) cos(x) + cos(3x) + cos(5x) + cos(7x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

                                   
                    2π             4π
c) cos(x) + cos x +      + cos x +      ........................................
                     3              3

Calculs d’intégrales

Calcul 8.7
Calculer :
    ˆ π                                                                                            ˆ π2
a)      ex sin(x) dx . . . . . . . . . . . . .                                              b)            e2x cos(x) dx . . . . . . . . . . .
        0                                                                                            0



                                                           Réponses mélangées
                       eπ + 1                 π iπ
                                                                                                    π  5π           1 π
              0                       2 cos         e 12        4 cos3 (x) − 3 cos(x)          2 cos      ei 12          (e − 2)
                           2                  12                                                     12                5
         sin(8x)                  π i 13π
                                                                                                      1               1         1
                           2 cos       e 12          4 cos3 (x) sin(x) − 4 cos(x) sin3 (x)           − cos(4x) + cos(2x) −
         2 sin(x)                 12                                                                   4           2            4
                       sin(9x)     3 sin(5x)      sin(3x)      3 sin(x)
                                                                                      π  11π
                                                                                            −i 24        sin 3x 2 sin(2x)
                    −            +             −           −                   2 sin       e
                                                                                                               sin x2
                                                                                                                      
                           8            8             8            8                   24
                                                                                                                 π π
                             5π 5iπ           1               3
                   2 cos         e 12           cos(3x) + cos(x)               2 sin(4x) cos(x)         227 cos27         ei 4
                             12               4               4                                                      12
                π
                  
          cos 12      13iπ        cos(9x)     3 cos(5x)      cos(3x)      3 cos(x)           1               1              1
                π e
                      24                  +              +            +                  − sin(11x) + sin(5x) + sin(3x)
          sin 24                     8             8              8           8              4               4              2
                                                                                                             π  −7iπ
                                 7π          5π
                      −2 cos             e−i 12        2 cos(4x) sin(x)           2 sin(x) sin(2x)        2 sin        e 12
                                 12                   π                                                         12
                                                                  π          1              1              3              1
                    2 cos(2x) cos(x)            2 sin        e−i 12       − cos(6x) + cos(4x) − cos(2x) +
                                                        12                   8              4              8              4

                                                                                                                                 ▶ Réponses et corrigés page 77

24                                                                                                             Fiche no 8. Trigonométrie et nombres complexes
```

---
## PAGE 031

```text
                                                                Fiche de calcul no 9                                                      0017A

                                                            Sommes et produits

Rappel
Si q est un nombre réel, si m, n ∈ N∗ et si m ⩽ n, on a :
                            n                                               n               n
                                                                                                       !2
                            X          (n − m + 1)(m + n)                   X
                                                                                  3
                                                                                            X                   n2 (n + 1)2
                        •           k=                                  •         k =              k        =
                                               2                                                                     4
                            k=m                                             k=1             k=1

                                                                                             n−m+1
                                                                                   qm 1 − q
                                                                                  
                            n                                               n
                            X                n(n + 1)(2n + 1)               X
                                                                               k                                              si q ̸= 1
                        •          k2 =                                 •     q =         1−q
                                                    6
                                                                                    n−m+1
                                                                                  
                            k=1                                           k=m                                                 sinon.

Dans toute la suite, n désigne un entier naturel non nul.

Calculs de sommes simples

Calcul 9.1
Calculer les sommes suivantes.
     n+2
     X                                                                            n
                                                                                  X
a)         n .......................                                         c)         (3k + n − 1) . . . . . . . . . . . . .
     k=1                                                                          k=1

     n+2                                                                          n−1
                                                                                  X                   
     X                                                                                      k−4
b)         7k . . . . . . . . . . . . . . . . . . . . . .                    d)                             ................
                                                                                             3
     k=2                                                                           k=2



Calcul 9.2
Même exercice.
     n
     X                                                                            n
                                                                                  X
a)         k(k + 1) . . . . . . . . . . . . . . . .                          d)          2k 5n−k . . . . . . . . . . . . . . . . .
     k=1                                                                          k=0

     n
     X                                                                            n
                                                                                  X
            4k(k 2 + 2)                                                                 (7k + 4k − n + 2) . . . . . . . .
                              
b)                                 ............                              e)
     k=0                                                                          k=1

     n−1
     X                                                                             1    2         n
c)         3k . . . . . . . . . . . . . . . . . . . . . .                    f)       + 2 + ··· + 2 ........
                                                                                   n2  n         n
     k=2



Calcul 9.3 — Produits (I).
Calculer les produits suivants, où p et q sont des entiers naturels non nuls tels que p ⩾ q.

     q
     Y                                                                             n
                                                                                   Y
a)         2 .................                                               b)          3k . . . . . . . . . . . . . . . .
     k=p                                                                          k=1




Fiche no 9. Sommes et produits                                                                                                               25
```

---
## PAGE 032

```text
Calcul 9.4 — Produits (II).
Même exercice.
     n
     Y  √                                                                                                10
                                                                                                         Y
a)     5 k × k ..........                                                                       b)                k ..............
     k=1                                                                                               k=−10




Avec des changements d’indice

Calcul 9.5
Calculer les sommes suivantes en effectuant le changement d’indice demandé.
     n
     X
a)         n+1−k              avec j = n + 1 − k . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
     k=1

     n
     X 1             1
b)             −                       avec j = n + 1 − k . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
           k       n+1−k
     k=1

     n
     X
c)         k2k     avec j = k − 1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
     k=1

     n+2
     X
d)         (k − 2)3       avec j = k − 2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
     k=3



Sommes et produits télescopiques

Calcul 9.6 — Sommes télescopiques.
Calculer les sommes suivantes.
     n+2                                                                                               n
     X                                                                                                 X         k
a)         (k + 1)3 − k 3 . . . . .                                                             c)                     ..........
                                                                                                              (k + 1)!
     k=2                                                                                               k=1

     n                                                                                               n
     X            1                                                                                    X
b)         ln 1 +     .......                                                                   d)           k × k! . . . . . . . . . . . .
                  k
     k=1                                                                                               k=1



Calcul 9.7 — Produits télescopiques.
Calculer les produits suivants.
     n                                                                                                 n                 
     Y k+1                                                                                             Y           1
a)                   ............                                                               c)              1−              .........
               k                                                                                                   k
     k=1                                                                                               k=2

     n                                                                                                 n                   
     Y 2k + 1                                                                                          Y           1
b)                     ...........                                                              d)              1− 2             ........
           2k − 3                                                                                                 k
     k=1                                                                                               k=2




26                                                                                                                                            Fiche no 9. Sommes et produits
```

---
## PAGE 033

```text
Autres sommes

Calcul 9.8 — À l’aide d’une décomposition en éléments simples.
Calculer les sommes suivantes.
     n                                                                  n
     X        1                                                         X           1
a)                  .........                                     b)                         ...
           k(k + 1)                                                           (k + 2)(k + 3)
     k=1                                                                k=0



Calcul 9.9 — Sommations par paquets.
Calculer les sommes suivantes.
     2n
     X                                                                  2n
                                                                        X
a)         (−1)k k 2 . . . . . . . . . .                          b)          min(k, n) . . . . . . . . .
     k=0                                                                k=0



Sommes doubles

Calcul 9.10
Calculer les sommes doubles suivantes.

      X                                                                    X
a)               j .............                                  d)                (i + j)2 . . . . . .
     1⩽i,j⩽n                                                            1⩽i⩽j⩽n


       X          i                                                       X
b)                  ............                                  e)                ln(ij ) . . . . . . . . .
                  j
     1⩽i⩽j⩽n                                                            1⩽i,j⩽n


       X                                                                  X
c)               (i + j) . . . . . . .                            f)                max(i, j) . . . . .
     1⩽i<j⩽n                                                            1⩽i,j⩽n




                                                    Réponses mélangées
                                                                                3                1          5n+1 − 2n+1
       2n2 + n                (n + 1)! − 1   n2n+1 + 2(1 − 2n )        5n (n!) 2           1−
                                                                                              (n + 1)!           3
               n(n + 1)                          n(n+1)      n(n + 3)                   n(3n + 1)      9 n−2
                        ln(n!)     1 − 4n2      3 2                                                      (3    − 1)
                  2                                              4                          2          2
             7(n + 1)(n + 4)      n(5n + 1)      n(n + 1)(n + 2)
                                                                       (n + 3)3 − 23       0     ln(n + 1)
                    2                 2                  3
                                           2       2
            n(n + 1)      1     1        n (n + 1)         n+1                   2
                                                                      n(n + 1)(7n + 13n + 4)             1
                            −                                                                    1−
                2         2 n+3               4             2n                  12                     n+1
                                                       (n − 2)(n − 7)                 n2 (n + 1)
                n(n + 1)(n2 + n + 4)     2q−p+1                            n+1                         0
                                                             6                             2
                                                                                                    2
             7 n                                     n(n + 1)(4n − 1)        1      n+1         n(n − 1)
               (7 − 1) + n(n + 4)      n(n + 2)
             6                                                6              n        2n             2

                                                                                                      ▶ Réponses et corrigés page 81

Fiche no 9. Sommes et produits                                                                                                    27
```

---
## PAGE 034

```text
                                                                                     Fiche de calcul no 10                                                                      020A

                                                                           Suites numériques

                                   Prérequis
                                   Suites récurrentes. Suites arithmétiques. Suites géométriques.



Suites explicites

Calcul 10.1
Soit la suite (un )n∈N définie par : ∀n ∈ N, un = 2n+3
                                                    5  × 2n+2 . Calculer, pour n ∈ N :


a) u0 . . . . . . . . . . . . . . . . . . . . . . . . . .                                                  c) un+1 . . . . . . . . . . . . . . . . . . . . . . .


b) u1 . . . . . . . . . . . . . . . . . . . . . . . . . .                                                  d) u3n . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 10.2
                                                                                                nn
                                                                                                  
Soit la suite (tn )n⩾1 définie par : ∀n ∈ N, tn = ln                                                 . Calculer, pour n ∈ N∗ :
                                                                                                2n


a) t2n . . . . . . . . . . . . . . . . . . . . . . . . .                                                   b) t4n . . . . . . . . . . . . . . . . . . . . . . . . .



Suites récurrentes

Calcul 10.3
On définit la suite (un )n∈N par : u0 = 1 et ∀n ∈ N, un+1 = 2un + 3. Calculer :


a) son troisième terme . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) u3 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 10.4
                                                                       √                                         √
On définit la suite (vn )n⩾1 par : v1 =                                    2 et ∀n ⩾ 1, vn+1 =                       vn . Calculer :


a) v3 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) son sixième terme . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

28                                                                                                                                                      Fiche no 10. Suites numériques
```

---
## PAGE 035

```text
Calcul 10.5
                                                                                                                    1 2
On définit la suite (wn )n∈N par : w0 = 2 et ∀n ∈ N, wn+1 =                                                          w . Calculer :
                                                                                                                    2 n

a) w2 . . . . . . . . . . . . . . . . . . . . . . . . .                                                      b) son centième terme . . . . . . . . .



Suites arithmétiques et géométriques

Calcul 10.6 — Suite arithmétique (I).
La suite (an )n∈N est la suite arithmétique de premier terme 1 et de raison 2.
Calculer :

a) a10 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                         c) a1 000 . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) s100 = a0 + a1 + . . . + a99 . . . . . . . . .                                                            d) s101 = a0 + a1 + . . . + a100 . . . . . . . .


Calcul 10.7 — Suite arithmétique (II).
                                                                                                                                                2          3
La suite (bn )n∈N est une suite arithmétique de raison r vérifiant que b101 =                                                                     et b103 = .
                                                                                                                                                3          4
Calculer :

a) b102 . . . . . . . . . . . . . . . . . . . . . . . .                                                      b) r . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 10.8 — Suite géométrique (I).
                                                                                                                                                       1
La suite (gn )n∈N est la suite géométrique de premier terme g0 = 3 et de raison                                                                          .
                                                                                                                                                       2
Calculer :

a) son dixième terme . . . . . . . . . . . . . . . .                                                         c) g10 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) σ10 = g0 + g1 + . . . + g9 . . . . . . . . . . .                                                          d) σ11 = g0 + g1 + . . . + g10 . . . . . . . . . .


Calcul 10.9 — Suite géométrique (II).
                                                                                                                                                      5π          11π
La suite (hn )n∈N est une suite géométrique de raison q > 0 vérifiant que h11 =                                                                          et h13 =     .
                                                                                                                                                      11           25
Calculer :

a) h12 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) q . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Fiche no 10. Suites numériques                                                                                                                                                        29
```

---
## PAGE 036

```text
Suites récurrentes sur deux rangs

Calcul 10.10
Soit la suite (un )n∈N définie par : u0 = 2, u1 = 1 et ∀n ∈ N, un+2 = un+1 + 6un .
Calculer, pour n ∈ N :

a) un . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) u5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 10.11
                                                                                       √
Soit la suite (vn )n∈N définie par : v0 = 0, v1 =                                          2 et ∀n ∈ N, vn+2 = 2vn+1 + vn .
Calculer, pour n ∈ N :

a) vn . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) v2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 10.12 — Suite de Fermat.
                                                                                               n
Soit la suite (Fn )n⩾0 définie par : ∀n ∈ N, Fn = 22 + 1.
Calculer, pour n ∈ N :

a) F3 . . . . . . . . . . . . . . . . . . . . . . . . . .                                                  d) Fn × (Fn − 2) . . . . . . . . . . . . . .


b) F4 . . . . . . . . . . . . . . . . . . . . . . . . . .                                                  e) Fn2 . . . . . . . . . . . . . . . . . . . . . . . . .


c) (Fn−1 − 1)2 + 1 . . . . . . . . . . . .                                                                 f)       2
                                                                                                                   Fn+1 − 2(Fn − 1)2 . . . . . . . . . .




                                                                                   Réponses mélangées
                                                                                         √                   √
                                                       1                         (1 +        2)n − (1 −          2)n
              257             10 201                2 64            8                                                           Fn             10 000          2       2n ln(n)
                                                                            n+3
                                                                                                 2                         √
                                                    (2n + 5) × 2                                                     π 5                                  n
                      21            211                                                        Fn+1 − 2                                    Fn+1 + 22 +1               Fn+2
                                                           5                                                           5
                                    √               3(2n + 1) × 23n+2                               1            3 069                 3                                 6 141
             65 537                2 2                                                                                                              3n + (−2)n
                                                             5 √                                   24             512                 512                                1 024
                     12                                       11 5                                        3                                           1         17
                                    29            2 001                                    2                                4n ln(2n)               28                   13
                     5                                         25                                       1 024                                                   24

                                                                                                                                                    ▶ Réponses et corrigés page 87

30                                                                                                                                                        Fiche no 10. Suites numériques
```

---
## PAGE 037

```text
                                                                   Fiche de calcul no 11                    021A

                                                  Développements limités

                     Prérequis
                     Il est nécessaire de connaître les développements des fonctions usuelles, ainsi
                     que la formule de Taylor-Young.


Les développements limités peuvent se donner « au sens faible » (avec les petits o(·)) ou « au sens fort » (avec
les grands O(·)). Volontairement, aucune de ces deux formes n’est imposée. Mais, pour des raisons de concision,
une seule d’entre elles est donnée dans les éléments de correction de chaque question.

Développements limités

Calcul 11.1 — Développements limités d’une somme ou d’un produit de fonctions.
Former le développement limité, à l’ordre indiqué et au voisinage de 0, des fonctions de la variable réelle x
définies par les expressions suivantes :


a) À l’ordre 4 :     sin(x) + 2 ln(1 + x) . . . . . . . . . . . . . . . . . . . . . . . . .


                      ln(1 + x)
b) À l’ordre 4 :                ...................................
                        1+x


c) À l’ordre 6 :     sin(x)(cosh(x) − 1) . . . . . . . . . . . . . . . . . . . . . . . . .



d) À l’ordre 6 :     ex sin(x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 11.2 — Développements limités d’une fonction composée (I).
Former le développement limité, à l’ordre et au voisinage indiqués, des fonctions de la variable réelle x définies
par les expressions suivantes :

                                            1
a) À l’ordre 4, en 0 :        (1 + x) x . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


                              p
b) À l’ordre 6, en 0 :         cos(x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


                                   ix
c) À l’ordre 3, en 0 :        ee        ...................................


                               ln(2 − x)
d) À l’ordre 2, en 1 :                   .............................
                                  x2


Fiche no 11. Développements limités                                                                            31
```

---
## PAGE 038

```text
Calcul 11.3 — Développements limités d’une fonction composée (II).
Former le développement limité, à l’ordre et au voisinage indiqués, des fonctions de la variable réelle x définies
par les expressions suivantes :

                         π
a) À l’ordre 2, en         :    sin(π cos(x)) . . . . . . . . . . . . . . . . . . . . . . . . .
                         3

                         π
b) À l’ordre 3, en         :    tan(x) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                         4

                         π
c) À l’ordre 7, en         :    cos(π sin(x)) . . . . . . . . . . . . . . . . . . . . . . . . .
                         2

Développements asymptotiques

Calcul 11.4
Former le développement asymptotique, à la précision et au voisinage indiqués, des fonctions de la variable
réelle x définies par les expressions suivantes :

                                                1              1
a) À la précision x2 , en 0 :                              −      ........................
                                         x(ex − 1)             x2

                        1                      sin(1/x)
b) À la précision          , en +∞ :                    ...........................
                        x5                       x+1

                        1
c) À la précision          , en +∞ :           x ln(x + 1) − (x + 1) ln(x) . . . . . . . . . .
                        x3
                                                             x2
                 ex
                                               
                                                   1
d) À la précision 2 , en +∞ :                        +1             .........................
                 x                                 x



                                                     Réponses mélangées
                                                                               ex      7ex
                                                                                                             x
                                   x3    x4
                                                                                            
                              2                       4          − 12    x                                    e
                      3x − x +        −     + o (x )           e        e +       −        2
                                                                                                 + o
                                  2     2    x→0                             3x 36x              x→+∞       x2
                                         5                                 3       11          25
                     e 1 + ix − x2 − ix3 + o (x3 )                    x − x2 + x3 − x4 + o (x4 )
                                         6          x→0                    2        6          12         x→0
                                                                                                                     
           1 2     1 4       19 6                                                                                               
                                                                      π              π 2 8              π 3                  π 4
                                                                                                     
                                              7
      1− x − x −                  x + O (x )            1+2 x−            +2 x−            +       x−         + Oπ      x−
           4      96       5 760        x→0                           4              4         3        4       x→ 4         4
                                                                                                                    
                               1      1      1                 1             1     1         5        5               1
              − ln(x) + 1 −       +      − 3+ o                                 − 3+ 4− 5+ O
                              2x 3x2        4x      x→+∞ x3                 x2     x       6x       6x       x→+∞ x6
                                                                  2                    2
                                                                                                                           
                   3         2                 2
                                                               π          π 4 π
                                                                                               π 6
                                                                                                                       π 7
           1 − x + (x − 1) + o (x − 1)                  −1 +           x−         −        x−          + oπ x −
                   2              x→1                            8          2        48          2         x→ 2         2
                           2                                                           3       5       6
                                                              
                        3π         π 2                π  2                       x       x      x
                                                                                2                                  6
                   1−          x−        + oπ x −                        x+x +           −        −      + o (x )
                         8          3      x→ 3          3                            3      30 90 x→0
        ex 11ex2        7ex3      2 447ex4                      x3      x5                           1       1      1 2
     e−     +        −          +           + O (x5 )                −      + o (x6 )             −      +      −     x + o (x2 )
         2      24       16         5 760      x→0               2      24 x→0                      2x 12 720               x→0


                                                                                                       ▶ Réponses et corrigés page 90

32                                                                                                     Fiche no 11. Développements limités
```

---
## PAGE 039

```text
                                                  Fiche de calcul no 12                        024A

                              Décomposition en éléments simples

                     Prérequis
                     Polynômes (factorisation, division euclidienne), primitives usuelles


Calculs de décompositions en éléments simples

Calcul 12.1 — Uniquement des pôles simples.
Effectuer la décomposition en éléments simples (sur C) des fractions rationnelles suivantes.

         X4 − 2
a)                   .........
     X(X + 1)(X + 2)

         X3 + 2
b)                   .........
     (X − 1)X(X + 1)

           X2
c)                  ...........
     (X − π)(X + π)

Calcul 12.2
Même exercice.
         X +1
a)                  ...........
     (X + 2)(X + e)

         X2 + X + 1
b)                         ....
     (X − i)(X + i)(X − 1)

         X2 + 2
c)       √      √   .......
     (X − 2)(X + 3)

Calcul 12.3 — Avec des pôles multiples.
Effectuer la décomposition en éléments simples (sur C) des fractions rationnelles suivantes.

              X +1
a)                           ..
     (X − 1)2 (X − 2)(X − 3)

           2 + X2
b)                       .......
     (X + 1)X 2 (X − 1)2

       1−X
c)             ...............
     X(X + π)2

               1
d)                         ......
     (X − i)2 (X − 1 − i)2

Fiche no 12. Décomposition en éléments simples                                                   33
```

---
## PAGE 040

```text
Calcul 12.4 — À vous de factoriser.
Effectuer la décomposition en éléments simples (sur C) des fractions rationnelles suivantes.


     X −3
a)          ....................
     X4 − 1

           2X 3 + 1
b)                             ..........
     X 4 − 3X 2 + 2X

Calcul 12.5 — Calculs de sommes.
Soit n ∈ N tel que n ⩾ 2.
Calculer les sommes suivantes, après avoir fait une décomposition en éléments simples de leur terme général.

     n
     X            1
a)                         ........
           (k − 1)k(k + 1)
     k=2

     n
     X          k 2 − 5k − 2
b)                                .
           (k − 1)k(k + 1)(k + 2)
     k=2


Calcul 12.6
Effectuer la décomposition en éléments simples sur R des fractions rationnelles suivantes.


         2X + 4
a)                      ...............
     (X + 1)2 (X 2 + 1)

                 3
b)                               ....
     (X − 1)(X + 1)(X 2 + X + 1)



Calcul d’intégrales de fractions rationnelles

Calcul 12.7 — Avec des pôles (simples ou multiples).
Calculer les intégrales suivantes :

     ˆ 1/2                                                     ˆ 2
               x2 + 1                                                       x
a)                        dx . . . . .                    d)                          dx . . . . .
      −1/2 (x − 1)(x + 1)                                       1    (2x + 1)(x + 2)2
     ˆ 1                                                       ˆ 1/2
                     x                                                    1
b)                               dx                       e)                   dx . . . . . . . . . . . .
      0    (x + 1)(x + 2)(x − 2)                                0      4x2 + 1
     ˆ 2                                                       ˆ 3
                1                                                      x
c)                     dx . . . . . . . . . . .           f)                dx . . . . . . . . . . . . . . .
      1    x2 (x + 1)2                                          2    x4 − 1



34                                                                         Fiche no 12. Décomposition en éléments simples
```

---
## PAGE 041

```text
Calcul 12.8 — Primitives.
Déterminer une primitive de chacune des fonctions suivantes.

                1
a) x 7−→               ..................................................
             x2 − 1

                 1
b) x 7−→               ...............................................
             (1 − 2x)3

                1
c) x 7−→               ..................................................
             x2 + 2

                 1
d) x 7−→                ..............................................
             x2 + x + 1

                  x
e) x 7−→                 ............................................
             x2 + 2x + 3

                      x4
f)   x 7−→                         ...................................
             (x − 1)(x − 2)(x + 1)

                    x
g) x 7−→                     .........................................
             (x2 + 2)(x + 1)

                  x−2
h) x 7−→                       ........................................
             (x + 1)2 (x − 1)2


                                                          Réponses mélangées
      1    x−1               2         1            3                     −3         1          2          1
        ln              1−     +             +                   2              +         +         +
      2    1+x               X     2(X + 1) 2(X − 1)                     X − 2 X − 3 X − 1 (X − 1)2
              e−1                   1                     1 2x − 1 1        1−x               1         1    1
                          +                       x 7−→               + ln                         −      +
         (e − 2)(X + e) (2 − e)(X + 2)                    2 x2 − 1 2        1+x          2(n + 1) 2n 4
      2          1         1 − 2X                          2                                    π             π
           +             + 2             1 − 2 ln(3)         − 4 ln(2) + 2 ln(3)       1+              −
    X + 1 (X + 1)2         X +1                            3                               2(X − π) 2(X + π)
             1          5            2            1                1          1        1 + 3i      1 − 3i
                +             +            +            .              −           −            −
            2X     6(X + 2) 3(X − 1) (X − 1)2                  X +1       2(X − 1)    4(X − i)    4(X + i)
                             1        1         7              1             3           X −1
                   X −3−        +         +                            −           +
                             X     X +1 X +2               2(X − 1) 2(X + 1) X 2 + X + 1
             2        1          2           1             1     1          2            1          1
            X−i + (X−i)2 − X−(1+i) + (X−(1+i))2           18 9
                                                              − ln(5) + ln(2)
                                                                            9            2
                                                                                           ln(2) − ln(3)
                                                                                                    4
    3          1+i          1−i              2       1    1        π         1         2                         1
           −            −                −        + −                      − ln(3) + ln(2)          x 7−→
 2(X − 1) 4(X   − i)  4(X + i)           n
                                            +  2    n    3
                                                                   8        2         3                    4(1 −  2x)2
        1            x           2            2        1                        5                     4
       √ arctan √               √ arctan √ X + √                   1− √      √        √ − √        √ √
         2            2           3            3  3                  ( 2 + 3)(X + 3)       ( 2 + 3)( 2 − X)
                                                     √                        2   2      11          3          3
             x 7−→ 61 ln(x2 + 2) − 13 ln |x + 1| +   3
                                                      2
                                                        arctan   x
                                                                 √              + 2 −          +           +
                                                                  2           X  X    4(X − 1)   2(X − 1)2   4(X + 1)
                    x2
                                                                                  1             1               1+π
                     2
                       + 2x + 16 ln |x + 1| − 12 ln |x − 1| + 16
                                                               3
                                                                 ln |x − 2|             −                 −
                                                                                 π2 X       π 2 (X + π)       π(X + π)2

                                                                                                     ▶ Réponses et corrigés page 94

Fiche no 12. Décomposition en éléments simples                                                                                   35
```

---
## PAGE 042

```text
                                               Fiche de calcul no 13                                       025A

                                             Calcul matriciel

                   Prérequis
                   Calculs algébriques (sommes), coefficients binomiaux.



Calcul matriciel

Calcul 13.1 — Calculs de produits matriciels.
Dans cet exercice, on note A, B, C, D, E les cinq matrices suivantes :
                                                   
                                         1 −1 0                        
                                   A = 0 2 1, B = 1 7 −2 ,
                                         3 −1 2
                                                                          
                                                                      1
                                   2 1 −1 0                2 1
                            C=                    , D=           , E =  2 .
                                   1 1 1 1                 1 2
                                                                          −1

Calculer les produits matriciels suivants.




a) A2 . . .                            d) E × B                            g) D2 . . .




b) A3 . . .                            e) A × E                            h) D × C




c) B × E                               f)    B×A                           i) B ⊤ ×B




36                                                                                  Fiche no 13. Calcul matriciel
```

---
## PAGE 043

```text
Calcul 13.2 — Calcul de puissances.
                                                                                                                            
On note                                                                                                   1 ··· 1
                                     1    1               2    1               cos(θ)    − sin(θ)
                         A=                  ,   B=               ,   C=                          ,        D =  ... (1) ... ,
                                                                                                                            
                                     0    1               0    3               sin(θ)     cos(θ)
                                                                                                                1 ··· 1
la matrice D étant de taille n × n (où n ∈ N∗ ), et où θ ∈ R.
Calculer le carré, le cube de chacune de ces matrices et utiliser ces calculs pour conjecturer leur puissance
k-ième, pour k ∈ N.




a) A2 . . .                                               e) B 3 . . .                                       i)    Ck . . .




b) A3 . . .                                               f)   Bk . . .                                      j)    D2 . . .




c) Ak . . .                                               g) C 2 . . .                                       k) D3 . . .




d) B 2 . . .                                              h) C 3 . . .                                       l)    Dk . . .



Calcul 13.3 — Calculs avec des sommes.
Soit n ∈ N∗ . On note A = (aij )1⩽i,j⩽n , B = (bij )1⩽i,j⩽n et C = (cij )1⩽i,j⩽n les matrices de termes généraux
suivants :
                                   i−1
                                       
                           aij = j−1     ,   bij = 2i 3j−i ,    cij = δi,j+1 + δi,j−1 .
Donner le coefficient d’indice (i, j) des matrices suivantes.
                                                          P On simplifiera au maximum le résultat obtenu et,
notamment, on trouvera une expression sans le symbole .
On rappelle que ji = 0 quand j > i.
                   



a) A × B . . . . . . . . . . . . . . .                                            c) B ⊤ × B . . . . . . . . . . . . . .



b) B 2 . . . . . . . . . . . . . . . . . . .                                      d) A × C . . . . . . . . . . . . . . .


Fiche no 13. Calcul matriciel                                                                                                     37
```

---
## PAGE 044

```text
Calcul 13.4 — Deux calculs plus difficiles.
Soient n ∈ N∗ et (i, j) ∈ J1, nK2 .
En utilisant les matrices de l’exercice précédent, calculer les termes généraux suivants.

      2                                                        2
a)    A i,j . . . . . . . . . . . . . . .                  b)    C i,j . . . . . . . . . . . . . . .



Inversion de matrices

Calcul 13.5 — Détermination d’inversibilité, calcul d’inverses.
Dans cet exercice, on note les matrices suivantes :                     
                                                          −1 0
                                                                         1
                                π e               1+i    2−i
                          A=           , B=                   2 1,
                                                              ,      C = 0
                                 2 2                i     −i
                                                             −1 2         3
                                                                
                              π   π 2π         1 0 2           0 2 1
                         D= π    0  0 , E = 2 1 −3, F = 2 0 1,
                             −π −2π 0          4 2 2           1 2 0
                                                                   
                        1 0 1 −1         1 0    2 3          1   1 −1 −1
                       2 1 3 −1
                                                    , J = −1 1
                                       2 2     1 4                1 1
                       1 1 1 1 , H = 7 2
                     G=              
                                                           −1 −1 −1 1 .
                                                                        
                                                2 9
                        0 2 3 −1         1 −1 −1 −1         −1 −1 −1 −1

Déterminer, si elle existe, l’inverse de chacune des matrices. Si elle n’est pas inversible, indiquer dans la case
« non inversible ».




a) A . . .                                  d) D . . .                                  g) G . . .




b) B . . .                                  e) E . . .                                  h) H . .




c) C . . .                                  f)   F ...                                  i)    J ...



38                                                                                                     Fiche no 13. Calcul matriciel
```

---
## PAGE 045

```text
Calcul 13.6 — Matrices dépendant d’un paramètre.
Soit λ un paramètre réel. On note A et B les deux matrices suivantes :
                                                                      
                                      λ    1 1                 1 1     1
                              A = −1 −1 2,           B = λ 1 λ − 1.
                                      λ    1 2                 1 λ     1

Pour chaque matrice, donner une condition nécessaire et suffisante (abrégée ci-dessous en CNS) sur λ pour que
la matrice soit inversible et en donner, dans ce cas, l’inverse.



a) CNS pour que A soit inversible . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .




b) Inverse de A . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .




c) CNS pour que B soit inversible . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .




d) Inverse de B . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .




Fiche no 13. Calcul matriciel                                                                                                             39
```

---
## PAGE 046

```text
                                                   Réponses mélangées
                                         2
                                              · · · n2
                                                                               
                                         n                           n ··· n                                    
                                         ..           .              .        .            k−1            1 3
                Non inversible !             (n ) ..               .. (n) ..           n     D
                                                 2
                                                                               
                                        .                                                                 0 1
                                         2              2
                                        n · · · n                   n ··· n
                                                                
                                                0 4          0                                       k
                                                                                                      2 3k − 2 k
                                                                                                                  
              cos(kθ) − sin(kθ)            1 
                                                0 −2 −2                17 (matrice 1 × 1)
              sin(kθ) cos(kθ)            4π                                                            0       3k
                                               2
                                                    −1      1
                                1    7 −2                            
                  1 2                                             i−1             (1 − δi,1 )(δi−1,j+1 + δi,j )
                              2      14 −4              2i−j
                  0 1                                            j−1            +(1 − δi,n )(δi,j + δi+1,j−1 )
                                 −1 −7  2                                                   
                                          −1                             1      7      −2                    
                   1       2 −e                              1 k                                           8 19
                                          3                             7       49 −14
               2(π − e) −2 π                                 0 1                                           0 27
                                       −1                             −2 −14             4
           −2 −6 −5                          −4       −1          3                                                 
          15 −1 11                 1                                          4 5             cos(3θ) − sin(3θ)
                                           2λ + 2 λ −2λ − 1
                                    1−λ                                          0 9              sin(3θ) cos(3θ)
           18 −26 −1                        λ−1        0        1−λ
                                                                      
                                             0 −1 0 −1                                                       
                     5    2 −1                                                                  −2 2          2
                1                       1  1        1       0     0                     1
                     3    2 −1                                              λ ̸= 1           1 −1 2 
                2                        2 −1 0 −1 0                                      6
                   −6 −2 2                                                                       4      2 −4
                                               0      0       1 −1
                                                                            
                                                        4 −2 2             0                                            
       i+1 j−i n
                                                  1   8     −6     4     2                        cos(2θ) − sin(2θ)
     2 3 (2 − 1)              −5 15 3                                               λ ̸
                                                                                        =  1
                                                   2 −7 5 −3 −1                                     sin(2θ) cos(2θ)
                                                       −5 3 −1 −1
             −1 − λ + λ2 1 − λ 2 − λ
                                                                        
                                                            8      4 −2                                           n 
        1                                           1                               5 4                              2
                    1          0      −1              −16 −6 7                                   2 × 3i+j 1 −
     1−λ                                             8                               4 5                              3
                 1 − λ2     λ − 1 λ − 1
                                                            0     −2 1
                            1 −3 −1                                                                                
       5 3 −1 1                                                              1 1 −1 − 2i                  i−1         i−1
                            3 3        4           2 × 3j−i × 5i−1                                              +
       4 3 1 2                                                               3 1 −1 + i                     j         j−2
                              9 −7 3

                                                                                            ▶ Réponses et corrigés page 99




40                                                                                                 Fiche no 13. Calcul matriciel
```

---
## PAGE 047

```text
                                                                    Fiche de calcul no 14                                                                    026A

                                                               Algèbre linéaire

                            Prérequis
                            Coordonnées. Applications linéaires. Matrices. Rang.


Vecteurs

Calcul 14.1
Dans chacun des cas suivants, déterminer les coordonnées du vecteur u dans la base B.


a) u = (1, 1), B = (0, 1), (−1, 2) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                  



b) u = (1, 1), B = (−1, 2), (0, 1) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                  



c) u = (3, 4), B = (1, 2), (12, 13) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                   



d) u = (1, 2, 1), B = (0, 1, 3), (4, 5, 6), (−1, 0, 1) . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                      



e) u = (−1, 0, 1), B = (1, 0, 1), (1, 1, 1), (−1, −1, 3)
                                                                              
                                                                                  .......................


      u = X 3 + X 2 , B = 1, X, X(X − 1), X(X − 1)(X − 2) . . . . . . . . . . . . . . . . .
                                                         
f)

                    π
g) u : x 7−→ cos x +    , B = (cos, sin) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                     3

Calculs de rangs

Calcul 14.2 — Sans calcul.
Déterminer le rang des matrices suivantes :
                                                                                                            
                                                                                        1         2      3
     1 4
a)          ...........................                                               d) 4         5      9  .....................
     3 1
                                                                                        6         7     13
     1 4 1 4                                                                                         
   2 8 2 8                                                                              1         2
b) 
   2 8 2 8  . . . . . . . . . . . . . . . . .
                                                                                     e) 3         4 . . . . . . . . . . . . . . . . . . . . . . . . . .
     5 20 5 20                                                                            4         6
                                                                                                           
                                                                                        1         ··· 1
     1 2 3 4                                                                              ..             .
                                                                                                    ..
c) 2 4 6 8  . . . . . . . . . . . . . . . . . .                                     f)  .           . ..  ∈ Mn (R) . . . . . . . . . . .
     3 6 9 12                                                                                  1    ···     1

Fiche no 14. Algèbre linéaire                                                                                                                                  41
```

---
## PAGE 048

```text
Calcul 14.3
Déterminer le rang des matrices suivantes :
                                                                     
      3    2     1                                           1     2  1
a) −4 −3 −1 . . . . . . . . . . . . . . . . .          c) 0     2  4 . . . . . . . . . . . . . . . . . . . . . . .
     −4 −2 −2                                                1     1  2
                                                                                   
                                                           1     −1 2         3
         cos θ   − sin θ                                    2      1 −1 2 
b)                             ..................        d)                         ..............
         sin θ    cos θ                                     
                                                             4      2    1 −1
                                                             1      4    2      1

Matrices et applications linéaires

Calcul 14.4 — Matrices d’endomorphismes.
Pour les applications linéaires f et les bases B suivantes, déterminer la matrice de f dans la base B.
a) f : (x, y) 7−→ (x + y, 3x − 5y)                       d) f : (x, y, z) 7−→ (x + y, 3x − z, y)
B = (1, 0), (0, 1)                                       B = (1, 0, 0), (0, 1, 0), (1, 1, 1)
                                                                                            




..........................                                ..........................


b) f : (x, y) 7−→ (x + y, 3x − 5y)                       e) f : P 7−→ P (X + 2)
B = (0, 1), (1, 0)                                       B = (1, X, X 2 )
                  




..........................                                ..........................


c) f : (x, y) 7−→ (2x + y, x − y)
B = (1, 2), (3, 4)
                  




..........................




42                                                                                                 Fiche no 14. Algèbre linéaire
```

---
## PAGE 049

```text
Calcul 14.5 — Matrices d’applications linéaires.
Pour les applications linéaires f et les bases B, B ′ suivantes, déterminer la matrice de f de la base B dans la
base B ′ .
a) f : (x, y, z) 7−→ (x + y + z, x − y)
B = (0, 1, 3), (4, 5, 6), (−1, 0, 1) et B ′ = (0, 1), (1, 0)
                                                           




....................................................................................


b) f : P 7−→ P ′
B = (1, X, X 2 ) et B ′ = (1, X, X 2 , X 3 )




....................................................................................




                                                         Réponses mélangées
                                                                                                   
                                          √                                            1     2     4                           
                                                                                                                        1     1
         (−1, 1/2, 1/2)             (1/2, − 3/2)         (9/11, 2/11)         4       0     1     4       1
                                                                                                                        3    −5
                                                                                     0     0     1
                                                       0      1   0                         
                                    −1   −1       1     0      0   2        1 −19        −43
              (3, −1)                                                                                 (0, 2, 4, 1)        3
                                    4    15       0     0      0   0        2 9           21
                                                         0      0   0
                                                                                                                                     
                                                                                                                       1       0   1
                                                                                      −5    3
  (−2, 4/5, 11/5)         1          2        2       (−1, 3)       2     2                             1       2       3      −1   1
                                                                                      1     1
                                                                                                                         0       1   1

                                                                                                   ▶ Réponses et corrigés page 104

Fiche no 14. Algèbre linéaire                                                                                                             43
```

---
## PAGE 050

```text
                                                                            Fiche de calcul no 15                                                                       0027A

                                                          Équations différentielles


Équations d’ordre 1 à coefficients constants

Calcul 15.1
Déterminer les solutions des problèmes de Cauchy suivants :

a) y ′ = 12y      et     y(0) = 56 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) y ′ = y + 1      et        y(0) = 5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


c) y ′ = 3y + 5         et      y(0) = 1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


d) y ′ = 2y + 12         et        y(0) = 3 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 15.2
Déterminer les solutions des problèmes de Cauchy suivants :

a) 5y ′ = −y       et        y(1) = e . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) 7y ′ + 2y = 2         et        y(7) = −1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

           √
c) y ′ −       5y = 6    et         y(0) = π . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


d) y ′ = πy + 2e         et        y(π) = 12 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


Équations d’ordre 2, homogènes, à coefficients constants

Calcul 15.3 — Une équation avec conditions initiales (I).
Déterminer les solutions des problèmes de Cauchy suivants :

a) y ′′ − 3y ′ + 2y = 0             et      y(0) = 1           et      y ′ (0) = 2 . . . . . . . . . . . . . . . . . . . . . . . . .


b) y ′′ − 3y ′ + 2y = 0             et      y(0) = 1           et      y ′ (0) = 1 . . . . . . . . . . . . . . . . . . . . . . . . .




44                                                                                                                                        Fiche no 15. Équations différentielles
```

---
## PAGE 051

```text
Calcul 15.4 — Une équation avec conditions initiales (II).
Déterminer les solutions des problèmes de Cauchy suivants :

a) y ′′ − 3y ′ + 2y = 0        et     y(0) = 1        et      y ′ (0) = 3 . . . . . . . . . . . . . . . . . . . . . . . . .


b) y ′′ − 3y ′ + 2y = 0        et     y(0) = 1        et      y ′ (0) = 3i . . . . . . . . . . . . . . . . . . . . . . . .


Calcul 15.5 — Racines doubles, racines simples.
Déterminer les solutions des problèmes de Cauchy suivants :

a) y ′′ − y = 0     et    y(0) = 1       et      y ′ (0) = 1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) y ′′ + 3y ′ + 2y = 0        et     y(0) = 2        et      y ′ (0) = 3 . . . . . . . . . . . . . . . . . . . . . . . . .


c) y ′′ + y ′ − 2y = 0     et        y(0) = 1      et       y ′ (0) = 2 . . . . . . . . . . . . . . . . . . . . . . . . . .


d) y ′′ − 2y ′ + y = 0     et        y(0) = 2      et       y ′ (0) = 1 . . . . . . . . . . . . . . . . . . . . . . . . . .


e) y ′′ + 4y ′ + 4y = 0        et     y(1) = 1        et      y ′ (1) = −3 . . . . . . . . . . . . . . . . . . . . . . .


Calcul 15.6 — Racines complexes.
Déterminer les solutions des problèmes de Cauchy suivants :

a) y ′′ + y = 0     et    y(0) = 1       et      y ′ (0) = 2 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .


b) y ′′ + y ′ + y = 0     et        y(0) = 1     et        y ′ (0) = −1 . . . . . . . . . . . . . . . . . . . . . . . . .


c) y ′′ + 2y ′ + 2y = 0        et     y(0) = 0        et      y ′ (0) = 1 . . . . . . . . . . . . . . . . . . . . . . . . .


d) y ′′ − 2y ′ + 5y = 0        et     y(0) = i      et       y ′ (0) = −i . . . . . . . . . . . . . . . . . . . . . . . .

                                                                 Réponses mélangées
                      √                    √
                                                                           8e3x − 5
                                                   
                  3x     1        3x
 x 7−→ e−x/2 cos      − √ sin              x 7−→ cos x + 2 sin x     x 7−→              x 7−→ (2 − x)e2−2x
                 2      3      2                                             3
                 2e πx−π2 2e
      x 7−→ 12 +      e     −          x 7−→ e(6−x)/5      x 7−→ e2x      x 7−→ ex     x 7−→ (2 − x)ex
                 π              π                                                          √
            4 x 1 −2x                −x     −2x                2x   x               6               6
      x 7−→ e − e           x 7−→ 7e − 5e             x 7−→ 2e − e         x 7−→ √ + π e 5x − √
            3    3                                                                   5               5
               x 7−→ 56e12x             x 7−→ 9e2x − 6      x 7−→ 6ex − 1                                   x 7−→ (2 − 3i)ex + (3i − 1)e2x
                                                                       
                                                  −1 + i 2ix 1 + i −2ix
         x 7−→ e−x sin(x)              x 7−→ ex         e +        e                                         x 7−→ ex             x 7−→ 1 − 2e−2x/7+2
                                                    2           2

                                                                                                                               ▶ Réponses et corrigés page 107

Fiche no 15. Équations différentielles                                                                                                                      45
```

---
## PAGE 052

```text
                                                                   Fiche de calcul no 16                                                  028A

                                                                 Séries numériques

                               Prérequis
                               Séries usuelles (convergence et sommes), décomposition en éléments simples.



Séries géométriques, exponentielles, de Riemann

Dans les calculs de cette section, reconnaître chacune des séries suivantes, dire si elle converge, et le cas échéant
donner sa somme.

Calcul 16.1 — Des séries géométriques (I).
     X                                                                              X  1 k
a)         2k . . . . . . . . . . . . . . . . . . . . . .                      c)       √    .................
     k⩾0                                                                            k⩾0
                                                                                          2

     X 1                                                                            X 1
b)               ......................                                        d)        .....................
           2k                                                                         3k
     k⩾0                                                                            k⩾10



Calcul 16.2 — Des séries exponentielles.
     X 1                                                                            X        1
a)               ......................                                        c)                    .................
           k!                                                                              2k × k!
     k⩾0                                                                            k⩾0

     X 2k
b)               ......................
           k!
     k⩾2



Calcul 16.3 — Des séries de Riemann.
     X 1                                                         X 1                                        X1
a)                ......                                    b)       √ .....                           c)             .......
           k2                                                         k                                           k
     k⩾1                                                         k⩾3                                        k⩾6



Calcul 16.4 — Des séries géométriques (II).
     X 1                                                                            X ik
a)        .....................                                                c)         ...................
      22k                                                                            7k−1
     k⩾2                                                                            k⩾3

     X                                                                              X        1
b)         e−(k−1) . . . . . . . . . . . . . . . . .                           d)             √ k .............
     k⩾1                                                                            k⩾4 (1 − i 2)




46                                                                                                                Fiche no 16. Séries numériques
```

---
## PAGE 053

```text
Séries télescopiques

Calcul 16.5
Prouver la convergence et calculer la somme de chacune des séries suivantes :
   X 1                                                             X  k2 
a)            . . . . . . . . . . . . . . . . . . . . . . . . . c)  ln 2      ...................
       k2 + k                                                          k −1
     k⩾1                                                                              k⩾2
                                                                                                                                  
     X            1                                                                   X                      (k + 2) − (k + 1)
b)                         ..................                                   d)             arctan                                  ...
           k 3 + 3k 2 + 2k                                                                                  1 + (k + 2)(k + 1)
     k⩾1                                                                              k⩾0


Séries géométriques dérivées

                             Prérequis
                             On pourra utiliser le fait que, si α ∈] − 1, 1[, les séries
                                                         X                  X
                                                               kαk−1   et         k(k − 1)αk−2 ,
                                                         k⩾1                k⩾2

                             appelées séries géométriques dérivées, convergent et ont pour somme
                                         +∞                                     +∞
                                         X                   1                  X                                   2
                                               kαk−1 =                 et             k(k − 1)αk−2 =                     .
                                                         (1 − α)2                                               (1 − α)3
                                         k=1                                    k=2




Calcul 16.6 — Des séries géométriques dérivées (I).
Reconnaître chacune des séries suivantes, dire si elle converge, et le cas échéant calculer sa somme.
     X                                                                                X           1
a)         k2k . . . . . . . . . . . . . .                                      b)             k k−1 . . . . . . . . . . .
                                                                                                2
     k⩾1                                                                              k⩾0



Calcul 16.7 — Des séries géométriques dérivées (II).
Reconnaître chacune des séries suivantes, dire si elle converge, et le cas échéant calculer sa somme.
     X                                                                                X                 1
a)         k2−k . . . . . . . . . . . . .                                       b)             (3k + 1) k . . . . . . .
                                                                                                       3
     k⩾1                                                                              k⩾1

     X               1                                                                X
c)         k(k − 1) k−2 . . . . . . . .                                         d)             k(k − 1)e−(k−2) . . . . . .
                   2
     k⩾1                                                                              k⩾2


                                                                Réponses mélangées
                                                                            1
                       Divergente               Divergente     2    e2                Divergente                  ln(2)      e         4
                                                    √
                          1                  −2 − 5 2i                                    2e   3
                                                                                                                     π   2         √
                                                           Divergente                              3        2                 2+       2
                        2 × 39                   54                                  (e − 1)                         6
                           1 − 7i               1      π     11      1                                                        e
                                                                                      1            16           e2 − 3
                             350               12      4      4      4                                                       e−1

                                                                                                                    ▶ Réponses et corrigés page 111

Fiche no 16. Séries numériques                                                                                                                   47
```

---
## PAGE 054

```text

```

---
## PAGE 055

```text
Réponses et corrigés
```

---
## PAGE 056

```text
50   Réponses et corrigés
```

---
## PAGE 057

```text
Fiche no 1. Trigonométrie

             Réponses

1.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 0                                π                 π
                                                                                                                          n                             o     n                         o
                                                                                                 1.8 a) . . . . . .             + 2kπ, k ∈ Z ∪ − + 2kπ, k ∈ Z
                                                                                                                              3                 3
1.1 b). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 0
                                                                                                 1.8 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {4π/3, 5π/3}
                                                                                         1
1.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −
                                                                                         2                                                                            
                                                                                                                                                                        −2π −π
                                                                                                                                                                                
                                                                                       √         1.8 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         ,
                                                                                                                                                                         3    3
1.1 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −1 − 3
                                                                                                                              4π                                      5π
                                                                                                                          n                               o       n                     o
1.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 0   1.8 b) . . . . .                + 2kπ, k ∈ Z ∪                          + 2kπ, k ∈ Z
                                                                                                                               3                                       3
1.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − sin x
                                                                                                 1.8 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {7π/6, 11π/6}
1.2 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos x
                                                                                                                                                                               
                                                                                                                                                                         5π π
1.2 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −2 cos x          1.8 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   − ,−
                                                                                                                                                                          6   6
                                                                               √     √
                                                                                 6− 2
1.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                7π                                      11π
                                                                                                                      n                               o       n                        o
                                                                                   4             1.8 c) . . . .              + 2kπ, k ∈ Z ∪                           + 2kπ, k ∈ Z
                                                                                                                           6                                       6
                                                                               √     √
                                                                                 2+ 6            1.8 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {3π/4, 7π/4}
1.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                   4
                                                                               √     √           1.8 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {−π/4, 3π/4}
                                                                                 6− 2
1.3 c). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                                                   
                                                                                   4                                                                            3π
                                                                                                 1.8 d) . . . . . . . . . . . . . . . . . . . . . . . .            + kπ, k ∈ Z
                                                                                     √                                                                           4
1.3 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 − 3
1.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − sin x         1.8 e) . . . . . . . . . . . . . . . . . . . . . {π/4, 3π/4, 5π/4, 7π/4}
                                                                                                                                                                      
                                                                                       1                                                                   3π π π 3π
1.4 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .               1.8 e) . . . . . . . . . . . . . . . . . . . . . . . .   − ,− , ,
                                                                                     cos x                                                                  4  4 4 4

1.5 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 0                                                                    nππ     o
                                                                                                 1.8 e) . . . . . . . . . . . . . . . . . . . . . . . . . .     + k ,k ∈ Z
                                                                                                                                                            4       2
1.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . 4 cos3 x − 3 cos x                                                                                           
                                                                               √                                                                            π 5π 7π 11π
                                                                                                 1.8 f) . . . . . . . . . . . . . . . . . . . . . . . . .     ,    ,  ,
                                                                           p
                                                                            2+ 2                                                                            6 6 6       6
1.6 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                             2                                                                                                        
                                                                               √                                                                                      5π π π 5π
                                                                           p
                                                                            2− 2                 1.8 f) . . . . . . . . . . . . . . . . . . . . . . .             −      ,− , ,
1.6 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                                             6   6 6 6
                                                                             2
                                                                                                                                  π                                   5π
                                                                                                                              n                           o       n                    o
1.7 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . tan x       1.8 f) . . . . . . . .             + kπ, k ∈ Z ∪                        + kπ, k ∈ Z
                                                                                                                                  6                                    6
1.7 b). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2                                                             
                                                                                                                                                              π 11π 13π 23π
                                                                                                                                                                                       
                                                                                                 1.8 g) . . . . . . . . . . . . . . . . . . . . . .             ,  ,   ,
1.7 c) . . . . . . . . . . . . . . . . . . . . . . . 8 cos4 x − 8 cos2 x + 1                                                                                  12 12 12 12
                                                                                                                                                                                      
1.8 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {π/3, 5π/3}                                                                        11π   π π 11π
                                                                                                 1.8 g) . . . . . . . . . . . . . . . . . . . .         −     ,− , ,
                                                                           n π πo                                                                          12   12 12 12
1.8 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .  − ,
                                                                             3 3


Réponses et corrigés                                                                                                                                                                    51
```

---
## PAGE 058

```text
                             π                                  11π
                         n                           o      n                     o                                                                                              
1.8 g) . . . . . .              + kπ, k ∈ Z ∪                       + kπ, k ∈ Z
                                                                                                                                                           h         πi     5π
                             12                                  12                       1.9 c). . . . . . . . . . . . . . . . . . . . . . . . .              −π,      ∪      ,π
                                                                                                                                                                     6       6
1.8 h) . . . . . . . . . . . . . . . . . . . . . . . . . . {π/6, 5π/6, 3π/2}                                                                                     
                                                                                                                                 h        πi     5π 7π     11π
                                                                                          1.9 d) . . . . . . . . . . . . .           0,      ∪     ,    ∪      , 2π
1.8 h) . . . . . . . . . . . . . . . . . . . . . . . . . {−π/2, π/6, 5π/6}                                                                6       6 6       6
                                                                                                                                      h               
                                                                                                                                   5π     π πi     5π
                                                                       
                                                           π    2π                        1.9 d) . . . . . . . . . . .       −π, −     ∪ − ,   ∪      ,π
1.8 h) . . . . . . . . . . . . . . . . . . . . . . . . .     + k ,k ∈ Z                                                             6     6 6       6
                                                           6     3
                                                                                                                                                           h π π h  5π 3π 
1.8 i) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {π/7, 13π/7}         1.9 e) . . . . . . . . . . . . . . . . . . . . . . . . .            ,   ∪    ,
                                                                             n π πo                                                                          4 2      4 2
1.8 i) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − ,
                                                                               7 7
                                                                                                                                                                   h
                                                                                                                                                           3π π        π πh
                                                                                          1.9 e) . . . . . . . . . . . . . . . . . . . . . .           −      ,−    ∪   ,
                      n
                          π
                                                     o n
                                                                   π
                                                                                  o                                                                         4    2     4 2
1.8 i) . . . . . .            + 2kπ, k ∈ Z ∪ − + 2kπ, k ∈ Z
                            7                                       7
                                                                                                                     π π   π 3π   5π 3π   3π 7π
                                                                                                                 h         h     i             i       h             h    i           i
                                                                                          1.9 f) . . . . .            ,  ∪  ,   ∪   ,   ∪   ,
1.8 j) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {5π/14, 9π/14}                                      4 2   2 4     4 2     2 4

                                                                                                                       3π    π          π   π                     π π          π 3π
                                                                                                               h                 h i                       i h           h i          i
1.8 j) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . {5π/14, 9π/14}           1.9 f) . . . .           −      ,−         ∪ − ,−                 ∪      ,      ∪     ,
                                                                                                                        4    2          2   4                     4 2          2 4
                            5π                                      9π
                        n                              o        n                     o                                                                                    
1.8 j) . . . . . .             + 2kπ, k ∈ Z ∪                          + 2kπ, k ∈ Z                                                                            3π     7π
                            14                                      14                    1.9 g) . . . . . . . . . . . . . . . . . . . . . . . . .          0,     ∪     , 2π
                                                                                                                                                                4      4
1.9 a) . . . . . . . . . . . . . . . . . . . . . . . [0, 3π/4] ∪ [5π/4, 2π]
                                                                                          1.9 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . [−π/4, 3π/4]
1.9 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        [−3π/4, 3π/4]                                                                                  
                                                                                                                                3π              7π 11π            15π
                                                                                          1.9 h) . . . . . . . . . . 0,                  ∪           ,          ∪      , 2π
1.9 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . [π/3, 5π/3]                                             8               8        8        8
                                                           h            πi hπ i                                    
                                                                                                                         5π
                                                                                                                             
                                                                                                                                π 3π
                                                                                                                                      
                                                                                                                                         7π
                                                                                                                                               
1.9 b) . . . . . . . . . . . . . . . . . . . . . . . . . −π, −              ∪     ,π      1.9 h) . . . . . . . . . −π, −     ∪ − ,    ∪     ,π
                                                                         3      3                                         8     8 8       8
                                                              h π i  5π             
1.9 c) . . . . . . . . . . . . . . . . . . . . . . . . . . 0,             ∪     , 2π
                                                                     6        6




            Corrigés

                                                     5π  π π
 1.3 a)           Utilisons la relation                 = + puis les formules d’addition. On obtient :
                                                     12  6 4
                                                           5π π     π             π        π           π        π
                                                                               
                                                 cos= cos       +        = cos        cos        − sin        sin
                                                           12 6     4             6         4            6         4
                                                        √       √              √       √       √
                                                          3        2     1       2        6− 2
                                                    =        ×       − ×            =               .
                                                         2       2       2      2            4
..............................................................................................................................................................
                                                              π      π     π
 1.3 b)        Pour commencer, remarquons que                    = − . Ainsi, avec les formules d’addition, on obtient :
                                                             12      3      4
                                                           π π      π             π        π           π        π
                                                                              
                                                 cos             −  = cos= cos        cos       + sin        sin
                                                           12 3     4             3         4            3         4
                                                             √        √       √        √       √
                                                       1        2       3        2        2+ 6
                                                    = ×           +        ×        =              .
                                                       2       2       2        2           4
..............................................................................................................................................................

52                                                                                                                                                              Réponses et corrigés
```

---
## PAGE 059

```text
 1.3 c)       De même, on a :

                                                  π          π     π              π       π            π        π
                                                                  
                                        sin         = sin       −       = sin        cos        − cos        sin
                                                  12         3      4             3         4            3         4
                                                       √        √             √        √       √
                                                          3       2     1        2        6− 2
                                                    =       ×        − ×            =              .
                                                         2       2      2       2            4
..............................................................................................................................................................
 1.3 d)       Grâce aux deux calculs précédents, on trouve :

                                                       π
                                                                 √
                                                                   6− 2
                                                                       √     √  √   √ √          √
                                   π
                                                 sin 12            4        6− 2   2( 3 − 1)    3−1
                               tan            =            π
                                                             =   √    √   = √  √ = √ √        = √    .
                                   12              cos 12           6+ 2      6+ 2   2( 3 + 1)    3+1
                                                                     4

Simplifions encore ce résultat, en appliquant la méthode de la quantité conjuguée. On trouve :
                              √                       √          √               √ 2              √              √
                               π           3−1         ( 3 − 1)( 3 − 1)              3 + 12 − 2 3            4−2 3               √
                        tan          = √           = √             √           =       √ 2               =               = 2 − 3.
                               12          3+1         ( 3 + 1)( 3 − 1)                   3 −1    2              2
..............................................................................................................................................................
 1.4 b)       On a :
                                   sin 2x   cos 2x   sin 2x cos x − cos 2x sin x   sin(2x − x)      1
                                          −        =                             =              =       .
                                    sin x    cos x           sin x cos x            sin x cos x   cos x
On peut aussi faire cette simplification à l’aide des formules de duplication :

                                            sin 2x      cos 2x      2 sin x cos x      2 cos2 x − 1           1
                                                    −            =                  −                   =         .
                                             sin x       cos x           sin x              cos x          cos x
..............................................................................................................................................................
 1.5 b)       On calcule :

                    cos(3x) = cos(2x + x) = cos(2x) cos x − sin(2x) sin x = (2 cos2 x − 1) cos x − 2 cos x sin2 x
                               = 2 cos3 x − cos x − 2 cos x(1 − cos2 x) = 4 cos3 x − 3 cos x.

..............................................................................................................................................................
                                                                       √
                                                                         2           √                                                      p        √
                           π              π                     π           +1          2+2                      π                    π         2+ 2
 1.6 a)        On a cos = 2 cos2 − 1 donc cos2 = 2                               =            . De plus, cos ⩾ 0 donc cos =                              .
                           4              8                     8          2             4                       8                    8           2
..............................................................................................................................................................
                                                          √                                       p        √
                          2 π               2 π      2− 2              π                   π         2− 2
 1.6 b)        On a sin        = 1 − cos         =            et sin ⩾ 0 donc sin =                            .
                            8                 8          4             8                   8           2
..............................................................................................................................................................
                                                           1 − cos(2x)            2 sin2 x
 1.7 a)        On a cos(2x) = 1 − 2 sin2 x donc                             =                  = tan x.
                                                              sin(2x)          2 sin x cos x
..............................................................................................................................................................
                       sin 3x      cos 3x      sin 3x cos x − cos 3x sin x           sin(3x − x)        sin(2x)       2 sin x cos x
 1.7 b)        On a            −            =                                    =                  =             =                   = 2.
                        sin x       cos x                sin x cos x                  sin x cos x         sin x        sin x cos x
..............................................................................................................................................................
 1.7 c)       On a cos(4x) = 2 cos2 (2x) − 1 = 2(2 cos2 x − 1)2 − 1 = 8 cos4 x − 8 cos2 x + 1.
..............................................................................................................................................................
                                                            √                     √
                                                              2                      2
 1.8 e)        Cela revient à résoudre « cos x =                 ou cos x = −           ».
                                                             2                      2
..............................................................................................................................................................
 1.8 g)        Si on résout avec x ∈ [0, 2π], alors t = 2x ∈ [0, 4π].
                                       √
                                         3                 π 11π 13π 23π                                        π 11π 13π 23π
                                                        n                         o                          n                          o
Or, dans [0, 4π], on a cos t =              pour t ∈         ,      ,      ,         et donc pour x ∈              ,      ,      ,        .
                                        2                  6 6         6      6                                12 12 12 12
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                       53
```

---
## PAGE 060

```text
                                                                                                                                                           1
 1.8 h)        Le réel sin x est solution de l’équation de degré 2 : 2t2 + t − 1 = 0 dont les solutions sont t = −1 et t = .
                                                                                                                                                           2
                                                                                         1
Ainsi, les réels x solutions sont ceux tels que sin x = −1 ou sin x = .
                                                                                         2
..............................................................................................................................................................
                           π            π     π            5π                                                5π
                                               
 1.8 j)        On a cos = sin             −        = sin       . Finalement, on résout sin x = sin               .
                           7            2     7            14                                                14
..............................................................................................................................................................
                                                 1               1
 1.9 d)        Cela revient à résoudre − ⩽ sin x ⩽ .
                                                 2               2
..............................................................................................................................................................
 1.9 f)       On résout l’inéquation « tan(x) ⩾ 1 ou tan(x) ⩽ −1 ».
..............................................................................................................................................................
                                                      π          π          π                                                        π          π
                                                            h                 i                                                  h                 i
 1.9 g)        Si x ∈ [0, 2π], alors t = x −             ∈ − , 2π −             . On résout donc cos t ⩾ 0 pour t ∈ − , 2π −                         , ce qui
                                                      4 h        4i h 4                                                              4          4
                  π π          3π 7π                            3π        7π
             h          i h             i                                          i
donne t ∈ − ,             ∪        ,       et donc x ∈ 0,             ∪       , 2π .
                  4 2           2 4                              4         4
..............................................................................................................................................................
                                                       π          π         π                                                        π          π
                                                             h                 i                                                 h                 i
 1.9 h)        Si x ∈ [0, 2π], alors t = 2x −             ∈ − , 4π −             . On résout donc cos t ⩾ 0 pour t ∈ − , 4π −                        , ce qui
                                                       4 i        4     h 4 i h                                                       4          4
                  π π          3π 5π           7π 15π                        3π        7π 11π            15π
             h          i h             i h                                                       i h              i
donne t ∈ − ,             ∪        ,      ∪        ,        puis x ∈ 0,            ∪       ,        ∪         , 2π .
                  4 2           2 2             2     4                       8         8      8           8
..............................................................................................................................................................




54                                                                                                                                   Réponses et corrigés
```

---
## PAGE 061

```text
Fiche no 2. Dérivation

             Réponses

2.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 6x2 + 2x − 11                  2.5 a) . . . . . .
                                                                                                                             (2x + 3)(2 sin(x) + 3) − (x2 + 3x) × 2 cos(x)
                                                                                                                                            (2 sin(x) + 3)2
2.1 b) . . . . . . . . . . . . . . . . . . . . . . . . 5x4 − 6x2 + 4x − 15
                                                                                                                                                                           2 − 3x
                                                                                                  2.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .     √
2.1 c) . . . . . . . . . . . . . . . . . . . . (2x2 − 2x + 10) exp(2x)                                                                                                  2 x(3x + 2)2

                                                                                   3x2 − x                                       (x2 + 1) sin(2x + 1) + x cos(2x + 1)
2.1 d) . . . . . . . . . . . . . . . (6x − 1) ln(x − 2) +                                         2.5 c). . . . . . −2
                                                                                    x−2                                                        (x2 + 1)2

2.2 a) . . . . . . . . . . . . . . . . . . . . . . . . 5(x2 − 5x)4 (2x − 5)                                                                         (4x + 3) ln(x) − 2x − 3
                                                                                                  2.5 d). . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                            (ln(x))2
2.2 b) . . . . . . . . . . . . . . . . . . . 4(2x3 + 4x − 1)(3x2 + 2)
                                                                                                                                                                      
                                                                                                                                                              1         1
2.2 c) . . . . . . . . . . . . . . . 8 cos2 (x) − 6 cos(x) sin(x) − 4                             2.6 a) . . . . . . . . . . . . . . . . . . . . . . 2x sin      − cos
                                                                                                                                                             x          x
2.2 d) . . . . . . . −3(3 cos(x) − sin(x))2 (3 sin(x) + cos(x))                                                                                                            9
                                                                                                  2.6 b) . . . . . . . . . . . . . . . . . . . . . . . . . . .              √
                                                                                         2x                                                                        (9 − x2 ) 9 − x2
2.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                    x2 + 1                                                                                               1
                                                                                                  2.6 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                       1                                                                                              1 − x2
2.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                    x ln(x)
                                                                                                                                                                   x cos(x) − sin(x)
                                                                                                  2.6 d) . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                     2
2.3 c) . . . . . . . . . . . . . . . . (−2x + 3x + 1) exp(x + x)                     2                                                                                  x sin(x)

                                                                                                                                                                        10x − 5
2.3 d) . . . . . . . . . . . . . . . . . . . . . 6 cos(2x) exp(3 sin(2x))                         2.7 a) . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                                    (3 − x)2 (2 + x)2
                                                                 2     
                                                      6x         2x − 1                                                                        √           √
2.4 a). . . . . . . . . . . . . . . . . . . .                cos                                                                    2     1 + 3     1 − 3
                                                   (x2 + 1)2     x2 + 1                           2.7 b) . . . . . . . . .              x+          x+
                                                                                                                                   x+1        2           2
                                               2x2 + 2x − 8
                                                                                             
                                                                2x + 1
2.4 b) . . . . . . . . . . . . . . . . .                    sin 2                                                                                                       2x2 + 2x + 5
                                                (x2 + 4)2       x +4                              2.7 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                                       (x + 2)(x − 1)2
                                                                                cos(x)
2.4 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      p                                                                                                       x2
                                                                               2 sin(x)           2.7 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                                                     (x + 1)2
                                                                                       √
                                                                                   cos( x)                                                                                     2
2.4 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .          √           2.7 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                     2 x                                                                                 x(1 − ln(x))2



             Corrigés

 2.1 a)            On calcule : f ′ (x) = (2x + 3)(2x − 5) + (x2 + 3x + 2) × 2 = 6x2 + 2x − 11.
..............................................................................................................................................................
 2.1 b)            On calcule : f ′ (x) = (3x2 + 3)(x2 − 5) + (x3 + 3x + 2) × 2x = 5x4 − 6x2 + 4x − 15.
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                                        55
```

---
## PAGE 062

```text
2.1 c)        On calcule : f ′ (x) = (2x − 2) exp(2x) + (x2 − 2x + 6) × 2 exp(2x) = (2x2 − 2x + 10) exp(2x).
..............................................................................................................................................................
                                                                                        1                                   3x2 − x
 2.1 d)        On calcule : f ′ (x) = (6x − 1) ln(x − 2) + (3x2 − x) ×                        = (6x − 1) ln(x − 2) +                   .
                                                                                      x−2                                     x−2
..............................................................................................................................................................
2.2 a)        On calcule : f ′ (x) = 5(x2 − 5x)4 (2x − 5).
..............................................................................................................................................................
2.2 b)        On calcule : f ′ (x) = 2(2x3 + 4x − 1)(6x2 + 4) = 4(2x3 + 4x − 1)(3x2 + 2).
..............................................................................................................................................................
2.2 c)        On calcule :

           f ′ (x) = 2(sin(x) + 2 cos(x))(cos(x) − 2 sin(x)) = 2(sin(x) cos(x) − 2 sin2 (x) + 2 cos2 (x) − 4 cos(x) sin(x)
                  = −6 cos(x) sin(x) − 4 sin2 (x) + 4 cos2 (x) = −6 cos(x) sin(x) − 4(1 − cos2 (x)) + 4 cos2 (x)
                  = 8 cos2 (x) − 6 cos(x) sin(x) − 4.
..............................................................................................................................................................
2.2 d)        On calcule : f ′ (x) = 3(3 cos(x) − sin(x))2 (−3 sin(x) − cos(x)) = −3(3 cos(x) − sin(x))2 (3 sin(x) + cos(x)).
En développant, on trouve : f ′ (x) = −54 cos2 (x) sin(x) − 78 cos3 (x) − 9 sin(x) + 51 cos(x).
..............................................................................................................................................................
                                             2x
 2.3 a)        On calcule : f ′ (x) = 2            . C’est une application directe de la formule de dérivation quand f = ln ◦ u.
                                           x +1
..............................................................................................................................................................
                                            1/x           1
 2.3 b)        On calcule : f ′ (x) =              =           .
                                           ln(x)      x ln(x)
..............................................................................................................................................................
2.3 c)        On calcule :

               f ′ (x) = (−1) exp(x2 + x) + (2 − x) exp(x2 + x) × (2x + 1) = (−1 + (2 − x)(2x + 1)) exp(x2 + x)
                       = (−1 + 4x + 2 − 2x2 − x) exp(x2 + x) = (−2x2 + 3x + 1) exp(x2 + x).
..............................................................................................................................................................
2.3 d)        On calcule : f ′ (x) = exp(3 sin(2x))(3 × 2 cos(2x)) = 6 cos(2x) exp(3 sin(2x)).
..............................................................................................................................................................
2.4 a)        On calcule :
                                                                                                           
                                    2x2 − 1              4x(x2 + 1) − (2x2 − 1) × 2x       2x2 − 1                4x3 + 4x − 4x3 + 2x
                 f ′ (x) = cos                       ×                               = cos
                                     x2 + 1                         2
                                                                  (x + 1) 2                 x2 + 1                     (x2 + 1)2
                                                            
                                  6x             2x2 − 1
                         =      2      2
                                          cos                .
                             (x + 1)              x2 + 1
..............................................................................................................................................................
2.4 b)        On calcule :

                                        2x + 1           2(x2 + 4) − (2x + 1) × 2x         2x + 1                   2x2 + 8 − 4x2 − 2x
                                                                                                         
                 f ′ (x) = − sin                     ×                             = − sin 2                    ×
                                        x2 + 4                   (x2 + 4)2                 x +4                          (x2 + 4)2
                             2x2 + 2x − 8            2x + 1
                                                                
                         =                     sin 2            .
                               (x2 + 4)2             x +4
..............................................................................................................................................................
                                                1                      cos(x)
 2.4 c)        On calcule : f ′ (x) = p                 cos(x) = p                .
                                           2 sin(x)                  2 sin(x)
..............................................................................................................................................................

56                                                                                                                                   Réponses et corrigés
```

---
## PAGE 063

```text
                                                                         √
                                                √          1        cos( x)
 2.4 d)        On calcule : f ′ (x) = cos( x) × √ =                     √      .
                                                         2 x          2 x
..............................................................................................................................................................
                                          (2x + 3)(2 sin(x) + 3) − (x2 + 3x) × 2 cos(x)
 2.5 a)        On calcule : f ′ (x) =                                                                . En développant le numérateur, on trouve :
                                                              (2 sin(x) + 3)2

                                                −2x2 cos(x) + 4x sin(x) − 6x cos(x) + 6 sin(x) + 6x + 9
                                    f ′ (x) =                                                                             .
                                                                           (2 sin(x) + 3)2
..............................................................................................................................................................
                                                               √                         √      √

                                 ′
                                            √1
                                           2 x
                                                (3x + 2) − x × 3             3x+2
                                                                               √
                                                                              2 x
                                                                                    − 3 x×2 √
                                                                                           2 x
                                                                                                  x
                                                                                                         3x + 2 − 6x               2 − 3x
 2.5 b)        On calcule : f (x) =                                      =                          = √                     = √                  .
                                                   (3x + 2)2                      (3x + 2)2             2 x(3x + 2)2          2 x(3x + 2)2
..............................................................................................................................................................
                                           −2 sin(2x + 1) × (x2 + 1) − cos(2x + 1) × 2x                       (x2 + 1) sin(2x + 1) + x cos(2x + 1)
 2.5 c)        On calcule : f ′ (x) =                                                                   = −2                                                 .
                                                                   (x2 + 1)2                                                   (x2 + 1)2
..............................................................................................................................................................
                                                                               1
                                           (4x + 3) ln(x) − (2x2 + 3x)                (4x + 3) ln(x) − 2x − 3
 2.5 d)                          ′
               On calcule : f (x) =                                            x  =                                 .
                                                         (ln(x))2                               (ln(x))2
..............................................................................................................................................................
                                                    1                 1         −1                   1            1
                                                                                                         
 2.6 a)        On calcule : f ′ (x) = 2x sin             + x2 cos          ×      2
                                                                                       = 2x sin          − cos         .
                                                    x                 x          x                   x            x
..............................................................................................................................................................
                                           √                                      √                   2            2     2
                                             9 − x2 − x √ 1 2 (−2x)                  9 − x2 + √ x 2            9−x
                                                                                                                √ +x
                                 ′                         2 9−x                                    9−x           9−x2                  9
 2.6 b)        On calcule : f (x) =                   √          2
                                                                               =                           =                =            √
                                                        9−x    2                          9 −  x 2              9 −   x2
                                                                                                                              (9  −  x2 ) 9 − x2
..............................................................................................................................................................
                                                                                    √
 2.6 c)        On a trois fonctions composées à la suite : f = ln( u)). Donc on a, en appliquant deux fois la formule de
                                                              1                         1
dérivée d’une fonction composée : f ′ (x) = p                          × u′ (x) × p           .
                                                         2 u − x)                       u(x)
On calcule :
                                                           1           1(x − 1) − (x + 1) × 1    1
                                          f ′ (x) = r              ×                          ×r
                                                           x+1                (x − 1)2           x+1
                                                     2
                                                           x−1                                              x−1
                                                           1              −2                  −1
                                                  =                 ×              =
                                                           x+1         (x − 1)2       (x + 1)(x − 1)
                                                      2×
                                                           x−1
                                                        −1            1
                                                  = 2          =           .
                                                      x −1         1 − x2
..............................................................................................................................................................
                                           cos(x) × x − sin(x) × 1               x        x cos(x) − sin(x)
 2.6 d)        On calcule : f ′ (x) =                                     ×            =                        .
                                                        x2                   sin(x)             x sin(x)
..............................................................................................................................................................
                                            −(−1)            −1          (2 + x)2 − (3 − x)2                 10x − 5
 2.7 a)        On calcule : f ′ (x) =                  +              =                             =                        .
                                           (3 − x)  2     (2 + x)  2       (3 − x)2 (2 + x)2           (3 − x)2 (2 + x)2
..............................................................................................................................................................
                                                    1        2x(x + 1) − 1          2x2 + 2x − 1
 2.7 b)        On calcule : f ′ (x) = 2x −                =                     =                    .
                                                  x+1              x+1                   x+1
Pour le trinôme 2x2 + 2x − 1, on calcule son discriminant ∆ = 4 − 4 × 2 × (−1) = 12. On a deux racines :
                                                    √                  √                √                           √
                                             −2 − 12          −2 − 2 3          −1 − 3                      −1 + 3
                                     x1 =                  =                 =                 et x2 =                  .
                                               2×2                  4                2                           2
                                         √               √                           √                 √ 
                           2(x − −1−      3
                                            )(x − −1+      3
                                                                    2
                                                                        
                                                                                1+ 3                1− 3
Enfin, on a f ′ (x) =                  2               2
                                                              =           x+                  x+               .
                                         x+1                     x+1                2                  2
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                       57
```

---
## PAGE 064

```text
                                            2x + 1     1 × (x − 1) − (x + 2) × 1    2x + 1      3
2.7 c)        On calcule : f ′ (x) =                 −                           = 2       +          .
                                          x2 + x + 2           (x − 1)2           x +x−2     (x − 1)2
On cherche les racines du trinôme x2 + x − 2 dont le discriminant est ∆ = 1 + 8 = 9 ; on identifie deux racines
x1 = −2, x2 = 1. D’où la forme factorisée : x2 + x − 2 = (x + 2)(x − 1).
                        2x + 1          3       (2x + 1)(x − 1)       3(x + 2)         2x2 + 2x + 5
Alors : f ′ (x) =                  +          =                  +                  =                 .
                    (x + 2)(x − 1)   (x − 1)2   (x + 2)(x − 1) 2   (x + 2)(x + 1) 2   (x + 2)(x − 1)2
Le trinôme 2x2 + 2x + 5 dont le discriminant est ∆ = 4 − 4 × 2 × 5 = −36 < 0 ne se factorise pas dans R.
                      2x2 + 2x + 5
On a : f ′ (x) =                         .
                    (x + 2)(x − 1)2
..............................................................................................................................................................
2.7 d)        On calcule :

                             1 × (x + 1) − x × 1       1       1          2    1 + (x + 1)2 − 2(x + 1)
                 f ′ (x) =                2
                                                 +1−2     =        2
                                                                     +1−     =
                                  (x + 1)             x+1   (x + 1)      x+1          (x + 1)2
                             1 + x2 + 2x + 1 − 2x − 2                 x2
                         =                       2
                                                               =             .
                                        (x + 1)                   (x + 1)2
..............................................................................................................................................................
                                           1
                                             (1 − ln(x)) − (1 + ln(x)) −1             1
                                                                                        − ln(x)   + x1 + ln(x)               2
                                                                                                                                                  2
2.7 e)        On calcule : f ′ (x) = x                                        x
                                                                                  = x         x              x
                                                                                                                  =          x
                                                                                                                                       =                    .
                                                      (1 − ln(x))   2                       (1 − ln(x))   2           (1 − ln(x))2        x(1 − ln(x))2
..............................................................................................................................................................




58                                                                                                                                   Réponses et corrigés
```

---
## PAGE 065

```text
Fiche no 3. Primitives

             Réponses

3.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln |t + 1|       3.4 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln |1 − e−t + et |
                                                                                      3                                                                                                1
                                                                                              3.4 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −e t
3.1 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −
                                                                                     t+2
                                                                                                                                                                            1
                                                                               3              3.5 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − cos3 t
3.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −                                                                                                  3
                                                                           2(t + 2)2
                                                                                              3.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . esin t
                                                                              cos(4t)
3.1 d). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −                 3.5 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − ln | cos t|
                                                                                 4
                                                                  2         3  3 4            3.5 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − ln |1 − sin t|
3.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . .        (1 + t) 2 − t 3
                                                                  3            4                                                                                                     √
                                                                                              3.5 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −2 cos          t
                                                                                 1 2t+1
3.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   e                                                                                      1
                                                                                 2            3.5 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        sin(π ln t)
                                                                                                                                                                          π
                                                                            1
3.2 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      arcsin(2t)      3.5 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . tan t − t
                                                                            2
                                                                            1                                                                                1
3.2 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        arctan(3t)      3.5 h) . . . . . . . . . . . . . . . . . . . . . . . . .         tan2 t + ln | cos t|
                                                                            3                                                                                2

                                                                            2                                                                                                  1
3.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        ln |1 + t3 |    3.5 i) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   tan4 t
                                                                            3                                                                                                  4
                                                                                                                                                                                √
                                                                          1            3      3.5 j) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 tan t
3.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      (1 + 2t2 ) 2
                                                                          6
                                                                                                                                                                                     1
                                                                              p               3.5 k) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −
3.3 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − 1 − t2                                                                                                tan t

                                                                           3                                                                                           1      1
3.3 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                        2
                                                                             (1 + 7t2 ) 3     3.5 l) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                           4                                                                                           2 (1 − sin t)2

                                                                           1                                                                                              1
3.3 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         ln(1 + 3t2 )     3.5 m) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .          arctan(2t)
                                                                           6                                                                                              2

                                                                                  1           3.5 n) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . arctan(et )
3.3 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −
                                                                              (1 + 3t2 )2
                                                                                                                                                                       1
                                                                                              3.6 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .       (arcsin(t))2
                                                                                  1 4                                                                                  2
3.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .  ln t
                                                                                  4
                                                                                              3.6 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln |arcsin(t)|
                                                                                   √
3.4 b). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 ln t
                                                                                                                                                                          t   sin(2t)
                                                                                              3.7 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        +
                                                                               2                                                                                          2      4
3.4 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                           (3 − e2t )2
                                                                                                                                                               cos(4t) cos(2t)
                                                                                              3.7 b) . . . . . . . . . . . . . . . . . . . . . . . . −                −
                                                                                        2                                                                         8       4
3.4 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −      3
                                                                                       3t 2                                                                                      1
                                                                                              3.7 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . − cos t +               cos3 t
                                                                                                                                                                                 3

Réponses et corrigés                                                                                                                                                                   59
```

---
## PAGE 066

```text
3.7 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln(1 + sin2 t)                                                                                 1 3t−2
                                                                                           3.9 f) . . . . . . . . . . . . . . . . . . . . . . . . . . 3e3t−2 puis     e
                                                                                                                                                                    3
3.7 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln | tan t|
                                                                                                                             t(t3 + 2)            1
                                                                                           3.9 g) . . . . . . −                               puis ln(|t3 − 1|)
3.7 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −cotant + tan t                                       (t − 1)2 (t2 + t + 1)2     3

                                                                        1                                          3t2 − 2t − 3     3
3.7 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      ln | tan 2t|     3.9 h) . . . . −                     puis ln(t2 + 1) − arctan(t)
                                                                        4                                           (t2 + 1)2       2
                                                                                      1                                                               1
3.8 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .     t + ln |t| −        3.9 i) . . . . . . . . . . . . . cos t(3 cos2 t − 2) puis − cos3 t
                                                                                      t                                                               3
                                                                                   1
3.8 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln |t| −                                                           2t sin 1t + cos 1t          1
                                                                                  2t2      3.9 j) . . . . . . . . . . . . . . . . . −                        puis cos
                                                                                                                                                   t4                 t
                                                                               t3   t5
3.8 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . t +      +                                                           2et
                                                                               3    5      3.9 k) . . . . . . . . . . . . . . . . . . .               puis ln(2 + et )
                                                                                                                                           (2 + et )2
                                                                               t2   t3
3.8 d). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . t −       +                                     2 cos t + 3         1
                                                                               2    3      3.9 l) . . . . . . . . .                   puis − ln |2 + 3 cos t|
                                                                                                                       (2 + 3 cos t)2       3
3.8 e). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . t − 2 ln |t + 1|
                                                                                                                                               1              p
                                                                                           3.9 m) . . . . . . . . . . . . . . . . .                    puis −   1 − t2
                                                             t2  t3                                                                       (1 − t2 )3/2
3.8 f) . . . . . . . . . . . . . . . . . . . . . . t −          + − ln |t + 1|
                                                             2   3
                                                                                                                           3 cos2 t − 1
                                                     1                                     3.9 n) . . . . . . . . 2                     puis − ln(1 + cos2 (t))
3.8 g) . . . . . . . . . . . . . . . . . . . . .       ln(1 + t2 ) − arctan(t)                                            (1 + cos2 t)2
                                                     2
                                                                                                                                                   2      1 2
                                                                                  1        3.9 o) . . . . . . . . . . . . . . . . . . (1 − 2t2 )e−t puis − e−t
3.8 h) . . . . . . . . . . . . . . . . . . . . . . . . . . . ln |t + 1| +                                                                                 2
                                                                                 t+1
                                                                                                                                           ln t − 2            1
                                                        1                                  3.9 p) . . . . . . . . . . . . . . . . . .               puis ln t − ln2 t
3.9 a) . . . . . . . . . . . . . . . . . . 2(t − 1) puis t3 − t2 + 5t                                                                         t2               2
                                                        3
                                                                                                                                               1 + ln t
                                                                                           3.9 q) . . . . . . . . . . . . . . . . . . . . . . − 2 2 puis ln | ln t|
                                                   
                                           1 2              1
3.9 b) . . . . . . . . . . . . . . − 2          + 1 puis − + ln |t|                                                                            t ln t
                                          t t               t
                                                                                                                             cos ln t − sin ln t
                                             1  3     2 3    1                             3.9 r) . . . . . . . . . . .                          puis − cos(ln t))
3.9 c). . . . . . . . . . . . . . . . . . . √ + 4 puis t 2 + 2                                                                        t2
                                            2 t t     3     2t
                                                                                                                                      et (e2t − 1)
                                   4  3 1        11   2                                    3.11 a) . . . . . . . . . . . . . −                     ) puis arctan(et )
3.9 d) . . . . . . . . . . . . . − 5 − 5/2 puis − 3 − √                                                                               (1 + e2t )2
                                  t   2t         3t     t
                                                                                                                                                             1
                                                  1     1                                  3.11 b) . . . . . . . . . sinh(t)2 + cosh2 (t) puis                 sinh2 (t)
3.9 e) . . . . . . . . . . . . . 2e2t − 3e−3t puis e2t − e−3t                                                                                                2
                                                  2     3



             Corrigés

 3.1 a)            Admet des primitives sur ] − ∞, −1[ ou ] − 1, +∞[.
..............................................................................................................................................................
 3.1 b)            Admet des primitives sur ] − ∞, −2[ ou ] − 2, +∞[.
..............................................................................................................................................................

60                                                                                                                                                  Réponses et corrigés
```

---
## PAGE 067

```text
3.2 a)         Admet des primitives sur ]0, +∞[.
..............................................................................................................................................................
3.2 c)         Admet des primitives sur ] − 1/2, 1/2[.
..............................................................................................................................................................
3.2 d)         Admet des primitives sur R.
..............................................................................................................................................................
                      ˆ t                 ˆ t
 3.5 g)        On a        tan2 θ dθ =        ((1 + tan2 θ) − 1) dθ = tan t − t + Cste .
..............................................................................................................................................................
                      ˆ t                 ˆ t
                                                                                         1
 3.5 h)        On a        tan3 θ dθ =        ((tan2 θ + 1) tan θ − tan θ) dθ = tan2 t + ln | cos t| + Cste .
                                                                                         2
..............................................................................................................................................................
                      ˆ x                 ˆ t
                                               1 + cos(2θ)             t     sin(2t)
 3.7 a)        On a        cos2 θ dθ =                         dθ = +                 + Cste .
                                                      2                2        4
..............................................................................................................................................................
3.7 b)         On a :     ˆ t                           ˆ t
                                                              1
                                cos(θ) sin(3θ) dθ =             (sin(3θ + θ) + sin(3θ − θ)) dθ
                                                              2
                                                         ˆ t
                                                              1                                   cos(4t)       cos(2t)
                                                      =         (sin(4θ) + sin(2θ)) dθ = −                  −             + Cste .
                                                              2                                       8            4
..............................................................................................................................................................
                      ˆ t                 ˆ t
                                                                                       1
 3.7 c)        On a        sin3 θ dθ =        (1 − cos2 θ) sin θ dθ = − cos t + cos3 t + Cste .
                                                                                       3
..............................................................................................................................................................
                      ˆ t                       ˆ t
                             sin(2θ)                 2 sin θ cos θ
 3.7 d)        On a                 2
                                        dθ =                        dθ = ln(1 + sin2 t) + Cste .
                           1 + sin θ                  1 + sin2 θ
..............................................................................................................................................................
                      ˆ t                 ˆ t                           ˆ t
                              dθ              cos2 θ + sin2 θ
                                                                                               dθ = ln | sin t|−ln | cos t|+Cste = ln | tan t|+Cste .
                                                                              cos θ    sin θ
                                                                                             
 3.7 e)       On a                    =                           dθ =        sin θ
                                                                                    + cos  θ
                         sin θ cos θ             sin θ cos θ
..............................................................................................................................................................
                      ˆ t                         ˆ t                              ˆ t
                                   dθ                   sin2 θ + cos2 θ                    1           1
                                                                                                            
 3.7 f)        On a            2         2
                                               =           2         2
                                                                           dθ =              2
                                                                                                 +      2
                                                                                                              dθ = −cotan(t) + tan(t) + Cste .
                           sin (θ) cos (θ)              sin (θ) cos (θ)                  sin θ      cos θ
..............................................................................................................................................................
3.7 g)         On a :
        ˆ t               ˆ t
                 dθ             cos2 (2θ) + sin2 (2θ)
                      =                               dθ
              sin(4θ)            2 sin(2θ) cos(2θ)
                          ˆ t                                 
                               1 2 cos(2θ)          2 sin(2θ)             1                    1                             1
                       =                         +                 dθ = ln | sin(2t)| − ln | cos(2t)| + Cste = ln | tan 2t| + Cste .
                               4 sin(2θ)             cos(2θ)              4                    4                             4
..............................................................................................................................................................
3.8 c)         On a 1 − t6 = 13 − (t2 )3 = (1 − t2 )(1 + t2 + t4 ) donc finalement on cherche une primitive de 1 + t2 + t4 .
..............................................................................................................................................................
                      ˆ t                 ˆ t                      ˆ t
                           θ−1                 θ+1−2                             2
                                                                                      
 3.8 e)        On a                dθ =                     dθ =         1−             dθ = t − 2 ln |t + 1| + Cste .
                           θ+1                    θ+1                          θ+1
..............................................................................................................................................................
                      ˆ t                 ˆ t 3                     ˆ t
                             θ3                θ +1−1                    (θ + 1)(1 − θ + θ2 ) − 1                    t2     t3
 3.8 f)        On a                dθ =                      dθ =                                       dθ = t −        +      − ln |t + 1| + Cste .
                           θ+1                    θ+1                                θ+1                             2      3
..............................................................................................................................................................
                      ˆ t                     ˆ t                      ˆ t                         
                                θ                  θ+1−1                        1            1                                 1
 3.8 h)        On a                    dθ =                     dθ =                 −                 dθ = ln |t + 1| +            + Cste .
                           (θ + 1)2                (θ + 1)2                   θ+1        (θ + 1)2                            t+1
..............................................................................................................................................................



Réponses et corrigés                                                                                                                                       61
```

---
## PAGE 068

```text
Fiche no 4. Calcul d’intégrales


           Réponses

4.1 a) . . . . . . . . . Positif                                               1   4.5 e) . . . . . . . . . . . . . . 6     4.7 c) . . . . . . . . . . . . . e2
                                         4.3 e) . . . . . . . . . . . −
                                                                              30                                     √
4.1 b) . . . . . . . . Négatif                                                                              1          3    4.7 d) . . . . . . . . . 3e − 4
                                                                       2           4.5 f). . . . . . . .        −
                                         4.3 f) . . . . . . . . . . −                                       2         2                                           1
4.1 c) . . . . . . . . . Positif
                                                                      101                                                   4.7 e) . . . . . . . . . . . . −
                                                                                   4.6 a) . . . . . . . . . . . . . . 0                                           3
4.2 a) . . . . . . . . . . . . . 14
                                         4.4 a) . . . . . . . . . . . . . . 0
                                                                                   4.6 b) . . . . . . . . . . . . . . 0                                           5
4.2 b) . . . . . . . . . . . . . 50                                                                                         4.7 f) . . . . . . . . . . . . . .
                                         4.4 b) . . . . . . . . . . . . . . 1                                                                                   8
                               147                                                                                 2
4.2 c) . . . . . . . . . . .                                                  1    4.6 c) . . . . . . ln         √
                                         4.4 c) . . . . . . . . . . . . . .                                          3      4.8 a) . . . . . . . . . . . . . . 0
                                2
                                                                              2
                                                                                                                                                                 π
4.2 d) . . . . . . . . . . . −54                                                                            1               4.8 b) . . . . . . . . . . . . .
                                         4.4 d) . . . . . . . . . . . . . 18       4.6 d) . . . . . . . . . −                                                    4
                                                                                                           384
4.2 e) . . . . . . . . . . . . . . 0
                                         4.4 e) . . . . . . . e2 − e−3                                                                                      99
                                                                                                    1       1               4.8 c) . . . . . . . . . .
                                   5                                               4.6 e) . . . . .     1−                                                   ln 10
4.2 f) . . . . . . . . . . . . . .       4.4 f) . . . . . . . . . . − ln 3                          2       e
                                   2
                                                                                                                                                          e − 1e
4.3 a) . . . . . . . . . . . . . . 8     4.5 a) . . . . . . . . . . . . . 78                                         7      4.8 d) . . . . . . . . .
                                                                                   4.6 f) . . . . . . . . . . . . .                                         2
                                                                                                                    48
4.3 b) . . . . . . . . . . . . −2        4.5 b) . . . . . . 2(e3 − 1)
                                                                                                                                                                  2
                                                                                                         1   1              4.8 e) . . . . . . . . . . . . . .
                                   8                    1            π           4.7 a) . . . . .        −                                                      3
4.3 c) . . . . . . . . . . . . . .       4.5 c). . .        ln 1 +                                       2 e+1
                                   3                    π             2                                                                                          2π
                                                                      √                                             17      4.8 f) . . . . . . . . . . . .
4.3 d) . . . . . . . . . . . . . . 0                                    2          4.7 b) . . . . . . . . . . . .                                                 9
                                         4.5 d) . . . . . . . . . . .                                                2
                                                                       6




           Corrigés

 4.1 a)         On intègre une fonction positive et les bornes sont « dans le bon sens ».
..............................................................................................................................................................
               ˆ −3                         ˆ 5
 4.1 b)               | sin 7x| dx = −           | sin 7x| dx. Cette dernière intégrale a ses bornes « dans le bon sens », on peut
                   5                          −3
l’interpréter comme une aire. Elle est positive car on intègre une fonction positive. Le signe de l’intégrale initiale est donc
négatif.
..............................................................................................................................................................
               ˆ −1                   ˆ 0
 4.1 c)              sin x dx = −          sin x dx. Cette dernière intégrale a ses bornes « dans le bon sens », on peut l’interpréter
                0                       −1
                                                                                                                        ˆ 0
comme une aire. La fonction sin est négative sur [−π, 0] donc sur [−1, 0] ; donc, l’intégrale                                sin x dx est négative.
                                                                                                                           −1
Le signe de l’intégrale initiale est donc positif.
..............................................................................................................................................................
 4.2 a)         Il s’agit de l’aire d’un rectangle de largeur 2 et de longueur 7.
..............................................................................................................................................................

62                                                                                                                                     Réponses et corrigés
```

---
## PAGE 069

```text
                                                                                                 ˆ −3                  ˆ 7                ˆ 7
 4.2 b)        On commence par mettre les bornes « dans le bon sens » :                                 −5 dx = −             −5 dx =           5 dx. Cette
                                                                                                  7                      −3                −3
dernière intégrale est l’aire d’un rectangle dont les côtés mesurent 10 et 5.
..............................................................................................................................................................
 4.2 c)       Il s’agit de l’aire du triangle dont les sommets sont l’origine O, le point A(7; 0) et le point B(7; 21). Ce triangle
                                             1
est rectangle en A et son aire est × AO × AB.
                                             2
..............................................................................................................................................................
 4.2 d)      Les bornes sont « dans le bon sens », on peut donc interpréter l’intégrale comme une aire algébrique. Sur
l’intervalle [2, 8], la courbe de f (x) = 1 − 2x est située sous l’axe des abscisses, l’aire algébrique sera négative.
Il s’agit de calculer l’aire du trapèze rectangle dont les sommets sont A(2; 0), B(8; 0), C(8; −15) et D(2; −3). L’aire de
                                1                                 1
ce trapèze rectangle est × AB × (AD + BC) = × 6 × (3 + 15).
                                2                                 2
..............................................................................................................................................................
                                                            ˆ 2                 ˆ 0                ˆ 2
 4.2 e)        Avec la relation de Chasles, on a                 sin x dx =          sin x dx +         sin x dx. La fonction sinus étant impaire,
                           ˆ 0                 ˆ 2            −2                 −2                 0

les aires algébriques           sin x dx et         sin x dx sont opposées, il suit que leur somme est nulle.
                            −2                  0
..............................................................................................................................................................
 4.2 f)   Les bornes étant « dans le bon sens », on interprète cette intégrale comme une aire algébrique. Cette aire est
composée de deux triangles rectangles (les intégrales de −2 à 0 et de 0 à 1).
..............................................................................................................................................................
 4.3 a)       Les bornes étant « dans le bon sens », on interprète cette intégrale comme une aire algébrique d’un rectangle.
..............................................................................................................................................................
               ˆ 3                  h          i3
 4.3 b)             2x − 5 dx = x2 − 5x = (32 − 15) − (12 − 5) = −2.
                1                                1
..............................................................................................................................................................
               ˆ 0                                             i0
                                            1 3 1 2                             1            1                    8
                                          h                                                                
 4.3 c)             x2 + x + 1 dx =           x + x +x               =0−          (−2)3 + (−2)2 − 2 = .
                −2                          3        2           −2             3            2                    3
..............................................................................................................................................................
 4.3 d)       La fonction intégrée est impaire, son intégrale sur un segment symétrique par rapport à 0 est donc nulle.
..............................................................................................................................................................
               ˆ 1
                                       1 6 1 5 1             1     1        1
                                     h               i
 4.3 e)             x5 − x4 dx =         x − x           = − =− .
                0                      6        5      0     6     5       30
..............................................................................................................................................................
               ˆ −1
                                      1 101 −1              2
                                   h           i
 4.3 f)              x100 dx =            x          =−         .
                1                    101         1         101
..............................................................................................................................................................
 4.4 a)       La fonction intégrée est impaire, son intégrale sur un segment symétrique par rapport à 0 est donc nulle.
..............................................................................................................................................................
               ˆ π                         i π6
                                                             π
                  6
                                   h                        
 4.4 b)               cos x dx = sin x            = 2 sin         = 1.
                −6 π                         −  π
                                                6
                                                             6
..............................................................................................................................................................
               ˆ 2          h i2
                    dx          1           1          1
 4.4 c)                2
                          = −         =− +1= .
                1    x          x   1       2          2
..............................................................................................................................................................
               ˆ 100               h √ i100
                         1
 4.4 d)                √ dx = 2 x                = 18.
                1         x                 1
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       63
```

---
## PAGE 070

```text
              ˆ 2             h i2
4.4 e)               ex dx = ex          = e2 − e−3 .
                −3                  −3
..............................................................................................................................................................
               ˆ −1                   i−1
                      dx
                              h
 4.4 f)                   = ln |x|          = − ln 3.
                −3     x                −3
..............................................................................................................................................................
               ˆ 2                                      i2
                                          1                      625      1
                                        h
 4.5 a)             (2x + 1)3 dx =          (2x + 1)4        =         − = 78.
                −1                        8              −1       8       8
..............................................................................................................................................................
               ˆ 4                  h 1        i4
                      1
 4.5 b)             e 2 x+1 dx = 2e 2 x+1           = 2(e3 − 1).
                −2                              −2
..............................................................................................................................................................
               ˆ 1                                 i1
                       dx          1                        1     π+2
                                 h                                       
 4.5 c)                       =       ln |πx + 2| = ln                      .
                0 πx + 2           π                 0      π         2
..............................................................................................................................................................
               ˆ π                                      i π6          √
                                           1                       1 2
                  6
                                       h
 4.5 d)               sin(3x) dx = − cos(3x)                   =         .
                   π
                − 12                       3             − 12π     3 2
..............................................................................................................................................................
               ˆ 33                     h √            i33
                          1               2                     2
 4.5 e)              √           dx =          3x + 1        = (10 − 1) = 6.
                0       3x  +  1          3              0      3
..............................................................................................................................................................
               ˆ π                                             i π2                                               √
                           π                           π                             π             4π        1        3
                  2
                                          h                                                  
 4.5 f)              cos      − x dx = − sin               −x          = − sin −          + sin           = −           .
                −π         3                           3          −π                 6              3        2      2
..............................................................................................................................................................
               ˆ 3                                                   i3
                        x−2                  1
                                           h
                                                     2
 4.6 a)                             dx  =       ln(x   −    4x + 5)     = 0.
                1 x − 4x + 5
                      2                      2                        1
..............................................................................................................................................................
4.6 b)        La fonction intégrée est impaire, son intégrale sur un segment symétrique par rapport à 0 est donc nulle.
..............................................................................................................................................................
               ˆ π                 ˆ π                                       i π6        √ 
                                       6 sin x                                               3
                  6
                                                          h
 4.6 c)               tan x dx =                x dx = − ln(cos x)                = − ln         .
                0                    0    cos x                               0            2
..............................................................................................................................................................
               ˆ π                                           i π3
                                                  1                          1 1 6
                  3
                                             h                                 
 4.6 d)               sin x(cos x)5 dx = − (cos x)6                 =−               .
                −π                                6            −π 2
                                                                             6 2
                   2
..............................................................................................................................................................
               ˆ 1
                                       1 x2 −1 1       1         1
                         2
                                    h           i                 
 4.6 e)             xex −1 dx =          e          =      1−        .
                0                      2          0    2         e
..............................................................................................................................................................
               ˆ 1                                           1
                          x                1 −1        1                7
 4.6 f)                 2 + 1)4
                                 dx =                2 + 1)3
                                                                  =        .
                0    (x                    2  3   (x            0
                                                                       48
..............................................................................................................................................................
               ˆ 1                            ˆ 1
                            ex                          ex
                                                                                      i1
                                                                                  1             1        1
                                                                         h
 4.7 a)                2x + 2ex + 1
                                       dx  =          x + 1)2
                                                                dx  =     −     x +1
                                                                                         =−          + .
                0    e                         0    (e                        e        0      e +  1     2
..............................................................................................................................................................
                                                                                                   ˆ 3                  ˆ −1                  ˆ 3
 4.7 b)       x+1 est négatif sur [−2, −1] et positif sur [−1, 3]. On en déduit :                       |x+1| dx =             −x−1 dx+            x+1 dx.
                                                                                                    −2                   −2                    −1
Ces deux intégrales se calculent avec des primitives ou en les interprétant comme des aires de triangles.
..............................................................................................................................................................
               ˆ 2                        ˆ 0         ˆ 2
 4.7 c)             max(1, ex ) dx =           dx +        ex dx = e2 .
                −1                         −1          0
..............................................................................................................................................................
               ˆ e                          ˆ e           ˆ e                                           ie
                    3x − 2 ln x                                ln x                           1
                                                                                            h
 4.7 d)                           dx = 3         dx − 2             dx = 3(e − 1) − 2 (ln x)2 = 3e − 4.
                1         x                  1             1    x                             2          1
..............................................................................................................................................................

64                                                                                                                                   Réponses et corrigés
```

---
## PAGE 071

```text
 4.7 e)       On calcule :
                 ˆ π                               ˆ π                                      ˆ π                            ˆ π
                       2                                2                                        2                              2
                                                                 2                                      2
                           cos(2x) sin(x) dx =              (2 cos (x) − 1) sin(x) dx = 2            cos (x) sin(x) dx −            sin(x) dx
                   0                                0                                        0                              0
                                                                     i π2          i π2
                                                    2                                         1
                                                            h               h
                                              =−        cos3 (x)      + cos(x)          =− .
                                                    3              0                 0        3
..............................................................................................................................................................
               ˆ π                          ˆ π                            ˆ π
                                                    1                    1 4                                                                        π
                  4                            4
                                                                                                                                                h        i
 4.7 f)              | cos x sin x| dx =          | sin(2x)| dx =                | sin(2x)| dx. Le signe de sin(2x) est négatif sur − , 0 et
                   π                          −π    2                    2 −π                                                                       3
              h−3 i                             3                              3
                   π
positif sur 0,         , il suit que :
                   4
                 ˆ π                       ˆ 0                       ˆ π                                  i0                      i π4
                                                                                             1                      1                     5
                     4                                                   4
                                                                                               h                      h
                        | sin(2x)| dx =           − sin(2x) dx +           sin(2x) dx =          cos(2x)         −      cos(2x)        = .
                   −π                        −π                        0                     2              −π3
                                                                                                                    2              0      4
                       3                       3


                                  5
Le résultat final est donc          .
                                  8
..............................................................................................................................................................
 4.8 a)       La fonction intégrée est impaire, son intégrale sur un segment symétrique par rapport à 0 est donc nulle.
..............................................................................................................................................................
               ˆ 1                                  i1
                       1                                   π
                                     h
 4.8 b)                    2
                             dx = arctan(x) = .
                0 1+x                                0     4
..............................................................................................................................................................
               ˆ 2              ˆ 2
                                                          1 x ln 10 2         e2 ln 10 − 1       99
                                                     h                 i
 4.8 c)             10x dx =         ex ln 10 dx =            e            =               =          .
                0                 0                    ln  10           0         ln 10        ln 10
..............................................................................................................................................................
               ˆ 1                 h       i1                 e − 1e
 4.8 d)             ch(x) dx = sh(x) = sh(1) =                       .
                0                            0                  2
..............................................................................................................................................................
               ˆ 1              ˆ 1
                    √                  1
                                                  h 3 i1
                                                   2 2          2
 4.8 e)               x dx =         x 2 dx =        x      = .
                0                0                 3      0     3
..............................................................................................................................................................
               ˆ 3√
                                           ˆ 3 √
                                                                                           i √33                 √
                           2                            1                   1                        2                    2π
                   3                            3
                                                                          h
 4.8 f)                        2
                                 dx   =  2                    2
                                                                dx  =   2     arctan(3x)         = arctan( 3) =               .
                0     1  +  9x              0      1 +  (3x)                3               0        3                     9
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       65
```

---
## PAGE 072

```text
Fiche no 5. Intégration par parties

             Réponses
                                                                                     π                                                                                
                                                                                                                                                                           R → R
5.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .     −1               5.2 a) . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                     2                                                                                     x 7→ (−x + 2)ex
                                                          5        1        3
5.1 b) . . . . . . . . . . . . . . . . . . . . . . .        ch(2) − sh(2) −                                                                                                R∗+ → R
                                                                                                                                                                     (
                                                          2        2        2                           5.2 b) . . . . . . . . . . . . . . . . . . . . . . . .                             1 + ln x
                                                                                                                                                                            x 7→ −
5.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 4                                                                                                x
                                             2
                                 (ln(2)) 2ln(2) − 2 ln(2) − 2ln(2) + 2                                                                              R → R
                                                                                                                                           (
5.1 d). . . . . . . . . .                                            2                                  5.2 c) . . . . . . . . .                                                1
                                                         (ln(2))                                                                                    x 7→ x arctan(x) −            ln(1 + x2 )
                                                                                                                                                                                2
5.1 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1                                                                   
                                                                                                                                                                     R → R
                                                                                                        5.2 d) . . . . . . . . . . . . . . . . . . . .
                                                                                   3                                                                                 x 7→ xsh(x) − ch(x)
5.1 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 ln(2) −
                                                                                   4
                                                                                                                                                                                             5
                                                                               π                        5.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .       − e2
5.1 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ln(2) − 2 +                                                                                                               2
                                                                               2
                                                                                                                                                                                              π
                                                                                                                                                                                        e2 + 1
                                                                                   π 1                  5.3 b). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
5.1 h) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      −                                                                                                    2
                                                                                   4    2
                                                                                 √                                        (
                                                                                                                               R → R
                                                                        π           3                   5.4 a) . . . .                    1
5.1 i) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .          +       −1                                        x 7→ (− cos(x)sh(x) + sin(x)ch(x))
                                                                        12        2                                                       2
                                                                                 √
                                                                               2 2 4                                                        ∗
                                                                                                                                                R+ → R
5.1 j) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −            +                 5.4 b) . . . . . . . . . . . . .
                                                                                 3      3                                                          x 7→ x ln2 x − 2x ln x + 2x
                                                        4√           8√    4                                                            ∗
5.1 k) . . . . . . . . . . . . . . . . . . . . . .         2 ln(2) −    2+                                                              R+ → R 
                                                        3            9     9                                                                                                                      
                                                                                                        5.4 c) . . . . . . .                               3     1 2     2       2
                                                                                                                                                x 7→ x             ln x − ln x +
                                                                            π2                                                                                   3       9       27
                                                                                                                                       
                                                                π 1
5.1 l) . . . . . . . . . . . . . . . . . . . . . . . . . . .      − ln(2) −
                                                                4  2        32
                                                                                                                                       ] − 1, 1[ → R
                                                                                                                              (
                                                                                                        5.4 d) . . . .                             1            p       
                                                                                                                                              x 7→ earccos(x) x − 1 − x2
                                                                                                                                                   2



             Corrigés
                                                                                       ˆ π                                  i π2           ˆ π
                                                                                                                             π
                                                                                              2
                                                                                                                 h                              2
 5.1 a)            On choisit u′ (t) = cos t et v(t) = t. On a                                    t cos t dt = t sin t         − 1.    −            sin t dt =
                                                                                          0                                  20             0
..............................................................................................................................................................
 5.1 b)        On choisit u′ (t) = sh(2t) et v(t) = 2t + 3. On a :
                           ˆ 1                                              1 ˆ 1
                                                                     ch(2t)                             5            3     sh(2)
                               (2t + 3)sh(2t) dt = (2t + 3)                      −       ch(2t) dt = ch(2) − −                    .
                            0                                           2      0     0                  2            2        2
..............................................................................................................................................................
                                                                   ˆ 2              h t i2          ˆ 2                    h t i2
                                                        t                  t                               t
 5.1 c)        On choisit v(t) = t et u′ (t) = e 2 . On a               te 2 dt = 2te 2 − 2              e 2 dt = 4e − 4 e 2 = 4.
                                                                                      0                              0             0                                   0
..............................................................................................................................................................

66                                                                                                                                                                          Réponses et corrigés
```

---
## PAGE 073

```text
 5.1 d)     On choisit v(t) = t et u′ (t) = 2t . On a :
      ˆ ln(2)         ˆ ln(2)                          ln(2)         ˆ ln(2)
                t                t ln(2)          1 t              1                                    2         1     t ln(2)
              t2 dt =         te         dt = t       2        −               et ln(2) dt = 2ln(2) −       −        2
                                                                                                                        2 1
       1               1                        ln(2)    1
                                                                 ln(2)  1                             ln(2)   (ln(2))
                              (ln(2))2 2ln(2) − 2 ln(2) − 2ln(2) + 2
                          =                                          .
                                              (ln(2))2
..............................................................................................................................................................
                                                                    ˆ e             h       ie ˆ e
                               ′
 5.1 e)        On choisit u (t) = 1 et v(t) = ln t. On a                 ln t dt = t ln t −            1 dt = e − (e − 1) = 1.
                                                                     1                       1     1
..............................................................................................................................................................
                                                                   ˆ 2                          i2 ˆ 2
                                                                                       1 2                  1                      1  2                  3
                                                                                     h
 5.1 f)        On choisit u′ (t) = t et v(t) = ln t. On a               t ln t dt =      t ln t −             t dt = 2 ln(2) − t2 1 = 2 ln(2) − .
                                                                     1                 2          1     1 2                        4                       4
..............................................................................................................................................................
 5.1 g)       On choisit u′ (t) = 1 et v(t) = ln(1 + t2 ). On a :
                     ˆ 1                                       ˆ 1                                         ˆ 1
                                                                                  t2                                      1
                                                        1                                                                     
                          ln(1 + t2 ) dt = t ln(1 + t2 ) 0 − 2
                                           
                                                                                      2
                                                                                        dt  =  ln(2)  −  2         1−        2
                                                                                                                                 dt
                            0                                                0 1+t                           0         1+t
                                                                                i1
                                                                                                       π
                                                              h
                                               = ln(2) − 2 t − arctan(t) = ln(2) − 2 + .
                                                                                  0                    2
..............................................................................................................................................................
                      ˆ 1                      2             1        ˆ                            ˆ 
                                                t                     1 1 t2                π     1 1               1              π     1
                                                                                                                         
 5.1 h)        On a         t arctan t dt =         arctan t −                     2
                                                                                     dt  =     −           1  −        2
                                                                                                                           dt = − .
                        0                        2             0
                                                                      2  0   1 +  t         8     2    0          1 + t            4     2
..............................................................................................................................................................
                      ˆ 1                                i 2 ˆ 21
                                                           1                                                i 21
                                                                           t             π
                          2
                                            h                                                   hp
 5.1 i)        On a          arcsin t dt = t arcsin t −                √         dt =        +       1 − t2 .
                        0                                  0      0      1 − t2          12                   0
..............................................................................................................................................................
                      ˆ 1                   h √                   ˆ 1                   √
                                                                                                                          √
                                t
                                                         i1             √                       4
                                                                                                  h          3 1
                                                                                                               i
                                                                                                                        2 2       4
 5.1 j)        On a         √        dt = 2t 1 + t − 2                    1 + t dt = 2 2 −          (1 + t) 2 = −              + .
                        0      1+t                         0        0                           3                0        3       3
..............................................................................................................................................................
                                       √
 5.1 k)        On choisit u′ (t) = 1 + t et v(t) = ln(1 + t). On a :
               ˆ 1                                                                   ˆ
                     √                                                           2 1√                    4√
                                                                          i1                                                              3 1
                                                  2                                                                       2 2
                                                h            3
                                                                                                                            h               i
                         1 + t ln(1 + t) dt =        (1 + t) 2 ln(1 + t) −                 1 + t dt =          2 ln(2) −        (1 + t)) 2
                 0                                3                         0    3 0                     3                3 3                 0
                                                4√               8√        4
                                             =        2 ln(2) −       2+ .
                                                3                9         9
..............................................................................................................................................................
                       ˆ π                     ˆ π                           ˆ π
                           4                      4                             4
                             t tan2 t dt =            t 1 + tan2 t dt −
                                                                    
 5.1 l)        On a                                                                t dt. On choisit, dans la première intégrale, v(t) = t et
                         0                      0
                                                 i π4 ˆ π4                  02  π4                       i π4
                                                                              t          π                          π2     π     1             π2
                                        h                                                      h
u′ (t) = 1 + tan2 t. On obtient t tan t                −       tan t dt −             = + ln cos(t)              −     = − ln(2) −                .
                                                  0        0                  2 0        4                  0       32     4     2             32
..............................................................................................................................................................
 5.2 a)      Cette fonction est définie sur R, y est continue et admet donc des primitives. Soit x ∈ R. En choisissant
                                   ˆ x                h          ix ˆ x
u′ (t) = et et v(t) = −t + 1, on a     (−t + 1)et dt = (−t + 1)et +     et dt = (−x + 1)ex + ex − 2 = (−x + 2)ex − 2.
                                            0                                        0     0
..............................................................................................................................................................
 5.2 b)        Cette fonction est définie sur R∗+ , y est continue et admet donc des primitives. Soit x > 0. Par intégration
                                                             ˆ x                              ˆ x
                                 1                                 ln t            ln t x           1            ln x     1
                                                                               h       i
par parties avec u′ (t) = 2 et v(t) = ln t, on a                        dt =     −         +           dt = −         − + 1.
                                t                              1    t2              t 1         1 t
                                                                                                     2            x       x
..............................................................................................................................................................
 5.2 c)        La fonction est définie sur R et y est continue. Soit x ∈ R. On a, en choisissant u′ (t) = 1 et v(t) = arctan t,
ˆ x                                  ix ˆ x
                                                     t                             1
                        h
     arctan(t) dt = t arctan t −                        2
                                                          dt = x arctan(x) − ln(1 + x2 ). D’où une primitive.
 0                                     0     0 1+t                                 2
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                       67
```

---
## PAGE 074

```text
                                      ˆ x                         h               ix           ˆ x
 5.2 d)         Pour x ∈ R, on a            tch(t) dt = tsh(t)                            −          sh(t) dt = xsh(x) − ch(x) + 1.
                                        0                                             0         0
..............................................................................................................................................................
 5.3 a)       On effectue deux intégrations par parties successives : pour la première, on prend u′ (t) = e2t et v(t) = t2 +3t−4,
                ˆ 1                                                  1 ˆ 1
                       2             2t            2             e2t                        e2t
et on trouve         (t + 3t − 4)e dt = (t + 3t − 4)                      −      (2t + 3)       dt. Puis, pour la seconde intégration par parties,
                  0                                                2    0     0              2
                                      e2t
avec v(t) = 2t + 3 et u′ (t) =             , on trouve :
                                        2
                        ˆ 1                                            1        ˆ
                                       e2t                          e2t         1 1 2t            11     5        1 2t 1        5
                                                                                                                    h i
                     −      (2t + 3)        dt = 2 − (2t + 3)               +           e dt =       − e2 +          e      = − e2 .
                         0              2                            4    0
                                                                                2   0              4     4        4       0     2
..............................................................................................................................................................
                                                                                  ˆ π                             π ˆ π2 t
                                                                                      2
               On choisit d’abord u′ = exp et v = sin, d’où :                           et sin t dt = et sin t 02 −
                                                                                                       
 5.3 b)                                                                                                                       e cos t dt. Ensuite, avec
                                                          π      ˆ  π
                                                                                   0
                                                                                                              ˆ   π
                                                                                                                          0
                                           π                         2                                            2                  π
u′ = exp et v = cos, on trouve e 2 − et cos t 02 −                      et sin t dt. Finalement, on a 2             et sin t dt = e 2 + 1.
                                                
                                                                                  0                                                        0
..............................................................................................................................................................
                                                                                                                                  ˆ x
 5.4 a)        On effectue deux intégrations par parties successives pour déterminer, pour x ∈ R,                                      sin(t)sh(t) dt. On
                                                                        ˆ x                       h                 ix ˆ x 0
commence par choisir u′ = sin et v = sh ; cela donne                         sin(t)sh(t) dt = − cos(t)sh(t) +                   cos(t)ch(t) dt. Puis, on
                                                                         0h              ix ˆ x                       0      0

choisit u′ = cos et v = ch, ce qui donne − cos(x)sh(x) + sin(t)ch(t) −                               sin(t)sh(t) dt.
                                                                                                                     0        0
                       ˆ x
                                                 1
Finalement, on a            sin(t)sh(t) dt = (− cos(x)sh(x) + sin(x)ch(x)).
                         0                       2
..............................................................................................................................................................
 5.4 b)         Cette fonction est définie sur R∗+ et y est continue. Soit x > 0. En choisissant u′ (t) = 1 et v(t) = ln2 t, on
          ˆ x                     x ˆ x
                ln2 t dt = t ln2 t 1 −    2 ln t dt. Puis, en choisissant u′ (t) = 1 et v(t) = ln t, on obtient :
                          
obtient
           1                                 1
                                                          h           ix                  ˆ x
                                        x ln2 x − 2 t ln t                    +2                1 dt = x ln2 x − 2x ln x + 2x − 2.
                                                                          1                1
..............................................................................................................................................................
 5.4 c)         La fonction est définie et continue sur R∗+ . Soit x > 0. Avec u′ (t) = t2 et v(t) = ln2 (t), on a :
                                                    ˆ x                                    3             x         ˆ x
                                                              2       2                        t         2
                                                          t ln t dt =                            ln2 t −                     t2 ln t dt.
                                                      1                                        3      1
                                                                                                         3               1

                                                                                                 ˆ
                                                               x3 2                            2 x 2            x3 ln2 x
                                                                                        ix
                                                                             2 3                                               2              2 3
                                                                               h
Puis, avec u′ (t) = t2 et v(t) = ln(t), on obtient                 ln x −        t ln t +             t dt =               − x3 ln x +          (x − 1).
                                                                3            9           1     9   1                 3         9             27
..............................................................................................................................................................
 5.4 d)         Soit x ∈] − 1, 1[. En posant u′ (t) = 1 et v(t) = earccos(t) , on obtient :
                                            ˆ x                                                      ix        ˆ x
                                                                                                                          −t
                                                                              h
                                                  earccos(t) dt = tearccos(t)                             −          √          earccos(t) dt.
                                             0                                                        0         0        1 − t2
                                           t
Ensuite, en posant u′ (t) = − √                   et v(t) = earccos(t) , on obtient :
                                         1 − t2
                                       ix ˆ x p                                                                                           ˆ x
                                                                −1
                hp                                                                                        p                          π
xearccos(x) −       1 − t2 earccos(t) +              1 − t2 √           earccos(t) dt = xearccos(x) − 1 − x2 earccos(x) +e 2 −                 earccos(t) dt.
                                         0     0                1 − t2                                                                      0
               ˆ x
                                       1                                     1 π
                                                          p           
Ainsi, on a         earccos(t) dt = earccos(x) x − 1 − x2 + e 2 .
                 0                     2                                     2
..............................................................................................................................................................


68                                                                                                                                               Réponses et corrigés
```

---
## PAGE 075

```text
Fiche no 6. Changements de variable

             Réponses
                                                                                             π                                                                                              π
6.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .       6.2 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                             2                                                                                              12
                                                                                             π                                                                                         1 5
6.1 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .       6.2 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .     ln
                                                                                             6                                                                                         2 2
                                                                                             π
6.1 c). . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 arctan(e) −                    6.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2e2
                                                                                             2
                                                                                                                                        √                     √                           √
                                                                                             1   6.3 b) . . . . . . . . . −2(( 3 − 1) ln( 3 − 1) − 4 + 2 3
6.1 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                             4                                ( i πh
                                                                                                                                      0,             → R
                                                                                      1          6.4 a) . . . . . . . . .                  2
6.1 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                      x 7→ tan x + ln tan(x)
                                                                                     12
                                                                                                                                                       
                                                                                     
                                                                                     3                                                                  R          →   R
6.1 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 ln
                                                                                     2
                                                                                                 6.4 b) . . . . . . . . . . . . . . . . . . . . .                       x e−2x
                                                                                                                                                        x          7 →   −
                                                                                                                                                                        2   4
                                                                               π
                                                                               √
6.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                  
                                                                                                                                           R∗+ → R
                                                                              3 3                6.4 c) . . . . . . . . . . . .                           √       
                                                                                                                                           x 7→ 2 arctan ex − 1
                                                                   1      2e + 1
6.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   ln
                                                                                                                                                     R∗+       →
                                                                                                                                                (
                                                                   2         3                                                                                     R
                                                                                                 6.4 d) . . . . . . . . . . . . . . . . .                          3      2

                                                                                             π                                                           x     7 →   ln(x 3 + 1)
6.2 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                         2
                                                                                             2
                                                                                                                                                            → R
                                                                                                                                  
                                                                                                                                        ]1, +∞[
                                                                                       1 π       6.4 e) . . . . . . . . . .                                         p
6.2 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         +                                                    x           7 → arctan x2 − 1
                                                                                       4   8



             Corrigés

                                                       π π              dt
                                                                 h             i
 6.1 a)        On pose t = sin θ avec θ ∈ − ,                 . On a         = cos θ et donc :
                                                       2 2              dθ
                       ˆ 1 p                   ˆ π p                                ˆ π                  ˆ π
                                                   2                                   2                     2 cos(2θ) + 1         π
                                1 − t2 dt =              1 − sin2 θ cos θ dθ =             cos2 θ dθ =                          = .
                         −1                      −π                                  − π                   − π         2           2
                                                    2                                   2                     2
..............................................................................................................................................................
                                √                                                  √                dt
 6.1 b)        On pose u = t avec t ∈ [1, 3], donc t = u2 et u ∈ 1, 3 . On a                              = 2u et donc dt = 2u du. Ainsi :
                                                                                                      du
                                ˆ 3                      ˆ √3                                  i√3
                                           1                       2u                                       π     π        π
                                                                                   h                                
                                     √       √ dt =                       du  =  2   arctan   u      =  2       −       = .
                                 1     t + t3              1    u + u3                           1          3      4       6
..............................................................................................................................................................
                                                                                                   dt     1                    du
 6.1 c)        On pose u = et avec t ∈ [0, 1], donc t = ln u et u ∈ [1, e]. On a                       = et donc dt =              . On obtient :
                                                                                                   du     u                     u
               ˆ 1              ˆ 1                    ˆ e                     ˆ e                                 ie
                     1                    2                    2 du                    1                                                    π
                                                                                                      h
                         dt =         t + e−t
                                                dt   =            1
                                                                         =   2              2
                                                                                              du =  2   arctan   u     = 2 arctan(e) − .
                0   cht          0   e                   1 u+ u       u         1   1 +   u                          1                      2
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                                         69
```

---
## PAGE 076

```text
                                                                                                                              ˆ 1             ˆ π
                                                         π        du
                                                    h       i                                                                                       2
 6.1 d)        On pose u = sin t avec t ∈ 0,               . On a    = cos t et donc du = cos t dt. Ainsi,                          u3 du =             sin3 t cos t dt.
                                                         2        dt                                                           0                0
                               ˆ π
                                                                1 4 1         1
                                   2
                                                           h      i
Finalement, on trouve                  sin3 t cos t dt =          u       = .
                                0                               4      0      4
..............................................................................................................................................................
                                                                                                                                    π               du
                                                                                                                              h        i
 6.1 e)        Remarquons qu’on a cos3 t = (1 − sin2 t) cos t. On pose u = sin t avec t ∈ 0,                                             . On a         = cos t et donc
                           ˆ 1                            ˆ π                                   ˆ π                                 2               dt
                                                                                                                                1 4 1 6 1              1   1      1
                                                              2                                     2
                                                                                                                            h                  i
du = cos t dt. Ainsi,          u3 (1 − u2 ) du =                 sin3 t cos3 t dt. Puis,              sin3 t cos3 t dt =          u − u             = − =           .
                            0                               0                                     0                             4          6      0    4   6     12
..............................................................................................................................................................
                                 √                                                                          dt
 6.1 f)        On pose u = t avec t ∈ [1, 4], donc t = u2 et u ∈ [1, 2]. On a                                    = 2u.
        ˆ 4                   ˆ 2                         ˆ 2                                       i2     du
                 1                      2u                          1
                                                                                     h
Ainsi,            √ dt =              2
                                                du = 2                    du = 2 ln(1 + u) = 2(ln(3) − ln(2)).
          1 t+       t         1 u +u                        1 1+u                                    1
..............................................................................................................................................................
                                                                                                        ˆ 1                      ˆ π
                                                                          du                                      1                         sin t
 6.2 a)        On pose u = cos t avec t ∈ [0, π]. On a                          = − sin t. Ainsi,                     2
                                                                                                                        du =                         dt et, finalement,
                                                                           dt                             −1  3 +   u              0   3  +   cos2 t
ˆ π                         ˆ 1                                                      1
         sin t            1                1                    1                 u               π
               2
                  dt =                    2 du = √ arctan √                               = √ .
 0 3 + cos t              3 −1               u                   3                 3            3    3
                                   1 + √3                                              −1

..............................................................................................................................................................
                                                                                                            dt        1                   1
 6.2 b)        On pose u = et avec t ∈ [0, 1], donc t = ln u et u ∈ [1, e]. On a                                 = donc dt = du.
                 ˆ 1                     ˆ e                         ˆ e                                    du  ie   u                    u
                          1                       1 1                          1                1                       1        2e + 1
                                                                                              h                                           
Finalement,                 −t
                                dt =                 1
                                                            du =                      du =         ln(2u + 1) = ln                           .
                  0 2+e                    1 2+ u u                    1 2u + 1                 2                 1     2            3
..............................................................................................................................................................
                                                         ˆ 4                           ˆ 1                                       i1
                                     1                               1                              1                                     π
                                                                                                                   h
 6.2 c)        En posant u = t − 1, on a                       √              dt = 2         √             du = arcsin u = .
                                     2                    2       4t − t2                0      4 − 4u2                           0       2
..............................................................................................................................................................
                                                              π               dt
                                                        h       i
 6.2 d)        On pose t = tan u avec u ∈ 0,                      . On a           = (1 + tan2 u).
        ˆ 1                      ˆ π                          4    ˆ π        du           ˆ π
                   1                  4         1                      4                      4 cos(2u) + 1               1       π
                                                                              2
Ainsi,               2 )2
                          dt  =                     2
                                                          du   =         cos    udu    =                          du = + .
          0   (1 +  t               0    1  +  tan     u            0                       0           2                 4       8
..............................................................................................................................................................
                                 1                √                     dt           1
 6.2 e)        On pose u = avec t ∈                    2, 2 . On a             = − 2.
        ˆ 2                       t   ˆ 1                                 du    ˆ 1   u
                                                                                                                           i 12
                   1                                1           1                           1                                           π
                                         2                                         2
                                                                                                              h
Ainsi, √ √                 dt = −               p                2
                                                                    du   =   −         √             du =  −    arcsin   u         =       .
            2 t t −1
                   2
                                        √1    1      1
                                                         −  1  u                  √1      1 −   u 2                           √1       12
                                          2 u      u2                               2                                           2
..............................................................................................................................................................
                                                                                                                dt
 6.2 f)        On pose u = ln(t) avec t ∈ [e, e2 ], donc t = eu et u ∈ [1, 2]. On a                                   = eu et :
                                                                                                                du
                                        ˆ e2                           ˆ 2                                         i2
                                                    ln t                         u                1                       1 5
                                                                                                h
                                                                                                               2
                                                               dt  =                   du   =        ln(1 +  u   )     = ln .
                                          e     t + t ln2 t              1 1+u
                                                                                     2            2                 1     2 2
..............................................................................................................................................................
                                      √              ˆ 4 √                ˆ 2
 6.3 a)        En posant u = t, on a                       e t dt =            2ueu du. Cette nouvelle intégrale peut se calculer en faisant une
                                                   ˆ 21                   h 1
                                                                                  i2 ˆ 2
intégration par parties. On trouve :                     2ueu du = 2ueu −                       2eu du = 2e2 .
                                                    1                            1     1
..............................................................................................................................................................
                                               ˆ 4      √                 ˆ 2                            ˆ 2
                                   √                ln t − 1                    ln(u − 1)
 6.3 b)        En posant u = t, on a                      √         dt = √                   2u du = 2 √ ln(u − 1) du.
                                                 3          t                 3      u                       3

On fait maintenant une intégration par parties :
              ˆ 2                 h                i2    ˆ 2         √          √              √
             2 √ ln(u − 1) du = 2 (u − 1) ln(u − 1) √ − 2 √ du = −2(( 3 − 1) ln( 3 − 1) − 4 + 2 3.
                         3                                                   3             3
..............................................................................................................................................................

70                                                                                                                                          Réponses et corrigés
```

---
## PAGE 077

```text
                                                                             π 2
                                                                        i      h
 6.4 a)       La fonction est bien continue. Soit (a, x) ∈ 0,                    .
                                                                             2
              ˆ x                                        ˆ x            t
                    cos t + sin t                             1 + cos
                                                                    sin t
On calcule                     2
                                    dt qui   est aussi              2
                                                                          dt en posant u = tan t.
                a    sin t cos t                           a    cos t
                                       ˆ x                         ˆ tan x                                itan x
          1                                  cos t + sin t                         1
                                                                                              h
On a            dt =  du   et, ainsi,                        dt =            1 +       du   =    u +  ln u         = tan x + ln tan(x) + Cste .
        cos2 t                           a    sin t cos2 t           tan a         u                        tan a
..............................................................................................................................................................
 6.4 b)     Cette fonction est définie sur R, y est continue et admet donc des primitives. Soit x ∈ R. On s’intéresse à
ˆ x
         1                                                                        dt  1
               dt dans laquelle on pose u = et , c’est-à-dire t = ln u. On a donc    = et ainsi :
 0   1 + th(t)                                                                    du  u
             ˆ x                      ˆ ex                         ˆ ex                                          iex
                       1                          1  1                      1   1      1        1 1                        x   e−2x
                                                                                              h
                             dt =                  1   du =                   + 3 du =   ln u −                        =     −      + Cste .
               0   1 + th(t)           1     1+
                                                u− u u              1      2u  2u      2        4 u2               1       2    4
                                                     1
                                                  u+ u


On pouvait aussi faire sans changement de variable en écrivant, pour t ∈ R :

                                                   1           1        et + e−t  1
                                                         =     t
                                                              e −e −t =      t
                                                                                 = (1 + e−2t ).
                                               1 + th(t)   1 + t −t        2e     2
                                                                    e +e
..............................................................................................................................................................
 6.4 c)       La fonction est définie sur R∗+ et y est continue.
                                                √                                                  dt         2u
Avec le changement de variable u =                et − 1, on a t = ln(1 + u2 ) et, ainsi,              =            .
                                                                                                   du      1 + u2
                              ˆ x                    ˆ ex −1
                                                        √
                                                                                                  i√ex −1
                                       1                         1 2u
                                                                                      h                                    √
Soit x > 0. On a ainsi             √          dt = √                      2
                                                                            du   =  2   arctan  u   √       = 2 arctan( ex − 1) + Cste .
                               1      e −1
                                       t
                                                         e−1     u 1 +  u                             e−1
..............................................................................................................................................................
 6.4 d)       La fonction est définie et continue sur R∗+ .
                                          √                                   dt
                                             t donne t = u3 et, ainsi,            = 3u2 . Soit x > 0. On a :
                                           3
Le changement de variable u =
                                                                              du
                 ˆ x                  ˆ √ 3x                   ˆ √ 3x                                    i√ 3x
                          1                     3u2                       3u              3                        3
                                                                                        h                                  2
                                                                                                 2
                           √3
                                dt =            3 +u
                                                        du  =            2 +1
                                                                                du  =       ln(u   +  1)       = ln(x 3 + 1) + Cste .
                  1 t+        t         1     u                  1     u                  2                1       2
..............................................................................................................................................................
 6.4 e)       La fonction est définie et continue sur ]1, +∞[.
                                           p                        p                        dt      u
Le changement de variable u =                  t2 − 1 donne t =         u2 + 1 et, ainsi,       = √        . Soient a > 1 et x > 1. On a :
                                                                                             du     u2 + 1
              ˆ x                      ˆ √x2 −1                                     ˆ √x2 −1
                         1                               1           u                              1                     p
                     √          dt = √               √           √          du = √                2
                                                                                                         du = arctan x2 − 1 + Cste .
                a t t −1                                                                a2 −1 u + 1
                         2                               2         u2 + 1
                                           a2 −1 u u + 1
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       71
```

---
## PAGE 078

```text
Fiche no 7. Intégration des fractions rationnelles


           Réponses

                                                       7.6 b). . . . . . . . A = −1 et B = 1                                                                 2
                                                 
                                                 3
                                                                                                                                                
7.1 a) . . . . . . . . . . . . . . . . . . ln                                                                                                          1                3
                                                 2                                                               7.11 a) . . . . . . . . .          x+              +
                                                                                                             4                                         2                4
                                                       7.6 c) . . . . . . . . . . . . . . . . . . . 2 ln
                                      1
                                            
                                            5                                                                3                                 2
7.1 b). . . . . . . . . . . . . . . .   ln                                                                                                    3      1
                                      2     3          7.7 a) . . . . . . . . . . . . . . . . . . − ln(3)        7.11 b). . . . . . . . 2 x −      −
                                                                                                                                              4      8
                                                   9                                                         4                        √                          √ 15
7.2 a) . . . . . . . . . . . . . . . . . . 2 ln        7.7 b) . . . . . . . . . . . . . . . . . . . 2 ln         7.11 c) . . .            2 x + 14
                                                                                                                                                       2
                                                                                                                                                            +     2
                                                  10                                                         3                                                      16
7.2 b) . . . . . . . . . . . . . . . . ln(a + 1)                                                       1 3                                a 2 3a3
                                                       7.7 c) . . . . . . . . . . . . . . . . . . .     ln       7.11 d) . . . . . . a x +     +
                                                                                                       2 2                                 2     4
                          3
7.3 a) . . . . . . . .      + ln(3) − ln(2)                                             1 1
                          2                                                               ln
                                                       7.7 d). . . . . . . . . . . . . . . . . . .                                                                      1
                                                                                        4 5                      7.12 a) . . . . . . . . . . . . . . . . . . . . . .
                                  1       51 21                                                                                                                         2
7.3 b) . . . . . . . . . −             +     ln                                     √       
                                48 64 19                                      1        a−a                                                                           2π
                                                       7.8 . . . . . . . . .  √  ln      √                       7.12 b). . . . . . . . . . . . . . . . . . .        √
                                                                           2 a     a+ a                                                                           3 3
                                                7
7.4 a) . . . . . . . . . . . . . . . . . . ln
                                                3                                                        1                                                           2π
                                                       7.9 a) . . . . . . . . . . . . . . . . .                  7.12 c) . . . . . . . . . . . . . . . . . . .       √
                                                                                                      a2 + x2                                                       3 3
                                  33
7.4 b) . . . . . . . . . . . . . . . . . . . ln                                                    x
                                  28                                                      1
                                                       7.9 b). . . . . . . . . . . .        arctan               7.12 d) . . . . . . . . . . . . . . . . . . ln(2)
                                                                                          a         a
                             √
                          q       
7.5 a) . . . . . . . . ln 2    2−1                                                                                                                     π
                                                                                                             π   7.13 a). . . . . . . . . . . . . . . . . . . . .
                                                       7.10 a) . . . . . . . . . . . . . . . . . . . . .                                               12
                                                                                                             4
                                         
                               1      a+1                                                                                                           a2
                                                                                                                                                       
7.5 b) . . . . . . . . . .       ln                                                                       π      7.13 b) . . . . . . . . . . . ln 2
                              2a       2               7.10 b). . . . . . . . . . . . . . . . . . .       √
                                                                                                         6 3                                       a −1

7.6 a) . . . . . . . . . . . . . . . . . . . 1 et 2                                                       π                                   1
                                                                                                                                                
                                                                                                                                                         π
                                                                                                                                                             
                                                       7.10 c) . . . . . . . . . . . . . . . . . . .      √      7.14 . . . . . . . . .          ln(2) + √
                                                                                                         2 2                                  3            3




           Corrigés

 7.1 a)        La fonction t 7−→ 1/(t + 1) est bien définie et continue sur [1, 2]. Une primitive de cette fonction est la fonction
                                    ˆ 2                             i2
                                           1                                                                                                           3
                                                       h                                                                                              
t 7−→ ln(t + 1). Donc, on a                     dt = ln(t + 1) = ln(3) − ln(2). Enfin, on remarque que ln(3) − ln(2) = ln                                  .
                                     1   t +  1                       1                                                                                2
..............................................................................................................................................................
                                                                                                                                               ln(2t + 1)
 7.1 b)       On procède comme précédemment, mais on remarque qu’une primitive de t 7−→ 1/(2t+1) est t 7−→                                                   :
                                                                                                                                                     2
attention à ne pas oublier le facteur 1/2 ! On calcule ensuite :
                                                ˆ 2                             2
                                                 1             ln(2t + 1)           ln(5) − ln(3)        1       5
                                                                                                                  
                                                      dt =                      =                     = ln           .
                                          1 2t + 1                   2        1
                                                                                            2            2       3
..............................................................................................................................................................

72                                                                                                                                           Réponses et corrigés
```

---
## PAGE 079

```text
                                                                                                                                               1       2
 7.2 a)       On commence par simplifier l’expression intégrée. Pour t ∈ R convenable, on a : t                                                  1
                                                                                                                                                   =     1
                                                                                                                                                           , en multipliant
                                                                                                                                             2
                                                                                                                                               + 4
                                                                                                                                                     t + 2
« en haut et en bas » par 2. Donc, on a :
                 ˆ       1                               ˆ       1                                i1
                                    1                                     1                              9      5                             9×8          9
                         16                                      16
                                                                                    h          16                             
                                  t
                                         dt = 2                               dt = 2 ln t + 12 1 = 2 ln    − ln                     = 2 ln          = 2 ln .
                     1
                                  2
                                    + 14                     1              1
                                                                         t+ 2                   8
                                                                                                        16      8                            5 × 16       10
                     8                                       8

Le résultat est strictement négatif puisque 9/10 < 1.
                                                                          1
C’est cohérent car on intègre une fonction positive ou nulle entre 81 et 16 , donc « à rebours ».
..............................................................................................................................................................
                              ˆ a2                              ia2
                                       1
                                                  h
                                                                     = ln(a + a2 ) − ln(a) = ln a(a + 1) − ln(a) = ln(a + 1).
                                                                                                                   
 7.2 b)        On calcule                   dt = ln(t + a)
                               0    t +  a                       0
..............................................................................................................................................................
 7.3 a)       On commence par faire la division euclidienne de l’expression t2 + t + 1 par t + 1. On trouve :

                                                                                  t2 + t + 1 = (t + 1)t + 1.

                                                 1 + t + t2           1
Donc, pour t ∈ R convenable, on a                            =t+          . Donc :
                                                    1+t             1+t
                              ˆ 2                  ˆ 2        ˆ 2
                                  1 + t + t2                        1         3               3
                                             dt =      t dt +            dt = + ln(3) − ln(2) = + ln(3) − ln(2).
                               1    1 +  t          1          1  1 +  t      2                2
Pour la seconde intégrale, on a utilisé un calcul fait précédemment.
..............................................................................................................................................................
                                                                                                                       3       7       51
                                                                                                                                
 7.3 b)        D’abord, on fait une division euclidienne et on trouve 3t2 + 2t + 1 = (4t + 5) t −                                   +      .
                                                                                                                       4      16       16
Puis, après calcul, on trouve :
                 ˆ 1                                                                              ˆ 1
                                  3     7       5    7     1                                                      1        1            19              1 21
                         2
                                                                                                          2
                                                                                                                                               
                                    t−    dt =    −    =−                                    et                       dt =   ln(7) − ln             =    ln .
                     1            4    16      96   96    48                                           1       4t + 5      4             3              4 19
                     3                                                                                 3

                                             1      51 21
Ainsi, l’intégrale cherchée vaut −              +       ln .
                                            48      64 19
..............................................................................................................................................................
 7.4 a)       On remarque que le numérateur est exactement la dérivée du dénominateur. On a donc :
                                                    ˆ 2                                   2
                                                                2t + 1                                          7
                                                                                   h                   i                               
                                                              2
                                                                       dt = ln(t2 + t + 1) = ln(7) − ln(3) = ln   .
                                                     1       t +t+1                       1                     3
..............................................................................................................................................................
 7.4 b)       On multiplie en haut et en bas par 2. On calcule :

                         ˆ 1                                 ˆ 1                                  i 1
                                           t                                2t                2                     11     7     11 × 9                    33
                                  2                                  2
                                                                                       h                                                      
                                                                                                       2
                                      t2
                                                 dt =                            dt = ln t2 +            = ln          − ln = ln                    = ln      .
                              1
                                      2
                                           +3  1                 1       t2 + 23              3        1
                                                                                                       3
                                                                                                                    12     9     12 × 7                    28
                              3                                  3

..............................................................................................................................................................
 7.5 a)       On calcule :

           ˆ √2 t + √1       ˆ √2      √
                                                          √ i 2
                                                               √
                                                                                   √ 
                           1      2t + 2      1                    1
                                                h
                      2                               2
                    √ dt =             √ dt =     ln(t + 2t)     =   ln(4) − ln(1 + 2)
            1
                2
               t + 2t      2  1
                                   2
                                  t + 2t      2                1   2
                                                        √
                                                                            √           p√
                                                              
                           1        4      1         4( 2 − 1)        1                       
                         = ln        √    = ln         √ √         = ln 4( 2 − 1) = ln 2    2−1 .
                           2     1+ 2      2     (1 + 2)( 2 − 1)      2
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                    73
```

---
## PAGE 080

```text
7.5 b)        On force la dérivée du dénominateur à apparaître au numérateur. On calcule :
           ˆ 1                           ˆ 1                                   1
                      t          1                    2at        1                  1                      1    a+1
                                                                          h            i                                                      
                                                                   ln(at2 + 1) 1 =
                                                                                                       
                           dt =                            dt =                       ln(a + 1) − ln(2) =    ln     .
             √1    at2 + 1      2a           √1
                                                      2
                                                    at + 1      2a             √   2a                     2a     2
               a                               a                                            a
..............................................................................................................................................................
7.6 b)        Supposons que A et B soient trouvés. En particulier, pour t convenable, on a :

                                                                     1      B(t − 1)
                                                                        =A+          .
                                                                    t−2      t−2
Cette égalité est encore valable pour t = 1 (par exemple par continuité). En évaluant en t = 1, on trouve A = −1.
De même, on trouve B = 1.
..............................................................................................................................................................
7.6 c)         D’après ce qui précède, on a :
 ˆ 4                         ˆ 4                              ˆ 4                             ˆ 4                                                        i4
             2                             2                               1                         1          1
                                                                                                                             h
                       dt =                          dt  =  2                        dt  =  2             −          dt = 2 ln(t − 2) − ln(t − 1)
   3 t − 3t + 2               3 (t − 1)(t − 2)                  3 (t − 1)(t − 2)               3 t−2         t−1
        2
                                                                                                                                                           3
                                                                    t−2 4                 2        1              2                       4
                                                              h           i                                              
                                                         = 2 ln                  = 2 ln − ln            = 2 ln + ln(2) = 2 ln .
                                                                    t−1 3                 3        2              3                       3
..............................................................................................................................................................
                                              1         1     1         1
                                                                            
 7.7 a)        Pour t ∈ [0, 1], on a 2              =              −           . Donc, on calcule :
                                           t −4         4 t−2         t+2
             ˆ 1                  ˆ 1                                                          i1 h 
                       4                    1          1                                                     2−t 1              1
                                                                   h                                                i
                           dt  =                −             dt = ln(2 − t) − ln(2 + t) = ln                             = ln = − ln(3).
               0   t 2 − 4          0    t −  2     t +   2                                      0           2  +  t    0       3
..............................................................................................................................................................
                                                      1          1       1
 7.7 b)        Déjà, pour t ∈ [2, 3], on a 2                =         − . Donc, on calcule :
                                                  t −t         t−1       t
          ˆ 3                   ˆ 3                                                 i3
                  2                      1       1                                                  t−1 3                  2        1            4
                                                              h                              h           i                        
                        dt = 2                 −       dt = 2 ln(t − 1) − ln(t) = 2 ln                           = 2 ln − ln              = 2 ln .
           2 t −t                      t−1
                2                                 t                                                    t                   3        2            3
                                  2                                                    2                       2
..............................................................................................................................................................
                                                                                                 1              1     1          1
                                                                                                                                     
 7.7 c)        Déjà, pour t ∈ [0, 1], on a t2 + 4t + 3 = (t + 1)(t + 3) et                                  =              −            .
                                                                                          (t + 1)(t + 3)        2 t+1          t+3
On calcule ensuite :
            ˆ 1                               ˆ 
                            1               1 1        1          1
                                                                      
                       2
                                     dt =                   −            dt
                  0 t + 4t + 3              2 0 t+1             t+3
                                                                           i1
                                            1                                     1         t+1 1           1      1        1        1 3
                                              h                                     h             i                        
                                        =        ln(t + 1) − ln(t + 3) =               ln                =      ln − ln          = ln .
                                            2                               0     2         t+3 0           2      2        3        2 2
..............................................................................................................................................................
                                                                                           
                                                           1      1         1        1
7.7 d)        Soit t ∈ [0, 13 ]. Déjà, on a                     =                −          . Puis, on calcule :
                                                        4t2 − 1   4       t − 12   t + 12
                   ˆ 1                          ˆ 1                          
                           3      1         1           3    1       1
                                       dt =                    1
                                                                 −                dt
                       0       4t2 − 1      4       0       t− 2   t + 12
                                                                                  i1            1
                                                                                                −t
                                                                                                     i 1          
                                                                                                                      1/6
                                                                                                                           
                                          1                                        1                           1                  1 1
                                                h                                       h
                                                                            3                           3
                                         =     ln( 12 − t) − ln(t + 12 )       =        ln 2 1             = ln                = ln .
                                          4                                 0      4         t+ 2       0      4      5/6         4 5
..............................................................................................................................................................
                                                                                                                                
                                                                                           1     1            1      1
7.8           Déjà, on remarque que, pour t ∈ R convenable, on a                               = √             √ −    √ . Donc, on a :
                                                                                        t2 − a  2 a         t− a   t+ a
                 ˆ a                       h √                                             √             a                √          
                         1             1                               √ ia           1             a−t                1           a−a
                              dt = √ ln( a − t) + ln(t + a) = √ ln                                    √          = √ ln               √ .
                  0 t −a
                       2             2 a                                            2 a          t+ a                2 a         a+ a
                                                                              0
                                                                                                               0
..............................................................................................................................................................

74                                                                                                                                   Réponses et corrigés
```

---
## PAGE 081

```text
                                                                                                1           1               1
7.9 a)        Notons f la fonction de l’énoncé. On a, pour x ∈ R, f ′ (x) =                         ×            = 2             .
                                                                                                a2            x 2       a  +  x2
                                                                                                       1+ a
..............................................................................................................................................................
                                                                      1            x
                                                                                  
 7.9 b)        D’après ce qui précède, la fonction x 7−→ arctan                          répond à la question.
                                                                      a            a
..............................................................................................................................................................
                      ˆ 1                                i1
                               1                                                                 π
                                           h
 7.10 a) On a                2 +1
                                    dt  =    arctan(t)       = arctan(1) − arctan(0) = .
                        0  t                              0                                      4
..............................................................................................................................................................
                      ˆ 1                                 1                                                  
                               1              1                t             1                 1                             1 π         π
 7.10 b) On a                2 +3
                                    dt = √ arctan √                     = √ arctan √                 − arctan(0) = √                = √ .
                        0  t                    3               3     0       3                 3                             3 6      6 3
..............................................................................................................................................................
7.10 c)       On a :

 ˆ 2                                           2
                                                                √ 
                                                                                                                
                                                                                                                      √ 
                                                                                                                                                             
          1                 1        t                   1                  −1                                1                   1
        2 +2
             dt =          √ arctan √                 = √ arctan 2 − arctan √                               = √ arctan 2 + arctan √                                .
   −1 t                      2        2            −1     2                  2                                 2                   2

                                                                                                                         1  π
Or, on sait (c’est un exercice « classique ») que, pour tout x > 0, on a arctan x + arctan                                 = . Donc, on a :
                                                                                                                         x  2
                                                               ˆ 2
                                                                    1             1 π         π
                                                                  2 +2
                                                                         dt = √         = √ .
                                                             −1  t                 2  2     2 2
..............................................................................................................................................................
7.11 a)       On force le terme en x à apparaître comme le second membre du développement d’une identité remarquable
(x + a)2 , où a est à déterminer. Puis, on force à apparaître le troisième terme de l’identité remarquable (ici, a2 ), qu’on
ajoute-soustrait. On trouve :

                                                 1                              1              1 2        1 2                   1 2 3
                                                                                                                                         
                 x2 + x + 1 = x2 + (2 ×            × x) + 1 = x2 + (2 × × x) +                       −          +1= x+                + .
                                                 2                              2              2          2                     2         4
..............................................................................................................................................................
7.11 b)       On procède comme précédemment mais on commence par factoriser par 2. On trouve :
                                                                                                            2         2                  
                                                               3     1                           3            3           3               1
                                                                             
                           2x2 − 3x + 1 = 2 x2 −                 ×x+              = 2 x2 − 2 ×     ×x+              −                 +
                                                               2     2                           4            4           4               2
                                                                            
                                                           3 2       1                 3 2 1
                                                                                           
                                            =2         x−        −         =2 x−             − .                                    (car 12 − 16 9
                                                                                                                                                    = − 16 1
                                                                                                                                                             )
                                                           4        16                 4         8
..............................................................................................................................................................
                             √            1       √       √            2 √ 15
 7.11 c) On trouve 2x2 + √ x + 2 = 2 x + 41 + 2 .
                                           2                                      16
..............................................................................................................................................................
                                                                                                        
                                                                                           a 2 a2                            a 2 3a3
                                                                                                                                        
              On trouve ax2 + a2 x + a3 = a x2 + ax + a3 = a                                              + a3 = a x +
                                                                     
7.11 d)                                                                                     x+  −                                  +        .
                                                                                           2        4                         2         4
..............................................................................................................................................................
                              ˆ 1                        ˆ 1
                                         1                        1                −1 1         1
                                                                                h        i
 7.12 a) On calcule                             2
                                                  dt =                2
                                                                         dt =                = .
                               0   1 +  2t +  t           0   (1 +  t)            1 +  t  0     2
..............................................................................................................................................................
                                                                         2
7.12 b)       Déjà, on a, si t ∈ R : t2 + t + 1 = t + 12                      + 34 . Donc, on calcule :

       ˆ 0                      ˆ 0                              ˆ 1                                                   1
                                                                                                                              2
               1                              1                      2          2  1    2θ
                      dt =                           dt =           √ 2 dθ = √ arctan √                                                     (en posant θ = t + 21 )
           1 + t + t2                        1 2            1
                                                  3
        −1                       −1       t+     +        −
                                                            2 θ2 +
                                                                      3          3        3                               −
                                                                                                                                  1
                                             2         4                                                                          2
                                                                                       2
                                                                                                             
                                  2                 1                       1             4                  1            4π          2π
                             = √ arctan √                 − arctan − √               = √ × arctan √                = √           = √ .
                                   3                 3                       3             3                  3           3×6        3 3
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                               75
```

---
## PAGE 082

```text
7.12 c)          On a :
         ˆ 1                     ˆ 1                                       ˆ 1/2
                   1                             1                                             1
                          dt =                            dt =                                  √ 2 dθ
          0    1 − t + t2         0       (t − 1/2)2 + 43                      −1/2
                                                                                        θ2 +        3
                                                                                                   2
                                  ˆ 1/2                                                                                                                                         √
                                                      1                             1        x 1/2    4        1  4 π    2π
                                                                                h                   i
                                                                                                                                                                                 3
                            =2                        √ 2 dθ = 2                    arctan       = √ arctan √ = √    = √ .                                        (avec a =   2
                                                                                                                                                                                   )
                                      0                    3                        a        a 0       3        3  3 6  3 3
                                              θ2 +        2
..............................................................................................................................................................
                                                                                                ˆ 1                             ˆ 1
                                                                                                    4        1                1 4              1
 7.12 d) Déjà, on a 6t2 − 5t + 1 = 6 t − 12 t − 13 , pour t ∈ R. Donc,
                                                                   
                                                                                                         2 − 5t + 1
                                                                                                                      dt  =                             dt.
                                                                                                  0   6t                      6   0     t − 2 t − 13
                                                                                                                                             1

                                                                                                                 
                                                                1                1                         1
Or, pour t ∈ R convenable, on a :                                            =6    1
                                                                                     −                                . Donc :
                                                                                                         t − 31
                                                              1
                                                                        1
                                                                           
                                                     t− 2           t− 3                 t− 2

ˆ 1                                                                  i1           1                1                                   
     4       1
                             h                            4                −t       4           1/4              1/2
                       dt = ln 12 − t − ln 13 − t               = ln 21                  = ln              − ln             = ln(3) − ln(3/2) = ln(2).
  0   6t 2 −  5t +  1                                        0             3
                                                                             −  t     0
                                                                                                 1/12              1/3
..............................................................................................................................................................
7.13 a)          On calcule :

               ˆ 2                                ˆ 2                                          ˆ 2                                           ˆ 2
                  3       1                          3               1                              3                     1                    3          1
                                  dt =                                                  dt =                                          dt =                               dt
                  1 3t2 + 2t + 10                                                                                  2
                                                                                                                                                              2
                                                      1        t2 + 23 t       + 10                  1                                          1
                                                                                                                      
                −
                  3             3                   −
                                                      3
                                                          3                       3                −
                                                                                                     3   3   t + 13 + 10
                                                                                                                      3
                                                                                                                         − 13                 −
                                                                                                                                                3   3 t + 13        +3
                                              ˆ
                                            1 1 1                   1                   π
                                              =              dθ = arctan(1) =              .
                                            3 0 θ2 + 1              3                  12
..............................................................................................................................................................
                 Déjà, on remarque qu’on a, pour t ∈ R convenable, t2 − (2a + 1)t + a2 + a = (t − a) t − (a + 1) et :
                                                                                                                                                                     
7.13 b)

                                                                    1                1         1
                                                                             =             −     .
                                                          (t − a) t − (a + 1)   t − (a + 1)   t−a

Donc, on a :
  ˆ 1                                               ˆ 1                                       
                                                                                                                                                i 1                          i1
                     1                                              1         1                                                                                     a+1−t
                                                                                                             h                                          h 
                                  dt =                                     −                       dt = ln a + 1 − t − ln a − t                         = ln
     0    t2 − (2a + 1)t + a2 + a                     0        t − (a + 1)   t−a                                                                    0                a−t        0
                                                                                                                     2
                                                                                                                              
                                                       a               a+1                    a
                                                                                           
                                                  = ln         − ln                = ln 2             .
                                                     a−1                 a                 a −1
..............................................................................................................................................................
                                                                                                                        ˆ 1
                                                     1        1      1          2−t                                            1
                                                                                         
 7.14          Déjà, pour t ∈ [0, 1], on a                 =              +                 . Ensuite,    on  calcule               dt = ln(2).
                                                  1 + t3      3 1+t          1 − t + t2                                   0 1+t
                                                          1                     3
                                   2−t        − (2t − 1) + 2
Puis, on remarque que                       = 2               et que :
                                 1 − t + t2      1 − t + t2
                                          ˆ 1                              i1
                                              2t − 1
                                                            h
                                                       dt = ln(1 − t + t2 ) = ln(1) − ln(1) = 0.
                                           0 1−t+t
                                                     2
                                                                            0

                                      ˆ 1
                                                  1           2π
Or, on a vu plus haut que                                dt = √ . Donc, on trouve :
                                          0   1 − t + t2     3 3
                                              ˆ 1                                                                                   
                                                 1           1              3      2π          1               π
                                                    3
                                                      dt =        ln(2) + × √              =       ln(2) + √ .
                                          0 1+t              3              2     3 3          3                3
..............................................................................................................................................................



76                                                                                                                                                         Réponses et corrigés
```

---
## PAGE 083

```text
Fiche no 8. Trigonométrie et nombres complexes

            Réponses
                                                                        π π
                                                                                                                      1         1         3          1
8.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos    ei 12                     8.3 c) . . . . − cos(6x) + cos(4x) − cos(2x) +
                                                                         12                                           8         4         8          4
                                                                   
                                                                      7π       5π                                                sin(9x)   3 sin(5x)   sin(3x)   3 sin(x)
8.1 b) . . . . . . . . . . . . . . . . . . . . . .        −2 cos           e−i 12                     8.3 d). . . . . −                  +           −         −
                                                                      12                                                            8           8         8          8
                                                                       π  −7iπ                                               cos(9x)   3 cos(5x)   cos(3x)   3 cos(x)
8.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 sin      e 12                      8.3 e) . . . . .                 +           +         +
                                                                        12                                                        8          8          8          8
                                                                        
                                                                         5π 5iπ                                               1          1         1
8.1 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos       e 12                     8.3 f) . . . . . . . . − sin(11x) + sin(5x) + sin(3x)
                                                                         12                                                   4          4         2
                                                                        π  13π                      8.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . 4 cos3 (x) − 3 cos(x)
8.1 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos         ei 12
                                                                         12
                                                                                                      8.4 b) . . . . . . . . . . . 4 cos3 (x) sin(x) − 4 cos(x) sin3 (x)
                                                                       π  11π
8.1 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 sin         e−i 24                   8.5 a). . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos(2x) cos(x)
                                                                        24
                                                                           π
                                                                             
                                                                     cos 12      13iπ                 8.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos(4x) sin(x)
8.1 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      π e
                                                                              24
                                                                     sin 24
                                                                                                      8.5 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 sin(x) sin(2x)
                                                                           π
                                                                                     iπ
8.1 h). . . . . . . . . . . . . . . . . . . . . . . . . . . 227 cos27          e      4
                                                                                                      8.5 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 sin(4x) cos(x)
                                                                           12
                                                                                                                                                                       sin 3x
                                                                         π  5π                                                                                               
8.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 cos      ei 12                                                                                          2 sin(2x)
                                                                                                      8.6 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                          12                                                                                                sin x2
                                                                                                                                                                                   
                                                                       π       π
8.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 sin       e−i 12                                                                                                      sin(8x)
                                                                         12                           8.6 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                                                         2 sin(x)
                                                        1          3
8.3 a). . . . . . . . . . . . . . . . . . . . . . . .     cos(3x) + cos(x)                            8.6 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 0
                                                        4          4
                                        1         1          1                                                                                                                            eπ + 1
8.3 b) . . . . . . . . . . . . . . . . − cos(4x) + cos(2x) −                                          8.7 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                        4         2          4                                                                                                                               2
                                                                                                                                                                                       1 π
                                                                                                      8.7 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .         (e − 2)
                                                                                                                                                                                       5



            Corrigés

                                                                                         π
                                     π         π
                                                       iπ       iπ
                                                                                            π
 8.1 a)           On a 1 + ei 6 = ei 12 e− 12 + e 12                      = 2 cos           ei 12 .
                                                                                         12
                                                                            |       {z        }
                                                                                    >0
..............................................................................................................................................................
                                                                           7π                           7π                                  7π
                              7π       7iπ
                                            7iπ         7iπ
                                                                          7iπ                       7iπ                            5π
 8.1 b)        On a 1 + ei 6 = e 12 e− 12 + e 12 = 2 cos                          e 12 = −2 cos                 e 12 e−iπ = −2 cos                 e−i 12 .
                                                                            12                          12                                  12
                                                                                |        {z       }
                                                                                         <0
..............................................................................................................................................................



Réponses et corrigés                                                                                                                                                                             77
```

---
## PAGE 084

```text
                                                                                          π                 π −i 12                       π − 7iπ
                              π                π           π            π                 π
                                                                                                                  π −i π
                                                                                                                                                   
              On a e−i 6 − 1 = e−i 12 e−i 12 − ei 12 = e−i 12 −2i sin
                                                                            
8.1 c)                                                                                           = 2 sin         e         2 = 2 sin           e 12 .
                                                                                         12                 12                            12
..............................................................................................................................................................
                                                                 5π                 5π
                               π            5π       5iπ
                                                                                 5iπ
 8.1 d)        On a 1 + iei 3 = 1 + ei 6 = e 12 2 cos                   = 2 cos           e 12 .
                                                                  12                12
..............................................................................................................................................................
                                                                                π                       π i 12 +iπ                 π i 12
                                 π         π        π        π 
                                                                               π                     π                        13π
 8.1 e)        On a −1 − ei 6 = −ei 12 e−i 12 + ei 12 = −2 cos                        ei 12 = 2 cos          e         = 2 cos          e     .
                                                                                12                     12                         12
                                                                                     |        {z        }
                                                                                              <0
..............................................................................................................................................................
                                                        π                  π i 24 −i π2                 π −i 24
                              π         π
                                                                      π                          11π
 8.1 f)        On a 1 − ei 12 = ei 24 −2i sin                  = 2 sin          e e         = 2 sin          e        .
                                                       24                  24                           24
..............................................................................................................................................................
8.1 g)        On fait le quotient de deux des résultats précédents.
..............................................................................................................................................................
                                                    π 27
                                                    π i 12                           π i4
                               π 27
                                                                                   π
 8.1 h)        On a 1 + ei 6          = 2 cos            e          = 227 cos27           e .
                                                    12                               12
..............................................................................................................................................................
                                              π+π               π−π              π−π
                                                                                         
                                                                                                             π
                                                                                                                
                         iπ        iπ        i 3 2 2        i 3 2 2             i 2 2 3                            5π
8.2 a)        On a e      3   +e    2   =e                 e            +e                    = 2 cos           ei 12 .
                                                                                                             12
                                                                                                   |    {z       }
                                                                                                        >0
..............................................................................................................................................................
                                              π+π               π−π              π−π
                                                                                         
                                                                                                                π                  π 5i 12             π
                         π         π          3   2             3   2            2   3
                                                                                                                      π
                                                                                                                                      π −i π
                                                                                                                                                            π
8.2 b)        On a ei 3 − ei 2 = ei             2          ei     2     − ei       2          = −2 sin             ie5i 12 = 2 sin    e      2 = 2 sin    e−i 12 .
                                                                                                                12                 12                  12
                                                                                                                                                 |   {z   }
                                                                                                                                                     >0
..............................................................................................................................................................
8.3 a)        On calcule :
                                                        ix                     3
                                                           e + e−ix 1 3ix
                                        cos3 (x) =                    e + 3e2ix e−ix + 3eix e−2ix + e−3ix
                                                                                                          
                                                                                     =
                                                              2     8
                                                     1 3ix  −3ix
                                                                  3 ix        1                3
                                                   =   e +e       +   e + e−ix = cos(3x) + cos x.
                                                     8              8              4             4
..............................................................................................................................................................
8.3 b)        On calcule :
                                                    2ix                     ix                      2
                                                       e        + e−2ix              e − e−ix                     1 2ix
                     cos(2x) sin2 (x) =                                                                             e + e−2ix e2ix − 2 + e−2ix
                                                                                                                                              
                                                                                                            =−
                                                                 2                     2i                         8
                                                 1 4ix
                                                   e + e−4ix − 2 e2ix + e−2ix + 2
                                                                                 
                                              =−
                                                 8
                                                 1         1           1
                                              = − cos(4x) + cos(2x) − .
                                                 4         2           4
..............................................................................................................................................................
8.3 c)        On calcule :
                                               2ix                     2  ix                    2
                                                   e       + e−2ix                e − e−ix                       1 4ix
                     2             2
                                                                                                                   e + 2 + e−4ix e2ix − 2 + e−2ix
                                                                                                                                                 
                 cos (2x) sin (x) =                                                                     =−
                                                            2                       2i                          16
                                               1 6ix
                                                 e − 2e4ix + e2ix + 2e2ix − 4 + 2e−2ix + e−2ix − 2e−4ix + e−6ix
                                                                                                                
                                           =−
                                              16
                                               1 6ix
                                                 e + e−6ix − 2(e4ix + e−4ix ) + 3(e2ix + e−2ix ) − 4
                                                                                                    
                                           =−
                                              16
                                              1         1           3            1
                                           = − cos(6x) + cos(4x) − cos(2x) + .
                                              8         4           8            4
..............................................................................................................................................................

78                                                                                                                                              Réponses et corrigés
```

---
## PAGE 085

```text
8.3 d)        On calcule :
                                    3ix               2ix                 3
                                      e     + e−3ix       e        − e−2ix              1 3ix
                        3
                                                                                           e + e−3ix e6ix − 3e2ix + 3e−2ix − e−6ix
                                                                                                                                  
          cos(3x) sin (2x) =                                                      =−
                                             2                     2i                  16i
                                       1 9ix
                                            e − e−9ix − 3(e5ix − e−5ix ) + e3ix − e−3ix + 3(eix − e−ix )
                                                                                                                         
                                =−
                                      16i
                                      1               3               1               3
                                = − sin(9x) + sin(5x) − sin(3x) − sin(x).
                                      8               8               8               8
..............................................................................................................................................................
8.4 a)        On calcule :

                  cos(3x) = Re(e3ix ) = Re (eix )3 = Re (cos(x) + i sin(x))3
                                                                                             

                            = Re(cos3 (x) + 3i cos2 (x) sin(x) − 3 cos(x) sin2 (x) − i sin3 (x))
                            = cos3 (x) − 3 cos(x) sin2 (x) = cos3 (x) − 3 cos(x)(1 − cos2 (x)) = 4 cos3 (x) − 3 cos(x).
..............................................................................................................................................................
8.4 b)        On calcule :

                     sin(4x) = Im(e4ix ) = Im (eix )4 = Im (cos(x) + i sin(x))4
                                                                                                 

                               = Im(cos4 (x) + 4i cos3 (x) sin(x) − 6 cos2 (x) sin2 (x) − 4i cos(x) sin3 (x) + sin4 (x))
                               = 4 cos3 (x) sin(x) − 4 cos(x) sin3 (x).
..............................................................................................................................................................
                                                                             x+3x
                                                                                                      
              On a cos(x) + cos(3x) = Re(eix + e3ix ) = Re ei                        (ei(−x) + eix ) = Re e2ix 2 cos(x) = 2 cos(2x) cos(x).
                                                                                                                                 
8.5 a)                                                                          2


..............................................................................................................................................................
              On a sin(5x) − sin(3x) = Im(e5ix − e3ix ) = Im e4ix (eix − e−ix ) = Im e4ix 2i sin(x) = 2 cos(4x) sin(x).
                                                                                                                           
8.5 b)
..............................................................................................................................................................
8.5 c)        On a :
                                                                                             x+3x
                                                                                                                        
                                      cos(x) − cos(3x) = Re(eix − e3ix ) = Re ei               2      (ei(−x) − eix )

                                                               = Re e2ix (−2i) sin(x) = 2 sin(x) sin(2x).
                                                                                          

..............................................................................................................................................................
              On a sin(3x) + sin(5x) = Im(e3ix + e5ix ) = Im e4ix (e−ix + eix ) = Im e4ix 2 cos(x) = 2 sin(4x) cos(x).
                                                                                                                           
8.5 d)
..............................................................................................................................................................
8.6 a)        Si x ∈ 2πZ, alors cette somme vaut 0. Sinon, on a :

                                          sin(x) + sin(2x) + sin(3x) = Im(eix + e2ix + e3ix )
                                                                             = Im 1 + eix + (eix )2 + (eix )3 .
                                                                                                                   

                                            1 − e4ix
Or, eix ̸= 1 donc 1 + eix + (eix )2 + (eix )3 =      .
                                            1 − eix
En utilisant maintenant l’astuce de l’arc-moitié, on obtient :
                                                                                   !                           !                     
                                                                                                                                3x
                                                               e2ix −2i sin(2x)                   3x sin(2x)           sin 2 sin(2x)
                  sin(x) + sin(2x) + sin(3x) = Im               ix             x
                                                                                  = Im ei 2                x
                                                                                                               =                         .
                                                               e 2 −2i sin 2                          sin 2                 sin x2
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       79
```

---
## PAGE 086

```text
8.6 b)        Si x ∈ 2πZ, alors cette somme vaut 4.
Si x est de la forme π + 2kπ avec k ∈ Z, la somme vaut −4.
Sinon, on calcule :

                           cos(x) + cos(3x) + cos(5x) + cos(7x) = Re(eix + e3ix + e5ix + e7ix )
                                                                               = Re eix 1 + (e2ix ) + (e2ix )2 + (e2ix )3
                                                                                                                                
                                                                                                                                     .

Or, e2ix ̸= 1 donc :

                                                                   1 − (e2ix )4       1 − (e8ix )      e4ix −2i sin(4x)        sin(4x)
           eix 1 + (e2ix ) + (e2ix )2 + (e2ix )3 = eix                          = eix             = eix ix              = e4ix
                                                      
                                                                                                                                       .
                                                                     1−e  2ix          1−e  2ix        e −2i sin(x)             sin(x)

Finalement, on a :
                                                                                        cos(4x) sin(4x)         sin(8x)
                                  cos(x) + cos(3x) + cos(5x) + cos(7x) =                                    =             .
                                                                                             sin(x)             2 sin(x)
..............................................................................................................................................................
8.6 c)        On calcule :
                                                                                                                                              
                                   2π                     4π
                                                                                  2π              4π
                                                                                                          
                                                                   = Re eix + ei(x+ 3 ) + ei(x+ 3 ) = Reeix 1 + j + j  = 0.            2
                                                                                                                                           
            cos(x) + cos x +                + cos x +
                                    3                      3                                                                |   {z        }
                                                                                                                                =0
..............................................................................................................................................................
8.7 a)        On calcule :
             ˆ π                      ˆ π                          ˆ π                         ˆ π                
                   ex sin(x) dx =            ex Im(eix ) dx =            Im(ex eix ) dx = Im           e(1+i)x dx
               0                        0                           0                              0
                                             (1+i)x π                 π+iπ                                                                  
                                               e                           e     −1            −eπ − 1                     (−eπ − 1)(1 − i)
                                                                                                             
                                  = Im                         = Im                       = Im                    = Im
                                                1+i       0
                                                                               1+i              1+i                               2
                                      eπ + 1
                                   =           .
                                          2
..............................................................................................................................................................




80                                                                                                                                       Réponses et corrigés
```

---
## PAGE 087

```text
Fiche no 9. Sommes et produits


            Réponses

9.1 a) . . . . . . . . . . . . . . . . n(n + 2)                                                           n(n+1)
                                                                                                                                                                    n+1
                                                          9.3 b) . . . . . . . . . . . . . . . . . . 3       2
                                                                                                                     9.7 d) . . . . . . . . . . . . . . . . . . .
                                                                                                                                                                     2n
                              7(n + 1)(n + 4)             9.4 a) . . . . . . . . . . . . . . . . . 5n (n!) 2
                                                                                                                 3
9.1 b) . . . . . . . . .                                                                                                                                             1
                                     2                                                                               9.8 a) . . . . . . . . . . . . . . . 1 −
                                                          9.4 b) . . . . . . . . . . . . . . . . . . . . . . . 0                                                    n+1
                                     n(5n + 1)
9.1 c) . . . . . . . . . . . . . . .                                                                 n(n + 1)                                               1   1
                                         2                9.5 a) . . . . . . . . . . . . . . . .                     9.8 b) . . . . . . . . . . . . . .       −
                                                                                                        2                                                   2 n+3
                                 (n − 2)(n − 7)
9.1 d) . . . . . . . . . .                                9.5 b) . . . . . . . . . . . . . . . . . . . . . . . 0     9.9 a) . . . . . . . . . . . . . . . . . 2n2 + n
                                       6
                              n(n + 1)(n + 2)             9.5 c) . . . . . . . n2n+1 + 2(1 − 2n )                                                            n(3n + 1)
9.2 a) . . . . . . . . .                                                                                             9.9 b) . . . . . . . . . . . . . .
                                     3                                                                                                                           2
                                                                                                   n2 (n + 1)2
                                        2                 9.5 d) . . . . . . . . . . . . . .                                                                 n2 (n + 1)
9.2 b) . . . . n(n + 1)(n + n + 4)                                                                      4            9.10 a) . . . . . . . . . . . . .
                                                                                                                                                                  2
                                     9 n−2                9.6 a) . . . . . . . . . . . . (n + 3)3 − 23
9.2 c) . . . . . . . . . . . . .       (3  − 1)                                                                                                                n(n + 3)
                                     2                                                                               9.10 b) . . . . . . . . . . . . . .
                                                          9.6 b) . . . . . . . . . . . . . . . . ln(n + 1)                                                        4
                                    5n+1 − 2n+1
9.2 d) . . . . . . . . . . . .                                                                           1                                                   n(n2 − 1)
                                         3                9.6 c) . . . . . . . . . . . . . 1 −                       9.10 c). . . . . . . . . . . . . .
                                                                                                      (n + 1)!                                                   2
                     7 n
9.2 e) . . . .         (7 − 1) + n(n + 4)                                                                                                 n(n + 1)(7n2 + 13n + 4)
                     6                                    9.6 d) . . . . . . . . . . . . . (n + 1)! − 1              9.10 d) . .
                                                                                                                                                    12
                                               n+1        9.7 a) . . . . . . . . . . . . . . . . . . . n + 1
9.2 f) . . . . . . . . . . . . . . . . . . .                                                                                                        n(n + 1)
                                                2n                                                                   9.10 e). . . . . . . . .                ln(n!)
                                                          9.7 b) . . . . . . . . . . . . . . . . . 1 − 4n2                                             2
9.3 a) . . . . . . . . . . . . . . . . . . 2q−p+1
                                                                                                                 1                              n(n + 1)(4n − 1)
                                                          9.7 c) . . . . . . . . . . . . . . . . . . . . . . .       9.10 f) . . . . . . .
                                                                                                                 n                                     6




            Corrigés

                                                            n+2              n+2
                                                            X                X
 9.1 a)           On utilise la formule suivante :                n=n              1 = (n + 2 − 1 + 1) × n = n(n + 2).
                                                            k=1              k=1
..............................................................................................................................................................
                                                                                 n+2
                                                                                 X          (n + 2 − 2 + 1)(n + 2 + 2)             7(n + 1)(n + 4)
 9.1 b)           On utilise la formule présente en prérequis :                         7k = 7 ×                                =                       .
                                                                                                            2                                2
                                                                          k=2
..............................................................................................................................................................
 9.1 c)           On utilise la linéarité de la somme :

                                 n                        n                      n
                                 X                        X                      X             3n(n + 1)              n(5n + 1)
                                       (3k + n − 1) = 3         k + (n − 1)             1=               + n(n − 1) =           .
                                                                                                   2                      2
                                 k=1                      k=1                     k=1
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                  81
```

---
## PAGE 088

```text
9.1 d)           On utilise la linéarité de la somme :

           n−1                 n−1                      n−1             n−1
                                                                                      !                                                          
                 k−4           1X           1                                                 1       (n − 2)(n + 1)                                      (n − 2)(n − 7)
           X                                            X               X
                             =    (k − 4) =                      k − 4            1       =                          − 4(n − 2)                       =                  .
                    3          3            3                                                 3             2                                                   6
           k=2                  k=2                      k=2             k=2
..............................................................................................................................................................
                                                                                      n                             n                       n             n
                                                                                      X                             X 2
                                                                                                                                            X 2
                                                                                                                                                          X
9.2 a)           On développe et utilise la linéarité de la somme                                 k(k + 1) =              k +k =                  k +           k.
                                                                                          k=1                       k=1                     k=1           k=1
                                                  n                                                           n
                                                  X 2        n(n + 1)(2n + 1)                X                   n(n + 1)(n + 2)
Puis, on utilise la formule suivante :                  k =                         . D’où        k(k + 1) =                           .
                                                                       6                                                   3
                                                 k=1                                         k=1
..............................................................................................................................................................
9.2 b)           On utilise la linéarité de la somme :

     n                         n             n
     X                         X             X               n2 (n + 1)2    n(n + 1)
           4k(k2 + 2) = 4        3
                                                                                     = n(n + 1)(n(n + 1) + 4) = n(n + 1)(n2 + n + 4).
                         
                                     k +8          k=4                   +8
                                                                  4            2
     k=0                       k=0           k=0
..............................................................................................................................................................
                                                                                                         n−1
                                                                                                         X  1 − 3n−1−2+1
                                                                                                             k                     9
9.2 c)           On utilise la formule pour les sommes géométriques : on a                                          3 = 32     = (3n−2 − 1).
                                                                                                                  1−3              2
                                                                                             k=2
..............................................................................................................................................................
9.2 d)           On factorise pour faire apparaître une somme géométrique :

                 n                    n                      n                                                                    2 n+1
                                                                                                                                        
                 X k n−k          n
                                      X k −k             n
                                                             X  2 k            1 − ( 25 )n−0+1                               1−                       5n+1 − 2n+1
                       2 5     =5           2 5    =5                     = 5n                                    =5   n+1          5
                                                                                                                                                  =               .
                                                                   5               1 − 25                                           3                      3
                 k=0                  k=0                    k=0
..............................................................................................................................................................
9.2 e)           On utilise la linéarité de la somme :

  n                               n               n                      n
  X                               X               X                      X                      7n − 1    n(n + 1)              7
        (7k + 4k − n + 2) =         k
                                        7 +4            k + (−n + 2)              1=7                  +4          + (−n + 2)n = (7n − 1) + n + 4.
                                                                                                   6         2                  6
  k=1                             k=1             k=1                    k=1
..............................................................................................................................................................
                                                                                                             n
                                                          1       2             n        1 X           n+1
 9.2 f)        On utilise la formule suivante : 2 + 2 + · · · + 2 = 2                            k=            .
                                                         n       n              n       n                2n
                                                                                            k=1
..............................................................................................................................................................
                                                          q
                                                          Y
9.3 a)           On utilise la formule suivante :                2 = 2 × · · · × 2 = 2q−p+1 .
                                                          k=p
..............................................................................................................................................................
                                                                                                                                   n 
                                                                                                                                   P
                                                             n                                                                               k
                                                          Y k                                                                                             n(n+1)
9.3 b)           On utilise la formule suivante :                3 = 31 × 32 × · · · × 3n = 31+···+n = 3                            k=1           =3         2       .
                                                          k=1
..............................................................................................................................................................
                                                      √         1
 9.4 a)        On factorise et on utilise que k = k 2 . On a :

                                             n                          n                          n
                                                                                                             ! 32
                                             Y √                    n
                                                                        Y         3           n
                                                                                                   Y                          3
                                                   5 k×k =5                   k   2   =5                 k          = 5n (n!) 2 .
                                             k=1                        k=1                        k=1
..............................................................................................................................................................
9.4 b)           Un produit est nul si l’un des termes est nul.
..............................................................................................................................................................



82                                                                                                                                                              Réponses et corrigés
```

---
## PAGE 089

```text
9.5 a)        Avec ce changement ou renversement, on a k = n + 1 − j, les bornes varient alors de n à 1, on les remet dans
                          n                          n
                          X                          X           n(n + 1)
le bon ordre. On a               n+1−k =                   j=             .
                                                                    2
                           k=1                       j=1
..............................................................................................................................................................
 9.5 b)    On utilise la linéarité de la somme et on effectue ce changement ou renversement dans la seconde. On a
k = n + 1 − j, les bornes varient alors de n à 1, on les remet dans le bon ordre. On a :
                                                           n             n                                n            n
                                                           X 1           X        1     X1 X1
                                                                     −                =    −   .
                                                                 k              n+1−k    k   j
                                                           k=1           k=1                          k=1             j=1
..............................................................................................................................................................
                                                                                                    n
                                                                                                    X
9.5 c)        Avec le changement d’indice, on a, en notant Sn =                                           k2k :
                                                                                                    k=1

                                               n−1
                                               X                               n−1
                                                                               X                    n−1
                                                                                                    X j+1               n−1
                                                                                                                        X              n−1
                                                                                                                                       X
                                                                 j+1                      j+1                                  j           j
                                    Sn =             (j + 1)2            =           j2         +         2       =2          j2 + 2         2
                                               j=0                             j=0                  j=0                 j=0            j=0
                                                " n                        #
                                                 X          j          n             1 − 2n
                                          =2               j2 − n2             +2           = 2Sn − n2n+1 − 2(1 − 2n ).
                                                                                      1−2
                                                     j=1


D’où Sn = n2n+1 + 2(1 − 2n ) = (n − 1)2n+1 + 2.
..............................................................................................................................................................
                         n+2                   n
                         X           3
                                               X 3          n2 (n + 1)2
9.5 d)        On a             (k − 2) =             j =                .
                                                                 4
                         k=3                   j=1
..............................................................................................................................................................
9.6 a)        On reconnaît une somme télescopique :

                          n+2
                          X
                                 (k + 1)3 − k3 = 33 − 23 + 43 − 33 + · · · + (n + 3)3 − (n + 2)3 = (n + 3)3 − 23 .
                           k=2
..............................................................................................................................................................
9.6 b)        On calcule :

             n                           n
                 k+1
             X                         X
                    ln              =          ln(k + 1) − ln(k) = ln(2) + · · · + ln(n + 1) − [ln(1) + · · · + ln(n)] = ln(n + 1).
                           k
             k=1                         k=1
..............................................................................................................................................................
9.6 c)        En écrivant k = k + 1 − 1, on a :

             n                       n
                               X k+1−1                            n                                               n                     
             X         k                                            X   k+1                1                          X   1         1                     1
                             =                                  =                     −                           =            −                 =1−            .
                    (k + 1)!     (k + 1)!                                    (k + 1)!   (k + 1)!                            k!   (k + 1)!              (n + 1)!
              k=1                   k=1                             k=1                                               k=1
..............................................................................................................................................................
9.6 d)        En écrivant k = k + 1 − 1, on a :

                    n                   n                              n                                          n
                    X                   X                              X                                          X
                          k × k! =             (k + 1 − 1)k! =                 [(k + 1) × k! − k!] =                    [(k + 1)! − k!] = (n + 1)! − 1.
                    k=1                  k=1                             k=1                                      k=1
..............................................................................................................................................................
                           n
                           Y k+1            2     3            n+1         n+1
9.7 a)        On écrit                  = × × ··· ×                    =           = n + 1.
                                   k        1     2              n            1
                           k=1
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                83
```

---
## PAGE 090

```text
 9.7 b)       Dans cet exemple, il faut aller un terme plus loin pour voir le télescopage :

                n
                Y 2k + 1               3  5 7        2(n − 1) + 1   2n + 1
                                  =      × × × ··· ×              ×
                      2k − 3          −1  1 3        2(n − 1) − 3   2n − 3
                k=1
                                   2(n − 1) + 1         2n + 1
                                  =                 ×             = −(2n − 2 + 1)(2n + 1) = −(2n − 1)(2n + 1) = 1 − 4n2 .
                                         −1                1
..............................................................................................................................................................
                                                                           n                        n
                                                                           Y 1       Y k−1 
                                                                                                         1
                                                                                                         
                                                                                                               2
                                                                                                                    
                                                                                                                             n−1         1
 9.7 c)       En mettant au même dénominateur :                                  1−
                                                                                  =                   = × × ··· ×                    = .
                                                                             k                k          2     3               n         n
                                                                 k=2                 k=2
..............................................................................................................................................................
 9.7 d)       Il faut remarquer l’identité remarquable et faire deux produits télescopiques :

                     n                       n  2                      n                                   n
                                                                                                                             !             n
                                                                                                                                                     !
                              1                  k −1                       (k − 1)(k + 1)                      k−1                          k+1
                     Y                       Y                           Y                                   Y                            Y
                           1− 2           =                           =                                  =                       ×
                             k                              k2                        k×k                               k                        k
                     k=2                      k=2                         k=2                                 k=2                          k=2
                                            1     2            n−1            3     4             n+1           1     n+1         n+1
                                                                                                                         
                                          =   × × ··· ×                  ×       × × ··· ×                  = ×               =          .
                                            2     3               n           2     3               n           n        2         2n
..............................................................................................................................................................
                                                                                          1          a        b
 9.8 a)        D’après la décomposition en éléments simples, on a                                = +              . En réduisant au même dénomi-
                                                                                     k(k + 1)        k     k+1
nateur et en identifiant, on trouve a = 1 et b = −1.
       n                      n
       X         1          X1            1                 1
D’où                     =          −           =1−             , en reconnaissant une somme télescopique.
             k(k + 1)             k     k+1              n+1
       k=1                  k=1
..............................................................................................................................................................
                                                                                             1                a           b
 9.8 b)        D’après la décomposition en éléments simples, on a                                       =           +         . En réduisant au même
                                                                                    (k + 2)(k + 3)          k+2        k+3
dénominateur et en identifiant, on trouve a = 1 et b = −1.
       n                               n
       X             1              X 1                1        1        1
D’où                            =                −           = −              , en reconnaissant une somme télescopique.
             (k + 2)(k + 3)              k+2         k+3        2     n+3
       k=0                          k=0
..............................................................................................................................................................
 9.9 a)       Séparons les termes d’indice pair et ceux d’indice impair. On a :

                       2n
                       X                           X                          X                              X                  X
                             (−1)k k2 =                     (−1)k k2 +                (−1)k k2 =                   k2 +                (−1)k2
                       k=0                     0⩽k⩽2n                      0⩽k⩽2n                        0⩽k⩽2n             0⩽k⩽2n
                                                  k pair                   k impair                      k pair             k impair

                                                   n               n−1                     n                 n−1
                                               X                   X                       X                 X
                                                       (2p)2 −           (2p + 1)2 =             4p2 −             4p2 + 4p + 1
                                                                                                                                       
                                           =
                                               p=0                 p=0                     p=0               p=0
                                                       n           n−1           n−1           n−1
                                                   X 2             X 2           X             X                        n(n − 1)
                                           =4              p −4           p −4         p−            1 = 4n2 − 4                 − n = 2n2 + n.
                                                                                                                           2
                                                   p=0             p=0           p=0           p=0
                                               |             {z           }
                                                            =4n2
..............................................................................................................................................................
 9.9 b)       Séparons les termes plus petits que n et les autres. On a :

              2n                      n                            2n
              X                       X                            X
                     min(k, n) =              min(k, n) +                  min(k, n)
               k=0                    k=0                          k=n+1
                                      n                    2n
                                      X                    X          n(n + 1)                         n(n + 1)        n(3n + 1)
                                  =           k+                 n=            + n[2n − (n + 1) + 1] =          + n2 =           .
                                                                         2                                2                2
                                      k=0              k=n+1
..............................................................................................................................................................

84                                                                                                                                                       Réponses et corrigés
```

---
## PAGE 091

```text
9.10 a)       Comme il n’y a que l’indice j dans la somme, nous pouvons factoriser :

                                                                       n
                                                                                     !       n
                                                                                                          !
                                                   X                   X                     X                     n(n + 1)    n2 (n + 1)
                                                            j=                   j                    1       =             n=            .
                                                                                                                      2             2
                                                  1⩽i,j⩽n              j=1                    j=1


..............................................................................................................................................................
9.10 b)       On somme d’abord sur l’indice i ; on calcule donc :

                                      n       j             n           j                 n                                           n                          n+1
                  X        i   XX i X 1 X    X 1 j(j + 1) 1 X           1X    n(n + 3)
                             =      =     i=     ×       =    (j + 1) =    k=          .
                           j      j   j        j     2     2            2        4
                1⩽i⩽j⩽n            j=1 i=1                 j=1         i=1               j=1                                          j=1                        k=2


Signalons que, en revanche, l’autre ordre de sommation ne permettait pas de conclure.
..............................................................................................................................................................
9.10 c)       Il faut faire attention à l’inégalité stricte :

                              n j−1                          n j−1                        j−1
                                                                                                      !        n                                          
         X                    X X                            X X                          X                    X   j(j − 1)
                (i + j) =                     (i + j) =                          i+               j       =                                + j(j − 1)
                                                                                                                              2
      1⩽i<j⩽n                 j=2 i=1                        j=2        i=1               i=1                     j=2
                              n h                                      n                     n
                                                                                                        !           "       n
                                                                                                                                      !                    n
                                                                                                                                                                     !        #
                                  3                 3                                                           3
                              X                        i               X                     X                              X                              X
                                              2                          2                                                    2
                          =               (j − j) =                              j −                j         =                   j        −1−                   j       +1
                                        2           2                                                           2
                              j=2                                      j=2                   j=2                            j=1                            j=1
                                                                                             
                            3 n(n + 1)(2n + 1)   n(n + 1)                                                 3n(n + 1)(2n + 1 − 3)   n(n + 1)(n − 1)   n(n2 − 1)
                          =                    −                                                  =                             =                 =           .
                            2        6              2                                                           3×2×2                    2              2

..............................................................................................................................................................
9.10 d)       On développe d’abord puis on choisit l’ordre de sommation qui semble faciliter les calculs :
  X                       X                                             X                                 X                      X
          (i + j)2 =                  (i2 + 2ij + j 2 ) =                                i2 + 2                     ij +                    j2
1⩽i⩽j⩽n                 1⩽i⩽j⩽n                                    1⩽i⩽j⩽n                          1⩽i⩽j⩽n                  1⩽i⩽j⩽n
                        n n
                                              !        n j
                                                                             !           n j
                                                                                                                   !        n              n
                                                                                                                                                 !             n             j
                                                                                                                                                                                       !       n             j
                                                                                                                                                                                                                       !
                        X X 2
                                                       X X                               X X 2
                                                                                                                            X          2
                                                                                                                                           X                   X             X                 X         2
                                                                                                                                                                                                             X
                    =                     i       +2                    ij           +                        j         =             i          1       +2              j         i       +         j             1
                        i=1       j=i                  j=1       i=1                      j=1         i=1                   i=1            j=i                 j=1           i=1               j=1           i=1
                        n                                   n                                   n                  n                                       n
                        X 2
                                                            X j(j + 1)                          X 3
                                                                                                                   X 2                                    X                               n2 (n + 1)2
                                                                                                                            i (n + 1) − i3 +                      (j 3 + j 2 ) +
                                                                                                                                                     
                    =         i (n − i + 1) + 2                    j                       +              j =
                                                                             2                                                                                                                  4
                        i=1                                  j=1                                j=1                 i=1                                     j=1
                                      n             n              n                     n                     2             2
                                      X 2
                                                    X 3
                                                                   X 3
                                                                                         X 2                  n (n + 1)
                    = (n + 1)                 i −           i +             j +                 j +
                                                                                                                  4
                                      i=1            i=1           j=1                   j=1

                             n(n + 1)(2n + 1)   n (n + 1)2                   2
                    = (n + 2)                 +
                                    6               4
                      n(n + 1)(7n2 + 13n + 4)
                    =                         .
                                12

..............................................................................................................................................................
9.10 e)       On calcule :

                                                                            n
                                                                                         !     n
                                                                                                                   !                  n
                                                                                                                                                           !
                  X           j
                                              X                             X                  X                          n(n + 1)    Y                              n(n + 1)
                          ln(i ) =                   j ln(i) =                       j                    ln(i)         =          ln   i                        =            ln(n!).
                                                                                                                             2                                          2
                1⩽i,j⩽n                   1⩽i,j⩽n                           j=1                 i=1                                                  i=1


..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                                                                   85
```

---
## PAGE 092

```text
9.10 f)       On fait une sommation par paquets :
                X                         X                          X                         X
                        max(i, j) =                max(i, j) +               max(i, j) +               max(i, j)
              1⩽i,j⩽n                    1⩽i<j⩽n                  1⩽j<i⩽n                   1⩽j=i⩽n

                                          X                 X          n
                                                                       X
                                     =             j+             i+         i
                                         1⩽i<j⩽n        1⩽j<i⩽n        i=1
                                          n j−1
                                          X X             n(n + 1)
                                     =2             j+                  par symétrie
                                                             2
                                          j=2 i=1
                                          n                                      n
                                          X                   n(n + 1)    X            n(n + 1)
                                     =2         j(j − 1) +             =2   j(j − 1) +
                                                                 2                        2
                                          j=2                                    j=1
                                          " n           n
                                                              #                                                             
                                           X 2          X         n(n + 1)    n(n + 1)(2n + 1)   n(n + 1)   n(n + 1)
                                     =2          j −          j +          =2                  −          +
                                                                     2               6              2          2
                                           j=1          j=1

                                         n(n + 1)                             n(n + 1)(4n − 1)
                                     =              (4n + 2 − 6 + 3) =                               .
                                             6                                          6
..............................................................................................................................................................




86                                                                                                                                   Réponses et corrigés
```

---
## PAGE 093

```text
Fiche no 10. Suites numériques

            Réponses
                                                                                                                                                                √
                                                    12    10.6 a) . . . . . . . . . . . . . . . . . . . . . 21                                                 π 5
10.1 a). . . . . . . . . . . . . . . . . . . . .                                                                  10.9 a) . . . . . . . . . . . . . . . . . .
                                                     5                                                                                                          5
                                                          10.6 b) . . . . . . . . . . . . . . . . . 10 000
10.1 b) . . . . . . . . . . . . . . . . . . . . . . 8                                                                                                           √
                                                          10.6 c) . . . . . . . . . . . . . . . . . . 2 001                                                   11 5
                                                   n+3
                                                                                                                  10.9 b) . . . . . . . . . . . . . . . . .
                            (2n + 5) × 2                  10.6 d) . . . . . . . . . . . . . . . . . 10 201                                                     25
10.1 c) . . . . . . .
                                   5                                                                              10.10 a) . . . . . . . . . . . 3n + (−2)n
                                                                                                           17
                                                          10.7 a). . . . . . . . . . . . . . . . . . . . .
                         3(2n + 1) × 23n+2                                                                 24
10.1 d) . . . . .                                                                                                 10.10 b). . . . . . . . . . . . . . . . . . . 211
                                 5                                                                                                          √                √
                                                                                                             1
                                                          10.7 b) . . . . . . . . . . . . . . . . . . . .                            (1 +       2)n − (1 −       2)n
10.2 a) . . . . . . . . . . . . . . . 2n ln(n)                                                              24    10.11 a) . .
                                                                                                                                                    2
                                                                                                             3                                                  √
10.2 b) . . . . . . . . . . . . . . 4n ln(2n)             10.8 a) . . . . . . . . . . . . . . . . . . .           10.11 b) . . . . . . . . . . . . . . . . . . 2 2
                                                                                                            512
10.3 a) . . . . . . . . . . . . . . . . . . . . . 13                                                              10.12 a) . . . . . . . . . . . . . . . . . . . 257
                                                                                                          3 069
10.3 b) . . . . . . . . . . . . . . . . . . . . . 29      10.8 b) . . . . . . . . . . . . . . . . .
                                                                                                           512    10.12 b). . . . . . . . . . . . . . . . 65 537
                                                      1
10.4 a) . . . . . . . . . . . . . . . . . . . . . 2   8                                                     3     10.12 c). . . . . . . . . . . . . . . . . . . . Fn
                                                          10.8 c) . . . . . . . . . . . . . . . . . .
                                                                                                          1 024
10.4 b) . . . . . . . . . . . . . . . . . . . . 2 64
                                                    1
                                                                                                                  10.12 d) . . . . . . . . . . . . . Fn+1 − 2
                                                                                                          6 141
10.5 a) . . . . . . . . . . . . . . . . . . . . . . 2     10.8 d) . . . . . . . . . . . . . . . . .               10.12 e) . . . . . . . . . Fn+1 + 22 +1
                                                                                                                                                              n
                                                                                                          1 024
10.5 b) . . . . . . . . . . . . . . . . . . . . . . 2                                                             10.12 f) . . . . . . . . . . . . . . . . . Fn+2



            Corrigés

                              2×0+3                     12
 10.1 a)         On a u0 =                 × 20+2 =         .
                                   5                     5
..............................................................................................................................................................
                              2×1+3                     5
 10.1 b) On a u1 =                         × 21+2 = × 8 = 8.
                                   5                    5
..............................................................................................................................................................
                              2(n + 1) + 3                        (2n + 5) × 2n+3
 10.1 c) On a un =                             × 2(n+1)+2 =                            .
                                     5                                      5
..............................................................................................................................................................
                               2 × 3n + 3                     3(2n + 1) × 23n+2
 10.1 d) On a u3n =                           × 23n+2 =
                                     5                                  5
..............................................................................................................................................................
 10.2 a)         On a t2n = ln((2n)2n ) − ln(22n ) = 2n ln(2) + 2n ln(n) − 2n ln(2) = 2n ln(n).
..............................................................................................................................................................
 10.2 b)         On a t4n = ln((4n)4n ) − ln(24n ) = 8n ln(2) + 4n ln(n) − 4n ln(2) = 4n ln(2) + 4n ln(n) = 4n ln(2n).
..............................................................................................................................................................
 10.3 a)         On a u1 = 2 × 1 + 3 = 5 et u2 = 2 × 5 + 3 = 13.
..............................................................................................................................................................


Réponses et corrigés                                                                                                                                               87
```

---
## PAGE 094

```text
10.3 b)       On calcule : u3 = 2 × 13 + 3 = 29.
..............................................................................................................................................................
                             qp
                                    √         1  1   1        1       1
 10.4 a) On a v3 =                    2 = 2 2 × 2 × 2 = 2 23 = 2 8 .
..............................................................................................................................................................
                                1 6        1        1
 10.4 b) On a v = 2( 2 ) = 2 26 = 2 64 .
                       6

..............................................................................................................................................................
                              1            4
 10.5 a) On a w1 = × 22 = = 2 et, de même, w2 = 2.
                              2            2
..............................................................................................................................................................
10.5 b)       On pourrait le démontrer formellement par récurrence.
..............................................................................................................................................................
10.6 a)       On a a100 = a0 + 100 × 2 = 201.
..............................................................................................................................................................
                                100 × (1 + 199)          100 × 200
 10.6 b) On a s100 =                                 =                 = 1002 = 10 000.
                                         2                     2
..............................................................................................................................................................
10.6 c)       On a a1 000 = 1 + 1 000 × 2 = 2 001.
..............................................................................................................................................................
                                101 × (1 + 201)           101 × 202
 10.6 d) On a s101 =                                 =                 = 1012 = 10 201.
                                          2                    2
..............................................................................................................................................................
                                                   2
                                b101 + b103          + 34       8+9
                                                                          17
 10.7 a) On a b102 =                           = 3         = 12 =            .
                                      2               2           2       24
..............................................................................................................................................................
                                               17      2      1
 10.7 b) On a r = u102 − u101 =                    − =           .
                                               24      3     24
..............................................................................................................................................................
                                   9
                                     1         3        3
 10.8 a) On a g9 = 3 ×                     = 9 =           .
                                     2         2      512
..............................................................................................................................................................
                                      1 − 2110       210 − 1        3 × 1 023        3 069
 10.8 b) On a σ10 = g0 ×                     1
                                                 =6              =               =          .
                                       1− 2              210           512            512
..............................................................................................................................................................
                                      10
                                       1                 1          3
 10.8 c) On a g10 = g0 ×                       = 3 × 10 =               .
                                       2                2        1 024
..............................................................................................................................................................
                                 211 − 1       3 × 2 047        6 141
 10.8 d) On a σ11 = 6                       =                =         .
                                   211           1 024          1 024
..............................................................................................................................................................
                                                  r                    r            √
                               p                      5π × 11π             π2     π 5
 10.9 a) On a h12 = h11 × h13 =                                     =          =        .
                                                       11 × 25             5        5
..............................................................................................................................................................
                                       √
                                      π 5        √                   √
                            h12         5       π 5 × 11          11 5
 10.9 b) On a r =                 = 5π      =                 =          .
                            h11        11
                                                  5 × 5π            25
..............................................................................................................................................................
10.10 a) L’équation caractéristique est r2 − r − 6 = 0 dont les racines sont 3 et −2. Ainsi un = α3n + β(−2)n avec
                                                                                     
                                                                                        α+β =1
α, β ∈ R. Les conditions initiales conduisent au système linéaire                                           dont les solutions sont α = β = 1.
                                                                                        3α − 2β = 1
..............................................................................................................................................................



88                                                                                                                                   Réponses et corrigés
```

---
## PAGE 095

```text
 10.10 b) D’après ce qui précède, on a u5 = 35 + (−2)5 = 35 − 25 = 211.
..............................................................................................................................................................
                                                                                                     √           √                     √               √
 10.11 a) L’équation caractéristique est ici r2 −2r−1 = 0. Ses racines sont 1+ 2 et 1− 2 et vn = λ(1+ 2)n +µ(1− 2)n
                                                                        1              1
avec λ, µ ∈ R. Les conditions initiales donnent ici λ = et µ = − .
                                                                        2              2
..............................................................................................................................................................
                                                                                                                                                         √
 10.11 b) Le plus simple (pour un si petit indice) est d’utiliser la relation de récurrence de la suite : v2 = 2v1 +v0 = 2 2.
                                                                                         √                √                 √              √
                                                                                  (1 + 2)2 − (1 − 2)2                3 + 2 2 − (3 − 2 2)               √
Pour travailler les identités remarquables, d’après le a) : v2 =                                                 =                                = 2 2.
                                                                                                 2                                2
..............................................................................................................................................................
                                  3
 10.12 a) On a F3 = 22 + 1 = 28 + 1 = 257.
..............................................................................................................................................................
                                  4
 10.12 b) On a F5 = 22 + 1 = 216 + 1 = 65 537.
..............................................................................................................................................................
                                                       n−1
                                                              2              n−1                 n
                                                                                    ×2
 10.12 c) On a (Fn−1 − 1)2 + 1 = 22                                + 1 = 22              + 1 = 22 + 1 = Fn .
..............................................................................................................................................................
                                                   n
                                                                  n
                                                                                       n+1
                                                                                                 
 10.12 d) On a Fn × (Fn − 2) = 22 + 1                              22 − 1 = 22                 − 1 = Fn+1 − 2.
..............................................................................................................................................................
                                     n
                                          2            n
                                                             2         n                n+1          n                n
 10.12 e) On a Fn2 = 22 + 1                    = 22               + 2 ×2 +1 = 22               + 1 + 22 +1 = Fn+1 + 22 +1 .
..............................................................................................................................................................
                                                                         n+1                                       n+1              n+1
                2
 10.12 f) On a Fn+1 − 2(Fn − 1)2 = Fn+2 + 2 × 22                                − 2(Fn+1 − 1) = Fn+2 + 2 × 22            − 2 × 22         = Fn+2 .
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       89
```

---
## PAGE 096

```text
Fiche no 11. Développements limités

             Réponses

                                                                                                                                                                            x3   x4
11.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 3x − x2 +                  −    + o (x4 )
                                                                                                                                                                            2    2   x→0

                                                                                                                                             3    11   25
11.1 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x − x2 + x3 − x4 + o (x4 )
                                                                                                                                             2    6    12   x→0


                                                                                                                                                                            x3   x5
11.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .      −    + o (x6 )
                                                                                                                                                                            2    24 x→0

                                                                                                                                                                  x3   x5   x6
11.1 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x + x2 +                 −    −    + o (x6 )
                                                                                                                                                                  3    30 90 x→0

                                                                                                                                ex 11ex2   7ex3   2 447ex4
11.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . e −            +     −      +          + O (x5 )
                                                                                                                                 2   24     16      5 760   x→0

                                                                                                                                             1      1        19 6
11.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1 − x2 − x4 −                x + O (x7 )
                                                                                                                                             4     96      5 760    x→0
                                                                                                                                                                
                                                                                                                                                             5
11.2 c). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . e 1 + ix − x2 − ix3 + o (x3 )
                                                                                                                                                             6      x→0


                                                                                                                                                  3
11.2 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1 − x + (x − 1)2 + o (x − 1)2
                                                                                                                                                                        
                                                                                                                                                  2           x→1


                                                                                                                                          3π 2 
                                                                                                                                                                     
                                                                                                                                                    π 2          π 2
11.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1 −          x−      + oπ x −
                                                                                                                                            8       3     x→ 3    3
                                                                                                                                              2                       3                     4 
                                                                                                    π                            π                   8    π                                 π
                                                                                                                                                       
11.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1 + 2 x −                        +2 x−                   +   x−                   + Oπ         x−
                                                                                                    4                            4                   3    4                  x→ 4           4

                                                                                                                    π2     π 4 π 2 
                                                                                                                                                           
                                                                                                                                          π 6          π 7
11.3 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . −1 +                 x−     −      x−      + oπ x −
                                                                                                                    8       2     48      2     x→ 2    2

                                                                                                                                                   1     1    1 2
11.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − +    −    x + o (x2 )
                                                                                                                                                  2x 12 720         x→0
                                                                                                                                                                      
                                                                                                                                          1    1      5     5           1
11.4 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .          −    +      −     +  O
                                                                                                                                          x2   x3    6x4   6x5 x→+∞ x6
                                                                                                                                                                    
                                                                                                                                                      1   1  1      1
11.4 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . − ln(x) + 1 −                       + 2− 3+ o
                                                                                                                                                     2x 3x  4x x→+∞ x3


                                                                                                                                             ex   7ex
                                                                                                                                                              x
                                                                                                                                      1                         e
11.4 d). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . e− 2 ex +    −    2
                                                                                                                                                         +   o
                                                                                                                                             3x 36x        x→+∞ x2




90                                                                                                                                                                            Réponses et corrigés
```

---
## PAGE 097

```text
         Corrigés

 11.1 a) Il suffit d’effectuer la somme des parties régulières des dévelopements limités à l’ordre 4 en 0 de sin(x) et
ln(1 + x). On écrit donc :
                                                                   
                                    x2     x3      x4                           x3                                  x3      x4
                  f (x) = 2 x −         +      −       + o (x4 ) + x −              + o (x4 ) = 3x − x2 +               −       + o (x4 ).
                                    2       3      4      x→0                    6     x→0                           2      2      x→0
..............................................................................................................................................................
 11.1 b) Il suffit d’effectuer le produit des parties régulières des dévelopements limités à l’ordre 4 en 0 de ln(1 + x) et
      1                                                                                                                1
de         et de ne conserver que les termes de degré au plus 4. Observez que le développement limité à l’odre 3 de
    x+1                                                                                                              x+1
suffit puisque celui de ln(1 + x) a son terme constant nul. On écrit donc :
                                                                                  
                                                   x2      x3     x4
                                                                                                                          
                                  f (x) =       x−     +       −      + o (x4 ) 1 − x + x2 − x3 + o (x3 )
                                                    2       3      4     x→0                                    x→0

                                                 3 2 11 3 25 4                         4
                                        =x− x +               x −       x + o (x ).
                                                 2         6        12         x→0
..............................................................................................................................................................
11.1 c)       Il suffit d’écrire :
                                                                                                      
                                                         x3                     x2      x4                      x3      x5
                    sin(x)(cosh(x) − 1) = x −                + o (x4 )              +       + o (x5 ) =             −       + o (x6 ).
                                                          6     x→0              2      24 x→0                   2      24 x→0
..............................................................................................................................................................
11.1 d)       Il suffit d’écrire :
                                                                                                                                
                         x                      x2   x3   x4   x5                                     x3   x5
                       e sin(x) =          1+x+    +    +    +    + o (x5 )                        x−    +    + o (x6 )
                                                2    6    24   120 x→0                                6    120 x→0
                                                    x3     x5      x6
                                    = x + x2 +          −      −       + o (x6 ).
                                                    3      30      90 x→0
..............................................................................................................................................................
 11.2 a)      En utilisant les développements limités en 0 de ln(1 + x) (à l’ordre 5) et de l’exponentielle (à l’ordre 4), on
obtient :
                                                                                                                         
                                           1         ln(1 + x)                 x  x2   x3   x4
                                 (1 + x)   x   = exp                  = exp 1 − +    −    +    + O (x5 )
                                                         x                     2  3    4    5   x→0
                                                                                                                          
                                                                               x  x2   x3   x4
                                                                      = e exp − +    −    +    + O (x5 ) .
                                                                               2  3    4    5   x→0


Puis :
                                                                                      2                      3                     !
                                     x2   x3   x4                      x2   x3                        x2
                                                                                                                                    4
                                  x                              1  x                           1  x                      1   x
              1
                                                                                                                               
    (1 + x)   x   =e 1+          − +    −    +                 +   − +    −                   +   − +                  +    −                + O (x5 ).
                                  2  3    4    5                 2  2  3    4                   6  2  3                  24   2                x→0



Observez qu’il n’est pas utile de faire apparaître tous les termes de la partie régulière du développement limité de
ln(1 + x)
          selon la puissance à laquelle on la considère. D’où :
    x
                                                   1         ex      11ex2       7ex3      2 447ex4
                                        (1 + x) x = e −          +           −          +               + O (x5 ).
                                                              2        24         16         5 760         x→0
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                       91
```

---
## PAGE 098

```text
 11.2 b)      On a :
                                                x2   x4    x6
                                   cos(x) = 1 −    +     −    + O (x7 )
                                                 2   24    720 x→0
                                       √        1          1           1
                                         u = 1 + (u − 1) − (u − 1)2 +    (u − 1)3 + O ((u − 1)4 ).
                                                2          8          16           u→1

Puis :                                                                                       2                 3
                       p                     1      x2     x4       x6        1      x2      x4          1       x2
                           cos(x) = 1 +          −      +      −           −       −      +          +        −          + O (x7 )
                                             2      2      24      720        8       2      24         16        2         x→0

                                             1 2       1 4        19 6
                                    =1− x −              x −            x + O (x7 ).
                                             4        96        5 760          x→0
..............................................................................................................................................................
                                            x2      x3                                                (x − 1)2         (x − 1)3
 11.2 c) On a : eix = 1 + ix −                          + o (x3 ) et ex = e + e(x − 1) + e                                        + o (x − 1)3 .
                                                                                                                                                       
                                                −i                                                                +e
                                            2        6     x→0                                             2               6         x→1
                                                                2
                                                              x2
                                                       ix  −
                                                                           (ix)3
                                            
                                 x2       x3                   2                                                          5
           ix
                                                                                                                               
D’où : ee = e + e ix −               −i         +e                    +e          + o (x3 ) = e 1 + ix − x2 − ix3 + o (x3 ).
                                  2       6                 2                6       x→0                                  6          x→0
..............................................................................................................................................................
                                                                                                        ln(2 − x)
 11.2 d) Établir l’existence et donner le développement limité de f (x) =                                            , en 1 à l’ordre 2, revient à le
                                                                                                             x2
                                                                                                 ln(1 − t)                                 t2
faire, en 0 à l’ordre 2, pour l’application g définie par g(t) = f (1 + t) =                              2
                                                                                                             . Or ln(1 − t) = −t −            + o (t2 ) et
                                                                                                  (1 + t)                                  2     t→0
                                   2
    1
               
           = 1 − t + o (t) = 1 − 2t + o (t). D’où :
(1 + t)2                   t→0                       t→0

                                                                    
                                                   t2                                                     3 2
                                                                                            
                                  g(t) =      −t −    + o (t2 )           1 − 2t + o (t) = −t +             t + o (t2 )
                                                   2   t→0                           t→0                  2    t→0


                                       3
                                         (x − 1)2 + o (x − 1)2 .
                                                                        
et f (x) = g(x − 1) = 1 − x +
                                       2               x→1
..............................................................................................................................................................
                                                                                        √ 
                                                                                  1        3         π                    π
                                                                                                                           
 11.3 a) La formule de Taylor-Young affirme que cos(x) = −                                     x−         + oπ x −              (observez que l’ordre 1
                                                                                  2       2          3        x→ 3         3
sera suffisant !) et :                                                                               
                                                                  1        π 2                      π 2
                                                                             
                                                 sin(t) = 1 −         t−          + oπ        t−            .
                                                                  2        2         t→ 2           2
                                                                         
                                 3π 2         π 2                       π 2
                                                 
D’où sin(π cos(x)) = 1 −                x−          + oπ          x−            .
                                   8          3         x→ 3            3
..............................................................................................................................................................
                                                t3
 11.3 b) On sait que tan(t) = t +                   + O (t4 ). Ainsi :
                                                 3     t→0


                                                       t3
                                                  1+t+    + O (t4 )                          
                  π          1 + tan(t)                                         t3                            4 3
                                                                                                                            
                                                       3   t→0                             4              2                4
          tan t +          =            =                           =   1 + t +    +  O  (t  )   1 + t + t  +   t +  O  (t   )
                  4          1 − tan(t)                t3                       3    t→0                      3     t→0
                                                  1−t−    + O (t4 )
                                                       3   t→0
                                                                                     8
                                                                    = 1 + 2t + 2t2 + t3 + O (t4 ).
                                                                                     3       t→0

                                                                                                                
                                                 π                π 2 8              π 3                       π 4
                                                                                  
D’où finalement tan(x) = 1 + 2 x −                    +2 x−             +      x−           + Oπ         x−            .
                                                 4                4         3        4         x→ 4            4
..............................................................................................................................................................




92                                                                                                                                   Réponses et corrigés
```

---
## PAGE 099

```text
                                                                                                      2                    4                        5 
                                                                                         1    π                 1    π                              π
                                                                                                                  
 11.3 c)      La formule de Taylor-Young affirme que sin(x) = 1−                           x−              +      x−             + oπ          x−              (observez
                                                                                         2    2                24    2            x→ 2              2
                                                              1
                                                                (t − π)2 + o (t − π)3 (observez que l’ordre 3 sera suffisant !).
                                                                                     
que l’ordre 5 sera suffisant !) et cos(t) = −1 +
                                                              2           t→π

D’où :
                                                                           2                        4  2                        7 
                                                1   π    π                         π     π                                        π
                                                                                            
                           cos(π sin(x)) = −1 +   −   x−                         +    x−                        + oπ           x−
                                                2   2    2                         24    2                          x→ 2          2
                                                         2            4         2               6                        
                                                        π          π         π          π                        π 7
                                                                                    
                                            = −1 +           x−          −        x−          + oπ          x−           .
                                                         8         2         48         2        x→ 2             2
..............................................................................................................................................................
 11.4 a)      On a :

               1       1                            1                   1
                     − 2 =                                          − 2
           x(ex − 1)  x                  x2   x3   x4   x5             x
                                    x x+    +    +    +    + o (x5 )
                                         2    6    24   120 x→0
                                                                                                     
                                    1                  1
                                =                                       − 1
                                                                           
                                    x2        x  x2   x3   x4
                                       
                                            1+ +    +    +    + o (x4 )
                                              2  6    24   120 x→0
                                                                                                     2                   3                               !
                                              x2   x3   x4                          x2   x3                            x2
                                                                                                                                      4
                                  1        x                                    x                                  x                  x                  4
                                = 2       − −    −    −     +                     +    +                   −         +           +           + o (x )
                                 x         2  6    24   120                     2   6    24                        2   6              2         x→0

                                       1       1       1 2
                                =−         +      −        x + o (x2 ).
                                      2x      12      720        x→0
..............................................................................................................................................................
                                                                                                         1
                                                                                                        
                                                                                                   sin
 11.4 b) Établir l’existence et donner le développement limité de f (x) =                                x   , en +∞ à l’ordre 5, revient à le faire,
                                                                             t sin(t)             x+1
                                                                             1
en 0 à l’ordre 5, pour l’application g définie par g(t) = f                       =           . Or, on a :
                                                                             t         1+t

                                                    t4                                    1
                                t sin(t) = t2 −        + O (t6 )           et                = 1 − t + t2 − t3 + O (t4 ).
                                                    6   t→0                              1+t                    t→0


                             5 4 5 5                                      1       1       5        5                  1
                                                                                                                                
D’où g(t) = t2 − t3 +          t − t + O (t6 ), puis f (x) = 2 − 3 + 4 − 5 + O                                            .
                             6       6       t→0                         x       x      6x        6x      x→+∞ x6
..............................................................................................................................................................
                                                                                        1                           1       1        1                 1
                                                                                                                                                   
 11.4 c) On a : x ln(x + 1) − (x + 1) ln(x) = − ln(x) + x ln 1 +                             = − ln(x) + 1 −            + 2 − 3 + o                         .
                                                                                        x                          2x      3x       4x      x→+∞ x3
..............................................................................................................................................................
 11.4 d)      On a :
                                             x 2
                                        1                      1
                                                                             
                                          +1   = exp x2 ln 1 +
                                        x                      x
                                                                            
                                                       2  1    1  1   1       1
                                               = exp x      − 2 + 3 − 4 + o
                                                          x   2x 3x  4x  x→+∞ x4
                                                                                                              
                                                                       1   1       1
                                                                                                      
                                                        x −1
                                                    =e e   2      exp    − 2 + o
                                                                      3x  4x  x→+∞ x2

                                                                     ex       7ex                  ex
                                                          1
                                                                                                            
                                                    = e− 2 ex +          −        2
                                                                                      + o                .
                                                                     3x      36x         x→+∞ x2
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                                 93
```

---
## PAGE 100

```text
Fiche no 12. Décomposition en éléments simples


            Réponses

                                                        1     1    7                                        1        3        X −1
12.1 a). . . . . . . . . . . . . X − 3 −                  +     +            12.6 b). . . . . .                  −        +
                                                        X   X +1 X +2                                    2(X − 1) 2(X + 1) X 2 + X + 1
                                           2      1        3                 12.7 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1 − 2 ln(3)
12.1 b) . . . . . . . . . . . 1 −            +         +
                                           X   2(X + 1) 2(X − 1)
                                                                                                                                      1       2
                                                       π        π            12.7 b) . . . . . . . . . . . . . . . . . . . . . . . . − ln(3) + ln(2)
12.1 c). . . . . . . . . . . . . . . . . 1 +                −                                                                         2       3
                                                    2(X − π) 2(X + π)
                                                                                                                                        2
                                 e−1              1                          12.7 c) . . . . . . . . . . . . . . . . . . . . . . .        − 4 ln(2) + 2 ln(3)
12.2 a) . . . . . . . . . .               +                                                                                             3
                            (e − 2)(X + e) (2 − e)(X + 2)
                                                                                                                                     1  1       2
                                                                             12.7 d) . . . . . . . . . . . . . . . . . . . .           − ln(5) + ln(2)
                              3       1+i      1−i                                                                                  18 9        9
12.2 b). . . . . . . . . .         −        −
                           2(X − 1) 4(X − i) 4(X + i)                                                                                                                     π
                                                                             12.7 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                      5                          4                                                                                                        8
12.2 c) . 1 − √                   √             √        − √   √ √
                        ( 2+          3)(X +        3)    ( 2 + 3)( 2 − X)                                                                     1        1
                                                                             12.7 f) . . . . . . . . . . . . . . . . . . . . . . . . . .         ln(2) − ln(3)
                          −3     1     2      1                                                                                                2        4
12.3 a) . . . . .             +     +     +
                         X − 2 X − 3 X − 1 (X − 1)2                                                                                                     1    x−1
                                                                             12.8 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .        ln
                    2   2      11          3          3                                                                                                 2    1+x
12.3 b) . .           + 2 −          +           +
                    X  X    4(X − 1)   2(X − 1)2   4(X + 1)
                                                                                                                                                  1
                                                                             12.8 b) . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→
                                   1        1       1+π                                                                                      4(1 − 2x)2
12.3 c) . . . . . . . . . .            − 2       −
                                  π2 X  π (X + π) π(X + π)2                                                                                           
                                                                                                                                        1           x
                           2      1        2           1
                                                                             12.8 c) . . . . . . . . . . . . . . . . . . . . . . . . . √ arctan √
12.3 d). . . . . .        X−i + (X−i)2 − X−(1+i) + (X−(1+i))2
                                                                                                                                         2           2
                                                                                                                                                      
                        1       1        1 + 3i     1 − 3i                                                                  2              2        1
12.4 a) . . .              −          −          −                           12.8 d) . . . . . . . . . . . . . . . . . √ arctan √ X + √
                      X +1   2(X − 1)   4(X − i)   4(X + i)                                                                   3             3        3

                    1      5        2        1                               12.8 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2
12.4 b) .             +         +        +         .
                   2X   6(X + 2) 3(X − 1) (X − 1)2                                             x2
                                                                             12.8 f) .          2
                                                                                                  + 2x + 61 ln |x + 1| − 12 ln |x − 1| + 16
                                                                                                                                          3
                                                                                                                                            ln |x − 2|
                                                            1      1   1
12.5 a) . . . . . . . . . . . . . . . . . . . . . . .            −   +       12.8 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                         2(n + 1) 2n 4                                                            √                
                                                                              x 7−→ 16 ln(x2 + 2) − 31 ln |x + 1| +                   3
                                                                                                                                       2
                                                                                                                                         arctan        x
                                                                                                                                                       √
                                                                                                                                                        2
                                                                 2  1  1
12.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . . −      + −
                                                                n+2 n 3                                                            1 2x − 1 1   1−x
                                                                             12.8 h). . . . . . . . . . . . . . x 7−→                      + ln
                                         2      1      1 − 2X                                                                      2 x2 − 1 2   1+x
12.6 a) . . . . . . . . . . . . .           +       2
                                                      + 2
                                       X + 1 (X + 1)   X +1




94                                                                                                                                            Réponses et corrigés
```

---
## PAGE 101

```text
         Corrigés

12.1 a)       Pour commencer, effectuons la division euclidienne de X 4 − 2 par X(X + 1)(X + 2) = X 3 + 3X 2 + 2X : on
trouve X 4 − 2 = (X 3 + 3X 2 + 2X)(X − 3) + 7X 2 + 6X − 2. Ainsi, on a :

                                                   X4                 7X 2 + 6X − 2
                                                              =X −3+                 .
                                              X(X + 1)(X + 2)        X(X + 1)(X + 2)
On écrit ensuite la décomposition en éléments simples de la fraction rationnelle précédente :

                                                   7X 2 + 6X − 2    a     b      c
                                                                  =   +      +      .
                                                  X(X + 1)(X + 2)   X   X +1   X +2
Pour calculer a, on multiplie la fraction par X, on l’écrit sous forme irréductible, et on évalue en 0 :

                        7X 2 + 6X − 2        7X 2 + 6X − 2                                  −2
                                       ×X =                , ce qui, évalué en 0, donne a =    = −1.
                       X(X + 1)(X + 2)      (X + 1)(X + 2)                                   2

Pour calculer b, on multiplie la fraction par X + 1, on l’écrit sous forme irréductible, et on évalue en −1 :

              7X 2 + 6X − 2              7X 2 + 6X − 2                                     7−6−2
                             × (X + 1) =               , ce qui, évalué en −1, donne b =              = 1.
             X(X + 1)(X + 2)               X(X + 2)                                      (−1)(−1 + 2)
Enfin, pour c :

          7X 2 + 6X − 2              7X 2 + 6X − 2                                    28 − 12 − 2   14
                         × (X + 2) =               , ce qui, évalué en −2, donne c =              =    = 7.
         X(X + 1)(X + 2)               X(X + 1)                                      (−2)(−2 + 1)    2
D’où :
                                                   7X 2 + 6X − 2    −1     1      7
                                                                  =    +      +      .
                                                  X(X + 1)(X + 2)   X    X +1   X +2
Donc :
                                                    X4 − 2                           1         1           7
                                                                     =X −3−             +            +           .
                                             X(X + 1)(X + 2)                         X      X +1        X +2
..............................................................................................................................................................
12.3 a)       Pour cette décomposition en éléments simples, pas de partie entière. On écrit la décomposition théorique :

                                            X +1               a       b         c      d
                                                           =      +          +      +      .
                                   (X − 1)2 (X − 2)(X − 3)   X −1   (X − 1)2   X −2   X −3

Par les méthodes du premier exercice, on détermine facilement c = −3 et d = 1. De même, en multipliant par (X − 1)2
et en évaluant en 1, on obtient b = 1. Ensuite, en évaluant en 0, on obtient :
                                                              1   a       c   d
                                                                =    +b+    +    ;
                                                              6   −1     −2   −3
                  3  1 1
donc a = 1 +        − − = 2. Ainsi :
                  2  3 6
                                                X +1                       −3           1            2             1
                                                                     =            +           +           +               .
                                   (X − 1)2 (X − 2)(X − 3)               X −2        X −3        X −1         (X − 1)2
..............................................................................................................................................................
 12.4 a) Il suffit de remarquer que X 4 − 1 = (X − 1)(X + 1)(X − i)(X + i) et de se ramener à la méthode des pôles
simples vue précédemment !
..............................................................................................................................................................
12.4 b)       Il faut remarquer que X 4 − 3X 2 + 2X = (X − 1)2 (X + 2)X, puis utiliser les méthodes des pôles multiples !
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                       95
```

---
## PAGE 102

```text
                                                                          1
12.5 a)       Si l’on considère la fraction rationnelle                            , alors :
                                                                   (X − 1)X(X + 1)
                                                    1          1     1          1
                                                             =− +          +          .
                                             (X − 1)X(X + 1)   X  2(X + 1)   2(X − 1)
Ainsi :
                                                 1          1     1          1
                                                          =− +          +
                                          (k − 1)k(k + 1)   k  2(k + 1)   2(k − 1)
                                                                                                               
                                                                      1        1               1      1
                                                                 =          −    −               −          .
                                                                   2(k + 1)   2k              2k   2(k − 1)

Donc :
                             n                               n                                              
                             X            1          X    1        1                         1      1
                                                   =            −    −                         −
                                   (k − 1)k(k + 1)     2(k + 1)   2k                        2k   2(k − 1)
                             k=2                            k=2
                                                                                                      
                                                                 1           1        1          1
                                                        =               −       −        −                                              (par télescopage)
                                                            2(n + 1)        2n        4     2(2 − 1)
                                                                 1           1      1
                                                         =              −       + .
                                                            2(n + 1)        2n      4
..............................................................................................................................................................
12.5 b)       On remarque que :

                                              k2 − 5k − 2        1   2      2      1
                                                                = +     −       −
                                         (k − 1)k(k + 1)(k + 2)  k  k+1   k+2     k−1
                                                                 1   2        1      2
                                                                                      
                                                                = −     −        −       .
                                                                 k  k+2     k−1    k+1
                                                                        2        1     1
Par télescopage, on obtient que cette somme vaut −                           + − .
                                                                     n+2         n     3
..............................................................................................................................................................
12.6 a)       Déjà, il n’y a pas de partie entière. Ensuite, la forme de la décomposition en éléments simples est :

                                                              a       b      cX + d
                                                                 +          + 2     .
                                                            X +1   (X + 1)2  X +1

En multipliant par (X + 1)2 et en évaluant en −1, on obtient b = 1.
En évaluant en 0, on obtient :
                                                   4 = a + b + d,
donc a + d = 3.
En multipliant par X, en évaluant en x ∈ R et en faisant tendre x vers +∞, on obtient :

                                                                        0 = a + c,

donc c = −a.
Enfin, en évaluant en 1, on obtient :
                                                                  6  a b  c+d
                                                                    = + +     .
                                                                  8  2 4   2
Donc :
                                                                  3 = 2a + b + 2c + 2d.
Soit, comme a + c = 0, et b = 1, on en déduit que 2d = 3 − 1 = 2, donc d = 1.
Donc a = 2, donc c = −2. Donc :
                                                    2X + 4                   2             1          1 − 2X
                                                                      =            +               + 2          .
                                             (X + 1)2 (X 2 + 1)           X +1        (X + 1)2        X +1
..............................................................................................................................................................


96                                                                                                                                   Réponses et corrigés
```

---
## PAGE 103

```text
                                                                                        X2 + 1
12.7 a)       On effectue la décomposition en éléments simples de                                   :
                                                                                     (X − 1)(X + 1)

                                                        X2 + 1            1      1
                                                                    =1−      +      .
                                                     (X − 1)(X + 1)     X +1   X −1
Ainsi :
                          ˆ 1/2                              ˆ 1/2
                                     x2 + 1                                 1     1
                                                dx =                  1−       +     dx
                            −1/2 (x − 1)(x + 1)                −1/2        x+1   x−1
                                                                  h                                 i1/2
                                                          = 1 + − ln(x + 1) + ln(1 − x)
                                                                                                      −1/2
                                                                        3           1            1           3
                                                                                                        
                                                          = 1 − ln          + ln         + ln        − ln         = 1 − 2 ln(3).
                                                                        2           2            2           2
..............................................................................................................................................................
12.7 e)       On remarque que :
                 ˆ 1/2                      ˆ 1/2                                         i1/2
                              1                          1                1                         1                                    π
                                                                        h
                             2 +1
                                    dx  =                2 +1
                                                                dx   =      arctan(2x)          = (arctan(1) − arctan(0)) = .
                   0     4x                  0     (2x)                   2                 0       2                                    8
..............................................................................................................................................................
                                                                                                   X
 12.7 f)       On effectue la décomposition en éléments simples sur R de 4                                .
                                                                                                X −1
On a X 4 − 1 = (X − 1)(X + 1)(X 2 + 1). Donc, on écrit :

                                                       X         a      b   cX + d
                                                             =      +      + 2     .
                                                      X4 − 1   X −1   X +1  X +1
                                  1      1                                                                   1
Par la méthode déjà décrite, a = , b = . En multipliant par x et en faisant x → +∞, 0 = a + b + c, donc c = − .
                                  4      4                                                                   2
Enfin, en évaluant en 0, −a + b + d = 0 donc d = 0. Donc :
                               X          1          1          X            X            X
                                     =          +          −            =            −            .
                              X4 − 1   4(X − 1)   4(X + 1)   2(X 2 + 1)   2(X 2 − 1)   2(X 2 + 1)
Ainsi :
                           ˆ 3                      ˆ
                                     x            1 3 x                   x
                                          dx  =                    − 2          dx
                             2 x −1               2 2 x2 − 1
                                   4                                   x +1
                                                                                         i3
                                                  1 1                     1
                                                    h
                                              =         ln(x2 − 1) − ln(x2 + 1)
                                                  2 2                     2                2
                                                  1
                                              = (ln(8) − ln(10) − ln(3) + ln(5))
                                                  4
                                                  1                                                         1           1
                                              = (3 ln(2) − ln(2) − ln(5) − ln(3) + ln(5)) = ln(2) − ln(3).
                                                  4                                                         2           4
..............................................................................................................................................................
                               1              1                1                                                   1              1
 12.8 a) On écrit 2                   =               −               , donc une primitive de x 7−→                       −               est :
                           X −1          2(X − 1)        2(X + 1)                                             2(x − 1)        2(x + 1)
                                                         1                 1                  1     x−1
                                                x 7−→      ln |x − 1| − ln |x + 1| = ln                      .
                                                         2                 2                  2     1+x
..............................................................................................................................................................
12.8 c)       On écrit, pour x ∈ R :
                                                                  1     1            1
                                                                      =                      2 ,
                                                               x2 + 2   2
                                                                                    
                                                                                        x
                                                                               1+       √
                                                                                         2

                         1√
                                                                        
                                            x           1               x
de primitive x 7−→            2 arctan √           = √ arctan √ .
                         2                    2          2               2
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                       97
```

---
## PAGE 104

```text
12.8 d)       L’idée pour primitiver cet élément simple est d’utiliser une forme canonique afin de se ramener à arctan :

                                 1          1       4      1      4        1
                                        =         =              =                  .
                                            1 2             1 2
                                                                               2
                             X2 + X + 1             3             3
                                               3     4
                                                             
                                          X+2 +4      3
                                                        X + 2 +1     √2 X + √1    +1                         3       3

                                                                      √                                                                   
                                              1                     4 3                 2          1           2               2          1
Ainsi, une primitive de x 7−→                          est x 7−→            arctan √ X + √                = √ arctan √ X + √ .
                                        x2 + x + 1                  3 2                  3           3          3               3          3
..............................................................................................................................................................
                                                      u′
 12.8 e) L’idée est de faire apparaître                   :
                                                       u
                                                      x        1 2x + 2           1
                                                             =               − 2         .
                                                 x2 + 2x + 3   2 x2 + 2x + 3  x + 2x + 3
                                    1 2x + 2               1
Or, une primitive de x 7−→                        est x 7−→ ln |x2 + 2x + 3|. De plus :
                                    2 x2 + 2x + 3          2
                                                      1             1         1                     1
                                                             =              =                              2 ,
                                                 x2 + 2x + 3   (x + 1)2 + 2   2
                                                                                                 
                                                                                                     x+1
                                                                                            1+       √
                                                                                                       2

                                               
                   1        x+1                                               x
de primitive x 7−→ √ arctan √   . Donc une primitive de la fonction x 7−→ 2          est :
                    2         2                                          x  + 2x + 3
                                                                                                           
                                                         1                          1              x+1
                                                x 7−→      ln |x2 + 2x + 3| − √ arctan √                     .
                                                         2                            2                2
..............................................................................................................................................................
                                                                                    X4
 12.8 f)       La décomposition en éléments simples de                                                 est :
                                                                       (X − 1)(X − 2)(X + 1)

                                         X4                     1          1          16
                                                      =X +2+          −          +          ,
                                (X − 1)(X − 2)(X + 1)        6(X + 1)   2(X − 1)   3(X − 2)

                x2            1                 1                 16
donc x 7−→          + 2x + ln |x + 1| − ln |x − 1| +                  ln |x − 2| convient.
                2             6                 2                  3
..............................................................................................................................................................




98                                                                                                                                   Réponses et corrigés
```

---
## PAGE 105

```text
Fiche no 13. Calcul matriciel

            Réponses
                                                                                                                                                                                    
                                                               1              −3        −1                                                           cos(2θ)              − sin(2θ)
                                                                                                  13.2 g) . . . . . . . . . . . . . . . . . . . . .
13.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . 3               3         4                                                           sin(2θ)              cos(2θ)
                                                               9              −7         3                                                                                            
                                                                                                                                                     cos(3θ)              − sin(3θ)
                                                                                                13.2 h) . . . . . . . . . . . . . . . . . . . . .
                                                         −2               −6 −5                                                                       sin(3θ)              cos(3θ)
13.1 b) . . . . . . . . . . . . . . . . . . . . . . . .  15              −1 11                                                                                                      
                                                          18              −26 −1                                                                          cos(kθ)         − sin(kθ)
                                                                                                  13.2 i) . . . . . . . . . . . . . . . . . . . . .
                                                                                                                                                          sin(kθ)          cos(kθ)
13.1 c). . . . . . . . . . . . . . . . . . . . . . . . . 17 (matrice 1 × 1)
                                                                                                                                                                                     
                                                                                                                                                                  n ···          n
                                                             1    7 −2                                                                                              ..            .. 
                                                                                                  13.2 j). . . . . . . . . . . . . . . . . . . . . . . . . . . . .  . (n)          .
13.1 d) . . . . . . . . . . . . . . . . . . . . . . . . .  2    14 −4
                                                            −1 −7 2                                                                                                 n ···          n
                                                                                                                                                             2
                                                                                                                                                                                 n2
                                                                                                                                                                                    
                                                                                 
                                                                                 −1                                                                          n            ···
                                                                                                                                                             ..                  .
13.1 e) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .  3              13.2 k) . . . . . . . . . . . . . . . . . . . . . . . . .  .           (n2 ) .. 
                                                                                 −1                                                                              n2        · · · n2
                                                                                           
13.1 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .       −5        15    3       13.2 l) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . nk−1 D
                                                                                             
13.1 g) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                                  5       4       13.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . 2 × 3j−i × 5i−1
                                                                                  4       5
                                                                                                  13.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . 2i+1 3j−i (2n − 1)
                                                                                             
                                                                      5   3     −1        1
13.1 h) . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                                                               n 
                                                                                                                                                                           2
                                                                      4   3      1        2       13.3 c) . . . . . . . . . . . . . . . . . . . . . 2 × 3       i+j
                                                                                                                                                                       1−
                                                                                                                                                                         3
                                                        1                   7           −2                                                                               
13.1 i) . . . . . . . . . . . . . . . . . . . . . . .  7                  49           −14                                                                    i−1     i−1
                                                                                                  13.3 d) . . . . . . . . . . . . . . . . . . . . . . .              +
                                                       −2                 −14            4                                                                       j      j−2
                                                                                                                                                                                    
                                                                                                                                                                                 i−1
                                                                                             
                                                                               1          2       13.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 2i−j
13.2 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                               0          1                                                                                      j−1

                                                                                                                                             (1 − δi,1 )(δi−1,j+1 + δi,j )
                                                                                             
                                                                                  1       3       13.4 b) . . . . . . . . . . . . . .
13.2 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                 +(1 − δi,n )(δi,j + δi+1,j−1 )
                                                                                  0       1
                                                                                                                                                                                   
                                                                                                                                                          1      2                −e
                                                                                             
                                                                               1          k       13.5 a). . . . . . . . . . . . . . . . . . . . . . .
13.2 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                               0          1                                                            2(π − e) −2                π
                                                                                                                                                                                      
                                                                                                                                                                 1 1       −1 − 2i
                                                                                             
                                                                             4            5       13.5 b) . . . . . . . . . . . . . . . . . . . . . . . . . .
13.2 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                                                                                                −1 + i
                                                                             0            9                                                                      3 1
                                                                                                                                                                                   
                                                                                                                                                              5            2      −1
                                                                                             
                                                                                    8    19                                                               1
13.2 e). . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .                        13.5 c) . . . . . . . . . . . . . . . . . . . . . . . .     3            2      −1
                                                                                    0    27
                                                                                                                                                          2
                                                                                                                                                              −6          −2      2
                                                                   k
                                                                                3k − 2k
                                                                                              
                                                                   2
13.2 f) . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                                                                   0               3k

Réponses et corrigés                                                                                                                                                                   99
```

---
## PAGE 106

```text
                                                                            
                                                            0     4        0               13.5 h) . . . . . . . . . . . . . . . . . . . . . . . . . . . Non inversible !
                                                         1 
13.5 d) . . . . . . . . . . . . . . . . . . . . . . . .     0    −2       −2                                                                                        
                                                        4π                                                                                          0 −1 0 −1
                                                            2    −1        1
                                                                                                                                           1 1         1    0     0
                                                                                           13.5 i) . . . . . . . . . . . . . . . . . . .                              
                                                                                                                                         2     −1     0   −1     0
                                                         8        4       −2
                                                     1                                                                                             0    0    1 −1
13.5 e). . . . . . . . . . . . . . . . . . . . . . .    −16      −6       7
                                                     8
                                                         0       −2       1
                                                                                           13.6 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . λ ̸= 1
                                                                                 
                                                           −2    2        2                                                            
                                                                                                                                               −4           −1              3
                                                                                                                                                                                 
                                                        1                                                                      1 
13.5 f) . . . . . . . . . . . . . . . . . . . . . . . .     1    −1       2               13.6 b) . . . . . . . . . . .                   2λ + 2 λ −2λ − 1
                                                        6                                                                   1−λ
                                                            4     2       −4                                                                λ−1               0           1−λ
                                                                            
                                                 4         −2    2         0               13.6 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . λ ̸= 1
                                              18         −6    4         2
13.5 g) . . . . . . . . . . . . . . . . . .                                  
                                              2 −7              −3       −1                                                    −1 − λ + λ2 1 − λ 2 − λ
                                                                                                                                                                                
                                                            5
                                                                                                                      1 
                                                 −5         3    −1       −1               13.6 d) . . . . .                                1                     0          −1 
                                                                                                                  1−λ                            2
                                                                                                                                       1−λ                    λ−1 λ−1



           Corrigés
                                                                                                 
                                                        1 1            1 1            1 2
 13.2 a)         Un calcul direct donne A2 =                     ×              =              .
                                                        0 1            0 1            0 1
..............................................................................................................................................................
                                                                                                                 
                                                       3     2       1 2            1 1            1 3
 13.2 b) Un calcul direct donne A = A × A =                                    ×              =             .
                                                                     0 1            0 1            0 1
..............................................................................................................................................................
 13.2 c)         Cela pourrait se démontrer formellement par récurrence.
..............................................................................................................................................................
                                                                                  
                                          2 1            2 1            4 5
 13.2 d)         On calcule : B 2 =                ×              =             .
                                          0 3            0 3            0 9
..............................................................................................................................................................
                                                                                                   
                                       3          2     4 5            2 1            8 19
 13.2 e) On calcule : B = B × B =                                ×              =               .
                                                        0 9            0 3            0 27
..............................................................................................................................................................
 13.2 f)         On remarque que les termes diagonaux valent 2k et 3k respectivement, et que, pour A2 , 4 + 5 = 9, pour A3 ,
                                                                       k                  
                                                                   2     3k − 2 k
8 + 19 = 27, donc on peut conjecturer que Ak =                                       .
                                                                    0        3k
..............................................................................................................................................................
 13.2 g)         On calcule :
                                                                                                    
                                                  cos(θ)   − sin(θ)               cos(θ)   − sin(θ)
                                   C2 =                                   ×
                                                  sin(θ)    cos(θ)                sin(θ)    cos(θ)
                                                                                                                                         
                                         cos(θ)2 − sin(θ)2          −2 cos(θ) sin(θ)               cos(2θ) − sin(2θ)
                                         =                                                    =                                .
                                           2 sin(θ) cos(θ)        − sin(θ)2 + cos(θ)2               sin(2θ)      cos(2θ)
..............................................................................................................................................................




100                                                                                                                                                    Réponses et corrigés
```

---
## PAGE 107

```text
13.2 j)       Deux possibilités de faire le calcul : « à la main », ou bien avec la formule théorique du produit.

  • À la main, on remarque que, lorsque l’on effectue le produit D× D, chaquecoefficient résultera du produit d’une
                                                                   n ··· n
    ligne de 1 par une colonne de 1, donc sera égal à n : D × D =  . (n) ...  = nD.
                                                                   ..        
                                                                   n ··· n
                                                                                           n
                                                                                           X                     n
                                                                                                                 X
  • En utilisant les coefficients, on peut écrire que [D2 ]ij =                                  [D]ik [D]kj =         1 = n.
                                                                                           k=1                   k=1
..............................................................................................................................................................
13.2 k)       Comme D2 = nD, D3 = D × nD = nD2 = n × nD = n2 D.
..............................................................................................................................................................
13.3 a)       On calcule :

                                                                        n                   n       
                                                                        X                   X   i − 1 k j−k
                                                    [A × B]ij =               aik bkj =                       2 3      .
                                                                                                     k−1
                                                                        k=1                    k=1
                           
                      i−1
Mais si k > i,                  = 0, donc :
                      k−1

                                              i       
                                              X   i − 1 k j−k
                          [A × B]ij =                            2 3
                                                     k−1
                                              k=1
                                              i−1       
                                              X     i − 1 ℓ+1 j−ℓ−1
                                          =                      2      3              en faisant le changement d’indice ℓ = k − 1
                                                       ℓ
                                              ℓ=0
                                                           i−1       ℓ
                                                    j−1
                                                           X     i−1   2
                                          =2×3
                                                                       ℓ           3
                                                           ℓ=0
                                                                            i−1
                                                                 2
                                                             
                                          = 2 × 3j−1 ×             +1
                                                                 3
                                                          5i−1
                                          = 2 × 3j−1 ×           = 2 × 3j−i × 5i−1 .
                                                          3i−1
..............................................................................................................................................................
13.3 b)       On calcule :

                                           n                 n                                          n
                                           X                 X i k−i k j−k
                                                                                                        X
                             [B 2 ]ij =          bik bkj =            23       2 3          = 2i 3j−i     k
                                                                                                              2 = 2i+1 3j−i (2n − 1).
                                           k=1               k=1                                        k=1
..............................................................................................................................................................
13.3 c)       On calcule :

                                    n                      n                      n                                 n                     n  
                                    X                      X                      X                                 X  2 2k                 X  4 k
               [B ⊤ × B]ij =              [B ⊤ ]ik bkj =             bki bkj =      k i−k k j−k
                                                                                         2 3      2 3     = 3i+j                   = 3i+j
                                                                                                                           3                        9
                                    k=1                     k=1                   k=1                                k=1                      k=1
                                                    4 n
                                                     
                                   4 i+j 1 − 9             4 × 3i+j             4 n
                                                                                          
                                =    3             4
                                                        =               1−              .
                                   9         1− 9               5               9
..............................................................................................................................................................
13.3 d)       On calcule :

                                              n                      n                                                               
                                              X                      X   i−1                                         i−1               i−1
                           [A × C]ij =              aik ckj =                            (δk,j+1 + δk,j−1 ) =                  +           .
                                                                             k−1                                      j                j−2
                                              k=1                    k=1
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                      101
```

---
## PAGE 108

```text
13.4 a)       Déjà, la matrice A2 est triangulaire inférieure (produit de deux matrices triangulaires inférieures). Soit j ⩽ i.
Alors :
                                           n                       n           
                               2
                                           X                       X   i−1    k−1
                            [A ]ij =             [A]ik [A]kj =
                                                                             k−1       j−1
                                           k=1                     k=1
                                           i           
                                           X   i−1    k−1
                                       =
                                                   k−1           j−1
                                           k=j
                                           i
                                           X         (i − 1)!         (k − 1)!
                                       =
                                                 (k − 1)!(i − k)! (j − 1)!(k − j)!
                                           k=j
                                           i
                                           X         (i − 1)!              (i − j)!
                                       =
                                                 (j − 1)!(i − j)! (k − j)!(i − j − (k − j))!
                                           k=j
                                                  i                                i−j            
                                               i−1 X i−j                             i−1 X i−j
                                       =                                     =                                                          (en posant ℓ = k − j)
                                               j−1   k−j                             j−1     ℓ
                                                         k=j                               ℓ=0
                                                          
                                           i−j  i−1
                                     =2                  .
                                                j−1
..............................................................................................................................................................
13.4 b)       Pour vérifier ses calculs, il est conseillé de regarder des exemples !
                                                                                                                     
                                                                                        1          0       1   0   0
                                                             1     0   1     0
                                                                                         0          2       0   1   0
                                                 0 2 0                      1
                                           n=4 :                              , n = 5 : 1          0       2   0   1.
                                                                                                                      
                                                   1 0 2                     0          0          1       0   2   0
                                                             0     1   0     1
                                                                                          0          0       1   0   1

On calcule :
                                       n
                                       X                   n
                                                           X
                          [C 2 ]ij =           cik ckj =         (δi,k+1 + δi,k−1 )(δk,j+1 + δk,j−1 )
                                       k=1                 k=1
                                        n                          n                       n                         n
                                       X                           X                       X                         X
                                   =           δi,k+1 δk,j+1 +           δi,k+1 δk,j−1 +         δi,k−1 δk,j+1 +           δi,k−1 δk,j−1 .
                                       k=1                         k=1                     k=1                       k=1


          / {1, n}2 , on a :
Si (i, j) ∈

                                                           [C 2 ]ij = δi−1,j+1 + 2δi,j + δi+1,j−1 .

Ceci est confirmé par la structure « tridiagonale espacée ».
Sinon, pour (i, j) quelconque dans J1, nK2 , on trouve :

                                       [C 2 ]ij = (1 − δi,1 )(δi−1,j+1 + δi,j ) + (1 − δi,n )(δi,j + δi+1,j−1 ),

car δ1,k+1 = 0 = δn,k−1 pour tout k entre 1 et n.
..............................................................................................................................................................
                                                                                                                                              
                                                                                                                     1         2     −e
 13.5 a) On remarque que 2π − 2e = 2(π − e) ̸= 0, donc A est inversible d’inverse                                                          .
                                                                                                                 2(π − e) −2 π
..............................................................................................................................................................




102                                                                                                                                          Réponses et corrigés
```

---
## PAGE 109

```text
13.5 c)       Effectuons un pivot de Gauss :

                            1    −1       0 1      0    0                   −1
                                                            !
                                                                        1         0 1      0    0
                                                                                                 !
                            0     2       1 0      1    0       −→      0    2    1 0      1    0
                            3    −1       2 0      0    1               0    2    2 −3     0    1 L3 ← L3 − 3L1
                                                                        1   −1     0 1          0        0
                                                                                                         !
                                                                −→      0    1    1/2 0        1/2       0 L2 ← L2 /2
                                                                        0    2     2 −3         0        1
                                                                        1   0    1/2 1     1/2       0 L1 ← L1 + L2
                                                                                                     !
                                                                −→      0   1    1/2 0     1/2       0
                                                                        0   0     1 −3     −1        1 L3 ← L3 − 2L2
                                                                        1   0    0 5/2     1     −1/2 L1 ← L1 − 1/2L3
                                                                                                         !
                                                                −→      0   1    0 3/2     1     −1/2 L2 ← L2 − 1/2L3
                                                                        0   0    1 −3     −1      1

                                                 5      2     −1
                                                                        !
                                  1
Ainsi, B est inversible d’inverse                3      2     −1 .
                                  2
                                               −6 −2           2
..............................................................................................................................................................
                                                                                    1      1     2
                                                                                                   !
 13.5 d) Il ne faut pas avoir peur du π et écrire que C = π 1                              0     0 . On calcule alors (par pivot de Gauss) que
                                                                                   −1 −2 0
   1       1     2
                   !
                                                          0    4      0
                                                                         !
                                                                                                                              0     4      0
                                                                                                                                             !
                                                     1                                                                  1
   1       0     0 est inversible d’inverse               0 −2 −2 , donc C est inversible d’inverse                           0 −2 −2 .
                                                     4                                                                 4π
  −1 −2 0                                                 2 −1        1                                                       2 −1         1
..............................................................................................................................................................
13.5 h)       On remarque que L3 = L1 + 2L2 + 2L4 .
..............................................................................................................................................................
13.6 a)       Effectuons un pivot de Gauss :

  λ       1     1 1     0    0                −1       −1                                           −1      −1
                                 !
                                                                2 0    1    0
                                                                            !
                                                                                                                     2   0    1    0
                                                                                                                                     !
  −1     −1     2 0     1    0       −→       λ         1       1 1    0    0 L2 ↔ L1 −→             0     1−λ    1 + 2λ 1    λ    0 L2 ← L2 + λL1
  λ       1     2 0     0    1                λ         1       2 0    0    1                        0     1−λ    2 + 2λ 0    λ    1 L3 ← L3 + λL1

Si λ = 1, alors la matrice n’est pas inversible. Sinon :
                                                                                                                                   1
  −1      −1          2   0          1    0             −1                  3/(1 − λ) 1/(1 − λ)          1/(1 − λ)  0 L1 ← L1 +
                                          !
                                                                     0
                                                                                                                     !
                                                                                                                                      L2
                                                                                                                                1−λ
   0     1−λ       1 + 2λ 1          λ    0     −→       0          1−λ      1 + 2λ       1                  λ      0
   0     1−λ       2 + 2λ 0          λ    1              0           0          1        −1                  0      1    L3 ← L3 − L2
                                                                                                                                      3
                                                        −1           0      0 4/(1 − λ)    1/(1 − λ)         −3/(1 − λ) L1 ← L1 −
                                                                                                                       !
                                                                                                                                         L3
                                                                                                                                    1−λ
                                                −→       0          1−λ     0 2λ + 2           λ              −2λ − 1   L2 ← L2 − (1 + 2λ)L3
                                                         0           0      1    −1            0                 1

                                                        1       0     0   −4/(1 − λ)           −1/(1 − λ)         3/(1 − λ)        L1 ← −L1
                                                                                                                                    !
                                                                                                                                        1
                                                −→      0       1     0 (2λ + 2)/(1 − λ)       λ/(1 − λ)       (−2λ − 1)/(1 − λ) L2 ←      L2
                                                                                                                                       1−λ
                                                        0       0     1       −1                   0                  1

                                                                 −4       −1          3
                                                                                                !
                                          1
Dans ce cas, l’inverse de la matrice est                      2λ + 2 λ −2λ − 1 .
                                         1−λ
                                                               λ−1         0       1−λ
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                      103
```

---
## PAGE 110

```text
Fiche no 14. Algèbre linéaire


           Réponses

14.1 a). . . . . . . . . . . . . . . . . (3, −1)            14.2 d) . . . . . . . . . . . . . . . . . . . . . . 2
                                                                                                                                                                  
                                                                                                                                                  1 −19      −43
                                                                                                                      14.4 c) . . . . . . . .
                                                            14.2 e) . . . . . . . . . . . . . . . . . . . . . . 2                                 2 9         21
14.1 b) . . . . . . . . . . . . . . . . (−1, 3)
                                                                                                                                                                
                                                            14.2 f) . . . . . . . . . . . . . . . . . . . . . . . 1                               1         0   1
14.1 c) . . . . . . . . . . . . (9/11, 2/11)                                                                          14.4 d). . . . . . . . . . 3        −1   1
                                                            14.3 a) . . . . . . . . . . . . . . . . . . . . . . 2
                                                                                                                                                  0         1   1
14.1 d) . . . . . . . . . (−2, 4/5, 11/5)
                                                            14.3 b) . . . . . . . . . . . . . . . . . . . . . . 2                                               
14.1 e) . . . . . . . . . . (−1, 1/2, 1/2)                                                                                                             1    2   4
                                                            14.3 c) . . . . . . . . . . . . . . . . . . . . . . 3
                                                                                                                      14.4 e) . . . . . . . . . . . . 0    1   4
14.1 f) . . . . . . . . . . . . . . (0, 2, 4, 1)            14.3 d) . . . . . . . . . . . . . . . . . . . . . . 4                                      0    0   1
                                   √                                                              
                                                                                                     1 1
                                                                                                                                                                
14.1 g) . . . . . . . . . . (1/2, − 3/2)                    14.4 a) . . . . . . . . . . . . . .                                                       −1   −1   1
                                                                                                     3 −5             14.5 a). . . . . . . . .
                                                                                                                                                      4    15   0
14.2 a) . . . . . . . . . . . . . . . . . . . . . . 2                                                         
                                                                                                      −5      3                                     
                                                                                                                                                     0      1   0
                                                                                                                                                                 
14.2 b) . . . . . . . . . . . . . . . . . . . . . . 1       14.4 b) . . . . . . . . . . . . . .
                                                                                                      1       1                                     0      0   2
14.2 c) . . . . . . . . . . . . . . . . . . . . . . 1                                                                 14.5 b) . . . . . . . . . . . 
                                                                                                                                                    0
                                                                                                                                                                 
                                                                                                                                                            0   0
                                                                                                                                                     0      0   0




           Corrigés

                                                                       
                                                                   −µ          =1
 14.1 a)        Notons u = λ(0, 1) + µ(−1, 2). Alors,                               . Ainsi, u = 3(0, 1) − (−1, 2).
                                                                   λ + 2µ = 1
..............................................................................................................................................................
                                                                       
                                                                   −µ          =1
 14.1 b)        Notons u = λ(0, 1) + µ(−1, 2). Alors,                               . Ainsi, u = −(−1, 2) + 3(0, 1).
                                                                   λ + 2µ = 1
..............................................................................................................................................................
 14.1 c)        Notons u = λ(1, 2) + µ(12, 13). Alors :
                                                                                           
                                                            λ + 12µ         =3                  λ + 12µ       =3
                                                                               ⇐⇒
                                                            2λ + 13µ        =4                  −11µ          = −2.

                9             2
Ainsi, u =        (1, 2) +      (12, 13).
               11            11
..............................................................................................................................................................
 14.1 d)        On note u = λ(0, 1, 3) + µ(4, 5, 6) + ν(−1, 0, 1). Alors :
                                                                                                               
                                   4µ − ν              =1     λ + 5µ                        =2      λ + 5µ                 =2
                                     λ + 5µ             = 2 ⇐⇒   4µ − ν                       =1   ⇐⇒   −ν + 4µ               =1
                                                                                                    
                                     3λ + 6µ + ν        =1       −9µ + ν                      = −5      −5µ                   = −4.

                                4              11
Ainsi, u = −2(0, 1, 3) +          (4, 5, 6) +      (−1, 0, 1).
                                5               5
..............................................................................................................................................................

104                                                                                                                                              Réponses et corrigés
```

---
## PAGE 111

```text
 14.1 e)      Notons u = λ(1, 0, 1) + µ(1, 1, 1) + ν(−1, −1, 3). Alors :
                                                                                   
                                               λ + µ − ν          = −1    λ + µ − ν                   = −1
                                                   µ−ν             =0   ⇐⇒  µ−ν                         =0
                                                                          
                                                   λ + µ + 3ν      =1       4ν                          = 2.

                              1               1
Ainsi, u = −(1, 0, 1) +         (1, 1, 1) + (−1, −1, 3).
                              2               2
..............................................................................................................................................................
 14.1 f)      Notons u = λ + µX + νX(X − 1) + δX(X − 1)(X − 2).
En évaluant en 0, on a λ = 0. En évaluant en 1, on a µ = 2. En évaluant en 2, on a 2µ + 2ν = 8 + 4 = 12, soit ν = 4.
En identifiant les coefficients de X 3 dans chacun des membres, on trouve δ = 1.
Finalement, on a u = 2X + 4X(X − 1) + X(X − 1)(X − 2).
..............................................................................................................................................................
                                                                                        √
                                                                         1                 3
 14.1 g) En utilisant les formules d’addition, u(x) = cos(x) −                               sin(x).
                                                                         2               2
..............................................................................................................................................................
 14.2 a)      Les colonnes de la matrice ne sont pas colinéaires.
..............................................................................................................................................................
 14.2 b)      Toutes les lignes sont proportionnelles à la première, qui est non nulle.
..............................................................................................................................................................
 14.2 d)      Les deux premiers vecteurs colonnes sont non colinéaires, le troisième est la somme des deux premiers.
..............................................................................................................................................................
 14.2 e)      Les deux vecteurs colonnes ne sont pas colinéaires.
..............................................................................................................................................................
 14.2 f)      Toutes les colonnes sont égales à la première, qui est non nulle.
..............................................................................................................................................................
                                                                                                                                     3       2     1
                                                                                                                                                     !
 14.3 a) En effectuant les opérations élémentaires L2 ← L2 + L1 et L3 ← L3 + 2L1 , on obtient −1 −1 0 .
                                                                                                                                     2       2     0
                                                                                          3      2     1
                                                                                                         !
En effectuant l’opération élémentaire L3 ← L3 + 2L2 , on obtient −1 −1 0 . Ainsi, rg(A) = 2.
                                                                                          0      0     0
..............................................................................................................................................................
                                                                                                                                         
                                                                                                                        (−1)n       0
 14.3 b)       Si sin θ = 0, i.e. s’il existe n ∈ Z tel que θ = nπ, alors la matrice est égale à                                              et elle est de
                                                                                                                          0       (−1)n
rang 2.
                                                                                                                                             
                                                                                                                                 0      −1
Sinon, on effectue l’opération élémentaire L1 ← sin(θ)L1 − cos(θ)L2 pour obtenir la matrice                                                  , qui est de
                                                                                                                               sin θ   cos θ
rang 2 car sin(θ) ̸= 0.
..............................................................................................................................................................
                                                                                                      1     2     1
                                                                                                                    !
 14.3 c) En effectuant l’opération élémentaire L3 ← L3 − L1 , on obtient 0                                  2     4 .
                                                                                                      0 −1 1
                                                                                         1 2 1
                                                                                                    !
En effectuant l’opération élémentaire L3 ← 2L3 + L2 , on obtient 0 2 4 . Ainsi, le rang de la matrice vaut 3.
                                                                                         0 0 6
..............................................................................................................................................................


Réponses et corrigés                                                                                                                                      105
```

---
## PAGE 112

```text
 14.3 d)        En effectuant les opérations élémentaires L2 ← L2 − 2L1 , L3 ← L3 − 4L1 et L4 ← L4 − L1 , on obtient
       −1                                                                                                                  −1
                                                                                                                                     
 1             2  3                                                                   1                              2             3
0      3      −5−4                                                                0                              −5     3      −4 
                       . En effectuant l’opération élémentaire C2 ↔ C3 , on obtient                                                  . En effectuant
0      6      −7
                −13                                                                  0                             −7     6      −13
 0      5      0 −2                                                                   0                              0     5      −2
                                                                 −1
                                                                         
                                                        1   2          3
                                                      0 −5 3        −4 
l’opération élémentaire L3 ← 5L3 − 7L2 , on obtient                         .
                                                        0   0     9  −37
                                                        0   0     5  −2
Comme les deux dernières lignes sont linéairement indépendantes, le rang de la matrice vaut 4.
..............................................................................................................................................................
 14.4 a)       D’une part, f (1, 0) = (1, 3) = 1 · (1, 0) + 3 · (0, 1). D’autre part, f (0, 1) = (1, −5) = 1 · (1, 0) − 5 · (0, 1).
                                  
                           1     1
Ainsi, MatB (f ) =                    .
                           3 −5
..............................................................................................................................................................
 14.4 b)       D’une part, f (0, 1) = (1, −5) = −5 · (0, 1) + 1 · (1, 0). D’autre part, f (1, 0) = (1, 3) = 3 · (0, 1) + 1 · (1, 0).
                                  
                           −5 3
Ainsi, MatB (f ) =                    .
                            1     1
..............................................................................................................................................................
 14.4 c)       f (1, 2) = (4, −1) et f (3, 4) = (10, −1). De plus, la matrice de passage de la base B à la base canonique vaut :
                                                                            −1                
                                                                     1   3           1 −4    3
                                                          P =                      =            .
                                                                     2   4           2 2     −1
                                                              
               4         −19/2                   10           −43/2                    19      9                      43      21
Ainsi, P             =                et P            =             . Donc f (1, 2) = − (1, 2)+ (3, 4) et f (3, 4) = − (1, 2)+ (3, 4).
               −1         9/2                    −1            21/2                     2      2                       2      2
                                            
                         1 −19 −43
Ainsi, MatB (f ) =                            .
                         2     9       21
..............................................................................................................................................................
 14.4 d)       Comme f (1, 0, 0) = (1, 3, 0) = (1, 0, 0)+3(0, 1, 0)+0(1, 1, 1), f (0, 1, 0) = (1, 0, 1) = 0·(1, 0, 0)−(0, 1, 0)+(1, 1, 1)
                                                                                                1     0     1
                                                                                                             !
et f (1, 1, 1) = (2, 2, 1) = (1, 0, 0) + (0, 1, 0) + (1, 1, 1), on a MatB (f ) = 3 −1 1 .
                                                                                                0     1     1
..............................................................................................................................................................
                                                                                                                                       1 2 4
                                                                                                                                                  !
                                                                    2                2       2
 14.4 e) Comme f (1) = 1, f (X) = X + 2 et f (X ) = (X + 2) = X + 4X + 4, on a MatB (f ) = 0 1 4 .
                                                                                                                                       0 0 1
..............................................................................................................................................................
 14.5 a)        Comme f (0, 1, 3) = (4, −1) = −1(0, 1) + 4(1, 0), f (4, 5, 6) = (15, −1) = −1(0, 1) + 15(1, 0) et comme
                                                                                                    
                                                                                   −1 −1 −1
f (−1, 0, 1) = (0, −1) = −(0, 1) + 0(1, 0), on a MatB,B′ (f ) =                                         .
                                                                                    4     15      0
..............................................................................................................................................................
 14.5 b)        Comme f (1) = 0 = 0 · 1 + 0 · X + 0 · X 2 + 0 · X 3 , f (X) = 1 = 1 + 0 · X + 0 · X 2 + 0 · X 3 et enfin comme
                                                                                                  
                                                                                        0 1 0
     2                                      2          3                                0 0 2
f (X ) = 2X = 0 · 1 + 2X + 0 · X + 0 · X , on a MatB,B′ (f ) =                                       .
                                                                                     
                                                                                        0 0 0
                                                                                        0 0 0
..............................................................................................................................................................




106                                                                                                                                  Réponses et corrigés
```

---
## PAGE 113

```text
Fiche no 15. Équations différentielles

           Réponses

15.1 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ 56e12x       15.4 b) . . . . . . . . . . . . . x 7−→ (2 − 3i)ex + (3i − 1)e2x
15.1 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ 6ex − 1        15.5 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ ex
                                                                        8e3x − 5       15.5 b) . . . . . . . . . . . . . . . . . . . . . . . x 7−→ 7e−x − 5e−2x
15.1 c) . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→
                                                                           3
                                                                                                                                                       4 x 1 −2x
                                                                          2x           15.5 c) . . . . . . . . . . . . . . . . . . . . . . . . x 7−→     e − e
15.1 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ 9e       −6                                                                      3    3

15.2 a). . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ e(6−x)/5        15.5 d) . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ (2 − x)ex

15.2 b) . . . . . . . . . . . . . . . . . . . . . . x 7−→ 1 − 2e−2x/7+2                15.5 e) . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ (2 − x)e2−2x
                                                           √
                                                     6               6                 15.6 a) . . . . . . . . . . . . . . . . . . . . . . . x 7−→ cos x + 2 sin x
15.2 c) . . . . . . . . . . . . . . x 7−→ √ + π e 5x − √
                                                      5               5                                                                    √             √ 
                                                                                                                          −x/2                3x    1        3x
                                                                                     15.6 b) . . . . x 7−→ e                        cos        − √ sin
                                                        2e πx−π2 2e                                                                          2       3      2
15.2 d) . . . . . . . . . . . . . x 7−→ 12 +                e     −
                                                        π            π
                                                                                       15.6 c). . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ e−x sin(x)
15.3 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ e2x                                                                              
                                                                                                                                     −1 + i 2ix 1 + i −2ix
15.3 b) . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ ex   15.6 d) . . . . . . . x 7−→ ex                             e +        e
                                                                                                                                          2               2
15.4 a) . . . . . . . . . . . . . . . . . . . . . . . . . . . x 7−→ 2e2x − ex



           Corrigés

 15.1 a)         Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
 ′
y − 12y = 0 est x 7−→ λe12x ; λ ∈ R . Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe12x .
                        

Alors, y0 (0) = 56 = λ. Finalement, y0 : x 7−→ 56e12x .
..............................................................................................................................................................
 15.1 b)         Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
y ′ − y = 0 est {x 7−→ λex ; λ ∈ R}. De plus, si µ est une solution particulière constante, alors 0 = µ + 1, soit µ = −1.
Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λex − 1. Alors, y0 (0) = 5 = λ − 1. Finalement, y0 : x 7−→ 6ex − 1.
..............................................................................................................................................................
 15.1 c)         Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
y ′ − 3y = 0 est x 7−→ λe3x ; λ ∈ R . De plus, si µ est une solution particulière constante, alors 0 = 3µ + 5, soit
                          

µ = −5/3. Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe3x − 5/3.
                                                                    8e3x − 5
Alors, y0 (0) = 1 = λ − 5/3. Finalement, y0 : x 7−→                            .
                                                                        3
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                                   107
```

---
## PAGE 114

```text
 15.1 d)       Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
 ′
y − 2y = 0 est x 7−→ λe2x ; λ ∈ R . De plus, si µ est une solution particulière constante, alors 0 = 2µ + 12, soit µ = −6.
                   

Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe2x − 6.
Alors, y0 (0) = 3 = λ − 6. Finalement, y0 : x 7−→ 9e2x − 6.
..............................................................................................................................................................
 15.2 a)      Notons y0 l’unique solution de ce problème de Cauchy. L’équation est homogène et son ensemble de solutions
est x 7−→ λe−x/5 ; λ ∈ R . Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe−x/5 .
      

Alors, y0 (1) = e = λe−1/5 . Finalement, y0 : x 7−→ e(6−x)/5 .
..............................................................................................................................................................
 15.2 b) Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
     2
y ′ + y = 0 est x 7−→ λe−2x/7 ; λ ∈ R . De plus, si µ est une solution particulière constante, alors 0+2µ = 2, soit µ = 1.
                 
     7
Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe−2x/7 + 1. Alors, y0 (7) = −1 = λe−2 + 1. Finalement, y0 : x 7−→ −2e−2x/7+2 + 1.
..............................................................................................................................................................
 15.2 c)   Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
 ′
    √            n           √          o                                                            √
y − 5y = 0 est x 7−→ λe 5x ; λ ∈ R . De plus, si µ est une solution particulière constante, alors 0 − 5µ = 6, soit
                                                      √
       6                                                     6
µ = − √ . Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λe 5x − √ .
         5                                                    5
                                                                                  √
                                6                                       6                     6
Alors, y0 (0) = π = λ − √ . Finalement, y0 : x 7−→ √ + π e 5x − √ .
                                  5                                      5                      5
..............................................................................................................................................................
 15.2 d)       Notons y0 l’unique solution de ce problème de Cauchy. L’ensemble des solutions de l’équation homogène
 ′
y − πy = 0 est {x 7−→ λeπx ; λ ∈ R}. De plus, si µ est une solution particulière constante, alors 0 = πµ + 2e, soit
        2e                                                                  2e                                   2    2e
µ = − . Ainsi, il existe λ ∈ R tel que y0 : x 7−→ λeπx − . Alors, y0 (π) = 12 = λeπ − .
         π                                                                  π                                          π
                                       2e πx−π2           2e
                                         
Finalement, y0 : x 7−→ 12 +                 e         − .
                                        π                 π
..............................................................................................................................................................
 15.3 a)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 3r + 2 = 0, dont les
                                                                     2
                     (car 2 + 1 = 3 et 2 × 1 = 2 et on reconnaît r − (2 + 1)r + 2 × 1). L’ensemble des solutions de
solutions sont 2 et 1
l’équation est donc x 7−→ λex + µe2x ; (λ, µ) ∈ C2 . Ainsi, il existe (λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe2x .
Alors, y(0) = λ + µ = 1 et y ′ (0) = λ + 2µ = 2. Ce système se réduit en λ + µ = 1 et µ = 1. Ainsi, y0 : x 7−→ e2x .
..............................................................................................................................................................
 15.3 b)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 3r + 2 = 0, dont les
                                                                    2
                     (car 2 +x1 = 32xet 2 × 1 = 22et on reconnaît r − (2 + 1)r
solutions sont 2 et 1                                                           + 2 × 1). L’ensemble des solutions de
l’équation est donc x 7−→ λe + µe ; (λ, µ) ∈ C . Ainsi, il existe (λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe2x .
Alors, y(0) = λ + µ = 1 et y ′ (0) = λ + 2µ = 1. Ce système se réduit en λ + µ = 1 et µ = 0. Ainsi, y0 : x 7−→ ex .
..............................................................................................................................................................
 15.4 a)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 3r + 2 = 0, dont les
                                                                    2
                     (car 2 +x1 = 32xet 2 × 1 = 22et on reconnaît r − (2 + 1)r
solutions sont 2 et 1                                                           + 2 × 1). L’ensemble des solutions de
l’équation est donc x 7−→ λe + µe ; (λ, µ) ∈ C . Ainsi, il existe (λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe2x .
Alors, y(0) = λ + µ = 1 et y ′ (0) = λ + 2µ = 3. Ce système se réduit en λ + µ = 1 et µ = 2. Ainsi, y0 : x 7−→ 2e2x − ex .
..............................................................................................................................................................




108                                                                                                                                  Réponses et corrigés
```

---
## PAGE 115

```text
15.4 b)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 3r + 2 = 0, dont les
                                                                    2
                     (car 2 +x1 = 32xet 2 × 1 = 22et on reconnaît r − (2 + 1)r
solutions sont 2 et 1                                                           + 2 × 1). L’ensemble des solutions de
l’équation est donc x 7−→ λe + µe ; (λ, µ) ∈ C . Ainsi, il existe (λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe2x .
Alors, y(0) = λ + µ = 1 et y ′ (0) = λ + 2µ = 3i. Ce système se réduit en λ + µ = 1 et µ = 3i − 1.
Ainsi, y0 : x 7−→ (2 − 3i)ex + (3i − 1)e2x .
..............................................................................................................................................................
15.5 a)        Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 1 = 0, dont les
solutions sont −1 et 1. L’ensemble des solutions de l’équation est donc x 7−→ λex + µe−x ; (λ, µ) ∈ C2 . Ainsi, il existe
                                                                                              

(λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe−x .
Alors, y(0) = λ + µ = 1 et y ′ (0) = λ − µ = 1. En additionnant et soustrayant ces relations, on obtient λ = 1 et µ = 0.
Ainsi, y0 : x 7−→ ex .
..............................................................................................................................................................
15.5 b)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 + 3r + 2 = 0, dont
les solutions sont −1 et −2 (car −1 − 2 = −3 et (−2) × (−1) = 2 et on reconnaît r2 − (−2 − 1)r + (−2) × (−1)).
L’ensemble des solutions de l’équation est donc x 7−→ λe−x + µe−2x ; (λ, µ) ∈ C2 . Ainsi, il existe (λ, µ) ∈ C2 tel que
y0 : x 7−→ λe−x + µe−2x .
Alors, y(0) = λ+µ = 2 et y ′ (0) = −λ−2µ = 3. Le système se réduit en λ+µ = 2 et −µ = 5. Ainsi, y0 : x 7−→ 7e−x −5e−2x .
..............................................................................................................................................................
 15.5 c) Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 +r−2 = 0. Le discriminant
du trinôme vaut 9 et ses racines sont −2 et 1. L’ensemble des solutions de l’équation est donc :

                                                             x 7−→ λex + µe−2x ; (λ, µ) ∈ C2 .
                                                         

Ainsi, il existe (λ, µ) ∈ C2 tel que y0 : x 7−→ λex + µe−2x .
                                                                                                                                             4 x 1 −2x
Alors, y(0) = λ+µ = 1 et y ′ (0) = λ−2µ = 2. Le système se réduit en λ+µ = 1 et −3µ = 1. Ainsi, y0 : x 7−→                                     e − e         .
                                                                                                                                             3       3
..............................................................................................................................................................
15.5 d)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 − 2r + 1 = 0, dont la
                                                                                                  x 7−→ (λ + µx)ex ; (λ, µ) ∈ C2 . Ainsi, il existe
                                                                                              
racine double est 1. L’ensemble des solutions de l’équation est donc
(λ, µ) ∈ C2 tel que y0 : x 7−→ (λ + µx)ex .
Alors, y(0) = λ = 2 et y ′ (0) = λ + µ = 1. Ainsi, y0 : x 7−→ (2 − x)ex .
..............................................................................................................................................................
15.5 e)       Soit y0 la solution du problème de Cauchy. L’équation caractéristique associée est r2 + 4r + 4 = 0, dont la
racine double est −2. L’ensemble des solutions de l’équation est donc x 7−→ (λ + µx)e−2x ; (λ, µ) ∈ C2 . Ainsi, il existe
                                                                                          

(λ, µ) ∈ C2 tel que y0 : x 7−→ (λ + µx)e−2x .
Alors, y(1) = (λ + µ)e−2 = 1 et y ′ (1) = (−2λ + µ − 2µ)e−2 = −3. Le système s’écrit λ + µ = e2 et 2λ + µ = 3e2 . Il se
réduit en λ + µ = e2 et λ = 2e2 . Ainsi, y0 : x 7−→ (2 − x)e2−2x .
..............................................................................................................................................................
 15.6 a) Soit y0 l’unique solution du problème de Cauchy. L’équation caractéristique associée est r2 + 1 = 0, dont les
solutions sont i et −i. Ainsi, l’ensemble des solutions à valeurs réelles de l’équation homogène est :

                                                         x 7−→ λ cos x + µ sin x ; (λ, µ) ∈ R2 .
                                                     

Il existe donc (λ, µ) ∈ R2 tel que y0 : x 7−→ λ cos x + µ sin x.
Alors, y0 (0) = 1 = λ et y0′ (0) = 2 = µ. Ainsi, y0 : x 7−→ cos x + 2 sin x.
..............................................................................................................................................................



Réponses et corrigés                                                                                                                                      109
```

---
## PAGE 116

```text
15.6 b)     Soit y0 l’unique solution du problème de Cauchy. L’équation caractéristique associée est r2 + r + 1 = 0. Les
                                                                                                         √
                                                                                            2iπ    1       3
résultats sur les racines de l’unité assurent que les solutions de cette équation sont j = e 3 = − + i       et j̄. Ainsi,
                                                                                                   2      2
l’ensemble des solutions à valeurs réelles de l’équation homogène est :
                                                     √            √                  
                                                         3x          3x
                                    x 7−→ e−x/2 λ cos       + µ sin        ; (λ, µ) ∈ R2 .
                                                         2           2
                                                                         √           √ 
                                                                           3x          3x
Il existe donc (λ, µ) ∈ R2 tel que y0 : x 7−→ e−x/2 λ cos                     + µ sin     .
                                                                           2           2
                                                           √                                           √                   √ 
                                         λ                   3                                            3x       1          3x
Alors, y0 (0) = 1 = λ et y0′ (0) = −1 = − +                    µ. Ainsi, y0 : x 7−→ e      −x/2
                                                                                                   cos         − √ sin              .
                                                     2      2                                             2          3        2
..............................................................................................................................................................
 15.6 c) Soit y0 l’unique solution du problème de Cauchy. L’équation caractéristique associée est r2 + 2r + 2 = 0. Le
discriminant réduit du trinôme vaut−1 et ses racines sont −1 − i et −1 + i. Ainsi, l’ensemble des solutions à valeurs
réelles de l’équation homogène est x 7−→ e−x (λ cos(x) + µ sin(x)) ; (λ, µ) ∈ R2 . Il existe donc (λ, µ) ∈ R2 tel que
y0 : x 7−→ e−x (λ cos(x) + µ sin(x)).
Alors, y0 (0) = 0 = λ et y0′ (0) = 1 = −λ + µ. Ainsi, y0 : x 7−→ e−x sin(x).
..............................................................................................................................................................
15.6 d)       L’équation caractéristique associée est r2 −2r+5 = 0. Le discriminant réduit du trinôme vaut −4 et ses racines
sont 1 − 2i et 1 + 2i. Ainsi, l’ensemble des solutions de l’équation homogène est x 7−→ ex λe2ix + µe−2ix ; (λ, µ) ∈ C2 .
                                                                                                                                       

Il existe donc (λ, µ) ∈ C2 tel que y0 : x 7−→ ex λe2ix + µe−2ix .
                                                                  

                               ′
               i = λ + µ et y0 (0) = −i= (λ + µ) + (2iλ − 2iµ). Le système réduit s’écrit λ + µ = i et 4iλ = 2 − 2i. Ainsi,
Alors, y0 (0) =
                −1 + i        1  + i −2ix
y0 : x 7−→ ex          e2ix +       e     .
                  2              2
En utilisant les formules d’Euler, cette solution peut également s’écrire y0 : x 7−→ iex (cos(2x) − sin(2x)).
..............................................................................................................................................................




110                                                                                                                                  Réponses et corrigés
```

---
## PAGE 117

```text
Fiche no 16. Séries numériques

          Réponses
16.1 a) . . . Divergente                                                 π2                           1 − 7i                       16.6 a) . . . Divergente
                                        16.3 a) . . . . . . . . . . .                16.4 c) . . . . . . . .
                                                                         6                             350
16.1 b) . . . . . . . . . . . . . 2                                                                                                16.6 b) . . . . . . . . . . . . . 4
                                                                                                        √
                                 √      16.3 b) . . . Divergente                                  −2 − 5 2i
16.1 c) . . . . . . . 2 + 2                                                          16.4 d). . .                                  16.7 a) . . . . . . . . . . . . . 2
                                                                                                     54
                                        16.3 c) . . . Divergente                                                                                                    11
                           1                                                         16.5 a) . . . . . . . . . . . . . 1           16.7 b) . . . . . . . . . . .
16.1 d) . . . . . . .                                                                                                                                                4
                         2 × 39                                           1
                                        16.4 a) . . . . . . . . . . .                                                   1
16.2 a) . . . . . . . . . . . . . e                                      12          16.5 b) . . . . . . . . . . . .               16.7 c) . . . . . . . . . . . . 16
                                                                                                                        4
                                                                     e                                                                                        2e3
16.2 b) . . . . . . . . e2 − 3          16.4 b) . . . . . . . .
                                                                                     16.5 c) . . . . . . . . . ln(2)               16.7 d) . . . . .
                                                                    e−1                                                                                              3
                                   1
                                                                                                                                                          (e − 1)
16.2 c). . . . . . . . . . . . e   2
                                                                                                                        π
                                                                                     16.5 d) . . . . . . . . . . . .
                                                                                                                        4


          Corrigés

 16.1 a)       La série est géométrique de raison 2 ̸∈ ] − 1, 1[, donc elle diverge.
..............................................................................................................................................................
                                                                                                                             +∞
                                                             1                                                      X 1 k          
                                                                                                                                        1
 16.1 b)       La série est géométrique de raison               ∈ ] − 1, 1[, donc elle converge. De plus,                         =           = 2.
                                                             2                                                              2         1 − 12
                                                                                                                    k=0
..............................................................................................................................................................
                                                               1
 16.1 c) La série est géométrique de raison √ ∈ ] − 1, 1[, donc elle converge. De plus, on a :
                                                                2
                                           +∞           k                      √
                                                                                                              √
                                           X 1         
                                                                   1               2           2
                                                   √        =         1
                                                                          =  √          =        √ = 2 + 2.
                                                     2          1 − √2          2−1        2− 2
                                           k=0
..............................................................................................................................................................
                                                                                                                            +∞     k
                                                               1                                           X 1                                 1     3
 16.1 d)       La série est géométrique de raison                ∈ ] − 1, 1[, donc elle converge. De plus,                               =          = . Donc :
                                                               3                                             3                               1 − 13  2
                                                                                                                            k=0
                                            +∞           +∞             9                            1 10
                                                                                                         
                                            X  1         X  1           X 1       3  1− 3                     3  1
                                                     =              −            = −                         = × 10 .
                                                3k             3k             3k  2   1 − 13                  2 3
                                         k=10            k=0            k=0
                                                                               +∞              +∞                      +∞
                                                                               X  1            X         1         1 X 1    1     1    3  1
Autre solution, avec le changement d’indice j = k − 10 :                                 k
                                                                                           =             j+10
                                                                                                              =           = 10 ×    1
                                                                                                                                      = × 10 .
                                                                                     3               3            310  3j  3     1− 3  2 3
                                                                              k=10             j=0                     j=0
..............................................................................................................................................................
                                                              X 1k
 16.2 a) On reconnaît la série exponentielle                           .
                                                                   k!
                                                               k
..............................................................................................................................................................
                                                                                     +∞ k                         +∞ k
                                                               X 2k                  X 2                          X 2           20     21
 16.2 b)       On reconnaît la série exponentielle                       , et on a               = e2 , donc                 = e2 −−       = e2 − 3.
                                                                   k!                    k!                       k!            0!     1!
                                                               k                   k=0                      k=2
..............................................................................................................................................................
                                       1 k
                                        
                           1
 16.2 c)       On a              = 2         et on reconnaît donc une série exponentielle.
                       2k × k!         k!
..............................................................................................................................................................

Réponses et corrigés                                                                                                                                                111
```

---
## PAGE 118

```text
                                                                                                                                         π2
 16.3 a)       Il s’agit d’une série de Riemann convergente, et vous savez peut-être que sa somme est                                       ; en général, si
                                                                                                                                         6
                                                                            +∞
                                                                            X  1
a > 1, on ne connaît pas la valeur exacte de la somme                             .
                                                                              ka
                                                                            k=1
..............................................................................................................................................................
 16.3 b)      Il s’agit d’une série de Riemann divergente.
..............................................................................................................................................................
 16.3 c)      La série harmonique diverge !
..............................................................................................................................................................
                        1       1                                                         1
 16.4 a) On a 2k = k , donc la série est géométrique de raison ∈ ] − 1, 1[ : elle converge. De plus :
                       2        4                                                         4
                                                               +∞  
                                                               X   1 k                 1    4
                                                                              =          1
                                                                                           = .
                                                                        4             1− 4  3
                                                               k=0
        +∞             +∞
        X  1           X  1          1      1       1
Donc,              =            − 0 − 1 =              .
              22k           4k      4      4       12
         k=2           k=0
..............................................................................................................................................................
                                                      1                                                1
 16.4 b) On a e−(k−1) = e−k e1 = e × k . Or la série géométrique de raison ∈ ] − 1, 1[ converge.
                                                     e                                                 e
           +∞                                          +∞                       +∞
               1 k            1       e                      X 1    e      e          e
           X                                     X −(k−1)                                                               
De plus,                 =      1
                                  =       , donc  e       =e      − 0 =e       −1 =       .
                   e         1− e   e − 1                      ek  e     e − 1      e − 1
            k=0                                          k=1                      k=0

                                                                             +∞                      +∞            +∞
                                                                             X −(k−1)                X  −j
                                                                                                                   X         j         1       e
Autre solution : le changement d’indice j = k − 1 donne                               e          =         e   =         (e−1 ) =           =     .
                                                                                                                                    1 − e−1   e−1
                                                                             k=1                     j=0           j=0
..............................................................................................................................................................
                                                                        i       i
 16.4 c) Il s’agit d’une série géométrique de raison et                            ∈ ] − 1, 1[, donc la série converge. De plus :
                                                                       7       7
                                             +∞                   +∞
                                                ik             i3 X i                         i3 1
                                                                         k−3
                                             X                                                              −i
                                                           =                              =             =         .
                                                   7   k−1     72   7                         72 1 − 7i   49 − 7i
                                             k=3                  k=3

                                                                                  +∞
                                                                                  X  ik        −i(49 + 7i)         1 − 7i
Enfin, en multipliant par l’expression conjuguée, on trouve                                 =                  =           .
                                                                                    7k−1         492 + 72           350
                                                                               k=3
..............................................................................................................................................................
                                                                               1                                      1              1
 16.4 d) On reconnaît une série géométrique de raison                            √ , qui est de module p                 √ 2 = √ ∈ ] − 1, 1[. Ainsi,
                                                                           1−i 2                                    2
                                                                                                                   1 + 2              3
la série converge. De plus :
                       +∞                                   +∞                   k−4
                       X        1           1    X                     1
                                 √ k =       √ 4                         √
                       k=4 (1 − i 2)
                                       (1 − i 2) k=4                 1−i 2
                                                                                         √ 4 √           √ 4 √
                                                 1        1                           1+i 2   i 2−1     1+i 2      2+i
                                          =       √ 4       1
                                                                =                                √  =             √ .
                                            (1 − i 2) 1 − 1−i√2                         3       i 2       3         2
                                                                                          √ 4          √
                                 √ 4          √
                                                                                  
                                                                                      1+i 2      −7 − 4i 2
En développant, on obtient (1 + i 2) = −7 − 4i 2, donc                                         =           et :
                                                                                        3           81

                                           +∞                                 √       √                      √
                                           X           1            −7 − 4i 2            2+i       −2 − 5i 2
                                                        √ k     =                  ×    √       =                 .
                                                                         81                2             54
                                           k=4 (1 − i 2)
..............................................................................................................................................................




112                                                                                                                                      Réponses et corrigés
```

---
## PAGE 119

```text
                                                                   n                      n 
                                                                              1               1 1                  1
                                                                   X                      X                
 16.5 a)      Soit n ∈ N∗ fixé. On remarque que                                       =                −
                                                                                                       =1−                −→ 1.
                                                                         k2 + k        k     k+1                n + 1 n→+∞
                                                              k=1               k=1
..............................................................................................................................................................
 16.5 b)      Soit n ∈ N∗ fixé. On remarque que :

                    n                                  n
                                1         1X 1    2     1                                          1  1     1      1                   1
                    X                                                                                                   
                                        =      −     +                                         =         −     +1−             −→          .
                          k3 + 3k2 + 2k   2  k   k+1   k+2                                         2 n+2   n+1     2           n→+∞ 4
                    k=1                             k=1
..............................................................................................................................................................
 16.5 c)      Soit n ⩾ 2 fixé. On remarque que :

  n  2                      n                                      n
      k                                        k2                                                                                  n+1
  X                           X                                        X                                                                  
        ln                =         ln                             =         (2 ln(k) − ln(k + 1) − ln(k − 1)) = ln(2) − ln                    −→ ln(2).
             k2 − 1                      (k − 1)(k + 1)                                                                             n          n→+∞
  k=2                         k=2                                      k=2
..............................................................................................................................................................
 16.5 d)      Soit n ⩾ 0 fixé. On remarque que, pour tout k :
                                                                                 
                                                 (k + 2) − (k + 1)
                                         arctan                                       = arctan(k + 2) − arctan(k + 1).
                                                1 + (k + 2)(k + 1)
        n                                                n
        X                 (k + 2) − (k + 1)            X                                                                                             π
Donc,        arctan                                 =       (arctan(k + 2) − arctan(k + 1)) = arctan(n + 2) − arctan(1) −→                             .
                         1 + (k + 2)(k + 1)                                                                                                 n→+∞ 4
         k=0                                            k=0
..............................................................................................................................................................
 16.6 a)      La série diverge grossièrement.
..............................................................................................................................................................
                                                                                       1
 16.6 b) On reconnaît une série géométrique dérivée, de raison ∈ ] − 1, 1[, donc convergente, dont la somme vaut :
                                                                                       2
                                                                                  1
                                                                               2 = 4.
                                                                       1 − 12
..............................................................................................................................................................
                                  1     1                 X 1                                                                        1
 16.7 a) On a k2−k = k k−1 ; la série                          k k−1 est une série géométrique dérivée, de raison                       ∈ ] − 1, 1[, et est
                                  2 2                            2                                                                   2
                                                               k
                                            +∞
                                            X          1          1
donc convergente. Sa somme est                   k k−1 =               2
                                                                          = 4.
                                                   2          (1 − 21 )
                                            k=1
..............................................................................................................................................................
                                                                                                          1
 16.7 b) La série converge comme somme d’une série géométrique de raison                                     ∈ ] − 1, 1[ et d’une série géométrique
                                                                                                          3
dérivée de même raison, et :
                      +∞                 X k  +∞                   +∞
                      X              1           X 1    1       1        1      9 3    11
                            (3k + 1) k =       +      − 0 =       1 2
                                                                      +    1
                                                                             −1= + −1=    .
                                    3     3k−1     3k  3    (1 − )      1− 3    4 2     4
                      k=1                     k=1                  k=0                             3
..............................................................................................................................................................
                                                                                                    1                                        2
 16.7 c) On reconnaît une série géométrique dérivée deux fois, de raison , convergente, de somme                                                3 = 16.
                                                                                                    2                                    1 − 12
..............................................................................................................................................................
 16.7 d)      On a affaire à une série géométrique dérivée deux fois.
..............................................................................................................................................................




Réponses et corrigés                                                                                                                                      113
```

---
