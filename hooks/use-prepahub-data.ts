"use client";

import { useCallback, useEffect, useState } from "react";
import { localData, type Chapter, type Preferences, type WeekSnapshot } from "@/lib/storage";
import { loadSeedBank, SEED_FLAG_KEY } from "@/lib/seed";
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
async function seedBankOnce(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG_KEY)) return;
  if (localData.exercises().length > 0) {
    localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
    return;
  }
  try {
    const { exercises, chapters } = await loadSeedBank();
    if (exercises.length === 0) return;
    localData.saveChapters(chapters);
    localData.saveExercises(exercises);
    localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString());
  } catch {
    // Amorçage best-effort : en cas d'échec, réessai au prochain appel — voir
    // la remise à `null` de `seedPromise` ci-dessous, dans `maybeSeedBank`.
    throw new Error("seed-failed");
  }
}

/**
 * Verrou au niveau module (PAS un `useRef` — un `useRef` est propre à CHAQUE
 * instance du hook, donc inutile ici) : `usePrepahubData` est appelé
 * indépendamment par une bonne dizaine de composants (sidebar, Dashboard,
 * BackupReminder, ThemeSync…), souvent plusieurs simultanément sur la même
 * page. Sans ce verrou partagé, chaque instance montée en même temps
 * exécutait ses propres vérifications synchrones (`localStorage.getItem`,
 * `localData.exercises().length`) AVANT que `await loadSeedBank()` de l'une
 * quelconque d'entre elles n'ait eu le temps d'écrire quoi que ce soit —
 * React exécute les effets de montage de plusieurs composants les uns après
 * les autres, mais tous AVANT le premier `await` de chacun. Résultat réel
 * observé au premier lancement : plusieurs amorçages concurrents, chacun
 * générant ses propres identifiants (`crypto.randomUUID()`) pour les mêmes
 * exercices — la dernière écriture l'emportait dans localStorage, mais les
 * instances déjà « refresh » entre-temps gardaient en mémoire React des
 * exercices aux identifiants différents de ce qui restait réellement stocké.
 * Un seul verrou partagé garantit qu'un seul amorçage réel a lieu, quel que
 * soit le nombre d'instances montées en même temps — et rend accessoirement
 * l'effet idempotent face au double appel de React Strict Mode en
 * développement (la seconde invocation réutilise la même promesse).
 */
let seedPromise: Promise<void> | null = null;

/** Exportée uniquement pour que hooks/use-prepahub-data.test.ts puisse vérifier directement la protection contre le montage simultané de plusieurs instances — jamais appelée ailleurs que dans l'effet de montage ci-dessous. */
export async function maybeSeedBank(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!seedPromise) {
    seedPromise = seedBankOnce().catch(() => {
      // Échec réel (réseau/chunk) : on libère le verrou pour qu'un prochain
      // montage (nouvelle navigation, nouvel onglet) puisse retenter —
      // comportement documenté ci-dessus, inchangé par ce correctif.
      seedPromise = null;
    });
  }
  return seedPromise;
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
