"use client";

import { useCallback, useEffect, useState } from "react";
import { DATA_WRITTEN_EVENT, localData, STORAGE_ERROR_EVENT, type Chapter, type Preferences, type WeekSnapshot } from "@/lib/storage";
import { CAHIER_CALCUL_SEED_FLAG_KEY, loadCahierCalculSeed, loadSeedBank, SEED_FLAG_KEY } from "@/lib/seed";
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
    // Amorçage best-effort : en cas d'échec, réessai au prochain montage.
  }
}

/**
 * Ajoute le pack Cahier de calcul (122 calculs) une seule fois, à n'importe
 * quel moment de la vie d'un utilisateur — contrairement à `maybeSeedBank`
 * ci-dessus, ne dépend PAS d'un stockage vide : un utilisateur déjà actif
 * (banque de base déjà amorcée, `SEED_FLAG_KEY` déjà posé) doit recevoir ce
 * pack tout autant qu'un tout nouvel utilisateur, exactement une fois.
 * Idempotent et non destructif, mêmes garanties que `maybeSeedBank` :
 * - marqueur déjà posé → ne fait rien (même si l'utilisateur a supprimé ces
 *   exercices depuis : sa décision est respectée) ;
 * - pack déjà présent (import manuel antérieur du même fichier, détecté via
 *   `external_id` préfixé "CDC-") → pose juste le marqueur, sans doublonner ;
 * - sinon → charge le pack fusionné sur les chapitres actuels, l'ajoute aux
 *   exercices existants, puis pose le marqueur.
 *   En cas d'échec (réseau/chunk), le marqueur n'est PAS posé → nouvel essai
 *   au prochain montage.
 */
