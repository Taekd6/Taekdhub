import { normalizeAnnaleLogs, type AnnaleLog } from "@/lib/annales";
import { ankiByChapter } from "@/lib/anki-mapping";
import { latestFullSnapshot, normalizeAnkiSnapshots } from "@/lib/anki-snapshot";
import { ATTEMPT_CAUSE_LABEL, isCleanSuccess, normalizeAttempts, type AttemptCause, type ExerciseAttempt } from "@/lib/attempts";
import { buildExercises, type Exercise } from "@/lib/exercises";
import { bestProgrammeMatch } from "@/lib/programme";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { ERROR_TYPE_META } from "@/lib/error-log";
import {
  normalizeChapterMemory,
  normalizeErrorEntry,
  normalizeGrade,
  normalizePreferences,
  normalizeWorkItem,
  type ChapterMemory,
  type ErrorEntry,
  type Grade,
  type WorkItem,
} from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { activeWorkItems, daysUntilDue } from "@/lib/work-items";

/**
 * MÉMOIRE PÉDAGOGIQUE — ce que l'historique de l'élève permet d'affirmer, et
 * rien de plus. LECTURE SEULE : aucune fonction d'ici n'écrit ni ne modifie
 * ses entrées. C'est ce que les IA interrogent (outils MCP `get_debriefs` et
 * `get_recommandations`, app/api/mcp/[key]/route.ts).
 *
 * DEUX VUES
 *
 *   évaluations   les DS / colles débriefés, question par question : chapitre,
 *                 résultat, cause et SA FIABILITÉ, erreur du carnet, et l'état
 *                 de la correction.
 *   difficultés   par chapitre, ce qui se répète. Pas de score : des faits
 *                 datés, et la règle ci-dessous.
 *
 * RÈGLES — explicites :
 *
 *   1. Une OBSERVATION est une question (ou un exercice) non réussie, rattachée
 *      à un chapitre du programme. Sans chapitre, elle n'entre pas dans la
 *      vue par chapitre — elle est comptée à part, jamais devinée.
 *   2. Un ÉVÉNEMENT est une évaluation (toutes les questions d'un même DS
 *      comptent UNE fois) ou un exercice (ses tentatives successives, une
 *      fois). Deux questions ratées dans le même DS ne font pas « deux
 *      évaluations ».
 *   3. « RÉCURRENTE » = au moins deux événements distincts. Un seul : « signal »,
 *      à confirmer — le système dit qu'il manque des données.
 *   4. Une difficulté est CORRIGÉE seulement par une réussite SANS AIDE
 *      (`isCleanSuccess`) sur le chapitre, POSTÉRIEURE à la dernière
 *      observation. Relire la correction ne ferme rien.
 *   5. La cause retenue est la plus fréquente parmi les causes DÉCLARÉES (une
 *      cause « incertaine » n'a jamais été enregistrée). Sans cause : l'action
 *      proposée est d'abord de la déterminer.
 *
 * Fonctions pures.
 */

export interface PedagogyInput {
  grades: readonly Grade[];
  attempts: readonly ExerciseAttempt[];
  errors: readonly ErrorEntry[];
  workItems: readonly WorkItem[];
  chapterMemory: readonly ChapterMemory[];
  annales: readonly AnnaleLog[];
  retryDelaysDays: number[];
  /** Paquets Anki associés avec sûreté, par chapitre du programme. */
  ankiDecksByChapter?: ReadonlyMap<string, string[]>;
  today: string;
}

const HORIZON_DAYS = 45;
export const LAST_EVALUATIONS_DEFAULT = 3;
export const LAST_EVALUATIONS_MAX = 10;
const OBSERVATIONS_SHOWN = 6;

function chapterTitle(id: string | null): string | null {
  return id ? PROGRAMME_BY_ID.get(id)?.title ?? null : null;
}

function labelOf(attempt: ExerciseAttempt): string {
  return attempt.label.includes(" — ") ? attempt.label.slice(attempt.label.lastIndexOf(" — ") + 3) : attempt.label;
}

/* ── Les évaluations débriefées ───────────────────────────────────── */

