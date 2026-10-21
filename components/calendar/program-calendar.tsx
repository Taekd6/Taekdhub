"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, FileText, Moon, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { cn } from "@/lib/cn";
import { FICHES, RENTREE, dayLabel, hoursLabel, nextSession, parisClock, programDays, programStats, sessionMinutes } from "@/lib/holiday-program";

/**
 * CALENDRIER — le programme de fin de vacances, jour par jour (lib/holiday-program.ts).
 *
 * Chaque séance mène à sa page (`/seance/<id>`) : ses temps, sa fiche, ce qu'il faut noter après. Le même
 * programme part dans Calendrier Apple (abonnement ou fichier .ics), avec une alarme avant chaque séance :
 * c'est ce qui prévient sur l'iPhone et sur la montre. Ici, rien n'est modifiable : le programme est écrit,
 * et modifié par Claude à ta demande.
 */
export function ProgramCalendar() {
  // L'heure n'existe qu'après le montage : le rendu serveur et le premier rendu client sont identiques.
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(parisClock(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = programStats();
  const days = programDays();
  const today = now?.slice(0, 10) ?? null;
  const upcoming = now ? nextSession(now) : null;

  return (
    <div className="mx-auto max-w-[44rem] space-y-6">
      <PageHero title="Calendrier" lede={`Du ${dayLabel(days[0].date)} au ${dayLabel(days[days.length - 1].date)}. Rentrée : ${dayLabel(RENTREE)}.`} />

      <section aria-labelledby="calendrier-resume" className="surface p-5 sm:p-6">
        <h2 id="calendrier-resume" className="t-label inline-flex items-center gap-1.5">
          <CalendarClock size={14} aria-hidden /> {upcoming ? "Prochaine séance" : now ? "Programme terminé" : "Le programme"}
        </h2>
        {upcoming ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="t-subhead text-ink">{upcoming.title}</p>
              <p className="t-meta">
                {dayLabel(upcoming.date)} · {upcoming.start}–{upcoming.end} · {sessionMinutes(upcoming)} min
              </p>
            </div>
            <Link href={`/seance/${upcoming.id}`} className={buttonVariants({ variant: "primary", size: "md" })}>
              Ouvrir la séance <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        ) : null}
        <p className="t-meta mt-3">
          {hoursLabel(stats.workMinutes)} de travail en {stats.sessions} séances sur {stats.workDays} jours, et {stats.restDays} jours de repos complet. Chaque séance a son alarme, 15 minutes avant.
        </p>
      </section>

      <ol className="space-y-4" aria-label="Programme, jour par jour">
        {days.map((day) => {
          const isToday = day.date === today;
          return (
            <li key={day.date}>
              <section aria-labelledby={`jour-${day.date}`} className={cn("surface p-4 sm:p-5", isToday && "ring-1 ring-accent/50")}>
                <h2 id={`jour-${day.date}`} className="flex flex-wrap items-center gap-2 t-subhead capitalize text-ink">
                  {dayLabel(day.date)}
                  {isToday && <Badge variant="accent">aujourd&apos;hui</Badge>}
                </h2>
                <ul className="mt-3 divide-y divide-line">
                  {day.sessions.map((session) => (
                    <li key={session.id}>
                      <Link href={`/seance/${session.id}`} className="row-slide flex items-start gap-3 py-3">
                        <span className="w-[4.25rem] shrink-0 text-[0.875rem] font-semibold tabular-nums text-muted">
                          {session.kind === "repos" ? <Moon size={16} aria-hidden className="mt-0.5" /> : session.start}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-semibold text-ink">{session.title}</span>
                          <span className="t-meta block text-2xs">
                            {session.kind === "repos" ? session.note : `${session.start}–${session.end} · ${sessionMinutes(session)} min · ${session.chapter}`}
                          </span>
                          {session.fiche && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-accent">
                              <FileText size={12} aria-hidden /> {FICHES[session.fiche.key].label} · {session.fiche.exercises}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="calendrier-apple" className="surface p-5 sm:p-6">
        <h2 id="calendrier-apple" className="t-label inline-flex items-center gap-1.5">
          <Smartphone size={14} aria-hidden /> Dans ton Calendrier Apple
        </h2>
        <p className="t-body mt-2">
          Le programme peut arriver dans le Calendrier de ton iPhone, avec une alarme avant chaque séance (la montre suit). Deux façons :
        </p>
        <ul className="t-meta mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Abonnement</strong> (le calendrier se met à jour tout seul) : sur l&apos;iPhone, Réglages, Calendrier, Comptes, Ajouter un compte, Autre, « Ajouter un calendrier avec abonnement », puis colle l&apos;adresse{" "}
            <code className="rounded bg-inset px-1">webcal://&lt;ce site&gt;/api/calendar/&lt;ton jeton&gt;.ics</code>. Le jeton se crée dans Vercel (variable <code className="rounded bg-inset px-1">CALENDAR_TOKEN</code>) : ne le partage pas.
          </li>
          <li>
            <strong>Fichier .ics</strong> : envoyé par Claude, il s&apos;ouvre d&apos;un tap sur l&apos;iPhone (« Ajouter tout »), sans aucun réglage.
          </li>
        </ul>
        <p className="t-meta mt-3 text-2xs">
          Le sens est unique : TaekdHub écrit dans ton calendrier, il ne lit pas ce que tu y ajoutes. Déplacer une séance dans Calendrier Apple ne la déplace pas ici : demande-le à Claude.
        </p>
      </section>
    </div>
  );
}
