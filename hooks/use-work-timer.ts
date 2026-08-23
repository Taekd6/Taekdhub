"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * État persisté d'une séance chronométrée (Timer plein écran ou FocusView).
 * Stocké en sessionStorage pour survivre à un rechargement de page sans
 * survivre à la fermeture de l'onglet — cohérent avec une séance "en cours".
 *
 * Le temps écoulé est dérivé de vrais horodatages (`runningSince`) plutôt
 * que d'un compteur incrémenté en mémoire : ainsi, après un rechargement,
 * le temps réellement passé est restauré fidèlement, y compris le temps
 * écoulé pendant le rechargement lui-même.
 */
interface WorkTimerSnapshot<TContext> {
  /** ISO — instant du tout premier démarrage de cette séance. Devient `WorkSession.started_at`. */
  startedAt: string;
  /** Secondes entières déjà comptabilisées lors des intervalles précédents (hors intervalle en cours). */
  accumulatedSeconds: number;
  /** ISO — instant de début de l'intervalle "running" en cours, ou null si en pause. */
  runningSince: string | null;
  /** Données propres à l'appelant (ex. matière choisie, exercice en focus…), restaurées avec le timer. */
  context: TContext;
}

export interface WorkTimerResult<TContext> {
  /** Secondes écoulées, mises à jour chaque seconde tant que le timer tourne. */
  seconds: number;
  running: boolean;
  /** ISO du début de séance, ou null si aucune séance n'est en cours. */
  startedAt: string | null;
  context: TContext;
  setContext: (context: TContext) => void;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  /**
   * Termine la séance : calcule le temps exact écoulé (indépendamment du
   * dernier tick affiché), efface l'état persisté, puis — s'il y a eu au
   * moins une seconde d'enregistrée — appelle `onComplete` avec le résultat
   * exact. Aucun effet si aucune séance n'était en cours.
   */
  stop: (onComplete?: (result: { startedAt: string; seconds: number }) => void) => void;
}

function readSnapshot<TContext>(storageKey: string): WorkTimerSnapshot<TContext> | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkTimerSnapshot<TContext>;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

function computeElapsedSeconds(snapshot: WorkTimerSnapshot<unknown> | null): number {
  if (!snapshot) return 0;
  const runningExtra = snapshot.runningSince ? Math.floor((Date.now() - new Date(snapshot.runningSince).getTime()) / 1000) : 0;
  return snapshot.accumulatedSeconds + Math.max(0, runningExtra);
}

/**
 * Une seule séance focus à la fois : la clé encode l'exercice concerné, ce
 * qui permet de retrouver après un rechargement lequel reprendre
 * automatiquement. Définie ici (plutôt que dans focus-view.tsx, son unique
 * consommateur historique) pour que dashboard-overview.tsx puisse détecter
 * une séance focus interrompue sans importer tout le composant `FocusView`
 * (RichMath, pickers…) juste pour cette constante.
 */
export const FOCUS_TIMER_PREFIX = "prepahub:timer:focus:";

/**
 * Cherche, sans s'abonner, une clé sessionStorage commençant par `prefix` et
 * renvoie la partie qui suit (ex. l'identifiant encodé dans la clé). Utile
 * pour détecter — avant même de monter le composant concerné — qu'une séance
 * a été interrompue par un rechargement et doit être reprise automatiquement
 * (ex. rouvrir le FocusView de l'exercice dont la clé `prepahub:timer:focus:<id>`
 * est encore présente).
 */
export function findPersistedSessionSuffix(prefix: string): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) return key.slice(prefix.length);
  }
  return null;
}

/**
 * Timer chronométré avec persistance automatique en sessionStorage :
 * un rechargement de page restaure le temps écoulé et reprend la séance si
 * elle était en cours. Partagé par components/timer.tsx et
 * components/exercises/focus-view.tsx pour éviter deux implémentations du
 * même mécanisme.
 *
 * `storageKey` doit être stable et unique pour le contexte d'usage (deux
 * timers avec la même clé partageraient leur état).
 */
