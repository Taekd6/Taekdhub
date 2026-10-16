"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, ExternalLink, Info, Repeat, Sparkles, Footprints } from "lucide-react";
import { CopyRequest } from "@/components/exercises/copy-request";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useAnnales } from "@/hooks/use-annales";
import { useExerciseSheets } from "@/hooks/use-exercise-sheets";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { rateChapter } from "@/lib/chapter-memory";
import type { ExerciseAttempt } from "@/lib/attempts";
import { cn } from "@/lib/cn";
import { proposeFollowUp, type FollowUpStep, type SelfReport } from "@/lib/follow-up";
import { markDone } from "@/lib/next-move/history";
import type { NextMoveRecord } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";
import { formatMinutesSpan } from "@/lib/utils";

const REPORTS: { value: SelfReport; label: string }[] = [
  { value: "termine", label: "Terminé" },
  { value: "partiel", label: "Partiel" },
  { value: "bloque", label: "J'ai bloqué" },
];

/** « Terminé », « partiel », « j'ai bloqué » → la note de rappel de Ma mémoire (FSRS) : Bien, Dur, Oublié. */
const RECALL_RATING = { termine: "good", partiel: "hard", bloque: "again" } as const;
const RATING_WORD = { good: "Bien", hard: "Dur", again: "Oublié" } as const;

/**
 * LA SUITE D'UNE SÉANCE — « et maintenant ? » (lib/follow-up.ts).
 *
 * UN choix par défaut, une phrase pour dire pourquoi, UNE seule autre idée
 * (« Remplacer ») : jamais une liste à comparer. L'exercice proposé est
 * directement utilisable — une fiche de l'élève (son origine, sa source et son
 * lien affichés), un exercice à refaire, ou un original à demander à Claude.
 * Ni l'énoncé, ni les indices, ni la correction ne sont montrés ici : ils
 * s'ouvrent dans le lecteur, à la demande.
 *
 * « Trop gros ? » ouvre une première étape de cinq à dix minutes où il n'y a
 * rien à résoudre. Repousser ou bloquer n'est pas une faute : rien n'est
 * compté comme un abandon.
 *
 * Aucune ressaisie : le chapitre, le résultat et le niveau viennent de ce que
 * le bilan a déjà enregistré. Quand la séance n'a produit aucun exercice
 * noté, trois boutons disent comment elle s'est passée — et, après un rappel
 * de cours, ce tap note aussi le rappel dans Ma mémoire.
 */
