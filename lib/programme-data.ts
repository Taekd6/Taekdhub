import type { Subject } from "@/lib/supabase/types";

/**
 * LE PROGRAMME DE LA FILIÈRE MPSI → MP — maths, physique, chimie.
 *
 * Découpé comme un professeur découpe son année : un chapitre = ce qui
 * tient dans une à trois semaines de cours et porte un nom que l'élève
 * reconnaît. Ce n'est PAS le texte officiel recopié : c'en est la carte,
 * pour savoir ce qui est solide, ce qui s'efface, et ce qui n'a jamais été
 * revu (lib/programme.ts).
 *
 * `aliases` : d'autres façons de nommer le chapitre (« diagonalisation »
 * pour la réduction), pour reconnaître un chapitre de Mémoire ou une annale
 * dont le titre a été tapé librement. Comparés sans casse ni accents.
 *
 * `questions` : les QUESTIONS DE COURS classiques de colle — énoncés et
 * démonstrations qu'un colleur demande au tableau. Le mode khôlle
 * (lib/kholle.ts) les tire au sort.
 *
 * Les identifiants sont STABLES : ils sont enregistrés dans les préférences
 * de l'élève (chapitres vus en cours, programme de colle). On peut ajouter
 * des chapitres ou des questions, jamais renommer un identifiant.
 */

export type ProgrammeYear = 1 | 2;

export interface ProgrammeChapter {
  id: string;
  subject: Subject;
  /** 1 = sup (MPSI), 2 = spé (MP). */
  year: ProgrammeYear;
  title: string;
  aliases: string[];
  questions: string[];
}

type Entry = [id: string, title: string, aliases: string[], questions: string[]];

function chapters(subject: Subject, year: ProgrammeYear, entries: Entry[]): ProgrammeChapter[] {
  return entries.map(([id, title, aliases, questions]) => ({ id, subject, year, title, aliases, questions }));
}

