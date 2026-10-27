"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bell, Check, Coffee, Flag, Play, SkipForward, Square, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Ring } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import {
  buildPhases,
  DEFAULT_FOCUS_CONFIG,
  focusState,
  normalizeFocusConfig,
  parseStoredFocus,
  suggestGoals,
  workedSeconds,
  type FocusConfig,
  type StoredFocusSession,
} from "@/lib/focus-session";
import { subjects } from "@/lib/study";
import { localDay } from "@/lib/week-agenda";
import { toggleWorkItemDone } from "@/lib/work-items";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SESSION — l'écran des cycles (lib/focus-session.ts).
 *
 * Trois temps, un seul objet à l'écran à chaque fois :
 *  1. AVANT : « Qu'est-ce que tu vas finir ? » — TaekdHub propose ce qui est
 *     prévu ce soir, ou l'élève écrit le sien. Puis cycles et durées.
 *  2. PENDANT : un grand anneau, la phase (Travail / Pause), le temps qui
 *     reste et l'objectif. Les phases s'enchaînent toutes seules ; à chaque
 *     bascule : son, vibration, notification (si la page vit encore).
 *  3. APRÈS : « Objectif atteint ? » — oui coche la tâche (et donc le rappel
 *     dans Rappels d'Apple), et la session rejoint les victoires du jour.
 *
 * Tout part de l'heure de début (persistée) : recharger, verrouiller
 * l'iPhone ou changer d'onglet ne décale rien. Les alertes FIABLES sur la
 * montre, iPhone verrouillé, viennent du raccourci iOS (app/api/session).
 */

const STORE_KEY = "prepahub:focus:current";
const CONFIG_KEY = "prepahub:focus:config";
const WINS_KEY = "prepahub:focus:wins";

interface Win {
  goal: string;
  at: string;
  done: boolean;
  minutes: number;
}

const safeGet = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : la session vit en mémoire */
  }
};

function readWins(): Win[] {
  try {
    const raw = JSON.parse(safeGet(WINS_KEY) ?? "[]") as Win[];
    return Array.isArray(raw) ? raw.filter((w) => typeof w?.goal === "string" && typeof w?.at === "string") : [];
  } catch {
    return [];
  }
}

const mmss = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Un bip court en Web Audio (pas de fichier son). Le contexte est créé au geste « Lancer ». */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctx.current && AC) ctx.current = new AC();
      void ctx.current?.resume();
    } catch {
      /* pas de son, pas grave */
    }
  }, []);
  const play = useCallback((notes: number[]) => {
    const c = ctx.current;
    if (!c) return;
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime + i * 0.22;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }, []);
  return { unlock, play };
}

async function notify(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: "taekdhub-session" });
    else new Notification(title, { body });
  } catch {
    /* notification impossible ici : le son et la vibration restent */
  }
}

