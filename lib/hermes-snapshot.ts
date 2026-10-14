import { computeTimeCalibration, countResults, normalizeAnnaleLogs, weakChapters } from "@/lib/annales";
import { buildBriefing } from "@/lib/briefing";
import { latestDueInfo, normalizeAnkiSnapshots } from "@/lib/anki-snapshot";
import { normalizeAttempts } from "@/lib/attempts";
import { buildDiagnosticContext } from "@/lib/diagnostic-context";
import { mainFinding } from "@/lib/diagnostic";
import { dueRetries } from "@/lib/exercises";
import { atRisk } from "@/lib/chapter-memory";
import { courseLocks } from "@/lib/course-lock";
import { ERROR_TYPE_META } from "@/lib/error-log";
import { buildRetroplanning, bestProgrammeMatch, computeMastery, summarizeMastery } from "@/lib/programme";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
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
  STORAGE_KEYS,
} from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { activeWorkItems, daysUntilDue, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * VUE D'HERMES — l'état du jour SANS AUCUN TEXTE LIBRE.
 *
 * Hermes lit TaekdHub par un accès séparé et en lecture seule
 * (app/api/mcp-hermes/route.ts). Ce module construit ce qu'il voit.
 *
 * LISTE BLANCHE, PAS FILTRAGE. L'état du jour de Claude (lib/today-snapshot.ts)
 * mêle du texte saisi par l'élève à presque tout : les titres d'échéances sont
 * recopiés dans les phrases du prochain mouvement, les fiches du verrou portent
 * leur recto et leur verso, les clés d'exercices sont le libellé simplifié. En
 * retirer des champs un par un en oublierait forcément un. Ici, chaque valeur
 * renvoyée est choisie explicitement, et n'est que :
 *
 *   — un nombre, une date, un booléen ;
 *   — une valeur d'une liste fermée (matière, genre de tâche, niveau, type
 *     d'erreur) ou un libellé fixe du code (`WORK_ITEM_KIND_META`) ;
 *   — un chapitre du PROGRAMME officiel (lib/programme-data.ts : identifiant et
 *     titre statiques), jamais le titre tapé par l'élève : un titre libre est
 *     rapproché d'un chapitre du programme, sinon il devient `null`.
 *
 * Aucun identifiant stable d'échéance, de fiche, d'exercice ou de recommandation
 * n'est renvoyé : Hermes lit, il n'a rien à désigner pour écrire.
 *
 * Les moteurs de lib/ sont ceux de l'application (mêmes normalisations, mêmes
 * calculs) : Hermes voit les mêmes faits que l'élève, sans leurs mots.
 *
 * Fonctions pures — aucun réseau, aucun React, aucun DOM.
 */

export const HERMES_SCHEMA_VERSION = 1;

/**
 * Seuil PROVISOIRE (règle pratique, pas une valeur validée) au-delà duquel
 * aucune collection de travail n'a été synchronisée : voir `buildFreshness`.
 */
export const STALE_AFTER_HOURS = 48;

/** Les collections dont la dernière synchronisation dit « l'élève a travaillé et synchronisé récemment ». */
const WORK_COLLECTIONS = ["sessions", "workItems", "reviewItems", "errors", "chapterMemory", "attempts"] as const;
const KNOWN_COLLECTIONS: ReadonlySet<string> = new Set(Object.keys(STORAGE_KEYS));

const ERROR_WINDOW_DAYS = 14;
const DEADLINE_HORIZON_DAYS = 14;
const LIST_MAX = 8;

/** Horodatage de dernière écriture par collection (colonne `updated_at`, posée par le serveur). */
export type CollectionStamps = Record<string, string | null | undefined>;

function list<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(normalize).filter((item): item is T => item !== null) : [];
}

function percent(value: number): number {
  return Math.round(value * 100);
}

export interface ProgrammeRef {
  id: string;
  titre: string;
}

function programmeRef(id: string | null | undefined): ProgrammeRef | null {
  const chapter = id ? PROGRAMME_BY_ID.get(id) : undefined;
  return chapter ? { id: chapter.id, titre: chapter.title } : null;
}

/** Le chapitre du programme d'un titre libre — jamais le titre libre lui-même. */
function programmeRefOf(subject: Subject | null, title: string): ProgrammeRef | null {
  const chapter = bestProgrammeMatch(subject, title);
  return chapter ? { id: chapter.id, titre: chapter.title } : null;
}

/** Un identifiant de raison du moteur (« échéance », « au-programme »…) : minuscules, chiffres, tirets, deux-points. Tout le reste est écarté. */
const SAFE_TERM_ID = /^[a-zà-ÿ0-9:-]{1,48}$/;

/* ── Fraîcheur ────────────────────────────────────────────────────── */