async function maybeSeedCahierCalcul(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CAHIER_CALCUL_SEED_FLAG_KEY)) return;
  const currentExercises = localData.exercises();
  if (currentExercises.some((exercise) => exercise.external_id?.startsWith("CDC-"))) {
    localStorage.setItem(CAHIER_CALCUL_SEED_FLAG_KEY, new Date().toISOString());
    return;
  }
  try {
    const { exercises, chapters } = await loadCahierCalculSeed(localData.chapters());
    if (exercises.length === 0) return;
    localData.saveChapters(chapters);
    localData.saveExercises([...currentExercises, ...exercises]);
    localStorage.setItem(CAHIER_CALCUL_SEED_FLAG_KEY, new Date().toISOString());
  } catch {
    // Amorçage best-effort : en cas d'échec, réessai au prochain montage.
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

  /**
   * `true` dès qu'une écriture `localStorage` échoue (quota dépassé,
   * navigation privée, stockage désactivé…) — voir `lib/storage.ts#safeSetItem`.
   * Consommé par `components/storage-error-banner.tsx` (monté une seule fois
   * dans `AppShell`, donc visible quelle que soit la page où l'échec
   * survient). État volontairement séparé de `data` ci-dessus : `refresh()`
   * remplace `data` en bloc à chaque relecture (voir plus haut), ce qui
   * effacerait silencieusement une erreur en cours si elle vivait dedans.
   */
  const [storageError, setStorageError] = useState(false);
  const dismissStorageError = useCallback(() => setStorageError(false), []);

  useEffect(() => {
    let cancelled = false;
    // Amorçage éventuel AVANT le premier `refresh` : `ready` ne passe à vrai
    // qu'une fois la banque chargée, pour éviter un flash de page vide au
    // tout premier lancement. Séquentiel (pas Promise.all) : le pack Cahier
    // de calcul doit voir les chapitres éventuellement créés par la banque de
    // base sur ce même montage (utilisateur tout neuf) avant de fusionner
    // les siens.
    maybeSeedBank()
      .then(() => maybeSeedCahierCalcul())
      .finally(() => {
        if (!cancelled) refresh();
      });

    function onStorage(event: StorageEvent) {
      if (event.key?.startsWith("prepahub:")) refresh();
    }
    // Reflète le résultat de CHAQUE tentative d'écriture, qu'elle vienne de
    // cette instance du hook ou d'une autre (voir `broadcastWriteResult`
    // ci-dessous et la doc de `STORAGE_ERROR_EVENT` dans lib/storage.ts) —
    // un succès ailleurs efface aussi l'alerte ici : si les écritures
    // fonctionnent de nouveau, le problème est résolu partout à la fois.
    function onStorageResult(event: Event) {
      setStorageError(!(event as CustomEvent<{ ok: boolean }>).detail.ok);
    }
    // Synchronisation intra-onglet (voir `DATA_WRITTEN_EVENT`, lib/storage.ts) :
    // une écriture réussie dans CETTE instance (ou une autre du même onglet)
    // déclenche une simple relecture ici — jamais une écriture. `refresh()`
    // ne fait que lire `localStorage`, donc aucune boucle possible : cet
    // écouteur ne peut jamais lui-même redéclencher `DATA_WRITTEN_EVENT`.
    function onDataWritten() {
      refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageResult);
    window.addEventListener(DATA_WRITTEN_EVENT, onDataWritten);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STORAGE_ERROR_EVENT, onStorageResult);
      window.removeEventListener(DATA_WRITTEN_EVENT, onDataWritten);
    };
  }, [refresh]);

  // Les 4 callbacks ci-dessous partagent le même principe : n'appliquer l'état
  // optimiste à `data` QUE si l'écriture a réellement réussi — sinon `data`
  // resterait en avance sur ce qui est vraiment persisté, et un rechargement
  // (ou un autre onglet) ferait silencieusement disparaître le changement que
  // l'utilisateur croyait avoir enregistré. Le résultat est aussi diffusé via
  // `STORAGE_ERROR_EVENT` (voir l'écouteur ci-dessus) : `usePrepahubData()`
  // n'est qu'un simple hook, pas un contexte React, donc chaque composant qui
  // l'appelle a son propre état local — sans ce signal, un échec détecté
  // dans, par exemple, `ExerciseManager` n'atteindrait jamais
  // `StorageErrorBanner`, monté séparément dans `AppShell`.
  const broadcastWriteResult = (ok: boolean) => {
    setStorageError(!ok);
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { ok } }));
  };

  // Synchronisation intra-onglet (voir `DATA_WRITTEN_EVENT`, lib/storage.ts) :
  // appelé uniquement après une écriture RÉUSSIE, jamais après un échec (rien
  // à relire ailleurs si rien n'a changé). Diffusé APRÈS la mise à jour
  // optimiste de cette instance : les autres instances du même onglet
  // (ex. la sidebar) relisent alors `localStorage`, qui contient déjà la
  // même donnée que celle que cette instance vient d'appliquer localement.
  const broadcastDataWritten = () => {
    window.dispatchEvent(new Event(DATA_WRITTEN_EVENT));
  };

  const saveSessions = useCallback((sessions: WorkSession[]) => {
    const ok = localData.saveSessions(sessions);
    broadcastWriteResult(ok);
    if (ok) {
      setData((prev) => ({ ...prev, sessions }));
      broadcastDataWritten();
    }
  }, []);

  const saveExercises = useCallback((exercises: Exercise[]) => {
    const ok = localData.saveExercises(exercises);
    broadcastWriteResult(ok);
    if (ok) {
      setData((prev) => ({ ...prev, exercises }));
      broadcastDataWritten();
    }
  }, []);

  const saveChapters = useCallback((chapters: Chapter[]) => {
    const ok = localData.saveChapters(chapters);
    broadcastWriteResult(ok);
    if (ok) {
      setData((prev) => ({ ...prev, chapters }));
      broadcastDataWritten();
    }
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    const ok = localData.savePreferences(preferences);
    broadcastWriteResult(ok);
    if (ok) {
      setData((prev) => ({ ...prev, preferences }));
      broadcastDataWritten();
    }
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, saveChapters, savePreferences, storageError, dismissStorageError };
}
