"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { cn } from "@/lib/cn";
import { subjects, todaySeconds } from "@/lib/study";
import { activeWorkItems, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const TIMER_STORAGE_KEY = "prepahub:timer:free";

/** Libellés courts des pastilles de matière — le nom entier reste lu (`aria-label`). */
const SUBJECT_SHORT: Record<Subject, string> = {
  Mathématiques: "Maths",
  Physique: "Physique",
  Chimie: "Chimie",
  "Informatique TC": "Info TC",
  "Informatique Spé": "Info Spé",
  Français: "Français",
  Anglais: "Anglais",
};

interface TimerContext {
  subject: Subject;
  /**
   * Travail planifié que cette séance sert, ou `null` pour une séance libre.
   *
   * Persisté AVEC le chrono (voir `useWorkTimer`, dont le contexte est
   * générique) : un rechargement en pleine séance ne doit pas détacher le
   * temps du travail auquel il était destiné. C'est ce champ qui devient
   * `WorkSession.work_item_id` à l'arrêt, et donc ce qui fait avancer un DM.
   */
  workItemId?: string | null;
}

/**
 * CADRAN — `12:34`, puis `1:02:05` passé l'heure.
 *
 * Pas `formatDuration` (lib/utils.ts), qui passe à « 1 h 02 min » au-delà
 * d'une heure : sur un cadran qui TOURNE, les secondes doivent rester là —
 * c'est elles qui disent que le chrono marche.
 */
function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * CHRONOMÈTRE — l'écran « Focus ».
 *
 * Tout converge vers UN objet : un grand anneau à l'accent, et dedans le
 * cadran en chiffres ronds très grands. L'anneau mesure la JOURNÉE (temps
 * déjà noté aujourd'hui + la séance en cours, face à l'objectif du jour) :
 * il avance pendant qu'on travaille, et c'est la même mesure que l'anneau
 * « Ma journée » de l'accueil — on reconnaît la forme d'un écran à l'autre.
 *
 * Au-dessus, deux choix et pas un de plus : le travail planifié (s'il y en
 * a) et la matière, en pastilles neutres — sept cibles visibles valent
 * mieux qu'un menu déroulant. En dessous, un seul gros bouton en pilule.
 *
 * Le cadran ne « pulse » pas : un chiffre qui tressaute une fois par
 * seconde, pendant une heure, dans le champ de vision de quelqu'un qui
 * essaie de se concentrer, est le contraire d'un outil de concentration.
 */
