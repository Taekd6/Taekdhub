import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeTile } from "@/components/home/tile";
import { buttonVariants } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Ring } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/subject-avatar";
import { cn } from "@/lib/cn";
import type { DailyObjective } from "@/lib/daily-objective";
import type { SubjectSeconds } from "@/lib/day-stack";
import type { WorkItemPriority } from "@/lib/deadlines";
import type { PlannedDay } from "@/lib/planning";
import { formatDueDay } from "@/lib/spaced-repetition";
import type { ReviewItem } from "@/lib/storage";
import { subjectMeta } from "@/lib/study";
import { formatSpan } from "@/lib/utils";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * LES TROIS TUILES DU HAUT — « Ma journée », « Mes échéances », « Mes
 * révisions du jour ». Ce sont les trois questions que l'élève se pose en
 * ouvrant l'application, et les trois seules à mériter le haut de l'écran.
 *
 * Composition en BENTO, pas en rangée de trois cartes égales : sur grand
 * écran, « Ma journée » est une tuile HAUTE à gauche (l'anneau a besoin de
 * place pour se lire comme une forme), les deux autres s'empilent à droite.
 * Sur téléphone, les trois se suivent dans l'ordre de la phrase.
 *
 * Ces composants ne lisent AUCUNE donnée eux-mêmes : tout arrive du seul
 * `usePrepahubData()` de l'accueil, déjà calculé.
 */

/* ── MA JOURNÉE ─────────────────────────────────────────────────── */

