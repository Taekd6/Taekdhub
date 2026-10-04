"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, ChevronDown, Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { buildDayAgenda, TIER_LABEL, type AgendaTier, type KeptTask, type PostponedTask } from "@/lib/day-agenda";
import { DAY_AGENDA_KEY, diffVersions, parseLog, recordVersion, setOverride, toVersion, type AgendaLog } from "@/lib/day-agenda-log";
import { computeNextMove, type NextMoveInput } from "@/lib/next-move/engine";
import { postponeWorkItem } from "@/lib/planning";
import { readFlag, writeFlag, type NextMoveRecord, type WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";

const TIER_TONE: Record<AgendaTier, string> = {
  indispensable: "bg-rose-400",
  important: "bg-amber-400",
  secondaire: "bg-zinc-400/50",
};

const QUICK = [30, 60, 90, 120];

/**
 * LE RESTE DE TA JOURNÉE — le plan adaptatif (lib/day-agenda.ts).
 *
 * Quatre choses seulement, dans cet ordre : le temps qui reste (et d'où vient
 * le chiffre), la prochaine action, ce qui a changé depuis la dernière
 * version et pourquoi (lib/day-agenda-log.ts), puis ce qui est gardé et ce
 * qui est déplacé à demain. Le reste — la trace complète du jour — est
 * replié.
 *
 * Recalculé chaque minute, comme Next Move ; chaque version qui change
 * réellement est gardée dans la trace de l'appareil. « Il me reste… »
 * corrige le temps restant pour aujourd'hui.
 */
export function DayAgendaCard({
  data,
  history,
  saveWorkItems,
  ready,
  className,
}: {
  data: Omit<NextMoveInput, "history" | "now" | "availableMinutes">;
  history: NextMoveRecord[];
  saveWorkItems: (items: WorkItem[]) => void;
  ready: boolean;
  className?: string;
}) {
  const [tick, setTick] = useState(() => Date.now());
  // Lue d'emblée (le premier rendu ne montre rien tant que les données ne sont pas prêtes : aucun écart d'hydratation).
  // Sans cela, la première version du jour était enregistrée dans une trace VIDE, et écrasait celle du matin.
  const [log, setLog] = useState<AgendaLog>(() => parseLog(readFlag(DAY_AGENDA_KEY)));
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(tick), [tick]);
  const today = dayKey(now);
  const override = log.days[today]?.override ?? null;
  const input = useMemo(() => ({ ...data, history, now }), [data, history, now]);
  const agenda = useMemo(() => buildDayAgenda(input, override), [input, override]);
  const nextKey = useMemo(() => computeNextMove(input).primary?.key ?? null, [input]);

  // Une nouvelle version dans la trace, seulement si le plan a réellement changé.
  useEffect(() => {
    if (!ready) return;
    const next = recordVersion(log, today, toVersion(agenda, data.sessions, now));
    if (next !== log) {
      setLog(next);
      writeFlag(DAY_AGENDA_KEY, JSON.stringify(next));
    }
  }, [ready, agenda, log, today, data.sessions, now]);

  if (!ready) return null;

  const versions = log.days[today]?.versions ?? [];
  const diff = versions.length >= 2 ? diffVersions(versions[versions.length - 2], versions[versions.length - 1]) : null;
  const next = agenda.kept.find((task) => task.key === nextKey) ?? agenda.kept[0] ?? null;

  function saveOverride(minutes: number | null) {
    const updated = setOverride(log, today, minutes === null ? null : { minutes, at: new Date().toISOString() });
    setLog(updated);
    writeFlag(DAY_AGENDA_KEY, JSON.stringify(updated));
    setEditing(false);
    setCustom("");
    setTick(Date.now());
  }

  function confirmPostpone(task: PostponedTask) {
    if (!task.workItemId) return;
    const outcome = postponeWorkItem(data.workItems, data.sessions, data.preferences, task.workItemId, "demain", new Date());
    saveWorkItems(outcome.workItems);
    setNotice(outcome.warning ?? `« ${task.title} » reprendra demain : le planning des échéances est recalculé.`);
  }

  return (
    <section aria-labelledby="day-agenda-titre" className={cn("surface reveal p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="day-agenda-titre" className="t-label inline-flex items-center gap-1.5">
          <CalendarClock size={14} aria-hidden /> Le reste de ta journée
        </h2>
        <button type="button" onClick={() => setEditing((value) => !value)} aria-expanded={editing} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-accent hover:underline max-lg:min-h-11">
          <Clock3 size={14} aria-hidden /> Il me reste…
        </button>
      </div>

      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="t-stat tabular">{formatMinutesSpan(agenda.budget.minutes)}</span>
        <span className="t-meta">{agenda.budget.reason}</span>
      </p>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {QUICK.map((minutes) => (
            <button key={minutes} type="button" onClick={() => saveOverride(minutes)} className="min-h-10 rounded-full bg-inset px-3 text-sm font-semibold text-ink hover:bg-accent/[0.12] max-lg:min-h-11">
              {formatMinutesSpan(minutes)}
            </button>
          ))}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(custom);
              if (Number.isFinite(value) && value >= 0 && value <= 600) saveOverride(Math.round(value));
            }}
          >
            <Input aria-label="Minutes restantes" inputMode="numeric" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="min" className="w-20" />
            <button type="submit" className="min-h-10 rounded-full bg-inset px-3 text-sm font-semibold text-ink max-lg:min-h-11">
              OK
            </button>
          </form>
          {agenda.budget.overridden && (
            <button type="button" onClick={() => saveOverride(null)} className="min-h-10 text-sm font-semibold text-muted hover:text-ink max-lg:min-h-11">
              Revenir à ma capacité
            </button>
          )}
        </div>
      )}

      <p className={cn("mt-3 text-[0.9375rem] font-semibold", agenda.overflow > 0 ? "text-rose-300" : "text-ink")}>{agenda.summary}</p>

      {next && (
        <Link href={next.href} className="mt-4 flex items-center gap-3 rounded-2xl bg-inset px-4 py-3 hover:bg-accent/[0.08]">
          <span className="min-w-0 flex-1">
            <span className="t-label block">Prochaine action</span>
            <span className="block truncate text-[0.9375rem] font-semibold text-ink">{next.title}</span>
            <span className="t-meta text-2xs">
              {formatMinutesSpan(next.minutes)} · {next.action}
            </span>
          </span>
          <ArrowRight size={16} aria-hidden className="shrink-0 text-subtle" />
        </Link>
      )}

      {diff && (diff.causes.length > 0 || diff.changes.length > 0) && (
        <div className="mt-4 rounded-2xl border border-line p-4" role="status">
          <p className="t-label">Recalculé depuis {new Date(diff.since).toTimeString().slice(0, 5)}</p>
          {diff.causes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[0.8125rem] font-semibold text-ink">
              {diff.causes.map((cause) => (
                <li key={cause}>Pourquoi : {cause}</li>
              ))}
            </ul>
          )}
          {diff.changes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[0.8125rem] text-muted">
              {diff.changes.map((change) => (
                <li key={`${change.title}-${change.what}`}>
                  <span className="font-semibold text-ink">{change.title}</span> — {change.what}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {agenda.kept.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {agenda.kept.map((task) => (
            <KeptRow key={task.key} task={task} />
          ))}
        </ul>
      )}

      {agenda.postponed.length > 0 && (
        <div className="mt-4">
          <p className="t-label">Déplacé à demain · {agenda.postponed.length}</p>
          <p className="t-meta mt-0.5 text-2xs">Rien n&apos;est perdu : ces tâches reviendront d&apos;elles-mêmes. Pas de quoi culpabiliser, c&apos;est un arbitrage.</p>
          <ul className="mt-1.5 divide-y divide-line">
            {agenda.postponed.map((task) => (
              <li key={task.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{task.title}</span>
                  <span className="t-meta text-2xs">
                    {task.reason} · {task.to}
                  </span>
                </span>
                {task.workItemId && (
                  <button type="button" onClick={() => confirmPostpone(task)} className="min-h-9 text-2xs font-semibold text-accent hover:underline max-lg:min-h-11">
                    Confirmer le report
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-3 text-[0.8125rem] font-semibold text-ink">
          {notice}
        </p>
      )}

      {versions.length > 1 && (
        <>
          <button type="button" onClick={() => setShowLog((value) => !value)} aria-expanded={showLog} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink max-lg:min-h-11">
            Historique du jour · {versions.length} versions <ChevronDown size={14} aria-hidden className={cn("transition-transform", showLog && "rotate-180")} />
          </button>
          {showLog && (
            <ol className="mt-2 space-y-2 border-l border-line pl-4 text-[0.8125rem]">
              {versions
                .slice()
                .reverse()
                .map((version, index, list) => {
                  const previous = list[index + 1];
                  const change = diffVersions(previous, version);
                  return (
                    <li key={version.at}>
                      <span className="font-semibold text-ink">{new Date(version.at).toTimeString().slice(0, 5)}</span>
                      <span className="text-muted">
                        {" "}
                        · {formatMinutesSpan(version.budget)} restantes · {version.tasks.filter((task) => task.decision !== "déplacé").length} gardées, {version.tasks.filter((task) => task.decision === "déplacé").length} déplacées
                      </span>
                      {change?.causes.map((cause) => (
                        <p key={cause} className="text-subtle">
                          {cause}
                        </p>
                      ))}
                    </li>
                  );
                })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function KeptRow({ task }: { task: KeptTask }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TIER_TONE[task.tier])} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{task.title}</span>
        <span className="t-meta text-2xs">
          {TIER_LABEL[task.tier]} · {task.tierReason}
        </span>
      </span>
      <span className="shrink-0 text-right text-[0.875rem] font-semibold tabular-nums text-ink">
        {formatMinutesSpan(task.minutes)}
        {task.reducedFrom !== null && <span className="block text-2xs font-semibold text-amber-300">réduit (prévu {formatMinutesSpan(task.reducedFrom)})</span>}
      </span>
    </li>
  );
}
