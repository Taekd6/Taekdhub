"use client";

import { useCallback, useEffect, useState } from "react";
import { localData, type Chapter, type Preferences, type WeekSnapshot } from "@/lib/storage";
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
      localData.saveChapters(chapters);
      localData.saveExercises(exercises);
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
    localData.saveChapters(merged.chapters);
    localData.saveExercises(merged.exercises);
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

function readAll(): Omit<DataState, "ready"> {
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
  });

  const refresh = useCallback(() => {
    setData({ ...readAll(), ready: true });
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

  const saveSessions = useCallback((sessions: WorkSession[]) => {
    localData.saveSessions(sessions);
    setData((prev) => ({ ...prev, sessions }));
  }, []);

  const saveExercises = useCallback((exercises: Exercise[]) => {
    localData.saveExercises(exercises);
    setData((prev) => ({ ...prev, exercises }));
  }, []);

  const saveChapters = useCallback((chapters: Chapter[]) => {
    localData.saveChapters(chapters);
    setData((prev) => ({ ...prev, chapters }));
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    setData((prev) => ({ ...prev, preferences }));
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, saveChapters, savePreferences };
}
