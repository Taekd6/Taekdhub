"use client";

import { Clock3, Eye, EyeOff, Target } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { MasteryPicker, PriorityPicker } from "@/components/exercises/exercise-badges";
import type { Exercise, Mastery, Priority } from "@/lib/supabase/types";

export function ExerciseDetail({
  item,
  update,
  minutesSpent,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  /** Temps réellement passé sur cet exercice, en minutes — dérivé des WorkSession liées (voir lib/study.ts). */
  minutesSpent: number;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  return (
    <div className="grid gap-5 bg-black/10 p-5 md:grid-cols-2">
      <div>
        <p className="eyebrow">Notes</p>
        <Textarea
          value={item.note || ""}
          onChange={(event) => update(item.id, { note: event.target.value || null })}
          className="mt-2 min-h-24"
          placeholder="Ce que tu veux retenir, les erreurs à éviter…"
        />
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Mode résolution</p>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock3 size={13} /> {minutesSpent} min passées
            </span>
            <label className="flex items-center gap-1.5">
              <Target size={13} />
              <Input
                type="number"
                min={0}
                value={item.estimated_minutes ?? ""}
                onChange={(event) => update(item.id, { estimated_minutes: event.target.value ? Math.max(0, Number(event.target.value)) : null })}
                placeholder="estimé"
                className="h-7 w-20 px-2 py-0 text-xs"
              />
              min
            </label>
            {/* Sprint 2.5 : attempts est incrémenté automatiquement par le mode focus, plus de contrôle manuel — voir focus-view.tsx. */}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-zinc-300">{item.attempts}</span> tentative{item.attempts > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Priorité
            <PriorityPicker value={item.priority} onChange={(priority: Priority) => update(item.id, { priority })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Maîtrise
            <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
          </label>
        </div>
        {item.hints.slice(0, hintCount).map((hint, index) => (
          <p key={index} className="rounded-xl border border-accent/15 bg-accent/[0.055] p-3 text-sm leading-6 text-zinc-300">
            Indice {index + 1} — {hint}
          </p>
        ))}
        {hintCount < item.hints.length && (
          <Button variant="ghost" onClick={() => setHintCount((count) => count + 1)} className="text-accent">
            Afficher l&apos;indice {hintCount + 1}
          </Button>
        )}
        {item.correction && (
          <div>
            <Button variant="ghost" onClick={() => setCorrectionVisible((value) => !value)}>
              {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
            </Button>
            {correctionVisible && (
              <p className="mt-3 whitespace-pre-line rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">
                {item.correction}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