const MATHS_SUP: Entry[] = [
  ["m1-logique", "Logique, ensembles, applications", ["raisonnement", "ensembles", "injection", "surjection", "bijection"], [
    "Montrer que la composée de deux injections (resp. surjections) est une injection (resp. surjection).",
    "Montrer que f est bijective si et seulement si elle admet une réciproque.",
    "Démontrer par l'absurde que √2 est irrationnel.",
    "Énoncer et illustrer le principe de récurrence forte.",
  ]],
  ["m1-complexes", "Nombres complexes et trigonométrie", ["complexes", "trigonometrie", "racines n-iemes"], [
    "Déterminer les racines n-ièmes de l'unité et calculer leur somme.",
    "Démontrer l'inégalité triangulaire dans ℂ et son cas d'égalité.",
    "Linéariser cos³x à l'aide des formules d'Euler.",
    "Résoudre une équation du second degré à coefficients complexes.",
  ]],
  ["m1-sommes", "Calculs algébriques, sommes et produits", ["sommes", "binome", "coefficients binomiaux"], [
    "Démontrer la formule du binôme de Newton.",
    "Démontrer la formule de Pascal et en déduire que les coefficients binomiaux sont entiers.",
    "Calculer Σ k et Σ k² pour k de 1 à n.",
    "Calculer une somme télescopique et une somme géométrique.",
  ]],
  ["m1-fonctions", "Fonctions usuelles", ["fonctions usuelles", "trigonometrie reciproque", "hyperboliques"], [
    "Étudier arctan et montrer que arctan x + arctan(1/x) = π/2 pour x > 0.",
    "Montrer que ln(1+x) ≤ x pour x > −1.",
    "Dériver arcsin et justifier son domaine de dérivabilité.",
  ]],
  ["m1-equadiff", "Équations différentielles linéaires", ["equations differentielles", "edl"], [
    "Résoudre y' + a(x)y = b(x) : structure des solutions et méthode de variation de la constante.",
    "Résoudre y'' + ay' + by = 0 selon le signe du discriminant.",
    "Énoncer le théorème de Cauchy pour une EDL d'ordre 1.",
  ]],
  ["m1-reels-suites", "Nombres réels et suites numériques", ["suites", "suites reelles", "borne superieure"], [
    "Démontrer qu'une suite croissante majorée converge.",
    "Énoncer et démontrer le théorème des suites adjacentes.",
    "Démontrer le théorème de Bolzano-Weierstrass.",
    "Montrer qu'une suite convergente est bornée et que sa limite est unique.",
  ]],
  ["m1-limites-continuite", "Limites et continuité", ["continuite", "limites", "valeurs intermediaires"], [
    "Démontrer le théorème des valeurs intermédiaires.",
    "Énoncer le théorème des bornes atteintes.",
    "Caractérisation séquentielle de la continuité.",
    "Montrer qu'une fonction continue et injective sur un intervalle est strictement monotone (idée).",
  ]],
  ["m1-derivabilite", "Dérivabilité", ["derivation", "rolle", "accroissements finis"], [
    "Démontrer le théorème de Rolle.",
    "Démontrer l'égalité des accroissements finis.",
    "Énoncer et démontrer la formule de Leibniz.",
    "Énoncer le théorème de la limite de la dérivée.",
  ]],
  ["m1-convexite", "Convexité", ["fonctions convexes", "inegalite de jensen"], [
    "Montrer qu'une fonction dérivable est convexe si et seulement si sa dérivée est croissante.",
    "Démontrer l'inégalité de Jensen (version finie).",
    "Montrer que le graphe d'une fonction convexe est au-dessus de ses tangentes.",
  ]],
  ["m1-arithmetique", "Arithmétique dans ℤ", ["arithmetique", "pgcd", "nombres premiers", "congruences"], [
    "Démontrer le théorème de Bézout.",
    "Démontrer le lemme de Gauss.",
    "Démontrer qu'il existe une infinité de nombres premiers.",
    "Énoncer et démontrer le petit théorème de Fermat.",
  ]],
  ["m1-structures", "Structures algébriques usuelles", ["groupes", "anneaux", "corps", "structures algebriques"], [
    "Montrer que l'image et le noyau d'un morphisme de groupes sont des sous-groupes.",
    "Montrer qu'un morphisme de groupes est injectif si et seulement si son noyau est trivial.",
    "Montrer qu'une intersection de sous-groupes est un sous-groupe.",
  ]],
  ["m1-polynomes", "Polynômes", ["polynomes", "racines", "division euclidienne"], [
    "Démontrer l'existence et l'unicité de la division euclidienne dans K[X].",
    "Montrer qu'un polynôme de degré n a au plus n racines.",
    "Caractériser la multiplicité d'une racine par les dérivées successives.",
    "Relations coefficients-racines pour un polynôme scindé.",
  ]],
  ["m1-fractions", "Fractions rationnelles", ["fractions rationnelles", "elements simples"], [
    "Énoncer le théorème de décomposition en éléments simples sur ℂ.",
    "Calculer la partie polaire relative à un pôle simple : formule P(a)/Q'(a).",
    "Décomposer P'/P pour P scindé.",
  ]],
  ["m1-ev", "Espaces vectoriels et dimension finie", ["espaces vectoriels", "dimension", "base", "sous-espaces"], [
    "Énoncer et démontrer le théorème de la base incomplète.",
    "Démontrer la formule de Grassmann.",
    "Caractériser une somme directe de deux sous-espaces.",
    "Montrer que toutes les bases d'un espace de dimension finie ont même cardinal (idée).",
  ]],
  ["m1-applications-lineaires", "Applications linéaires", ["applications lineaires", "rang", "projecteurs", "symetries"], [
    "Énoncer et démontrer le théorème du rang.",
    "Montrer qu'un projecteur p vérifie Im p ⊕ Ker p = E.",
    "Montrer qu'en dimension finie, injective ⇔ surjective ⇔ bijective pour un endomorphisme.",
  ]],
  ["m1-matrices", "Matrices", ["matrices", "changement de base", "rang d une matrice"], [
    "Formule de changement de base pour un endomorphisme.",
    "Montrer que deux matrices semblables ont même trace.",
    "Montrer que le rang d'une matrice est égal à celui de sa transposée (idée).",
  ]],
  ["m1-determinants", "Déterminants", ["determinant", "determinants"], [
    "Montrer que det(AB) = det(A)det(B) (idée de la preuve).",
    "Calculer le déterminant de Vandermonde.",
    "Montrer que A est inversible si et seulement si det A ≠ 0.",
  ]],
  ["m1-integration", "Intégration sur un segment", ["integration", "integrale de riemann", "sommes de riemann", "primitives"], [
    "Énoncer et démontrer le théorème fondamental de l'analyse.",
    "Démontrer la convergence des sommes de Riemann pour une fonction de classe C¹.",
    "Énoncer et démontrer la formule de Taylor avec reste intégral.",
    "Démontrer l'inégalité de Cauchy-Schwarz pour les intégrales.",
  ]],
  ["m1-asymptotique", "Analyse asymptotique", ["developpements limites", "dl", "equivalents", "negligeabilite"], [
    "Démontrer la formule de Taylor-Young (idée).",
    "Donner les DL en 0 de exp, ln(1+x), (1+x)^α, sin, cos à l'ordre n.",
    "Montrer que deux suites équivalentes ont même signe à partir d'un certain rang.",
  ]],
  ["m1-series", "Séries numériques", ["series", "series numeriques", "convergence absolue"], [
    "Démontrer qu'une série absolument convergente converge.",
    "Étudier la convergence des séries de Riemann Σ 1/n^α.",
    "Démontrer le critère de comparaison série-intégrale.",
    "Énoncer le théorème des séries alternées et la majoration du reste.",
  ]],
  ["m1-denombrement", "Dénombrement", ["denombrement", "combinatoire", "cardinal"], [
    "Nombre de parties à k éléments d'un ensemble à n éléments : démonstration.",
    "Nombre d'applications d'un ensemble à p éléments dans un ensemble à n éléments.",
    "Nombre d'injections de [[1,p]] dans [[1,n]].",
  ]],
  ["m1-probas", "Probabilités sur un univers fini", ["probabilites", "variables aleatoires finies", "bayes"], [
    "Énoncer et démontrer la formule des probabilités totales et la formule de Bayes.",
    "Espérance et variance d'une loi binomiale.",
    "Démontrer l'inégalité de Bienaymé-Tchebychev.",
    "Montrer que l'espérance est linéaire.",
  ]],
  ["m1-prehilbertiens", "Espaces préhilbertiens réels", ["produit scalaire", "orthogonalite", "gram-schmidt", "projection orthogonale"], [
    "Démontrer l'inégalité de Cauchy-Schwarz et son cas d'égalité.",
    "Décrire le procédé d'orthonormalisation de Gram-Schmidt.",
    "Montrer que la projection orthogonale réalise la distance à un sous-espace.",
  ]],
];

