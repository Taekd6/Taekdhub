"use client";

import { useSyncExternalStore } from "react";
import { type ChapterMemory } from "@/lib/storage"; // mémoire des chapitres (FSRS)
import { lastStorageWriteFailure, localData, normalizePreferences, purgeRetiredBankData, type NextMoveRecord, type DayPlanRecord, type ErrorEntry, type Grade, type Preferences, type ReviewItem, type WeekSnapshot, type WorkItem, type DailyCheckin } from "@/lib/storage";
import { buildWeeklyPlan } from "@/lib/planning";
import { dayKey } from "@/lib/study";
import { captureWeekSnapshot, findMissingSnapshotWeekStart } from "@/lib/week-snapshot";
import { DATA_CHANGED_EVENT } from "@/lib/sync/events";
import type { WorkSession } from "@/lib/supabase/types";
import type { ExerciseAttempt } from "@/lib/attempts";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";

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
  /** Historique Next Move — voir `NextMoveRecord` (lib/storage.ts). */
  nextMoves: NextMoveRecord[];
  weekSnapshots: WeekSnapshot[];
  /** Tentatives d'exercice — voir lib/attempts.ts. */
  attempts: ExerciseAttempt[];
  /** Relevés Anki — voir lib/anki-snapshot.ts. */
  ankiSnapshots: AnkiSnapshot[];
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
    nextMoves: localData.nextMoves(),
    attempts: localData.attempts(),
    ankiSnapshots: localData.ankiSnapshots(),
    weekSnapshots,
    lastBackupAt: localData.lastBackupAt(),
    preferences,
  };
}

/* ══════════════════════════════════════════════════════════════════
   LE STORE — une seule copie des données par onglet
   ══════════════════════════════════════════════════════════════════

   Avant, chaque appel de `usePrepahubData()` (27 composants) gardait SA
   copie React des données, et une écriture d'une copie ne prévenait pas les
   autres du même onglet. Pour les collections écrites en REMPLACEMENT, une
   copie périmée qui écrivait effaçait ce qu'une autre venait d'ajouter
   (docs/AUDIT.md, P1-1) ; seule la discipline « un appelant par écran » s'y
   opposait.

   Désormais l'onglet a UN instantané, partagé par tous les appelants via
   `useSyncExternalStore`. Toute écriture passe par lui et prévient tout le
   monde ; un autre onglet (événement `storage`) ou la synchronisation
   (`DATA_CHANGED_EVENT`) le font relire. Les collections qu'une écriture
   ne touche pas gardent leur référence : les `useMemo` des écrans ne se
   recalculent pas pour rien.

   Le premier rendu reste celui d'avant (`ready: false`, valeurs par
   défaut) : `readAll` ÉCRIT (instantané de la semaine, intention du
   lendemain), ce qui est interdit pendant un rendu. La lecture a lieu dans
   `subscribe`, c'est-à-dire après le montage — comme l'ancien `useEffect`.
   Quand plus aucun composant n'écoute, l'instantané est oublié : le suivant
   relira le disque au lieu de partir d'une copie périmée.
*/

type Listener = () => void;

const listeners = new Set<Listener>();
/** `null` : pas encore lu (ou plus personne n'écoute) — les appelants voient alors `initialState()`. */
let snapshot: DataState | null = null;
let initial: DataState | null = null;
let purged = false;

function emptyState(preferences: Preferences): DataState {
  return {
    sessions: [],
    workItems: [],
    grades: [],
    dayPlans: [],
    reviewItems: [],
    errors: [],
    checkins: [],
    chapterMemory: [],
    nextMoves: [],
    attempts: [],
    ankiSnapshots: [],
    weekSnapshots: [],
    lastBackupAt: null,
    preferences,
    ready: false,
    writeFailedAt: null,
  };
}

/** Rendu serveur et hydratation : les valeurs par défaut, comme le serveur les voit. */
const SERVER_STATE = emptyState(normalizePreferences({}));

/** Côté client, avant la première lecture : les préférences réelles (lecture seule), le reste vide. */
function initialState(): DataState {
  if (!initial) initial = emptyState(localData.preferences());
  return initial;
}

function failure(): string | null {
  return lastStorageWriteFailure()?.at ?? null;
}

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

/** Relit tout le disque et prévient tous les appelants. */
function reload(): void {
  // Ménage AVANT la première lecture : efface, sur un appareil qui l'avait
  // encore, l'ancienne banque d'exercices (≈ 2,8 Mo de quota rendus à
  // l'élève). Sans effet dès la deuxième fois — voir
  // lib/storage.ts#purgeRetiredBankData.
  if (!purged) {
    purgeRetiredBankData();
    purged = true;
  }
  snapshot = { ...readAll(), ready: true, writeFailedAt: failure() };
  emit();
}

/** Remplace une partie de l'instantané (après une écriture) et prévient tous les appelants. */
function update(patch: Partial<DataState>): void {
  if (!snapshot) snapshot = { ...readAll(), ready: true, writeFailedAt: failure() };
  snapshot = { ...snapshot, ...patch, writeFailedAt: failure() };
  emit();
}

function onStorage(event: StorageEvent): void {
  if (event.key?.startsWith("prepahub:")) reload();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    // La synchronisation du compte a réécrit le disque (lib/sync/events.ts) : relire.
    window.addEventListener(DATA_CHANGED_EVENT, reload);
  }
  if (!snapshot) reload();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DATA_CHANGED_EVENT, reload);
    snapshot = null;
    initial = null;
  };
}

