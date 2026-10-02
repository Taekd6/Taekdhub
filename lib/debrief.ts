import { ATTEMPT_CAUSE_LABEL, type AttemptCause, type ExerciseAttempt, type ExerciseLevel } from "@/lib/attempts";
import { buildExercises, type Exercise } from "@/lib/exercises";
import type { AnnaleLog } from "@/lib/annales";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { ErrorEntry, ErrorSource, ErrorType, Grade } from "@/lib/storage";

/**
 * DÉBRIEF D'UN DS (ou d'une épreuve blanche, d'une colle) — de la copie
 * rendue à un plan d'action vérifiable.
 *
 * Pour chaque question : le chapitre, le résultat, la cause si elle est
 * ratée, le manque de temps, et éventuellement l'exercice ou l'annale qu'elle
 * rappelle. Le débrief n'invente PAS un second carnet d'erreurs :
 *
 *   — chaque question devient une TENTATIVE (lib/attempts.ts), clé
 *     `ds:<note>:<question>` : c'est elle qui revient « à refaire sans aide »
 *     aux dates programmées (lib/exercises.ts) ;
 *   — chaque question ratée avec une cause devient une ERREUR du carnet
 *     existant, reliée à son chapitre et à son exercice : elle ne sera dite
 *     corrigée qu'après une nouvelle tentative réussie sans aide.
 *
 * IDEMPOTENT : les identifiants sont dérivés de la note et du libellé de la
 * question. Enregistrer deux fois le même débrief remplace, n'ajoute pas.
 *
 * Fonctions pures.
 */

/** Brouillon laissé par l'épreuve blanche (components/epreuve/exam-simulator.tsx) pour pré-remplir le débrief — sur l'appareil seulement. */
export const DEBRIEF_DRAFT_KEY = "prepahub:debrief-draft";

export type QuestionOutcome = "réussie" | "partielle" | "fausse" | "non abordée";
export const QUESTION_OUTCOMES: readonly QuestionOutcome[] = ["réussie", "partielle", "fausse", "non abordée"];

export interface DebriefQuestion {
  label: string;
  chapterId: string | null;
  outcome: QuestionOutcome;
  cause: AttemptCause | null;
  lackOfTime: boolean;
  /** Points au barème, s'ils sont connus — pour trier ce qui coûte le plus. */
  points: number | null;
  minutes: number | null;
  /** Exercice ou annale existant que la question rappelle (sa clé). */
  linkedExerciseKey: string | null;
  note: string;
  /** Niveau de la question (direct, classique, difficile), s'il est indiqué. */
  level?: ExerciseLevel | null;
}

/** Le passage d'une cause d'échec au type d'erreur du carnet (qui n'a ni « démarrage » ni « compréhension »). */
export const ERROR_TYPE_FOR_CAUSE: Record<AttemptCause, ErrorType> = {
  cours: "cours",
  méthode: "méthode",
  démarrage: "méthode",
  calcul: "calcul",
  compréhension: "lecture",
  temps: "temps",
  rédaction: "rédaction",
};

const SOURCE_FOR_KIND: Partial<Record<Grade["kind"], ErrorSource>> = { ds: "DS", concours: "concours blanc", colle: "colle", dm: "DM" };

export function slug(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "q"
  );
}

export function debriefKey(gradeId: string, label: string): string {
  return `ds:${gradeId}:${slug(label)}`;
}

export function questionResult(outcome: QuestionOutcome): ExerciseAttempt["result"] {
  return outcome === "réussie" ? "réussi" : outcome === "partielle" ? "partiel" : "échec";
}

/** Questions valides : un libellé, pas deux fois le même (le second écraserait le premier). */
export function validateQuestions(questions: DebriefQuestion[]): string | null {
  const labels = questions.map((question) => slug(question.label.trim()));
  if (questions.some((question) => !question.label.trim())) return "Chaque question a besoin d'un libellé (« Q3 », « II.2 »).";
  if (new Set(labels).size !== labels.length) return "Deux questions ont le même libellé.";
  return null;
}

