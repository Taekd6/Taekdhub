"use client";

import { useCallback, useEffect, useState } from "react";
import { type ChapterMemory } from "@/lib/storage"; // mémoire des chapitres (FSRS)
import { lastStorageWriteFailure, localData, purgeRetiredBankData, type DayPlanRecord, type ErrorEntry, type Grade, type Preferences, type ReviewItem, type WeekSnapshot, type WorkItem, type DailyCheckin } from "@/lib/storage";
import { buildWeeklyPlan } from "@/lib/planning";
import { dayKey } from "@/lib/study";
import { captureWeekSnapshot, findMissingSnapshotWeekStart } from "@/lib/week-snapshot";
import type { WorkSession } from "@/lib/supabase/types";

type DataState = {
  sessions: WorkSession[];
  /** Travaux planifiés et échéances saisis par l'élève — voir `WorkItem` (lib/storage.ts). */
  workItems: WorkItem[];
  /** Résultats scolaires saisis par l'élève — voir `Grade` (lib/storage.ts). */
  grades: Grade[];
  /** Intentions de planning passées — voir `DayPlanRecord` (lib/storage.ts). */
  dayPlans: DayPlanRecord[];
  /** Carnet « À revoir » : notions à revoir, à apprendre, et cartouches de méthode — voir `ReviewItem` (lib/storage.ts). */
  reviewItems: ReviewItem[];
  /** Carnet d'erreurs — voir `ErrorEntry` (lib/storage.ts). */
  errors: ErrorEntry[];
  /** Check-in du soir (sommeil, énergie, stress) — voir `DailyCheckin` (lib/storage.ts). */
  checkins: DailyCheckin[];
  /** Mémoire des chapitres (FSRS) — voir `ChapterMemory` (lib/storage.ts). */
  chapterMemory: ChapterMemory[];
  weekSnapshots: WeekSnapshot[];
  lastBackupAt: string | null;
  preferences: Preferences;
  ready: boolean;
  /**
   * Horodatage de la dernière écriture REFUSÉE par le navigateur (quota
   * dépassé, stockage bloqué) — `null` tant que tout passe. Voir
   * lib/storage.ts#writeKey : sans ce signal, un quota atteint faisait
   * disparaître les résultats déclarés en silence, l'élève croyant les avoir
   * enregistrés.
   */
  writeFailedAt: string | null;
};

/**
 * Fige automatiquement la semaine précédente si elle ne l'est pas déjà
 * (Sprint 5) — vérification idempotente : relit `weekSnapshots` à chaque
 * appel et ne réagit que si `findMissingSnapshotWeekStart` la juge
 * manquante, donc jamais de doublon même appelée à chaque montage/onglet.
 */
function ensureWeekSnapshot(sessions: WorkSession[], weekSnapshots: WeekSnapshot[]): WeekSnapshot[] {
  const missingWeekStart = findMissingSnapshotWeekStart(sessions, weekSnapshots);
  if (!missingWeekStart) return weekSnapshots;
  const snapshot = captureWeekSnapshot(sessions, missingWeekStart);
  const next = [...weekSnapshots, snapshot];
  localData.saveWeekSnapshots(next);
  return next;
}

/**
 * Enregistre, une fois pour toutes, ce que le planning prévoit pour DEMAIN.
 *
 * Voir `DayPlanRecord` (lib/storage.ts) pour le raisonnement complet. En
 * résumé : le planning n'est pas persisté, donc une fois la journée passée
 * plus rien ne dit ce qui y était prévu — et « est-ce que je réalise ce que
 * je planifie ? » devient sans réponse. Un seul nombre par jour y suffit.
 *
 * DEMAIN, et pas aujourd'hui : capté le jour même, le nombre serait déjà
 * amputé du travail déjà fait (la capacité du jour diminue à mesure qu'on
 * travaille), et une journée ouverte le soir afficherait « 300 % réalisé ».
 * La veille, la journée est intacte.
 *
 * Idempotent : un jour déjà enregistré n'est JAMAIS réécrit — une intention
 * qu'on révise après coup ne sert plus de point de comparaison.
 */
function ensureTomorrowPlanRecord(
  workItems: WorkItem[],
  sessions: WorkSession[],
  preferences: Preferences,
  records: DayPlanRecord[]
): DayPlanRecord[] {
  if (workItems.length === 0) return records;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = dayKey(tomorrow);
  if (records.some((record) => record.date === key)) return records;

  const plan = buildWeeklyPlan(workItems, sessions, preferences, now);
  const day = plan.days.find((entry) => entry.date === key);
  if (!day) return records;

  const next = [...records, { date: key, plannedMinutes: day.load.plannedMinutes, capturedAt: now.toISOString() }];
  localData.saveDayPlans(next);
  return next;
}

function readAll(): Omit<DataState, "ready" | "writeFailedAt"> {
  const sessions = localData.sessions();
  const workItems = localData.workItems();
  const preferences = localData.preferences();
  const weekSnapshots = ensureWeekSnapshot(sessions, localData.weekSnapshots());

  return {
    sessions,
    workItems,
    grades: localData.grades(),
    dayPlans: ensureTomorrowPlanRecord(workItems, sessions, preferences, localData.dayPlans()),
    reviewItems: localData.reviewItems(),
    errors: localData.errors(),
    checkins: localData.checkins(),
    chapterMemory: localData.chapterMemory(),
    weekSnapshots,
    lastBackupAt: localData.lastBackupAt(),
    preferences,
  };
}

