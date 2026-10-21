"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { dayLabel, nextSession, parisClock, sessionMinutes } from "@/lib/holiday-program";

/**
 * LA PROCHAINE SÉANCE DU PROGRAMME, sur l'accueil : visible seulement quand elle est AUJOURD'HUI ou DEMAIN
 * (ensuite, le calendrier suffit). Un tap ouvre la page de la séance, avec sa fiche.
 */
export function ProgramNextCard({ className }: { className?: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(parisClock(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const session = now ? nextSession(now) : null;
  if (!now || !session) return null;
  const today = now.slice(0, 10);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (session.date > tomorrow.toISOString().slice(0, 10)) return null;
  const when = session.date === today ? "Aujourd'hui" : "Demain";

  return (
    <Link href={`/seance/${session.id}`} className={cn("surface row-slide flex items-center gap-3 p-4 sm:p-5", className)}>
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-inset text-ink">
        <CalendarClock size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-label block">Prochaine séance du programme</span>
        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{session.title}</span>
        <span className="t-meta block text-2xs">
          {when} · {session.start}–{session.end} · {sessionMinutes(session)} min{session.date !== today ? ` · ${dayLabel(session.date)}` : ""}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}
