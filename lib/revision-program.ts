import { latestDueInfo, snapshotAgeHours } from "@/lib/anki-snapshot";
import type { ExerciseLevel } from "@/lib/attempts";
import { buildDayAgenda, TIER_LABEL, type AgendaTier, type Budget, type RemainingOverride } from "@/lib/day-agenda";
import { chapterTitle, mainFinding, STALE_DAYS } from "@/lib/diagnostic";
import { levelToRequest } from "@/lib/exercise-quality";
import { sheetHref, sheetIdOfKey, trainingHref } from "@/lib/exercise-sheets";
import { computeNextMove, diagnosticContextOf, rankCandidates, skippedKeys, topReasons, type MoveCandidate, type MoveKind, type NextMoveInput } from "@/lib/next-move/engine";
import { smallStepFor, type SmallStep } from "@/lib/small-step";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE PROGRAMME DE RÉVISION — « qu'est-ce que je révise, pourquoi maintenant,
 * combien de temps, et comment je commence ? »
 *
 * CE MODULE NE DÉCIDE RIEN. Il ne fait que RASSEMBLER, pour l'afficher d'un
 * seul tenant, ce que l'application calcule déjà :
 *
 *   — les propositions de Next Move (lib/next-move/engine.ts) : l'action, le
 *     problème qu'elle corrige, ses raisons chiffrées, le critère de fin ;
 *   — l'arbitrage du temps restant (lib/day-agenda.ts) : ce qui est gardé,
 *     avec sa durée, et ce qui est déplacé à demain — SANS que l'élève ait à
 *     replanifier quoi que ce soit.
 *
 * Avant, ces informations étaient réparties : Next Move montrait le
 * « pourquoi » d'UNE action, la liste de la journée montrait toutes les
 * actions sans leur « pourquoi » ni leur consigne. Ici, chaque élément porte
 * les cinq réponses : quoi, pourquoi, combien, avec quelle fiabilité, et par
 * où commencer.
 *
 * FIABILITÉ. Rien n'est présenté comme sûr quand il ne l'est pas. Chaque
 * élément est dit :
 *
 *   fiable        repose sur un fait enregistré : une échéance datée, des
 *                 cartes arrivées à échéance, un exercice raté, un constat
 *                 du diagnostic ÉTABLI (≥ 2 sources ou ≥ 4 observations) et
 *                 récent ;
 *   à confirmer   repose sur une estimation fragile : un constat du
 *                 diagnostic au stade de « signal » ou dont la dernière
 *                 observation date de plus de `STALE_DAYS` jours ; une
 *                 probabilité d'oubli estimée sur moins de `MIN_RECALLS`
 *                 rappels ; une échéance sans date ;
 *   insuffisant   (programme entier) aucune donnée pour recommander.
 *
 * Et le programme entier porte des NOTES SUR LES DONNÉES, qui valent pour
 * tout ce qui est affiché : aucune séance enregistrée depuis plusieurs jours
 * (le temps restant peut être faux), synchronisation incomplète, annales
 * illisibles, relevé Anki ancien, mémoire vide.
 *
 * Ce n'est PAS un score de santé ou de performance, et ce module n'ajoute
 * aucun signal de fatigue, de sommeil ou de stress : les check-ins ne sont lus
 * que là où le moteur de l'application les lit déjà. Fonctions pures.
 */

export type Reliability = "fiable" | "a-confirmer" | "insuffisant";

export const RELIABILITY_LABEL: Record<Reliability, string> = {
  fiable: "Fiable",
  "a-confirmer": "À confirmer",
  insuffisant: "Données insuffisantes",
};

/** Rappels notés au-dessous desquels la probabilité d'oubli de FSRS reste une estimation grossière. */
export const MIN_RECALLS = 3;
/** Jours sans séance enregistrée à partir desquels le temps restant et le travail déjà fait sont suspects. */
export const STALE_WORK_DAYS = 3;
/** Âge (en jours) d'un relevé Anki au-delà duquel il est signalé — le diagnostic, lui, l'écarte à 7 jours. */
export const ANKI_NOTE_DAYS = 3;
/**
 * Au-delà de ces heures, un relevé Anki ne dit plus « combien de cartes il reste » : l'élève a pu en faire depuis.
 * L'élément Anki devient alors « à confirmer » (le moteur, lui, ne s'en sert plus qu'à 24 h).
 */
export const ANKI_FRESH_HOURS = 6;

export interface ItemReliability {
  level: Exclude<Reliability, "insuffisant">;
  /** Phrases d'élève : sur quoi repose l'élément, ou ce qu'il faut confirmer. */
  reasons: string[];
}

