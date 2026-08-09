import { getChaptersForSubject } from "@/lib/chapters";
import { DEFAULT_MASTERY, DEFAULT_PRIORITY, type Chapter } from "@/lib/storage";
import { exerciseTypes, subjects } from "@/lib/study";
import type { NewExerciseInput } from "@/components/exercises/exercise-form";
import type { Difficulty, Exercise, ExerciseType, Subject } from "@/lib/supabase/types";

/**
 * Import en masse d'exercices (Sprint infrastructure banque) — un fichier
 * JSON (tableau d'objets) plutôt qu'un exercice à la fois via le formulaire.
 * Volontairement STRICT sur les valeurs énumérées (matière, type) : contrairement
 * à `validateBackupPayload` (lib/storage.ts, permissif car il migre d'anciennes
 * sauvegardes internes), ici la source est un fichier écrit par l'utilisateur
 * — une erreur explicite par ligne vaut mieux qu'une matière silencieusement
 * remplacée par une autre.
 */

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
    year: null,
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
    archived: false,
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
    if (difficultyRaw !== undefined && (typeof difficultyRaw !== "number" || difficultyRaw < 1 || difficultyRaw > 5)) {
      errors.push({ index, message: `${label} ("${title}") — difficulté invalide (attendu un nombre entre 1 et 5).` });
      return;
    }
    const difficulty = (difficultyRaw ? (Math.round(difficultyRaw as number) as Difficulty) : 3) as Difficulty;

    const estimatedRaw = entry.estimatedMinutes ?? entry.estimated_minutes;
    const estimatedMinutes = typeof estimatedRaw === "number" && estimatedRaw > 0 ? Math.round(estimatedRaw) : null;

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
      },
    });
  });

  return { rows, errors };
}

/**
 * Modèle téléchargeable — démontre le format attendu avec des valeurs
 * clairement identifiées comme placeholders (pas de faux contenu de prépa
 * présenté comme réel). Seuls `title`, `source` et `subject` sont
 * obligatoires ; tous les autres champs sont optionnels.
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
