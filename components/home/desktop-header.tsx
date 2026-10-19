"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { DayStack } from "@/lib/day-stack";
import { subjectMeta } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { formatSpan } from "@/lib/utils";

/**
 * L'ACCUEIL « TABLEAU DE BORD » — salutation, horloge, bandeau de la
 * semaine, progression du jour. Aucune pièce ne lit de données :
 * tout arrive calculé du seul `usePrepahubData()` de
 * components/dashboard-overview.tsx. Sur téléphone : salutation courte,
 * semaine et progression ; l'horloge et la date longue
 * n'apparaissent qu'à partir de `lg`.
 */

const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const clockFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/** L'heure, rendue seulement après le montage : le serveur ne connaît pas celle de l'élève. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function HomeGreeting({ className }: { className?: string }) {
  const now = useNow();
  const evening = now ? now.getHours() >= 18 : false;
  return (
    <header className={cn("flex items-end justify-between gap-8", className)}>
      <div className="min-w-0">
        <p className="hidden text-sm font-medium text-muted first-letter:uppercase lg:block">{longDate.format(now ?? new Date())}</p>
        <h1 className="font-serif text-4xl lg:mt-1 lg:text-6xl font-semibold tracking-tight text-ink">{evening ? "Bonsoir" : "Bonjour"}</h1>
      </div>
      <div className="hidden shrink-0 text-right lg:block" aria-hidden={now === null}>
        <p className="font-serif text-7xl font-light leading-none tracking-tight text-ink tabular" suppressHydrationWarning>
          {now ? clockFormat.format(now) : " "}
        </p>
        <p className="mt-2 text-sm text-muted first-letter:uppercase">{shortDate.format(now ?? new Date())}</p>
      </div>
    </header>
  );
}

/** Le bandeau de la semaine : lundi → dimanche, aujourd'hui en relief, le temps travaillé en dessous. */
export function WeekStrip({ week, className }: { week: DayStack[]; className?: string }) {
  return (
    <nav aria-label="Semaine en cours" className={cn("surface grid grid-cols-7 gap-1.5 p-2", className)}>
      {week.map((day) => {
        const date = new Date(`${day.key}T12:00:00`);
        return (
          <Link
            key={day.key}
            href="/history"
            aria-current={day.isToday ? "date" : undefined}
            aria-label={`${day.longLabel}${day.isFuture ? "" : `, ${formatSpan(day.totalSeconds)} de travail`}`}
            className={cn(
              "press flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors",
              day.isToday ? "bg-accent/10 text-accent" : "text-muted hover:bg-inset"
            )}
          >
            <span className="text-xs font-medium capitalize">{weekdayShort.format(date).replace(".", "")}</span>
            <span className={cn("text-xl font-semibold tabular", day.isToday ? "text-accent" : "text-ink")}>{date.getDate()}</span>
            <span aria-hidden className={cn("h-1 w-1 rounded-full", day.isToday ? "bg-accent" : day.totalSeconds > 0 && !day.isFuture ? "bg-subtle" : "bg-transparent")} />
          </Link>
        );
      })}
    </nav>
  );
}

const RING = 2 * Math.PI * 44;

/** La progression du jour : un anneau (temps travaillé / objectif) et la répartition par matière. */
export function DayProgress({
  workedMinutes,
  goalMinutes,
  bySubject,
  className,
}: {
  workedMinutes: number;
  goalMinutes: number;
  bySubject: { subject: Subject; minutes: number }[];
  className?: string;
}) {
  const percent = goalMinutes > 0 ? Math.min(100, Math.round((workedMinutes / goalMinutes) * 100)) : 0;
  const total = bySubject.reduce((sum, entry) => sum + entry.minutes, 0);
  return (
    <section aria-labelledby="progression-titre" className={cn("surface p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 id="progression-titre" className="text-sm font-semibold text-muted">
          Progression du jour
        </h2>
        <Link href="/progress" className="text-xs font-semibold text-accent">
          Voir plus ›
        </Link>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-inset" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              className="stroke-accent transition-[stroke-dashoffset] duration-700"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - percent / 100)}
            />
          </svg>
          <p className="absolute inset-0 grid place-items-center text-xl font-semibold tabular text-ink">{goalMinutes > 0 ? `${percent} %` : "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular text-ink">{formatSpan(workedMinutes * 60)}</p>
          <p className="text-sm text-muted">{goalMinutes > 0 ? `sur ${formatSpan(goalMinutes * 60)}` : "pas d’objectif réglé"}</p>
        </div>
      </div>
      {total > 0 && (
        <>
          <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
            {bySubject.map(({ subject, minutes }) => (
              <span key={subject} style={{ width: `${(minutes / total) * 100}%`, background: subjectMeta[subject].fill }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {bySubject.map(({ subject, minutes }) => (
              <li key={subject} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: subjectMeta[subject].fill }} />
                {subject} {minutes} min
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