function getSnapshot(): DataState {
  return snapshot ?? initialState();
}

function getServerSnapshot(): DataState {
  return SERVER_STATE;
}

/* ── Écritures — les mêmes règles qu'avant, appliquées une seule fois pour tout l'onglet ── */

/**
 * Écritures INCRÉMENTALES (une séance de plus) :
 * fusionnées avec ce qui est réellement sur le disque plutôt qu'écrites en
 * remplacement — voir lib/storage.ts#mergeById pour le scénario de perte
 * totale que cela ferme. L'état reçoit la liste RÉELLEMENT enregistrée,
 * jamais celle qu'on croyait écrire.
 */
function saveSessions(sessions: WorkSession[]): void {
  update({ sessions: localData.mergeSessions(sessions) });
}

/** Suppression d'une séance — voir `localData.removeSession` : la fusion de `saveSessions` ne retire jamais rien. */
function removeSession(id: string): void {
  update({ sessions: localData.removeSession(id) });
}

/**
 * Écriture incrémentale, comme les séances : un travail n'est jamais retiré
 * de la liste (il passe au statut « abandonné »), donc la fusion par
 * identifiant reste correcte — voir lib/storage.ts#mergeStored.
 */
function saveWorkItems(workItems: WorkItem[]): void {
  update({ workItems: localData.mergeWorkItems(workItems) });
}

/**
 * REMPLACEMENT, pas fusion — contrairement aux séances et aux travaux.
 * Une note SE SUPPRIME : on saisit 14 au lieu de 4, on corrige. Une fusion
 * par identifiant ressusciterait la note effacée. Le remplacement est sûr
 * parce que tous les appelants partagent désormais le même instantané :
 * aucun ne peut plus écrire depuis une copie périmée.
 */
function saveGrades(grades: Grade[]): void {
  localData.saveGrades(grades);
  update({ grades });
}

/**
 * REMPLACEMENT, pour la même raison que `saveGrades` : une entrée se
 * supprime, et une fusion par identifiant la ressusciterait.
 *
 * Écriture refusée (quota) : l'état reçoit ce qui est RÉELLEMENT sur le
 * disque, pas la liste voulue — sinon la ligne s'afficherait comme notée et
 * disparaîtrait au rechargement, exactement ce que `merge*` a appris à
 * éviter (voir lib/storage.ts#mergeAndStore). Même règle pour toutes les
 * collections ci-dessous.
 */
function replace<K extends keyof DataState>(key: K, value: DataState[K], write: (value: DataState[K]) => boolean, read: () => DataState[K]): boolean {
  const written = write(value);
  update({ [key]: written ? value : read() } as Partial<DataState>);
  return written;
}

const saveReviewItems = (reviewItems: ReviewItem[]) => void replace("reviewItems", reviewItems, localData.saveReviewItems, localData.reviewItems);
/* ── Carnet d'erreurs — REMPLACEMENT, exactement comme `saveReviewItems`. ── */
const saveErrors = (errors: ErrorEntry[]) => void replace("errors", errors, localData.saveErrors, localData.errors);
/* ── Check-in du soir — REMPLACEMENT de la liste déjà mise à jour par lib/checkin-insights.ts#upsertCheckin (un check-in par jour, qui se corrige). ── */
const saveCheckins = (checkins: DailyCheckin[]) => void replace("checkins", checkins, localData.saveCheckins, localData.checkins);
/* ── Mémoire des chapitres (FSRS) ── */
const saveChapterMemory = (chapterMemory: ChapterMemory[]) => void replace("chapterMemory", chapterMemory, localData.saveChapterMemory, localData.chapterMemory);
/* ── Historique Next Move — la liste passée est déjà mise à jour et élaguée par lib/next-move/history.ts. ── */
const saveNextMoves = (nextMoves: NextMoveRecord[]) => void replace("nextMoves", nextMoves, localData.saveNextMoves, localData.nextMoves);
/* ── Tentatives d'exercice et relevés Anki — renvoient si l'écriture est passée. ── */
const saveAttempts = (attempts: ExerciseAttempt[]) => replace("attempts", attempts, localData.saveAttempts, localData.attempts);
const saveAnkiSnapshots = (ankiSnapshots: AnkiSnapshot[]) => replace("ankiSnapshots", ankiSnapshots, localData.saveAnkiSnapshots, localData.ankiSnapshots);

function savePreferences(preferences: Preferences): void {
  localData.savePreferences(preferences);
  update({ preferences });
}

/** Relit tout le disque (après une restauration de sauvegarde, par exemple) — pour TOUS les appelants. */
function refresh(): void {
  reload();
}

const actions = { refresh, saveSessions, removeSession, saveWorkItems, saveGrades, saveReviewItems, saveErrors, saveCheckins, saveChapterMemory, saveNextMoves, saveAttempts, saveAnkiSnapshots, savePreferences };

/**
 * Les données de l'élève et leurs écritures. Même forme qu'avant le store :
 * aucun appelant n'a à changer. Les fonctions d'écriture sont stables (même
 * référence à chaque rendu).
 */
export function usePrepahubData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...data, ...actions };
}
