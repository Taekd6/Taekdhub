/**
 * Chapitre du programme (lib/programme-data.ts) → pages de chapitre Wikiprepa
 * (`/concours/chapitre/<slug>`, liste relevée le 2026-11-20 sur
 * wikiprepa.fr/concours/chapitres). En maths, Wikiprepa découpe plus large
 * que le programme : plusieurs chapitres de sup partagent la même page.
 */
export const WIKI_CHAPTERS: Record<string, string[]> = {
  "m1-complexes": ["nombres-complexes-trigonometrie"],
  "m1-sommes": ["nombres-complexes-trigonometrie"],
  "m1-fonctions": ["limites-continuite-derivabilite-integration"],
  "m1-equadiff": ["equations-differentielles"],
  "m1-reels-suites": ["limites-continuite-derivabilite-integration"],
  "m1-limites-continuite": ["limites-continuite-derivabilite-integration"],
  "m1-derivabilite": ["limites-continuite-derivabilite-integration"],
  "m1-convexite": ["limites-continuite-derivabilite-integration"],
  "m1-arithmetique": ["algebre-generale"],
  "m1-structures": ["algebre-generale"],
  "m1-polynomes": ["polynomes-fractions-rationnelles"],
  "m1-fractions": ["polynomes-fractions-rationnelles"],
  "m1-ev": ["algebre-lineaire"],
  "m1-applications-lineaires": ["algebre-lineaire"],
  "m1-matrices": ["algebre-lineaire"],
  "m1-determinants": ["algebre-lineaire"],
  "m1-integration": ["limites-continuite-derivabilite-integration"],
  "m1-asymptotique": ["limites-continuite-derivabilite-integration"],
  "m1-series": ["series-numeriques-familles-sommables"],
  "m1-denombrement": ["probabilites-discretes"],
  "m1-probas": ["probabilites-discretes"],
  "m1-prehilbertiens": ["espaces-euclidiens"],
  "m2-groupes-anneaux": ["algebre-generale"],
  "m2-algebre-lineaire": ["algebre-lineaire"],
  "m2-reduction": ["reduction-des-endomorphismes"],
  "m2-euclidiens": ["espaces-euclidiens"],
  "m2-evn": ["topologie-evn"],
  "m2-series-compl": ["series-numeriques-familles-sommables"],
  "m2-suites-fonctions": ["suites-et-series-de-fonctions"],
  "m2-series-entieres": ["series-entieres"],
  "m2-integration": ["integrales-generalisees"],
  "m2-integrales-parametre": ["integrales-a-parametres"],
  "m2-probas": ["probabilites-discretes"],
  "m2-calcul-diff": ["calcul-differentiel"],
  "m2-equadiff": ["equations-differentielles"],

  "p1-signaux-ondes": ["signaux-propagation"],
  "p1-optique": ["reflexion-refraction", "lentilles-miroirs", "instruments-optique"],
  "p1-circuits": ["circuits-regime-transitoire"],
  "p1-sinusoidal": ["regime-sinusoidal-filtrage"],
  "p1-mecanique-point": ["mecanique-du-point", "energie-mecanique", "particule-chargee"],
  "p1-force-centrale": ["forces-centrales"],
  "p1-solide": ["mecanique-du-solide"],
  "p1-thermo": ["systeme-thermodynamique", "principes-thermodynamique", "changements-etat"],
  "p1-machines": ["machines-thermiques"],
  "p1-statique-fluides": ["statique-des-fluides"],
  "p1-magnetisme": ["induction", "dipoles"],
  "p1-induction": ["induction"],
  "p1-quantique": ["dualite-onde-corpuscule"],
  "p2-optique-ondulatoire": ["modele-scalaire-coherence", "interferences-young", "interferences-michelson"],
  "p2-electronique": ["amplificateur-lineaire-integre", "electronique-numerique"],
  "p2-mecanique": ["referentiels-non-galileens", "frottement-solide"],
  "p2-thermo-ouverts": ["systemes-ouverts"],
  "p2-diffusion": ["diffusion-thermique", "diffusion-particules"],
  "p2-electrostatique": ["electrostatique"],
  "p2-magnetostatique": ["magnetostatique"],
  "p2-maxwell": ["equations-de-maxwell"],
  "p2-ondes-em": ["ondes-electromagnetiques-milieux", "reflexion-ondes-electromagnetiques"],
  "p2-ondes-mecaniques": ["corde-vibrante", "ondes-acoustiques", "dispersion-paquets-ondes"],
  "p2-quantique": ["equation-de-schrodinger", "quantification-confinement", "effet-tunnel"],
  "p2-thermo-stat": ["physique-statistique"],

  "c1-transformations": ["thermodynamique-chimique"],
  "c1-cinetique": ["cinetique-chimique"],
  "c1-atomistique": ["atomistique", "liaisons-interactions"],
  "c1-cristallo": ["cristallographie"],
  "c1-acide-base": ["solutions-aqueuses", "titrages"],
  "c1-redox": ["oxydoreduction"],
  "c1-e-ph": ["diagrammes-e-ph"],
  "c2-thermochimie-1": ["thermodynamique-chimique"],
  "c2-thermochimie-2": ["thermodynamique-chimique"],
  "c2-courbes-ip": ["courbes-intensite-potentiel"],
  "c2-piles-electrolyse": ["electrolyse-accumulateurs", "oxydoreduction"],
};

export function wikiSlugsFor(chapterId: string): string[] {
  return WIKI_CHAPTERS[chapterId] ?? [];
}

/** Chapitre de maths → parcours « Cours » de Booleanopera (cours en briques + exos liés, suivi Acquis / À revoir sur le site). Relevé le 2026-11-20. */
const BOOLEANOPERA: Record<string, number> = {
  "m1-structures": 42, "m2-groupes-anneaux": 42,
  "m1-reels-suites": 47, "m1-series": 47, "m2-series-compl": 47,
  "m1-ev": 49, "m1-applications-lineaires": 49, "m1-matrices": 49, "m1-determinants": 49, "m2-algebre-lineaire": 49,
  "m1-integration": 58, "m2-integration": 58,
  "m2-evn": 61,
  "m1-arithmetique": 70,
  "m2-suites-fonctions": 75,
  "m2-reduction": 77,
  "m2-integrales-parametre": 83,
  "m1-prehilbertiens": 86, "m2-euclidiens": 86,
  "m2-series-entieres": 94,
  "m1-denombrement": 96, "m1-probas": 96, "m2-probas": 96,
  "m1-fonctions": 101, "m1-limites-continuite": 101, "m1-derivabilite": 101, "m1-convexite": 101,
  "m2-calcul-diff": 102,
  "m1-equadiff": 232, "m2-equadiff": 232,
};

export function booleanoperaUrl(chapterId: string): string | null {
  const id = BOOLEANOPERA[chapterId];
  return id ? `https://www.booleanopera.fr/parcours/voir/${id}/` : null;
}
