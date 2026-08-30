"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Lightbulb, MinusCircle, Sparkles, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryPicker } from "@/components/exercises/exercise-badges";
import { SegmentedControl } from "@/components/ui/segmented";
import { RichMath } from "@/components/rich-math";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { appendAttempt, clearPendingAttempt, readPendingAttempt, resumeAid, writePendingAttempt } from "@/lib/attempt";
import { explainReasons } from "@/lib/recommendation";
import { formatDuration, secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, ExerciseStatus, Mastery, WorkSession } from "@/lib/supabase/types";

/** Une seule séance focus à la fois : la clé encode l'exercice concerné, ce qui permet de retrouver après un rechargement lequel reprendre automatiquement. */
export const FOCUS_TIMER_PREFIX = "prepahub:timer:focus:";
const focusTimerKey = (exerciseId: string) => `${FOCUS_TIMER_PREFIX}${exerciseId}`;

/**
 * Ce qu'une séance focus interrompue doit pouvoir restituer : l'exercice
 * concerné, et l'AIDE déjà utilisée. Ces deux derniers champs sont optionnels
 * pour rester compatibles avec un chrono déjà en cours au moment de la mise à
 * jour — voir la note dans `FocusView`.
 */
type FocusTimerContext = { exerciseId: string; hintCount?: number; correctionRevealed?: boolean };