export interface QuestionView {
  libelle: string;
  chapitre: { id: string; titre: string } | null;
  resultat: ExerciseAttempt["result"];
  cause: string | null;
  /** « probable » ou « incertaine » quand le diagnostic vient d'une IA ; absent : posé par l'élève. */
  confiance: "probable" | "incertaine" | null;
  manque_de_temps: boolean;
  description: string | null;
  erreur: { type: string; bonne_idee: string | null } | null;
  etat: string;
  /** Posée par un débrief IA validé par l'élève. */
  par_ia: boolean;
}

export interface EvaluationView {
  id: string;
  titre: string;
  matiere: Subject;
  type: Grade["kind"];
  date: string;
  note: string | null;
  questions: QuestionView[];
}

function questionState(attempt: ExerciseAttempt, exercise: Exercise | undefined): string {
  if (attempt.result === "réussi") return "réussie";
  if (exercise?.status === "vérifié" && exercise.verifiedOn) return `corrigée : réussie sans aide le ${exercise.verifiedOn}`;
  if (exercise && exercise.steps.length > 1) return "en cours : refaite, pas encore réussie sans aide";
  if (attempt.cause === null && !attempt.lackOfTime) return "à vérifier : cause non établie";
  return "à retravailler";
}

/**
 * Les `last` dernières évaluations débriefées (les plus récentes d'abord),
 * éventuellement d'une matière ou touchant un chapitre. Seules celles qui
 * ONT un débrief enregistré existent ici : une note sans débrief n'a pas de
 * questions à montrer.
 */
export function evaluationHistory(input: PedagogyInput, filter: { subject?: Subject | null; chapterId?: string | null; last?: number } = {}): EvaluationView[] {
  const last = Math.min(LAST_EVALUATIONS_MAX, Math.max(1, Math.round(filter.last ?? LAST_EVALUATIONS_DEFAULT)));
  const exercises = new Map(buildExercises({ annales: [], attempts: [...input.attempts], retryDelaysDays: input.retryDelaysDays, today: input.today }).map((exercise) => [exercise.key, exercise]));
  const errorsById = new Map(input.errors.map((error) => [error.id, error]));
  const byGrade = new Map<string, ExerciseAttempt[]>();
  for (const attempt of input.attempts) {
    if (!attempt.gradeId || !attempt.id.startsWith(`debrief:${attempt.gradeId}:`)) continue;
    byGrade.set(attempt.gradeId, [...(byGrade.get(attempt.gradeId) ?? []), attempt]);
  }
  return input.grades
    .filter((grade) => byGrade.has(grade.id) && (!filter.subject || grade.subject === filter.subject))
    .filter((grade) => !filter.chapterId || byGrade.get(grade.id)!.some((attempt) => attempt.chapterId === filter.chapterId))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, last)
    .map((grade) => ({
      id: grade.id,
      titre: grade.title,
      matiere: grade.subject,
      type: grade.kind,
      date: grade.date,
      note: typeof grade.score === "number" ? `${grade.score}/${grade.maxScore}` : null,
      questions: byGrade
        .get(grade.id)!
        .sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }))
        .map((attempt) => {
          const error = errorsById.get(`debrief-err:${grade.id}:${attempt.id.slice(`debrief:${grade.id}:`.length)}`);
          return {
            libelle: labelOf(attempt),
            chapitre: attempt.chapterId && chapterTitle(attempt.chapterId) ? { id: attempt.chapterId, titre: chapterTitle(attempt.chapterId)! } : null,
            resultat: attempt.result,
            cause: attempt.cause ? ATTEMPT_CAUSE_LABEL[attempt.cause] : null,
            confiance: attempt.confidence ?? null,
            manque_de_temps: attempt.lackOfTime,
            description: attempt.note,
            erreur: error ? { type: ERROR_TYPE_META[error.type].label, bonne_idee: error.fix } : null,
            etat: questionState(attempt, exercises.get(attempt.exerciseKey)),
            par_ia: attempt.byAi === true,
          };
        }),
    }));
}

/* ── Les difficultés qui se répètent ──────────────────────────────── */

export type Support = "cours" | "anki" | "exercice" | "ia";

