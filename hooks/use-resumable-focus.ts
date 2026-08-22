"use client";

import { useEffect, useState } from "react";
import { findPersistedFocusDraft } from "@/lib/focus-draft";
import { FOCUS_TIMER_PREFIX } from "@/lib/focus-timer-key";
import { resolveResumableFocus, type ResumeSignal } from "@/lib/resume";
import { computeElapsedSeconds, findPersistedSessionSuffix, findRecoverableCheckpoint, readSnapshot } from "@/hooks/use-work-timer";
import type { Exercise } from "@/lib/supabase/types";

/**
 * « Où me suis-je arrêté ? » côté Dashboard (Sprint poste de pilotage) —
 * lit les TROIS MÊMES sources que le mécanisme déjà en place dans
 * exercise-manager.tsx#resumeChecked (draft/sessionStorage/checkpoint),
 * jamais un second système : la décision de priorité elle-même vit dans
 * `resolveResumableFocus` (lib/resume.ts), pure et testée.
 *
 * `null` tant que `ready` est faux (pas encore de banque à vérifier contre)
 * ou qu'aucune séance n'est réellement récupérable.
 */
export function useResumableFocus(exercises: Exercise[], ready: boolean): ResumeSignal | null {
  const [resumable, setResumable] = useState<ResumeSignal | null>(null);

  useEffect(() => {
    if (!ready) {
      setResumable(null);
      return;
    }

    const draftSession = findPersistedFocusDraft();
    const draft: ResumeSignal | null = draftSession?.exercise_id
      ? { exerciseId: draftSession.exercise_id, seconds: draftSession.duration_seconds }
      : null;

    const activeId = findPersistedSessionSuffix(FOCUS_TIMER_PREFIX);
    const active: ResumeSignal | null = activeId
      ? { exerciseId: activeId, seconds: computeElapsedSeconds(readSnapshot(`${FOCUS_TIMER_PREFIX}${activeId}`)) }
      : null;

    const recovered = findRecoverableCheckpoint(FOCUS_TIMER_PREFIX);
    const checkpoint: ResumeSignal | null = recovered ? { exerciseId: recovered.suffix, seconds: recovered.checkpoint.seconds } : null;

    const isUsable = (id: string) => exercises.some((item) => item.id === id && !item.archived);
    setResumable(resolveResumableFocus(draft, active, checkpoint, isUsable));
  }, [ready, exercises]);

  return resumable;
}
