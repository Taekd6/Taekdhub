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
export interface WorkTimerSnapshot<TContext> {
  /** ISO — instant du tout premier démarrage de cette séance. Devient `WorkSession.started_at`. */
  startedAt: string;
  /** Secondes entières déjà comptabilisées lors des intervalles précédents (hors intervalle en cours). */
  accumulatedSeconds: number;
  /** ISO — instant de début de l'intervalle "running" en cours, ou null si en pause. */
  runningSince: string | null;
  /** Données propres à l'appelant (ex. matière choisie, exercice en focus…), restaurées avec le timer. */
  context: TContext;
}

/** Ce qu'il faut pour réamorcer un timer sur une séance déjà connue — même forme que le résultat de `stop()`, réutilisée pour la reprise depuis un checkpoint (voir `recoveredSeed` ci-dessous). */
export interface RecoveredTimerSeed {
  startedAt: string;
  seconds: number;
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
  /**
   * Non-null immédiatement après un montage qui a restauré une séance
   * existante (sessionStorage normal OU checkpoint récupéré via
   * `recoveredSeed`) — pour un message discret "Séance reprise" côté
   * appelant. Fixé une seule fois au montage, ne change plus ensuite.
   */
  resumedSeconds: number | null;
  /**
   * True tant que la pause en cours résulte d'une mise en arrière-plan
   * (visibilitychange), pas d'un clic manuel — jamais remis à false
   * automatiquement au premier plan : seule une reprise manuelle
   * (`start`/`toggle`) le réinitialise, pour que l'utilisateur relance
   * explicitement plutôt que de voir le chrono repartir tout seul.
   */
  autoPaused: boolean;
}

/** Exportée (Sprint poste de pilotage) pour que le Dashboard puisse lire l'avancement d'une séance active sans dupliquer ce parsing — voir hooks/use-resumable-focus.ts. */
export function readSnapshot<TContext>(storageKey: string): WorkTimerSnapshot<TContext> | null {
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

/** `now` injectable pour rester une fonction pure testable (voir hooks/use-work-timer.test.ts) — les appelants réels omettent le paramètre et utilisent l'horloge courante. */
export function computeElapsedSeconds(snapshot: WorkTimerSnapshot<unknown> | null, now: number = Date.now()): number {
  if (!snapshot) return 0;
  const runningExtra = snapshot.runningSince ? Math.floor((now - new Date(snapshot.runningSince).getTime()) / 1000) : 0;
  return snapshot.accumulatedSeconds + Math.max(0, runningExtra);
}

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

/*
 * ---------------------------------------------------------------------------
 * Checkpoint de récupération (Sprint résilience Focus + Chronomètre).
 *
 * Filet de sécurité DISTINCT du sessionStorage ci-dessus, qui reste l'unique
 * mécanisme pour un rechargement normal dans le même onglet (comportement
 * inchangé). Le checkpoint vit en localStorage et sert uniquement de recours
 * après une fermeture brutale (crash, fermeture d'onglet, iOS qui tue l'app
 * en arrière-plan) — priorité stricte : (1) auto-pause visibilitychange,
 * (2) checkpoints réguliers, (3) pagehide en tout dernier recours.
 *
 * Toujours écrit avec des secondes déjà résolues (`computeElapsedSeconds` au
 * moment de l'écriture), jamais un `runningSince` brut à prolonger plus tard :
 * une récupération ne peut donc jamais compter le temps écoulé entre le
 * dernier checkpoint et l'instant de la récupération — la durée reste figée
 * par construction, quel que soit l'âge du checkpoint.
 * ---------------------------------------------------------------------------
 */

const CHECKPOINT_KEY_PREFIX = "prepahub:timer-checkpoint:";

/** Fréquence des écritures périodiques (uniquement pendant que le chrono tourne) — en plus des écritures déclenchées par un événement (démarrage, pause, changement de contexte, mise en arrière-plan). */
export const CHECKPOINT_INTERVAL_MS = 60_000;

/** Au-delà de cet âge, un checkpoint n'est plus proposé à la récupération (trop risqué de rouvrir une séance aussi vieille) — voir `isCheckpointRecoverable`. */
export const CHECKPOINT_RECOVERY_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface TimerCheckpoint {
  startedAt: string;
  /** Secondes totales déjà résolues au moment de l'écriture — jamais un horodatage à prolonger. */
  seconds: number;
  /** ISO — instant d'écriture de ce checkpoint. */
  savedAt: string;
}

function checkpointKey(storageKey: string): string {
  return `${CHECKPOINT_KEY_PREFIX}${storageKey}`;
}

export function buildCheckpoint<TContext>(snapshot: WorkTimerSnapshot<TContext>, now: number = Date.now()): TimerCheckpoint {
  return {
    startedAt: snapshot.startedAt,
    seconds: computeElapsedSeconds(snapshot, now),
    savedAt: new Date(now).toISOString(),
  };
}

export function checkpointAgeMs(checkpoint: Pick<TimerCheckpoint, "savedAt">, now: number = Date.now()): number {
  return Math.max(0, now - new Date(checkpoint.savedAt).getTime());
}

/** Récupérable seulement si non vide et pas trop vieux — un checkpoint à 0 seconde n'a rien à proposer. */
export function isCheckpointRecoverable(
  checkpoint: Pick<TimerCheckpoint, "savedAt" | "seconds">,
  now: number = Date.now(),
  maxAgeMs: number = CHECKPOINT_RECOVERY_MAX_AGE_MS
): boolean {
  return checkpoint.seconds > 0 && checkpointAgeMs(checkpoint, now) <= maxAgeMs;
}

function writeCheckpoint(storageKey: string, checkpoint: TimerCheckpoint): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(checkpointKey(storageKey), JSON.stringify(checkpoint));
  } catch {
    // Stockage indisponible (quota, navigation privée…) : le checkpoint est un
    // filet de sécurité, pas un mécanisme critique — on l'abandonne
    // silencieusement plutôt que de casser le chrono.
  }
}