export function buildDebrief(grade: Grade, questions: DebriefQuestion[], now: Date): { attempts: ExerciseAttempt[]; errors: ErrorEntry[] } {
  const at = now.toISOString();
  const title = grade.title || "Épreuve";
  const attempts: ExerciseAttempt[] = [];
  const errors: ErrorEntry[] = [];
  for (const question of questions) {
    const label = question.label.trim();
    const key = debriefKey(grade.id, label);
    const result = questionResult(question.outcome);
    const cause = result === "réussi" ? null : question.cause ?? (question.outcome === "non abordée" && question.lackOfTime ? "temps" : null);
    attempts.push({
      id: `debrief:${grade.id}:${slug(label)}`,
      exerciseKey: key,
      label: `${title} — ${label}`,
      subject: grade.subject,
      chapterId: question.chapterId,
      origin: grade.kind === "concours" ? "épreuve" : "ds",
      day: grade.date,
      createdAt: `${grade.date}T12:00:00.000Z`,
      updatedAt: at,
      result,
      help: "sans",
      minutes: question.minutes,
      plannedMinutes: null,
      cause,
      lackOfTime: question.lackOfTime,
      gradeId: grade.id,
      note: question.note.trim() || null,
      ...(question.level ? { level: question.level } : {}),
    });
    if (result !== "réussi" && (cause || question.lackOfTime)) {
      const type = cause ? ERROR_TYPE_FOR_CAUSE[cause] : "temps";
      errors.push({
        id: `debrief-err:${grade.id}:${slug(label)}`,
        subject: grade.subject,
        date: grade.date,
        source: SOURCE_FOR_KIND[grade.kind] ?? "autre",
        type,
        description: `${title} — ${label} : ${cause ? ATTEMPT_CAUSE_LABEL[cause].toLowerCase() : "manque de temps"}${question.note.trim() ? ` (${question.note.trim()})` : ""}`.slice(0, 300),
        fix: null,
        chapterId: null,
        exerciseId: null,
        reviewItemId: null,
        ...(question.chapterId && PROGRAMME_BY_ID.has(question.chapterId) ? { programmeChapterId: question.chapterId } : {}),
        exerciseKey: question.linkedExerciseKey ?? key,
        createdAt: at,
      });
    }
  }
  return { attempts, errors };
}

/**
 * Applique un débrief aux listes existantes : les tentatives et erreurs de
 * CE débrief (même note) sont remplacées — une question retirée disparaît —,
 * tout le reste est intact. Une erreur dont l'élève avait noté la bonne idée
 * la garde.
 */
export function applyDebrief(
  gradeId: string,
  current: { attempts: ExerciseAttempt[]; errors: ErrorEntry[] },
  built: { attempts: ExerciseAttempt[]; errors: ErrorEntry[] }
): { attempts: ExerciseAttempt[]; errors: ErrorEntry[] } {
  const ownAttempt = (attempt: ExerciseAttempt) => attempt.id.startsWith(`debrief:${gradeId}:`);
  const ownError = (error: ErrorEntry) => error.id.startsWith(`debrief-err:${gradeId}:`);
  const previousFix = new Map(current.errors.filter(ownError).map((error) => [error.id, error.fix]));
  return {
    attempts: [...current.attempts.filter((attempt) => !ownAttempt(attempt)), ...built.attempts],
    errors: [...current.errors.filter((error) => !ownError(error)), ...built.errors.map((error) => ({ ...error, fix: previousFix.get(error.id) ?? error.fix }))],
  };
}

/** Relit un débrief déjà enregistré (pour le corriger). */
export function questionsFromAttempts(gradeId: string, attempts: ExerciseAttempt[], errors: ErrorEntry[]): DebriefQuestion[] {
  return attempts
    .filter((attempt) => attempt.id.startsWith(`debrief:${gradeId}:`))
    .sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }))
    .map((attempt) => {
      const error = errors.find((entry) => entry.id === `debrief-err:${gradeId}:${attempt.id.slice(`debrief:${gradeId}:`.length)}`);
      const label = attempt.label.includes(" — ") ? attempt.label.slice(attempt.label.lastIndexOf(" — ") + 3) : attempt.label;
      return {
        label,
        chapterId: attempt.chapterId,
        outcome: attempt.result === "réussi" ? "réussie" : attempt.result === "partiel" ? "partielle" : attempt.cause === "temps" && attempt.lackOfTime ? "non abordée" : "fausse",
        cause: attempt.cause,
        lackOfTime: attempt.lackOfTime,
        points: null,
        minutes: attempt.minutes,
        linkedExerciseKey: error && error.exerciseKey !== attempt.exerciseKey ? error.exerciseKey ?? null : null,
        note: attempt.note ?? "",
        level: attempt.level ?? null,
      };
    });
}

/* ── Le plan d'action ─────────────────────────────────────────────── */

export interface PlanStep {
  title: string;
  items: string[];
}

export interface DebriefPlanInput {
  grade: Grade;
  questions: DebriefQuestion[];
  /** Toutes les tentatives (débrief compris) et les annales — pour les dates de nouvelle tentative. */
  attempts: ExerciseAttempt[];
  annales: AnnaleLog[];
  retryDelaysDays: number[];
  /** Paquets Anki associés avec sûreté, par chapitre. */
  ankiDecksByChapter: Map<string, string[]>;
  today: string;
}