export interface RevisionItem {
  key: string;
  kind: MoveKind;
  subject: Subject | null;
  /** QUOI : l'objet (le chapitre, l'exercice, les cartes). */
  title: string;
  /** Le verbe : « rappel actif », « refaire sans aide ». */
  action: string;
  chapterId: string | null;
  chapterTitle: string | null;
  /** POURQUOI : le problème que l'action corrige. */
  why: string;
  /** POURQUOI MAINTENANT : le palier, puis les raisons chiffrées du moteur (au plus trois). */
  whyNow: string[];
  /** Comment s'y prendre. */
  instruction: string | null;
  /** Comment savoir que c'est terminé. */
  doneWhen: string | null;
  /** COMBIEN : la durée gardée aujourd'hui. */
  minutes: number;
  /** Durée prévue avant réduction, quand le temps restant l'a raccourcie. */
  reducedFrom: number | null;
  tier: AgendaTier;
  tierLabel: string;
  reliability: ItemReliability;
  /** PAR OÙ COMMENCER. */
  start: { href: string; label: string };
  /** Quand l'action consiste à faire un exercice : le niveau visé et la demande prête pour Claude. */
  exercise: { level: ExerciseLevel; request: string | null } | null;
  /**
   * Une tâche proposée plusieurs fois sans suite : ça arrive, surtout quand elle est difficile. On ne la retire pas
   * et on ne la compte pas comme abandonnée — on offre une première étape plus petite, sans rien à résoudre.
   */
  avoidance: { note: string; smallStep: SmallStep } | null;
  /** La proposition du moteur, pour l'enregistrer dans l'historique de Next Move quand l'élève commence. `null` pour une part du planning des échéances. */
  candidate: MoveCandidate | null;
}

export interface PostponedItem {
  key: string;
  title: string;
  subject: Subject | null;
  tier: AgendaTier;
  minutes: number;
  reason: string;
  to: string;
  /** « Pas maintenant » : mise de côté par l'élève. Elle revient d'elle-même ; ici, une façon plus douce de la reprendre. */
  skipped: boolean;
  smallStep: SmallStep | null;
  start: { href: string; label: string };
  candidate: MoveCandidate | null;
}

export type DataNoteId = "seances-anciennes" | "synchro-incomplete" | "annales-illisibles" | "anki-ancien" | "memoire-vide";

export interface DataNote {
  id: DataNoteId;
  level: "alerte" | "info";
  text: string;
}

export interface RevisionProgram {
  day: string;
  budget: Budget;
  items: RevisionItem[];
  postponed: PostponedItem[];
  /** Minutes gardées. */
  used: number;
  /** Minutes indispensables qui dépassent le temps restant — 0 si tout tient. */
  overflow: number;
  summary: string;
  notes: DataNote[];
  /** Le programme entier : `insuffisant` sans rien à recommander, `a-confirmer` si une note d'alerte pèse sur les données. */
  overall: Reliability;
  /** Aucune donnée exploitable (nouvel inscrit) : on le dit au lieu d'inventer un programme. */
  empty: boolean;
}

/** Ce que l'écran sait et que le moteur ne sait pas : l'état du compte, et si les annales ont pu être lues. */
export interface ProgramContext {
  /** « il me reste… » indiqué par l'élève aujourd'hui (trace du plan du jour). */
  override?: RemainingOverride | null;
  sync?: { status: "désactivé" | "chargement" | "invité" | "synchronisation" | "à-jour" | "en-attente" | "décision" | "erreur"; lastSyncedAt: string | null };
  annalesStatus?: "désactivé" | "invité" | "chargement" | "prêt" | "erreur";
}

function dayDistance(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}

/* ── Fiabilité d'un élément ───────────────────────────────────────── */

const DIAGNOSTIC_KEY = /^(exercice|calcul|cours|kholle):/;

