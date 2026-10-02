import type { AnnaleLog } from "@/lib/annales";
import { ankiByChapter, type ChapterAnki } from "@/lib/anki-mapping";
import { ANKI_TREND_STALE_DAYS, latestFullSnapshot, snapshotAgeHours, type AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ExerciseAttempt } from "@/lib/attempts";
import { diagnoseChapters, rankDiagnoses, type ChapterDiagnosis } from "@/lib/diagnostic";
import { buildExercises, type Exercise } from "@/lib/exercises";
import type { KholleHistory } from "@/lib/kholle";
import type { ChapterMemory, ErrorEntry, Preferences, WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/**
 * Tout ce dont les écrans (Programme, Next Move, Bilan, débrief) et le
 * connecteur MCP ont besoin pour parler des lacunes, assemblé UNE fois et
 * de la même façon partout :
 *
 *   exercices   annales + tentatives (lib/exercises.ts) ;
 *   anki        chiffres par chapitre du dernier relevé complet, seulement
 *               s'il a moins de `ANKI_TREND_STALE_DAYS` jours — un vieux
 *               relevé ne doit pas fonder un diagnostic d'aujourd'hui ;
 *   diagnostic  constats par chapitre, et leur ordre de priorité.
 */

export interface DiagnosticContextInput {
  chapterMemory: ChapterMemory[];
  attempts: ExerciseAttempt[];
  errors: ErrorEntry[];
  ankiSnapshots: AnkiSnapshot[];
  workItems: WorkItem[];
  preferences: Pick<Preferences, "ankiDeckChapters" | "retryDelaysDays">;
  annales: AnnaleLog[];
  kholle: KholleHistory;
  now: Date;
}

export interface DiagnosticContext {
  exercises: Exercise[];
  /** `null` : pas de relevé complet, ou relevé trop vieux. */
  anki: Map<string, ChapterAnki> | null;
  ankiSnapshot: AnkiSnapshot | null;
  ankiStale: boolean;
  diagnoses: ChapterDiagnosis[];
  ranked: ChapterDiagnosis[];
}

export function buildDiagnosticContext(input: DiagnosticContextInput): DiagnosticContext {
  const today = dayKey(input.now);
  const exercises = buildExercises({ annales: input.annales, attempts: input.attempts, retryDelaysDays: input.preferences.retryDelaysDays, today });
  const snapshot = latestFullSnapshot(input.ankiSnapshots);
  const stale = snapshot ? snapshotAgeHours(snapshot.takenAt, input.now) / 24 > ANKI_TREND_STALE_DAYS : false;
  const anki = snapshot && !stale ? ankiByChapter(snapshot, input.preferences.ankiDeckChapters) : null;
  const diagnoses = diagnoseChapters({ chapterMemory: input.chapterMemory, exercises, errors: input.errors, anki, kholle: input.kholle, workItems: input.workItems, today });
  return { exercises, anki, ankiSnapshot: snapshot, ankiStale: stale, diagnoses, ranked: rankDiagnoses(diagnoses) };
}