const MATHS_SPE: Entry[] = [
  ["m2-groupes-anneaux", "Groupes, anneaux, idéaux", ["groupes", "anneaux", "ideaux", "z/nz", "ordre d un element"], [
    "Montrer que l'ordre d'un élément divise le cardinal d'un groupe fini (cas commutatif ou Lagrange).",
    "Décrire les sous-groupes de (ℤ, +).",
    "Montrer que ℤ/nℤ est un corps si et seulement si n est premier.",
    "Énoncer le lemme chinois.",
  ]],
  ["m2-algebre-lineaire", "Compléments d'algèbre linéaire", ["polynomes d endomorphismes", "sous-espaces stables", "polynome minimal"], [
    "Montrer que le noyau et l'image d'un polynôme en u sont stables par u.",
    "Existence et propriétés du polynôme minimal d'un endomorphisme.",
    "Montrer que Ker P(u) ∩ Ker Q(u) = Ker (P∧Q)(u).",
  ]],
  ["m2-reduction", "Réduction des endomorphismes", ["reduction", "diagonalisation", "trigonalisation", "valeurs propres", "cayley-hamilton"], [
    "Énoncer et démontrer le lemme des noyaux.",
    "Montrer que u est diagonalisable si et seulement s'il annule un polynôme scindé à racines simples.",
    "Énoncer le théorème de Cayley-Hamilton.",
    "Montrer que des sous-espaces propres associés à des valeurs propres distinctes sont en somme directe.",
    "Montrer que si u et v commutent, les sous-espaces propres de u sont stables par v.",
    "Critère de trigonalisabilité.",
  ]],
  ["m2-euclidiens", "Espaces euclidiens", ["endomorphismes symetriques", "isometries", "theoreme spectral", "matrices orthogonales"], [
    "Énoncer et démontrer le théorème spectral (idée de la récurrence).",
    "Montrer que les valeurs propres d'un endomorphisme symétrique sont réelles.",
    "Caractériser les isométries vectorielles par la conservation du produit scalaire.",
    "Réduction des isométries du plan et de l'espace.",
  ]],
  ["m2-evn", "Espaces vectoriels normés, topologie", ["evn", "normes", "topologie", "compacite", "continuite"], [
    "Montrer que toutes les normes sont équivalentes en dimension finie (énoncé, idée).",
    "Montrer qu'une application linéaire en dimension finie est continue.",
    "Montrer que l'image d'un compact par une application continue est compacte.",
    "Caractérisation séquentielle des fermés.",
  ]],
  ["m2-series-compl", "Séries numériques et familles sommables", ["familles sommables", "produit de cauchy", "series"], [
    "Énoncer la règle de d'Alembert.",
    "Énoncer le théorème du produit de Cauchy de deux séries absolument convergentes.",
    "Sommation des relations de comparaison (énoncé).",
  ]],
  ["m2-suites-fonctions", "Suites et séries de fonctions", ["convergence uniforme", "convergence normale", "series de fonctions"], [
    "Montrer que la limite uniforme d'une suite de fonctions continues est continue.",
    "Montrer que la convergence normale entraîne la convergence uniforme.",
    "Énoncer le théorème de dérivation d'une série de fonctions.",
    "Énoncer le théorème de la double limite.",
  ]],
  ["m2-series-entieres", "Séries entières", ["series entieres", "rayon de convergence", "dse"], [
    "Énoncer et démontrer le lemme d'Abel.",
    "Montrer que Σ aₙzⁿ et Σ n aₙzⁿ ont même rayon de convergence.",
    "Développements en série entière de exp, 1/(1−x), ln(1+x), (1+x)^α.",
    "Montrer l'unicité du développement en série entière.",
  ]],
  ["m2-integration", "Intégration sur un intervalle quelconque", ["integrales generalisees", "integrabilite", "convergence dominee"], [
    "Étudier l'intégrabilité de t ↦ 1/t^α sur ]0,1] et sur [1,+∞[.",
    "Énoncer le théorème de convergence dominée.",
    "Énoncer le théorème d'intégration terme à terme.",
    "Montrer que t ↦ e^(−t²) est intégrable sur ℝ.",
  ]],
  ["m2-integrales-parametre", "Intégrales à paramètre", ["integrales a parametre", "fonction gamma"], [
    "Énoncer le théorème de continuité sous le signe intégrale.",
    "Énoncer le théorème de dérivation sous le signe intégrale.",
    "Montrer que Γ(x+1) = xΓ(x) et que Γ(n+1) = n!.",
  ]],
  ["m2-probas", "Probabilités et variables aléatoires discrètes", ["probabilites", "variables aleatoires", "loi de poisson", "loi geometrique", "esperance"], [
    "Espérance et variance d'une loi géométrique et d'une loi de Poisson.",
    "Démontrer l'inégalité de Markov et celle de Bienaymé-Tchebychev.",
    "Énoncer et démontrer la loi faible des grands nombres.",
    "Fonction génératrice d'une variable à valeurs dans ℕ : définition et lien avec l'espérance.",
    "Énoncer le théorème de continuité croissante.",
  ]],
  ["m2-calcul-diff", "Calcul différentiel", ["calcul differentiel", "differentielle", "gradient", "extrema", "derivees partielles"], [
    "Montrer qu'une fonction de classe C¹ est différentiable (énoncé) et donner sa différentielle.",
    "Règle de la chaîne pour les dérivées partielles.",
    "Montrer qu'en un extremum local d'un ouvert, le gradient est nul.",
    "Énoncer le théorème de Schwarz.",
  ]],
  ["m2-equadiff", "Équations différentielles linéaires (systèmes)", ["systemes differentiels", "exponentielle de matrice", "wronskien"], [
    "Énoncer le théorème de Cauchy linéaire.",
    "Montrer que l'ensemble des solutions de X' = A(t)X est un espace vectoriel de dimension n.",
    "Résoudre X' = AX avec A diagonalisable.",
    "Définir le wronskien et donner sa propriété.",
  ]],
];