export function TodayTile({ objective, parts, index }: { objective: DailyObjective; parts: SubjectSeconds[]; index?: number }) {
  return (
    <HomeTile
      illustration="chrono"
      title="Ma journée"
      index={index}
      href="/history"
      hrefLabel="Mes séances"
      className="lg:col-span-5 lg:row-span-2"
      bodyClassName="flex flex-col items-center justify-center gap-7"
    >
      {/* L'ANNEAU À L'ACCENT — le seul de l'écran. Il se TRACE quand la
          tuile entre dans l'écran (`.ring-draw`), et le chiffre du centre
          monte en même temps : les deux racontent la même journée. */}
      <Ring value={objective.percent} size={236} strokeWidth={18}>
        <div className="text-center">
          <p className="t-figure-lg">
            <CountUp value={objective.workedMinutes} />
          </p>
          <p className="t-meta mt-1.5 font-semibold">sur {objective.goalMinutes} min</p>
        </div>
      </Ring>

      <div className="w-full text-center">
        <p className={cn("t-subhead", objective.met && "text-accent")}>
          {objective.met
            ? "Objectif atteint."
            : objective.workedMinutes === 0
              ? "Pas encore commencé."
              : `Encore ${objective.remainingMinutes} min.`}
        </p>
        {parts.length > 0 ? (
          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-label="Temps d'aujourd'hui par matière">
            {parts.map((part) => (
              <li key={part.subject} className="flex items-center gap-1.5 text-[0.8125rem]">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", subjectMeta[part.subject].solid)} />
                <span className="font-semibold text-ink">{part.subject}</span>
                <span className="tabular text-muted">{formatSpan(part.seconds)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-meta mx-auto mt-2 max-w-[30ch]">Une séance au chrono ou une saisie rapide, et l&apos;anneau se remplit.</p>
        )}
      </div>
    </HomeTile>
  );
}

/* ── MES ÉCHÉANCES ──────────────────────────────────────────────── */

const WEEKDAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/**
 * L'état d'une échéance en mots — le passé d'abord (« En retard », rouge),
 * puis la projection (« Ne tient plus », orange), puis la distance. Deux
 * signaux distincts, jamais fondus : voir components/work/work-item-row.tsx.
 */
export function deadlineState(priority: WorkItemPriority): { label: string; tone: "danger" | "warning" | "soon" | "calm" } {
  if (priority.overdue) return { label: "En retard", tone: "danger" };
  if (priority.feasibility.level === "non casable") return { label: "Ne tient plus", tone: "warning" };
  const days = priority.daysUntilDue;
  if (days === 0) return { label: "Aujourd'hui", tone: "soon" };
  if (days === 1) return { label: "Demain", tone: "soon" };
  if (days === null) return { label: "Sans date", tone: "calm" };
  return { label: `Dans ${days} jours`, tone: "calm" };
}

export const DEADLINE_TONE_CLASS = {
  danger: "text-rose-300",
  warning: "text-amber-300",
  soon: "text-ink",
  calm: "text-muted",
} as const;

export function DeadlinesTile({
  deadlines,
  today,
  index,
}: {
  deadlines: WorkItemPriority[];
  today: PlannedDay | undefined;
  index?: number;
}) {
  const planned = today?.load.plannedMinutes ?? 0;
  return (
    <HomeTile
      illustration="echeances"
      title="Mes échéances"
      index={index}
      href="/echeances"
      hrefLabel={deadlines.length > 0 ? "Toutes les échéances" : "Ajouter une échéance"}
      className="lg:col-span-7"
      meta={
        today && planned > 0 ? (
          <span>
            Aujourd&apos;hui <span className="tabular text-ink">{formatSpan(planned * 60)}</span> prévues
          </span>
        ) : undefined
      }
    >
      {deadlines.length > 0 ? (
        <ul className="-mx-2 divide-y divide-line">
          {deadlines.map((priority) => {
            const state = deadlineState(priority);
            const due = priority.item.dueDate ? new Date(`${priority.item.dueDate}T00:00:00`) : null;
            return (
              <li key={priority.item.id}>
                <Link
                  href={`/timer?travail=${priority.item.id}`}
                  className="row-hover flex min-h-14 items-center gap-4 rounded-xl px-2 py-3"
                  aria-label={`${priority.item.title} — ${state.label}, reste ${formatSpan(priority.remainingMinutes * 60)} de travail. Travailler au chrono.`}
                >
                  {/* Le jour, en grand, comme sur un calendrier : c'est ce
                      qu'on retient d'une échéance. */}
                  <span aria-hidden className="w-11 shrink-0 text-center">
                    {due ? (
                      <>
                        <span className="block text-2xs font-semibold text-subtle">{WEEKDAYS_SHORT[due.getDay()]}</span>
                        <span className="t-figure-sm block">{due.getDate()}</span>
                      </>
                    ) : (
                      <span className="text-2xs text-subtle">—</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1" aria-hidden>
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">{priority.item.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[0.8125rem]">
                      <span className={cn("shrink-0 whitespace-nowrap font-semibold", DEADLINE_TONE_CLASS[state.tone])}>{state.label}</span>
                      <span className="truncate text-subtle">
                        {WORK_ITEM_KIND_META[priority.item.kind].short}
                        {priority.item.subject && ` · ${priority.item.subject}`}
                      </span>
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-right">
                    <span className="tabular block text-[0.9375rem] font-bold text-ink">{formatSpan(priority.remainingMinutes * 60)}</span>
                    <span className="block text-2xs text-subtle">à faire</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="t-meta max-w-[40ch]">Aucune échéance datée. Note un DM ou un DS : TaekdHub le répartit sur tes journées.</p>
      )}
    </HomeTile>
  );
}

/* ── MES RÉVISIONS DU JOUR ──────────────────────────────────────── */

export function ReviewsTile({
  due,
  next,
  index,
}: {
  /** Les entrées dues aujourd'hui (lib/spaced-repetition.ts#dueReviewItems). */
  due: ReviewItem[];
  next: { day: string; count: number } | null;
  index?: number;
}) {
  const first = due[0];
  return (
    <HomeTile
      illustration="revisions"
      title="Mes révisions du jour"
      index={index}
      href="/revoir"
      hrefLabel="Le carnet"
      className="lg:col-span-7"
    >
      {first ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="shrink-0 sm:w-36">
            <p className="t-figure-lg text-accent">
              <CountUp value={due.length} />
            </p>
            <p className="t-meta mt-1 font-semibold">{due.length > 1 ? "cartes à revoir" : "carte à revoir"}</p>
          </div>
          {/* APERÇU DE LA PREMIÈRE CARTE — la question seule, la réponse
              cachée : on a déjà envie de la retrouver avant d'avoir cliqué. */}
          <div className="well min-w-0 flex-1 p-4">
            <p className="flex items-center gap-2 text-2xs font-semibold text-subtle">
              <SubjectAvatar subject={first.subject} size="sm" /> {first.subject}
            </p>
            <p className="mt-2 line-clamp-2 text-[0.9375rem] font-semibold text-ink">{first.text}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-2xs text-subtle">{first.answer ? "Réponse cachée — à retrouver de tête" : "Tu t'en souviens ?"}</span>
              <Link href="/revoir/session" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                Réviser <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : next ? (
        <p className="t-meta">
          Rien à revoir aujourd&apos;hui. Prochaine révision {formatDueDay(next.day)} ·{" "}
          <span className="tabular">{next.count}</span> {next.count > 1 ? "cartes" : "carte"}.
        </p>
      ) : (
        <p className="t-meta max-w-[42ch]">
          Aucune révision programmée. Ce que tu notes plus bas, dans « Ce qu&apos;il faut reprendre », revient ici au bon moment.
        </p>
      )}
    </HomeTile>
  );
}