export function Timer() {
  // `ready` est indispensable ici comme partout ailleurs : le chrono restaure
  // une séance persistée dès son premier effet, donc « Terminer » est
  // cliquable avant même que les données locales aient fini d'être lues.
  const { sessions, workItems, preferences, saveSessions, saveWorkItems, ready } = usePrepahubData();
  const { seconds, running, context, setContext, start, toggle, stop } = useWorkTimer<TimerContext>(TIMER_STORAGE_KEY, {
    subject: "Mathématiques",
    workItemId: null,
  });
  const [fullscreen, setFullscreen] = useState(false);
  /*
   * Le paramètre est lu depuis `window.location.search` dans un effet — et NON via
   * `useSearchParams`, qui forcerait cette page à sortir du rendu statique
   * (« useSearchParams() should be wrapped in a suspense boundary ») pour un
   * paramètre optionnel dont rien, dans le premier rendu, ne dépend.
   */
  const [requestedItemId, setRequestedItemId] = useState<string | null>(null);
  useEffect(() => {
    setRequestedItemId(new URLSearchParams(window.location.search).get("travail"));
  }, []);
  const openItems = activeWorkItems(workItems);
  const selectedItem = openItems.find((item) => item.id === context.workItemId) ?? null;

  /*
   * Arriver depuis un créneau du planning (« /timer?travail=… ») présélectionne
   * le travail ET sa matière. Ne s'applique JAMAIS pendant qu'un chrono tourne :
   * réattribuer en cours de route le temps déjà écoulé à un autre travail
   * serait une réécriture silencieuse de l'historique.
   */
  useEffect(() => {
    if (!ready || running || !requestedItemId) return;
    if (context.workItemId === requestedItemId) return;
    const target = openItems.find((item) => item.id === requestedItemId);
    if (!target) return;
    setContext({ subject: target.subject ?? context.subject, workItemId: target.id });
    // `openItems` est recalculé à chaque rendu ; le dépendre ici relancerait
    // l'effet en boucle. L'identifiant demandé et l'état prêt suffisent à
    // décider, et c'est bien ce qu'on surveille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, running, requestedItemId, context.workItemId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // La barre d'espace démarre / met en pause — sauf quand elle sert
      // déjà à quelque chose : une liste, une pastille ou un bouton qui a
      // le focus s'active lui-même à l'espace.
      const tag = document.activeElement?.tagName;
      if (event.key === " " && tag !== "SELECT" && tag !== "BUTTON" && tag !== "INPUT" && tag !== "A") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, toggle]);

  function handleStop() {
    stop(({ startedAt, seconds: finalSeconds }) => {
      const session: WorkSession = {
        id: crypto.randomUUID(),
        subject: context.subject,
        // Champs hérités de l'ancienne banque d'exercices (voir
        // lib/supabase/types.ts) : toujours `null` désormais.
        exercise_id: null,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: finalSeconds,
        note: null,
        created_at: new Date().toISOString(),
        result: null,
        hints_used: null,
        work_item_id: context.workItemId ?? null,
      };
      saveSessions([session, ...sessions]);
      /*
       * Un travail « à faire » sur lequel on vient de passer du temps est
       * « en cours ». Le statut suit le fait, il ne se déclare pas à la
       * main : sans cela, un DM entamé restait indéfiniment « à faire », et
       * le bilan hebdomadaire comme le planning en donnaient une image
       * fausse. Rien d'autre n'est touché — surtout pas l'échéance, ni
       * l'estimation.
       */
      const target = workItems.find((item) => item.id === context.workItemId);
      if (target && target.status === "à faire") {
        saveWorkItems(workItems.map((item) => (item.id === target.id ? { ...item, status: "en cours" as const } : item)));
      }
    });
  }

  // Tant que les données locales ne sont pas lues, on n'affiche pas de chrono
  // manipulable : « Terminer » enregistrerait alors une séance à partir d'un
  // historique encore vide en mémoire.
  if (!ready) return <Skeleton className="mx-auto h-[32rem] w-full max-w-3xl rounded-2xl" />;

  const goalSeconds = Math.max(1, preferences.dailyGoalMinutes * 60);
  const daySeconds = todaySeconds(sessions) + seconds;
  const dayPercent = Math.min(100, (daySeconds / goalSeconds) * 100);
  const subjectLocked = running || selectedItem?.subject != null;

  const controls = (
    <div className="space-y-5">
      {/* DEUX choix, jamais deux systèmes : le travail planifié d'abord
          (c'est lui qui donne son sens à la séance), la matière ensuite.
          Choisir un travail impose sa matière — on ne chronomètre pas un DM
          de maths « en physique ». « Séance libre » reste le premier choix. */}
      {openItems.length > 0 && (
        <label className="mx-auto block w-full max-w-[24rem]">
          <span className="sr-only">Travail planifié</span>
          <Select
            value={context.workItemId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              const target = openItems.find((item) => item.id === id);
              setContext({ subject: target?.subject ?? context.subject, workItemId: id || null });
            }}
            disabled={running}
            className="rounded-full text-center font-semibold"
          >
            <option value="">Séance libre — aucun travail planifié</option>
            {openItems.map((item) => (
              <option key={item.id} value={item.id}>
                {WORK_ITEM_KIND_META[item.kind].short} · {item.title}
              </option>
            ))}
          </Select>
        </label>
      )}

      {/* Sur téléphone, les sept pastilles tenaient sur TROIS rangées et
          poussaient le cadran sous la ligne de flottaison : elles défilent
          donc à l'horizontale (la pastille coupée au bord dit « il y en a
          d'autres »), jusqu'aux bords de la tuile. */}
      <div
        role="radiogroup"
        aria-label="Matière"
        className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
      >
        {subjects.map((subject) => {
          const active = subject === context.subject;
          return (
            <button
              key={subject}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={subject}
              disabled={subjectLocked && !active}
              onClick={() => setContext({ subject, workItemId: context.workItemId ?? null })}
              className={cn(
                "press min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold lg:min-h-10",
                // La matière choisie en pastille à DÉGRADÉ de marque, les
                // autres en creux : le choix se voit de loin.
                active ? "grad-brand [box-shadow:0_8px_18px_-8px_var(--g1)]" : "bg-inset text-ink hover:bg-hairline/[0.10]",
                "disabled:cursor-not-allowed disabled:opacity-35"
              )}
            >
              {SUBJECT_SHORT[subject]}
            </button>
          );
        })}
      </div>
    </div>
  );

  const dial = (
    <FocusRing percent={dayPercent} large={fullscreen}>
      <p
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-sm font-extrabold",
          running ? "bg-accent/10 text-accent" : "text-muted"
        )}
      >
        {running && <span aria-hidden className="h-2 w-2 animate-pulse-soft rounded-full bg-accent" />}
        {running ? "En cours" : seconds > 0 ? "En pause" : context.subject}
      </p>
      {/* `role="timer"` : lu à la demande, jamais annoncé chaque seconde.
          Les chiffres ÉNORMES, en 900 serré, comme le héros de l'accueil. */}
      <p
        role="timer"
        aria-label={`Durée de la séance : ${formatSpan(seconds)}`}
        className={cn("t-figure mt-1 tracking-[-0.05em] text-ink", seconds >= 3600 ? "text-[18cqw]" : "text-[26cqw]")}
      >
        {clock(seconds)}
      </p>
      <p className="mt-2 text-sm font-bold text-muted">
        <span className="tabular font-black text-ink">{formatSpan(daySeconds)}</span> sur {formatSpan(goalSeconds)} aujourd&apos;hui
      </p>
    </FocusRing>
  );

  /*
   * LES BOUTONS RONDS — la rangée de l'accueil, en plus grand : le geste
   * principal (Démarrer / Pause) est un disque de 84 px en DÉGRADÉ, avec
   * l'ombre de sa couleur ; « Terminer » et le plein écran, des disques
   * blancs à ombre douce. Le nom sous le disque ; toute la colonne est
   * cliquable, et le disque rebondit à l'appui (`bounce-press`).
   */
  const actions = (
    <div className="flex items-start justify-center gap-6 sm:gap-8">
      {seconds > 0 ? (
        <RoundAction label="Terminer" onClick={handleStop}>
          <Square size={22} strokeWidth={2.4} aria-hidden />
        </RoundAction>
      ) : (
        <span aria-hidden className="w-16" />
      )}
      {running ? (
        <RoundAction label="Pause" onClick={toggle} primary>
          <Pause size={34} strokeWidth={2.4} aria-hidden />
        </RoundAction>
      ) : (
        <RoundAction label={seconds ? "Reprendre" : "Démarrer"} onClick={start} primary>
          <Play size={34} strokeWidth={2.4} className="translate-x-0.5" aria-hidden />
        </RoundAction>
      )}
      <RoundAction label={fullscreen ? "Réduire" : "Plein écran"} ariaLabel={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={() => setFullscreen((value) => !value)}>
        {fullscreen ? <Minimize2 size={22} aria-hidden /> : <Maximize2 size={22} aria-hidden />}
      </RoundAction>
    </div>
  );

  if (fullscreen) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Chrono en plein écran" className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 overflow-y-auto bg-canvas px-4 py-10 text-center">
        {dial}
        {actions}
        <p className="t-meta hidden lg:block">Espace : démarrer / pause · Échap : quitter</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl text-center">
      <header className="reveal">
        <h1 className="t-display">Chrono</h1>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.9375rem] font-semibold text-muted sm:text-base">Lance-le quand tu t&apos;y mets.</p>
      </header>

      <section aria-label="Séance" className="surface reveal mt-7 space-y-8 px-5 py-7 sm:mt-10 sm:space-y-10 sm:p-12" style={{ "--i": 1 } as CSSProperties}>
        {controls}
        <div className="flex justify-center">{dial}</div>
        {selectedItem && (
          <p className="-mt-3 text-sm font-semibold text-muted">
            Il reste <span className="font-black text-ink">{formatSpan(remainingMinutes(selectedItem, sessions) * 60)}</span> sur « {selectedItem.title} ».
          </p>
        )}
        {actions}
        {/* Un raccourci clavier n'a de sens que là où il existe un clavier. */}
        <p className="t-meta hidden text-2xs lg:block">Barre d&apos;espace pour démarrer / pause</p>
      </section>
    </div>
  );
}