const PHYSIQUE_SUP: Entry[] = [
  ["p1-signaux-ondes", "Signaux et propagation", ["ondes", "propagation", "interferences", "diffraction", "ondes progressives"], [
    "Écrire une onde progressive sinusoïdale et définir vitesse de phase, longueur d'onde.",
    "Établir la condition d'interférences constructives pour deux sources cohérentes.",
    "Donner l'ordre de grandeur de l'angle de diffraction θ ≈ λ/a.",
  ]],
  ["p1-optique", "Optique géométrique", ["optique geometrique", "lentilles", "snell-descartes", "miroirs"], [
    "Énoncer les lois de Snell-Descartes et établir la condition de réflexion totale.",
    "Construire l'image d'un objet par une lentille convergente et divergente.",
    "Énoncer les relations de conjugaison et de grandissement de Descartes.",
  ]],
  ["p1-circuits", "Circuits électriques et régime transitoire", ["electrocinetique", "circuits", "rc", "rl", "rlc", "regime transitoire"], [
    "Établir l'équation différentielle de la charge d'un condensateur dans un circuit RC.",
    "Bilan énergétique de la charge d'un condensateur.",
    "Établir l'équation d'un circuit RLC série et discuter les régimes selon le facteur de qualité.",
  ]],
  ["p1-sinusoidal", "Régime sinusoïdal forcé et filtrage", ["regime sinusoidal", "impedances", "filtres", "resonance", "diagramme de bode"], [
    "Étudier la résonance en intensité d'un RLC série.",
    "Établir la fonction de transfert d'un filtre RC passe-bas et tracer son diagramme de Bode.",
    "Définir la bande passante à −3 dB.",
  ]],
  ["p1-mecanique-point", "Mécanique du point", ["mecanique", "lois de newton", "energie", "oscillateur harmonique", "pendule"], [
    "Établir l'équation du pendule simple et sa période aux petites oscillations.",
    "Énoncer et démontrer le théorème de l'énergie cinétique.",
    "Étudier un oscillateur harmonique amorti par frottement fluide.",
    "Établir la trajectoire d'un projectile sans frottement.",
  ]],
  ["p1-force-centrale", "Mouvement dans un champ de force centrale", ["force centrale", "kepler", "satellites", "moment cinetique"], [
    "Montrer que le moment cinétique se conserve et que le mouvement est plan.",
    "Établir la loi des aires.",
    "Établir la vitesse d'un satellite en orbite circulaire et la troisième loi de Kepler.",
    "Définir l'énergie potentielle effective et discuter les états liés et de diffusion.",
  ]],
  ["p1-solide", "Solide en rotation autour d'un axe fixe", ["solide", "rotation", "moment d inertie", "theoreme du moment cinetique"], [
    "Énoncer le théorème du moment cinétique scalaire pour un solide en rotation.",
    "Établir l'équation du pendule pesant.",
    "Exprimer l'énergie cinétique d'un solide en rotation.",
  ]],
  ["p1-thermo", "Thermodynamique : premier et second principes", ["thermodynamique", "premier principe", "second principe", "entropie", "gaz parfait"], [
    "Énoncer le premier principe et calculer le travail des forces de pression.",
    "Calculer la variation d'entropie d'un gaz parfait.",
    "Établir la loi de Laplace pour une transformation adiabatique réversible.",
    "Calculer l'entropie créée lors du contact thermique de deux solides.",
  ]],
  ["p1-machines", "Machines thermiques", ["machines thermiques", "moteur", "rendement de carnot", "refrigerateur", "pompe a chaleur"], [
    "Établir le rendement de Carnot d'un moteur ditherme.",
    "Définir et majorer l'efficacité d'un réfrigérateur et d'une pompe à chaleur.",
    "Établir l'inégalité de Clausius pour un cycle ditherme.",
  ]],
  ["p1-statique-fluides", "Statique des fluides", ["statique des fluides", "pression", "archimede"], [
    "Établir la relation fondamentale de la statique des fluides.",
    "Établir le modèle de l'atmosphère isotherme.",
    "Démontrer le théorème d'Archimède.",
  ]],
  ["p1-magnetisme", "Champ magnétique et actions de Laplace", ["champ magnetique", "laplace", "moment magnetique"], [
    "Exprimer la force de Laplace sur un conducteur filiforme.",
    "Exprimer le couple subi par une spire dans un champ uniforme.",
    "Décrire les lignes de champ d'un aimant et d'une bobine.",
  ]],
  ["p1-induction", "Induction", ["induction", "loi de faraday", "lenz", "auto-induction", "rails de laplace"], [
    "Énoncer la loi de Faraday et la loi de modération de Lenz.",
    "Étudier les rails de Laplace : équations électrique et mécanique, bilan de puissance.",
    "Établir l'énergie magnétique stockée dans une bobine.",
  ]],
  ["p1-quantique", "Introduction au monde quantique", ["quantique", "photon", "de broglie", "effet photoelectrique"], [
    "Relation de Planck-Einstein et relation de de Broglie.",
    "Interpréter l'effet photoélectrique.",
    "Inégalité de Heisenberg spatiale : énoncé et ordre de grandeur.",
  ]],
];