export function usePrepahubData() {
  const [data, setData] = useState<DataState>({
    sessions: [],
    workItems: [],
    grades: [],
    dayPlans: [],
    reviewItems: [],
    errors: [],
    checkins: [],
    chapterMemory: [],
    weekSnapshots: [],
    lastBackupAt: null,
    preferences: localData.preferences(),
    ready: false,
    writeFailedAt: null,
  });

  const refresh = useCallback(() => {
    setData({ ...readAll(), ready: true, writeFailedAt: lastStorageWriteFailure()?.at ?? null });
  }, []);

  useEffect(() => {
    // Ménage AVANT la première lecture : efface, sur un appareil qui l'avait
    // encore, l'ancienne banque d'exercices (≈ 2,8 Mo de quota rendus à
    // l'élève). Sans effet dès la deuxième fois — voir
    // lib/storage.ts#purgeRetiredBankData.
    purgeRetiredBankData();
    refresh();

    function onStorage(event: StorageEvent) {
      if (event.key?.startsWith("prepahub:")) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  /**
   * Écritures INCRÉMENTALES (une séance de plus) :
   * fusionnées avec ce qui est réellement sur le disque plutôt qu'écrites en
   * remplacement — voir lib/storage.ts#mergeById pour le scénario de perte
   * totale que cela ferme. L'état React reçoit la liste RÉELLEMENT
   * enregistrée, jamais celle qu'on croyait écrire.
   */
  const saveSessions = useCallback((sessions: WorkSession[]) => {
    const stored = localData.mergeSessions(sessions);
    setData((prev) => ({ ...prev, sessions: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /** Suppression d'une séance — voir `localData.removeSession` : la fusion de `saveSessions` ne retire jamais rien. */
  const removeSession = useCallback((id: string) => {
    const stored = localData.removeSession(id);
    setData((prev) => ({ ...prev, sessions: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /**
   * Écriture incrémentale, comme les séances : un travail
   * n'est jamais retiré de la liste (il passe au statut « abandonné »), donc
   * la fusion par identifiant reste correcte — voir lib/storage.ts#mergeStored.
   */
  const saveWorkItems = useCallback((workItems: WorkItem[]) => {
    const stored = localData.mergeWorkItems(workItems);
    setData((prev) => ({ ...prev, workItems: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /**
   * REMPLACEMENT, pas fusion — contrairement aux séances et aux travaux.
   * Une note SE SUPPRIME : on saisit 14 au lieu de 4, on corrige. Une
   * fusion par identifiant ressusciterait la note effacée depuis une copie
   * React périmée.
   */
  const saveGrades = useCallback((grades: Grade[]) => {
    localData.saveGrades(grades);
    setData((prev) => ({ ...prev, grades, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /**
   * REMPLACEMENT, pour la même raison que `saveGrades` : une entrée du carnet
   * se supprime, et une fusion par identifiant la ressusciterait. Le prix de
   * ce choix est connu et accepté — une copie React PÉRIMÉE qui écrirait
   * effacerait ce qu'une autre a ajouté. C'est pourquoi un seul composant
   * par écran appelle le hook et passe `reviewItems`/`saveReviewItems` à ses
   * enfants (voir components/review/review-capture.tsx), plutôt que chaque
   * enfant ouvre sa propre copie.
   *
   * Écriture refusée (quota) : l'état reçoit ce qui est RÉELLEMENT sur le
   * disque, pas la liste voulue — sinon la ligne s'afficherait comme notée
   * et disparaîtrait au rechargement, exactement ce que `merge*` a appris à
   * éviter (voir lib/storage.ts#mergeAndStore).
   */
  const saveReviewItems = useCallback((reviewItems: ReviewItem[]) => {
    const written = localData.saveReviewItems(reviewItems);
    const stored = written ? reviewItems : localData.reviewItems();
    setData((prev) => ({ ...prev, reviewItems: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /* ── Carnet d'erreurs ──────────────────────────────────────────────
     REMPLACEMENT, exactement comme `saveReviewItems` et pour les mêmes
     raisons : une erreur se supprime, et une écriture refusée renvoie ce qui
     est RÉELLEMENT sur le disque. Un seul appelant du hook par écran
     (components/errors/error-log.tsx). */
  const saveErrors = useCallback((errors: ErrorEntry[]) => {
    const written = localData.saveErrors(errors);
    const stored = written ? errors : localData.errors();
    setData((prev) => ({ ...prev, errors: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);
  /* ── fin carnet d'erreurs ── */
  /* ── Check-in du soir ──
   * REMPLACEMENT de la liste déjà mise à jour par
   * lib/checkin-insights.ts#upsertCheckin (un check-in par jour, qui se
   * corrige). Écriture refusée : l'état reçoit ce qui est RÉELLEMENT sur le
   * disque, même règle que `saveReviewItems`. */
  const saveCheckins = useCallback((checkins: DailyCheckin[]) => {
    const written = localData.saveCheckins(checkins);
    const stored = written ? checkins : localData.checkins();
    setData((prev) => ({ ...prev, checkins: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /* ── Mémoire des chapitres (FSRS) ──
   * REMPLACEMENT, même règle que `saveReviewItems` : écriture refusée ⇒
   * l'état reçoit ce qui est RÉELLEMENT sur le disque. */
  const saveChapterMemory = useCallback((chapterMemory: ChapterMemory[]) => {
    const written = localData.saveChapterMemory(chapterMemory);
    const stored = written ? chapterMemory : localData.chapterMemory();
    setData((prev) => ({ ...prev, chapterMemory: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);
  /* ── fin mémoire des chapitres ── */

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    setData((prev) => ({ ...prev, preferences, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  return { ...data, refresh, saveSessions, removeSession, saveWorkItems, saveGrades, saveReviewItems, saveErrors, saveCheckins, saveChapterMemory, savePreferences };
}
