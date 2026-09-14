"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { materializeRoutines } from "@/lib/domain/routines";
import {
  completeTask as completeTaskPure,
  createId,
  createTask,
  cancelTask as cancelTaskPure,
  postponeTask as postponeTaskPure,
  reopenTask as reopenTaskPure,
  scheduleAt as scheduleAtPure,
  scheduleTask as scheduleTaskPure,
  unscheduleTask as unscheduleTaskPure,
  updateTask as updateTaskPure,
  type NewTaskInput,
} from "@/lib/domain/tasks";
import { applyThemeMode, applyAccent } from "@/lib/theme";
import {
  LocalStorageRepository,
  STORAGE_KEY,
  downloadBackup,
  lastStorageFailure,
  parseBackup,
  type Repository,
} from "@/lib/store/repository";
import { emptyState } from "@/lib/store/schema";
import type {
  AppState,
  Availability,
  Goal,
  Routine,
  Settings,
  Subject,
  Task,
  TaskSlot,
  TimeEntry,
} from "@/lib/domain/types";
import type { PlanProposal } from "@/lib/domain/scheduling";

/**
 * ============================================================================
 * MAGASIN — une seule instance partagée par toute l'application.
 * ============================================================================
 *
 * La version précédente exposait un `useAppData()` qui créait un `useState`
 * PAR COMPOSANT : deux écrans montés en même temps avaient deux états
 * différents, et enregistrer depuis l'un écrasait silencieusement ce que
 * l'autre venait d'écrire (bug réel, constaté sur les réglages). Ici, un
 * contexte unique, monté une fois dans `AppShell` — il n'existe qu'une seule
 * vérité en mémoire.
 *
 * Toutes les mutations passent par `commit`, qui applique une fonction pure
 * à l'état, l'enregistre, et ne met à jour React que sur ce qui a réellement
 * été écrit.
 */

export interface RunningTimer {
  startedAt: string;
  taskId?: string;
  subjectId?: string;
}

const TIMER_KEY = "taekdhub:timer";

export interface TaekdhubStore {
  state: AppState;
  ready: boolean;
  /** Horodatage du dernier refus d'écriture du navigateur — `null` tant que tout passe. */
  writeFailedAt: string | null;

  // Tâches
  addTask(input: NewTaskInput): Task;
  editTask(id: string, patch: Partial<Task>): void;
  deleteTask(id: string): void;
  completeTask(id: string, workedMinutes?: number): void;
  reopenTask(id: string): void;
  cancelTask(id: string): void;
  startTask(id: string): void;

  // Planning
  scheduleTask(id: string, slots: TaskSlot[]): void;
  scheduleTaskAt(id: string, start: string, minutes?: number): void;
  unscheduleTask(id: string): void;
  postponeTask(id: string, slots: TaskSlot[]): void;
  applyPlan(proposal: PlanProposal): void;

  // Temps réel
  logTime(entry: { taskId?: string; subjectId?: string; minutes: number; startedAt?: string; note?: string }): void;
  deleteTimeEntry(id: string): void;
  timer: RunningTimer | null;
  startTimer(input: { taskId?: string; subjectId?: string }): void;
  /** Arrête le chronomètre et enregistre le temps écoulé (arrondi à la minute). Renvoie les minutes enregistrées. */
  stopTimer(): number;
  cancelTimer(): void;

  // Objectifs, routines, matières
  saveGoal(goal: Omit<Goal, "createdAt" | "updatedAt"> & { createdAt?: string }): void;
  deleteGoal(id: string): void;
  saveRoutine(routine: Omit<Routine, "createdAt" | "updatedAt"> & { createdAt?: string }): void;
  deleteRoutine(id: string): void;
  saveSubjects(subjects: Subject[]): void;

  // Configuration
  saveAvailability(availability: Availability): void;
  saveSettings(patch: Partial<Settings>): void;

  // Données
  exportBackup(): void;
  importBackup(text: string): boolean;
  resetAll(): void;
}

const StoreContext = createContext<TaekdhubStore | null>(null);

export function useStore(): TaekdhubStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore doit être utilisé dans <TaekdhubProvider>");
  return store;
}

