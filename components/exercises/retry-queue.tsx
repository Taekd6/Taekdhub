"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, EyeOff, Plus, RotateCcw } from "lucide-react";
import { ChapterSelect } from "@/components/exercises/chapter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { useAnnales } from "@/hooks/use-annales";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import {
  ATTEMPT_CAUSE_LABEL,
  ATTEMPT_CAUSES,
  ATTEMPT_HELP_LABEL,
  ATTEMPT_HELPS,
  ATTEMPT_RESULTS,
  upsertAttempts,
  type AttemptCause,
  type AttemptHelp,
  type AttemptResult,
} from "@/lib/attempts";
import { cn } from "@/lib/cn";
import { buildExercises, createRetryAttempt, dueRetries, progressLine, upcomingRetries, type Exercise } from "@/lib/exercises";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { dayKey, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function fmtDay(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

const RESULT_STYLE: Record<AttemptResult, string> = {
  réussi: "bg-emerald-400/[0.16] text-emerald-300",
  partiel: "bg-amber-400/[0.16] text-amber-300",
  échec: "bg-rose-400/[0.14] text-rose-300",
};

/**
 * « À REFAIRE SANS AIDE » — la file des exercices ratés (lib/exercises.ts).
 *
 * Un exercice raté revient à la date programmée. On le refait CORRECTION
 * CACHÉE, chrono lancé, puis on dit honnêtement le résultat et l'aide
 * utilisée. Seule une réussite sans aide le sort de la file.
 *
 * Fonctionne sans compte et hors ligne : les tentatives saisies ici vivent
 * dans la collection `attempts`. Les annales du compte (useAnnales) s'y
 * ajoutent quand elles sont disponibles.
 *
 * `?refaire=<clé>` ouvre directement un exercice (lien de Next Move).
 */
export function RetryQueue() {
  const params = useSearchParams();
  const { attempts, saveAttempts, preferences, ready } = usePrepahubData();
  const { logs } = useAnnales();
  const today = dayKey(new Date());
  const exercises = useMemo(() => buildExercises({ annales: logs, attempts, retryDelaysDays: preferences.retryDelaysDays, today }), [logs, attempts, preferences.retryDelaysDays, today]);
  const due = useMemo(() => dueRetries(exercises), [exercises]);
  const upcoming = useMemo(() => upcomingRetries(exercises).slice(0, 5), [exercises]);
  const verified = useMemo(() => exercises.filter((exercise) => exercise.status === "vérifié").sort((a, b) => (b.verifiedOn ?? "").localeCompare(a.verifiedOn ?? "")).slice(0, 5), [exercises]);
  const [openKey, setOpenKey] = useState<string | null>(() => params.get("refaire"));
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  if (!ready) return null;
  const open = openKey ? exercises.find((exercise) => exercise.key === openKey) ?? null : null;

  function record(exercise: Exercise, input: { result: AttemptResult; help: AttemptHelp; minutes: number | null; cause: AttemptCause | null; lackOfTime: boolean; note: string }) {
    const attempt = createRetryAttempt(exercise, input, new Date());
    if (!attempt) return;
    saveAttempts(upsertAttempts(attempts, [attempt]));
    setOpenKey(null);
    setFlash(
      input.result === "réussi" && input.help === "sans"
        ? `« ${exercise.label} » : réussi sans aide. La correction est vérifiée.`
        : `« ${exercise.label} » : noté. L'exercice reviendra plus tard — c'est la règle tant qu'il n'est pas réussi sans aide.`
    );
  }

  return (
    <Section
      variant="panel"
      title="À refaire sans aide"
      description={
        due.length > 0
          ? `${due.length} exercice${due.length > 1 ? "s" : ""} à refaire aujourd'hui. Correction cachée, chrono lancé, puis un résultat honnête.`
          : "Rien à refaire aujourd'hui. Les exercices ratés reviennent ici à la date prévue."
      }
      action={
        <Button variant="ghost" size="sm" onClick={() => setAdding((value) => !value)} aria-expanded={adding}>
          <Plus size={14} aria-hidden /> Noter un exercice
        </Button>
      }
    >
      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink">
          {flash}
        </p>
      )}

      {adding && <NewExerciseForm onCancel={() => setAdding(false)} onSave={(attempt) => { saveAttempts(upsertAttempts(attempts, [attempt])); setAdding(false); setFlash(`« ${attempt.label} » noté.`); }} />}

      {open ? (
        <RetrySession key={open.key} exercise={open} onCancel={() => setOpenKey(null)} onSave={(input) => record(open, input)} />
      ) : (
        <>
          {due.length > 0 && (
            <ul className="divide-y divide-line">
              {due.map((exercise) => (
                <ExerciseRow key={exercise.key} exercise={exercise} action={<Button size="sm" onClick={() => { setFlash(null); setOpenKey(exercise.key); }}><RotateCcw size={14} aria-hidden /> Refaire</Button>} />
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Programmés</p>
              <ul className="divide-y divide-line">
                {upcoming.map((exercise) => (
                  <ExerciseRow key={exercise.key} exercise={exercise} action={<span className="t-meta text-2xs">le {fmtDay(exercise.nextRetryDay!)}</span>} />
                ))}
              </ul>
            </>
          )}
          {verified.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Corrections vérifiées</p>
              <ul className="divide-y divide-line">
                {verified.map((exercise) => (
                  <ExerciseRow key={exercise.key} exercise={exercise} action={<Badge variant="success"><CheckCircle2 size={12} aria-hidden /> {fmtDay(exercise.verifiedOn!)}</Badge>} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Section>
  );
}

function ExerciseRow({ exercise, action }: { exercise: Exercise; action: React.ReactNode }) {
  const chapter = exercise.chapterId ? PROGRAMME_BY_ID.get(exercise.chapterId) : null;
  const last = exercise.steps[exercise.steps.length - 1];
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-bold text-ink">{exercise.label}</p>
        <p className="t-meta text-2xs">
          {exercise.subject ?? "Matière inconnue"}
          {chapter ? ` · ${chapter.title}` : ""} · dernier essai {last.result}, {ATTEMPT_HELP_LABEL[last.help].toLowerCase()}
          {!last.helpDeclared ? " (déduit des indices)" : ""}
        </p>
        {exercise.changeApproach && <p className="mt-1 text-2xs font-bold text-amber-300">{exercise.changeApproach}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function RetrySession({
  exercise,
  onCancel,
  onSave,
}: {
  exercise: Exercise;
  onCancel: () => void;
  onSave: (input: { result: AttemptResult; help: AttemptHelp; minutes: number | null; cause: AttemptCause | null; lackOfTime: boolean; note: string }) => void;
}) {
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [help, setHelp] = useState<AttemptHelp>("sans");
  const [minutes, setMinutes] = useState("");
  const [cause, setCause] = useState<AttemptCause | null>(null);
  const [lackOfTime, setLackOfTime] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.round((now - started.current) / 60_000);
  const progress = progressLine(exercise);
  const minutesValue = minutes.trim() === "" ? elapsed : Number(minutes);

  return (
    <div className="well rounded-2xl p-4 sm:p-5">
      <p className="t-subhead">{exercise.label}</p>
      <p className="t-meta mt-1">
        {exercise.steps.length} tentative{exercise.steps.length > 1 ? "s" : ""} avant celle-ci{progress ? ` · ${progress}` : ""}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-bold text-ink">
        <EyeOff size={14} aria-hidden /> Correction cachée : ne l&apos;ouvre qu&apos;après avoir fini.
      </p>
      <p className="mt-3 font-mono text-2xl font-black tabular-nums text-muted" aria-live="off">
        {elapsed} min
      </p>

      <fieldset className="mt-4">
        <legend className="t-label mb-2">Résultat</legend>
        <div className="grid grid-cols-3 gap-2">
          {ATTEMPT_RESULTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={result === value}
              onClick={() => setResult(value)}
              className={cn("min-h-11 rounded-xl text-[0.875rem] font-extrabold capitalize transition-colors", result === value ? RESULT_STYLE[value] : "bg-inset text-muted hover:text-ink")}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="t-label mb-1.5 block">Aide utilisée</span>
          <Select value={help} onChange={(event) => setHelp(event.target.value as AttemptHelp)}>
            {ATTEMPT_HELPS.map((value) => (
              <option key={value} value={value}>
                {ATTEMPT_HELP_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Temps (min)</span>
          <Input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder={String(elapsed)} />
        </label>
        {result && result !== "réussi" && (
          <label className="block sm:col-span-2">
            <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
            <Select value={cause ?? ""} onChange={(event) => setCause((event.target.value || null) as AttemptCause | null)}>
              <option value="">Non précisé</option>
              {ATTEMPT_CAUSES.map((value) => (
                <option key={value} value={value}>
                  {ATTEMPT_CAUSE_LABEL[value]}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-muted sm:col-span-2">
          <input type="checkbox" checked={lackOfTime} onChange={(event) => setLackOfTime(event.target.checked)} className="h-4 w-4 accent-[var(--btn-g1)]" />
          J&apos;ai manqué de temps
        </label>
        <label className="block sm:col-span-2">
          <span className="t-label mb-1.5 block">Note (facultatif)</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={400} placeholder="Ce qui a débloqué, ou ce qui manque encore" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button disabled={!result} onClick={() => result && onSave({ result, help, minutes: Number.isFinite(minutesValue) ? minutesValue : null, cause, lackOfTime, note })}>
          Enregistrer la tentative
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function NewExerciseForm({ onCancel, onSave }: { onCancel: () => void; onSave: (attempt: NonNullable<ReturnType<typeof createRetryAttempt>>) => void }) {
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult>("échec");
  const [help, setHelp] = useState<AttemptHelp>("sans");
  const [cause, setCause] = useState<AttemptCause | null>(null);
  const [minutes, setMinutes] = useState("");

  function save() {
    const name = label.trim();
    if (!name) return;
    const key = `exercice:${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
    const attempt = createRetryAttempt({ key, label: name, subject, chapterId, origin: "exercice" }, { result, help, minutes: minutes ? Number(minutes) : null, cause }, new Date());
    if (attempt) onSave(attempt);
  }

  return (
    <div className="well mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="t-label mb-1.5 block">Exercice</span>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder="TD 4 — exercice 12" />
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Matière</span>
        <Select value={subject} onChange={(event) => { setSubject(event.target.value as Subject); setChapterId(null); }}>
          {subjects.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Chapitre</span>
        <ChapterSelect subject={subject} value={chapterId} onChange={setChapterId} />
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Résultat</span>
        <Select value={result} onChange={(event) => setResult(event.target.value as AttemptResult)}>
          {ATTEMPT_RESULTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Aide</span>
        <Select value={help} onChange={(event) => setHelp(event.target.value as AttemptHelp)}>
          {ATTEMPT_HELPS.map((value) => (
            <option key={value} value={value}>
              {ATTEMPT_HELP_LABEL[value]}
            </option>
          ))}
        </Select>
      </label>
      {result !== "réussi" && (
        <label className="block">
          <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
          <Select value={cause ?? ""} onChange={(event) => setCause((event.target.value || null) as AttemptCause | null)}>
            <option value="">Non précisé</option>
            {ATTEMPT_CAUSES.map((value) => (
              <option key={value} value={value}>
                {ATTEMPT_CAUSE_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="block">
        <span className="t-label mb-1.5 block">Temps (min)</span>
        <Input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" onClick={save} disabled={!label.trim()}>
          Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