export interface Freshness {
  schema_version: number;
  generated_at: string;
  fraicheur: {
    seuil_heures: number;
    /** Dernière écriture de chaque collection lue, `null` si elle n'a jamais été synchronisée. */
    collections: Record<string, string | null>;
    /** La plus récente des collections de travail, `null` si aucune n'a été synchronisée. */
    derniere_synchro_travail: string | null;
    anciennete_heures: number | null;
    /** Vrai si aucune collection de travail n'a été synchronisée depuis plus de `seuil_heures`. */
    donnees_anciennes: boolean;
    /** À lire avant d'interpréter `donnees_anciennes`. */
    precision: string;
  };
}

const FRESHNESS_NOTE =
  "donnees_anciennes signale une ABSENCE DE SYNCHRONISATION RÉCENTE (aucune collection de travail écrite depuis plus de seuil_heures, règle provisoire), pas des données nécessairement incorrectes.";

/**
 * Les métadonnées de fraîcheur — et rien d'autre : quand chaque collection a
 * été écrite pour la dernière fois, et si plus aucune n'a bougé depuis
 * longtemps. Elles ne disent pas si le CONTENU est à jour : un élève qui n'a
 * rien modifié n'écrit rien.
 */
export function buildFreshness(stamps: CollectionStamps, now: Date): Freshness {
  const collections: Record<string, string | null> = {};
  for (const [name, stamp] of Object.entries(stamps)) {
    if (!KNOWN_COLLECTIONS.has(name)) continue;
    const time = typeof stamp === "string" ? new Date(stamp).getTime() : NaN;
    collections[name] = Number.isNaN(time) ? null : new Date(time).toISOString();
  }
  let latest: number | null = null;
  for (const name of WORK_COLLECTIONS) {
    const stamp = collections[name];
    const time = stamp ? new Date(stamp).getTime() : NaN;
    if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time;
  }
  const ageHours = latest === null ? null : Math.max(0, Math.round(((now.getTime() - latest) / 3_600_000) * 10) / 10);
  return {
    schema_version: HERMES_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    fraicheur: {
      seuil_heures: STALE_AFTER_HOURS,
      collections,
      derniere_synchro_travail: latest === null ? null : new Date(latest).toISOString(),
      anciennete_heures: ageHours,
      donnees_anciennes: ageHours === null || ageHours > STALE_AFTER_HOURS,
      precision: FRESHNESS_NOTE,
    },
  };
}

/* ── Échéances ────────────────────────────────────────────────────── */

function echeanceView(item: ReturnType<typeof normalizeWorkItem>, days: number, sessions: ReturnType<typeof normalizeSession>[]) {
  return {
    type: WORK_ITEM_KIND_META[item.kind].label,
    matiere: item.subject,
    date: item.dueDate,
    dans_jours: days,
    reste_min: remainingMinutes(item, sessions),
    important: item.important,
  };
}

/**
 * `list_echeances` pour Hermes : les échéances à venir, de aujourd'hui à
 * `jours` jours (toutes si absent), la plus proche d'abord. Ni titre, ni note,
 * ni chapitres, ni identifiant.
 */
export function buildHermesEcheances(collections: Record<string, unknown>, stamps: CollectionStamps, now: Date, jours?: number) {
  const sessions = list(collections.sessions, normalizeSession);
  const entries = list(collections.workItems, normalizeWorkItem)
    .filter((item) => activeWorkItems([item]).length > 0)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: typeof entry.item; days: number } => entry.days !== null && entry.days >= 0 && (jours === undefined || entry.days <= jours))
    // Ordre total sans passer par le titre : date, puis genre, matière, durée.
    .sort((a, b) => a.days - b.days || a.item.kind.localeCompare(b.item.kind) || (a.item.subject ?? "").localeCompare(b.item.subject ?? "") || a.item.estimatedMinutes - b.item.estimatedMinutes);
  return { meta: buildFreshness(stamps, now), echeances: entries.map(({ item, days }) => echeanceView(item, days, sessions)) };
}

/* ── L'état du jour ───────────────────────────────────────────────── */

/**
 * `get_today` pour Hermes : mêmes faits que l'état du jour de Claude, sans
 * un mot saisi par l'élève (voir l'en-tête). `annaleRows` sont les lignes
 * brutes d'`exercise_logs` ; leurs textes (source, chapitre, commentaire,
 * erreurs) servent aux calculs mais ne sortent jamais.
 */