const PHYSIQUE_SPE: Entry[] = [
  ["p2-optique-ondulatoire", "Optique ondulatoire", ["interferences", "michelson", "trous d young", "coherence"], [
    "Établir la formule de Fresnel pour deux ondes cohérentes.",
    "Calculer la différence de marche pour les trous d'Young.",
    "Décrire le Michelson en lame d'air et en coin d'air.",
    "Expliquer la perte de contraste due à l'étendue spatiale ou spectrale de la source.",
  ]],
  ["p2-electronique", "Électronique : ALI et oscillateurs", ["ali", "amplificateur lineaire integre", "oscillateurs", "filtrage numerique", "echantillonnage"], [
    "Établir le montage amplificateur non inverseur avec un ALI idéal.",
    "Étudier un oscillateur quasi-sinusoïdal (pont de Wien) : condition d'oscillation.",
    "Énoncer le critère de Shannon.",
  ]],
  ["p2-mecanique", "Référentiels non galiléens et frottement solide", ["referentiels non galileens", "force d inertie", "coriolis", "frottement solide", "lois de coulomb"], [
    "Exprimer les forces d'inertie d'entraînement et de Coriolis.",
    "Établir l'expression de la pesanteur terrestre (effet de la rotation).",
    "Énoncer les lois de Coulomb du frottement solide.",
  ]],
  ["p2-thermo-ouverts", "Thermodynamique en systèmes ouverts", ["systemes ouverts", "premier principe industriel", "diagramme p-h"], [
    "Établir le premier principe pour un système ouvert en écoulement stationnaire.",
    "Lire un cycle de machine frigorifique sur un diagramme (p, h).",
  ]],
  ["p2-diffusion", "Diffusion thermique", ["diffusion thermique", "loi de fourier", "equation de la chaleur", "resistance thermique"], [
    "Établir l'équation de la chaleur à une dimension.",
    "Énoncer la loi de Fourier.",
    "Définir la résistance thermique d'un mur et les associations série/parallèle.",
    "Relier temps et longueur de diffusion : τ ~ L²/D.",
  ]],
  ["p2-electrostatique", "Électrostatique", ["electrostatique", "theoreme de gauss", "potentiel", "condensateur", "champ electrique"], [
    "Énoncer et appliquer le théorème de Gauss à une sphère uniformément chargée.",
    "Calculer le champ d'un fil infini et d'un plan infini chargé.",
    "Établir la capacité d'un condensateur plan.",
    "Champ et potentiel d'un dipôle électrostatique.",
  ]],
  ["p2-magnetostatique", "Magnétostatique", ["magnetostatique", "theoreme d ampere", "solenoide", "dipole magnetique"], [
    "Énoncer le théorème d'Ampère et l'appliquer au fil infini.",
    "Calculer le champ à l'intérieur d'un solénoïde infini.",
    "Analyser les symétries et invariances d'une distribution de courants.",
  ]],
  ["p2-maxwell", "Équations de Maxwell", ["maxwell", "equations de maxwell", "energie electromagnetique", "vecteur de poynting"], [
    "Écrire les équations de Maxwell et en déduire la conservation de la charge.",
    "Établir l'équation locale de Poynting.",
    "Montrer comment l'ARQS simplifie les équations de Maxwell.",
  ]],
  ["p2-ondes-em", "Ondes électromagnétiques", ["ondes electromagnetiques", "onde plane", "polarisation", "plasma", "conducteur", "effet de peau"], [
    "Établir l'équation de d'Alembert pour le champ électrique dans le vide.",
    "Structure d'une onde plane progressive harmonique dans le vide.",
    "Établir la relation de dispersion dans un plasma et définir la pulsation plasma.",
    "Établir l'épaisseur de peau dans un conducteur.",
  ]],
  ["p2-ondes-mecaniques", "Ondes mécaniques et acoustiques", ["corde vibrante", "ondes stationnaires", "acoustique", "ondes sonores"], [
    "Établir l'équation de d'Alembert pour la corde vibrante.",
    "Déterminer les modes propres d'une corde fixée aux deux extrémités.",
    "Établir l'équation de propagation des ondes sonores dans un fluide.",
  ]],
  ["p2-quantique", "Physique quantique", ["schrodinger", "fonction d onde", "puits infini", "effet tunnel"], [
    "Écrire l'équation de Schrödinger et chercher les états stationnaires.",
    "Quantification de l'énergie dans un puits infini.",
    "Interpréter l'effet tunnel et l'ordre de grandeur de la probabilité de passage.",
  ]],
  ["p2-thermo-stat", "Thermodynamique statistique", ["facteur de boltzmann", "physique statistique", "atmosphere isotherme"], [
    "Retrouver le facteur de Boltzmann sur l'atmosphère isotherme.",
    "Énoncer le théorème d'équipartition et l'appliquer à un gaz parfait.",
    "Système à deux niveaux : énergie moyenne et capacité thermique.",
  ]],
];

