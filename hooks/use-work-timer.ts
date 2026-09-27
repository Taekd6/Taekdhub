"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addTombstone, isOrphan, parseMirror, parseTombstones, type TimerMirror } from "@/lib/timer-recovery";

/**
 * État persisté d'une séance chronométrée (le Chrono, components/timer.tsx).
 * Stocké en sessionStorage pour survivre à un rechargement de page — une
 * séance en cours appartient à UN onglet. Un MIROIR en localStorage permet
 * en plus de la reprendre si l'onglet disparaît (fermé par erreur, déchargé
 * par le téléphone) : voir lib/timer-recovery.ts.
 *
 * Le temps écoulé est dérivé de vrais horodatages (`runningSince`) plutôt
 * que d'un compteur incrémenté en mémoire : ainsi, après un rechargement,
 * le temps réellement passé est restauré fidèlement, y compris le temps
 * écoulé pendant le rechargement lui-même.
 *
 * STOCKAGE BLOQUÉ (Safari « bloquer tous les cookies », certains modes
 * privés) : chaque accès est protégé. Le chrono fonctionne alors en mémoire
 * seulement, au lieu de faire planter la page.
 */
interface WorkTimerSnapshot<TContext> {
  /** ISO — instant du tout premier démarrage de cette séance. Devient `WorkSession.started_at`. */
  startedAt: string;
  /** Secondes entières déjà comptabilisées lors des intervalles précédents (hors intervalle en cours). */
  accumulatedSeconds: number;
  /** ISO — instant de début de l'intervalle "running" en cours, ou null si en pause. */
  runningSince: string | null;
  /** Données propres à l'appelant (ex. matière choisie, travail rattaché…), restaurées avec le timer. */
  context: TContext;
}

export interface OrphanTimer<TContext> {
  startedAt: string;
  /** Secondes écoulées selon le chrono abandonné, jusqu'à maintenant s'il tournait. */
  seconds: number;
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
   * exact. Aucun effet si aucune séance n'était en cours, ni si un autre
   * onglet a déjà enregistré cette même séance.
   */
  stop: (onComplete?: (result: { startedAt: string; seconds: number }) => void) => void;
  /** Un chrono laissé en cours par un onglet disparu, à reprendre ou à ignorer — `null` sinon. */
  orphan: OrphanTimer<TContext> | null;
  /** Reprend le chrono orphelin dans cet onglet (le temps écoulé depuis compte, comme après un rechargement). */
  adoptOrphan: () => void;
  /** Oublie le chrono orphelin. */
  dismissOrphan: () => void;
}

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // Stockage refusé : le chrono continue en mémoire.
  }
}

