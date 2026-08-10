"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Minimize2, MinusCircle, Sparkles, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryPicker, PriorityPicker, SubjectAvatar } from "@/components/exercises/exercise-badges";
import { RichMath } from "@/components/rich-math";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { formatDuration, secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, ExerciseStatus, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

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

  // Séance arrêtée (timer stoppé, WorkSession pas encore sauvegardée) en
  // attente d'un résultat — voir `endSession`/`commitResult` ci-dessous.
  // `null` : soit le focus est toujours en cours, soit aucune séance n'a
  // jamais démarré (rien à qualifier).
  const [draftSession, setDraftSession] = useState<WorkSession | null>(null);

  // Arrête le timer et construit la WorkSession SANS la sauvegarder ni fermer
  // le focus — voir `commitResult`, seul endroit qui la sauvegarde vraiment,
  // une fois le résultat choisi (ou explicitement passé). `stop()` appelle
  // son callback de façon SYNCHRONE (hooks/use-work-timer.ts) : la variable
  // locale `captured` reflète donc fidèlement, dès la fin de cet appel, s'il
  // y avait quelque chose à enregistrer.
  const endSession = useCallback(() => {
    let captured: { startedAt: string; seconds: number } | null = null;
    stop(({ startedAt, seconds: finalSeconds }) => {
      captured = { startedAt, seconds: finalSeconds };
    });
    if (!captured) {
      // Aucune seconde enregistrée (focus ouvert puis refermé aussitôt) :
      // rien à qualifier, comportement inchangé — on ferme directement.
      onClose();
      return;
    }
    const { startedAt, seconds: finalSeconds } = captured;
    setDraftSession({
      id: crypto.randomUUID(),
      subject: item.subject,
      // Sprint 2.5 : lien réel vers l'exercice (avant, seul `note` le référençait en texte).
      exercise_id: item.id,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duration_seconds: finalSeconds,
      note: `Exercice focus : ${item.title} (${item.source})`,
      created_at: new Date().toISOString(),
      result: null,
    });
  }, [stop, item, onClose]);

  // Sauvegarde réellement la séance — avec le résultat choisi, ou `null` si
  // l'utilisateur a préféré passer cette étape (Échap depuis l'écran de
  // résultat, ou bouton "Passer") : dans les deux cas, exactement le même
  // comportement qu'avant l'introduction du résultat (temps enregistré,
  // `attempts`/`last_worked_at` mis à jour si ≥ 1 minute), rien n'est perdu.
  const commitResult = useCallback(
    (result: AttemptResult | null) => {
      if (draftSession) {
        const finalSession: WorkSession = { ...draftSession, result };
        saveSessions([finalSession, ...sessions]);
        if (secondsToWholeMinutes(finalSession.duration_seconds) > 0) {
          update(item.id, { attempts: item.attempts + 1, last_worked_at: new Date().toISOString() });
        }
      }
      onClose();
    },
    [draftSession, sessions, saveSessions, item, update, onClose]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (draftSession) {
        // Écran de résultat : Échap = passer (pas de choix forcé), le reste
        // (barre d'espace notamment) n'a plus de sens ici, timer déjà arrêté.
        if (event.key === "Escape") commitResult(null);
        return;
      }
      if (event.key === "Escape") endSession();
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftSession, commitResult, endSession, toggle]);

  if (draftSession) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-canvas px-6 text-center"
      >
        <div>
          <p className="text-base font-semibold text-zinc-100">Comment s&apos;est passé l&apos;exercice ?</p>
          <p className="mt-1.5 text-sm text-zinc-500">{item.title}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Button
            size="lg"
            onClick={() => commitResult("réussi")}
            className="justify-start gap-3 border border-emerald-400/20 bg-emerald-400/[0.12] text-emerald-200 hover:bg-emerald-400/20"
          >
            <CheckCircle2 size={18} /> Réussi
          </Button>
          <Button
            size="lg"
            onClick={() => commitResult("partiel")}
            className="justify-start gap-3 border border-amber-400/20 bg-amber-400/[0.12] text-amber-200 hover:bg-amber-400/20"
          >
            <MinusCircle size={18} /> Partiellement réussi
          </Button>
          <Button
            size="lg"
            onClick={() => commitResult("échoué")}
            className="justify-start gap-3 border border-rose-400/20 bg-rose-400/[0.12] text-rose-200 hover:bg-rose-400/20"
          >
            <XCircle size={18} /> Échoué
          </Button>
        </div>
        <button
          type="button"
          onClick={() => commitResult(null)}
          className="focus-ring rounded-lg px-2 py-1 text-xs text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400"
        >
          Passer
        </button>
      </motion.div>
    );
  }

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

      {/* Contenu défilable : l'énoncé (contenu principal) prime sur le chrono, resté dans le bandeau supérieur, secondaire dans la hiérarchie visuelle. */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{item.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{item.subject} · {item.source}</p>

          {/* Énoncé — cœur de la séance : immédiatement visible, sans clic ni révélation, contrairement aux indices/correction. */}
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
            {item.statement.trim() ? (
              <RichMath text={item.statement} className="text-base leading-8 text-zinc-100" />
            ) : (
              <p className="text-sm italic leading-7 text-zinc-500">
                Aucun énoncé renseigné pour cet exercice — ouvre sa fiche (hors mode focus) pour l&apos;ajouter.
              </p>
            )}
          </div>

          <div className="mt-6 space-y-3">
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
              <div>
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

          <div className="mt-8 flex flex-wrap items-center gap-2">
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
      </div>

      <footer className="border-t border-white/[0.07] px-6 py-4 text-center text-xs text-zinc-600">
        Échap pour quitter · Barre d&apos;espace pour le timer
      </footer>
    </motion.div>
  );
}
