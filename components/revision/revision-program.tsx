"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Check, ChevronDown, CircleAlert, Info, ShieldCheck } from "lucide-react";
import { useAccount } from "@/components/account/account-provider";
import { CopyRequest } from "@/components/exercises/copy-request";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState, Notice, Skeleton } from "@/components/ui/state";
import { useAnnales } from "@/hooks/use-annales";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { DAY_AGENDA_KEY, parseLog } from "@/lib/day-agenda-log";
import { topReasons, type MoveCandidate } from "@/lib/next-move/engine";
import { markStarted } from "@/lib/next-move/history";
import { buildRevisionProgram, RELIABILITY_LABEL, type PostponedItem, type RevisionItem, type RevisionProgram } from "@/lib/revision-program";
import { readFlag } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";

const TIER_TONE = { indispensable: "bg-rose-400", important: "bg-amber-400", secondaire: "bg-zinc-400/50" } as const;

/**
 * LE PROGRAMME DE RÉVISION — « qu'est-ce que je révise, pourquoi maintenant,
 * combien de temps, et par où je commence ? »
 *
 * Cet écran ne calcule rien : il affiche lib/revision-program.ts, qui
 * rassemble ce que Next Move et le plan du jour ont déjà décidé. Chaque
 * élément porte ses cinq réponses (quoi, pourquoi, combien, fiabilité, début)
 * et ce qui ne tient pas aujourd'hui est déplacé à demain automatiquement :
 * l'élève n'a rien à replanifier.
 *
 * Quand les données sont anciennes ou maigres, c'est écrit AU-DESSUS du
 * programme, et un élément fragile le dit sur sa carte — une recommandation
 * provisoire ne se présente jamais comme une certitude.
 *
 * « Commencer » enregistre le choix dans l'historique de Next Move (comme sa
 * carte de l'accueil), puis ouvre l'action : le suivi de ce qui a été fait
 * reste le même.
 */
export function RevisionProgramScreen() {
  const { sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, nextMoves, saveNextMoves, attempts, ankiSnapshots, ready } = usePrepahubData();
  const { logs: annales, status: annalesStatus } = useAnnales();
  const account = useAccount();
  const kholle = useKholleHistory();
  // Recalculé chaque minute, comme l'accueil : l'heure change ce qui tient aujourd'hui.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const program: RevisionProgram | null = useMemo(() => {
    if (!ready) return null;
    const now = new Date(tick);
    const override = parseLog(readFlag(DAY_AGENDA_KEY)).days[dayKey(now)]?.override ?? null;
    return buildRevisionProgram(
      { sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, attempts, ankiSnapshots, kholle, history: nextMoves, now },
      { override, sync: { status: account.status, lastSyncedAt: account.lastSyncedAt }, annalesStatus }
    );
  }, [ready, tick, sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, attempts, ankiSnapshots, kholle, nextMoves, account.status, account.lastSyncedAt, annalesStatus]);

  /** « Commencer » (ou sa version plus petite) : enregistré dans l'historique de Next Move, avec la durée réellement visée. */
  function recordStart(candidate: MoveCandidate | null, minutes: number) {
    if (!candidate) return;
    saveNextMoves(markStarted(nextMoves, candidate, minutes, topReasons(candidate), new Date()));
  }

  return (
    <div className="mx-auto max-w-[44rem] space-y-6">
      <PageHero title="Programme de révision" lede="Quoi réviser aujourd'hui, pourquoi maintenant, et combien de temps y consacrer." />

      {!program ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : program.empty ? (
        <EmptyState
          title="Pas encore de quoi te faire un programme."
          description="TaekdHub construit ton programme dès qu'il a de quoi juger : un chapitre appris, une échéance, quelques erreurs notées ou un objectif par matière. Il ne l'invente pas."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/memoire" className={buttonVariants({ variant: "secondary", size: "md" })}>
                Noter un chapitre
              </Link>
              <Link href="/echeances" className={buttonVariants({ variant: "secondary", size: "md" })}>
                Ajouter une échéance
              </Link>
              <Link href="/settings#budgets" className={buttonVariants({ variant: "secondary", size: "md" })}>
                Fixer mes objectifs
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <Summary program={program} />
          <Notes program={program} />
          {program.items.length === 0 ? (
            <Notice tone="info" title="Rien à faire pour l'instant">
              {program.summary} Ce qui attend est listé plus bas : rien n&apos;est perdu.
            </Notice>
          ) : (
            <ol className="space-y-4" aria-label="Programme du jour, dans l'ordre">
              {program.items.map((item, index) => (
                <li key={item.key}>
                  <ItemCard item={item} index={index} primary={index === 0} onStart={(minutes) => recordStart(item.candidate, minutes)} />
                </li>
              ))}
            </ol>
          )}
          <Postponed items={program.postponed} onStart={recordStart} />
          <p className="px-1 text-[0.8125rem] font-semibold leading-snug text-muted">
            Un programme calculé d&apos;après tes données (échéances, mémoire, erreurs, exercices, séances) avec les règles de Next Move — pas une vérité. Tu restes le meilleur juge de ce que tu peux faire aujourd&apos;hui.
          </p>
        </>
      )}
    </div>
  );
}

