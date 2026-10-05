import { computeTimeCalibration, countResults, describeTimeCalibration, normalizeAnnaleLogs, weakChapters } from "@/lib/annales";
import { buildBriefing, type BriefingItem } from "@/lib/briefing";
import { latestDueInfo, normalizeAnkiSnapshots } from "@/lib/anki-snapshot";
import { normalizeAttempts } from "@/lib/attempts";
import { buildDiagnosticContext } from "@/lib/diagnostic-context";
import { chapterTitle, FINDING_LABEL, mainFinding } from "@/lib/diagnostic";
import { dueRetries } from "@/lib/exercises";
import { atRisk } from "@/lib/chapter-memory";
import { locksForClaude } from "@/lib/course-lock";
import { ERROR_TYPE_META } from "@/lib/error-log";
import { topReasons } from "@/lib/next-move/engine";
import { buildRetroplanning, computeMastery, summarizeMastery } from "@/lib/programme";
import {
  normalizeChapterMemory,
  normalizeCheckin,
  normalizeErrorEntry,
  normalizeGrade,
  normalizeNextMoveRecord,
  normalizePreferences,
  normalizeReviewItem,
  normalizeSession,
  normalizeWorkItem,
} from "@/lib/storage";
import { dayKey } from "@/lib/study";
import { activeWorkItems, daysUntilDue, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * « OÙ J'EN SUIS ? » — l'état du jour, pour Claude.
 *
 * L'outil MCP `get_today` (app/api/mcp/[key]/route.ts) lit les collections
 * synchronisées de l'élève (`user_collections`, en bloc, exactement le JSON
 * du localStorage) et ses annales (`exercise_logs`), puis appelle CETTE
 * fonction. Elle réutilise les moteurs de l'application — Le point, Next
 * Move, la mémoire FSRS — pour que Claude voie la même chose que l'élève sur
 * son accueil, et choisisse un exercice qui tombe sur le vrai point faible.
 *
 * Pure : aucune dépendance au réseau, à React ou au DOM. Les données sont
 * normalisées ici, comme à la lecture du localStorage : une collection
 * absente ou abîmée donne une liste vide, jamais une exception.
 */

const ERROR_WINDOW_DAYS = 14;
const DEADLINE_HORIZON_DAYS = 14;
const LIST_MAX = 8;

function list<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(normalize).filter((item): item is T => item !== null) : [];
}

function percent(value: number): number {
  return Math.round(value * 100);
}

function briefingLines(items: BriefingItem[]): string[] {
  return items.map((item) => `${item.title}${item.detail ? ` — ${item.detail}` : ""}`);
}

