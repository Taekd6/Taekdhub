"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { RetryQueue } from "@/components/exercises/retry-queue";
import { useAnnales } from "@/hooks/use-annales";
import {
  computeTimeCalibration,
  countResults,
  describeTimeCalibration,
  summarizeByChapter,
  summarizeByLevel,
  topErrorTags,
  type AnnaleLog,
  type AnnaleResult,
  type ChapterSummary,
} from "@/lib/annales";
import { cn } from "@/lib/cn";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const RESULT_META: Record<AnnaleResult, { label: string; variant: "success" | "warning" | "danger"; dot: string }> = {
  réussi: { label: "Réussi", variant: "success", dot: "bg-emerald-400" },
  partiel: { label: "Partiel", variant: "warning", dot: "bg-amber-400" },
  échec: { label: "Échec", variant: "danger", dot: "bg-rose-400" },
};

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

function hintsLabel(mean: number | null): string {
  return mean === null ? "—" : mean.toFixed(1).replace(".", ",");
}

/**
 * /annales — LES EXERCICES DE CONCOURS CORRIGÉS AVEC CLAUDE.
 *
 *   1. Le bilan — combien, taux de réussite, indices moyens.
 *   2. Par chapitre — le plus fragile d'abord, avec la frise des essais.
 *   3. Par niveau — CCINP → X-ENS.
 *   4. Le temps — prévu contre réel (calibration du temps, lib/annales.ts).
 *   5. Les erreurs relevées à la correction.
 *   6. Le journal — chaque exercice, supprimable.
 *
 * Les données viennent du compte (hooks/use-annales.ts) : sans connexion,
 * l'écran dit pourquoi il est vide et où se connecter.
 */
