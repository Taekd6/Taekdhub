/**
 * CHAPITRE DU PROGRAMME → PAQUET(S) ANKI.
 *
 * Table écrite à la main d'après le relevé complet des paquets de l'élève
 * (530 paquets, 22 nov. 2026). Les noms des paquets portent un numéro et un
 * découpage (« 11 Diffusion thermique::01 - Cours ») qui ne se rapprochent
 * pas sûrement des titres du programme : on les ASSOCIE donc explicitement
 * (lib/anki-mapping.ts reste la voie du diagnostic, qui n'accepte que les
 * correspondances sûres).
 *
 * Chaque entrée est un paquet PARENT : AnkiMobile y étudie aussi tous ses
 * sous-paquets (Cours, Démos, Flash…). Le PREMIER est le principal ; les
 * suivants sont proposés en plus. Un chapitre absent de la table n'a pas
 * (encore) de paquet : `chapterAnkiDecks` rend `[]`.
 *
 * Module pur.
 */

const MPSI = "Maths MP::00 - Rappels MPSI::";
const PHY0 = "Physique MP::00 Rappels MPSI::";
const PHY0_OLD = "Physique MP::00 - Rappels MPSI::";
const CHIM0 = "Chimie MP::00 Rappels MPSI::";
const THERMO12 = "Physique MP::12 Thermodynamique - Principes et systèmes ouverts";
const INFO_PY = "Informatique MP::Python (tronc commun)::";
const INFO_OPT = "Informatique MP::Option::";

const ALGEBRE_LINEAIRE = "Maths MP::08 - Révisions d'algèbre linéaire";
const EQUADIFF = "Maths MP::14 - Équations différentielles linéaires";
const STRUCTURES = "Maths MP::18 - Structures algébriques usuelles";
const COMPLEXES_POLY = "Maths MP::19 - Nombres complexes et polynômes";

