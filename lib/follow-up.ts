import type { ExerciseAttempt, ExerciseLevel } from "@/lib/attempts";
import { EXERCISE_LEVEL_LABEL, isCleanSuccess } from "@/lib/attempts";
import { computeBudget } from "@/lib/day-agenda";
import { chapterTitle } from "@/lib/diagnostic";
import type { Exercise } from "@/lib/exercises";
import { exerciseRequest, levelToRequest } from "@/lib/exercise-quality";
import { sheetHref, sheetIdOfKey, sheetsForChapter, trainingHref, type ExerciseSheet, type SheetOrigin, type SheetStatus } from "@/lib/exercise-sheets";
import { diagnosticContextOf, type MoveKind, type NextMoveInput } from "@/lib/next-move/engine";
import { bestProgrammeMatch } from "@/lib/programme";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { buildRevisionProgram, type RevisionItem } from "@/lib/revision-program";
import { smallStepFor, type SmallStep } from "@/lib/small-step";

export { smallStepFor, type SmallStep };
import type { Subject } from "@/lib/supabase/types";

/**
 * LA SUITE D'UNE SÉANCE — « et maintenant ? », sans que l'élève cherche ni compare.
 *
 * À l'arrêt d'une séance, TaekdHub sait déjà quoi proposer sans rien redemander :
 *
 *   ce qui a été travaillé   le chapitre (dernier exercice noté, sinon la
 *                            recommandation commencée, sinon le chapitre choisi
 *                            au chrono, sinon le travail planifié) ;
 *   comment ça s'est passé   les tentatives que le bilan vient d'enregistrer
 *                            (résultat, aide, cause, niveau) — ou ce que l'élève
 *                            dit d'un tap (« terminé », « partiel », « j'ai bloqué ») ;
 *   le temps qui reste       le temps restant du plan du jour (lib/day-agenda.ts) ;
 *   ce qui presse            le programme de révision (lib/revision-program.ts).
 *
 * UN SEUL choix par défaut, une phrase pour dire pourquoi, UNE seule
 * alternative pour le remplacer — jamais une liste à comparer. Et quand
 * l'élève bloque, ou repousse, une PREMIÈRE ÉTAPE PLUS PETITE (5 à 10 minutes,
 * sans rien à résoudre) : l'évitement n'est ni une faute ni un abandon, la
 * tâche reste là, simplement plus facile à commencer.
 *
 * RÈGLES — explicites, sans algorithme opaque (la 1re qui s'applique) :
 *
 *   1. Le temps restant est nul : on le dit, « assez pour aujourd'hui ».
 *   2. Réussi sans aide : on monte d'un cran quand `levelToRequest` le
 *      justifie (deux réussites sans aide au niveau), sinon un autre exercice
 *      du même niveau.
 *   3. Réussi avec aide, ou partiel : un AUTRE exercice du même niveau vérifie
 *      que c'est su seul ; le même reviendra de lui-même (lib/exercises.ts).
 *   4. Échec, cause « cours » : reprendre la notion (rappel actif) AVANT de
 *      refaire un exercice. Autre cause : un exercice un cran plus facile,
 *      pour retrouver la prise ; au niveau « direct », la notion d'abord.
 *   5. Séance sans exercice noté sur un chapitre connu : un exercice pour
 *      mettre la notion à l'épreuve (niveau visé par `levelToRequest`).
 *   6. Rien ne dit sur quoi l'élève a travaillé : l'élément suivant du
 *      programme de révision, et on le dit.
 *
 * L'EXERCICE proposé vient, dans l'ordre, de : une fiche de l'élève (jamais
 * tentée d'abord) ; une annale déjà tentée à refaire ; sinon un exercice
 * ORIGINAL À GÉNÉRER par IA (demande prête pour Claude). TaekdHub ne dispose
 * d'aucun catalogue de ressources externes vérifiées : il n'en invente aucun
 * lien. Une ressource externe passe par une fiche, qui garde sa source et son
 * lien. Les indices et la correction ne sont jamais montrés ici.
 *
 * Fonctions pures. Aucun signal de santé n'est ajouté à ceux que le moteur lit déjà.
 */

export type StepKind = "exercice" | "reprise" | "programme";

