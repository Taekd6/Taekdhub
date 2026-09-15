"use client";

import { useCallback, useEffect, useState } from "react";
import { lastStorageWriteFailure, localData, type Chapter, type DayPlanRecord, type Grade, type Preferences, type WeekSnapshot, type WorkItem } from "@/lib/storage";
import { buildWeeklyPlan } from "@/lib/planning";
import { dayKey } from "@/lib/study";
import { loadSeedBank, reconcileSeedBank, SEED_CONTENT_VERSION, SEED_FLAG_KEY, SEED_VERSION_KEY } from "@/lib/seed";
import { captureWeekSnapshot, findMissingSnapshotWeekStart } from "@/lib/week-snapshot";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Amorce et met à jour la banque locale sans écraser la progression de l'élève.
 * Une banque existante sans version (cas des anciennes installations) doit
 * passer par la réconciliation : poser directement la version courante ici
 * ferait croire que les nouveaux exercices ont déjà été appliqués.
 */
async function maybeSeedBank(): Promise<void> {
  if (typeof window === "undefined") return;

  const hasSeedFlag = Boolean(localStorage.getItem(SEED_FLAG_KEY));
  const localExercises = localData.exercises();

  if (!hasSeedFlag && localExercises.length === 0) {
    try {
      const { exercises, chapters } = await loadSeedBank();
      if (exercises.length === 0) return;
      // La banque D'ABORD, et on n'écrit les chapitres/drapeaux que si elle
      // est réellement passée. `localStorage.setItem` peut être refusé
      // (quota : la banque pèse ~2,3 Mo en UTF-16 sur un budget de 5 Mo,
      // voir lib/storage.ts#writeKey) ; l'ordre inverse laissait 84
      // chapitres enregistrés SANS un seul exercice, et l'ancien `catch {}`
      // rendait l'échec totalement invisible.
      if (!localData.saveExercises(exercises)) return;
      localData.saveChapters(chapters);
      localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
      localStorage.setItem(SEED_VERSION_KEY, String(SEED_CONTENT_VERSION));
    } catch {
      // Amorçage best-effort : en cas d'échec, réessai au prochain montage.
    }
    return;
  }

  // Banque existante (y compris une ancienne installation sans version) :
  // on applique réellement toute version de contenu manquante. La
  // réconciliation préserve la progression, les favoris, les notes et les IDs.
  const applied = Number(localStorage.getItem(SEED_VERSION_KEY) ?? 0);
  if (applied >= SEED_CONTENT_VERSION) return;

  try {
    const seed = await loadSeedBank();
    if (seed.exercises.length === 0) return;
    const merged = reconcileSeedBank(localExercises, localData.chapters(), seed);
    // Même règle qu'à l'amorçage : la version de contenu n'est marquée comme
    // appliquée que si la banque réconciliée a VRAIMENT été écrite. Sinon on
    // aurait perdu la réconciliation tout en jurant qu'elle a eu lieu.
    if (!localData.saveExercises(merged.exercises)) return;
    localData.saveChapters(merged.chapters);
    localStorage.setItem(SEED_VERSION_KEY, String(SEED_CONTENT_VERSION));
    if (!hasSeedFlag) localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
  } catch {
    // Même règle que l'amorçage : en cas d'échec, on retentera au prochain montage.
  }
}

type DataState = {
  sessions: WorkSession[];
  exercises: Exercise[];
  chapters: Chapter[];
  /** Travaux planifiés et échéances saisis par l'élève — voir `WorkItem` (lib/storage.ts). */
  workItems: WorkItem[];
  /** Résultats scolaires saisis par l'élève — voir `Grade` (lib/storage.ts). */
  grades: Grade[];
  /** Intentions de planning passées — voir `DayPlanRecord` (lib/storage.ts). */
  dayPlans: DayPlanRecord[];
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
function ensureWeekSnapshot(exercises: Exercise[], sessions: WorkSession[], weekSnapshots: WeekSnapshot[]): WeekSnapshot[] {
  const missingWeekStart = findMissingSnapshotWeekStart(exercises, sessions, weekSnapshots);
  if (!missingWeekStart) return weekSnapshots;
  const snapshot = captureWeekSnapshot(exercises, sessions, missingWeekStart);
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
  const exercises = localData.exercises();
  const sessions = localData.sessions();
  const workItems = localData.workItems();
  const preferences = localData.preferences();
  const weekSnapshots = ensureWeekSnapshot(exercises, sessions, localData.weekSnapshots());

  return {
    sessions,
    exercises,
    chapters: localData.chapters(),
    workItems,
    grades: localData.grades(),
    dayPlans: ensureTomorrowPlanRecord(workItems, sessions, preferences, localData.dayPlans()),
    weekSnapshots,
    lastBackupAt: localData.lastBackupAt(),
    preferences,
  };
}

export function usePrepahubData() {
  const [data, setData] = useState<DataState>({
    sessions: [],
    exercises: [],
    chapters: [],
    workItems: [],
    grades: [],
    dayPlans: [],
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
    let cancelled = false;
    // Amorçage/migration AVANT le premier `refresh` : `ready` ne passe à vrai
    // qu'une fois la banque chargée ou réconciliée.
    maybeSeedBank().finally(() => {
      if (!cancelled) refresh();
    });

    function onStorage(event: StorageEvent) {
      if (event.key?.startsWith("prepahub:")) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  /**
   * Écritures INCRÉMENTALES (une séance de plus, un exercice modifié) :
   * fusionnées avec ce qui est réellement sur le disque plutôt qu'écrites en
   * remplacement — voir lib/storage.ts#mergeById pour le scénario de perte
   * totale que cela ferme. L'état React reçoit la liste RÉELLEMENT
   * enregistrée, jamais celle qu'on croyait écrire.
   *
   * `saveChapters` reste un remplacement : les chapitres, eux, se
   * SUPPRIMENT (lib/chapters.ts#removeChapter), une fusion y ressusciterait
   * un chapitre que l'élève vient d'effacer.
   */
  const saveSessions = useCallback((sessions: WorkSession[]) => {
    const stored = localData.mergeSessions(sessions);
    setData((prev) => ({ ...prev, sessions: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  const saveExercises = useCallback((exercises: Exercise[]) => {
    const stored = localData.mergeExercises(exercises);
    setData((prev) => ({ ...prev, exercises: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /**
   * Écriture incrémentale, comme les séances et les exercices : un travail
   * n'est jamais retiré de la liste (il passe au statut « abandonné »), donc
   * la fusion par identifiant reste correcte — voir lib/storage.ts#mergeStored.
   */
  const saveWorkItems = useCallback((workItems: WorkItem[]) => {
    const stored = localData.mergeWorkItems(workItems);
    setData((prev) => ({ ...prev, workItems: stored, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  /**
   * REMPLACEMENT, pas fusion — contrairement aux séances, aux exercices et
   * aux travaux. Une note SE SUPPRIME : on saisit 14 au lieu de 4, on
   * corrige. Une fusion par identifiant ressusciterait la note effacée
   * depuis une copie React périmée. Même profil, et même traitement, que
   * `saveChapters` juste en dessous.
   */
  const saveGrades = useCallback((grades: Grade[]) => {
    localData.saveGrades(grades);
    setData((prev) => ({ ...prev, grades, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  const saveChapters = useCallback((chapters: Chapter[]) => {
    localData.saveChapters(chapters);
    setData((prev) => ({ ...prev, chapters, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    setData((prev) => ({ ...prev, preferences, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, saveWorkItems, saveGrades, saveChapters, savePreferences };
}
