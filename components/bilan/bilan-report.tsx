"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { useAnnales } from "@/hooks/use-annales";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import { buildDiagnosticContext } from "@/lib/diagnostic-context";
import { BILAN_PERIODS, bilanProgress, computeBilan, describeTrend, formatDuration, periodRange, type BilanPeriod } from "@/lib/bilan";
import { formatAverage } from "@/lib/grades";
import { PROGRAMME_STATUS_META, PROGRAMME_STATUSES, type ProgrammeStatus } from "@/lib/programme";
import { STATUS_TONE } from "@/components/programme/programme-overview";
import { cn } from "@/lib/cn";
import { dayKey } from "@/lib/study";

/** Sur papier, une tuile sans ombre mais bordée d'un filet — et jamais coupée entre deux pages. */
const PRINT_TILE = "print:break-inside-avoid print:border print:border-zinc-200 print:shadow-none";

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** « 3 jamais revus », « 1 solide », « 2 en cours ». */
function statusWord(status: ProgrammeStatus, count: number): string {
  const word = PROGRAMME_STATUS_META[status].label.toLowerCase();
  return count > 1 && status !== "en-cours" ? `${word}s` : word;
}

function fr(day: string): string {
  return longDate.format(new Date(`${day}T12:00:00`));
}

/**
 * /bilan — LE BILAN D'UNE PÉRIODE (lib/bilan.ts), pensé pour l'impression.
 *
 * « Imprimer » ouvre la boîte d'impression du navigateur, qui sait aussi
 * « Enregistrer en PDF ». À l'impression, la navigation, les halos et les
 * contrôles disparaissent (`print:hidden`) : il ne reste que le rapport.
 */