export function AnnalesOverview() {
  const { status, logs, loading, error, refresh, remove } = useAnnales();

  const model = useMemo(
    () => ({
      totals: countResults(logs),
      chapters: summarizeByChapter(logs),
      levels: summarizeByLevel(logs),
      time: computeTimeCalibration(logs),
      tags: topErrorTags(logs),
    }),
    [logs]
  );

  const pageHero = (
    <PageHero
      title="Mes annales"
      lede="Les exercices de concours corrigés avec Claude, chapitre par chapitre."
      illustration={<Illustration name="notes" size={56} />}
      actions={
        status === "prêt" ? (
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} aria-hidden className={cn(loading && "animate-spin")} /> Actualiser
          </Button>
        ) : null
      }
    />
  );
  // « À refaire sans aide » vient juste sous le titre, dans TOUS les états de
  // l'écran : les tentatives saisies dans l'app vivent sans compte et hors ligne.
  const hero = (
    <>
      {pageHero}
      <RetryQueue />
    </>
  );

  if (status === "chargement") {
    return (
      <div className="mx-auto max-w-[68rem] space-y-6">
        {hero}
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (status === "désactivé" || status === "invité" || status === "erreur") {
    return (
      <div className="mx-auto max-w-[68rem] space-y-8">
        {hero}
        <div className="surface">
          <EmptyState
            illustration={<Illustration name="notes" size={56} />}
            title={status === "erreur" ? "Impossible de lire tes annales" : "Tes annales vivent sur ton compte"}
            description={
              status === "erreur"
                ? `Le serveur a répondu : ${error ?? "erreur inconnue"}.`
                : status === "désactivé"
                  ? "Ce déploiement n'a pas de compte configuré : le connecteur Claude n'a nulle part où écrire."
                  : "Claude les enregistre sur ton compte quand il corrige un exercice. Connecte-toi pour les voir ici."
            }
            action={
              status === "erreur" ? (
                <Button size="sm" onClick={() => void refresh()}>
                  Réessayer
                </Button>
              ) : status === "invité" ? (
                <Link href="/settings#compte" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
                  Me connecter
                </Link>
              ) : null
            }
          />
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="mx-auto max-w-[68rem] space-y-8">
        {hero}
        <div className="surface">
          <EmptyState
            illustration={<Illustration name="notes" size={56} />}
            title="Aucune annale corrigée par Claude pour l'instant"
            description="Demande à Claude un exercice de concours ; à la fin de la correction, il l'enregistre ici avec ton résultat, les indices utilisés et ton temps."
          />
        </div>
      </div>
    );
  }

  const { totals, chapters, levels, time, tags } = model;
  const timeLines = [describeTimeCalibration(time.overall), ...time.bySubject.map(describeTimeCalibration)].filter((line): line is string => line !== null);
  const timed = time.overall.count;

  return (
    <div className="mx-auto max-w-[68rem] space-y-8 sm:space-y-10">
      {hero}

      <Section variant="feature" title="Le bilan">
        <StatRow>
          <Stat label="Exercices" value={totals.count} detail={`${totals.réussi} réussi${totals.réussi > 1 ? "s" : ""} · ${totals.partiel} partiel${totals.partiel > 1 ? "s" : ""} · ${totals.échec} échec${totals.échec > 1 ? "s" : ""}`} />
          <Stat label="Réussite" value={percent(totals.successRate)} detail="Un partiel compte pour moitié" />
          <Stat label="Indices / exercice" value={hintsLabel(totals.meanHints)} detail="Sur 3 au plus" />
        </StatRow>
      </Section>

      <Section variant="panel" title="Par chapitre" description="Le plus fragile d'abord · la frise montre les essais, du plus ancien au plus récent.">
        <ul className="divide-y divide-line">
          {chapters.map((chapter) => (
            <ChapterRow key={chapter.key} chapter={chapter} />
          ))}
        </ul>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        {levels.length > 0 && (
          <Section variant="panel" title="Par niveau">
            <ul className="space-y-3">
              {levels.map((level) => (
                <li key={level.level}>
                  <div className="flex items-baseline justify-between gap-3 text-[0.9375rem] font-bold text-ink">
                    <span>{level.level}</span>
                    <span className="tabular-nums">{percent(level.successRate)}</span>
                  </div>
                  <ResultBar réussi={level.réussi} partiel={level.partiel} échec={level.échec} />
                  <p className="t-meta mt-1 text-2xs">
                    {level.count} exercice{level.count > 1 ? "s" : ""} · {hintsLabel(level.meanHints)} indice{(level.meanHints ?? 0) >= 2 ? "s" : ""} en moyenne
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section variant="panel" title="Ton temps" description="Le temps prévu avant de commencer, contre le temps réel.">
          {timeLines.length > 0 ? (
            <ul className="space-y-2 text-[0.9375rem] font-semibold text-ink">
              {timeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="t-meta">
              {timed === 0
                ? "Pas encore d'exercice avec un temps prévu et un temps réel. Annonce à Claude ton temps prévu avant de commencer."
                : `${timed} exercice${timed > 1 ? "s" : ""} chronométré${timed > 1 ? "s" : ""} sur les 3 nécessaires pour en dire quelque chose.`}
            </p>
          )}
        </Section>
      </div>

      {tags.length > 0 && (
        <Section variant="panel" title="Ce qui revient à la correction">
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.label} className="rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-bold text-ink">
                {tag.label} <span className="text-subtle">· {tag.count}</span>
              </li>
            ))}
          </ul>
          <p className="t-meta mt-3">
            Pour garder la bonne idée en mémoire, note-la dans le{" "}
            <Link href="/erreurs" className="text-accent hover:underline">
              carnet d&apos;erreurs
            </Link>
            .
          </p>
        </Section>
      )}

      <Section variant="panel" title="Le journal" description={`${logs.length} exercice${logs.length > 1 ? "s" : ""}, du plus récent au plus ancien.`}>
        <ul className="divide-y divide-line">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} onRemove={remove} />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ResultBar({ réussi, partiel, échec }: { réussi: number; partiel: number; échec: number }) {
  const total = réussi + partiel + échec;
  if (total === 0) return null;
  return (
    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
      <span className="bg-emerald-400" style={{ width: `${(réussi / total) * 100}%` }} />
      <span className="bg-amber-400" style={{ width: `${(partiel / total) * 100}%` }} />
      <span className="bg-rose-400" style={{ width: `${(échec / total) * 100}%` }} />
    </div>
  );
}

function ChapterRow({ chapter }: { chapter: ChapterSummary }) {
  return (
    <li className="flex items-center gap-3 py-3">
      {chapter.subject && <SubjectAvatar subject={chapter.subject} size="md" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-bold text-ink">{chapter.chapter}</p>
        <p className="t-meta text-2xs">
          {chapter.subjectLabel} · {chapter.count} essai{chapter.count > 1 ? "s" : ""} · dernier le {dateFormat.format(new Date(`${chapter.lastDay}T12:00:00`))}
        </p>
      </div>
      <ol className="flex shrink-0 items-center gap-1" aria-label={`Essais : ${chapter.history.join(", ")}`}>
        {chapter.history.slice(-8).map((result, index) => (
          <li key={index} className={cn("h-2.5 w-2.5 rounded-full", RESULT_META[result].dot)} title={RESULT_META[result].label} />
        ))}
      </ol>
      <span className="w-12 shrink-0 text-right text-[0.9375rem] font-extrabold tabular-nums text-ink">{percent(chapter.successRate)}</span>
    </li>
  );
}

function LogRow({ log, onRemove }: { log: AnnaleLog; onRemove: (id: string) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const meta = RESULT_META[log.result];

  async function handleRemove() {
    if (!window.confirm(`Supprimer l'annale « ${log.chapter} »${log.source ? ` (${log.source})` : ""} ?`)) return;
    setBusy(true);
    const message = await onRemove(log.id);
    setBusy(false);
    setFailure(message);
  }

  return (
    <li className="flex items-start gap-3 py-3">
      {log.subject && <SubjectAvatar subject={log.subject} size="md" />}
      <div className="min-w-0 flex-1">
        <p className="break-words text-[0.9375rem] font-bold leading-snug text-ink">
          {log.chapter}
          {log.source && <span className="font-semibold text-muted"> · {log.source}</span>}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs font-bold text-subtle">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {log.level && <Badge>{log.level}</Badge>}
          {log.hints > 0 && <span>{log.hints} indice{log.hints > 1 ? "s" : ""}</span>}
          {log.minutes !== null && <span>· {log.minutes} min{log.plannedMinutes !== null ? ` (prévu ${log.plannedMinutes})` : ""}</span>}
          <span>· {dateFormat.format(new Date(log.createdAt))}</span>
        </p>
        {log.errors.length > 0 && <p className="mt-1 break-words text-[0.875rem] font-semibold leading-snug text-muted">Erreurs : {log.errors.join(" · ")}</p>}
        {log.comment && <p className="mt-0.5 break-words text-[0.875rem] leading-snug text-muted">{log.comment}</p>}
        {failure && (
          <p role="alert" className="mt-1 text-2xs font-bold text-rose-300">
            Suppression impossible : {failure}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handleRemove()}
        disabled={busy}
        aria-label={`Supprimer : ${log.chapter}`}
        title="Supprimer"
        className="grid shrink-0 place-items-center rounded text-subtle transition-colors hover:text-rose-300 disabled:opacity-50 max-lg:-m-2.5 max-lg:h-11 max-lg:w-11 lg:h-5 lg:w-5"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  );
}
