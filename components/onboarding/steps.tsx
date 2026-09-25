"use client";

import { CalendarDays, Clock3, Sparkles, Target, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { MinuteStepper } from "@/components/onboarding/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter } from "@/components/ui/progress";
import { Notice } from "@/components/ui/state";
import { SegmentedControl } from "@/components/ui/segmented";
import { SubjectAvatar } from "@/components/subject-avatar";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import {
  CAPACITY_PRESETS,
  MAX_DAILY_GOAL_MINUTES,
  MAX_WEEKLY_GOAL_MINUTES,
  ONBOARDING_DAILY_PRESETS,
  exceedsCapacity,
  subjectTargetsTotal,
  suggestedWeeklyGoal,
  weeklyDeclaredCapacity,
  weeklyPlannableCapacity,
  type OnboardingDraft,
} from "@/lib/onboarding";
import { MAX_DAILY_CAPACITY_MINUTES, MAX_WEEKLY_SUBJECT_TARGET_MINUTES } from "@/lib/storage";
import { subjects } from "@/lib/study";
import { cn } from "@/lib/cn";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * LES ÉCRANS DE L'ACCUEIL GUIDÉ — un par question.
 *
 * Chaque écran ne fait que DEUX choses : afficher le brouillon (`draft`) et
 * en proposer une modification (`onChange`). Il n'écrit rien : c'est la page
 * (app/(app)/bienvenue/page.tsx), seule détentrice de `usePrepahubData`, qui
 * enregistre à la toute fin. Un élève qui ferme l'onglet au troisième écran
 * ne laisse donc pas derrière lui une configuration à moitié posée.
 *
 * Le champ qui doit recevoir le focus à l'arrivée sur l'écran porte
 * `data-autofocus` ; à défaut, c'est le titre (voir `StepShell`).
 */

export type StepProps = {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  /** Marge de planification actuelle (Réglages) — pour annoncer la capacité PLANIFIABLE, pas seulement la déclarée. */
  marginPercent: number;
};

/**
 * Cadre commun : une pastille illustrée, un GRAND titre, une phrase, puis le
 * contenu. Le titre porte `tabIndex={-1}` pour pouvoir recevoir le focus à
 * chaque changement d'écran — c'est lui que le lecteur d'écran annonce.
 */
export function StepShell({
  icon,
  title,
  lede,
  titleId,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  titleId: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <span className="reveal grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent" aria-hidden>
        {icon}
      </span>
      <h1 id={titleId} tabIndex={-1} className="t-display mt-6 outline-none">
        {title}
      </h1>
      {lede && <p className="t-lede mt-3 max-w-[46ch]">{lede}</p>}
      {children && <div className="mt-9">{children}</div>}
    </div>
  );
}

/* ── 1. Bienvenue ─────────────────────────────────────────────────── */

export function NameStep({ draft, onChange }: StepProps) {
  return (
    <StepShell
      titleId="step-title"
      icon={<UserRound size={26} strokeWidth={2.2} />}
      title="Bienvenue sur TaekdHub"
      lede="Deux minutes pour fixer tes objectifs : ton temps, tes matières, tes concours. Tout se modifie ensuite dans Réglages."
    >
      <label htmlFor="onb-name" className="t-label block">
        Comment tu t&apos;appelles ?
      </label>
      <Input
        id="onb-name"
        data-autofocus
        value={draft.displayName}
        onChange={(event) => onChange({ displayName: event.target.value })}
        placeholder="Ton prénom"
        autoComplete="given-name"
        maxLength={40}
        className="mt-2.5 min-h-14 rounded-2xl px-5 text-lg font-semibold"
      />
      <p className="t-meta mt-2.5">Facultatif — il sert seulement à te saluer sur l&apos;accueil.</p>
    </StepShell>
  );
}

/* ── 2. Objectifs du jour et de la semaine ────────────────────────── */

export function GoalStep({ draft, onChange }: StepProps) {
  const suggestion = suggestedWeeklyGoal(draft);
  const fromSubjects = subjectTargetsTotal(draft.weeklySubjectTargets) > 0;
  const preset = (ONBOARDING_DAILY_PRESETS as readonly number[]).includes(draft.dailyGoalMinutes) ? draft.dailyGoalMinutes : -1;

  // L'objectif de la semaine SUIT le quotidien vers le haut : jamais moins
  // que cinq journées d'objectif. Sans cela, passer à 2 h par jour laissait
  // un « 5 h par semaine » hérité des défauts — deux objectifs qui se
  // contredisent dès le mercredi. Vers le bas, rien ne bouge : une semaine
  // plus ambitieuse que 5 × le quotidien est un choix légitime.
  function setDaily(dailyGoalMinutes: number) {
    onChange({ dailyGoalMinutes, weeklyGoalMinutes: Math.min(MAX_WEEKLY_GOAL_MINUTES, Math.max(draft.weeklyGoalMinutes, dailyGoalMinutes * 5)) });
  }

  return (
    <StepShell
      titleId="step-title"
      icon={<Target size={26} strokeWidth={2.2} />}
      title="Ton objectif du jour"
      lede="Le temps de travail personnel que tu veux faire chaque jour, en plus des cours. Un objectif que tu tiens vaut mieux qu'un objectif héroïque."
    >
      <div className="surface flex flex-col items-center gap-6 px-5 py-8">
        <MinuteStepper
          size="lg"
          label="Objectif du jour"
          value={draft.dailyGoalMinutes}
          min={30}
          max={MAX_DAILY_GOAL_MINUTES}
          onChange={setDaily}
        />
        <SegmentedControl
          ariaLabel="Préréglages de l'objectif du jour"
          value={preset}
          onChange={setDaily}
          options={ONBOARDING_DAILY_PRESETS.map((minutes) => ({ value: minutes, label: formatMinutesSpan(minutes) }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="t-subhead">Et sur la semaine</p>
          <p className="t-meta mt-0.5 max-w-[34ch]">
            {fromSubjects ? "Suggestion : la somme de tes heures par matière" : "Suggestion : cinq fois ton objectif du jour"} —{" "}
            <span className="tabular font-semibold text-ink">{formatMinutesSpan(suggestion)}</span>.
          </p>
          {draft.weeklyGoalMinutes !== suggestion && (
            <Button type="button" variant="link" size="sm" className="-ml-1 mt-1 px-1" onClick={() => onChange({ weeklyGoalMinutes: suggestion })}>
              Utiliser la suggestion
            </Button>
          )}
        </div>
        <MinuteStepper
          label="Objectif de la semaine"
          value={draft.weeklyGoalMinutes}
          min={60}
          step={60}
          max={MAX_WEEKLY_GOAL_MINUTES}
          onChange={(weeklyGoalMinutes) => onChange({ weeklyGoalMinutes })}
        />
      </div>
    </StepShell>
  );
}

/* ── 3. Heures par matière ────────────────────────────────────────── */

export function SubjectsStep({ draft, onChange, marginPercent }: StepProps) {
  const total = subjectTargetsTotal(draft.weeklySubjectTargets);
  const plannable = weeklyPlannableCapacity(draft.capacityByWeekday, marginPercent);
  const over = exceedsCapacity(draft.weeklySubjectTargets, draft.capacityByWeekday, marginPercent);

  return (
    <StepShell
      titleId="step-title"
      icon={<Sparkles size={26} strokeWidth={2.2} />}
      title="Tes heures par matière"
      lede="Combien de temps tu veux consacrer à chaque matière, par semaine. Laisse à zéro celles que tu ne veux pas suivre."
    >
      <ul className="surface divide-y divide-line overflow-hidden pl-4 sm:pl-5">
        {subjects.map((subject, index) => (
          <li
            key={subject}
            className="reveal flex min-h-[3.75rem] items-center justify-between gap-3 py-2 pr-3 sm:pr-4"
            style={{ "--i": index } as CSSProperties}
          >
            <span className="flex min-w-0 items-center gap-3">
              <SubjectAvatar subject={subject} />
              <span className="min-w-0 break-words text-[0.9375rem] font-semibold leading-snug">{subject}</span>
            </span>
            <MinuteStepper
              label={subject}
              value={draft.weeklySubjectTargets[subject]}
              max={MAX_WEEKLY_SUBJECT_TARGET_MINUTES}
              emptyLabel="Pas suivie"
              onChange={(minutes) => onChange({ weeklySubjectTargets: { ...draft.weeklySubjectTargets, [subject]: minutes } })}
            />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-baseline justify-between gap-4 px-1">
        <span className="t-subhead">Total par semaine</span>
        <span className="t-figure-md tabular">{formatMinutesSpan(total)}</span>
      </div>
      {over && (
        <Notice tone="warning" className="mt-4" title="C'est plus que ton temps libre">
          Ta semaine offre environ {formatMinutesSpan(plannable)} planifiables (écran suivant). Rien ne t&apos;empêche de viser plus haut, mais
          une semaine pleine à craquer est rarement tenue.
        </Notice>
      )}
    </StepShell>
  );
}

/* ── 4. Temps libre par jour ──────────────────────────────────────── */

export function CapacityStep({ draft, onChange, marginPercent }: StepProps) {
  const declared = weeklyDeclaredCapacity(draft.capacityByWeekday);
  const plannable = weeklyPlannableCapacity(draft.capacityByWeekday, marginPercent);
  const peak = Math.max(240, ...draft.capacityByWeekday);

  function setDay(index: number, minutes: number) {
    onChange({ capacityByWeekday: draft.capacityByWeekday.map((value, day) => (day === index ? minutes : value)) });
  }

  return (
    <StepShell
      titleId="step-title"
      icon={<Clock3 size={26} strokeWidth={2.2} />}
      title="Ton temps libre par jour"
      lede="Ce dont tu disposes vraiment pour travailler, une fois les cours, les colles et les trajets passés. TaekdHub ne planifiera jamais au-delà."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Profils de semaine">
        {CAPACITY_PRESETS.map((preset) => {
          const active = preset.minutes.every((value, index) => value === draft.capacityByWeekday[index]);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ capacityByWeekday: [...preset.minutes] })}
              className={cn(
                "press min-h-11 rounded-full px-4 text-left text-[0.8125rem] font-bold",
                active ? "bg-accent-solid text-accent-solid-foreground" : "bg-inset text-ink hover:bg-accent/15"
              )}
            >
              {preset.label}
              <span className={cn("block text-2xs font-medium", active ? "opacity-80" : "text-muted")}>{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <ul className="surface mt-6 divide-y divide-line overflow-hidden pl-4 sm:pl-5">
        {WEEKDAY_LABELS.map((label, index) => {
          const minutes = draft.capacityByWeekday[index] ?? 0;
          return (
            <li key={label} className="flex min-h-[3.75rem] items-center gap-3 py-2 pr-3 sm:pr-4">
              <span className="w-[5.5rem] shrink-0 text-[0.9375rem] font-semibold">{label}</span>
              <Meter value={(minutes / peak) * 100} index={index} className="hidden min-w-0 flex-1 sm:block" />
              <MinuteStepper
                className="ml-auto"
                label={label}
                value={minutes}
                max={MAX_DAILY_CAPACITY_MINUTES}
                emptyLabel="Repos"
                onChange={(next) => setDay(index, next)}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="well px-4 py-3.5">
          <p className="t-meta">Déclaré</p>
          <p className="t-figure-sm tabular mt-1">{formatMinutesSpan(declared)}</p>
        </div>
        <div className="well px-4 py-3.5">
          <p className="t-meta">Planifiable</p>
          <p className="t-figure-sm tabular mt-1 text-accent">{formatMinutesSpan(plannable)}</p>
        </div>
      </div>
      <p className="t-meta mt-2.5 px-1">
        {marginPercent} % de chaque journée restent libres : un exercice qui déborde ne décale pas toute la soirée.
      </p>
    </StepShell>
  );
}

/* ── 5. Date des concours ─────────────────────────────────────────── */

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Jours pleins d'aujourd'hui à la date donnée — « dans 223 jours ». Négatif si la date est passée. */
function daysUntil(day: string, now: Date = new Date()): number {
  const target = new Date(`${day}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function ContestStep({ draft, onChange }: StepProps) {
  const days = draft.contestDate ? daysUntil(draft.contestDate) : null;
  return (
    <StepShell
      titleId="step-title"
      icon={<CalendarDays size={26} strokeWidth={2.2} />}
      title="Tes concours, c'est quand ?"
      lede="La date de la première épreuve écrite. L'accueil affichera le compte à rebours — facultatif, tu peux laisser vide."
    >
      <label htmlFor="onb-contest" className="t-label block">
        Date des concours
      </label>
      <Input
        id="onb-contest"
        data-autofocus
        type="date"
        value={draft.contestDate}
        onChange={(event) => onChange({ contestDate: event.target.value })}
        className="mt-2.5 min-h-14 rounded-2xl px-5 text-lg font-semibold"
      />
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p className="t-meta" aria-live="polite">
          {days === null ? "Pas de date pour l'instant." : days > 0 ? (
            <>
              Dans <span className="tabular font-bold text-ink">{days}</span> jours.
            </>
          ) : (
            "Cette date est déjà passée."
          )}
        </p>
        {draft.contestDate && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ contestDate: "" })}>
            Effacer la date
          </Button>
        )}
      </div>
    </StepShell>
  );
}

/* ── 6. Récapitulatif ─────────────────────────────────────────────── */

export function RecapStep({ draft, marginPercent, onEdit }: StepProps & { onEdit: (step: number) => void }) {
  const followed = subjects.filter((subject) => draft.weeklySubjectTargets[subject] > 0);
  const rows: { label: string; value: React.ReactNode; step: number }[] = [
    { label: "Prénom", value: draft.displayName.trim() || "—", step: 0 },
    { label: "Objectif du jour", value: formatMinutesSpan(draft.dailyGoalMinutes), step: 1 },
    { label: "Objectif de la semaine", value: formatMinutesSpan(draft.weeklyGoalMinutes), step: 1 },
    {
      label: "Matières suivies",
      value: `${followed.length} · ${formatMinutesSpan(subjectTargetsTotal(draft.weeklySubjectTargets))} / sem.`,
      step: 2,
    },
    {
      label: "Temps planifiable",
      value: `${formatMinutesSpan(weeklyPlannableCapacity(draft.capacityByWeekday, marginPercent))} / sem.`,
      step: 3,
    },
    { label: "Concours", value: draft.contestDate ? longDate.format(new Date(`${draft.contestDate}T00:00:00`)) : "Pas de date", step: 4 },
  ];

  return (
    <StepShell
      titleId="step-title"
      icon={<Sparkles size={26} strokeWidth={2.2} />}
      title={draft.displayName.trim() ? `C'est prêt, ${draft.displayName.trim()}.` : "C'est prêt."}
      lede="Voici ce que tu t'es fixé. Tout reste modifiable à tout moment dans Réglages."
    >
      <dl className="surface divide-y divide-line overflow-hidden pl-4 sm:pl-5">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="reveal flex min-h-[3.5rem] items-center justify-between gap-3 py-2 pr-2 sm:pr-3"
            style={{ "--i": index } as CSSProperties}
          >
            <dt className="t-meta min-w-0">{row.label}</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="tabular truncate text-right text-[0.9375rem] font-bold">{row.value}</span>
              <Button type="button" variant="link" size="sm" className="px-2" onClick={() => onEdit(row.step)} aria-label={`Modifier : ${row.label}`}>
                Modifier
              </Button>
            </dd>
          </div>
        ))}
      </dl>
    </StepShell>
  );
}