export function clearCheckpoint(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(checkpointKey(storageKey));
  } catch {
    // idem writeCheckpoint : jamais bloquant.
  }
}

/**
 * Cherche, parmi les clés localStorage `<CHECKPOINT_KEY_PREFIX><prefix><suffixe>`,
 * un checkpoint récupérable — pendant symétrique de `findPersistedSessionSuffix`
 * ci-dessus, à n'appeler QUE si ce dernier n'a rien trouvé (priorité stricte à
 * la reprise sessionStorage normale, jamais un second mécanisme concurrent).
 *
 * Nettoie au passage les checkpoints rencontrés mais trop vieux, vides, ou
 * corrompus : seul endroit réaliste où purger l'accumulation de checkpoints
 * abandonnés (ex. exercice archivé/supprimé entre-temps).
 */
export function findRecoverableCheckpoint(prefix: string, now: number = Date.now()): { suffix: string; checkpoint: TimerCheckpoint } | null {
  if (typeof window === "undefined") return null;
  const fullPrefix = checkpointKey(prefix);
  let found: { suffix: string; checkpoint: TimerCheckpoint } | null = null;
  // Parcours à rebours : seule façon sûre de supprimer des entrées pendant
  // l'itération sans perturber les index restants à visiter.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(fullPrefix)) continue;
    const suffix = key.slice(fullPrefix.length);
    const raw = localStorage.getItem(key);
    let checkpoint: TimerCheckpoint | null = null;
    try {
      checkpoint = raw ? (JSON.parse(raw) as TimerCheckpoint) : null;
    } catch {
      checkpoint = null;
    }
    if (!checkpoint || !isCheckpointRecoverable(checkpoint, now)) {
      localStorage.removeItem(key);
      continue;
    }
    if (!found) found = { suffix, checkpoint };
  }
  return found;
}

/**
 * Timer chronométré avec persistance automatique en sessionStorage :
 * un rechargement de page restaure le temps écoulé et reprend la séance si
 * elle était en cours. Partagé par components/timer.tsx et
 * components/exercises/focus-view.tsx pour éviter deux implémentations du
 * même mécanisme — toute fonctionnalité pertinente pour les deux (auto-pause,
 * checkpoint) vit ICI, une seule fois.
 *
 * `storageKey` doit être stable et unique pour le contexte d'usage (deux
 * timers avec la même clé partageraient leur état) — c'est aussi ce qui rend
 * le checkpoint associé sans ambiguïté (namespacé par la même clé), donc
 * jamais confondu entre le chrono libre et une séance focus.
 *
 * `recoveredSeed`, si fourni, réamorce le timer sur une séance dont seule la
 * trace localStorage (checkpoint) a survécu — jamais utilisé si une trace
 * sessionStorage existe encore (reprise normale, prioritaire, inchangée).
 * Toujours restauré à l'arrêt (`runningSince: null`) : on ne relance jamais
 * automatiquement un chrono récupéré, l'utilisateur doit relancer lui-même.
 */