export function buildTodaySnapshot(collections: Record<string, unknown>, annaleRows: unknown, now: Date) {
  const sessions = list(collections.sessions, normalizeSession);
  const workItems = list(collections.workItems, normalizeWorkItem);
  const grades = list(collections.grades, normalizeGrade);
  const reviewItems = list(collections.reviewItems, normalizeReviewItem);
  const errors = list(collections.errors, normalizeErrorEntry);
  const checkins = list(collections.checkins, normalizeCheckin);
  const chapterMemory = list(collections.chapterMemory, normalizeChapterMemory);
  const history = list(collections.nextMoves, normalizeNextMoveRecord);
  const preferences = normalizePreferences(collections.preferences ?? {});
  const annales = normalizeAnnaleLogs(annaleRows);
  const attempts = normalizeAttempts(collections.attempts);
  const ankiSnapshots = normalizeAnkiSnapshots(collections.ankiSnapshots);
  const today = dayKey(now);

  const briefing = buildBriefing({ sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, history, annales, attempts, ankiSnapshots, now });
  // Le même diagnostic que l'écran Programme (l'historique de khôlle, propre à un appareil, n'est pas disponible ici).
  const diagnostic = buildDiagnosticContext({ chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle: {}, now });
  const ankiDue = latestDueInfo(ankiSnapshots);
  const move = briefing.move;

  const deadlines = activeWorkItems(workItems)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: typeof entry.item; days: number } => entry.days !== null && entry.days <= DEADLINE_HORIZON_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, LIST_MAX)
    .map(({ item, days }) => ({
      id: item.id,
      titre: item.title,
      type: WORK_ITEM_KIND_META[item.kind].label,
      matiere: item.subject,
      date: item.dueDate,
      dans_jours: days,
      reste_min: remainingMinutes(item, sessions),
      ...(item.note ? { note: item.note } : {}),
    }));

  const from = new Date(now);
  from.setDate(from.getDate() - (ERROR_WINDOW_DAYS - 1));
  const recentErrors = errors
    .filter((entry) => entry.date >= dayKey(from) && entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LIST_MAX)
    .map((entry) => ({ matiere: entry.subject, type: ERROR_TYPE_META[entry.type].label, erreur: entry.description, bonne_idee: entry.fix, jour: entry.date }));

  const time = computeTimeCalibration(annales);
  const mastery = computeMastery({ chapterMemory, annales, attempts, seen: preferences.programmeSeen, today });
  const programmeSummary = summarizeMastery(mastery);
  const plan = buildRetroplanning(mastery, preferences.contestDate, today);
  const annaleTotals = countResults(annales);

  return {
    date: today,
    resume: briefing.summary,
    prochain_mouvement: move.primary
      ? {
          matiere: move.primary.subject,
          quoi: move.primary.title,
          action: move.primary.action,
          minutes: move.steps.find((step) => step.candidate?.key === move.primary!.key)?.minutes ?? move.primary.idealMinutes,
          pourquoi: topReasons(move.primary, 4),
          consigne: move.primary.instruction,
          corrige: move.primary.problem,
          termine_quand: move.primary.doneWhen,
        }
      : null,
    // EN PREMIER : un chapitre verrouillé interdit tout exercice dessus (lib/course-lock.ts).
    verrous: locksForClaude(reviewItems, now),
    statut_du_jour: move.status === "repos" ? "assez pour aujourd'hui (capacité déclarée atteinte)" : move.status,
    point_faible_principal: diagnostic.ranked.slice(0, 3).map((diagnosis) => {
      const finding = mainFinding(diagnosis)!;
      return {
        matiere: diagnosis.chapter.subject,
        chapitre: diagnosis.chapter.title,
        constat: FINDING_LABEL[finding.kind],
        niveau: finding.level,
        preuves: finding.evidence,
        cours: `${diagnosis.course.state} — ${diagnosis.course.detail}`,
        application: `${diagnosis.application.state} — ${diagnosis.application.detail}`,
        action: finding.action,
        termine_quand: finding.doneWhen,
      };
    }),
    a_refaire_sans_aide: dueRetries(diagnostic.exercises).slice(0, LIST_MAX).map((exercise) => ({
      exercice: exercise.label,
      matiere: exercise.subject,
      chapitre: chapterTitle(exercise.chapterId),
      prevu_le: exercise.nextRetryDay,
      echecs_d_affilee: exercise.failedStreak,
      autre_approche: exercise.changeApproach,
    })),
    anki: {
      cartes_dues: ankiDue ? { nombre: ankiDue.due, releve_le: ankiDue.takenAt, source: ankiDue.source, attention: "chiffre du relevé, pas en temps réel" } : null,
      releve_complet: diagnostic.ankiSnapshot ? { le: diagnostic.ankiSnapshot.takenAt, trop_ancien: diagnostic.ankiStale } : null,
    },
    ensuite: move.steps.slice(1).map((step) => (step.type === "pause" ? `${step.minutes} min de pause` : `${step.minutes} min · ${step.candidate!.action} — ${step.candidate!.title}`)),
    ce_qui_presse: briefingLines(briefing.urgent),
    tu_repousses: briefingLines(briefing.postponed),
    aujourd_hui: briefingLines(briefing.today),
    echeances: deadlines,
    chapitres_qui_s_effacent: atRisk(chapterMemory, today)
      .slice(0, LIST_MAX)
      .map(({ chapter, retrievability }) => ({ matiere: chapter.subject, chapitre: chapter.title, souvenir_pct: percent(retrievability) })),
    erreurs_recentes: recentErrors,
    programme: {
      chapitres_vus: programmeSummary.seen,
      solides_pct: programmeSummary.solidShare === null ? null : percent(programmeSummary.solidShare),
      fragiles: mastery.filter((entry) => entry.status === "fragile").map((entry) => ({ matiere: entry.chapter.subject, chapitre: entry.chapter.title, pourquoi: entry.reason })),
      jamais_revus: mastery.filter((entry) => entry.status === "jamais").map((entry) => ({ matiere: entry.chapter.subject, chapitre: entry.chapter.title })),
      concours_dans_jours: plan?.daysLeft ?? null,
      a_reprendre_cette_semaine: plan?.weeks[0]?.chapters.map((entry) => `${entry.chapter.subject} — ${entry.chapter.title}`) ?? [],
    },
    annales: {
      total: annaleTotals.count,
      reussite_pct: annaleTotals.successRate === null ? null : percent(annaleTotals.successRate),
      indices_moyens: annaleTotals.meanHints === null ? null : Math.round(annaleTotals.meanHints * 10) / 10,
      temps: describeTimeCalibration(time.overall),
      chapitres_qui_bloquent: weakChapters(annales, now).map((weak) => ({
        matiere: weak.subject,
        chapitre: weak.chapter,
        echecs: weak.échecs,
        partiels: weak.partiels,
        essais: weak.attempts,
        dernier: weak.lastDay,
        source: weak.lastSource,
      })),
      dernieres: annales.slice(0, 5).map((log) => ({ jour: log.day, matiere: log.subjectLabel, chapitre: log.chapter, source: log.source, resultat: log.result, indices: log.hints })),
    },
  };
}

export type TodaySnapshot = ReturnType<typeof buildTodaySnapshot>;
