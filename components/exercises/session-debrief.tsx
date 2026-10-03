"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ChapterSelect } from "@/components/exercises/chapter-select";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ATTEMPT_CAUSE_LABEL, ATTEMPT_CAUSES, ATTEMPT_HELP_LABEL, ATTEMPT_HELPS, ATTEMPT_RESULTS, EXERCISE_LEVEL_LABEL, EXERCISE_LEVELS, type AttemptCause, type AttemptHelp, type AttemptResult, type ExerciseAttempt, type ExerciseLevel } from "@/lib/attempts";
import { cn } from "@/lib/cn";
import type { Exercise } from "@/lib/exercises";
import { attemptsFromDebrief, emptyEntry, isComplete, prefillEntry, type DebriefEntry } from "@/lib/session-debrief";
import type { NextMoveRecord } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";
import { formatSpan } from "@/lib/utils";

const RESULT_STYLE: Record<AttemptResult, string> = {
  réussi: "bg-emerald-400/[0.16] text-emerald-300",
  partiel: "bg-amber-400/[0.16] text-amber-300",
  échec: "bg-rose-400/[0.14] text-rose-300",
};

/**
 * BILAN DE SÉANCE (lib/session-debrief.ts) — à l'arrêt du chrono, « qu'as-tu
 * fait ? ». Quelques gestes par exercice ; « Rien à noter » pour une séance
 * de cours ou de fiches. Rien n'est enregistré sans « Enregistrer ».
 */
export function SessionDebrief({
  session,
  move,
  exercises,
  onSave,
  onSkip,
}: {
  session: WorkSession;
  move: NextMoveRecord | null;
  exercises: Exercise[];
  onSave: (attempts: ExerciseAttempt[]) => void;
  onSkip: () => void;
}) {
  const [entries, setEntries] = useState<DebriefEntry[]>(() => [prefillEntry(move, session.subject, exercises)]);
  const ready = entries.filter(isComplete);
  const update = (index: number, patch: Partial<DebriefEntry>) => setEntries((list) => list.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)));

  return (
    <section aria-label="Bilan de la séance" className="surface reveal mt-7 px-5 py-6 text-left sm:mt-10 sm:p-8">
      <p className="t-label">Bilan de la séance</p>
      <h2 className="t-subhead mt-1">
        {formatSpan(session.duration_seconds)} de {session.subject} : qu&apos;as-tu fait ?
      </h2>
      <p className="t-meta mt-1">Le temps est enregistré. Note les exercices : c&apos;est ce qui dit à TaekdHub ce que tu sais faire — le temps seul ne prouve rien.</p>

      <ol className="mt-5 space-y-4">
        {entries.map((entry, index) => (
          <li key={index} className="well rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.9375rem] font-bold text-ink">
                {entry.mode === "refaire" ? `Refait : « ${entry.label} »` : entry.mode === "transfert" ? "Exercice de transfert" : `Exercice ${index + 1}`}
              </p>
              {entries.length > 1 && (
                <button type="button" aria-label="Retirer cette ligne" onClick={() => setEntries((list) => list.filter((_, at) => at !== index))} className="text-muted hover:text-ink">
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {entry.mode !== "refaire" && (
                <label className="block sm:col-span-2">
                  <span className="t-label mb-1.5 block">{entry.mode === "transfert" ? "Le nouvel énoncé" : "Exercice"}</span>
                  <Input value={entry.label} onChange={(event) => update(index, { label: event.target.value })} maxLength={160} placeholder="TD 4 — exercice 12" />
                </label>
              )}
              <fieldset className="sm:col-span-2">
                <legend className="t-label mb-1.5">Résultat</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ATTEMPT_RESULTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={entry.result === value}
                      onClick={() => update(index, { result: value, cause: value === "réussi" ? null : entry.cause })}
                      className={cn("min-h-11 rounded-xl text-[0.875rem] font-extrabold capitalize transition-colors", entry.result === value ? RESULT_STYLE[value] : "bg-inset text-muted hover:text-ink")}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="t-label mb-1.5 block">Aide utilisée</span>
                <Select value={entry.help} onChange={(event) => update(index, { help: event.target.value as AttemptHelp })}>
                  {ATTEMPT_HELPS.map((value) => (
                    <option key={value} value={value}>
                      {ATTEMPT_HELP_LABEL[value]}
                    </option>
                  ))}
                </Select>
              </label>
              {entry.result && entry.result !== "réussi" ? (
                <label className="block">
                  <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
                  <Select value={entry.cause ?? ""} onChange={(event) => update(index, { cause: (event.target.value || null) as AttemptCause | null })}>
                    <option value="">Non précisé</option>
                    {ATTEMPT_CAUSES.map((value) => (
                      <option key={value} value={value}>
                        {ATTEMPT_CAUSE_LABEL[value]}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <span aria-hidden className="hidden sm:block" />
              )}
              {entry.mode === "nouveau" && (
                <>
                  <label className="block">
                    <span className="t-label mb-1.5 block">Chapitre</span>
                    <ChapterSelect subject={session.subject} value={entry.chapterId} onChange={(chapterId) => update(index, { chapterId })} />
                  </label>
                  <label className="block">
                    <span className="t-label mb-1.5 block">Difficulté</span>
                    <Select value={entry.level ?? ""} onChange={(event) => update(index, { level: (event.target.value || null) as ExerciseLevel | null })}>
                      <option value="">Non précisée</option>
                      {EXERCISE_LEVELS.map((value) => (
                        <option key={value} value={value}>
                          {EXERCISE_LEVEL_LABEL[value]}
                        </option>
                      ))}
                    </Select>
                  </label>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button disabled={ready.length === 0} onClick={() => onSave(attemptsFromDebrief(entries, session, exercises))}>
          Enregistrer {ready.length > 0 ? `${ready.length} exercice${ready.length > 1 ? "s" : ""}` : ""}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEntries((list) => [...list, emptyEntry(list[list.length - 1]?.chapterId ?? null)])}>
          <Plus size={14} aria-hidden /> Un autre exercice
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Rien à noter (cours, fiches)
        </Button>
      </div>
    </section>
  );
}
