"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Target } from "lucide-react";
import { useEffect, useMemo, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { BRIEFING_SEEN_KEY, buildBriefing, type BriefingItem, type BriefingTone } from "@/lib/briefing";
import { cn } from "@/lib/cn";
import { useAnnales } from "@/hooks/use-annales";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import { topReasons } from "@/lib/next-move/engine";
import { markStarted } from "@/lib/next-move/history";
import { localData, writeFlag } from "@/lib/storage";
import { formatMinutesSpan } from "@/lib/utils";

const DOT: Record<BriefingTone, string> = {
  urgent: "bg-rose-400",
  repoussé: "bg-amber-400",
  "aujourd'hui": "bg-accent",
  attention: "bg-zinc-400",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function Rows({ items }: { items: BriefingItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="row-hover -mx-2 flex min-h-[3.25rem] items-center gap-3 rounded-xl px-2 py-3">
            <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[item.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[0.9375rem] font-semibold text-ink">{item.title}</span>
              <span className="t-meta block text-[0.8125rem]">{item.detail}</span>
            </span>
            <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, items, index }: { title: string; items: BriefingItem[]; index: number }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="surface reveal px-5 py-4 sm:px-6" style={{ "--i": index } as CSSProperties}>
      <h2 className="t-label mb-1">{title}</h2>
      <Rows items={items} />
    </section>
  );
}

/**
 * LE POINT — ce que l'élève voit en ouvrant TaekdHub (une fois par jour, et
 * après une longue absence : voir lib/briefing.ts#shouldShowBriefing).
 *
 * Une colonne, lue de haut en bas en dix secondes :
 *   la salutation et le résumé en une phrase ;
 *   MAINTENANT — le premier pas de Next Move, et « Commencer » ;
 *   CE QUI PRESSE · TU REPOUSSES · AUJOURD'HUI — trois lignes au plus chacune,
 *   une section vide n'existe pas ;
 *   puis « Aller à l'accueil ».
 *
 * Chaque ligne est un lien vers l'endroit où l'on agit (chrono, échéances,
 * révisions). Rien ne se modifie ici, sauf l'historique Next Move quand on
 * clique « Commencer ».
 */
export function BriefingScreen() {
  const router = useRouter();
  const data = usePrepahubData();
  const { ready, nextMoves, saveNextMoves, savePreferences } = data;
  const { logs: annales } = useAnnales();
  const kholle = useKholleHistory();

  // Vu : l'accueil ne ramènera pas ici avant demain (ou une longue absence).
  useEffect(() => {
    writeFlag(BRIEFING_SEEN_KEY, new Date().toISOString());
  }, []);

  const briefing = useMemo(
    () =>
      buildBriefing({
        sessions: data.sessions,
        workItems: data.workItems,
        grades: data.grades,
        reviewItems: data.reviewItems,
        errors: data.errors,
        checkins: data.checkins,
        chapterMemory: data.chapterMemory,
        preferences: data.preferences,
        history: nextMoves,
        annales,
        attempts: data.attempts,
        ankiSnapshots: data.ankiSnapshots,
        kholle,
        now: new Date(),
      }),
    [data.sessions, data.workItems, data.grades, data.reviewItems, data.errors, data.checkins, data.chapterMemory, data.preferences, nextMoves, annales, data.attempts, data.ankiSnapshots, kholle]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-[40rem] space-y-5">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-48 w-full rounded-[1.625rem]" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const move = briefing.move.primary;
  const minutes = move ? (briefing.move.steps[0]?.minutes ?? move.idealMinutes) : 0;

  function start() {
    if (!move) return;
    saveNextMoves(markStarted(nextMoves, move, minutes, topReasons(move), new Date()));
    router.push(move.href);
  }

  function neverAgain() {
    // Relu sur le disque, comme les formulaires de Réglages : jamais une copie périmée.
    savePreferences({ ...localData.preferences(), briefingOnOpen: false });
    router.replace("/dashboard");
  }

  return (
    <div className="mx-auto max-w-[40rem] space-y-5 pb-4">
      <header className="reveal pt-2">
        <p className="t-label first-letter:uppercase">{dateFormatter.format(new Date())} · le point</p>
        <h1 className="t-title mt-1">{briefing.greeting}</h1>
        <p className="t-lede mt-1.5">{briefing.summary}</p>
      </header>

      {/* ── MAINTENANT ── */}
      {move ? (
        <section aria-labelledby="point-maintenant" className="grad-card tone-brand sheen reveal p-5 sm:p-6" style={{ "--i": 1 } as CSSProperties}>
          <p className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold opacity-90">
            <Target size={14} aria-hidden /> Maintenant
          </p>
          {move.subject && move.title !== move.subject && <p className="mt-3 text-[0.9375rem] font-semibold opacity-90">{move.subject}</p>}
          <h2 id="point-maintenant" className={cn("t-heading break-words", move.subject && move.title !== move.subject ? "mt-0.5" : "mt-3")}>
            {move.title}
          </h2>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="t-stat tabular">{formatMinutesSpan(minutes)}</span>
            <span className="text-[0.9375rem] font-semibold opacity-85">· {move.action}</span>
          </p>
          <p className="mt-2 text-[0.875rem] font-semibold opacity-90">{topReasons(move, 2).join(" · ")}</p>
          <button
            type="button"
            onClick={start}
            className="press mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-[0.9375rem] font-bold text-[#0b0b14] hover:brightness-95"
          >
            Commencer <ArrowRight size={16} aria-hidden />
          </button>
        </section>
      ) : (
        <section className="surface reveal p-5 sm:p-6" style={{ "--i": 1 } as CSSProperties}>
          <p className="t-subhead">Rien à te proposer pour l&apos;instant.</p>
          <p className="t-meta mt-1">Note un chapitre, une échéance ou un objectif : TaekdHub saura quoi te suggérer.</p>
        </section>
      )}

      <Block title="Ce qui presse" items={briefing.urgent} index={2} />
      <Block title="Tu repousses" items={briefing.postponed} index={3} />
      <Block title="Aujourd'hui" items={briefing.today} index={4} />

      <div className="reveal flex flex-col items-center gap-2 pt-2" style={{ "--i": 5 } as CSSProperties}>
        <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => router.replace("/dashboard")}>
          Aller à l&apos;accueil
        </Button>
        <button type="button" onClick={neverAgain} className="inline-flex min-h-10 items-center text-[0.8125rem] font-semibold text-muted hover:text-ink max-lg:min-h-11">
          Ne plus l&apos;afficher à l&apos;ouverture
        </button>
      </div>
    </div>
  );
}
