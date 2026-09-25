import Link from "next/link";
import type { CSSProperties } from "react";
import { CountUp } from "@/components/ui/count-up";
import { GradientCard } from "@/components/ui/gradient-card";
import { BlockHeader, DateBadge, ListCard, ListRow } from "@/components/ui/list-card";
import { cn } from "@/lib/cn";
import type { WorkItemPriority } from "@/lib/deadlines";
import { formatDueDay } from "@/lib/spaced-repetition";
import type { Subject } from "@/lib/supabase/types";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * LES CARTES DE L'ACCUEIL — sous le héros, dans l'ordre de la maquette :
 * la galerie des matières en DÉGRADÉ, la bannière des révisions, la liste
 * des échéances, les deux petites tuiles (Série, Semaine).
 *
 * Aucune ne lit de données : tout arrive du seul `usePrepahubData()` de
 * components/dashboard-overview.tsx, déjà calculé.
 */

/* ── MATIÈRES ───────────────────────────────────────────────────── */

export interface SubjectCard {
  subject: Subject;
  seconds: number;
  targetMinutes: number;
}

/**
 * Un signe par matière, en GROS et en 900 — le « ∫ » de la maquette. Des
 * caractères de texte, jamais des émojis (le « ⚛ » de la maquette tombe en
 * émoji minuscule hors appareil Apple : λ le remplace), pour qu'ils prennent le blanc de la carte.
 */
const SUBJECT_GLYPH: Record<Subject, string> = {
  Mathématiques: "∫",
  Physique: "λ",
  Chimie: "pH",
  "Informatique TC": "</>",
  "Informatique Spé": "{ }",
  Français: "¶",
  Anglais: "Aa",
};

/** Nom court sur la carte (158 px de large) — le nom complet reste dans l'`aria-label`. */
const SUBJECT_CARD_NAME: Record<Subject, string> = {
  Mathématiques: "Maths",
  Physique: "Physique",
  Chimie: "Chimie",
  "Informatique TC": "Info TC",
  "Informatique Spé": "Info Spé",
  Français: "Français",
  Anglais: "Anglais",
};

/** Anneau blanc sur la carte : la part du budget de la semaine déjà faite. Se trace à l'entrée (`.ring-draw`). */
function CardRing({ percent, index }: { percent: number; index: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <circle cx={22} cy={22} r={radius} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth={5} />
      {clamped > 0 && (
        <circle
          cx={22}
          cy={22}
          r={radius}
          fill="none"
          stroke="#fff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          transform="rotate(-90 22 22)"
          className="ring-draw"
          style={{ "--ring-len": circumference, "--i": index } as CSSProperties}
        />
      )}
    </svg>
  );
}

/**
 * GALERIE DES MATIÈRES — des cartes en dégradé de 158 × 190, qui flottent,
 * s'inclinent au survol, et défilent à l'horizontale. Les couleurs suivent
 * la liste CYCLÉE de la palette (carte 1, 2, 3, 4, 1…) : elles ne disent pas
 * « c'est les maths », seulement « carte suivante ».
 *
 * Sont montrées les matières qui ont un budget OU du temps cette semaine :
 * une carte « 0 min sur rien » n'apprend rien.
 */