export function FollowUpCard({
  session,
  attempts,
  move,
  className,
  onClose,
}: {
  session: WorkSession | null;
  attempts: ExerciseAttempt[];
  move: NextMoveRecord | null;
  className?: string;
  onClose?: () => void;
}) {
  const { sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, saveChapterMemory, preferences, nextMoves, saveNextMoves, attempts: allAttempts, ankiSnapshots, ready } = usePrepahubData();
  const { logs: annales } = useAnnales();
  const kholle = useKholleHistory();
  const { sheets, ready: sheetsReady } = useExerciseSheets();
  const [report, setReport] = useState<SelfReport | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [small, setSmall] = useState(false);
  const [noted, setNoted] = useState<string | null>(null);

  const followUp = useMemo(() => {
    if (!ready || !sheetsReady) return null;
    return proposeFollowUp({
      nextMove: { sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, attempts: allAttempts, ankiSnapshots, kholle, history: nextMoves, now: new Date() },
      session: session ? { subject: session.subject, memoryChapterId: session.chapter_id ?? null, workItemId: session.work_item_id, minutes: Math.max(1, Math.round(session.duration_seconds / 60)) } : null,
      attempts,
      move: move ? { key: move.key, kind: move.kind } : null,
      sheets,
      selfReport: report,
    });
  }, [ready, sheetsReady, sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory, preferences, annales, allAttempts, ankiSnapshots, kholle, nextMoves, session, attempts, move, sheets, report]);

  if (!followUp) return null;

  const showReport = attempts.length === 0;
  const memoryId = move?.key.startsWith("rappel:") ? move.key.slice("rappel:".length) : null;

  function say(value: SelfReport) {
    setReport(value);
    setSwapped(false);
    setSmall(value === "bloque");
    const today = dayKey(new Date());
    const chapter = memoryId ? chapterMemory.find((entry) => entry.id === memoryId) : undefined;
    // Un rappel de cours : le tap note aussi le rappel dans Ma mémoire (une seule fois par jour et par chapitre).
    if (chapter && !chapter.archived && chapter.card.lastReview !== today) {
      const rating = RECALL_RATING[value];
      saveChapterMemory(chapterMemory.map((entry) => (entry.id === chapter.id ? rateChapter(entry, rating, today) : entry)));
      setNoted(`Noté dans Ma mémoire : « ${chapter.title} » — ${RATING_WORD[rating]}.`);
    }
    if (value === "termine" && move) saveNextMoves(markDone(nextMoves, move.key, new Date()));
  }

  const step: FollowUpStep | null = swapped && followUp.alternative ? followUp.alternative : followUp.primary;
  const other: FollowUpStep | null = swapped ? followUp.primary : followUp.alternative;

  return (
    <section aria-labelledby="suite-titre" className={cn("surface reveal p-5 text-left sm:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="suite-titre" className="t-label inline-flex items-center gap-1.5">
          <ArrowRight size={14} aria-hidden /> Et maintenant ?
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="min-h-10 text-sm font-semibold text-muted hover:text-ink max-lg:min-h-11">
            Fermer
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[0.9375rem] font-semibold text-ink">{followUp.summary}</p>

      {showReport && (
        <div className="mt-3">
          <p className="t-meta text-2xs">Comment ça s&apos;est passé ?{memoryId ? " Ce tap note aussi ton rappel dans Ma mémoire (Bien, Dur ou Oublié)." : ""}</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Comment ça s'est passé">
            {REPORTS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={report === entry.value}
                onClick={() => say(entry.value)}
                className={cn("min-h-10 rounded-full px-4 text-sm font-semibold max-lg:min-h-11", report === entry.value ? "bg-accent/[0.16] text-accent" : "bg-inset text-muted hover:text-ink")}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {noted && (
            <p role="status" className="mt-1.5 text-[0.8125rem] font-semibold text-ink">
              {noted}
            </p>
          )}
        </div>
      )}

      {followUp.rest && (
        <div className="mt-4 rounded-2xl bg-inset px-4 py-3">
          <p className="text-[0.9375rem] font-semibold text-ink">{followUp.rest.message}</p>
          {followUp.rest.tomorrow && <p className="t-meta mt-1">{followUp.rest.tomorrow}</p>}
        </div>
      )}

      {step && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <p className="t-label">{swapped ? "Autre idée" : "Je te propose"}</p>
          <h3 className="t-subhead mt-1 break-words">{step.title}</h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="t-stat tabular">{formatMinutesSpan(step.minutes)}</span>
          </p>
          <p className="mt-2 text-[0.9375rem] text-ink">{step.why}</p>

          {step.exercise && (
            <div className="mt-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {step.exercise.origin && (
                  <Badge variant={step.exercise.origin === "ia" ? "accent" : "default"}>
                    {step.exercise.origin === "ia" ? <Sparkles size={11} aria-hidden /> : <ExternalLink size={11} aria-hidden />} {step.exercise.origin === "ia" ? "Original (IA)" : "Ressource externe"}
                  </Badge>
                )}
                {step.exercise.sourceName &&
                  (step.exercise.url ? (
                    <a href={step.exercise.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-accent hover:underline">
                      {step.exercise.sourceName} <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : (
                    <span className="text-[0.8125rem] font-semibold text-muted">{step.exercise.sourceName}</span>
                  ))}
              </div>
              {step.exercise.competence && (
                <p className="t-meta text-2xs">
                  Compétence : <span className="font-semibold text-ink">{step.exercise.competence}</span>
                </p>
              )}
              <p className="t-meta text-2xs">{step.exercise.note}</p>
              {step.exercise.request && <CopyRequest text={step.exercise.request} />}
              <p className="t-meta text-2xs">L&apos;énoncé s&apos;ouvre d&apos;abord ; les indices et la correction ne viennent que si tu les demandes.</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={step.start.href} className={buttonVariants({ variant: "primary", size: "md" })}>
              {step.start.label} <ArrowRight size={16} aria-hidden />
            </Link>
            {other && (
              <button type="button" onClick={() => setSwapped((value) => !value)} className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
                <Repeat size={14} aria-hidden /> {swapped ? "Revenir au premier choix" : "Remplacer"}
              </button>
            )}
            <button type="button" onClick={() => setSmall((value) => !value)} aria-expanded={small} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-accent hover:underline max-lg:min-h-11">
              <Footprints size={14} aria-hidden /> Trop gros ? Commencer petit
            </button>
          </div>

          {small && (
            <div role="status" className="mt-3 rounded-xl bg-accent/[0.08] px-3.5 py-3">
              <p className="text-[0.9375rem] font-semibold text-ink">
                {step.small.title} · {formatMinutesSpan(step.small.minutes)}
              </p>
              <p className="mt-1 text-[0.875rem] text-muted">{step.small.instruction}</p>
              <p className="t-meta mt-1 text-2xs">Rien à résoudre, rien de compté contre toi : si tu t&apos;arrêtes après, c&apos;est déjà un début.</p>
              <Link href={step.start.href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2")}>
                Commencer par là <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          )}
        </div>
      )}

      {followUp.reminders.length > 0 && (
        <div className="mt-4">
          <p className="t-label inline-flex items-center gap-1.5">
            <CalendarClock size={13} aria-hidden /> À ne pas oublier aujourd&apos;hui
          </p>
          <ul className="mt-1 divide-y divide-line">
            {followUp.reminders.map((reminder) => (
              <li key={reminder.title}>
                <Link href={reminder.href} className="row-hover flex items-center justify-between gap-3 rounded-lg py-2 text-[0.875rem] font-semibold text-ink">
                  <span className="min-w-0 truncate">{reminder.title}</span>
                  <span className="shrink-0 tabular-nums text-muted">{formatMinutesSpan(reminder.minutes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {followUp.notes.length > 0 && (
        <ul className="mt-4 space-y-1">
          {followUp.notes.map((note) => (
            <li key={note} className="flex gap-2 text-[0.8125rem] font-semibold text-muted">
              <Info size={13} aria-hidden className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