function reliabilityOf(candidate: MoveCandidate | null, task: { dueDate: string | null }, input: NextMoveInput, today: string): ItemReliability {
  if (!candidate) {
    // Part d'aujourd'hui du planning des échéances : l'échéance a une date.
    return { level: "fiable", reasons: ["Part d'une échéance datée, répartie par ton planning"] };
  }
  const { key, kind } = candidate;

  if (kind === "échéance") {
    return task.dueDate
      ? { level: "fiable", reasons: [`Échéance datée du ${task.dueDate}`] }
      : { level: "a-confirmer", reasons: ["Sans date limite : l'ordre est indicatif"] };
  }
  if (kind === "cartes") return { level: "fiable", reasons: ["Cartes arrivées à échéance selon ton carnet « À revoir »"] };
  if (kind === "anki") {
    const due = latestDueInfo(input.ankiSnapshots ?? []);
    const hours = due ? snapshotAgeHours(due.takenAt, input.now) : null;
    if (hours === null) return { level: "a-confirmer", reasons: ["Aucun relevé Anki exploitable"] };
    return hours <= ANKI_FRESH_HOURS
      ? { level: "fiable", reasons: [`Relevé Anki d'il y a ${Math.round(hours)} h`] }
      : { level: "a-confirmer", reasons: [`Relevé Anki d'il y a ${Math.round(hours)} h : tu as pu faire des cartes depuis. Mets-le à jour dans Anki (page Anki) pour savoir ce qu'il reste.`] };
  }
  if (key.startsWith("verrou:")) return { level: "fiable", reasons: ["Règle du verrou de cours : des fiches de Claude ne sont pas encore retrouvées"] };
  if (key.startsWith("refaire:") || key.startsWith("transfert:")) return { level: "fiable", reasons: ["Repose sur tes tentatives enregistrées"] };

  if (key.startsWith("rappel:")) {
    const chapter = input.chapterMemory.find((entry) => entry.id === key.slice("rappel:".length));
    const reps = chapter?.card.reps ?? 0;
    if (reps < MIN_RECALLS) {
      return { level: "a-confirmer", reasons: [`Probabilité d'oubli estimée sur ${reps} rappel${reps > 1 ? "s" : ""} seulement (il en faut ${MIN_RECALLS} pour qu'elle soit fiable)`] };
    }
    return { level: "fiable", reasons: [`Estimation FSRS sur ${reps} rappels`] };
  }

  if (DIAGNOSTIC_KEY.test(key) && candidate.chapterId) {
    const diagnosis = diagnosticContextOf(input).diagnoses.find((entry) => entry.chapter.id === candidate.chapterId);
    const finding = diagnosis ? mainFinding(diagnosis) : null;
    if (!finding) return { level: "a-confirmer", reasons: ["Aucun constat chiffré sur ce chapitre"] };
    const reasons: string[] = [];
    if (finding.level !== "établi") reasons.push(`Signal à confirmer : ${finding.observations} observation${plural(finding.observations, "", "s")}, pas encore établi`);
    if (finding.stale && finding.lastSeen) reasons.push(`Dernière observation il y a ${dayDistance(finding.lastSeen, today)} jours (plus de ${STALE_DAYS})`);
    return reasons.length > 0
      ? { level: "a-confirmer", reasons }
      : { level: "fiable", reasons: [`Constat établi : ${finding.observations} observations, ${finding.sources.length} source${plural(finding.sources.length, "", "s")}`] };
  }

  // Erreurs notées par l'élève, blocs d'objectifs de temps : des faits déclarés.
  return { level: "fiable", reasons: ["Repose sur ce que tu as noté (erreurs, objectifs)"] };
}

/* ── Point d'entrée vers l'exercice ───────────────────────────────── */

function startOf(candidate: MoveCandidate | null, href: string, input: NextMoveInput): { start: RevisionItem["start"]; exercise: RevisionItem["exercise"] } {
  if (!candidate) return { start: { href, label: "Commencer" }, exercise: null };
  const { key } = candidate;

  // Une fiche déjà tentée à refaire : on rouvre SA fiche (l'énoncé d'abord), pas le carnet générique.
  if (key.startsWith("refaire:")) {
    const id = sheetIdOfKey(key.slice("refaire:".length));
    if (id) return { start: { href: sheetHref(id), label: "Refaire l'exercice" }, exercise: { level: "classique", request: null } };
  }
  // Un exercice ciblé du diagnostic : choisir (ou ajouter) une fiche de CE chapitre, au niveau visé.
  if (key.startsWith("exercice:") && !key.endsWith(":temps") && candidate.chapterId) {
    const level: ExerciseLevel = key.endsWith(":difficile") ? "difficile" : levelToRequest(diagnosticContextOf(input).exercises, candidate.chapterId).level;
    return { start: { href: trainingHref({ chapterId: candidate.chapterId, level }), label: "Choisir un exercice" }, exercise: { level, request: candidate.request ?? null } };
  }
  if (candidate.kind === "refaire") return { start: { href: candidate.href, label: "Refaire sans aide" }, exercise: null };
  return { start: { href: candidate.href, label: "Commencer" }, exercise: null };
}

/* ── Notes sur les données ────────────────────────────────────────── */

