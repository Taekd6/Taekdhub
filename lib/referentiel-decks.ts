import { foldText } from "@/lib/annales";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

/**
 * PAQUETS DU RÉFÉRENTIEL → CHAPITRES DU PROGRAMME.
 *
 * Le paquet `public/anki/taekdhub-referentiel.apkg` (scripts/referentiel) range ses cartes dans
 * `TaekdHub::Référentiel::<matière>::<chapitre>`. Le nom du chapitre est un identifiant du référentiel, pas un titre du
 * programme : on les associe par cette table EXPLICITE (pas par ressemblance de noms, qui rattacherait « thermodynamique »
 * au chapitre de première année). Une entrée n'existe que si le rattachement est sans ambiguïté ; les autres paquets
 * (« rappels-mpsi-algebre », « complexes-polynomes », « fonctions-vectorielles », « analyse-vectorielle », « dipoles »,
 * « dipole-rayonnant », « conducteurs-induction », « electronique-numerique », « rappels-ordres-de-grandeur »,
 * « rappels-particules-chargees », « rappels-mpsi-physique », « rappels-mpsi-analyse », « rappels-mpsi-chimie »,
 * « complexite-tri ») restent « non classés » : plusieurs chapitres possibles, ou aucun. L'élève peut toujours les
 * rattacher à la main (préférences, `ankiDeckChapters`), ce qui prime.
 *
 * Garde : lib/referentiel-decks.test.ts.
 */
export const REFERENTIEL_DECK_CHAPTERS: Readonly<Record<string, string>> = {
  // Mathématiques
  "determinants": "m1-determinants",
  "espaces-prehilbertiens": "m1-prehilbertiens",
  "techniques-asymptotiques": "m1-asymptotique",
  "algebre-lineaire": "m2-algebre-lineaire",
  "calcul-differentiel": "m2-calcul-diff",
  "endomorphismes-euclidiens": "m2-euclidiens",
  "equations-differentielles": "m2-equadiff",
  "espaces-vectoriels-normes": "m2-evn",
  "fondements-probabilites": "m2-probas",
  "moments-variables-aleatoires": "m2-probas",
  "integrales-generalisees": "m2-integration",
  "integrales-parametre": "m2-integrales-parametre",
  "reduction": "m2-reduction",
  "series-entieres": "m2-series-entieres",
  "series-numeriques": "m2-series-compl",
  "structures-algebriques": "m2-groupes-anneaux",
  "suites-series-fonctions": "m2-suites-fonctions",
  // Physique
  "diffusion-thermique": "p2-diffusion",
  "electrocinetique-alo": "p2-electronique",
  "electrostatique": "p2-electrostatique",
  "magnetostatique": "p2-magnetostatique",
  "equations-de-maxwell": "p2-maxwell",
  "ondes-em-vide": "p2-ondes-em",
  "ondes-plasmas-conducteurs": "p2-ondes-em",
  "ondes-mecaniques": "p2-ondes-mecaniques",
  "optique-geometrique": "p1-optique",
  "optique-ondulatoire": "p2-optique-ondulatoire",
  "physique-quantique": "p2-quantique",
  "physique-statistique": "p2-thermo-stat",
  "rappels-induction-mpsi": "p1-induction",
  "rappels-mecanique-point": "p1-mecanique-point",
  "rappels-physique-quantique-mpsi": "p1-quantique",
  "rappels-thermodynamique-mpsi": "p1-thermo",
  "referentiels-non-galileens": "p2-mecanique",
  "systemes-de-points-solide": "p1-solide",
  "signaux-filtrage": "p1-sinusoidal",
  "thermodynamique": "p2-thermo-ouverts",
  // Chimie
  "electrochimie-courbes-iE-corrosion": "c2-courbes-ip",
  "electrochimie-redox-piles": "c2-piles-electrolyse",
  "thermochimie-premier-principe": "c2-thermochimie-1",
  "thermochimie-second-principe-equilibres": "c2-thermochimie-2",
};

const BY_FOLDED = new Map(Object.entries(REFERENTIEL_DECK_CHAPTERS).map(([slug, id]) => [foldText(slug), id]));

/**
 * Le paquet est-il NOTRE paquet, rangé sous `TaekdHub::Référentiel::…` ? Un paquet de l'élève qui contiendrait lui aussi un
 * segment « Référentiel » (« MP::Référentiel::Réduction ») n'est PAS concerné : il garde son rattachement par le titre.
 */
export function isReferentielDeck(path: readonly string[]): boolean {
  return path.length >= 2 && foldText(path[0]) === "taekdhub" && foldText(path[1]) === "referentiel";
}

/** Chapitre du programme d'un paquet du référentiel (dernier segment = identifiant du chapitre), ou `null`. */
export function referentielChapterId(path: readonly string[]): string | null {
  if (!isReferentielDeck(path) || path.length === 0) return null;
  return BY_FOLDED.get(foldText(path[path.length - 1])) ?? null;
}

/**
 * Les paquets du référentiel rattachés à un chapitre du programme (sens inverse de la table), nom Anki complet :
 * `TaekdHub::Référentiel::<matière>::<chapitre>`. Vide quand le chapitre n'a aucun paquet sûr (jamais deviné).
 */
export function referentielDecksForChapter(chapterId: string): string[] {
  const chapter = PROGRAMME_BY_ID.get(chapterId);
  if (!chapter) return [];
  return Object.entries(REFERENTIEL_DECK_CHAPTERS)
    .filter(([, id]) => id === chapterId)
    .map(([slug]) => `TaekdHub::Référentiel::${chapter.subject}::${slug}`)
    .sort();
}
