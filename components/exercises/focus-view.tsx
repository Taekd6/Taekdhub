"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, MinusCircle, Sparkles, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryPicker, PriorityPicker, SubjectAvatar } from "@/components/exercises/exercise-badges";
import { RichMath } from "@/components/rich-math";
import { WhyThisExercise } from "@/components/exercises/why-this-exercise";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { type RecoveredTimerSeed, useWorkTimer } from "@/hooks/use-work-timer";
import { clearFocusDraft, writeFocusDraft } from "@/lib/focus-draft";
import { shouldConfirmExit } from "@/lib/focus-exit";
import { FOCUS_TIMER_PREFIX } from "@/lib/focus-timer-key";
import { levelFromXp, totalXp, xpFromExercise, xpFromSession, xpProgressInLevel } from "@/lib/gamification";
import { formatDuration, secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, ExerciseStatus, Mastery, Priority, WorkSession } from "@/lib/supabase/types";

/** Réexportée pour ne rien changer aux imports existants (exercise-manager.tsx, session-runner.tsx) — définition réelle dans lib/focus-timer-key.ts, voir sa doc. */
export { FOCUS_TIMER_PREFIX };
/** Une seule séance focus à la fois : la clé encode l'exercice concerné, ce qui permet de retrouver après un rechargement lequel reprendre automatiquement. */
const focusTimerKey = (exerciseId: string) => `${FOCUS_TIMER_PREFIX}${exerciseId}`;

/**
 * Micro-sprint polish UX final — même vocabulaire de couleurs que l'écran
 * "Comment s'est passé l'exercice ?" juste en dessous (emerald/amber/rose) :
 * un seul système de couleurs pour le résultat dans tout ce composant.
 */
const RESULT_META: Record<AttemptResult, { label: string; icon: typeof CheckCircle2; className: string }> = {
  "réussi": { label: "Réussi", icon: CheckCircle2, className: "text-emerald-300" },
  "partiel": { label: "Partiellement réussi", icon: MinusCircle, className: "text-amber-300" },
  "échoué": { label: "Échoué", icon: XCircle, className: "text-rose-300" },
};