const CHIMIE_SUP: Entry[] = [
  ["c1-transformations", "Transformations de la matière et équilibres", ["avancement", "quotient de reaction", "constante d equilibre", "equilibre chimique"], [
    "Définir le quotient de réaction et prévoir le sens d'évolution.",
    "Faire un tableau d'avancement et déterminer l'état final d'un équilibre.",
    "Définir l'activité d'une espèce selon son état physique.",
  ]],
  ["c1-cinetique", "Cinétique chimique", ["cinetique", "vitesse de reaction", "ordre", "arrhenius", "temps de demi-reaction"], [
    "Établir la loi intégrée d'une réaction d'ordre 1 et son temps de demi-réaction.",
    "Énoncer la loi d'Arrhenius.",
    "Décrire la méthode de dégénérescence de l'ordre.",
  ]],
  ["c1-atomistique", "Architecture de la matière", ["atomistique", "configuration electronique", "lewis", "vsepr", "classification periodique"], [
    "Établir la configuration électronique d'un élément et la relier à sa place dans la classification.",
    "Écrire une structure de Lewis et prévoir la géométrie par la méthode VSEPR.",
    "Évolution de l'électronégativité dans la classification.",
  ]],
  ["c1-cristallo", "Cristallographie", ["cristallographie", "cubique a faces centrees", "compacite", "solides cristallins"], [
    "Décrire la maille cubique à faces centrées : population, coordinence, compacité.",
    "Déterminer la taille des sites octaédriques et tétraédriques du CFC.",
    "Calculer la masse volumique d'un cristal à partir de sa maille.",
  ]],
  ["c1-acide-base", "Réactions acide-base et précipitation", ["acide base", "ph", "pka", "precipitation", "produit de solubilite", "titrage"], [
    "Tracer un diagramme de prédominance et calculer le pH d'un acide faible.",
    "Définir le produit de solubilité et calculer une solubilité.",
    "Prévoir la réaction prépondérante entre un acide et une base.",
  ]],
  ["c1-redox", "Oxydoréduction", ["oxydoreduction", "nernst", "piles", "potentiel standard", "redox"], [
    "Énoncer la formule de Nernst et l'appliquer à un couple.",
    "Calculer la constante d'équilibre d'une réaction d'oxydoréduction.",
    "Décrire le fonctionnement d'une pile Daniell.",
  ]],
  ["c1-e-ph", "Diagrammes potentiel-pH", ["diagramme e-ph", "potentiel-ph", "pourbaix"], [
    "Tracer le diagramme E-pH de l'eau.",
    "Lire un diagramme E-pH pour prévoir une dismutation ou une corrosion.",
  ]],
];