export interface Recommendation {
  chapitre: { id: string; titre: string };
  matiere: Subject;
  niveau: "récurrente" | "signal";
  /** Pourquoi : la règle appliquée aux faits. */
  justification: string;
  /** Les faits, du plus récent au plus ancien. */
  observations: string[];
  evenements_distincts: number;
  cause_dominante: string | null;
  action: string;
  supports: Support[];
  anki_paquets: string[];
  echeance: { titre: string; date: string; jours: number; portee: "programme de l'épreuve" | "matière" } | null;
  /** Ce qui fermerait la difficulté. */
  verification: string;
  /** `false` quand une observation unique ne permet pas de conclure. */
  donnees_suffisantes: boolean;
}

export interface PedagogyReport {
  recommandations: Recommendation[];
  /** Difficultés observées puis corrigées par une réussite sans aide — pour ne pas les reproposer. */
  corrigees: { chapitre: string; matiere: Subject; preuve: string }[];
  /** Questions ratées sans chapitre : hors de l'analyse. */
  observations_sans_chapitre: number;
}

interface Observation {
  event: string;
  /** L'évaluation ou l'exercice (« DS 2 »). */
  title: string;
  /** La question, pour un DS ; `null` pour un exercice. */
  part: string | null;
  label: string;
  day: string;
  at: string;
  result: ExerciseAttempt["result"];
  cause: AttemptCause | null;
  confidence: "probable" | "incertaine" | null;
}

const ACTIONS: Record<AttemptCause | "none", { action: string; supports: Support[] }> = {
  cours: { action: "Rappel actif du cours (définitions, énoncés, démonstration en jeu) puis les cartes Anki du chapitre.", supports: ["cours", "anki"] },
  méthode: { action: "Un exercice ciblé sans aide : cherche d'abord l'outil à mobiliser avant de calculer.", supports: ["exercice"] },
  démarrage: { action: "Un exercice ciblé, en notant la première idée avant tout calcul ; sinon demande un indice minimal à une IA.", supports: ["exercice", "ia"] },
  compréhension: { action: "Reformule l'énoncé avec tes mots, puis refais l'exercice sans aide.", supports: ["exercice", "ia"] },
  calcul: { action: "Reprends les calculs ratés, posément, puis un exercice court du même chapitre.", supports: ["exercice"] },
  temps: { action: "Un exercice du chapitre chronométré question par question.", supports: ["exercice"] },
  rédaction: { action: "Rédige une solution complète et fais-la relire par une IA ou en khôlle.", supports: ["exercice", "ia"] },
  none: { action: "La cause n'est pas établie : fais d'abord diagnostiquer la copie par une IA, puis choisis l'action.", supports: ["ia"] },
};

const CAUSE_RANK: AttemptCause[] = ["cours", "méthode", "démarrage", "compréhension", "calcul", "temps", "rédaction"];

function dominantCause(observations: Observation[]): AttemptCause | null {
  const counts = new Map<AttemptCause, number>();
  for (const observation of observations) if (observation.cause) counts.set(observation.cause, (counts.get(observation.cause) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || CAUSE_RANK.indexOf(a[0]) - CAUSE_RANK.indexOf(b[0]))[0]?.[0] ?? null;
}

function describePart(observation: Observation): string {
  const cause = observation.cause ? `cause ${observation.cause}${observation.confidence ? ` (${observation.confidence})` : ""}` : "cause non établie";
  return `${observation.part ? `${observation.part} : ` : ""}${observation.result}, ${cause}`;
}

/** Un événement en une ligne : le jour, l'évaluation, et chacune de ses questions non réussies. */
function describeEvent(parts: Observation[]): string {
  const sorted = [...parts].sort((a, b) => (a.part ?? "").localeCompare(b.part ?? "", "fr", { numeric: true }));
  return `${sorted[0].day} · ${sorted[0].title} — ${sorted.map(describePart).join(" ; ")}`;
}

function split(label: string): { title: string; part: string | null } {
  const at = label.lastIndexOf(" — ");
  return at === -1 ? { title: label, part: null } : { title: label.slice(0, at), part: label.slice(at + 3) };
}

function nextDeadline(input: PedagogyInput, chapterId: string, subject: Subject): Recommendation["echeance"] {
  const now = new Date(`${input.today}T12:00:00`);
  const memoryProgramme = new Map<string, string>();
  for (const entry of input.chapterMemory) {
    const match = bestProgrammeMatch(entry.subject, entry.title);
    if (match) memoryProgramme.set(entry.id, match.id);
  }
  const candidates = activeWorkItems([...input.workItems])
    .filter((item) => ["ds", "colle", "concours"].includes(item.kind) && item.dueDate)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: WorkItem; days: number } => entry.days !== null && entry.days >= 0 && entry.days <= HORIZON_DAYS)
    .sort((a, b) => a.days - b.days || a.item.id.localeCompare(b.item.id));
  const inScope = candidates.find(({ item }) => (item.scope?.chapterIds ?? []).some((id) => memoryProgramme.get(id) === chapterId));
  if (inScope) return { titre: inScope.item.title, date: inScope.item.dueDate!, jours: inScope.days, portee: "programme de l'épreuve" };
  const sameSubject = candidates.find(({ item }) => item.subject === subject);
  return sameSubject ? { titre: sameSubject.item.title, date: sameSubject.item.dueDate!, jours: sameSubject.days, portee: "matière" } : null;
}