export function FocusSession() {
  const { ready, workItems, saveWorkItems, sessions, saveSessions } = usePrepahubData();
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState<StoredFocusSession | null>(null);
  const [config, setConfig] = useState<FocusConfig>(DEFAULT_FOCUS_CONFIG);
  const [goal, setGoal] = useState("");
  const [goalItemId, setGoalItemId] = useState<string | null>(null);
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [wins, setWins] = useState<Win[]>([]);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const lastIndex = useRef<number | null>(null);
  const { unlock, play } = useChime();

  // Lecture de l'état local, puis d'une session lancée par le raccourci iOS (`/session?objectif=…&debut=…`).
  useEffect(() => {
    let stored = parseStoredFocus(safeGet(STORE_KEY));
    const params = new URLSearchParams(window.location.search);
    const debut = Number(params.get("debut"));
    const objectif = params.get("objectif");
    if (objectif && Number.isFinite(debut) && debut > 0 && (!stored || stored.startedAt !== debut)) {
      const cfg = normalizeFocusConfig({ cycles: params.get("cycles"), workMinutes: params.get("travail"), breakMinutes: params.get("pause") });
      stored = { goal: objectif.slice(0, 200), workItemId: params.get("tache"), startedAt: debut, config: cfg };
      safeSet(STORE_KEY, JSON.stringify(stored));
    }
    if (params.toString()) window.history.replaceState(null, "", window.location.pathname);
    setCurrent(stored);
    let savedConfig: unknown = null;
    try {
      savedConfig = JSON.parse(safeGet(CONFIG_KEY) ?? "null");
    } catch {
      savedConfig = null;
    }
    setConfig(normalizeFocusConfig(savedConfig as Partial<FocusConfig> | null));
    setWins(readWins());
    setLoaded(true);
  }, []);

  const phases = useMemo(() => (current ? buildPhases(current.startedAt, current.config) : []), [current]);
  const state = current ? focusState(phases, now) : null;
  const running = state?.status === "en cours";

  // L'horloge ne bat que pendant une session.
  useEffect(() => {
    if (!current) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [current]);

  // Écran allumé pendant la session (si l'appareil le permet).
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, [running]);

  // Bascule de phase : son, vibration, notification. Jamais au premier affichage.
  const stateIndex = state?.status === "en cours" ? state.index : state ? -1 : null;
  useEffect(() => {
    if (stateIndex === null) {
      lastIndex.current = null;
      return;
    }
    const previous = lastIndex.current;
    lastIndex.current = stateIndex;
    if (previous === null || previous === stateIndex || !current) return;
    if (stateIndex === -1) {
      play([660, 880, 1100]);
      navigator.vibrate?.([300, 120, 300, 120, 300]);
      void notify("Session finie", `${current.goal} — c'est fait ?`);
      setFinishing(true);
      return;
    }
    const phase = phases[stateIndex];
    play(phase.kind === "pause" ? [880, 660] : [660, 880]);
    navigator.vibrate?.([250, 100, 250]);
    void notify(
      phase.kind === "pause" ? `Pause — ${current.config.breakMinutes} min` : `Reprise — cycle ${phase.cycle}/${current.config.cycles}`,
      phase.kind === "pause" ? "Lève-toi, bois de l'eau, pas d'écran." : current.goal
    );
  }, [stateIndex, current, phases, play]);

  // Une session finie pendant l'absence de l'élève : on demande directement le bilan.
  useEffect(() => {
    if (state?.status === "terminée") setFinishing(true);
  }, [state?.status]);

  const suggestions = useMemo(() => (ready ? suggestGoals(workItems, new Date(), 3) : []), [ready, workItems]);
  const todayWins = wins.filter((w) => localDay(new Date(w.at)) === localDay(new Date()));

  function pick(id: string | null, title: string) {
    setGoal(title);
    setGoalItemId(id);
    const item = workItems.find((w) => w.id === id);
    if (item?.subject) setSubject(item.subject);
  }

  function updateConfig(patch: Partial<FocusConfig>) {
    const next = normalizeFocusConfig({ ...config, ...patch });
    setConfig(next);
    safeSet(CONFIG_KEY, JSON.stringify(next));
  }

  function start() {
    const title = goal.trim();
    if (!title) return;
    unlock();
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => undefined);
    const session: StoredFocusSession = { goal: title, workItemId: goalItemId, startedAt: Date.now(), config };
    safeSet(STORE_KEY, JSON.stringify(session));
    lastIndex.current = null;
    setCelebrate(null);
    setFinishing(false);
    setCurrent(session);
  }

  function skipBreak() {
    if (!current || state?.status !== "en cours" || state.phase.kind !== "pause") return;
    const shifted = { ...current, startedAt: current.startedAt - state.remainingMs };
    safeSet(STORE_KEY, JSON.stringify(shifted));
    setCurrent(shifted);
  }

  function finish(done: boolean) {
    if (!current) return;
    const end = Math.min(Date.now(), phases[phases.length - 1]?.end ?? Date.now());
    const seconds = workedSeconds(phases, end);
    const item = workItems.find((w) => w.id === current.workItemId) ?? null;
    if (seconds >= 60) {
      const session: WorkSession = {
        id: crypto.randomUUID(),
        subject: item?.subject ?? subject,
        exercise_id: null,
        started_at: new Date(current.startedAt).toISOString(),
        ended_at: new Date(end).toISOString(),
        duration_seconds: seconds,
        note: `Session : ${current.goal}${done ? " — objectif atteint" : ""}`,
        created_at: new Date().toISOString(),
        result: null,
        hints_used: null,
        work_item_id: item?.id ?? null,
      };
      saveSessions([session, ...sessions]);
    }
    if (item) {
      if (done && item.status !== "terminé") saveWorkItems(toggleWorkItemDone(workItems, item.id, new Date()));
      else if (!done && item.status === "à faire") saveWorkItems(workItems.map((w) => (w.id === item.id ? { ...w, status: "en cours" as const } : w)));
    }
    const nextWins = [{ goal: current.goal, at: new Date().toISOString(), done, minutes: Math.round(seconds / 60) }, ...readWins()].slice(0, 200);
    safeSet(WINS_KEY, JSON.stringify(nextWins));
    setWins(nextWins);
    safeSet(STORE_KEY, null);
    setCurrent(null);
    setFinishing(false);
    setGoal("");
    setGoalItemId(null);
    setCelebrate(done ? current.goal : null);
  }

  if (!loaded || !ready) return <Skeleton className="mx-auto h-[32rem] w-full max-w-xl rounded-2xl" />;

  /* ── 3. APRÈS ─────────────────────────────────────────────────────── */
  if (current && finishing) {
    const minutes = Math.round(workedSeconds(phases, Math.min(now, phases[phases.length - 1].end)) / 60);
    return (
      <div className="mx-auto max-w-xl text-center">
        <section className="surface reveal p-6 sm:p-8">
          <Flag className="mx-auto text-accent" size={36} aria-hidden />
          <h1 className="t-display mt-3">Objectif atteint ?</h1>
          <p className="mt-3 text-lg font-bold text-ink">{current.goal}</p>
          <p className="t-meta mt-1">{minutes} min de travail</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => finish(true)}>
              <Check size={18} aria-hidden /> Oui, c&apos;est fait
            </Button>
            <Button size="lg" variant="secondary" onClick={() => finish(false)}>
              Pas encore
            </Button>
          </div>
          {current.workItemId && <p className="t-meta mt-4">« Oui » coche la tâche ici et dans Rappels.</p>}
        </section>
      </div>
    );
  }

  /* ── 2. PENDANT ───────────────────────────────────────────────────── */
  if (current && state?.status === "en cours") {
    const { phase, remainingMs } = state;
    const length = phase.end - phase.start;
    const pause = phase.kind === "pause";
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className={cn("reveal mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold", pause ? "bg-emerald-400/15 text-emerald-300" : "bg-accent/10 text-accent")}>
          {pause ? <Coffee size={15} aria-hidden /> : <span aria-hidden className="h-2 w-2 animate-pulse-soft rounded-full bg-accent" />}
          {pause ? "Pause" : "Travail"} · cycle {phase.cycle}/{current.config.cycles}
        </p>
        <div className="reveal mt-6 flex justify-center" style={{ "--i": 1 } as CSSProperties}>
          <Ring value={(1 - remainingMs / length) * 100} size={280} strokeWidth={14}>
            <span className="flex flex-col items-center">
              <span role="timer" aria-label={`Temps restant : ${mmss(remainingMs)}`} className="t-figure text-[clamp(3.5rem,16vw,4.5rem)] leading-none tracking-[-0.05em] text-ink">
                {mmss(remainingMs)}
              </span>
              <span className="t-meta mt-2">{pause ? "avant de reprendre" : "avant la pause"}</span>
            </span>
          </Ring>
        </div>
        <p className="t-label mt-8">Objectif</p>
        <p className="mx-auto mt-1 max-w-[30ch] text-xl font-bold text-ink">{current.goal}</p>
        {pause && <p className="t-meta mt-2">Lève-toi, bois de l&apos;eau, pas de téléphone.</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {pause && (
            <Button variant="secondary" onClick={skipBreak}>
              <SkipForward size={16} aria-hidden /> Reprendre maintenant
            </Button>
          )}
          <Button variant="secondary" onClick={() => setFinishing(true)}>
            <Square size={15} aria-hidden /> Terminer
          </Button>
        </div>
        {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
          <p className="t-meta mx-auto mt-6 flex max-w-[36ch] items-center justify-center gap-1.5">
            <Bell size={13} aria-hidden /> Alertes sur la montre : lance la session avec le raccourci « Start session ».
          </p>
        )}
      </div>
    );
  }

  /* ── 1. AVANT ─────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-xl">
      <header className="reveal text-center">
        <h1 className="t-display">Session</h1>
        <p className="mt-1.5 text-[0.9375rem] font-semibold text-muted">Un objectif, des cycles, une case cochée.</p>
      </header>

      {celebrate && (
        <p role="status" className="reveal mt-6 flex items-center justify-center gap-2 rounded-2xl bg-accent/10 px-4 py-3 text-center font-bold text-ink">
          <Trophy size={18} className="text-accent" aria-hidden /> Bien joué : {celebrate}
        </p>
      )}

      <section className="surface reveal mt-6 p-5 sm:p-6" style={{ "--i": 1 } as CSSProperties}>
        <p className="t-label">Qu&apos;est-ce que tu vas finir ?</p>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {suggestions.map((s) => {
              const active = goalItemId === s.id && goal === s.title;
              return (
                <button
                  key={s.id ?? s.title}
                  type="button"
                  onClick={() => pick(s.id, s.title)}
                  className={cn("press flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-left", active ? "grad-brand" : "bg-inset text-ink hover:bg-hairline/[0.10]")}
                >
                  <span className="min-w-0 truncate font-semibold">{s.title}</span>
                  <span className={cn("shrink-0 text-xs font-semibold", active ? "opacity-90" : "text-muted")}>{s.reason}</span>
                </button>
              );
            })}
          </div>
        )}
        <label className="mt-3 block">
          <span className="sr-only">Objectif</span>
          <Input
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              setGoalItemId(null);
            }}
            placeholder="Ou écris-le : « exo 3 du TD séries »"
            maxLength={200}
          />
        </label>
        <p className="t-meta mt-2">Concret et finissable en une session, pas « réviser ».</p>

        {!workItems.find((w) => w.id === goalItemId)?.subject && (
          <label className="mt-4 block">
            <span className="t-label">Matière</span>
            <Select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="mt-1.5">
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
        )}
      </section>

      <section className="surface reveal mt-4 p-5 sm:p-6" style={{ "--i": 2 } as CSSProperties}>
        <p className="t-label">Rythme</p>
        <Choice label="Travail" value={config.workMinutes} options={[25, 40, 50, 60]} unit="min" onPick={(v) => updateConfig({ workMinutes: v })} />
        <Choice label="Pause" value={config.breakMinutes} options={[5, 10, 15]} unit="min" onPick={(v) => updateConfig({ breakMinutes: v })} />
        <Choice label="Cycles" value={config.cycles} options={[1, 2, 3, 4]} onPick={(v) => updateConfig({ cycles: v })} />
        <p className="t-meta mt-3">
          Fin dans {config.cycles * config.workMinutes + (config.cycles - 1) * config.breakMinutes} min · {config.cycles * config.workMinutes} min de travail
        </p>
      </section>

      <div className="reveal mt-6 flex justify-center" style={{ "--i": 3 } as CSSProperties}>
        <Button size="lg" onClick={start} disabled={!goal.trim()} className="min-w-56 rounded-full">
          <Play size={18} aria-hidden /> Lancer la session
        </Button>
      </div>

      {todayWins.length > 0 && (
        <section className="surface reveal mt-8 p-5 sm:p-6" style={{ "--i": 4 } as CSSProperties}>
          <p className="t-label">Aujourd&apos;hui</p>
          <ol className="mt-3 space-y-2">
            {todayWins.map((w) => (
              <li key={w.at} className="flex items-center gap-3">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", w.done ? "grad-brand" : "bg-inset text-muted")}>
                  {w.done ? <Check size={15} aria-hidden /> : <span className="text-xs font-bold">…</span>}
                </span>
                <span className={cn("min-w-0 flex-1 truncate font-semibold", w.done ? "text-ink" : "text-muted")}>{w.goal}</span>
                <span className="t-meta shrink-0">{w.minutes} min</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Choice({ label, value, options, unit, onPick }: { label: string; value: number; options: number[]; unit?: string; onPick: (v: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="font-semibold text-ink">{label}</span>
      <span role="radiogroup" aria-label={label} className="flex gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onPick(option)}
            className={cn("press min-h-10 min-w-12 rounded-full px-3 text-sm font-bold", value === option ? "grad-brand" : "bg-inset text-ink hover:bg-hairline/[0.10]")}
          >
            {option}
            {unit ? <span className="ml-0.5 text-xs font-semibold opacity-80">{unit}</span> : null}
          </button>
        ))}
      </span>
    </div>
  );
}
