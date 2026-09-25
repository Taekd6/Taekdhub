import Link from "next/link";
import { Settings } from "lucide-react";
import type { CSSProperties } from "react";
import { AreaChart } from "@/components/ui/chart";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/cn";
import type { DayStack } from "@/lib/day-stack";
import { formatSpan } from "@/lib/utils";

/**
 * LE HAUT DE L'ACCUEIL — trois pièces de la maquette « Revolut clair » :
 *
 *   `HomeTopBar`   avatar en dégradé (l'initiale), pastille de date en
 *                  verre, bouton Réglages rond ;
 *   `TodayHero`    « Aujourd'hui », le temps du jour en TRÈS grand qui
 *                  compte jusqu'à sa valeur, et la pastille « vs hier » ;
 *   `WeekCurve`    la semaine en courbe lisse qui se dessine.
 *
 * Aucun de ces composants ne lit de données : tout arrive calculé du seul
 * `usePrepahubData()` de components/dashboard-overview.tsx.
 */

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function HomeTopBar({ name, contestDays, className }: { name: string; contestDays: number | null; className?: string }) {
  const date = dateFormatter.format(new Date());
  const initial = (name.trim()[0] ?? "T").toUpperCase();
  return (
    <div className={cn("reveal flex items-center gap-2.5", className)}>
      <Link
        href="/settings"
        aria-label={name ? `${name} — réglages du profil` : "Réglages du profil"}
        className="grad-brand bounce-press grid h-[2.375rem] w-[2.375rem] shrink-0 place-items-center rounded-full text-[0.9375rem] font-extrabold [box-shadow:0_8px_18px_-8px_var(--g1)]"
      >
        {initial}
      </Link>
      <p className="glass flex h-[2.375rem] min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-muted">
        <span className="truncate first-letter:uppercase">{date}</span>
        {contestDays !== null && (
          <span className="ml-auto shrink-0 font-extrabold text-accent" title="Jours avant le concours">
            J−{contestDays}
          </span>
        )}
      </p>
      <Link
        href="/settings"
        aria-label="Réglages"
        className="glass bounce-press grid h-[2.375rem] w-[2.375rem] shrink-0 place-items-center rounded-full text-ink lg:hidden"
      >
        <Settings size={18} strokeWidth={2.1} aria-hidden />
      </Link>
    </div>
  );
}

/** « 35 min », « 1 h 20 » — pour la pastille de comparaison. */
function spanMinutes(minutes: number): string {
  return formatSpan(minutes * 60);
}

/**
 * Le chiffre du héros : « 2 h 15 », l'unité plus petite et grise, comme la
 * maquette ; « 45 min » sous l'heure.
 */
function HeroFigure({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = "text-[0.47em] font-extrabold text-subtle/70";
  if (h === 0) {
    return (
      <>
        {m}
        <span className={unit}> min</span>
      </>
    );
  }
  return (
    <>
      {h}
      <span className={unit}> h </span>
      {String(m).padStart(2, "0")}
    </>
  );
}

export function TodayHero({
  todayMinutes,
  yesterdayMinutes,
  goalMinutes,
  className,
}: {
  todayMinutes: number;
  yesterdayMinutes: number;
  goalMinutes: number;
  className?: string;
}) {
  const diff = todayMinutes - yesterdayMinutes;
  // Pas de comparaison sans rien à comparer : deux journées vides ne font
  // pas « = hier ».
  const showChip = todayMinutes > 0 || yesterdayMinutes > 0;
  const met = goalMinutes > 0 && todayMinutes >= goalMinutes;
  return (
    <div className={cn("reveal text-center", className)} style={{ "--i": 1 } as CSSProperties}>
      <p className="text-sm font-bold text-muted">Aujourd&apos;hui</p>
      <p className="t-hero mt-1.5 text-ink">
        <span className="sr-only">{formatSpan(todayMinutes * 60)} de travail aujourd&apos;hui</span>
        <span aria-hidden>
          <CountUp value={todayMinutes} duration={1500} format={(value) => <HeroFigure minutes={value} />} />
        </span>
      </p>
      <div className="mt-3.5 flex min-h-[2rem] flex-wrap items-center justify-center gap-2">
        {showChip && (
          <span
            className={cn(
              "pop inline-flex items-center rounded-full px-3 py-1.5 text-[0.8125rem] font-extrabold tabular",
              diff > 0 ? "bg-accent/10 text-accent" : "bg-inset text-muted"
            )}
            style={{ "--pop-delay": "1.2s" } as CSSProperties}
          >
            {diff > 0 ? `+${spanMinutes(diff)}` : diff < 0 ? `−${spanMinutes(-diff)}` : "Comme"} {diff === 0 ? "hier" : "vs hier"}
          </span>
        )}
        {met && (
          <span className="pop inline-flex items-center rounded-full bg-emerald-400/[0.14] px-3 py-1.5 text-[0.8125rem] font-extrabold text-emerald-300" style={{ "--pop-delay": "1.35s" } as CSSProperties}>
            Objectif atteint
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LA SEMAINE EN COURBE — minutes par jour, lundi → dimanche. Les jours à
 * venir n'ont pas de valeur (la courbe s'arrête à aujourd'hui, voir
 * `AreaChart`).
 */
export function WeekCurve({ week, className }: { week: DayStack[]; className?: string }) {
  const points = week.map((day) => ({
    label: day.label,
    title: day.longLabel,
    value: day.isFuture ? null : Math.round(day.totalSeconds / 60),
    highlight: day.isToday,
  }));
  const aria = `Temps de travail de la semaine, jour par jour : ${week
    .filter((day) => !day.isFuture)
    .map((day) => `${day.longLabel}, ${formatSpan(day.totalSeconds)}`)
    .join(" ; ")}.`;
  return (
    <div className={cn("reveal", className)} style={{ "--i": 2 } as CSSProperties}>
      <AreaChart points={points} ariaLabel={aria} formatValue={(minutes) => formatSpan(minutes * 60)} />
    </div>
  );
}