export function recurringDifficulties(input: PedagogyInput, filter: { subject?: Subject | null; chapterId?: string | null } = {}): PedagogyReport {
  const exercises = buildExercises({ annales: [...input.annales], attempts: [...input.attempts], retryDelaysDays: input.retryDelaysDays, today: input.today });
  const byChapter = new Map<string, Observation[]>();
  let withoutChapter = 0;
  const push = (chapterId: string | null, subject: Subject | null, observation: Observation) => {
    if (filter.subject && subject !== filter.subject) return;
    if (!chapterId || !PROGRAMME_BY_ID.has(chapterId)) {
      withoutChapter += 1;
      return;
    }
    byChapter.set(chapterId, [...(byChapter.get(chapterId) ?? []), observation]);
  };

  // Évaluations et exercices saisis dans l'app : un événement par note, sinon par exercice.
  for (const attempt of input.attempts) {
    if (attempt.result === "réussi") continue;
    push(attempt.chapterId, attempt.subject, {
      event: attempt.gradeId ? `note:${attempt.gradeId}` : `exo:${attempt.exerciseKey}`,
      ...(attempt.gradeId ? split(attempt.label) : { title: attempt.label, part: null }),
      label: attempt.label,
      day: attempt.day,
      at: attempt.createdAt,
      result: attempt.result,
      cause: attempt.cause,
      confidence: attempt.confidence ?? null,
    });
  }
  // Annales corrigées par une IA : un événement par exercice.
  for (const exercise of exercises) {
    for (const step of exercise.steps) {
      if (step.source !== "annale" || step.result === "réussi") continue;
      push(exercise.chapterId, exercise.subject, { event: `exo:${exercise.key}`, title: exercise.label, part: null, label: exercise.label, day: step.day, at: step.at, result: step.result, cause: step.cause, confidence: null });
    }
  }

  // Les réussites sans aide, par chapitre : seule preuve qu'une difficulté est réglée.
  const proofs = new Map<string, { at: string; day: string }[]>();
  for (const exercise of exercises) {
    if (!exercise.chapterId) continue;
    for (const step of exercise.steps) {
      if (isCleanSuccess(step)) proofs.set(exercise.chapterId, [...(proofs.get(exercise.chapterId) ?? []), { at: step.at, day: step.day }]);
    }
  }

  const recommendations: Recommendation[] = [];
  const corrected: PedagogyReport["corrigees"] = [];
  for (const [chapterId, all] of byChapter) {
    if (filter.chapterId && chapterId !== filter.chapterId) continue;
    const chapter = PROGRAMME_BY_ID.get(chapterId)!;
    // Un événement compte une fois, quel que soit le nombre de ses questions ratées.
    const events = new Map<string, Observation[]>();
    for (const observation of all) events.set(observation.event, [...(events.get(observation.event) ?? []), observation]);
    const grouped = [...events.entries()]
      .map(([event, parts]) => ({ event, parts, at: parts.reduce((latest, part) => (part.at > latest ? part.at : latest), ""), day: parts[0].day }))
      .sort((a, b) => b.at.localeCompare(a.at) || a.event.localeCompare(b.event));
    const lastFailureAt = grouped[0].at;
    const proof = (proofs.get(chapterId) ?? []).filter((entry) => entry.at > lastFailureAt).sort((a, b) => a.at.localeCompare(b.at))[0];
    if (proof) {
      corrected.push({ chapitre: chapter.title, matiere: chapter.subject, preuve: `réussi sans aide le ${proof.day}, après la dernière difficulté observée (${grouped[0].day})` });
      continue;
    }
    const recurrent = grouped.length >= 2;
    const cause = dominantCause(all);
    const { action, supports } = ACTIONS[cause ?? "none"];
    const decks = input.ankiDecksByChapter?.get(chapterId) ?? [];
    const deadline = nextDeadline(input, chapterId, chapter.subject);
    recommendations.push({
      chapitre: { id: chapterId, titre: chapter.title },
      matiere: chapter.subject,
      niveau: recurrent ? "récurrente" : "signal",
      justification: recurrent
        ? `Difficulté apparue dans ${grouped.length} évaluations ou exercices distincts, sans réussite autonome depuis.`
        : "Une seule observation : c'est un signal à confirmer, pas encore une conclusion.",
      observations: grouped.slice(0, OBSERVATIONS_SHOWN).map((entry) => describeEvent(entry.parts)),
      evenements_distincts: grouped.length,
      cause_dominante: cause ? ATTEMPT_CAUSE_LABEL[cause] : null,
      action,
      supports,
      anki_paquets: supports.includes("anki") ? decks : [],
      echeance: deadline,
      verification: `Réussir sans aide un exercice de « ${chapter.title} » : relire la correction ne ferme pas la difficulté.`,
      donnees_suffisantes: recurrent,
    });
  }
  recommendations.sort(
    (a, b) =>
      Number(b.niveau === "récurrente") - Number(a.niveau === "récurrente") ||
      b.evenements_distincts - a.evenements_distincts ||
      Number(b.echeance?.portee === "programme de l'épreuve") - Number(a.echeance?.portee === "programme de l'épreuve") ||
      (a.echeance?.jours ?? Infinity) - (b.echeance?.jours ?? Infinity) ||
      a.chapitre.id.localeCompare(b.chapitre.id)
  );
  corrected.sort((a, b) => a.chapitre.localeCompare(b.chapitre));
  return { recommandations: recommendations, corrigees: corrected, observations_sans_chapitre: withoutChapter };
}