/** Un bouton rond et son nom dessous — voir `actions`. */
function RoundAction({
  label,
  ariaLabel,
  onClick,
  primary = false,
  children,
}: {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="group flex w-16 flex-col items-center gap-2 rounded-2xl outline-offset-4 first:mt-0">
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-full transition-transform duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:-translate-y-[3px] group-hover:scale-[1.06] group-active:scale-[.92] motion-reduce:transform-none",
          primary
            ? "grad-brand h-[5.25rem] w-[5.25rem] [box-shadow:0_14px_30px_-10px_var(--g1)]"
            : "mt-2.5 h-16 w-16 bg-[var(--action-bg)] text-ink [box-shadow:var(--action-lift)]"
        )}
      >
        {children}
      </span>
      <span className="whitespace-nowrap text-[0.8125rem] font-bold text-ink">{label}</span>
    </button>
  );
}

/**
 * L'ANNEAU FOCUS — un tracé en DÉGRADÉ de palette sur une piste grise, avec
 * un halo doux de la même couleur derrière le cadran ; dessiné dans un
 * `viewBox` pour suivre la largeur de l'écran (un `Ring` a une taille fixe
 * en pixels ; celui-ci doit remplir un téléphone ET rester raisonnable sur
 * un grand écran). Il se TRACE à l'arrivée (`.ring-draw`), puis avance en
 * douceur à chaque seconde (transition sur le décalage).
 */
function FocusRing({ percent, large, children }: { percent: number; large: boolean; children: React.ReactNode }) {
  const size = 320;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("relative mx-auto aspect-square [container-type:inline-size]", large ? "w-[min(86vw,72vh,34rem)]" : "w-[min(84vw,24rem)]")}>
      <span aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgb(var(--g1-rgb)/0.14),transparent_70%)]" />
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="focus-ring-grad" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="var(--g2)" />
            <stop offset="1" stopColor="var(--g1)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--hairline-rgb) / 0.07)" strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#focus-ring-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (clamped / 100) * circumference}
            className="ring-draw transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{ "--ring-len": circumference } as CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{children}</div>
    </div>
  );
}