export function TaekdhubProvider({ children, repository }: { children: React.ReactNode; repository?: Repository }) {
  const repo = useRef<Repository>(repository ?? new LocalStorageRepository());
  const [state, setState] = useState<AppState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [writeFailedAt, setWriteFailedAt] = useState<string | null>(null);
  const [timer, setTimer] = useState<RunningTimer | null>(null);

  /**
   * Référence synchrone sur l'état courant.
   *
   * Indispensable : deux mutations déclenchées dans le même gestionnaire
   * d'événement (terminer une tâche PUIS enregistrer son temps) doivent
   * s'enchaîner sur le même état. En passant uniquement par
   * `setState(fonction)`, la seconde serait calculée sur l'état d'AVANT la
   * première pour ce qui est de l'écriture disque, et la sauvegarde
   * enregistrerait un état déjà périmé.
   */
  const stateRef = useRef(state);

  /** Applique une transformation PURE, persiste, et publie exactement ce qui a été écrit. */
  const commit = useCallback((transform: (current: AppState) => AppState) => {
    const current = stateRef.current;
    const next = transform(current);
    if (next === current) return current;
    stateRef.current = next;
    repo.current.save(next);
    setWriteFailedAt(lastStorageFailure());
    setState(next);
    return next;
  }, []);

  const mapTask = useCallback(
    (id: string, transform: (task: Task) => Task) => {
      commit((current) => {
        const index = current.tasks.findIndex((task) => task.id === id);
        if (index === -1) return current;
        const tasks = [...current.tasks];
        tasks[index] = transform(tasks[index]);
        return { ...current, tasks };
      });
    },
    [commit]
  );

  // ── CHARGEMENT ────────────────────────────────────────────────────
  useEffect(() => {
    const loaded = repo.current.load();
    // Les routines matérialisent leurs occurrences au chargement — idempotent
    // (voir domain/routines.ts), donc sans risque de doublon à chaque montage.
    const generated = materializeRoutines(loaded);
    const initial = generated.length > 0 ? { ...loaded, tasks: [...loaded.tasks, ...generated] } : loaded;
    if (generated.length > 0) repo.current.save(initial);
    stateRef.current = initial;
    setState(initial);
    setReady(true);
    setWriteFailedAt(lastStorageFailure());

    try {
      const raw = window.localStorage.getItem(TIMER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RunningTimer;
        if (parsed && typeof parsed.startedAt === "string" && !Number.isNaN(new Date(parsed.startedAt).getTime())) {
          setTimer(parsed);
        }
      }
    } catch {
      // Chronomètre illisible : on repart sans, ce n'est pas une donnée critique.
    }

    // Deux onglets ouverts sur TaekdHub doivent voir les mêmes données : le
    // navigateur prévient l'autre onglet à chaque écriture.
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      const reloaded = repo.current.load();
      stateRef.current = reloaded;
      setState(reloaded);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Le thème suit les réglages dès qu'ils changent (et au chargement).
  useEffect(() => {
    if (!ready) return;
    applyAccent(state.settings.accent);
    applyThemeMode(state.settings.themeMode);
  }, [ready, state.settings.accent, state.settings.themeMode]);

  const store = useMemo<TaekdhubStore>(() => {
    function logTime(entry: { taskId?: string; subjectId?: string; minutes: number; startedAt?: string; note?: string }) {
      const now = new Date();
      const startedAt = entry.startedAt ?? now.toISOString();
      commit((current) => {
        const task = entry.taskId ? current.tasks.find((item) => item.id === entry.taskId) : undefined;
        const record: TimeEntry = {
          id: createId("e"),
          taskId: entry.taskId,
          subjectId: entry.subjectId ?? task?.subjectId,
          startedAt,
          minutes: Math.max(1, Math.round(entry.minutes)),
          note: entry.note,
          createdAt: now.toISOString(),
        };
        return { ...current, timeEntries: [...current.timeEntries, record] };
      });
    }

    function persistTimer(next: RunningTimer | null) {
      setTimer(next);
      try {
        if (next) window.localStorage.setItem(TIMER_KEY, JSON.stringify(next));
        else window.localStorage.removeItem(TIMER_KEY);
      } catch {
        // Le chronomètre ne survivra pas au rechargement, mais la séance en cours fonctionne.
      }
    }

    return {
      state,
      ready,
      writeFailedAt,

      addTask(input) {
        const task = createTask(input);
        commit((current) => ({ ...current, tasks: [...current.tasks, task] }));
        return task;
      },
      editTask(id, patch) {
        mapTask(id, (task) => updateTaskPure(task, patch));
      },
      deleteTask(id) {
        commit((current) => ({
          ...current,
          tasks: current.tasks.filter((task) => task.id !== id),
          // Le temps réellement travaillé SURVIT à la suppression de la tâche :
          // il est détaché, pas effacé. Une heure de maths passée reste une
          // heure de maths passée, et le bilan hebdomadaire doit continuer de
          // la compter.
          timeEntries: current.timeEntries.map((entry) => (entry.taskId === id ? { ...entry, taskId: undefined } : entry)),
        }));
      },
      completeTask(id, workedMinutes) {
        const now = new Date();
        commit((current) => {
          const index = current.tasks.findIndex((task) => task.id === id);
          if (index === -1) return current;
          const tasks = [...current.tasks];
          const task = tasks[index];
          tasks[index] = completeTaskPure(task, now);
          const timeEntries =
            workedMinutes && workedMinutes > 0
              ? [
                  ...current.timeEntries,
                  {
                    id: createId("e"),
                    taskId: id,
                    subjectId: task.subjectId,
                    startedAt: now.toISOString(),
                    minutes: Math.round(workedMinutes),
                    createdAt: now.toISOString(),
                  } satisfies TimeEntry,
                ]
              : current.timeEntries;
          return { ...current, tasks, timeEntries };
        });
      },
      reopenTask(id) {
        mapTask(id, (task) => reopenTaskPure(task));
      },
      cancelTask(id) {
        mapTask(id, (task) => cancelTaskPure(task));
      },
      startTask(id) {
        mapTask(id, (task) => updateTaskPure(task, { status: "doing" }));
      },

      scheduleTask(id, slots) {
        mapTask(id, (task) => scheduleTaskPure(task, slots));
      },
      scheduleTaskAt(id, start, minutes) {
        mapTask(id, (task) => scheduleAtPure(task, start, minutes));
      },
      unscheduleTask(id) {
        mapTask(id, (task) => unscheduleTaskPure(task));
      },
      postponeTask(id, slots) {
        mapTask(id, (task) => postponeTaskPure(task, slots));
      },
      applyPlan(proposal) {
        const bySlot = new Map(proposal.assignments.map((assignment) => [assignment.taskId, assignment.slots]));
        commit((current) => ({
          ...current,
          tasks: current.tasks.map((task) => {
            const slots = bySlot.get(task.id);
            return slots ? scheduleTaskPure(task, slots) : task;
          }),
        }));
      },

      logTime,
      deleteTimeEntry(id) {
        commit((current) => ({ ...current, timeEntries: current.timeEntries.filter((entry) => entry.id !== id) }));
      },
      timer,
      startTimer(input) {
        persistTimer({ startedAt: new Date().toISOString(), taskId: input.taskId, subjectId: input.subjectId });
        if (input.taskId) mapTask(input.taskId, (task) => updateTaskPure(task, { status: "doing" }));
      },
      stopTimer() {
        if (!timer) return 0;
        const minutes = Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 60_000);
        persistTimer(null);
        // Sous une minute, il n'y a rien à enregistrer — mais on n'invente pas
        // « 1 min » pour autant : un faux temps pollue durablement l'analyse
        // des estimations.
        if (minutes < 1) return 0;
        logTime({ taskId: timer.taskId, subjectId: timer.subjectId, minutes, startedAt: timer.startedAt });
        return minutes;
      },
      cancelTimer() {
        persistTimer(null);
      },

      saveGoal(goal) {
        const now = new Date().toISOString();
        commit((current) => {
          const index = current.goals.findIndex((item) => item.id === goal.id);
          const record: Goal = {
            ...goal,
            createdAt: goal.createdAt ?? current.goals[index]?.createdAt ?? now,
            updatedAt: now,
          };
          const goals = index === -1 ? [...current.goals, record] : current.goals.map((item) => (item.id === goal.id ? record : item));
          return { ...current, goals };
        });
      },
      deleteGoal(id) {
        commit((current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          tasks: current.tasks.map((task) => (task.goalId === id ? { ...task, goalId: undefined } : task)),
        }));
      },
      saveRoutine(routine) {
        const now = new Date().toISOString();
        commit((current) => {
          const index = current.routines.findIndex((item) => item.id === routine.id);
          const record: Routine = {
            ...routine,
            createdAt: routine.createdAt ?? current.routines[index]?.createdAt ?? now,
            updatedAt: now,
          };
          const routines =
            index === -1 ? [...current.routines, record] : current.routines.map((item) => (item.id === routine.id ? record : item));
          const next = { ...current, routines };
          const generated = materializeRoutines(next);
          return generated.length > 0 ? { ...next, tasks: [...next.tasks, ...generated] } : next;
        });
      },
      deleteRoutine(id) {
        commit((current) => ({
          ...current,
          routines: current.routines.filter((routine) => routine.id !== id),
          // Les occurrences FUTURES non commencées disparaissent avec la
          // routine ; celles déjà travaillées ou terminées restent, parce
          // qu'elles font partie de l'historique réel.
          tasks: current.tasks.filter((task) => !(task.routineId === id && task.status === "todo" && task.slots.length === 0)),
        }));
      },
      saveSubjects(subjects) {
        commit((current) => ({ ...current, subjects }));
      },

      saveAvailability(availability) {
        commit((current) => ({ ...current, availability }));
      },
      saveSettings(patch) {
        commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
      },

      exportBackup() {
        downloadBackup(state);
      },
      importBackup(text) {
        const imported = parseBackup(text);
        if (!imported) return false;
        commit(() => imported);
        return true;
      },
      resetAll() {
        repo.current.clear();
        const fresh = emptyState();
        repo.current.save(fresh);
        stateRef.current = fresh;
        setState(fresh);
        persistTimer(null);
      },
    };
  }, [state, ready, writeFailedAt, timer, commit, mapTask]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