const CAUSE_RANK: AttemptCause[] = ["cours", "méthode", "démarrage", "compréhension", "calcul", "temps", "rédaction"];
const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function fmt(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

/**
 * Les six étapes demandées après une copie : quoi corriger d'abord, le
 * cours à revoir, les exercices à refaire, les cartes Anki, la nouvelle
 * tentative, et la vérification. Une étape sans objet le dit au lieu de
 * disparaître.
 */
export function debriefPlan(input: DebriefPlanInput): PlanStep[] {
  const missed = input.questions.filter((question) => question.outcome !== "réussie");
  if (missed.length === 0) return [{ title: "Rien à corriger", items: ["Toutes les questions sont réussies : aucune nouvelle tentative n'est programmée."] }];

  const exercises = new Map<string, Exercise>(
    buildExercises({ annales: input.annales, attempts: input.attempts, retryDelaysDays: input.retryDelaysDays, today: input.today }).map((exercise) => [exercise.key, exercise])
  );
  const chapterName = (id: string | null) => (id ? PROGRAMME_BY_ID.get(id)?.title ?? null : null);
  const ordered = [...missed].sort(
    (a, b) =>
      (b.points ?? -1) - (a.points ?? -1) ||
      (a.cause ? CAUSE_RANK.indexOf(a.cause) : CAUSE_RANK.length) - (b.cause ? CAUSE_RANK.indexOf(b.cause) : CAUSE_RANK.length)
  );

  const priority = ordered.slice(0, 3).map((question) => {
    const where = chapterName(question.chapterId);
    const why = question.cause ? ATTEMPT_CAUSE_LABEL[question.cause].toLowerCase() : question.lackOfTime ? "manque de temps" : "cause non précisée";
    return `${question.label}${where ? ` (${where})` : ""} — ${why}${question.points !== null ? `, ${question.points} pt` : ""}. Refais-la au propre avec le corrigé, puis écris la bonne idée dans le carnet.`;
  });

  const courseChapters = [...new Set(missed.filter((question) => question.cause === "cours" && question.chapterId).map((question) => question.chapterId!))];
  const course = courseChapters.length
    ? courseChapters.map((id) => `Rappel actif de « ${chapterName(id)} » : définitions, théorèmes, la démonstration en jeu — sans tes notes.`)
    : ["Aucune question ratée par manque de cours : pas de relecture imposée."];

  const retries = missed.map((question) => {
    const exercise = exercises.get(debriefKey(input.grade.id, question.label.trim()));
    return exercise?.nextRetryDay ? `${question.label} : à refaire sans aide le ${fmt(exercise.nextRetryDay)}.` : `${question.label} : à refaire sans aide.`;
  });

  const ankiItems: string[] = [];
  for (const id of courseChapters) {
    const decks = input.ankiDecksByChapter.get(id) ?? [];
    ankiItems.push(decks.length ? `« ${chapterName(id)} » : révise le paquet « ${decks[0]} » dans Anki.` : `« ${chapterName(id)} » : aucun paquet Anki associé avec sûreté — associe-le dans la page Anki pour le retrouver ici.`);
  }
  if (ankiItems.length === 0) ankiItems.push("Aucune cause « cours » : les cartes Anki ne sont pas la priorité de ce débrief.");

  const unlinked = missed.filter((question) => !question.chapterId).length;
  const dates = missed
    .map((question) => exercises.get(debriefKey(input.grade.id, question.label.trim()))?.nextRetryDay)
    .filter((day): day is string => Boolean(day))
    .sort();
  const next = dates[0];

  return [
    { title: "1. À corriger en priorité", items: priority },
    { title: "2. Cours et démonstrations à revoir", items: course },
    { title: "3. Exercices à refaire", items: retries },
    { title: "4. Cartes Anki", items: ankiItems },
    { title: "5. Nouvelle tentative", items: [next ? `Première nouvelle tentative le ${fmt(next)}, correction cachée. Elle apparaîtra dans « À refaire » et dans Next Move.` : "Les nouvelles tentatives apparaîtront dans « À refaire »."] },
    {
      title: "6. Vérification",
      items: [
        "Une question n'est corrigée que lorsqu'elle est réussie SANS AIDE lors d'une nouvelle tentative. Relire la correction ne suffit pas.",
        ...(unlinked > 0 ? [`${unlinked} question${unlinked > 1 ? "s" : ""} sans chapitre : le diagnostic ne pourra pas s'en servir.`] : []),
      ],
    },
  ];
}