/* ── Pour le connecteur MCP ───────────────────────────────────────── */

function list<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(normalize).filter((item): item is T => item !== null) : [];
}

/** Les collections synchronisées (JSON brut, éventuellement abîmé), normalisées comme à la lecture du localStorage. */
export function pedagogyInputFrom(collections: Record<string, unknown>, annaleRows: unknown, now: Date): PedagogyInput {
  const preferences = normalizePreferences(collections.preferences ?? {});
  const snapshot = latestFullSnapshot(normalizeAnkiSnapshots(collections.ankiSnapshots));
  const ankiDecksByChapter = new Map([...ankiByChapter(snapshot, preferences.ankiDeckChapters)].map(([id, entry]) => [id, entry.decks]));
  return {
    ankiDecksByChapter,
    grades: list(collections.grades, normalizeGrade),
    attempts: normalizeAttempts(collections.attempts),
    errors: list(collections.errors, normalizeErrorEntry),
    workItems: list(collections.workItems, normalizeWorkItem),
    chapterMemory: list(collections.chapterMemory, normalizeChapterMemory),
    annales: normalizeAnnaleLogs(annaleRows),
    retryDelaysDays: preferences.retryDelaysDays,
    today: dayKey(now),
  };
}

/**
 * Résout un `chapitre` donné par une IA : identifiant du programme, ou titre
 * rapproché avec certitude. Sans matière, le titre doit désigner un seul
 * chapitre dans TOUT le programme — sinon `null`, jamais un choix au hasard.
 */
export function resolveChapter(text: string, subject: Subject | null): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (PROGRAMME_BY_ID.has(trimmed)) return trimmed;
  if (subject) return bestProgrammeMatch(subject, trimmed)?.id ?? null;
  const subjects = [...new Set([...PROGRAMME_BY_ID.values()].map((chapter) => chapter.subject))];
  const found = new Set(subjects.map((entry) => bestProgrammeMatch(entry, trimmed)?.id).filter((id): id is string => Boolean(id)));
  return found.size === 1 ? [...found][0] : null;
}