export function useWorkTimer<TContext>(storageKey: string, initialContext: TContext): WorkTimerResult<TContext> {
  const [snapshot, setSnapshot] = useState<WorkTimerSnapshot<TContext> | null>(null);
  const [context, setContextState] = useState<TContext>(initialContext);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const restored = readSnapshot<TContext>(storageKey);
    if (!restored) return;
    setSnapshot(restored);
    setContextState(restored.context);
    setSeconds(computeElapsedSeconds(restored));
    // Restauration au montage uniquement : on ne veut pas ré-écraser une
    // séance en cours si la clé change en cours de vie du composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!snapshot) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    if (!snapshot.runningSince) return;
    const id = setInterval(() => setSeconds(computeElapsedSeconds(snapshot)), 1000);
    return () => clearInterval(id);
  }, [snapshot, storageKey]);

  const setContext = useCallback((next: TContext) => {
    setContextState(next);
    setSnapshot((prev) => (prev ? { ...prev, context: next } : prev));
  }, []);

  // Garde anti double-clic pour `stop()` (voir sa doc) — réarmée uniquement
  // quand une séance VRAIMENT nouvelle démarre (branche `!prev` ci-dessous),
  // jamais à la fin de `stop()` lui-même : deux appels à `stop()` déclenchés
  // par deux clics rapprochés doivent rester bloqués tant qu'aucune nouvelle
  // séance n'a repris, pas seulement le temps d'un cycle de rendu.
  const stoppedRef = useRef(false);

  const start = useCallback(() => {
    setSnapshot((prev) => {
      const now = new Date().toISOString();
      if (!prev) {
        stoppedRef.current = false;
        return { startedAt: now, accumulatedSeconds: 0, runningSince: now, context };
      }
      if (prev.runningSince) return prev;
      return { ...prev, runningSince: now };
    });
  }, [context]);

  const pause = useCallback(() => {
    setSnapshot((prev) => {
      if (!prev || !prev.runningSince) return prev;
      const accumulatedSeconds = prev.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(prev.runningSince).getTime()) / 1000));
      return { ...prev, accumulatedSeconds, runningSince: null };
    });
  }, []);

  const running = Boolean(snapshot?.runningSince);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, start, pause]);

  /**
   * Contrairement à `start`/`pause` (qui décident via l'updater fonctionnel
   * de `setSnapshot`, donc toujours sûrs même appelés plusieurs fois avant un
   * re-rendu), `stop` lit `snapshot` directement depuis la closure pour
   * calculer `finalSeconds` et appeler `onComplete` — un effet de bord, pas
   * une simple mise à jour d'état. Deux clics rapprochés sur "Terminer" (ex.
   * double-clic, ou clic + Entrée) déclenchent alors DEUX appels à `stop()`
   * avant que React n'ait eu le temps de re-rendre avec `snapshot = null` :
   * les deux verraient le même `snapshot` non nul et appelleraient
   * `onComplete` chacun — pour le Timer libre (components/timer.tsx), qui
   * enregistre directement une `WorkSession` dans `onComplete`, cela créait
   * DEUX séances dupliquées pour la même plage horaire (impact direct sur le
   * streak, la heatmap et les statistiques). `stoppedRef` bloque tout appel
   * supplémentaire tant qu'aucune nouvelle séance n'a été démarrée (voir
   * `start`), indépendamment du moment où React re-rend.
   */
  const stop = useCallback(
    (onComplete?: (result: { startedAt: string; seconds: number }) => void) => {
      if (stoppedRef.current) return;
      if (!snapshot) return;
      stoppedRef.current = true;
      const finalSeconds = computeElapsedSeconds(snapshot);
      if (finalSeconds > 0 && onComplete) onComplete({ startedAt: snapshot.startedAt, seconds: finalSeconds });
      // Nettoyage immédiat et synchrone : on ne peut pas compter sur l'effet
      // de persistance pour réagir à `snapshot === null`, car l'appelant
      // (ex. FocusView) démonte souvent le composant dans la même mise à
      // jour (onClose juste après stop()), avant que cet effet ne rejoue.
      if (typeof window !== "undefined") sessionStorage.removeItem(storageKey);
      setSnapshot(null);
      setSeconds(0);
    },
    [snapshot, storageKey]
  );

  return {
    seconds,
    running,
    startedAt: snapshot?.startedAt ?? null,
    context,
    setContext,
    start,
    pause,
    toggle,
    stop,
  };
}
