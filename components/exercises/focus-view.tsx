"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  MinusCircle,
  Pause,
  Play,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { MasteryPicker } from "@/components/exercises/exercise-badges";
import { SegmentedControl } from "@/components/ui/segmented";
import { MathInline, RichMath } from "@/components/rich-math";
import { ProvenanceBadge } from "@/components/exercises/provenance-badge";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { explainReasons } from "@/lib/recommendation";
import { formatDuration, secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, ExerciseStatus, Mastery, WorkSession } from "@/lib/supabase/types";

/** Une seule séance focus à la fois : la clé encode l'exercice concerné, ce qui permet de retrouver après un rechargement lequel reprendre automatiquement. */
export const FOCUS_TIMER_PREFIX = "prepahub:timer:focus:";
const focusTimerKey = (exerciseId: string) => `${FOCUS_TIMER_PREFIX}${exerciseId}`;

export function FocusView({
  item,
  update,
  sessions,
  saveSessions,
  onClose,
  reasons,
  progress,
  onPrev,
  onNext,
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
  /**
   * Exercice précédent/suivant de la liste d'où l'on vient (banque filtrée,
   * chapitre…). Absents en séance : là, l'ordre est décidé par le plan et on
   * n'a pas à pouvoir le contourner — c'est `SessionRunner` qui avance, une
   * fois le résultat déclaré.
   *
   * `undefined` quand il n'y a rien de ce côté : le bouton est alors
   * désactivé plutôt que masqué, pour que la barre ne change pas de forme
   * d'un exercice à l'autre.
   */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const { seconds, running, start, toggle, stop } = useWorkTimer<{ exerciseId: string }>(focusTimerKey(item.id), {
    exerciseId: item.id,
  });

  // Démarre le chrono dès l'entrée en mode focus : ouvrir un exercice EST déjà
  // la décision de s'y mettre, exactement comme pour une séance reprise après
  // rechargement (voir SessionRunner, qui rouvre directement en phase "focus").
  // Avant ce correctif, le chrono restait à l'arrêt tant que l'élève ne
  // pensait pas à cliquer sur "Timer" — un oubli fréquent qui faisait
  // disparaître silencieusement du temps de travail pourtant bien réel,
  // rongeant la fiabilité de tout ce qui en dépend (maîtrise, recommandation,
  // objectif du jour). `start()` est idempotent (voir hooks/use-work-timer.ts) :
  // sans effet si une séance persistée était déjà en cours après reprise.
  useEffect(() => {
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
      // Combien d'indices l'élève a-t-il eu besoin de révéler ? Capturé au
      // moment où la séance se ferme, donc reflète bien CETTE tentative.
      // 0 est une information à part entière (il s'en est sorti seul), pas
      // une absence de donnée — voir lib/supabase/types.ts#hints_used.
      hints_used: hintCount,
    });
    // `hintCount` DOIT figurer ici : sans lui, `endSession` capture la valeur
    // du premier rendu (0) et l'enregistre telle quelle, quels que soient les
    // indices réellement révélés ensuite — la séance était systématiquement
    // sauvegardée comme autonome. Bug trouvé en test bout-en-bout (3 indices
    // révélés, `hints_used: 0` persisté), invisible au typecheck comme aux
    // tests unitaires : seul le parcours réel le montrait.
  }, [stop, item, onClose, hintCount]);

  // Sauvegarde réellement la séance — avec le résultat choisi, ou `null` si
  // l'utilisateur a préféré passer cette étape (Échap depuis l'écran de
  // résultat, ou bouton "Passer") : dans les deux cas le temps est enregistré,
  // rien n'est perdu.
  //
  // `attempts`/`last_worked_at` suivent DEUX signaux, pas un seul :
  //
  //  - une durée d'au moins une minute (l'élève a visiblement travaillé), ou
  //  - un résultat explicitement DÉCLARÉ (réussi/partiel/échoué).
  //
  // Le second est nouveau, et il corrige une incohérence trouvée en parcours
  // réel : la condition ne portait que sur la durée, donc déclarer « échoué »
  // sur un exercice bouclé en moins de 60 secondes enregistrait bien la
  // `WorkSession`… sans jamais toucher à `last_worked_at`. Résultat : l'app
  // continuait d'annoncer « Jamais travaillé » à côté d'un exercice que
  // l'élève venait de rater sous ses yeux, et le moteur de recommandation
  // n'avait aucune trace de récence pour l'espacer. Déclarer un résultat EST
  // la preuve qu'une tentative a eu lieu — sa durée ne change rien à ce fait.
  // Passer l'étape (`result === null`) garde exactement l'ancien seuil.
  const commitResult = useCallback(
    (result: AttemptResult | null) => {
      if (draftSession) {
        const finalSession: WorkSession = { ...draftSession, result };
        saveSessions([finalSession, ...sessions]);
        if (result !== null || secondsToWholeMinutes(finalSession.duration_seconds) > 0) {
          update(item.id, { attempts: item.attempts + 1, last_worked_at: new Date().toISOString() });
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

  if (draftSession) {
    return (
      <div className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-canvas px-6">
        <div className="text-center">
          <p className="t-label">Tentative terminée</p>
          <h2 className="t-display mt-2">Comment ça s&apos;est passé ?</h2>
          <p className="t-meta mx-auto mt-2 max-w-[36ch]">
            <MathInline text={item.title} />
          </p>
        </div>

        {/* Trois choix de MÊME poids : la couleur les distingue, pas la
            taille. Le raccourci clavier est écrit sur chaque bouton — après
            une heure de crayon, on n'a pas envie de reprendre la souris. */}
        <div className="flex w-full max-w-sm flex-col gap-2">
          <ResultButton
            onClick={() => commitResult("réussi")}
            icon={<CheckCircle2 size={18} />}
            label="Réussi"
            hint="1"
            className="border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300 hover:bg-emerald-400/20"
          />
          <ResultButton
            onClick={() => commitResult("partiel")}
            icon={<MinusCircle size={18} />}
            label="Partiellement"
            hint="2"
            className="border-amber-400/30 bg-amber-400/[0.10] text-amber-300 hover:bg-amber-400/20"
          />
          <ResultButton
            onClick={() => commitResult("échoué")}
            icon={<XCircle size={18} />}
            label="Échoué"
            hint="3"
            className="border-rose-400/30 bg-rose-400/[0.10] text-rose-300 hover:bg-rose-400/20"
          />
        </div>

        <button
          type="button"
          onClick={() => commitResult(null)}
          className="rounded px-2 py-1 text-[0.8125rem] text-subtle underline underline-offset-4 transition-colors hover:text-muted max-lg:min-h-11"
        >
          Passer <span className="no-underline">(Échap)</span>
        </button>
      </div>
    );
  }

  const hasHints = hintCount < item.hints.length;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* ── BANDEAU DE TRAVAIL ─────────────────────────────────────
          Le strict nécessaire : où j'en suis, depuis combien de temps,
          comment sortir. Rien d'autre — surtout pas le titre de l'exercice,
          qui est composé en grand trois centimètres plus bas. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5 sm:px-6">
        <p className="t-meta tabular min-w-0 truncate">
          {progress ? `Exercice ${progress.index + 1} sur ${progress.total}` : item.subject}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Le chrono est une INFORMATION, pas un contrôle : il se lit, et le
              seul geste qu'on lui associe (mettre en pause) tient dans une
              icône à côté. Il occupait auparavant un bouton texte
              « Pause »/« Reprendre » aussi large que le bouton de sortie. */}
          <span className="tabular flex items-center gap-2 text-sm text-ink">
            {running && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />}
            {formatDuration(seconds)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={running ? "Mettre le chronomètre en pause" : "Reprendre le chronomètre"}
            className="h-8 w-8 max-lg:h-11 max-lg:w-11"
          >
            {running ? <Pause size={15} /> : <Play size={15} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Terminer l'exercice"
            onClick={endSession}
            className="h-8 w-8 max-lg:h-11 max-lg:w-11"
          >
            <X size={17} />
          </Button>
        </div>
      </header>

      {/* ── COLONNE DE LECTURE ─────────────────────────────────────
          Bornée à `measure` (~66 caractères) et composée en serif : c'est la
          géométrie d'un polycopié, pas celle d'une fiche d'application. Le
          padding bas laisse la place à la barre d'actions collante. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-10 sm:px-6 sm:py-14">
        <article className="measure mx-auto w-full pb-10">
          {/* Métadonnées AVANT le titre, en une seule ligne discrète : d'où
              vient cet exercice et ce qu'il vaut. Elles situent, puis on les
              oublie. */}
          <div className="t-meta flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <ProvenanceBadge exercise={item} />
            <span>{item.subject}</span>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate">{item.source}</span>
            {/* Pas de séparateur avant les traits de difficulté : quand la
                ligne passe à la ligne sur mobile, un « · » se retrouvait seul
                en fin de ligne. Un espace suffit à les détacher. */}
            <span className="ml-0.5">
              <DifficultyDots value={item.difficulty} />
            </span>
          </div>

          <h1 className="t-display mt-3">
            <MathInline text={item.title} />
          </h1>

          {/* « Pourquoi cet exercice ? » — `explainReasons` ne fabrique rien :
              sans raison réelle transmise, ce bloc ne s'affiche pas du tout. */}
          {explainReasons(reasons ?? []) && (
            <p className="t-lede mt-5 flex items-start gap-2.5 border-l-2 border-accent/35 py-0.5 pl-4">
              <Sparkles size={14} className="mt-1.5 shrink-0 text-accent" />
              <span>{explainReasons(reasons ?? [])}</span>
            </p>
          )}

          {/* L'ÉNONCÉ. Pas de cadre, pas de fond : c'est le contenu de la
              page, pas un composant posé dessus. */}
          <div className="mt-8">
            {item.statement.trim() ? (
              <RichMath text={item.statement} className="t-read text-ink" />
            ) : (
              <p className="t-meta rounded-lg border border-dashed border-line px-4 py-6 text-center">
                Aucun énoncé renseigné pour cet exercice — ouvre sa fiche depuis la banque pour l&apos;ajouter.
              </p>
            )}
          </div>

          {/* Indices révélés : composés comme du contenu (serif), en retrait
              par un filet vertical. Un encadré teinté par indice transformait
              la page en accordéon de boîtes. */}
          {hintCount > 0 && (
            <div className="mt-8 space-y-5">
              {item.hints.slice(0, hintCount).map((hint, index) => (
                <div key={index} className="animate-fade-in border-l-2 border-accent/40 pl-4">
                  <p className="t-label mb-1.5">Indice {index + 1}</p>
                  <RichMath text={hint} className="t-read-quiet text-muted" />
                </div>
              ))}
            </div>
          )}

          {correctionVisible && item.correction && (
            <section className="animate-fade-in mt-10 border-t border-line pt-6">
              <p className="t-label mb-3">Correction</p>
              <RichMath text={item.correction} className="t-read-quiet text-muted" />
            </section>
          )}

          {/* ── OÙ J'EN SUIS ─────────────────────────────────────
              Après le contenu, jamais avant : on qualifie un exercice une
              fois qu'on l'a fait. */}
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5 border-t border-line pt-6">
            <label className="flex flex-wrap items-center gap-2.5">
              <span className="t-label">Statut</span>
              <SegmentedControl
                size="sm"
                ariaLabel="Statut de l'exercice"
                value={item.status}
                onChange={(status) => update(item.id, { status })}
                options={(["à faire", "en cours", "à revoir", "maîtrisé"] as ExerciseStatus[]).map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </label>
            <label className="flex flex-wrap items-center gap-2.5">
              <span className="t-label">Maîtrise</span>
              <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
            </label>
            {justMastered && (
              <span className="animate-rise flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-2xs font-medium text-accent">
                <Sparkles size={12} /> Maîtrisé
              </span>
            )}
          </div>
        </article>
      </div>

      {/* ── BARRE D'ACTIONS ────────────────────────────────────────
          Collée en bas, donc toujours atteignable sans remonter — c'est ce
          qui manquait le plus : les boutons « Indice » et « Correction »
          étaient perdus au milieu du texte, et « terminer » n'existait qu'en
          croix minuscule tout en haut.

          Les aides sont à GAUCHE et discrètes ; la sortie est à DROITE et
          pleine. Le bouton le plus lourd de l'écran ne doit jamais être celui
          qui invite à ne pas chercher. */}
      <footer className="shrink-0 border-t border-line bg-canvas px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="measure mx-auto flex w-full flex-wrap items-center gap-2">
          {hasHints && (
            <Button variant="secondary" size="sm" onClick={() => setHintCount((count) => count + 1)}>
              <Lightbulb size={15} /> Indice {hintCount + 1}
              <span className="text-subtle">/ {item.hints.length}</span>
            </Button>
          )}
          {item.correction && (
            <Button variant="ghost" size="sm" onClick={() => setCorrectionVisible((visible) => !visible)}>
              {correctionVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              {correctionVisible ? "Masquer la correction" : "Voir la correction"}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {(onPrev || onNext) && (
              <span className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={onPrev} disabled={!onPrev} aria-label="Exercice précédent">
                  <ChevronLeft size={17} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onNext} disabled={!onNext} aria-label="Exercice suivant">
                  <ChevronRight size={17} />
                </Button>
              </span>
            )}
            <Button size="md" onClick={endSession}>
              Terminer
            </Button>
          </div>
        </div>
        <p className="t-meta measure mx-auto mt-2 hidden text-2xs sm:block">
          Échap pour terminer · Barre d&apos;espace pour le chronomètre
        </p>
      </footer>
    </div>
  );
}

/** Bouton de l'écran de résultat — même géométrie pour les trois, seule la couleur change. */
function ResultButton({
  onClick,
  icon,
  label,
  hint,
  className,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 text-sm font-medium transition-colors ${className ?? ""}`}
    >
      <span className="flex items-center gap-3">
        {icon} {label}
      </span>
      <kbd className="rounded border border-current/25 px-1.5 py-0.5 text-2xs opacity-70">{hint}</kbd>
    </button>
  );
}