function safeRemove(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key);
  } catch {
    // idem
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

/** Battement du miroir tant qu'une séance existe dans l'onglet. */
const HEARTBEAT_MS = 15_000;

function readSnapshot<TContext>(storageKey: string): WorkTimerSnapshot<TContext> | null {
  if (typeof window === "undefined") return null;
  const raw = safeGet(session, storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkTimerSnapshot<TContext>;
  } catch {
    safeRemove(session, storageKey);
    return null;
  }
}

function computeElapsedSeconds(snapshot: WorkTimerSnapshot<unknown> | null): number {
  if (!snapshot) return 0;
  const runningExtra = snapshot.runningSince ? Math.floor((Date.now() - new Date(snapshot.runningSince).getTime()) / 1000) : 0;
  return snapshot.accumulatedSeconds + Math.max(0, runningExtra);
}

/** Identifiant de CET onglet — en sessionStorage, il survit à un rechargement comme le chrono lui-même. */
function readTabId(storageKey: string): string {
  const key = `${storageKey}:tab`;
  const existing = safeGet(session, key);
  if (existing) return existing;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
  safeSet(session, key, id);
  return id;
}

/**
 * Timer chronométré avec persistance automatique en sessionStorage :
 * un rechargement de page restaure le temps écoulé et reprend la séance si
 * elle était en cours. Utilisé par components/timer.tsx ; générique pour que
 * tout futur chronomètre partage le même mécanisme.
 *
 * `storageKey` doit être stable et unique pour le contexte d'usage (deux
 * timers avec la même clé partageraient leur état).
 */
export function useWorkTimer<TContext>(storageKey: string, initialContext: TContext): WorkTimerResult<TContext> {
  const [snapshot, setSnapshot] = useState<WorkTimerSnapshot<TContext> | null>(null);
  const [context, setContextState] = useState<TContext>(initialContext);
  const [seconds, setSeconds] = useState(0);
  const [orphan, setOrphan] = useState<WorkTimerSnapshot<TContext> | null>(null);
  const tabId = useRef<string>("");
  const mirrorKey = `${storageKey}:mirror`;
  const tombstoneKey = `${storageKey}:done`;

  useEffect(() => {
    tabId.current = readTabId(storageKey);
    const restored = readSnapshot<TContext>(storageKey);
    const mirror = parseMirror<WorkTimerSnapshot<TContext>>(safeGet(local, mirrorKey));
    const tombstones = parseTombstones(safeGet(local, tombstoneKey));
    // Pendant que cet onglet était ailleurs dans l'application (chrono non
    // monté, donc sans battement), un autre onglet a pu reprendre ce chrono
    // ou le terminer : alors il n'est plus à nous.
    const takenElsewhere = restored && ((mirror && mirror.tabId !== tabId.current && mirror.snapshot.startedAt === restored.startedAt) || tombstones.includes(restored.startedAt));
    if (restored && takenElsewhere) {
      safeRemove(session, storageKey);
    } else if (restored) {
      setSnapshot(restored);
      setContextState(restored.context);
      setSeconds(computeElapsedSeconds(restored));
      return;
    }
    if (isOrphan(mirror, tabId.current, tombstones, new Date())) setOrphan(mirror!.snapshot);
    // Restauration au montage uniquement : on ne veut pas ré-écraser une
    // séance en cours si la clé change en cours de vie du composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistance (onglet + miroir) et tic d'affichage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!snapshot) {
      safeRemove(session, storageKey);
      return;
    }
    safeSet(session, storageKey, JSON.stringify(snapshot));
    const beat = () => {
      const mirror: TimerMirror<WorkTimerSnapshot<TContext>> = { tabId: tabId.current, heartbeatAt: new Date().toISOString(), snapshot };
      safeSet(local, mirrorKey, JSON.stringify(mirror));
    };
    beat();
    const heartbeat = setInterval(beat, HEARTBEAT_MS);
    // Retour arrière (page restaurée depuis le cache du navigateur) : les
    // effets ne rejouent pas. Avant de rebattre, vérifier qu'un autre onglet
    // n'a pas repris ou terminé CE chrono entre-temps — sinon le lâcher.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const mirror = parseMirror<WorkTimerSnapshot<TContext>>(safeGet(local, mirrorKey));
      const takenElsewhere =
        (mirror && mirror.tabId !== tabId.current && mirror.snapshot.startedAt === snapshot.startedAt) ||
        parseTombstones(safeGet(local, tombstoneKey)).includes(snapshot.startedAt);
      if (takenElsewhere) {
        safeRemove(session, storageKey);
        setSnapshot(null);
        setSeconds(0);
        return;
      }
      beat();
    };
    window.addEventListener("pageshow", onPageShow);
    // L'onglet se ferme : le battement s'arrête NET (heure zéro), pour qu'un
    // onglet rouvert aussitôt propose la reprise sans attendre trois minutes.
    // S'il revient (retour arrière), il retrouve son chrono en sessionStorage
    // et rebat au montage.
    const onPageHide = () => {
      const mirror: TimerMirror<WorkTimerSnapshot<TContext>> = { tabId: tabId.current, heartbeatAt: new Date(0).toISOString(), snapshot };
      safeSet(local, mirrorKey, JSON.stringify(mirror));
    };
    window.addEventListener("pagehide", onPageHide);
    const tick = snapshot.runningSince ? setInterval(() => setSeconds(computeElapsedSeconds(snapshot)), 1000) : null;
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      if (tick) clearInterval(tick);
    };
  }, [snapshot, storageKey, mirrorKey, tombstoneKey]);

  // Un autre onglet a repris CE chrono (ou l'a terminé) : celui-ci le lâche
  // aussitôt, pour qu'il ne puisse pas être enregistré deux fois.
  useEffect(() => {
    if (typeof window === "undefined" || !snapshot) return;
    function onStorage(event: StorageEvent) {
      if (event.key === tombstoneKey && parseTombstones(event.newValue).includes(snapshot!.startedAt)) {
        release();
        return;
      }
      if (event.key !== mirrorKey) return;
      const mirror = parseMirror<WorkTimerSnapshot<TContext>>(event.newValue);
      if (mirror && mirror.tabId !== tabId.current && mirror.snapshot.startedAt === snapshot!.startedAt) release();
    }
    function release() {
      safeRemove(session, storageKey);
      setSnapshot(null);
      setSeconds(0);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [snapshot, storageKey, mirrorKey, tombstoneKey]);

  // Fermer l'onglet pendant qu'un chrono TOURNE : le navigateur demande
  // confirmation. (Le miroir permet de toute façon de le reprendre.)
  const running = Boolean(snapshot?.runningSince);
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Requis par certains navigateurs pour afficher la confirmation.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const setContext = useCallback((next: TContext) => {
    setContextState(next);
    setSnapshot((prev) => (prev ? { ...prev, context: next } : prev));
  }, []);

  const start = useCallback(() => {
    // Démarrer une NOUVELLE séance alors qu'un chrono orphelin attend : c'est
    // un choix (le bandeau est affiché au-dessus) — on le consigne comme
    // « Ignorer », pour que l'orphelin ne revienne pas sous un autre onglet.
    if (orphan) safeSet(local, tombstoneKey, addTombstone(safeGet(local, tombstoneKey), orphan.startedAt));
    setOrphan(null);
    setSnapshot((prev) => {
      const now = new Date().toISOString();
      if (!prev) return { startedAt: now, accumulatedSeconds: 0, runningSince: now, context };
      if (prev.runningSince) return prev;
      return { ...prev, runningSince: now };
    });
  }, [context, orphan, tombstoneKey]);

  const pause = useCallback(() => {
    setSnapshot((prev) => {
      if (!prev || !prev.runningSince) return prev;
      const accumulatedSeconds = prev.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(prev.runningSince).getTime()) / 1000));
      return { ...prev, accumulatedSeconds, runningSince: null };
    });
  }, []);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, start, pause]);

  const stop = useCallback(
    (onComplete?: (result: { startedAt: string; seconds: number }) => void) => {
      if (snapshot) {
        const finalSeconds = computeElapsedSeconds(snapshot);
        // Déjà enregistrée par un autre onglet (pierre tombale) : ne rien doubler.
        const alreadySaved = parseTombstones(safeGet(local, tombstoneKey)).includes(snapshot.startedAt);
        if (finalSeconds > 0 && onComplete && !alreadySaved) onComplete({ startedAt: snapshot.startedAt, seconds: finalSeconds });
        safeSet(local, tombstoneKey, addTombstone(safeGet(local, tombstoneKey), snapshot.startedAt));
      }
      // Nettoyage immédiat et synchrone : on ne peut pas compter sur l'effet
      // de persistance pour réagir à `snapshot === null`, car l'appelant
      // peut démonter le composant dans la même mise à
      // jour (onClose juste après stop()), avant que cet effet ne rejoue.
      if (typeof window !== "undefined") {
        safeRemove(session, storageKey);
        safeRemove(local, mirrorKey);
      }
      setSnapshot(null);
      setSeconds(0);
    },
    [snapshot, storageKey, mirrorKey, tombstoneKey]
  );

  const adoptOrphan = useCallback(() => {
    if (!orphan) return;
    setSnapshot(orphan);
    setContextState(orphan.context);
    setSeconds(computeElapsedSeconds(orphan));
    setOrphan(null);
  }, [orphan]);

  const dismissOrphan = useCallback(() => {
    if (orphan) safeSet(local, tombstoneKey, addTombstone(safeGet(local, tombstoneKey), orphan.startedAt));
    safeRemove(local, mirrorKey);
    setOrphan(null);
  }, [orphan, mirrorKey, tombstoneKey]);

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
    orphan: orphan ? { startedAt: orphan.startedAt, seconds: computeElapsedSeconds(orphan), context: orphan.context } : null,
    adoptOrphan,
    dismissOrphan,
  };
}
