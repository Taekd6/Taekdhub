import { getChaptersForSubject } from "@/lib/chapters";
import { DEFAULT_MASTERY, DEFAULT_PRIORITY, type Chapter } from "@/lib/storage";
import { exerciseTypes, subjects } from "@/lib/study";
import type { NewExerciseInput } from "@/components/exercises/exercise-form";
import type { Difficulty, Exercise, ExerciseLevel, ExerciseType, LicenseStatus, ProgrammeLevel, Subject } from "@/lib/supabase/types";

/**
 * Import en masse d'exercices (Sprint infrastructure banque) — un fichier
 * JSON (tableau d'objets) plutôt qu'un exercice à la fois via le formulaire.
 * Volontairement STRICT sur les valeurs énumérées (matière, type) : contrairement
 * à `validateBackupPayload` (lib/storage.ts, permissif car il migre d'anciennes
 * sauvegardes internes), ici la source est un fichier écrit par l'utilisateur
 * — une erreur explicite par ligne vaut mieux qu'une matière silencieusement
 * remplacée par une autre.
 */

/**
 * Concours acceptés dans le dataset principal, par ordre de priorité pour la
 * prépa MP (consigne produit) — clé : alias reconnus en entrée (minuscules,
 * sans accent/tiret normalisés), valeur : libellé canonique stocké sur
 * `Exercise.competition`. e3a et Banque PT sont acceptés mais doivent rester
 * minoritaires dans le dataset (vérifié au niveau du rapport, pas ici).
 */
const COMPETITION_ALIASES: Record<string, string> = {
  ccinp: "CCINP",
  ccp: "CCINP",
  "mines-ponts": "Mines-Ponts",
  minesponts: "Mines-Ponts",
  "mines ponts": "Mines-Ponts",
  e3a: "e3a",
  "e3a-polytech": "e3a",
  "e3a polytech": "e3a",
  pt: "PT",
  "banque pt": "PT",
  centrale: "Centrale",
  "centrale-supelec": "Centrale",
  "centrale supelec": "Centrale",
  "centrale-supélec": "Centrale",
};

/** Explicitement HORS périmètre du dataset principal (consigne produit) — jamais importés, quelle que soit la casse ou l'orthographe. */
const EXCLUDED_COMPETITIONS = new Set(["x", "ens", "polytechnique", "ens ulm", "ens lyon", "ens paris-saclay", "ens cachan", "ens rennes", "x-ens", "x/ens"]);

function normalizeCompetitionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Construit un Exercise complet à partir des champs saisis — seule source de
 * vérité pour les valeurs par défaut (priorité, maîtrise, statut initial…),
 * réutilisée par components/exercises/exercise-manager.tsx#create ET par
 * l'import en masse ci-dessous, pour ne jamais les faire diverger. */
export function createExerciseFromInput(input: NewExerciseInput): Exercise {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    title: input.title,
    chapter_id: input.chapterId,
    source: input.source,
    year: input.year ?? null,
    competition: input.competition ?? null,
    programme_level: input.programmeLevel ?? null,
    license_status: input.licenseStatus ?? null,
    external_id: input.externalId ?? null,
    source_url: input.sourceUrl ?? null,
    prerequisites: input.prerequisites ?? [],
    pedagogical_goal: input.pedagogicalGoal ?? null,
    level: input.level ?? null,
    type: input.type,
    difficulty: input.difficulty,
    priority: DEFAULT_PRIORITY,
    mastery: DEFAULT_MASTERY,
    status: "à faire",
    estimated_minutes: input.estimatedMinutes,
    attempts: 0,
    note: input.note || null,
    created_at: now,
    updated_at: now,
    tags: input.tags,
    hints: input.hints,
    correction: input.correction || null,
    favorite: false,
    archived: input.archived ?? false,
    last_worked_at: null,
  };
}

export interface ExerciseImportRowError {
  index: number;
  message: string;
}

export interface ParsedImportRow {
  index: number;
  input: NewExerciseInput;
  /** Libellé de chapitre tel qu'écrit dans le fichier — `null` si non renseigné. */
  chapterLabel: string | null;
  /** `true` si `chapterLabel` ne correspond à aucun chapitre existant pour cette matière : sera créé au moment de la validation par l'utilisateur, jamais silencieusement. */
  isNewChapter: boolean;
}

