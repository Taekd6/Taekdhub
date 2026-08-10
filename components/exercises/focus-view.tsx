"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Minimize2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryPicker, PriorityPicker, SubjectAvatar } from "@/components/exercises/exercise-badges";
import { RichMath } from "@/components/rich-math";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { formatDuration, secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, ExerciseStatus, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

/** Une seule séance focus à la fois : la clé encode l'exercice concerné, ce qui permet de retrouver après un rechargement lequel reprendre automatiquement. */
export const FOCUS_TIMER_PREFIX = "prepahub:timer:focus:";
const focusTimerKey = (exerciseId: string) => `${FOCUS_TIMER_PREFIX}${exerciseId}`;

export function FocusView({
  item,
  update,
  sessions,
  saveSessions,
  onClose,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  sessions: WorkSession[];
  saveSessions: (sessions: WorkSession[]) => void;
  onClose: () => void;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const { seconds, running, toggle, stop } = useWorkTimer<{ exerciseId: string }>(focusTimerKey(item.id), {
    exerciseId: item.id,
  });

  /** Micro-célébration au moment précis où l'exercice devient "maîtrisé" — jamais au montage sur un exercice déjà maîtrisé, ni sur les autres transitions de statut. */
  const [justMastered, setJustMastered] = useState(false);
  const previousStatus = useRef(item.status);
  useEffect(() => {
    const wasMastered = previousStatus.current === "maîtrisé";
    previousStatus.current = item.status;
    if (wasMastered || item.status !== "maîtrisé") return;
    setJustMastered(true);
    const timeout = setTimeout(() => setJustMastered(false), 1600);
    return () => clearTimeout(timeout);
  }, [item.status]);

  // Clôt la séance quel que soit le chemin de sortie (Echap, croix, réduire) :
  // c'est le seul endroit qui décide de la fin du focus, pour ne jamais
  // perdre de temps enregistré ni oublier de créer la WorkSession.
  const endSession = useCallback(() => {
    stop(({ startedAt, seconds: finalSeconds }) => {
      const session: WorkSession = {
        id: crypto.randomUUID(),
        subject: item.subject,
        // Sprint 2.5 : lien réel vers l'exercice (avant, seul `note` le référençait en texte).
        exercise_id: item.id,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: finalSeconds,
        note: `Exercice focus : ${item.title} (${item.source})`,
        created_at: new Date().toISOString(),
      };
      saveSessions([session, ...sessions]);
      // Une séance d'au moins une minute compte comme une vraie séance de
      // travail : incrémente `attempts` (Sprint 2.5) et marque
      // `last_worked_at` (Sprint 2.6) — aucun des deux n'a de contrôle
      // manuel. Pas de mise à jour de durée ici : depuis le Sprint 2.6, le
      // temps passé se dérive des WorkSession liées (minutesSpentOnExercise,
      // lib/study.ts), il n'est plus stocké sur `Exercise`.
      if (secondsToWholeMinutes(finalSeconds) > 0) {
        update(item.id, { attempts: item.attempts + 1, last_worked_at: new Date().toISOString() });
      }
    });
    onClose();
  }, [stop, item, sessions, saveSessions, update, onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") endSession();
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [endSession, toggle]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <SubjectAvatar subject={item.subject} />
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-zinc-500">{item.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums text-sm text-zinc-400">{formatDuration(seconds)}</span>
          <Button variant={running ? "secondary" : "primary"} size="sm" onClick={toggle}>
            {running ? "Pause" : "Timer"}
          </Button>
          <Button variant="ghost" size="icon" onClick={endSession}>
            <Minimize2 size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={endSession}>
            <X size={18} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <DifficultyDots value={item.difficulty} />
          <Badge>{item.type}</Badge>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Priorité
            <PriorityPicker value={item.priority} onChange={(priority: Priority) => update(item.id, { priority })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Maîtrise
            <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
          </label>
        </div>
        <h1 className="mt-6 max-w-2xl text-center text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
        <p className="mt-3 text-sm text-zinc-500">{item.subject} · {item.source}</p>

        <div className="mt-12 w-full max-w-xl space-y-4">
          {item.hints.slice(0, hintCount).map((hint, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-accent/15 bg-accent/[0.055] p-4 text-sm leading-7 text-zinc-300"
            >
              <RichMath text={`Indice ${index + 1} — ${hint}`} />
            </motion.div>
          ))}
          {hintCount < item.hints.length && (
            <Button variant="secondary" onClick={() => setHintCount((c) => c + 1)} className="w-full">
              Afficher l&apos;indice {hintCount + 1}
            </Button>
          )}
          {item.correction && (
            <div className="text-center">
              <Button variant="ghost" onClick={() => setCorrectionVisible((v) => !v)}>
                {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
              </Button>
              {correctionVisible && (
                <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 text-left text-sm leading-7 text-zinc-300">
                  <RichMath text={item.correction} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center gap-2">
          {(["à faire", "en cours", "à revoir", "maîtrisé"] as ExerciseStatus[]).map((s) => (
            <Button
              key={s}
              variant={item.status === s ? "primary" : "secondary"}
              size="sm"
              onClick={() => update(item.id, { status: s })}
            >
              {s}
            </Button>
          ))}
          <AnimatePresence>
            {justMastered && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
                className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent"
              >
                <Sparkles size={13} /> Maîtrisé !
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className="border-t border-white/[0.07] px-6 py-4 text-center text-xs text-zinc-600">
        Échap pour quitter · Barre d&apos;espace pour le timer
      </footer>
    </motion.div>
  );
}
