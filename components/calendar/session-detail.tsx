"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, ExternalLink, FileText, Timer, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState, Notice } from "@/components/ui/state";
import { FICHES, HOLIDAY_PROGRAM, dayLabel, ficheUrl, sessionById, sessionMinutes } from "@/lib/holiday-program";

/**
 * LA PAGE D'UNE SÉANCE — ce que le lien de l'événement du calendrier ouvre.
 *
 * Les trois temps dans l'ordre, la fiche à ouvrir (ou à imprimer) et la grille de rédaction, puis la
 * consigne de bilan : le résultat se note juste après, depuis la montre ou ici, pour que le bilan par
 * chapitre et le prochain programme reposent sur des faits.
 */
const MOMENT_LABEL = { matin: "Bloc du matin", "apres-midi": "Bloc de l'après-midi", soir: "Bloc du soir", repos: "Repos" } as const;

export function SessionDetail({ id }: { id: string }) {
  const session = sessionById(id);
  if (!session) {
    return (
      <div className="mx-auto max-w-[44rem]">
        <EmptyState
          title="Cette séance n'existe pas (ou plus)."
          description="Le lien vient peut-être d'une ancienne version du programme. Ouvre le calendrier pour retrouver la séance."
          action={
            <Link href="/calendrier" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Ouvrir le calendrier
            </Link>
          }
        />
      </div>
    );
  }

  const index = HOLIDAY_PROGRAM.findIndex((entry) => entry.id === session.id);
  const previous = HOLIDAY_PROGRAM[index - 1] ?? null;
  const next = HOLIDAY_PROGRAM[index + 1] ?? null;
  const rest = session.kind === "repos";

  return (
    <div className="mx-auto max-w-[44rem] space-y-6">
      <PageHero
        title={session.title}
        lede={rest ? dayLabel(session.date) : `${dayLabel(session.date)} · ${session.start}–${session.end} · ${sessionMinutes(session)} min`}
        actions={
          <Link href="/calendrier" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={14} aria-hidden /> Calendrier
          </Link>
        }
      />

      {rest ? (
        <Notice tone="info" title="Jour de repos">
          {session.note}
        </Notice>
      ) : (
        <>
          {session.chapter && (
            <p className="flex flex-wrap gap-2">
              <Badge variant="accent">{session.chapter}</Badge>
              <Badge>{MOMENT_LABEL[session.kind]}</Badge>
            </p>
          )}

          <section aria-labelledby="seance-temps" className="surface p-5 sm:p-6">
            <h2 id="seance-temps" className="t-label">
              Ce que tu fais, dans l&apos;ordre
            </h2>
            <ol className="mt-3 space-y-4">
              {session.steps.map((step, position) => (
                <li key={`${step.label}-${position}`} className="flex gap-3">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-inset text-[0.8125rem] font-bold tabular-nums text-ink">
                    {position + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {step.label} <span className="t-meta font-semibold">· {step.minutes} min</span>
                    </p>
                    <p className="t-meta">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {session.fiche && (
            <section aria-labelledby="seance-fiche" className="surface p-5 sm:p-6">
              <h2 id="seance-fiche" className="t-label inline-flex items-center gap-1.5">
                <FileText size={14} aria-hidden /> Ta fiche
              </h2>
              <p className="mt-2 text-[0.9375rem] font-semibold text-ink">{FICHES[session.fiche.key].label}</p>
              <p className="t-meta">{session.fiche.exercises}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={ficheUrl(session.fiche.key)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "primary", size: "md" })}>
                  Ouvrir la fiche (PDF) <ExternalLink size={16} aria-hidden />
                </a>
                {session.fiche.key !== "grille" && (
                  <a href={ficheUrl("grille")} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "md" })}>
                    <BookOpenCheck size={16} aria-hidden /> Grille de rédaction
                  </a>
                )}
              </div>
              <p className="t-meta mt-3 text-2xs">Aucun indice, aucun corrigé dans la fiche : c&apos;est voulu. Imprime-la la veille si tu veux travailler sur papier.</p>
            </section>
          )}

          <section aria-labelledby="seance-actions" className="surface p-5 sm:p-6">
            <h2 id="seance-actions" className="t-label">
              Pendant et après
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/timer" className={buttonVariants({ variant: "secondary", size: "md" })}>
                <Timer size={16} aria-hidden /> Lancer le chrono
              </Link>
              <Link href="/anki" className={buttonVariants({ variant: "secondary", size: "md" })}>
                <WalletCards size={16} aria-hidden /> Anki
              </Link>
            </div>
            <p className="t-meta mt-3">
              Quand tu as fini, note le résultat : <strong>réussi</strong>, <strong>partiel</strong> ou <strong>échec</strong>, l&apos;aide (sans, indices, correction) et la cause. Avec le raccourci de la montre, c&apos;est deux gestes. Envoie-moi aussi ta copie pour une correction ligne par ligne.
            </p>
          </section>

          <Notice tone="info" title="À garder en tête">
            {session.note}
          </Notice>
        </>
      )}

      <nav aria-label="Séances voisines" className="flex items-center justify-between gap-3">
        {previous ? (
          <Link href={`/seance/${previous.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft size={14} aria-hidden /> {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/seance/${next.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {next.title} <ArrowRight size={14} aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