export interface ExerciseImportParseResult {
  rows: ParsedImportRow[];
  errors: ExerciseImportRowError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseListField(value: unknown, splitOn: string): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(splitOn).map((item) => item.trim()).filter(Boolean);
  return [];
}

/**
 * Valide et normalise un fichier JSON importé — un tableau d'objets, un par
 * exercice. Chaque ligne est traitée indépendamment : une ligne invalide
 * n'empêche jamais les autres d'être importées, elle est simplement listée
 * dans `errors` pour que l'utilisateur puisse la corriger et réessayer.
 */
export function parseExerciseImportPayload(raw: unknown, chapters: Chapter[]): ExerciseImportParseResult {
  const rows: ParsedImportRow[] = [];
  const errors: ExerciseImportRowError[] = [];

  if (!Array.isArray(raw)) {
    errors.push({ index: 0, message: "Le fichier doit contenir un tableau JSON (une entrée par exercice)." });
    return { rows, errors };
  }

  raw.forEach((entry, index) => {
    const label = `Ligne ${index + 1}`;
    if (!isRecord(entry)) {
      errors.push({ index, message: `${label} — ce n'est pas un objet JSON valide.` });
      return;
    }

    const title = asTrimmedString(entry.title);
    if (!title) {
      errors.push({ index, message: `${label} — champ "title" manquant.` });
      return;
    }

    const source = asTrimmedString(entry.source);
    if (!source) {
      errors.push({ index, message: `${label} ("${title}") — champ "source" manquant.` });
      return;
    }

    const subjectRaw = asTrimmedString(entry.subject);
    const subject = subjectRaw && (subjects as string[]).includes(subjectRaw) ? (subjectRaw as Subject) : null;
    if (!subject) {
      errors.push({
        index,
        message: `${label} ("${title}") — matière invalide${subjectRaw ? ` ("${subjectRaw}")` : " (absente)"}. Attendu : ${subjects.join(", ")}.`,
      });
      return;
    }

    const typeRaw = asTrimmedString(entry.type);
    if (typeRaw && !(exerciseTypes as string[]).includes(typeRaw)) {
      errors.push({ index, message: `${label} ("${title}") — type invalide ("${typeRaw}"). Attendu : ${exerciseTypes.join(", ")}.` });
      return;
    }
    const type: ExerciseType = (typeRaw as ExerciseType) ?? "Personnel";

    const difficultyRaw = entry.difficulty;
    if (difficultyRaw !== undefined && difficultyRaw !== null && (typeof difficultyRaw !== "number" || difficultyRaw < 1 || difficultyRaw > 5)) {
      errors.push({ index, message: `${label} ("${title}") — difficulté invalide (attendu un nombre entre 1 et 5).` });
      return;
    }
    const difficulty = (difficultyRaw ? (Math.round(difficultyRaw as number) as Difficulty) : 3) as Difficulty;

    const estimatedRaw = entry.estimatedMinutes ?? entry.estimated_minutes;
    const estimatedMinutes = typeof estimatedRaw === "number" && estimatedRaw > 0 ? Math.round(estimatedRaw) : null;

    // Concours (Sprint infrastructure banque concours) : X/ENS explicitement
    // hors périmètre, tout autre concours reconnu est normalisé vers son
    // libellé canonique — voir COMPETITION_ALIASES.
    const competitionRaw = asTrimmedString(entry.competition);
    let competition: string | null = null;
    if (competitionRaw) {
      const key = normalizeCompetitionKey(competitionRaw);
      if (EXCLUDED_COMPETITIONS.has(key)) {
        errors.push({ index, message: `${label} ("${title}") — X/ENS est explicitement hors périmètre du dataset principal (consigne produit), non importé.` });
        return;
      }
      competition = COMPETITION_ALIASES[key] ?? null;
      if (!competition) {
        errors.push({
          index,
          message: `${label} ("${title}") — concours non reconnu ("${competitionRaw}"). Attendu : CCINP, Mines-Ponts, e3a, PT, Centrale.`,
        });
        return;
      }
    }

    const archived = entry.archived === true;

    // Niveau de programme : pour un exercice de concours ACTIF (non archivé),
    // strictement "sup" (contrainte pédagogique produit — jamais déduit du
    // concours d'origine ni de la difficulté). Un exercice de concours "spe"
    // reste importable s'il est explicitement archivé (Sprint 4 : catalogue
    // de références réelles, quarantaine tant que la Spé n'est pas commencée
    // — voir la même logique appliquée à `level` 4/6 plus bas).
    const programmeLevelRaw = asTrimmedString(entry.programmeLevel ?? entry.programme_level);
    let programmeLevel: ProgrammeLevel | null = null;
    if (programmeLevelRaw) {
      if (!["sup", "spe", "sup_spe"].includes(programmeLevelRaw)) {
        errors.push({ index, message: `${label} ("${title}") — programmeLevel invalide ("${programmeLevelRaw}"). Attendu : sup, spe, sup_spe.` });
        return;
      }
      programmeLevel = programmeLevelRaw as ProgrammeLevel;
    }
    if (competition && !archived && programmeLevel !== "sup") {
      errors.push({
        index,
        message: `${label} ("${title}") — un exercice de concours actif (non archivé) doit avoir programmeLevel "sup" (fourni : ${programmeLevelRaw ?? "absent"}). Pour référencer un sujet réel de niveau Spé, importe-le avec archived: true.`,
      });
      return;
    }

    // Contrainte pédagogique absolue (consigne produit) : un exercice "spe"
    // ne doit JAMAIS apparaître dans les recommandations/la liste active tant
    // que l'utilisateur n'a pas commencé la Spé — appliqué ici en exigeant
    // `archived: true` plutôt qu'en modifiant recommendExercises (voir
    // components/exercises/exercise-manager.tsx#ArchivedExercises, déjà
    // masqué de la liste et des recommandations, restaurable manuellement).
    if (programmeLevel === "spe" && !archived) {
      errors.push({
        index,
        message: `${label} ("${title}") — programmeLevel "spe" doit obligatoirement être importé avec archived: true (jamais dans les recommandations actives tant que la Spé n'est pas commencée).`,
      });
      return;
    }

    // Palier pédagogique (Sprint 4) — même garde-fou que programmeLevel "spe"
    // ci-dessus : les paliers "transition Spé" (4) et "expert" (6) sont par
    // nature hors du "faisable maintenant" et doivent être archivés, sinon le
    // moteur de recommandation les mélangerait aux niveaux actifs.
    const levelRaw = entry.level;
    let level: ExerciseLevel | null = null;
    if (levelRaw !== undefined && levelRaw !== null) {
      if (typeof levelRaw !== "number" || !Number.isInteger(levelRaw) || levelRaw < 1 || levelRaw > 6) {
        errors.push({ index, message: `${label} ("${title}") — level invalide (${levelRaw}). Attendu : un entier de 1 à 6.` });
        return;
      }
      level = levelRaw as ExerciseLevel;
      if ((level === 4 || level === 6) && !archived) {
        errors.push({
          index,
          message: `${label} ("${title}") — level ${level} (${level === 4 ? "transition Spé" : "expert"}) doit obligatoirement être importé avec archived: true.`,
        });
        return;
      }
    }

    const licenseStatusRaw = asTrimmedString(entry.licenseStatus ?? entry.license_status);
    let licenseStatus: LicenseStatus | null = null;
    if (licenseStatusRaw) {
      if (!["libre", "à vérifier", "restreint"].includes(licenseStatusRaw)) {
        errors.push({ index, message: `${label} ("${title}") — licenseStatus invalide ("${licenseStatusRaw}"). Attendu : libre, à vérifier, restreint.` });
        return;
      }
      if (licenseStatusRaw === "restreint") {
        errors.push({ index, message: `${label} ("${title}") — statut de licence "restreint" : non importable.` });
        return;
      }
      licenseStatus = licenseStatusRaw as LicenseStatus;
    } else if (competition) {
      // Concours sans statut de licence explicite : jamais présumé "libre"
      // (voir note sur l'absence de licence publiée par les concours) —
      // enregistré comme à vérifier plutôt que silencieusement omis.
      licenseStatus = "à vérifier";
    }

    const yearRaw = entry.year;
    if (yearRaw !== undefined && yearRaw !== null && (typeof yearRaw !== "number" || yearRaw < 1900 || yearRaw > 2100)) {
      errors.push({ index, message: `${label} ("${title}") — année invalide (attendu un nombre, ex. 2022).` });
      return;
    }
    const year = typeof yearRaw === "number" ? yearRaw : null;

    const externalId = asTrimmedString(entry.externalId ?? entry.external_id);
    const sourceUrl = asTrimmedString(entry.sourceUrl ?? entry.source_url);
    const prerequisites = parseListField(entry.prerequisites, ",");
    const pedagogicalGoal = asTrimmedString(entry.pedagogicalGoal ?? entry.pedagogical_goal);

    const chapterLabel = asTrimmedString(entry.chapter);
    let chapterId: string | null = null;
    let isNewChapter = false;
    if (chapterLabel) {
      const existing = getChaptersForSubject(chapters, subject).find((chapter) => chapter.label.toLowerCase() === chapterLabel.toLowerCase());
      if (existing) chapterId = existing.id;
      else isNewChapter = true;
    }

    rows.push({
      index,
      chapterLabel,
      isNewChapter,
      input: {
        subject,
        title,
        source,
        type,
        difficulty,
        chapterId,
        tags: parseListField(entry.tags, ","),
        estimatedMinutes,
        note: asTrimmedString(entry.note) ?? "",
        hints: parseListField(entry.hints, "\n"),
        correction: asTrimmedString(entry.correction) ?? "",
        year,
        competition,
        programmeLevel,
        licenseStatus,
        externalId,
        sourceUrl,
        prerequisites,
        pedagogicalGoal,
        archived,
        level,
      },
    });
  });

  return { rows, errors };
}

