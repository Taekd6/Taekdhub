"use client";

import { useCallback, useEffect, useState } from "react";
import { lastStorageWriteFailure, localData, type Chapter, type Preferences, type WeekSnapshot } from "@/lib/storage";
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

function readAll(): Omit<DataState, "ready" | "writeFailedAt"> {
  const exercises = localData.exercises();
  const sessions = localData.sessions();
  const weekSnapshots = ensureWeekSnapshot(exercises, sessions, localData.weekSnapshots());

  return {
    sessions,
    exercises,
    chapters: localData.chapters(),
    weekSnapshots,
    lastBackupAt: localData.lastBackupAt(),
    preferences: localData.preferences(),
  };
}

export function usePrepahubData() {
  const [data, setData] = useState<DataState>({
    sessions: [],
    exercises: [],
    chapters: [],
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

  const saveChapters = useCallback((chapters: Chapter[]) => {
    localData.saveChapters(chapters);
    setData((prev) => ({ ...prev, chapters, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    setData((prev) => ({ ...prev, preferences, writeFailedAt: lastStorageWriteFailure()?.at ?? null }));
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, saveChapters, savePreferences };
}