export interface ExerciseProvision {
  /** `fiche` : une fiche de l'élève ; `annale` : un exercice déjà tenté à refaire ; `a-generer` : un original à demander à une IA. */
  source: "fiche" | "annale" | "a-generer";
  /** `ia` (original) ou `externe` ; `null` pour une annale dont l'origine n'est pas typée. */
  origin: SheetOrigin | null;
  /** Source d'une ressource externe, et son lien s'il en a un. */
  sourceName: string | null;
  url: string | null;
  chapterId: string;
  level: ExerciseLevel;
  /** La compétence visée, quand la fiche la dit. */
  competence: string | null;
  /** La demande à copier pour Claude (`a-generer` seulement). */
  request: string | null;
  /** Pourquoi CELUI-CI, en une phrase. */
  note: string;
}

export interface FollowUpStep {
  id: string;
  kind: StepKind;
  title: string;
  minutes: number;
  /** Pourquoi cette suite, en une phrase. */
  why: string;
  start: { href: string; label: string };
  exercise: ExerciseProvision | null;
  small: SmallStep;
}

export type SelfReport = "termine" | "partiel" | "bloque";

export interface FollowUpTopic {
  chapterId: string;
  chapterTitle: string;
  subject: Subject;
  /** Niveau du dernier essai noté, quand il y en a un. */
  level: ExerciseLevel | null;
  /** D'où l'on tient que c'était ce chapitre — dit à l'élève, pour qu'il puisse corriger. */
  basis: string;
}

export interface FollowUp {
  topic: FollowUpTopic | null;
  /** Ce que TaekdHub a retenu de la séance, en une phrase, d'après ce qui est enregistré. */
  summary: string;
  primary: FollowUpStep | null;
  /** UNE autre idée — jamais une liste. */
  alternative: FollowUpStep | null;
  /** « Assez pour aujourd'hui » : rien à proposer maintenant, la suite est dite. */
  rest: { message: string; tomorrow: string | null } | null;
  /** Ce qui reste d'indispensable aujourd'hui (au plus deux), pour ne rien oublier sans avoir à décider. */
  reminders: { title: string; minutes: number; href: string }[];
  /** Ce qui rend la proposition moins sûre. */
  notes: string[];
}

export interface FollowUpInput {
  nextMove: NextMoveInput;
  /** Le chapitre de mémoire choisi au chrono, le travail planifié, la durée de la séance. */
  session: { subject: Subject; memoryChapterId?: string | null; workItemId?: string | null; minutes: number } | null;
  /** Les tentatives que le bilan de CETTE séance vient d'enregistrer. */
  attempts: ExerciseAttempt[];
  /** La recommandation de Next Move commencée, si elle l'était. */
  move: { key: string; kind: MoveKind } | null;
  sheets: ExerciseSheet[];
  /** « Terminé », « partiel » ou « j'ai bloqué », d'un tap. */
  selfReport?: SelfReport | null;
}

const LEVELS: readonly ExerciseLevel[] = ["direct", "classique", "difficile"];
const DEFAULT_MINUTES: Record<ExerciseLevel, number> = { direct: 15, classique: 30, difficile: 45 };
/** Sous ce temps restant, rien n'est proposé : on dit « assez pour aujourd'hui ». */
export const MIN_USEFUL_MINUTES = 5;
/** Une reprise de notion (rappel actif). */
const RECALL_MINUTES = 15;