/**
 * Modèle téléchargeable — démontre le format attendu avec des valeurs
 * clairement identifiées comme placeholders (pas de faux contenu de prépa
 * présenté comme réel, aucun énoncé, aucune attribution à une année/un sujet
 * précis). Seuls `title`, `source` et `subject` sont obligatoires ; tous les
 * autres champs sont optionnels. `programmeLevel: "sup"` est obligatoire dès
 * que `competition` est renseigné (dataset filtré sur le programme de Sup) —
 * X/ENS sont rejetés à l'import, quel que soit `programmeLevel`.
 */
export const EXERCISE_IMPORT_TEMPLATE = [
  {
    title: "Exemple à remplacer — Calcul de dérivées",
    source: "Modèle d'import TaekdHub",
    subject: "Mathématiques",
    type: "TD",
    difficulty: 3,
    chapter: "Exemple de chapitre",
    estimatedMinutes: 20,
    tags: ["exemple"],
    hints: ["Premier indice, léger.", "Deuxième indice, plus précis."],
    correction: "",
    note: "Remplace ce contenu par tes propres exercices avant d'importer.",
  },
  {
    title: "Exemple à remplacer — sans les champs optionnels",
    source: "Modèle d'import TaekdHub",
    subject: "Physique",
    type: "DM",
    difficulty: 2,
  },
  {
    title: "Exemple à remplacer — exercice de concours (champs infra)",
    source: "Modèle d'import TaekdHub — remplace par la vraie référence (ex. \"CCINP 2022 MP Maths 1\")",
    subject: "Mathématiques",
    type: "Concours",
    difficulty: 3,
    competition: "CCINP",
    programmeLevel: "sup",
    licenseStatus: "à vérifier",
    year: 2022,
    externalId: "",
    sourceUrl: "",
    prerequisites: ["développements limités"],
    pedagogicalGoal: "exemple de champ — décrit ce que l'exercice cherche réellement à entraîner",
  },
  {
    title: "Exemple à remplacer — pilier de Spé (hors recommandations actives)",
    source: "Modèle d'import TaekdHub",
    subject: "Mathématiques",
    type: "TD",
    difficulty: 2,
    programmeLevel: "spe",
    archived: true,
    prerequisites: ["réduction des endomorphismes"],
    pedagogicalGoal: "introduction en douceur à une notion de 2e année, à débloquer soi-même une fois le cours vu",
  },
];

export function downloadExerciseImportTemplate(): void {
  const data = JSON.stringify(EXERCISE_IMPORT_TEMPLATE, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "taekdhub-modele-import-exercices.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