const CHIMIE_SPE: Entry[] = [
  ["c2-thermochimie-1", "Thermochimie : premier principe", ["enthalpie de reaction", "loi de hess", "enthalpie standard", "temperature de flamme"], [
    "Définir l'enthalpie standard de réaction et énoncer la loi de Hess.",
    "Calculer une température de flamme adiabatique.",
  ]],
  ["c2-thermochimie-2", "Thermochimie : second principe et équilibres", ["enthalpie libre", "potentiel chimique", "loi de van t hoff", "deplacement d equilibre"], [
    "Relier l'enthalpie libre standard de réaction à la constante d'équilibre.",
    "Énoncer et démontrer la relation de van 't Hoff.",
    "Prévoir l'effet d'une variation de température ou de pression sur un équilibre.",
  ]],
  ["c2-courbes-ip", "Courbes intensité-potentiel", ["courbes intensite-potentiel", "surtension", "electrolyse", "corrosion"], [
    "Tracer l'allure des courbes intensité-potentiel d'un système rapide et d'un système lent.",
    "Prévoir les réactions d'une électrolyse à l'aide des courbes i-E.",
    "Expliquer la protection contre la corrosion par anode sacrificielle.",
  ]],
  ["c2-piles-electrolyse", "Conversion électrochimique", ["piles", "accumulateurs", "electrolyse", "capacite d une pile"], [
    "Relier la fem d'une pile à l'enthalpie libre de réaction.",
    "Calculer la capacité d'une pile ou la masse déposée lors d'une électrolyse (loi de Faraday).",
  ]],
];

export const PROGRAMME: readonly ProgrammeChapter[] = [
  ...chapters("Mathématiques", 1, MATHS_SUP),
  ...chapters("Mathématiques", 2, MATHS_SPE),
  ...chapters("Physique", 1, PHYSIQUE_SUP),
  ...chapters("Physique", 2, PHYSIQUE_SPE),
  ...chapters("Chimie", 1, CHIMIE_SUP),
  ...chapters("Chimie", 2, CHIMIE_SPE),
];

/** Les matières couvertes par la carte, dans l'ordre de l'application. */
export const PROGRAMME_SUBJECTS: readonly Subject[] = ["Mathématiques", "Physique", "Chimie"];

export const PROGRAMME_BY_ID: ReadonlyMap<string, ProgrammeChapter> = new Map(PROGRAMME.map((chapter) => [chapter.id, chapter]));