export const CHAPTER_ANKI_DECKS: Readonly<Record<string, readonly string[]>> = {
  // Maths — rappels de sup
  "m1-logique": [`${MPSI}01 Logique, ensembles et applications`],
  "m1-reels-suites": [`${MPSI}02 Nombres réels et suites`],
  "m1-limites-continuite": [`${MPSI}03 Limites et continuité`],
  "m1-derivabilite": [`${MPSI}04 Dérivabilité et convexité`],
  "m1-convexite": [`${MPSI}04 Dérivabilité et convexité`],
  "m1-integration": [`${MPSI}05 Intégration sur un segment et primitives`],
  "m1-arithmetique": [`${MPSI}06 Arithmétique dans Z et groupe symétrique`],
  "m1-denombrement": [`${MPSI}07 Dénombrement et probabilités finies`],
  "m1-probas": [`${MPSI}07 Dénombrement et probabilités finies`],
  "m1-sommes": [`${MPSI}08 Fractions rationnelles, sommes et fonctions usuelles`],
  "m1-fonctions": [`${MPSI}08 Fractions rationnelles, sommes et fonctions usuelles`],
  "m1-fractions": [`${MPSI}08 Fractions rationnelles, sommes et fonctions usuelles`],
  "m1-complexes": [COMPLEXES_POLY],
  "m1-polynomes": [COMPLEXES_POLY],
  "m1-structures": [STRUCTURES],
  "m1-ev": [ALGEBRE_LINEAIRE],
  "m1-applications-lineaires": [ALGEBRE_LINEAIRE],
  "m1-matrices": [ALGEBRE_LINEAIRE],
  "m1-determinants": ["Maths MP::09 - Déterminants"],
  "m1-equadiff": [EQUADIFF],
  "m1-asymptotique": ["Maths MP::01 - Techniques asymptotiques"],
  "m1-series": ["Maths MP::02 - Séries numériques"],
  "m1-prehilbertiens": ["Maths MP::11 - Espaces préhilbertiens réels"],

  // Maths — spé
  "m2-groupes-anneaux": [STRUCTURES],
  "m2-algebre-lineaire": [ALGEBRE_LINEAIRE],
  "m2-reduction": ["Maths MP::10 - Réduction des endomorphismes"],
  "m2-euclidiens": ["Maths MP::12 - Endomorphismes d'un espace euclidien"],
  "m2-evn": ["Maths MP::04 - Espaces vectoriels normés et topologie"],
  "m2-series-compl": ["Maths MP::20 - Familles sommables", "Maths MP::02 - Séries numériques"],
  "m2-suites-fonctions": ["Maths MP::05 - Suites et séries de fonctions"],
  "m2-series-entieres": ["Maths MP::06 - Séries entières"],
  "m2-integration": ["Maths MP::03 - Intégrales généralisées"],
  "m2-integrales-parametre": ["Maths MP::07 - Intégrales à paramètre"],
  "m2-probas": ["Maths MP::16 - Fondements des probabilités", "Maths MP::17 - Moments d'une variable aléatoire"],
  "m2-calcul-diff": ["Maths MP::15 - Calcul différentiel"],
  "m2-equadiff": [EQUADIFF],

  // Physique — sup
  "p1-signaux-ondes": [`${PHY0}Optique géométrique et signaux`],
  "p1-optique": [`${PHY0}Optique géométrique et signaux`],
  "p1-circuits": [`${PHY0}Électrocinétique et ALI`, `${PHY0_OLD}Électrocinétique et ALI`],
  "p1-sinusoidal": [`${PHY0}Signaux et filtrage`],
  "p1-mecanique-point": [`${PHY0}Mécanique du point`],
  "p1-force-centrale": [`${PHY0}Mécanique du point`],
  "p1-solide": ["Physique MP::02 Mécanique - Système de points et solide"],
  "p1-thermo": [`${PHY0_OLD}Thermodynamique`, `${PHY0}Thermodynamique`],
  "p1-machines": [`${THERMO12}::04 - Diagrammes et cycles`, `${PHY0}Thermodynamique::4 Diagrammes et cycles`],
  "p1-magnetisme": [`${PHY0_OLD}Magnétisme et induction`, `${PHY0}Magnétisme et induction`],
  "p1-induction": [`${PHY0_OLD}Magnétisme et induction`, `${PHY0}Magnétisme et induction`],
  "p1-quantique": [`${PHY0}Physique quantique`],

  // Physique — spé
  "p2-optique-ondulatoire": ["Physique MP::14 Optique ondulatoire - Interférences"],
  "p2-electronique": [`${PHY0}Électrocinétique et ALI`, "Physique MP::16 Électronique numérique"],
  "p2-mecanique": ["Physique MP::01 Mécanique - Référentiels non galiléens"],
  "p2-thermo-ouverts": [THERMO12],
  "p2-diffusion": ["Physique MP::11 Diffusion thermique", "Physique MP::Transferts thermiques"],
  "p2-electrostatique": ["Physique MP::04 Électrostatique", "Physique MP::05 Dipôles électrostatique et magnétique"],
  "p2-magnetostatique": ["Physique MP::06 Magnétostatique"],
  "p2-maxwell": ["Physique MP::07 Équations de Maxwell"],
  "p2-ondes-em": ["Physique MP::09 Ondes électromagnétiques dans le vide", "Physique MP::10 Ondes dans les plasmas et les conducteurs"],
  "p2-ondes-mecaniques": ["Physique MP::17 Ondes mécaniques - Corde vibrante"],
  "p2-quantique": ["Physique MP::15 Physique quantique"],
  "p2-thermo-stat": ["Physique MP::13 Physique statistique"],

  // Chimie
  "c1-transformations": [`${CHIM0}Transformations chimiques`],
  "c1-cinetique": [`${CHIM0}Cinétique chimique`],
  "c1-atomistique": [`${CHIM0}Architecture de la matière`],
  "c1-redox": [`${CHIM0}Oxydo-réduction`],
  "c2-thermochimie-1": ["Chimie MP::01 Thermochimie - Premier principe"],
  "c2-thermochimie-2": ["Chimie MP::02 Thermochimie - Second principe et équilibres"],
  "c2-piles-electrolyse": ["Chimie MP::03 Électrochimie - Rappels redox et piles"],
  "c2-courbes-ip": ["Chimie MP::04 Électrochimie - Courbes i-E et corrosion"],

  // Informatique — tronc commun
  "i-python-complexite": [`${INFO_PY}01 · Bases et complexité`],
  "i-tris-recherche": [`${INFO_PY}02 · Tris et dichotomie`],
  "i-recursivite": ["Informatique MP::2 · Tronc commun Python"],
  "i-graphes": [`${INFO_PY}04 · Graphes en Python`],
  "i-prog-dyn": [`${INFO_PY}03 · Glouton et programmation dynamique`],
  "i-sql": [`${INFO_PY}06 · Flottants et bases de données`],
  "i-ia-jeux": ["Informatique MP::2 · Tronc commun Python"],

  // Informatique — option
  "o-ocaml": [`${INFO_OPT}Récursivité et structures`, "Informatique MP::1 · Option OCaml"],
  "o-arbres-tas": [`${INFO_OPT}Récursivité et structures`],
  "o-logique": [`${INFO_OPT}Logique`],
  "o-automates": [`${INFO_OPT}Automates`, `${INFO_OPT}Automates (compléments)`],
  "o-graphes": [`${INFO_OPT}Graphes`],
};

/** Les paquets Anki d'un chapitre du programme (le premier est le principal) — `[]` s'il n'en a pas. */
export function chapterAnkiDecks(chapterId: string): readonly string[] {
  return CHAPTER_ANKI_DECKS[chapterId] ?? [];
}

/** Nom court d'un paquet pour un bouton : le dernier segment, sans numéro de tête (« 11 Diffusion thermique » → « Diffusion thermique »). */
export function deckShortName(deck: string): string {
  const last = deck.split("::").pop() ?? deck;
  return last.replace(/^\d+\s*[-·.]?\s*/, "").trim() || last;
}
