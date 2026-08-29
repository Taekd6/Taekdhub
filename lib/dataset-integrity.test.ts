import { describe, expect, it } from "vitest";
import bank from "@/datasets/exercices-banque-complete.json";
import { parseExerciseImportPayload } from "@/lib/exercise-import";
import { loadSeedBank } from "@/lib/seed";
import { estimatedDurationMinutes } from "@/lib/recommendation";
import { PLAN_DURATION_PRESETS } from "@/lib/plan";

/**
 * Intégrité de la banque LIVRÉE (`datasets/exercices-banque-complete.json`) —
 * chantier "qualité des données pédagogiques".
 *
 * Ces tests ne jugent PAS la pédagogie : une banque déséquilibrée (beaucoup
 * plus de maths que de chimie, aucune difficulté 5 en informatique) est un
 * choix légitime, jamais une anomalie. Ils protègent uniquement les
 * invariants dont le moteur et l'UI dépendent RÉELLEMENT, chacun ajouté
 * parce que l'audit a montré qu'il n'était garanti ni par les types
 * TypeScript (le JSON n'est jamais typé à la lecture) ni par un test
 * existant.
 *
 * Le fichier est édité à la main : c'est la seule barrière entre une faute de
 * frappe et la banque de tous les élèves.
 */

/** Champs reconnus par `parseExerciseImportPayload` — tout le reste est ignoré SILENCIEUSEMENT à l'import. */
const KNOWN_FIELDS = new Set([
  "title", "statement", "source", "subject", "type", "difficulty", "chapter",
  "estimatedMinutes", "estimated_minutes", "tags", "hints", "correction", "note",
  "year", "competition", "programmeLevel", "programme_level", "licenseStatus",
  "license_status", "level", "prerequisites", "pedagogicalGoal", "pedagogical_goal",
  "archived", "sourceUrl", "source_url", "externalId", "external_id",
]);

const entries = bank as Record<string, unknown>[];

describe("datasets/exercices-banque-complete.json — intégrité de la banque livrée", () => {
  it("est intégralement acceptée par le pipeline d'import réel (aucune fiche perdue en silence)", () => {
    const { rows, errors } = parseExerciseImportPayload(bank, []);
    // Une fiche rejetée n'est jamais signalée à l'élève : `loadSeedBank` ne
    // regarde que `rows`. Elle disparaîtrait purement et simplement de la
    // banque livrée.
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(entries.length);
  });

  it("n'utilise aucun champ inconnu — une clé mal orthographiée est ignorée sans erreur", () => {
    // Cas réel corrigé par ce chantier : `"estimatedMinutel": 20` cohabitait
    // avec `estimatedMinutes` sur une fiche. Inoffensif ce jour-là, mais une
    // correction de durée écrite dans la clé fautive n'aurait eu aucun effet.
    const unknown = entries.flatMap((entry, index) =>
      Object.keys(entry)
        .filter((key) => !KNOWN_FIELDS.has(key))
        .map((key) => `[${index}] "${String(entry.title)}" → champ inconnu "${key}"`)
    );
    expect(unknown).toEqual([]);
  });

  it("a une clé de rapprochement (matière + titre) unique — sinon la mise à jour de contenu fusionne deux fiches", () => {
    // `reconcileSeedBank` (lib/seed.ts) rapproche une fiche stockée d'une
    // fiche de la banque par `matière::titre` : les identifiants sont tirés
    // localement et ne survivent pas d'une version à l'autre. Deux fiches
    // partageant cette clé feraient perdre à l'élève la progression de l'une
    // des deux, silencieusement.
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    entries.forEach((entry, index) => {
      const key = `${String(entry.subject)}::${String(entry.title).trim().toLowerCase()}`;
      const first = seen.get(key);
      if (first !== undefined) duplicates.push(`${key} (index ${first} et ${index})`);
      else seen.set(key, index);
    });
    expect(duplicates).toEqual([]);
  });

  it("ne contient pas deux graphies d'un même tag dans une même matière", () => {
    // Les tags alimentent le filtre « sous-thème » par correspondance EXACTE
    // (`tagOptionsForFilters`/`filterExercises`, lib/exercise-filters.ts).
    // Cas réel corrigé par ce chantier : « loi de Van't Hoff » et « loi de
    // van't Hoff » produisaient deux entrées voisines dans le sélecteur, un
    // exercice chacune, là où l'élève en attendait une seule avec les deux.
    const byNormalized = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (entry.archived === true || !Array.isArray(entry.tags)) continue;
      for (const tag of entry.tags as string[]) {
        const key = `${String(entry.subject)}::${tag.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}`;
        if (!byNormalized.has(key)) byNormalized.set(key, new Set());
        byNormalized.get(key)!.add(tag);
      }
    }
    const collisions = [...byNormalized]
      .filter(([, variants]) => variants.size > 1)
      .map(([key, variants]) => `${key} → ${[...variants].map((v) => `"${v}"`).join(" / ")}`);
    expect(collisions).toEqual([]);
  });
});

describe("amorçage réel (loadSeedBank) — ce que le moteur reçoit vraiment", () => {
  it("produit des identifiants uniques et des chapitres tous résolvables", async () => {
    const { exercises, chapters } = await loadSeedBank();
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length);
    expect(new Set(chapters.map((chapter) => chapter.id)).size).toBe(chapters.length);

    // `describeFocus` (lib/plan.ts) et `progressByChapter` (lib/progress.ts)
    // résolvent `chapter_id` dans une Map de chapitres : un identifiant
    // orphelin ferait taire le libellé du chapitre sans jamais lever d'erreur.
    const chapterIds = new Set(chapters.map((chapter) => chapter.id));
    const orphans = exercises.filter((exercise) => exercise.chapter_id !== null && !chapterIds.has(exercise.chapter_id));
    expect(orphans).toEqual([]);
  });

  it("donne à chaque exercice actif une durée strictement positive et atteignable par le plan le plus long", async () => {
    const { exercises } = await loadSeedBank();
    const active = exercises.filter((exercise) => !exercise.archived);

    // Une durée nulle ou négative ferait boucler `fillBudget`/`selectWithinBudget`
    // sur un coût nul (lib/plan.ts, lib/recommendation.ts) : l'exercice serait
    // pris quel que soit le budget restant.
    const nonPositive = active.filter((exercise) => exercise.estimated_minutes !== null && exercise.estimated_minutes <= 0);
    expect(nonPositive).toEqual([]);

    // `fillBudget` SAUTE tout exercice plus long que le budget : au-delà du
    // préréglage le plus long, un exercice actif ne peut plus apparaître dans
    // AUCUN plan du jour. Être hors d'atteinte à 20 ou 45 min est normal et
    // volontaire ; l'être partout ne l'est pas.
    const longestPreset = Math.max(...PLAN_DURATION_PRESETS);
    const unreachable = active
      .filter((exercise) => estimatedDurationMinutes(exercise, []) > longestPreset)
      .map((exercise) => `${exercise.subject} — ${exercise.title} (${exercise.estimated_minutes} min)`);
    expect(unreachable).toEqual([]);
  });
});