/* ── En-tête : le temps, et la confiance qu'on peut avoir dans le programme ── */

function Summary({ program }: { program: RevisionProgram }) {
  const reliable = program.overall === "fiable";
  return (
    <section aria-labelledby="programme-resume" className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="programme-resume" className="t-label inline-flex items-center gap-1.5">
          <CalendarClock size={14} aria-hidden /> Ton temps aujourd&apos;hui
        </h2>
        <Badge variant={reliable ? "success" : "warning"}>
          {reliable ? <ShieldCheck size={12} aria-hidden /> : <CircleAlert size={12} aria-hidden />} Programme : {RELIABILITY_LABEL[program.overall].toLowerCase()}
        </Badge>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="t-stat tabular">{formatMinutesSpan(program.used)}</span>
        <span className="t-meta">prévues sur {formatMinutesSpan(program.budget.minutes)} · {program.budget.reason}</span>
      </p>
      <p className={cn("mt-3 text-[0.9375rem] font-semibold", program.overflow > 0 ? "text-rose-300" : "text-ink")}>{program.summary}</p>
    </section>
  );
}

function Notes({ program }: { program: RevisionProgram }) {
  const alerts = program.notes.filter((note) => note.level === "alerte");
  const infos = program.notes.filter((note) => note.level === "info");
  if (alerts.length === 0 && infos.length === 0) return null;
  return (
    <div className="space-y-3">
      {alerts.map((note) => (
        <Notice key={note.id} tone="warning" title="Données à vérifier">
          {note.text}
        </Notice>
      ))}
      {infos.length > 0 && (
        <ul className="space-y-1 px-1">
          {infos.map((note) => (
            <li key={note.id} className="flex gap-2 text-[0.8125rem] font-semibold text-muted">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>{note.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Un élément du programme ─────────────────────────────────────────── */

function ItemCard({ item, index, primary, onStart }: { item: RevisionItem; index: number; primary: boolean; onStart: (minutes: number) => void }) {
  const [open, setOpen] = useState(false);
  const confirm = item.reliability.level === "a-confirmer";
  const detailId = `programme-detail-${index}`;
  return (
    <article className="surface p-5 sm:p-6" aria-labelledby={`programme-titre-${index}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TIER_TONE[item.tier])} />
        <span className="t-label">{item.tierLabel}</span>
        {item.subject && <span className="t-meta">· {item.subject}</span>}
        <Badge variant={confirm ? "warning" : "success"} className="ml-auto">
          {confirm ? <CircleAlert size={12} aria-hidden /> : <ShieldCheck size={12} aria-hidden />} {RELIABILITY_LABEL[item.reliability.level]}
        </Badge>
      </div>

      <h3 id={`programme-titre-${index}`} className="t-heading mt-3 break-words">
        {item.title}
      </h3>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="t-stat tabular">{formatMinutesSpan(item.minutes)}</span>
        <span className="text-[0.9375rem] font-semibold text-muted">· {item.action}</span>
        {item.reducedFrom !== null && <span className="text-2xs font-semibold text-amber-300">réduit pour tenir dans ta journée (prévu {formatMinutesSpan(item.reducedFrom)})</span>}
      </p>

      <div className="mt-4">
        <h4 className="t-label">Pourquoi maintenant ?</h4>
        <p className="mt-1 text-[0.9375rem] font-semibold text-ink">{item.why}</p>
        <ul className="mt-1.5 space-y-1">
          {item.whyNow.map((reason) => (
            <li key={reason} className="flex gap-2 text-[0.875rem] text-muted">
              <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0">{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {confirm && (
        <div role="status" className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-2.5">
          <p className="text-[0.8125rem] font-semibold text-ink">À confirmer avant de t&apos;y fier</p>
          <ul className="mt-0.5 space-y-0.5 text-[0.8125rem] text-muted">
            {item.reliability.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={item.start.href} onClick={() => onStart(item.minutes)} className={buttonVariants({ variant: primary ? "primary" : "secondary", size: "md" })}>
          {item.start.label} <ArrowRight size={16} aria-hidden />
        </Link>
        {item.exercise?.request && <CopyRequest text={item.exercise.request} />}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={detailId}
          className="ml-auto inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-accent hover:underline max-lg:min-h-11"
        >
          Comment, et quand c&apos;est fini <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {item.avoidance && (
        <div role="status" className="mt-3 rounded-xl bg-accent/[0.08] px-3.5 py-3">
          <p className="text-[0.875rem] font-semibold text-ink">{item.avoidance.note}</p>
          <p className="mt-1 text-[0.875rem] text-muted">
            <span className="font-semibold text-ink">
              {item.avoidance.smallStep.title} · {formatMinutesSpan(item.avoidance.smallStep.minutes)}
            </span>{" "}
            — {item.avoidance.smallStep.instruction}
          </p>
          <Link href={item.start.href} onClick={() => onStart(item.avoidance!.smallStep.minutes)} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2")}>
            Commencer petit <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}

      {open && (
        <dl id={detailId} className="mt-3 grid gap-2 border-t border-line pt-3 text-[0.875rem]">
          {item.instruction && (
            <div>
              <dt className="font-semibold text-subtle">Comment s&apos;y prendre</dt>
              <dd className="mt-0.5 text-ink">{item.instruction}</dd>
            </div>
          )}
          {item.doneWhen && (
            <div>
              <dt className="inline-flex items-center gap-1 font-semibold text-subtle">
                <Check size={13} aria-hidden /> Terminé quand
              </dt>
              <dd className="mt-0.5 text-ink">{item.doneWhen}</dd>
            </div>
          )}
          {!confirm && (
            <div>
              <dt className="font-semibold text-subtle">Sur quoi ça repose</dt>
              <dd className="mt-0.5 text-ink">{item.reliability.reasons.join(" ")}</dd>
            </div>
          )}
          {item.chapterTitle && (
            <div>
              <dt className="font-semibold text-subtle">Chapitre du programme</dt>
              <dd className="mt-0.5 text-ink">{item.chapterTitle}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}

/* ── Ce qui est déplacé à demain, sans rien demander à l'élève ─────────── */

function Postponed({ items, onStart }: { items: PostponedItem[]; onStart: (candidate: MoveCandidate | null, minutes: number) => void }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="programme-demain" className="surface p-5 sm:p-6">
      <h2 id="programme-demain" className="t-label">
        Reporté à demain · {items.length}
      </h2>
      <p className="t-meta mt-0.5 text-2xs">C&apos;est automatique : ces tâches reviendront d&apos;elles-mêmes. Rien n&apos;est perdu, et tu n&apos;as rien à replanifier.</p>
      <ul className="mt-2 divide-y divide-line">
        {items.map((task) => (
          <li key={task.key} className="py-2.5">
            <div className="flex items-center gap-3">
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TIER_TONE[task.tier])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{task.title}</span>
                <span className="t-meta text-2xs">
                  {task.reason} · {task.to}
                </span>
              </span>
              <span className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-muted">{formatMinutesSpan(task.minutes)}</span>
            </div>
            {task.skipped && task.smallStep && (
              <p className="mt-1.5 pl-5 text-[0.8125rem] text-muted">
                Mise de côté — elle revient demain, rien n&apos;est perdu. Si tu veux la garder vivante :{" "}
                <Link href={task.start.href} onClick={() => onStart(task.candidate, task.smallStep!.minutes)} className="font-semibold text-accent hover:underline">
                  {task.smallStep.title.toLowerCase()} ({formatMinutesSpan(task.smallStep.minutes)})
                </Link>
                .
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