export function buildHermesToday(collections: Record<string, unknown>, annaleRows: unknown, stamps: CollectionStamps, now: Date) {
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
  const diagnostic = buildDiagnosticContext({ chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle: {}, now });
  const ankiDue = latestDueInfo(ankiSnapshots);
  const move = briefing.move;
  const primary = move.primary;

  const deadlines = activeWorkItems(workItems)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: typeof entry.item; days: number } => entry.days !== null && entry.days <= DEADLINE_HORIZON_DAYS)
    .sort((a, b) => a.days - b.days || a.item.kind.localeCompare(b.item.kind) || (a.item.subject ?? "").localeCompare(b.item.subject ?? ""))
    .slice(0, LIST_MAX)
    .map(({ item, days }) => echeanceView(item, days, sessions));

  const from = new Date(now);
  from.setDate(from.getDate() - (ERROR_WINDOW_DAYS - 1));
  const recentErrors = errors
    .filter((entry) => entry.date >= dayKey(from) && entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LIST_MAX)
    .map((entry) => ({ matiere: entry.subject, type: ERROR_TYPE_META[entry.type].label, jour: entry.date, avec_correction: Boolean(entry.fix) }));

  const time = computeTimeCalibration(annales).overall;
  const mastery = computeMastery({ chapterMemory, annales, attempts, seen: preferences.programmeSeen, today });
  const programmeSummary = summarizeMastery(mastery);
  const plan = buildRetroplanning(mastery, preferences.contestDate, today);
  const annaleTotals = countResults(annales);

  return {
    meta: buildFreshness(stamps, now),
    date: today,
    statut_du_jour: move.status,
    prochain_mouvement: primary
      ? {
          genre: primary.kind,
          matiere: primary.subject,
          minutes: move.steps.find((step) => step.candidate?.key === primary.key)?.minutes ?? primary.idealMinutes,
          score: primary.score,
          raisons: primary.terms.filter((term) => SAFE_TERM_ID.test(term.id)).map((term) => ({ id: term.id, points: term.points })),
        }
      : null,
    ensuite: move.steps.slice(1).map((step) => (step.type === "pause" || !step.candidate ? { genre: "pause", matiere: null, minutes: step.minutes } : { genre: step.candidate.kind, matiere: step.candidate.subject, minutes: step.minutes })),
    verrous: courseLocks(reviewItems, now).map((lock) => ({ matiere: lock.subject, chapitre: programmeRef(lock.key), fiches_restantes: lock.remaining.length })),
    point_faible_principal: diagnostic.ranked.slice(0, 3).map((diagnosis) => {
      const finding = mainFinding(diagnosis)!;
      return {
        matiere: diagnosis.chapter.subject,
        chapitre: programmeRef(diagnosis.chapter.id),
        constat: finding.kind,
        niveau: finding.level,
        cours: diagnosis.course.state,
        application: diagnosis.application.state,
      };
    }),
    a_refaire_sans_aide: dueRetries(diagnostic.exercises)
      .slice(0, LIST_MAX)
      .map((exercise) => ({ matiere: exercise.subject, chapitre: programmeRef(exercise.chapterId), prevu_le: exercise.nextRetryDay, echecs_d_affilee: exercise.failedStreak })),
    anki: {
      cartes_dues: ankiDue ? { nombre: ankiDue.due, releve_le: ankiDue.takenAt, source: ankiDue.source } : null,
      releve_complet: diagnostic.ankiSnapshot ? { le: diagnostic.ankiSnapshot.takenAt, trop_ancien: diagnostic.ankiStale } : null,
    },
    echeances: deadlines,
    chapitres_qui_s_effacent: atRisk(chapterMemory, today)
      .slice(0, LIST_MAX)
      .map(({ chapter, retrievability }) => ({ matiere: chapter.subject, chapitre: programmeRefOf(chapter.subject, chapter.title), souvenir_pct: percent(retrievability) })),
    erreurs_recentes: recentErrors,
    programme: {
      chapitres_vus: programmeSummary.seen,
      solides_pct: programmeSummary.solidShare === null ? null : percent(programmeSummary.solidShare),
      fragiles: mastery.filter((entry) => entry.status === "fragile").map((entry) => ({ matiere: entry.chapter.subject, chapitre: programmeRef(entry.chapter.id) })),
      jamais_revus: mastery.filter((entry) => entry.status === "jamais").map((entry) => ({ matiere: entry.chapter.subject, chapitre: programmeRef(entry.chapter.id) })),
      concours_dans_jours: plan?.daysLeft ?? null,
      a_reprendre_cette_semaine: plan?.weeks[0]?.chapters.map((entry) => ({ matiere: entry.chapter.subject, chapitre: programmeRef(entry.chapter.id) })) ?? [],
    },
    annales: {
      total: annaleTotals.count,
      reussite_pct: annaleTotals.successRate === null ? null : percent(annaleTotals.successRate),
      indices_moyens: annaleTotals.meanHints === null ? null : Math.round(annaleTotals.meanHints * 10) / 10,
      temps: { exercices_mesures: time.count, ratio_median_reel_sur_prevu: time.medianRatio },
      chapitres_qui_bloquent: weakChapters(annales, now).map((weak) => ({
        matiere: weak.subject,
        chapitre: programmeRefOf(weak.subject, weak.chapter),
        echecs: weak.échecs,
        partiels: weak.partiels,
        essais: weak.attempts,
        dernier: weak.lastDay,
      })),
      dernieres: annales.slice(0, 5).map((log) => ({ jour: log.day, matiere: log.subject, resultat: log.result, indices: log.hints })),
    },
  };
}

export type HermesToday = ReturnType<typeof buildHermesToday>;
