"use client";

import { useCallback, useEffect, useState } from "react";
import { localData, type Chapter, type Preferences, type WeekSnapshot } from "@/lib/storage";
import { loadSeedBank, reconcileSeedBank, SEED_CONTENT_VERSION, SEED_FLAG_KEY, SEED_VERSION_KEY } from "@/lib/seed";
import { captureWeekSnapshot, findMissingSnapshotWeekStart } from "@/lib/week-snapshot";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Amorce la banque au tout premier lancement (voir lib/seed.ts). Idempotent
 * et non destructif :
 * - marqueur déjà posé → ne fait rien (même si l'utilisateur a vidé sa banque
 *   depuis : sa décision est respectée) ;
 * - données déjà présentes (utilisateur existant / import manuel / sauvegarde
 *   restaurée) → pose juste le marqueur, sans rien écraser ;
 * - stockage vide → charge la banque groupée, puis pose le marqueur.
 *   En cas d'échec (réseau/chunk), le marqueur n'est PAS posé → nouvel essai
 *   au prochain montage.
 */
async function maybeSeedBank(): Promise<void> {
  if (typeof window === "undefined") return;

  if (!localStorage.getItem(SEED_FLAG_KEY)) {
    if (localData.exercises().length > 0) {
      localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
      localStorage.setItem(SEED_VERSION_KEY, String(SEED_CONTENT_VERSION));
      return;
    }
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

  // Banque déjà amorcée, mais à une version antérieure du contenu : on la
  // rattrape. Sans cela, la banque d'un élève restait figée sur la version du
  // jour de sa première visite — un élève arrivé quand elle comptait 176
  // fiches SANS énoncé n'a jamais vu les 404 énoncés ajoutés depuis, et sa
  // séance affichait « aucun énoncé renseigné », définitivement.
  const applied = Number(localStorage.getItem(SEED_VERSION_KEY) ?? 0);
  if (applied >= SEED_CONTENT_VERSION) return;
  try {
    const seed = await loadSeedBank();
    if (seed.exercises.length === 0) return;
    const merged = reconcileSeedBank(localData.exercises(), localData.chapters(), seed);
    localData.saveChapters(merged.chapters);
    localData.saveExercises(merged.exercises);
    localStorage.setItem(SEED_VERSION_KEY, String(SEED_CONTENT_VERSION));
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

// Cette app appelle `usePrepahubData()` séparément dans une dizaine de
// composants (Dashboard, SessionRunner, ExerciseManager, AppSidebar…),
// chacun avec son PROPRE `useState` — aucun store partagé. L'évènement DOM
// "storage" ne rattrapait que les AUTRES onglets : il ne se déclenche
// jamais dans l'onglet qui vient d'écrire. Un composant qui reste monté
// pendant toute la navigation interne (la sidebar, via le layout partagé)
// ne se remonte donc jamais après une écriture faite ailleurs dans le même
// onglet — bug réel trouvé en rejouant une séance de bout en bout : l'XP
// gagnée s'affichait bien dans l'écran de fin de séance (qui tient sa
// propre instance à jour), mais le total "Niveau / XP" de la sidebar
// restait figé sur sa valeur du premier montage jusqu'au rechargement
// complet de la page. Ce petit registre partagé au niveau du module
// notifie TOUTES les instances montées, y compris celle qui vient
// d'écrire, dès qu'une sauvegarde a lieu où que ce soit dans l'onglet.
const instanceRefreshers = new Set<() => void>();
function notifyAllInstances() {
  instanceRefreshers.forEach((refresh) => refresh());
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
    // Amorçage éventuel AVANT le premier `refresh` : `ready` ne passe à vrai
    // qu'une fois la banque chargée, pour éviter un flash de page vide au
    // tout premier lancement.
    maybeSeedBank().finally(() => {
      if (!cancelled) refresh();
    });

    function onStorage(event: StorageEvent) {
      if (event.key?.startsWith("prepahub:")) refresh();
    }
    window.addEventListener("storage", onStorage);
    instanceRefreshers.add(refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      instanceRefreshers.delete(refresh);
    };
  }, [refresh]);

  const saveSessions = useCallback((sessions: WorkSession[]) => {
    localData.saveSessions(sessions);
    notifyAllInstances();
  }, []);

  const saveExercises = useCallback((exercises: Exercise[]) => {
    localData.saveExercises(exercises);
    notifyAllInstances();
  }, []);

  const saveChapters = useCallback((chapters: Chapter[]) => {
    localData.saveChapters(chapters);
    notifyAllInstances();
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    notifyAllInstances();
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, saveChapters, savePreferences };
}