export function FocusView({
  item,
  update,
  sessions,
  saveSessions,
  onClose,
  reasons,
  progress,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  sessions: WorkSession[];
  saveSessions: (sessions: WorkSession[]) => void;
  /** Appelé à la fermeture du focus, avec le résultat choisi — `null`/`undefined` si aucune séance n'a été enregistrée (rien à qualifier) ou si l'utilisateur a passé l'étape. */
  onClose: (result?: AttemptResult | null) => void;
  /**
   * Raisons réelles (voir `ExerciseRecommendation.reasons`,
   * lib/recommendation.ts) pour lesquelles cet exercice a été proposé —
   * transmises telles quelles par l'appelant (SessionRunner : celles déjà
   * calculées pour la séance en cours ; ExerciseManager : recalculées à la
   * volée via `recommendExercises` pour l'exercice ouvert, même hors
   * séance). `undefined`/`[]` : l'exercice n'est signalé par aucun critère
   * en ce moment (ex. ouvert simplement par curiosité) — le panneau
   * "Pourquoi cet exercice ?" ne s'affiche alors pas du tout, jamais de
   * justification inventée pour combler ce cas.
   */
  reasons?: string[];
  /** Position dans la séance en cours (« 2 / 5 ») — absent hors séance, l'exercice étant alors ouvert seul depuis la banque. */
  progress?: { index: number; total: number };
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);

  /**
   * L'AIDE UTILISÉE VIT DANS LE CHRONO, PAS DANS UN useState.
   *
   * `hintCount` et `correctionRevealed` étaient deux états React ordinaires.
   * Le chrono, lui, est persisté en sessionStorage et restauré au montage
   * (hooks/use-work-timer.ts) — donc un rechargement en cours de séance
   * rendait le temps mais REMETTAIT L'AIDE À ZÉRO. Reproduit en navigateur :
   * trois indices révélés + correction lue, rechargement, « Réussi » →
   * `hints_used: 0, correction_viewed: false` enregistrés.
   *
   * C'est le pire signal possible, et pire que le bug qu'il remplaçait : `0`
   * et `false` ne sont pas des trous, ce sont des PREUVES POSITIVES
   * d'autonomie (voir lib/supabase/types.ts). Le produit affirmait donc « il
   * s'en est sorti seul » d'un élève qui venait d'épuiser toute l'aide
   * disponible — plein tarif d'XP, notion « solide », palier de difficulté
   * relevé d'un cran.
   *
   * L'aide utilisée est un fait de la MÊME séance que le temps écoulé : elle
   * est donc rangée au même endroit, dans le contexte déjà persisté du
   * chrono. Aucune troisième clé de stockage, aucun mécanisme de plus — et
   * la restauration devient automatique.
   *
   * `?? ` : un chrono repris d'une version antérieure ne porte que
   * `exerciseId`. On lit alors 0 / false, exactement le comportement d'avant.
   */
  const { seconds, running, start, toggle, stop, context, setContext } = useWorkTimer<FocusTimerContext>(
    focusTimerKey(item.id),
    { exerciseId: item.id, hintCount: 0, correctionRevealed: false }
  );
  const { hintCount, correctionRevealed } = resumeAid(context);
  // `correctionRevealed` est distinct de `correctionVisible`, simple bascule
  // d'affichage : masquer la correction ne défait pas le fait de l'avoir lue.

  // Démarre le chrono dès l'entrée en mode focus : ouvrir un exercice EST déjà
  // la décision de s'y mettre, exactement comme pour une séance reprise après
  // rechargement (voir SessionRunner, qui rouvre directement en phase "focus").
  // Avant ce correctif, le chrono restait à l'arrêt tant que l'élève ne
  // pensait pas à cliquer sur "Timer" — un oubli fréquent qui faisait
  // disparaître silencieusement du temps de travail pourtant bien réel,
  // rongeant la fiabilité de tout ce qui en dépend (maîtrise, recommandation,
  // objectif du jour). `start()` est idempotent (voir hooks/use-work-timer.ts) :
  // sans effet si une séance persistée était déjà en cours après reprise.
  //
  // Sauf si une tentative attend déjà son verdict (reprise après
  // rechargement) : le travail est terminé, redémarrer le chrono
  // recommencerait à compter du temps que l'élève ne passe pas à travailler.
  useEffect(() => {
    if (readPendingAttempt(item.id)) return;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Restauré au montage s'il en existe un pour CET exercice : un
  // rechargement survenu à l'écran de résultat ne perd plus la séance, il
  // repose la question (voir lib/attempt.ts).
  const [draftSession, setDraftSession] = useState<WorkSession | null>(() => readPendingAttempt(item.id));
  /** Le stockage a refusé la dernière tentative de sauvegarde — voir `commitResult`. Remis à faux dès qu'un nouvel essai est lancé. */
  const [saveFailed, setSaveFailed] = useState(false);

  // « Presque une autre application » : le bandeau et le rappel clavier
  // s'effacent après quelques secondes d'inactivité pendant le travail actif
  // (chrono en marche), pour laisser l'énoncé occuper tout l'écran — comme un
  // lecteur vidéo qui masque ses contrôles. Tout mouvement (souris, clavier,
  // défilement, tactile) les fait réapparaître instantanément ; en pause ou
  // sur l'écran de résultat, ils restent visibles en permanence, puisqu'il n'y
  // a alors rien à laisser respirer. `focus-within` (dans le JSX) offre un
  // filet indépendant de ce minuteur pour qui navigue au clavier.
  const [idle, setIdle] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (draftSession) return;
    let timeout: ReturnType<typeof setTimeout>;
    function resetIdle() {
      setIdle(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIdle(true), 2800);
    }
    resetIdle();
    const scrollArea = scrollAreaRef.current;
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    scrollArea?.addEventListener("scroll", resetIdle);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      scrollArea?.removeEventListener("scroll", resetIdle);
    };
  }, [draftSession]);
  const chromeHidden = idle && running && !draftSession;

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
      // Combien d'indices l'élève a-t-il eu besoin de révéler ? Capturé au
      // moment où la séance se ferme, donc reflète bien CETTE tentative.
      // 0 est une information à part entière (il s'en est sorti seul), pas
      // une absence de donnée — voir lib/supabase/types.ts#hints_used.
      hints_used: hintCount,
      // Même nature de fait que `hints_used`, capturé au même instant : une
      // correction lue durant CETTE tentative. `false` est une information à
      // part entière (il a conclu sans lire la solution), pas une absence de
      // donnée — voir lib/supabase/types.ts#correction_viewed.
      correction_viewed: correctionRevealed,
    };
    // Écrit AVANT d'afficher l'écran de résultat : à partir d'ici la séance
    // survit à un rechargement, alors que la clé du chrono vient d'être
    // effacée par `stop()`. C'est tout l'objet de lib/attempt.ts.
    writePendingAttempt(draft);
    setDraftSession(draft);
    // `hintCount` et `correctionRevealed` DOIVENT figurer ici : sans eux,
    // `endSession` capture la valeur du premier rendu (0 / false) et
    // l'enregistre telle quelle, quelle que soit l'aide réellement utilisée
    // ensuite — la séance était systématiquement sauvegardée comme autonome.
    // Bug trouvé en test bout-en-bout (3 indices révélés, `hints_used: 0`
    // persisté), invisible au typecheck comme aux tests unitaires : seul le
    // parcours réel le montrait.
  }, [stop, item, onClose, hintCount, correctionRevealed]);

  // Sauvegarde réellement la séance — avec le résultat choisi, ou `null` si
  // l'utilisateur a préféré passer cette étape (Échap depuis l'écran de
  // résultat, ou bouton "Passer") : dans les deux cas, exactement le même
  // comportement qu'avant l'introduction du résultat (temps enregistré,
  // `attempts`/`last_worked_at` mis à jour si ≥ 1 minute), rien n'est perdu.
  const commitResult = useCallback(
    (result: AttemptResult | null) => {
      setSaveFailed(false);
      if (draftSession) {
        const finalSession: WorkSession = { ...draftSession, result };
        try {
          // `appendAttempt` plutôt qu'un ajout en tête : une même tentative
          // (même identifiant) n'entre jamais deux fois dans l'historique,
          // maintenant qu'un brouillon peut être relu par plusieurs montages.
          saveSessions(appendAttempt(finalSession, sessions));
        } catch {
          // Le stockage a refusé (quota dépassé, mode privé, disque plein).
          // Le brouillon N'EST PAS effacé : c'est la seule copie du travail,
          // et l'écran reste ouvert pour réessayer. On ne ferme pas, on ne
          // prévient pas les moteurs, on ne prétend pas.
          //
          // C'est aussi pourquoi l'effacement du brouillon a lieu APRÈS la
          // sauvegarde et non avant : dans l'ordre inverse, un échec
          // d'écriture détruisait la dernière trace de la séance. Reproduit
          // en navigateur (quota forcé) : 35 minutes perdues, sans message,
          // sans brouillon. L'idempotence ne dépend pas de cet ordre — elle
          // est garantie par l'identifiant, dans `appendAttempt`.
          setSaveFailed(true);
          return;
        }
        // Sauvegarde acquise : le brouillon n'a plus de raison d'être.
        clearPendingAttempt(item.id);
        if (secondsToWholeMinutes(finalSession.duration_seconds) > 0) {
          try {
            update(item.id, { attempts: item.attempts + 1, last_worked_at: new Date().toISOString() });
          } catch {
            // Compteurs de confort seulement : la vérité du travail est dans
            // l'historique, déjà enregistré ci-dessus. Un échec ici ne doit
            // pas faire croire à l'élève qu'il a perdu sa séance.
          }
        }
      }
      onClose(result);
    },
    [draftSession, sessions, saveSessions, item, update, onClose]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
      if (event.key === "Escape") endSession();
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftSession, commitResult, endSession, toggle]);

  return (
    <AnimatePresence mode="wait">
      {draftSession ? (
      <motion.div
        key="result"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-canvas px-6 text-center"
      >
        <div>
          <p className="text-base font-semibold text-ink">Comment s&apos;est passé l&apos;exercice ?</p>
          <p className="mt-1.5 text-sm text-muted">{item.title}</p>
          {/* Le temps travaillé est annoncé ici, et pas seulement pendant la
              séance : après un rechargement, c'est la seule chose qui dit à
              l'élève que son travail a bien été retrouvé. Sobre, factuel,
              affiché une fois — pas une notification. */}
          <p className="mt-3 text-2xs tabular-nums text-subtle">{formatDuration(draftSession.duration_seconds)} enregistrées</p>
        </div>

        {/* Le stockage a refusé d'écrire. On le dit, on garde le travail, et
            on laisse l'élève réessayer — plutôt que de fermer l'écran en
            faisant croire que tout s'est bien passé. */}
        {saveFailed && (
          <p className="max-w-xs rounded-lg border border-hairline/[0.14] px-3.5 py-3 text-xs leading-5 text-rose-300">
            Ta séance n&apos;a pas pu être enregistrée — le stockage de ton navigateur a refusé l&apos;écriture. Ton travail est
            conservé : réessaie, ou libère de l&apos;espace avant de recommencer.
          </p>
        )}
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
          className="focus-ring rounded-lg px-2 py-1 text-xs text-subtle underline underline-offset-2 transition hover:text-muted"
        >
          Passer <span className="no-underline">(Échap)</span>
        </button>
      </motion.div>
      ) : (
      <motion.div
        key="work"
        // Un léger zoom-avant depuis le bas (0.97 → 1, y: 10 → 0), pas un
        // simple fondu : la différence se sent plutôt qu'elle ne se voit —
        // l'idée d'ENTRER dans un espace plutôt que de le voir apparaître
        // par-dessus l'écran précédent. La sortie est volontairement plus
        // courte que l'entrée (0.16s contre 0.32s) : on s'installe avec soin,
        // on repart vite — même asymétrie qu'ouvrir/fermer une porte.
        // `transform` reste sur cet élément lui-même (déjà `fixed`), jamais
        // sur un parent : un ancêtre transformé casserait le positionnement
        // fixe de tout ce qu'il contient.
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.16, ease: "easeIn" } }}
        className="fixed inset-0 z-50 flex flex-col bg-canvas"
      >
      {/* BANDEAU DE TRAVAIL — le strict nécessaire, et même ce strict
          nécessaire s'efface après quelques secondes d'inactivité pendant le
          travail actif (voir `chromeHidden`) : ne restent visibles en
          permanence que l'énoncé et, en pause, les commandes. */}
      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b border-hairline/[0.07] px-4 py-3 transition-opacity duration-500 sm:px-6",
          chromeHidden ? "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100" : "opacity-100"
        )}
      >
        <p className="t-meta tabular-nums">
          {progress ? `Exercice ${progress.index + 1} sur ${progress.total}` : item.subject}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-2 tabular-nums text-sm font-medium text-ink">
            {running && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />}
            {formatDuration(seconds)}
          </span>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {running ? "Pause" : "Reprendre"}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Terminer l'exercice" onClick={endSession}>
            <X size={17} />
          </Button>
        </div>
      </header>

      {/* Contenu défilable : l'énoncé (contenu principal) prime sur le chrono, resté dans le bandeau supérieur, secondaire dans la hiérarchie visuelle. */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-[42rem] pb-16">
          {/* Le titre d'abord. Les métadonnées (difficulté, type) passaient
              AVANT lui, et la molette de maîtrise — cinq pastilles — pesait
              plus lourd que l'exercice qu'elle qualifie. Elles rejoignent le
              pied de page, où l'élève va après avoir travaillé, pas avant. */}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem] sm:leading-[1.15]">{item.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <span>{item.subject}</span>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate">{item.source}</span>
            <span aria-hidden>·</span>
            <DifficultyDots value={item.difficulty} />
            <span className="text-xs">{item.type}</span>
          </div>

          {/* "Pourquoi cet exercice ?" — le contexte de recommandation ne
              doit jamais disparaître entre l'aperçu de séance (où il est déjà
              affiché, voir SessionRunner) et le moment où l'élève travaille
              réellement dessus : perdre cette explication ici, précisément
              quand l'attention est maximale, revenait à faire passer le choix
              pour arbitraire. `explainReasons` ne fabrique rien : sans raison
              réelle transmise, ce bloc ne s'affiche simplement pas. */}
          {explainReasons(reasons ?? []) && (
            <p className="mt-4 flex items-start gap-2 border-l-2 border-accent/40 py-0.5 pl-3 text-sm leading-6 text-muted">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
              {explainReasons(reasons ?? [])}
            </p>
          )}

          {/* Énoncé — cœur de la séance. Il était enfermé dans une carte grise
              qui, sur fond clair, n'était qu'un cadre autour de 80 % de
              l'écran. C'est le CONTENU : il se lit comme un texte, pas comme
              un composant. Seules les interruptions (indices, correction)
              gardent un cadre, parce qu'elles interrompent justement. */}
          <div className="mt-7">
            {item.statement.trim() ? (
              <RichMath text={item.statement} className="text-[1.0625rem] leading-[1.85] text-ink sm:text-lg" />
            ) : (
              <p className="rounded-xl border border-dashed border-hairline/[0.14] px-4 py-6 text-center text-sm leading-7 text-muted">
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
                className="rounded-xl border border-accent/15 bg-accent/[0.055] p-4 text-sm leading-7 text-ink"
              >
                <RichMath text={`Indice ${index + 1} — ${hint}`} />
              </motion.div>
            ))}
            {/* Deux aides de même rang, côte à côte. L'indice occupait toute
                la largeur : le bouton le plus lourd de l'écran était donc
                celui qui invite à ne PAS chercher seul. */}
            {(hintCount < item.hints.length || item.correction) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {hintCount < item.hints.length && (
                  <Button variant="secondary" size="sm" onClick={() => setContext((previous) => ({ ...previous, hintCount: resumeAid(previous).hintCount + 1 }))}>
                    <Lightbulb size={15} /> Indice {hintCount + 1}
                    <span className="text-muted">/ {item.hints.length}</span>
                  </Button>
                )}
                {item.correction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCorrectionVisible((v) => !v);
                      if (!correctionRevealed) setContext((previous) => ({ ...previous, correctionRevealed: true }));
                    }}
                  >
                    {correctionVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                    {correctionVisible ? "Masquer la correction" : "Voir la correction"}
                  </Button>
                )}
              </div>
            )}
            {item.correction && (
              <div>
                {correctionVisible && (
                  <div className="rounded-2xl border border-hairline/[0.09] bg-hairline/[0.025] p-5 text-left text-sm leading-7 text-ink">
                    <p className="eyebrow mb-2.5">Correction</p>
                    <RichMath text={item.correction} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PIED DE PAGE « où j'en suis » — séparé du contenu par une règle.
              Ces quatre statuts étaient quatre boutons de pleine importance,
              dont l'actif en aplat de marque : le réglage administratif était
              l'élément le plus criard de l'écran. Un sélecteur segmenté (le
              même composant que partout ailleurs) dit « une valeur parmi
              quatre » sans hurler. La maîtrise le rejoint : les deux
              répondent à la même question, après l'exercice. */}
          <div className="mt-10 flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-hairline/[0.07] pt-6">
            <label className="block">
              <span className="eyebrow">Où j&apos;en suis</span>
              <SegmentedControl
                className="mt-2"
                ariaLabel="Statut de l'exercice"
                value={item.status}
                onChange={(status) => update(item.id, { status })}
                options={(["à faire", "en cours", "à revoir", "maîtrisé"] as ExerciseStatus[]).map((s) => ({ value: s, label: s }))}
              />
            </label>
            <label className="block">
              <span className="eyebrow">Maîtrise</span>
              <div className="mt-2">
                <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
              </div>
            </label>
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

      <footer
        className={cn(
          "border-t border-hairline/[0.07] px-6 py-4 text-center text-xs text-subtle transition-opacity duration-500",
          chromeHidden ? "opacity-0" : "opacity-100"
        )}
      >
        Échap pour quitter · Barre d&apos;espace pour le timer
      </footer>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