export function BilanReport() {
  const { sessions, grades, errors, chapterMemory, preferences, ready, attempts, ankiSnapshots, workItems } = usePrepahubData();
  const kholle = useKholleHistory();
  const { logs: annales } = useAnnales();
  const [period, setPeriod] = useState<BilanPeriod>("mois");
  const today = dayKey(new Date());
  const range = periodRange(period, today);

  const bilan = useMemo(
    () => computeBilan({ sessions, grades, errors, chapterMemory, annales, attempts, programmeSeen: preferences.programmeSeen, ...range, today }),
    // `range` découle de `period` et `today`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, grades, errors, chapterMemory, annales, attempts, preferences.programmeSeen, period, today]
  );
  const progress = useMemo(
    () => bilanProgress(buildDiagnosticContext({ chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle, now: new Date() }), range.from, range.to),
    // `range` découle de `period` et `today`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle, period, today]
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const trend = describeTrend(bilan);
  const maxMinutes = Math.max(1, ...bilan.bySubject.map((entry) => entry.minutes));
  const name = preferences.displayName.trim();

  return (
    <div className="mx-auto max-w-[52rem] space-y-6 sm:space-y-8 print:max-w-none print:space-y-4">
      <header className="reveal">
        <p className="t-label">Bilan{name ? ` · ${name}` : ""}</p>
        <h1 className="t-heading mt-1">
          Du {fr(bilan.from)} au {fr(bilan.to)}
        </h1>
        <p className="t-meta mt-2">
          {bilan.days} jours · établi par TaekdHub le {fr(today)}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <SegmentedControl ariaLabel="Période" value={period} onChange={setPeriod} options={BILAN_PERIODS} />
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> Imprimer ou PDF
        </Button>
      </div>

      <Section variant="panel" title="Travail personnel" description={trend ?? undefined} className={PRINT_TILE}>
        <StatRow>
          <Stat label="Temps total" value={formatDuration(bilan.totalMinutes)} />
          <Stat label="Jours travaillés" value={`${bilan.activeDays}/${bilan.days}`} />
          <Stat label="Par jour travaillé" value={bilan.activeDays > 0 ? formatDuration(bilan.totalMinutes / bilan.activeDays) : "—"} />
        </StatRow>
        {bilan.bySubject.length > 0 && (
          <table className="mt-6 w-full text-left text-[0.875rem]">
            <thead>
              <tr className="t-label">
                <th className="pb-2 font-bold">Matière</th>
                <th className="pb-2 font-bold">Temps</th>
                <th className="pb-2 text-right font-bold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bilan.bySubject.map((entry) => (
                <tr key={entry.subject}>
                  <td className="py-2 pr-3 font-bold text-ink">{entry.subject}</td>
                  <td className="w-1/2 py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 rounded-full bg-accent print:bg-zinc-500" style={{ width: `${Math.max(2, (entry.minutes / maxMinutes) * 100)}%` }} aria-hidden />
                      <span className="shrink-0 font-semibold tabular-nums text-muted">{formatDuration(entry.minutes)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">
                    {entry.average === null ? <span className="text-subtle">—</span> : `${formatAverage(entry.average)}/20`}
                    {entry.gradeCount > 0 && <span className="ml-1 text-2xs text-subtle">({entry.gradeCount})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <Section variant="panel" title="Notes" className={PRINT_TILE}>
          <p className="t-figure-md text-ink">{bilan.overallAverage === null ? "—" : `${formatAverage(bilan.overallAverage)}/20`}</p>
          <p className="t-meta mt-1">
            {bilan.gradeCount === 0 ? "Aucune note sur la période." : `Moyenne simple de ${bilan.gradeCount} note${bilan.gradeCount > 1 ? "s" : ""}, ramenées sur 20.`}
          </p>
          {bilan.calibration && <p className="mt-3 text-[0.875rem] font-semibold text-ink">{bilan.calibration}</p>}
        </Section>

        <Section variant="panel" title="Erreurs notées" className={PRINT_TILE}>
          <p className="t-figure-md text-ink">{bilan.errorCount}</p>
          {bilan.topErrors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[0.875rem] font-semibold text-ink">
              {bilan.topErrors.map((entry) => (
                <li key={entry.label}>
                  {entry.label} · {entry.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-meta mt-1">Aucune erreur notée sur la période.</p>
          )}
        </Section>
      </div>

      <Section variant="panel" title="Progression réelle" description="Ce qui est corrigé et vérifié par une nouvelle tentative sans aide — pas seulement relu." className={PRINT_TILE}>
        <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <p className="t-label">Corrections vérifiées · {progress.verified.length}</p>
            {progress.verified.length === 0 ? (
              <p className="t-meta mt-1">Aucun exercice raté puis réussi sans aide sur la période.</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-[0.875rem] font-semibold text-ink">
                {progress.verified.slice(0, 6).map((entry) => (
                  <li key={`${entry.label}-${entry.on}`}>
                    {entry.label}
                    {entry.minutes && <span className="font-medium text-muted"> · {entry.minutes}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="t-meta mt-2 text-2xs">{progress.pendingRetries} exercice{progress.pendingRetries > 1 ? "s" : ""} encore à refaire.</p>
          </div>
          <div>
            <p className="t-label">Difficultés persistantes</p>
            {progress.persistent.length === 0 ? (
              <p className="t-meta mt-1">Aucune établie par les données.</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-[0.875rem] font-semibold text-ink">
                {progress.persistent.map((entry) => (
                  <li key={entry.chapter}>
                    {entry.chapter} <span className="font-medium text-muted">· {entry.finding}</span>
                  </li>
                ))}
              </ul>
            )}
            {progress.courseOkApplicationWeak.length > 0 && (
              <p className="mt-3 text-[0.8125rem] font-semibold text-ink">
                Cours su mais application fragile : {progress.courseOkApplicationWeak.join(", ")}.
              </p>
            )}
          </div>
        </div>
      </Section>

      {bilan.annales.count > 0 && (
        <Section variant="panel" title="Annales de concours" className={PRINT_TILE}>
          <p className="text-[0.9375rem] font-semibold text-ink">
            {bilan.annales.count} exercice{bilan.annales.count > 1 ? "s" : ""} · {Math.round((bilan.annales.successRate ?? 0) * 100)} % de réussite · {bilan.annales.réussi} réussi
            {bilan.annales.réussi > 1 ? "s" : ""}, {bilan.annales.partiel} partiel{bilan.annales.partiel > 1 ? "s" : ""}, {bilan.annales.échec} échec{bilan.annales.échec > 1 ? "s" : ""}
          </p>
        </Section>
      )}

      <Section variant="panel" title="Le programme aujourd'hui" description="L'état de la carte du programme à la date du bilan." className={PRINT_TILE}>
        <ul className="space-y-4">
          {bilan.programme.map(({ subject, summary }) => (
            <li key={subject}>
              <div className="flex items-baseline justify-between gap-3 text-[0.875rem] font-bold text-ink">
                <span>{subject}</span>
                <span className="text-subtle">
                  {summary.seen} vu{summary.seen > 1 ? "s" : ""} sur {summary.total}
                </span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-inset" aria-hidden>
                {PROGRAMME_STATUSES.filter((status) => status !== "pas-vu").map((status) => (
                  <span key={status} className={STATUS_TONE[status].dot} style={{ width: `${(summary.counts[status] / Math.max(1, summary.total)) * 100}%` }} />
                ))}
              </div>
              <p className="t-meta mt-1 text-2xs">
                {PROGRAMME_STATUSES.filter((status) => status !== "pas-vu" && summary.counts[status] > 0)
                  .map((status) => `${summary.counts[status]} ${statusWord(status, summary.counts[status])}`)
                  .join(" · ") || "Rien de vu pour l'instant"}
              </p>
            </li>
          ))}
        </ul>
        <ul className={cn("mt-4 flex flex-wrap gap-x-4 gap-y-1")} aria-hidden>
          {PROGRAMME_STATUSES.filter((status) => status !== "pas-vu").map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5 text-2xs font-bold text-muted">
              <span className={cn("h-2 w-2 rounded-full", STATUS_TONE[status].dot)} />
              {PROGRAMME_STATUS_META[status].label}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