export function SubjectCards({ cards, className }: { cards: SubjectCard[]; className?: string }) {
  const shown = cards.filter((card) => card.targetMinutes > 0 || card.seconds > 0);
  return (
    <section aria-labelledby="matieres-titre" className={cn("reveal min-w-0", className)} style={{ "--i": 3 } as CSSProperties}>
      <BlockHeader id="matieres-titre" title="Matières" href="/preparation" className="mb-3" />
      {shown.length === 0 ? (
        <Link href="/settings#budgets" className="surface lift block p-5 text-[0.9375rem] font-bold text-muted">
          Fixe un budget par matière pour suivre ta semaine ›
        </Link>
      ) : (
        // La rangée déborde à droite jusqu'au bord de l'écran sur téléphone
        // (la carte suivante « dépasse » : on devine qu'il y en a d'autres),
        // et garde de la place en haut/en bas pour le flottement et l'ombre.
        <div className="scrollbar-none -mx-4 -my-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {shown.map((card, index) => {
            const percent = card.targetMinutes > 0 ? (card.seconds / 60 / card.targetMinutes) * 100 : 0;
            return (
              <GradientCard
                key={card.subject}
                tone={index}
                index={index}
                float
                href={`/preparation?subject=${encodeURIComponent(card.subject)}`}
                aria-label={`${card.subject} : ${formatSpan(card.seconds)} cette semaine${card.targetMinutes > 0 ? ` sur ${formatMinutesSpan(card.targetMinutes)}` : ""}`}
                wrapperClassName="shrink-0 snap-start"
                className="flex h-[11.875rem] w-[9.875rem] flex-col justify-between p-4"
              >
                <span aria-hidden className="flex items-start justify-between gap-2">
                  <span className="t-glyph whitespace-nowrap">{SUBJECT_GLYPH[card.subject]}</span>
                  {card.targetMinutes > 0 && <CardRing percent={percent} index={index} />}
                </span>
                <span aria-hidden className="block">
                  <span className="block text-base font-extrabold">{SUBJECT_CARD_NAME[card.subject]}</span>
                  <span className="block text-2xl font-black tabular tracking-[-0.02em]">
                    <CountUp value={Math.round(card.seconds / 60)} format={(minutes) => formatSpan(minutes * 60)} />
                  </span>
                  <span className="block text-xs font-bold opacity-75">
                    {card.targetMinutes > 0 ? `sur ${formatMinutesSpan(card.targetMinutes)}` : "cette semaine"}
                  </span>
                </span>
              </GradientCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── RÉVISIONS DU JOUR ──────────────────────────────────────────── */

/** Deux minutes par carte : une question, une réponse retrouvée de tête, une note. */
const MINUTES_PER_CARD = 2;

export function ReviewBanner({ due, next, className }: { due: number; next: { day: string; count: number } | null; className?: string }) {
  const done = due === 0;
  return (
    <GradientCard
      tone="review"
      href={done ? "/revoir" : "/revoir/session"}
      className={cn("reveal flex items-center gap-3.5 p-[1.125rem]", className)}
      style={{ "--i": 4 } as CSSProperties}
      aria-label={done ? "Révisions à jour — ouvrir le carnet" : `${due} ${due > 1 ? "cartes" : "carte"} à revoir aujourd'hui, environ ${due * MINUTES_PER_CARD} minutes. Commencer.`}
    >
      <span aria-hidden className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-black tabular">
        {done ? "✓" : <CountUp value={due} />}
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="t-card-title block">{done ? "Révisions à jour" : "Révisions du jour"}</span>
        <span className="block truncate text-[0.8125rem] font-bold opacity-80">
          {done
            ? next
              ? `Prochaine ${formatDueDay(next.day)} · ${next.count} ${next.count > 1 ? "cartes" : "carte"}`
              : "Rien de programmé"
            : `≈ ${due * MINUTES_PER_CARD} min`}
        </span>
      </span>
      <span aria-hidden className="shrink-0 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#0b0b14]">
        {done ? "Carnet" : "Go"}
      </span>
    </GradientCard>
  );
}

/* ── ÉCHÉANCES ──────────────────────────────────────────────────── */

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
  soon: "text-accent",
  calm: "text-subtle",
} as const;

export function DeadlinesCard({ deadlines, className }: { deadlines: WorkItemPriority[]; className?: string }) {
  return (
    <ListCard title="Échéances" titleId="echeances-titre" href="/echeances" hrefLabel={deadlines.length > 0 ? "Tout voir" : "Ajouter"} index={5} className={className}>
      {deadlines.length > 0 ? (
        <ul>
          {deadlines.map((priority, index) => {
            const state = deadlineState(priority);
            const due = priority.item.dueDate ? new Date(`${priority.item.dueDate}T00:00:00`) : null;
            const kind = WORK_ITEM_KIND_META[priority.item.kind].short;
            return (
              <li key={priority.item.id}>
                <ListRow
                  href={`/timer?travail=${priority.item.id}`}
                  ariaLabel={`${priority.item.title} — ${state.label}, reste ${formatSpan(priority.remainingMinutes * 60)} de travail. Travailler au chrono.`}
                  leading={<DateBadge date={due} tone={index} />}
                  title={priority.item.title}
                  sub={
                    <>
                      {state.label}
                      <span className="text-subtle/80">
                        {" "}
                        · {kind}
                        {priority.item.subject && ` · ${priority.item.subject}`}
                      </span>
                    </>
                  }
                  subClassName={DEADLINE_TONE_CLASS[state.tone]}
                  value={formatSpan(priority.remainingMinutes * 60)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3 pb-4 pt-1 text-[0.9375rem] font-semibold text-muted">Aucune échéance datée. Note un DM ou un DS : il se répartit sur tes journées.</p>
      )}
    </ListCard>
  );
}

/* ── SÉRIE ET SEMAINE ───────────────────────────────────────────── */

export function StatTiles({
  streak,
  weekSeconds,
  weekGoalMinutes,
  className,
}: {
  streak: number;
  weekSeconds: number;
  weekGoalMinutes: number;
  className?: string;
}) {
  const weekPercent = weekGoalMinutes > 0 ? Math.min(100, Math.round((weekSeconds / 60 / weekGoalMinutes) * 100)) : 0;
  return (
    <div className={cn("reveal grid grid-cols-2 gap-3", className)} style={{ "--i": 6 } as CSSProperties}>
      <Link href="/progress" className="surface lift block p-4">
        <p className="text-[0.8125rem] font-bold text-muted">Série</p>
        <p className="t-stat mt-1 text-ink">
          <CountUp value={streak} format={(value) => `${value} ${value > 1 ? "jours" : "jour"}`} />
        </p>
      </Link>
      <Link href="/progress" className="surface lift block p-4">
        <p className="text-[0.8125rem] font-bold text-muted">Semaine</p>
        <p className="t-stat mt-1 text-ink">
          <CountUp value={Math.round(weekSeconds / 60)} format={(minutes) => formatSpan(minutes * 60)} />
        </p>
        {weekGoalMinutes > 0 && (
          <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-inset">
            <span className="grow-x grad-brand block h-full rounded-full" style={{ width: `${Math.max(weekPercent, 3)}%` }} />
          </span>
        )}
      </Link>
    </div>
  );
}