export function useWorkTimer<TContext>(storageKey: string, initialContext: TContext, recoveredSeed?: RecoveredTimerSeed): WorkTimerResult<TContext> {
  const [snapshot, setSnapshot] = useState<WorkTimerSnapshot<TContext> | null>(null);
  const [context, setContextState] = useState<TContext>(initialContext);
  const [seconds, setSeconds] = useState(0);
  const [resumedSeconds, setResumedSeconds] = useState<number | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);

  // Dernière valeur connue de `snapshot`, lue par les gestionnaires
  // d'événements DOM (visibilitychange, pagehide) enregistrés une seule fois
  // ([] deps) — évite qu'ils se ré-abonnent à chaque changement d'état
  // (aucun risque de boucle) tout en lisant toujours la valeur à jour plutôt
  // qu'une fermeture figée au moment de l'abonnement.
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const restored = readSnapshot<TContext>(storageKey);
    if (restored) {
      setSnapshot(restored);
      setContextState(restored.context);
      const elapsed = computeElapsedSeconds(restored, Date.now());
      setSeconds(elapsed);
      if (elapsed > 0) setResumedSeconds(elapsed);
      return;
    }
    if (recoveredSeed && recoveredSeed.seconds > 0) {
      // Case C (voir findRecoverableCheckpoint) : toujours figé à l'arrêt,
      // jamais prolongé jusqu'à "maintenant" — la sécurité vient de la
      // structure des données, pas d'un seuil d'âge appliqué ici.
      const seeded: WorkTimerSnapshot<TContext> = {
        startedAt: recoveredSeed.startedAt,
        accumulatedSeconds: recoveredSeed.seconds,
        runningSince: null,
        context: initialContext,
      };
      setSnapshot(seeded);
      setSeconds(recoveredSeed.seconds);
      setResumedSeconds(recoveredSeed.seconds);
      clearCheckpoint(storageKey);
      return;
    }
    // Rien à restaurer et personne n'a réclamé de checkpoint pour cette clé
    // précise : un éventuel checkpoint orphelin (ex. chrono libre laissé
    // ouvert lors d'un crash, jamais recyclé par un appelant) est nettoyé
    // plutôt que de s'accumuler indéfiniment en localStorage.
    clearCheckpoint(storageKey);
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
    // Écriture événementielle du checkpoint : ce même effet se redéclenche à
    // chaque changement de `snapshot`, donc à chaque démarrage, pause (y
    // compris auto-pause), ou changement de contexte — sans code dupliqué.
    writeCheckpoint(storageKey, buildCheckpoint(snapshot));
    if (!snapshot.runningSince) return;
    const tickId = setInterval(() => setSeconds(computeElapsedSeconds(snapshot, Date.now())), 1000);
    // Écriture périodique, uniquement pendant que le chrono tourne — jamais
    // chaque seconde, voir CHECKPOINT_INTERVAL_MS.
    const checkpointId = setInterval(() => writeCheckpoint(storageKey, buildCheckpoint(snapshot, Date.now())), CHECKPOINT_INTERVAL_MS);
    return () => {
      clearInterval(tickId);
      clearInterval(checkpointId);
    };
  }, [snapshot, storageKey]);

  const setContext = useCallback((next: TContext) => {
    setContextState(next);
    setSnapshot((prev) => (prev ? { ...prev, context: next } : prev));
  }, []);

  const start = useCallback(() => {
    setAutoPaused(false);
    setSnapshot((prev) => {
      const now = new Date().toISOString();
      if (!prev) return { startedAt: now, accumulatedSeconds: 0, runningSince: now, context };
      if (prev.runningSince) return prev;
      return { ...prev, runningSince: now };
    });
  }, [context]);

  const pause = useCallback(() => {
    setSnapshot((prev) => {
      if (!prev || !prev.runningSince) return prev;
      return { ...prev, accumulatedSeconds: computeElapsedSeconds(prev, Date.now()), runningSince: null };
    });
  }, []);

  const running = Boolean(snapshot?.runningSince);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, start, pause]);

  // Auto-pause (Task 1) : dès que l'onglet passe en arrière-plan pendant que
  // le chrono tourne, on met en pause et on le signale via `autoPaused` — sans
  // jamais reprendre automatiquement au retour au premier plan. Réutilise
  // `pause()` telle quelle (déjà no-op si rien ne tournait) plutôt que de
  // dupliquer le calcul de `accumulatedSeconds` : garantit qu'une séance déjà
  // en pause reste un no-op strict ici aussi.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (!snapshotRef.current?.runningSince) return;
      pause();
      setAutoPaused(true);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause]);

  // Filet de dernier recours (Task 2) : `pagehide` peut survenir sans
  // `visibilitychange` préalable dans de rares cas. Écrit directement le
  // checkpoint à partir de la dernière valeur connue, sans passer par
  // `setState` (la page peut être déchargée avant qu'un re-rendu n'ait lieu).
  useEffect(() => {
    function onPageHide() {
      if (!snapshotRef.current) return;
      writeCheckpoint(storageKey, buildCheckpoint(snapshotRef.current));
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [storageKey]);

  const stop = useCallback(
    (onComplete?: (result: { startedAt: string; seconds: number }) => void) => {
      if (snapshot) {
        const finalSeconds = computeElapsedSeconds(snapshot);
        if (finalSeconds > 0 && onComplete) onComplete({ startedAt: snapshot.startedAt, seconds: finalSeconds });
      }
      // Nettoyage immédiat et synchrone : on ne peut pas compter sur l'effet
      // de persistance pour réagir à `snapshot === null`, car l'appelant
      // (ex. FocusView) démonte souvent le composant dans la même mise à
      // jour (onClose juste après stop()), avant que cet effet ne rejoue.
      if (typeof window !== "undefined") sessionStorage.removeItem(storageKey);
      clearCheckpoint(storageKey);
      setSnapshot(null);
      setSeconds(0);
      setAutoPaused(false);
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
    resumedSeconds,
    autoPaused,
  };
}