function dataNotes(input: NextMoveInput, context: ProgramContext, today: string): DataNote[] {
  const notes: DataNote[] = [];

  const lastSession = input.sessions.map((session) => dayKey(session.started_at)).sort().pop() ?? null;
  const idle = lastSession ? dayDistance(lastSession, today) : null;
  if (idle !== null && idle >= STALE_WORK_DAYS) {
    notes.push({
      id: "seances-anciennes",
      level: "alerte",
      text: `Aucune séance enregistrée depuis ${idle} jours : le temps restant et ce qui est déjà fait peuvent être faux. Note ce que tu as travaillé pour que le programme s'ajuste.`,
    });
  }

  if (context.sync && (context.sync.status === "en-attente" || context.sync.status === "erreur")) {
    notes.push({ id: "synchro-incomplete", level: "alerte", text: "La dernière synchronisation n'a pas abouti : un autre appareil peut avoir des données plus récentes que celles affichées." });
  }

  if (context.annalesStatus === "erreur") {
    notes.push({ id: "annales-illisibles", level: "alerte", text: "Tes annales corrigées avec Claude n'ont pas pu être lues : les exercices à refaire qui en viennent peuvent manquer." });
  }

  const diagnostic = diagnosticContextOf(input);
  if (diagnostic.ankiSnapshot) {
    const age = Math.floor(snapshotAgeHours(diagnostic.ankiSnapshot.takenAt, input.now) / 24);
    if (diagnostic.ankiStale || age >= ANKI_NOTE_DAYS) {
      notes.push({
        id: "anki-ancien",
        level: "info",
        text: diagnostic.ankiStale ? `Ton dernier relevé Anki a ${age} jours : il n'est plus utilisé pour décider.` : `Ton dernier relevé Anki a ${age} jours : les chiffres Anki peuvent avoir changé.`,
      });
    }
  }

  if (input.chapterMemory.filter((chapter) => !chapter.archived).length === 0) {
    notes.push({ id: "memoire-vide", level: "info", text: "Aucun chapitre dans « Ma mémoire » : TaekdHub ne peut pas encore programmer tes rappels de cours." });
  }
  return notes;
}

/* ── Le programme ─────────────────────────────────────────────────── */

function whyNowOf(tierReason: string, candidate: MoveCandidate | null): string[] {
  const reasons = [tierReason, ...(candidate ? topReasons(candidate, 3) : [])];
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const trimmed = reason.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
}

export function buildRevisionProgram(input: NextMoveInput, context: ProgramContext = {}): RevisionProgram {
  const today = dayKey(input.now);
  const agenda = buildDayAgenda(input, context.override ?? null);
  const candidates = new Map(rankCandidates(input).map((candidate) => [candidate.key, candidate]));

  const items: RevisionItem[] = agenda.kept.map((task) => {
    const candidate = candidates.get(task.key) ?? null;
    const { start, exercise } = startOf(candidate, task.href, input);
    const chapterId = candidate?.chapterId ?? null;
    return {
      key: task.key,
      kind: candidate?.kind ?? "échéance",
      subject: task.subject,
      title: task.title,
      action: task.action,
      chapterId,
      chapterTitle: chapterTitle(chapterId),
      why: candidate?.problem ?? "Une part de cette échéance est réservée aujourd'hui par ton planning.",
      whyNow: whyNowOf(task.tierReason, candidate),
      instruction: candidate?.instruction ?? null,
      doneWhen: candidate?.doneWhen ?? null,
      minutes: task.minutes,
      reducedFrom: task.reducedFrom,
      tier: task.tier,
      tierLabel: TIER_LABEL[task.tier],
      reliability: reliabilityOf(candidate, task, input, today),
      start,
      exercise,
      avoidance: candidate?.terms.some((term) => term.id === "ignoré")
        ? { note: "Proposé plusieurs fois sans suite : ça arrive, surtout quand c'est difficile. Elle reste au programme — voici une façon de la commencer sans effort.", smallStep: smallStepFor(candidate.kind, chapterTitle(chapterId)) }
        : null,
      candidate,
    };
  });

  const skipped = skippedKeys(input.history, input.now);
  const postponed: PostponedItem[] = agenda.postponed.map((task) => {
    const candidate = candidates.get(task.key) ?? null;
    const wasSkipped = skipped.has(task.key);
    return {
      key: task.key,
      title: task.title,
      subject: task.subject,
      tier: task.tier,
      minutes: task.idealMinutes,
      reason: task.reason,
      to: task.to,
      skipped: wasSkipped,
      smallStep: wasSkipped ? smallStepFor(candidate?.kind ?? "bloc", chapterTitle(candidate?.chapterId ?? null)) : null,
      start: startOf(candidate, task.href, input).start,
      candidate,
    };
  });
  const notes = dataNotes(input, context, today);
  const empty = computeNextMove(input).status === "vide" && items.length === 0;
  const overall: Reliability = empty ? "insuffisant" : notes.some((note) => note.level === "alerte") ? "a-confirmer" : "fiable";

  return { day: agenda.day, budget: agenda.budget, items, postponed, used: agenda.used, overflow: agenda.overflow, summary: agenda.summary, notes, overall, empty };
}