export function FocusView({
  item,
  update,
  exercises,
  sessions,
  saveSessions,
  onClose,
  /** Draft post-"Terminer" retrouvé au démarrage (voir `findPersistedFocusDraft`) — rouvre directement l'écran de résultat plutôt que l'énoncé. */
  initialDraft,
  /** Séance récupérée depuis un checkpoint localStorage (voir hooks/use-work-timer.ts#findRecoverableCheckpoint) — absent dans le cas normal (reprise sessionStorage ou nouvelle séance). */
  recoveredSeed,
  /**
   * Micro-sprint « Ah ouais » — raisons DÉJÀ produites par
   * `lib/recommendation.ts#recommendExercises` pour CET exercice précis,
   * quand l'appelant les a sous la main (voir session-runner.tsx, qui
   * conserve `ExerciseRecommendation.reasons` dans sa file). `undefined`
   * quand Focus est ouvert depuis la simple navigation dans la banque
   * (exercise-manager.tsx) : aucune recommandation n'a alors eu lieu, donc
   * rien à afficher plutôt qu'un "pourquoi" inventé — voir `WhyThisExercise`.
   */
  reasons,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  /**
   * Banque complète (Sprint priorisation + sync + XP) — nécessaire UNIQUEMENT
   * pour calculer le total XP/niveau après cette séance (voir `commitResult`
   * plus bas, `lib/gamification.ts#totalXp`) : `item` seul suffit à tout le
   * reste de ce composant. Purement additif — aucune logique de Focus
   * existante n'en dépend.
   */
  exercises: Exercise[];
  sessions: WorkSession[];
  saveSessions: (sessions: WorkSession[]) => void;
  /** Appelé à la fermeture du focus, avec le résultat choisi — `null`/`undefined` si aucune séance n'a été enregistrée (rien à qualifier) ou si l'utilisateur a passé l'étape. */
  onClose: (result?: AttemptResult | null) => void;
  initialDraft?: WorkSession;
  recoveredSeed?: RecoveredTimerSeed;
  reasons?: string[];
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const { seconds, running, toggle, stop, resumedSeconds, autoPaused } = useWorkTimer<{ exerciseId: string }>(
    focusTimerKey(item.id),
    { exerciseId: item.id },
    recoveredSeed
  );
  // Focus est un overlay plein écran tant qu'il est monté (quel que soit
  // l'écran affiché ci-dessous) — jamais de scroll accidentel du contenu
  // derrière lui (Sprint Mobile UX + PWA Foundation, voir
  // hooks/use-scroll-lock.ts). Aucune interaction avec le chrono.
  useScrollLock(true);

  /** Micro-célébration au moment précis où l'exercice devient "maîtrisé" — jamais au montage sur un exercice déjà maîtrisé, ni sur les autres transitions de statut. */
  const [justMastered, setJustMastered] = useState(false);
  const previousStatus = useRef(item.status);
  /**
   * XP de maîtrise réellement gagné PENDANT cette visite (Sprint priorisation
   * + sync + XP) — accumulé uniquement au moment précis où `justMastered`
   * se déclenche ci-dessous (même garde, jamais dupliquée), jamais recalculé
   * depuis l'état courant de `item` : un exercice déjà maîtrisé AVANT
   * l'ouverture du Focus ne doit jamais réattribuer son XP de maîtrise à
   * cette séance. Lu par `commitResult` plus bas pour le feedback de fin de
   * séance — jamais réinitialisé pendant la vie du composant (une seule
   * visite Focus = un seul `commitResult` possible, voir `resultCommittedRef`).
   */
  const masteryXpEarnedRef = useRef(0);
  useEffect(() => {
    const wasMastered = previousStatus.current === "maîtrisé";
    previousStatus.current = item.status;
    if (wasMastered || item.status !== "maîtrisé") return;
    setJustMastered(true);
    masteryXpEarnedRef.current += xpFromExercise(item);
    const timeout = setTimeout(() => setJustMastered(false), 1600);
    return () => clearTimeout(timeout);
  }, [item.status]);

  // Séance arrêtée (timer stoppé, WorkSession pas encore sauvegardée) en
  // attente d'un résultat — voir `endSession`/`commitResult` ci-dessous.
  // `null` : soit le focus est toujours en cours, soit aucune séance n'a
  // jamais démarré (rien à qualifier). Initialisé depuis `initialDraft`
  // (Task 5) quand un rechargement/une réouverture retrouve un draft déjà
  // persisté : on rouvre directement l'écran de résultat plutôt que de
  // perdre la séance déjà arrêtée.
  const [draftSession, setDraftSession] = useState<WorkSession | null>(initialDraft ?? null);

  // Empêche un double appel dans le même tick (double Échap, double clic —
  // voir Task 13) de construire deux drafts / d'arrêter le timer deux fois :
  // une ref se lit/s'écrit de façon synchrone, contrairement à l'état React
  // (batché), donc reste fiable même si les deux appels tombent avant le
  // premier re-rendu.
  const endingRef = useRef(false);
  // Même garde pour `commitResult` (double clic sur un bouton de résultat,
  // double "1"/"2"/"3") — sans elle, un second appel avant re-rendu verrait
  // encore `draftSession` non vidé et sauvegarderait/avancerait la séance une
  // seconde fois (voir Task 4 : jamais deux WorkSession pour une interruption).
  const resultCommittedRef = useRef(false);

  // Arrête le timer et construit la WorkSession SANS la sauvegarder ni fermer
  // le focus — voir `commitResult`, seul endroit qui la sauvegarde vraiment,
  // une fois le résultat choisi (ou explicitement passé). `stop()` appelle
  // son callback de façon SYNCHRONE (hooks/use-work-timer.ts) : la variable
  // locale `captured` reflète donc fidèlement, dès la fin de cet appel, s'il
  // y avait quelque chose à enregistrer. Le draft est aussitôt persisté en
  // localStorage (Task 5) : un rechargement entre "Terminer" et le choix du
  // résultat ne perd plus rien.
  const endSession = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
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
    const draft: WorkSession = {
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
    };
    writeFocusDraft(item.id, draft);
    setDraftSession(draft);
  }, [stop, item, onClose]);

  /**
   * Feedback XP de fin de séance (Sprint priorisation + sync + XP) — `null`
   * tant qu'aucun résultat n'a été enregistré. Distinct de `draftSession` :
   * ce n'est jamais une étape à valider, juste un rendu transitoire affiché
   * APRÈS la sauvegarde définitive, avant l'appel (différé) à `onClose` —
   * voir l'effet juste en dessous.
   */
  const [xpFeedback, setXpFeedback] = useState<{
    earned: number;
    leveledUp: boolean;
    level: number;
    progress: { current: number; needed: number; percent: number };
    result: AttemptResult | null;
    /** Micro-sprint polish UX final — `finalSession.duration_seconds`, la seule mesure de temps déjà fiable pour CETTE séance (voir `commitResult`). Jamais un nombre d'exercices : `FocusView` n'a aucune visibilité sur une éventuelle séance multi-exercices englobante. */
    durationSeconds: number;
  } | null>(null);

  // Sauvegarde réellement la séance — avec le résultat choisi, ou `null` si
  // l'utilisateur a préféré passer cette étape (Échap depuis l'écran de
  // résultat, ou bouton "Passer") : dans les deux cas, exactement le même
  // comportement qu'avant l'introduction du résultat (temps enregistré,
  // `attempts`/`last_worked_at` mis à jour si ≥ 1 minute), rien n'est perdu.
  // Le draft localStorage est nettoyé juste après la sauvegarde définitive
  // (Task 4) : plus jamais retrouvé à une prochaine réouverture.
  //
  // XP (Sprint priorisation + sync + XP) : calculé UNIQUEMENT à partir de ce
  // qui vient réellement d'être enregistré — `xpFromSession` sur LA séance
  // qui vient d'être créée (jamais recalculé sur l'historique entier) plus
  // `masteryXpEarnedRef` (XP de maîtrise gagné PENDANT cette visite
  // uniquement, voir sa définition plus haut). Une séance sous la minute
  // (arrondie à 0 par `xpFromSession`) sans maîtrise nouvellement acquise
  // n'affiche aucun feedback — pas de fausse célébration pour un chrono qui
  // a juste tourné sans rien produire.
  const commitResult = useCallback(
    (result: AttemptResult | null) => {
      if (resultCommittedRef.current) return;
      resultCommittedRef.current = true;
      if (!draftSession) {
        onClose(result);
        return;
      }
      const finalSession: WorkSession = { ...draftSession, result };
      saveSessions([finalSession, ...sessions]);
      if (secondsToWholeMinutes(finalSession.duration_seconds) > 0) {
        update(item.id, { attempts: item.attempts + 1, last_worked_at: new Date().toISOString() });
      }
      clearFocusDraft(item.id);

      const earned = xpFromSession(finalSession) + masteryXpEarnedRef.current;
      if (earned <= 0) {
        onClose(result);
        return;
      }
      const xpBefore = totalXp(exercises, sessions);
      const xpAfter = totalXp(exercises, [finalSession, ...sessions]);
      setXpFeedback({
        earned,
        leveledUp: levelFromXp(xpAfter) > levelFromXp(xpBefore),
        level: levelFromXp(xpAfter),
        progress: xpProgressInLevel(xpAfter),
        result,
        durationSeconds: finalSession.duration_seconds,
      });
      // `onClose` est appelé par l'effet ci-dessous (délai court, non
      // bloquant) — jamais ici : les deux ne doivent jamais se déclencher
      // indépendamment l'un de l'autre pour la même séance.
    },
    [draftSession, sessions, saveSessions, item, update, onClose, exercises]
  );

  // Garde dédiée (même idiome que `endingRef`/`resultCommittedRef` plus haut) :
  // le délai automatique ET une fermeture manuelle (clic, Échap) peuvent tous
  // deux vouloir appeler `onClose` — sans cette ref, deux touches Échap
  // pressées avant le prochain rendu (React n'a pas encore eu le temps de
  // retirer l'écouteur clavier ni le timer) appelleraient `onClose` deux fois
  // de suite, avec les mêmes conséquences déjà documentées pour
  // `endSession`/`commitResult` (ex. double avancée de la file dans
  // session-runner.tsx#handleExerciseWorked).
  const feedbackClosedRef = useRef(false);
  const closeFeedback = useCallback(
    (result: AttemptResult | null) => {
      if (feedbackClosedRef.current) return;
      feedbackClosedRef.current = true;
      onClose(result);
    },
    [onClose]
  );

  /**
   * Ferme automatiquement le feedback XP après un court délai — non
   * bloquant : un clic ou une touche (voir le gestionnaire clavier plus bas
   * et le rendu du feedback) ferme immédiatement sans attendre.
   */
  useEffect(() => {
    if (!xpFeedback) return;
    const timeout = setTimeout(() => closeFeedback(xpFeedback.result), 1400);
    return () => clearTimeout(timeout);
  }, [xpFeedback, closeFeedback]);

  // Confirmation de sortie (Task 6) : jamais `window.confirm()`, un état local
  // qui bascule l'affichage vers un petit dialogue cohérent avec le reste du
  // design (voir le rendu plus bas). `requestExit` est le SEUL point d'entrée
  // pour quitter depuis l'écran de travail (bouton et Échap) — `endSession`
  // reste appelable directement depuis le dialogue lui-même, une fois confirmé.
  const [confirmingExit, setConfirmingExit] = useState(false);
  const requestExit = useCallback(() => {
    if (shouldConfirmExit(seconds, running)) {
      setConfirmingExit(true);
      return;
    }
    endSession();
  }, [seconds, running, endSession]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (xpFeedback) {
        // Jamais bloquant (voir la doc de `xpFeedback` plus haut) : Échap
        // ferme immédiatement sans attendre le délai automatique — via
        // `closeFeedback`, qui garantit un seul appel à `onClose` même en
        // cas de double-Échap avant le prochain rendu.
        if (event.key === "Escape") closeFeedback(xpFeedback.result);
        return;
      }
      if (confirmingExit) {
        // Échap referme le dialogue (équivalent de "Continuer") plutôt que de
        // forcer un choix — cohérent avec le reste du clavier de Focus, qui
        // ne bloque jamais l'utilisateur.
        if (event.key === "Escape") setConfirmingExit(false);
        return;
      }
      if (draftSession) {
        // Écran de résultat : Échap = passer (pas de choix forcé). 1/2/3 vont
        // droit au résultat correspondant (même ordre que les boutons) — le
        // résultat doit pouvoir se saisir sans quitter le clavier, juste
        // après avoir reposé le crayon.
        if (event.key === "Escape") commitResult(null);
        else if (event.key === "1") commitResult("réussi");
        else if (event.key === "2") commitResult("partiel");
        else if (event.key === "3") commitResult("échoué");
        return;
      }
      if (event.key === "Escape") requestExit();
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [xpFeedback, closeFeedback, confirmingExit, draftSession, commitResult, requestExit, toggle]);

  // Bandeau discret "Séance reprise" (Task 7) — s'affiche une fois quand
  // `resumedSeconds` passe de `null` à une valeur (reprise sessionStorage ou
  // checkpoint), puis s'efface tout seul. Ne dépend PAS de `[]` : au premier
  // rendu, la restauration du hook n'a pas encore eu lieu (son propre effet
  // de montage n'a pas encore tourné), donc `resumedSeconds` vaut encore
  // `null` — seul un effet qui réagit à son changement peut le détecter.
  const [showResumedNotice, setShowResumedNotice] = useState(false);
  useEffect(() => {
    if (resumedSeconds === null) return;
    setShowResumedNotice(true);
    const timeout = setTimeout(() => setShowResumedNotice(false), 5000);
    return () => clearTimeout(timeout);
  }, [resumedSeconds]);

  // Feedback XP (Sprint priorisation + sync + XP) — évalué AVANT `draftSession`
  // ci-dessous : une fois `xpFeedback` posé, c'est le seul écran affiché
  // jusqu'à la fermeture (différée, voir `closeFeedback`), qu'importe l'état
  // de `draftSession` (jamais vidé, volontairement — voir sa déclaration).
  if (xpFeedback) {
    // Micro-sprint polish UX final — résultat qualitatif déjà connu de
    // manière fiable (`xpFeedback.result`, choisi par l'utilisateur à
    // l'écran précédent), affiché ici en plus de l'XP. Jamais de nombre
    // d'exercices inventé : voir la doc de `xpFeedback` plus haut.
    const resultMeta = xpFeedback.result ? RESULT_META[xpFeedback.result] : null;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => closeFeedback(xpFeedback.result)}
        className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-5 bg-canvas px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-1.5"
        >
          <p className="eyebrow">Séance terminée</p>
          <p className="text-sm text-zinc-400">{formatDuration(xpFeedback.durationSeconds)} de travail</p>
          {resultMeta && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${resultMeta.className}`}>
              <resultMeta.icon size={13} /> {resultMeta.label}
            </span>
          )}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
          className="flex items-center gap-2 text-3xl font-semibold text-accent-text"
        >
          <Sparkles size={26} /> +{xpFeedback.earned} XP
        </motion.div>
        {xpFeedback.leveledUp && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm font-semibold text-zinc-100"
          >
            Niveau supérieur !
          </motion.p>
        )}
        <div className="w-full max-w-xs">
          <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
            <span>Niveau {xpFeedback.level}</span>
            <span>
              {xpFeedback.progress.current} / {xpFeedback.progress.needed} XP
            </span>
          </div>
          <ProgressBar value={xpFeedback.progress.percent} />
        </div>
        <p className="text-2xs text-zinc-600">Clique ou Échap pour continuer</p>
      </motion.div>
    );
  }

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
            className="justify-between gap-3 border border-emerald-400/20 bg-emerald-400/[0.12] text-emerald-200 hover:bg-emerald-400/20"
          >
            <span className="flex items-center gap-3">
              <CheckCircle2 size={18} /> Réussi
            </span>
            <kbd className="rounded border border-emerald-400/25 px-1.5 py-0.5 text-2xs">1</kbd>
          </Button>
          <Button
            size="lg"
            onClick={() => commitResult("partiel")}
            className="justify-between gap-3 border border-amber-400/20 bg-amber-400/[0.12] text-amber-200 hover:bg-amber-400/20"
          >
            <span className="flex items-center gap-3">
              <MinusCircle size={18} /> Partiellement réussi
            </span>
            <kbd className="rounded border border-amber-400/25 px-1.5 py-0.5 text-2xs">2</kbd>
          </Button>
          <Button
            size="lg"
            onClick={() => commitResult("échoué")}
            className="justify-between gap-3 border border-rose-400/20 bg-rose-400/[0.12] text-rose-200 hover:bg-rose-400/20"
          >
            <span className="flex items-center gap-3">
              <XCircle size={18} /> Échoué
            </span>
            <kbd className="rounded border border-rose-400/25 px-1.5 py-0.5 text-2xs">3</kbd>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => commitResult(null)}
          className="focus-ring rounded-lg px-2 py-1 text-xs text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400"
        >
          Passer <span className="no-underline">(Échap)</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Seul écran de Focus avec un en-tête/pied de page collés aux bords
      // (les deux autres écrans centrent leur contenu) — zone sûre iOS en
      // haut (encoche) et en bas (indicateur d'accueil), voir app/layout.tsx.
      className="fixed inset-0 z-50 flex flex-col bg-canvas pt-[env(safe-area-inset-top)]"
    >
      <header className="flex items-center justify-between border-b border-hairline/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <SubjectAvatar subject={item.subject} />
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-zinc-500">{item.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 tabular-nums text-lg font-semibold text-zinc-100">
            {running && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />}
            {formatDuration(seconds)}
          </span>
          <Button variant={running ? "secondary" : "primary"} size="sm" onClick={toggle}>
            {running ? "Pause" : "Timer"}
          </Button>
          <Button variant="ghost" size="icon" onClick={requestExit} aria-label="Terminer le focus">
            <X size={18} />
          </Button>
        </div>
      </header>

      {/* Bandeau discret "Séance reprise" / "mis en pause en arrière-plan"
          (Tasks 7-8) — jamais les deux à la fois : l'auto-pause, tant qu'elle
          n'est pas résolue, prime (c'est l'état actionnable), la reprise
          n'est qu'informative et s'efface d'elle-même. */}
      <AnimatePresence>
        {(autoPaused || showResumedNotice) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-hairline/[0.07] bg-accent/[0.06]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs text-zinc-400">
              <span>
                {autoPaused
                  ? "Chrono mis en pause car TaekdHub est passé en arrière-plan."
                  : `Séance reprise — ${formatDuration(resumedSeconds ?? 0)} déjà enregistrées.`}
              </span>
              {autoPaused && (
                <Button size="sm" variant="secondary" onClick={toggle}>
                  Reprendre
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation de sortie (Task 6) — jamais window.confirm(), un
          dialogue cohérent avec le reste du design, uniquement pour une
          séance significative encore en cours (voir lib/focus-exit.ts). */}
      <AnimatePresence>
        {confirmingExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="surface w-full max-w-sm rounded-2xl p-6 text-center"
            >
              <p className="font-semibold text-zinc-100">Ta séance est en cours.</p>
              <p className="mt-1.5 text-sm text-zinc-500">Tu veux vraiment quitter maintenant ?</p>
              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={() => setConfirmingExit(false)}>Continuer</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirmingExit(false);
                    endSession();
                  }}
                >
                  Terminer la séance
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <WhyThisExercise reasons={reasons} className="mt-3" />

          {/* Énoncé — cœur de la séance : immédiatement visible, sans clic ni révélation, contrairement aux indices/correction. */}
          <div className="mt-6 rounded-2xl border border-hairline/[0.08] bg-hairline/[0.025] p-5 sm:p-6">
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
            {item.answer && (
              <div>
                <Button variant="ghost" onClick={() => setAnswerVisible((v) => !v)}>
                  {answerVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  {answerVisible ? "Masquer la réponse" : "Afficher la réponse"}
                </Button>
                {answerVisible && (
                  <div className="mt-4 rounded-xl border border-hairline/[0.08] bg-hairline/[0.035] p-4 text-left text-sm leading-7 text-zinc-300">
                    <RichMath text={item.answer} />
                  </div>
                )}
              </div>
            )}
            {item.correction && (
              <div>
                <Button variant="ghost" onClick={() => setCorrectionVisible((v) => !v)}>
                  {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
                </Button>
                {correctionVisible && (
                  <div className="mt-4 rounded-xl border border-hairline/[0.08] bg-hairline/[0.035] p-4 text-left text-sm leading-7 text-zinc-300">
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
                  className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-text"
                >
                  <Sparkles size={13} /> Maîtrisé ! +{xpFromExercise(item)} XP
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <footer className="border-t border-hairline/[0.07] px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-zinc-600">
        Échap pour quitter · Barre d&apos;espace pour le timer
      </footer>
    </motion.div>
  );
}