function levelDown(level: ExerciseLevel): ExerciseLevel | null {
  const index = LEVELS.indexOf(level);
  return index > 0 ? LEVELS[index - 1] : null;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/* ── Le chapitre travaillé ────────────────────────────────────────── */

function topicOf(input: FollowUpInput, exercises: Exercise[]): FollowUpTopic | null {
  const { nextMove, session, attempts, move } = input;
  const make = (chapterId: string | null, subject: Subject | null, level: ExerciseLevel | null, basis: string): FollowUpTopic | null => {
    const chapter = chapterId ? PROGRAMME_BY_ID.get(chapterId) : undefined;
    return chapter ? { chapterId: chapter.id, chapterTitle: chapter.title, subject: chapter.subject ?? subject ?? "Mathématiques", level, basis } : null;
  };

  // 1. Le dernier exercice noté pendant la séance.
  const lastAttempt = [...attempts].reverse().find((attempt) => attempt.chapterId && PROGRAMME_BY_ID.has(attempt.chapterId));
  if (lastAttempt) return make(lastAttempt.chapterId, lastAttempt.subject, lastAttempt.level ?? null, "d'après l'exercice que tu viens de noter");

  // 2. La recommandation de Next Move commencée.
  if (move) {
    const key = move.key;
    const colon = key.indexOf(":");
    const tail = colon >= 0 ? key.slice(colon + 1) : "";
    let chapterId: string | null = null;
    if (key.startsWith("exercice:") || key.startsWith("calcul:") || key.startsWith("cours:") || key.startsWith("kholle:")) chapterId = tail.split(":")[0];
    else if (key.startsWith("refaire:") || key.startsWith("transfert:")) chapterId = exercises.find((exercise) => exercise.key === tail)?.chapterId ?? null;
    else if (key.startsWith("rappel:")) {
      const memory = nextMove.chapterMemory.find((entry) => entry.id === tail);
      chapterId = memory ? bestProgrammeMatch(memory.subject, memory.title)?.id ?? null : null;
    }
    const found = make(chapterId, session?.subject ?? null, null, "d'après la recommandation que tu avais commencée");
    if (found) return found;
  }

  // 3. Le chapitre choisi au chrono (mémoire des chapitres).
  if (session?.memoryChapterId) {
    const memory = nextMove.chapterMemory.find((entry) => entry.id === session.memoryChapterId);
    const found = memory ? make(bestProgrammeMatch(memory.subject, memory.title)?.id ?? null, memory.subject, null, "d'après le chapitre choisi au chrono") : null;
    if (found) return found;
  }

  // 4. Le travail planifié sur lequel la séance a porté.
  if (session?.workItemId) {
    const item = nextMove.workItems.find((entry) => entry.id === session.workItemId);
    const found = item?.chapterIds[0] ? make(item.chapterIds[0], item.subject, null, `d'après « ${item.title} »`) : null;
    if (found) return found;
  }
  return null;
}

/* ── L'exercice proposé ───────────────────────────────────────────── */

function sheetStatuses(attempts: ExerciseAttempt[]): Map<string, SheetStatus> {
  const byId = new Map<string, { count: number; last: ExerciseAttempt }>();
  for (const attempt of attempts) {
    const id = sheetIdOfKey(attempt.exerciseKey);
    if (!id) continue;
    const current = byId.get(id);
    byId.set(id, { count: (current?.count ?? 0) + 1, last: !current || attempt.createdAt > current.last.createdAt ? attempt : current.last });
  }
  return new Map([...byId].map(([id, value]) => [id, { attempts: value.count, proven: isCleanSuccess(value.last) }]));
}

export function provideExercise(input: { chapterId: string; level: ExerciseLevel; subject: Subject; sheets: ExerciseSheet[]; attempts: ExerciseAttempt[]; exercises: Exercise[] }): { provision: ExerciseProvision; href: string; label: string; minutes: number; title: string } {
  const { chapterId, level, subject, sheets, attempts, exercises } = input;
  const chapter = chapterTitle(chapterId) ?? subject;
  const statuses = sheetStatuses(attempts);

  // 1. Une fiche de l'élève : à ce niveau d'abord, jamais tentée avant les autres.
  const atLevel = sheetsForChapter(sheets, statuses, chapterId, level).filter((sheet) => !statuses.get(sheet.id)?.proven);
  const anyLevel = sheetsForChapter(sheets, statuses, chapterId, null).filter((sheet) => !statuses.get(sheet.id)?.proven);
  const sheet = atLevel[0] ?? anyLevel[0];
  if (sheet) {
    const tried = statuses.get(sheet.id)?.attempts ?? 0;
    return {
      provision: {
        source: "fiche",
        origin: sheet.origin,
        sourceName: sheet.source?.name ?? null,
        url: sheet.source?.url ?? null,
        chapterId,
        level: sheet.level,
        competence: sheet.competence,
        request: null,
        note: `${sheet.origin === "externe" ? `Ressource externe (${sheet.source?.name})` : "Exercice original généré par IA"}, ${tried === 0 ? "jamais tentée" : `${tried} essai${tried > 1 ? "s" : ""} sans réussite sans aide`}${sheet.level === level ? ` — niveau ${EXERCISE_LEVEL_LABEL[level].split(" (")[0].toLowerCase()}` : ` — niveau ${EXERCISE_LEVEL_LABEL[sheet.level].split(" (")[0].toLowerCase()} (aucune fiche au niveau visé)`}.`,
      },
      href: sheetHref(sheet.id),
      label: "Commencer l'exercice",
      minutes: sheet.estimatedMinutes ?? DEFAULT_MINUTES[sheet.level],
      title: `${sheet.notion ?? sheet.competence} (${chapter})`,
    };
  }

  // 2. Un exercice déjà tenté (annale) arrivé à sa nouvelle tentative : il revient de lui-même, autant le proposer ici.
  const due = exercises.find((exercise) => exercise.chapterId === chapterId && exercise.status === "à-refaire" && !sheetIdOfKey(exercise.key) && !exercise.key.startsWith("transfert:"));
  if (due) {
    const lastMinutes = [...due.steps].reverse().find((step) => step.minutes !== null)?.minutes ?? null;
    return {
      provision: {
        source: "annale",
        origin: null,
        sourceName: due.label,
        url: null,
        chapterId,
        level: due.steps.find((step) => step.level !== null)?.level ?? level,
        competence: null,
        request: null,
        note: `Déjà tenté, pas encore réussi sans aide : « ${due.label} » est arrivé à sa nouvelle tentative.`,
      },
      href: `/annales?refaire=${encodeURIComponent(due.key)}`,
      label: "Refaire sans aide",
      minutes: Math.min(45, Math.max(15, lastMinutes ?? 30)),
      title: due.label,
    };
  }

  // 3. Aucun exercice sous la main : un original à générer, une seule fois — la fiche sera gardée.
  return {
    provision: {
      source: "a-generer",
      origin: "ia",
      sourceName: null,
      url: null,
      chapterId,
      level,
      competence: null,
      request: exerciseRequest({ subject, chapter, level }),
      note: "Aucune fiche de ce chapitre à ce niveau : un exercice original est à demander à Claude (la correction reste cachée), puis à coller ici — il sera gardé pour la suite.",
    },
    href: trainingHref({ chapterId, level }),
    label: "Demander l'exercice, puis le coller",
    minutes: DEFAULT_MINUTES[level],
    title: `Un exercice ${EXERCISE_LEVEL_LABEL[level].split(" (")[0].toLowerCase()} sur « ${chapter} »`,
  };
}

/* ── Les étapes ───────────────────────────────────────────────────── */

function exerciseStep(id: string, why: string, args: Parameters<typeof provideExercise>[0], budget: number): FollowUpStep {
  const picked = provideExercise(args);
  const chapter = chapterTitle(args.chapterId);
  return {
    id,
    kind: "exercice",
    title: picked.title,
    minutes: Math.max(MIN_USEFUL_MINUTES, Math.min(picked.minutes, budget)),
    why,
    start: { href: picked.href, label: picked.label },
    exercise: picked.provision,
    small: smallStepFor("exercice", chapter),
  };
}

function recallStep(id: string, why: string, chapterId: string, budget: number): FollowUpStep {
  const chapter = chapterTitle(chapterId);
  return {
    id,
    kind: "reprise",
    title: `Reprendre la notion : « ${chapter} »`,
    minutes: Math.max(MIN_USEFUL_MINUTES, Math.min(RECALL_MINUTES, budget)),
    why,
    start: { href: `/timer?matiere=${encodeURIComponent(PROGRAMME_BY_ID.get(chapterId)?.subject ?? "")}`, label: "Commencer" },
    exercise: null,
    small: smallStepFor("reprise", chapter),
  };
}

function stepFromProgram(item: RevisionItem, budget: number): FollowUpStep {
  return {
    id: `programme:${item.key}`,
    kind: "programme",
    title: item.title,
    minutes: Math.max(MIN_USEFUL_MINUTES, Math.min(item.minutes, budget)),
    why: item.why,
    start: item.start,
    exercise: null,
    small: smallStepFor(item.kind, item.chapterTitle),
  };
}

/** Le résumé de la séance, d'après ce qui est ENREGISTRÉ — jamais deviné. */
function summarize(input: FollowUpInput, topic: FollowUpTopic | null): string {
  const { attempts, session, selfReport } = input;
  const where = topic ? ` sur « ${topic.chapterTitle} »` : "";
  if (attempts.length > 0) {
    const last = attempts[attempts.length - 1];
    const word = isCleanSuccess(last) ? "réussi sans aide" : last.result === "réussi" ? `réussi avec ${last.help === "indices" ? "indices" : "la correction ouverte"}` : last.result === "partiel" ? "partiel" : "raté";
    const cause = last.result !== "réussi" && last.cause ? ` (cause notée : ${lowerFirst(last.cause)})` : "";
    return `${attempts.length > 1 ? `${attempts.length} exercices notés` : "Exercice noté"}${where} — dernier : ${word}${cause}.`;
  }
  if (selfReport === "bloque") return `Séance${where} : tu as bloqué — pas de souci, on repart plus petit.`;
  if (selfReport === "partiel") return `Séance${where} : à moitié faite.`;
  if (selfReport === "termine") return `Séance${where} : terminée.`;
  return session ? `${session.minutes} min de ${session.subject}${where}, sans exercice noté.` : "Séance enregistrée.";
}

/* ── La suite ─────────────────────────────────────────────────────── */

export function proposeFollowUp(input: FollowUpInput): FollowUp {
  const { nextMove, attempts, move, sheets } = input;
  const diagnostic = diagnosticContextOf(nextMove);
  const exercises = diagnostic.exercises;
  const budget = computeBudget(nextMove, null).minutes;
  const topic = topicOf(input, exercises);
  const notes: string[] = [];

  const program = buildRevisionProgram(nextMove);
  const justDone = move?.key ?? null;
  // Rappels : l'indispensable qui reste, hors ce qui vient d'être fait, et hors Anki juste après une séance Anki (le relevé n'a pas bougé).
  const reminders = program.items
    .filter((item) => item.tier === "indispensable" && item.key !== justDone && !(move?.kind === "anki" && item.kind === "anki"))
    .slice(0, 2)
    .map((item) => ({ title: item.title, minutes: item.minutes, href: item.start.href }));
  const eligible = (item: RevisionItem) => item.key !== justDone && !(move?.kind === "anki" && item.kind === "anki");
  const nextInProgram = program.items.find(eligible) ?? null;
  // Une autre idée précise : jamais un « bloc de travail » générique (« Mathématiques, 40 min »), qui ne dit pas quoi faire.
  const concreteNext = program.items.find((item) => eligible(item) && item.kind !== "bloc") ?? null;

  const base = { topic, summary: summarize(input, topic), reminders, notes };

  if (move?.kind === "anki") notes.push("Anki : le dernier relevé date d'avant ta séance. Mets-le à jour (/anki) pour que TaekdHub voie que tes cartes sont faites.");

  if (budget < MIN_USEFUL_MINUTES) {
    const tomorrow = nextInProgram ? `Demain, par exemple : ${nextInProgram.title}.` : null;
    return { ...base, primary: null, alternative: null, rest: { message: "Il ne reste plus de temps prévu aujourd'hui : c'est assez. Ce que tu as fait compte.", tomorrow } };
  }

  // Aucun chapitre connu : le programme du jour, et on le dit.
  if (!topic) {
    notes.push("Rien n'indique sur quoi tu as travaillé : la suite vient de ton programme du jour. Choisis un chapitre au chrono la prochaine fois pour qu'elle suive ta séance.");
    const second = program.items.filter((item) => item.key !== nextInProgram?.key && item.key !== justDone)[0] ?? null;
    return { ...base, primary: nextInProgram ? stepFromProgram(nextInProgram, budget) : null, alternative: second ? stepFromProgram(second, budget) : null, rest: nextInProgram ? null : { message: "Rien d'autre n'est prévu pour aujourd'hui.", tomorrow: null } };
  }

  notes.push(`Chapitre retenu ${topic.basis}.`);
  const target = levelToRequest(exercises, topic.chapterId);
  const diagnosis = diagnostic.diagnoses.find((entry) => entry.chapter.id === topic.chapterId);
  if (!diagnosis || diagnosis.insufficient || (diagnosis.findings.length === 0 && diagnosis.lastEvidenceDay === null)) notes.push("Peu de données sur ce chapitre : le niveau proposé est un point de départ, pas un constat.");

  const sameArgs = (level: ExerciseLevel) => ({ chapterId: topic.chapterId, level, subject: topic.subject, sheets, attempts: nextMove.attempts ?? [], exercises });
  const last = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const attemptedLevel = last?.level ?? topic.level ?? target.level;
  let primary: FollowUpStep;
  let alternative: FollowUpStep | null = null;

  if (input.selfReport === "bloque" && !last) {
    primary = { ...recallStep("reprendre-notion", "Tu as bloqué : on reprend la notion plus doucement, avant de t'y confronter à nouveau.", topic.chapterId, budget) };
    alternative = exerciseStep("exercice-facile", "Un exercice plus accessible pour retrouver la prise.", sameArgs(levelDown(target.level) ?? "direct"), budget);
  } else if (last && isCleanSuccess(last)) {
    const next = target.level;
    const raised = LEVELS.indexOf(next) > LEVELS.indexOf(attemptedLevel);
    primary = exerciseStep(
      "exercice-suivant",
      raised ? `Réussi sans aide : ${lowerFirst(target.reason)}.` : `Réussi sans aide. Un autre exercice du même niveau confirme que ce n'est pas un coup de chance — ${lowerFirst(target.reason)}.`,
      sameArgs(next),
      budget
    );
    alternative = recallStep("reprendre-notion", "Ou fixer la notion avec un rappel actif, sans exercice.", topic.chapterId, budget);
  } else if (last && last.result !== "échec") {
    primary = exerciseStep(
      "exercice-confirmer",
      `${last.result === "partiel" ? "Partiel" : `Réussi avec ${last.help === "indices" ? "indices" : "la correction ouverte"}`} : un autre exercice du même niveau vérifie que tu sais le faire seul. Celui-ci reviendra tout seul, plus tard.`,
      sameArgs(attemptedLevel),
      budget
    );
    alternative = recallStep("reprendre-notion", "Ou reprendre la notion d'abord (rappel actif).", topic.chapterId, budget);
  } else if (last && last.result === "échec") {
    const easier = levelDown(attemptedLevel);
    if (last.cause === "cours" || !easier) {
      primary = recallStep("reprendre-notion", "L'exercice a coincé sur le cours : on reprend la notion avant d'y retourner. Il reviendra tout seul, plus tard.", topic.chapterId, budget);
      alternative = exerciseStep("exercice-facile", "Ou un exercice plus direct pour retrouver la prise.", sameArgs(easier ?? "direct"), budget);
    } else {
      primary = exerciseStep("exercice-facile", `Raté à ${EXERCISE_LEVEL_LABEL[attemptedLevel].split(" (")[0].toLowerCase()} : on prend un cran en dessous pour retrouver la prise — ça arrive à tout le monde. L'exercice raté reviendra tout seul.`, sameArgs(easier), budget);
      alternative = recallStep("reprendre-notion", "Ou reprendre la notion d'abord (rappel actif).", topic.chapterId, budget);
    }
  } else if (move?.kind === "rappel") {
    primary = exerciseStep("exercice-apres-rappel", `Tu viens de reprendre la notion : un exercice ${lowerFirst(EXERCISE_LEVEL_LABEL[target.level].split(" (")[0])} la met à l'épreuve — ${lowerFirst(target.reason)}.`, sameArgs(target.level), budget);
    alternative = concreteNext ? stepFromProgram(concreteNext, budget) : null;
  } else {
    primary = exerciseStep("exercice-notion", `Pour mettre à l'épreuve ce que tu viens de travailler — ${lowerFirst(target.reason)}.`, sameArgs(target.level), budget);
    alternative = concreteNext ? stepFromProgram(concreteNext, budget) : recallStep("reprendre-notion", "Ou un rappel actif de la notion.", topic.chapterId, budget);
  }

  // Une alternative identique au choix par défaut n'en est pas une.
  if (alternative && alternative.start.href === primary.start.href) alternative = null;
  return { ...base, primary, alternative, rest: null };
}
