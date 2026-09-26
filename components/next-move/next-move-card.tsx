"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Shuffle, Target } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { MOVE_KIND_LABEL, computeNextMove, topReasons, type MoveCandidate, type NextMoveInput, type SessionStep } from "@/lib/next-move/engine";
import { activeMove, markDone, markSkipped, markStarted, recordProposal, resolveOutcomes, summarizeHistory } from "@/lib/next-move/history";
import { formatMinutesSpan } from "@/lib/utils";
import { subjectInSentence } from "@/lib/error-log";
import type { NextMoveRecord } from "@/lib/storage";

/** « J'ai… » — `null` : laisser TaekdHub décider. */
type Budget = "auto" | 30 | 60 | 120;
const BUDGETS: { value: Budget; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 h" },
  { value: 120, label: "2 h" },
];

function stepLine(step: SessionStep): string {
  if (step.type === "pause") return `${step.minutes} min · pause`;
  const candidate = step.candidate!;
  return `${step.minutes} min · ${candidate.action} — ${candidate.title}`;
}

function signed(points: number): string {
  return points > 0 ? `+${points}` : `−${Math.abs(points)}`;
}

/**
 * TON PROCHAIN MOUVEMENT — la carte qui répond à « qu'est-ce que je fais
 * maintenant ? », en tête de l'accueil.
 *
 * UNE recommandation, en gros : la matière, l'objet, la durée et l'action.
 * Dessous, au plus trois raisons (« Pourquoi ? »), et la suite de la session
 * quand le temps choisi le permet. Tout le reste — le barème point par
 * point, les autres options, ce qui a été suivi — est derrière « Détails » :
 * accessible, jamais imposé.
 *
 * Le moteur est lib/next-move/engine.ts ; cette carte ne décide RIEN, elle
 * affiche et enregistre (lib/next-move/history.ts) :
 *   — ce qui a été proposé (une ligne par proposition, pas par rendu) ;
 *   — « Commencer » (puis le chrono ou la séance de révision) ;
 *   — « Pas maintenant », que le moteur respecte pendant un jour ;
 *   — « C'est fait », ou l'issue constatée d'après les séances.
 *
 * Données en props : l'accueil a UN SEUL `usePrepahubData()`.
 */
export function NextMoveCard({
  data,
  history,
  saveHistory,
  ready,
  className,
}: {
  data: Omit<NextMoveInput, "history" | "now" | "availableMinutes">;
  history: NextMoveRecord[];
  saveHistory: (history: NextMoveRecord[]) => void;
  ready: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState<Budget>("auto");
  const [showAlternative, setShowAlternative] = useState(false);
  const [details, setDetails] = useState(false);
  // La recommandation dépend de l'heure (soir, travail récent) : on la recalcule chaque minute.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const plan = useMemo(
    () => computeNextMove({ ...data, history, now: new Date(tick), availableMinutes: budget === "auto" ? null : budget }),
    [data, history, tick, budget]
  );

  const shown: MoveCandidate | null = showAlternative && plan.alternative ? plan.alternative : plan.primary;
  const shownMinutes = shown
    ? showAlternative
      ? Math.min(shown.idealMinutes, shown.maxMinutes, plan.availableMinutes)
      : (plan.steps.find((step) => step.candidate?.key === shown.key)?.minutes ?? shown.idealMinutes)
    : 0;
  const reasons = shown ? topReasons(shown) : [];
  const following = showAlternative ? [] : plan.steps.slice(1);
  const running = useMemo(() => activeMove(history, new Date(tick)), [history, tick]);
  // Le mouvement affiché est déjà commencé : la carte dit « en cours » au lieu de le reproposer.
  const inProgress = Boolean(shown && running && running.key === shown.key);

  // Issue constatée d'après les séances et révisions : « commencé » → « fait » quand la trace existe.
  useEffect(() => {
    if (!ready) return;
    const resolved = resolveOutcomes(history, { sessions: data.sessions, reviewItems: data.reviewItems, chapterMemory: data.chapterMemory }, new Date());
    if (resolved !== history) saveHistory(resolved);
  }, [ready, history, data.sessions, data.reviewItems, data.chapterMemory, saveHistory]);

  // Une ligne d'historique par proposition MONTRÉE (dédoublonnée sur quelques heures).
  useEffect(() => {
    if (!ready || !shown || showAlternative) return;
    const next = recordProposal(history, shown, shownMinutes, reasons, new Date());
    if (next !== history) saveHistory(next);
    // `reasons` et `shownMinutes` découlent de `shown` : la clé suffit à décider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shown?.key, showAlternative]);

  if (!ready) return null;

  function start() {
    if (!shown) return;
    saveHistory(markStarted(history, shown, shownMinutes, reasons, new Date()));
    router.push(shown.href);
  }

  function skip() {
    if (!shown) return;
    saveHistory(markSkipped(history, shown, shownMinutes, reasons, new Date()));
    setShowAlternative(false);
  }

  const summary = summarizeHistory(history, new Date(tick));

  /* ── Aucune donnée : une invitation honnête, pas une fausse recommandation ── */
  if (plan.status === "vide") {
    return (
      <section aria-labelledby="next-move-titre" className={cn("surface reveal p-5 sm:p-6", className)}>
        <p className="t-label inline-flex items-center gap-1.5">
          <Target size={14} aria-hidden /> Ton prochain mouvement
        </p>
        <h2 id="next-move-titre" className="t-subhead mt-2">
          Pas encore de quoi te conseiller.
        </h2>
        <p className="t-meta mt-1 max-w-[56ch]">
          TaekdHub te dira quoi faire dès qu&apos;il aura de quoi juger : un chapitre appris, une échéance, quelques erreurs notées ou un objectif par matière.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/memoire" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
            Noter un chapitre
          </Link>
          <Link href="/echeances" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
            Ajouter une échéance
          </Link>
          <Link href="/settings#budgets" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
            Fixer mes objectifs
          </Link>
        </div>
      </section>
    );
  }

  const calm = plan.status === "calme" && !showAlternative;

  return (
    <section aria-labelledby="next-move-titre" className={cn("surface reveal p-4 sm:p-5", className)} style={{ "--i": 1 } as CSSProperties} data-next-move>
      {/* ── LE MOUVEMENT ── */}
      {shown ? (
        <div className="grad-card tone-brand sheen p-5 sm:p-6">
          <p className="inline-flex items-center gap-1.5 text-[0.75rem] font-black uppercase tracking-[0.08em] opacity-85">
            <Target size={14} aria-hidden /> {inProgress ? "En cours" : calm ? "Rien ne presse — si tu veux avancer" : showAlternative ? "Autre idée" : "Ton prochain mouvement"}
          </p>
          {shown.subject && shown.title !== shown.subject && <p className="mt-3 text-[0.9375rem] font-extrabold opacity-90">{shown.subject}</p>}
          <h2 id="next-move-titre" className={cn("t-heading break-words", shown.subject && shown.title !== shown.subject ? "mt-0.5" : "mt-3")}>
            {shown.title}
          </h2>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="t-stat tabular">{formatMinutesSpan(shownMinutes)}</span>
            <span className="text-[0.9375rem] font-extrabold opacity-85">· {shown.action}</span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {inProgress && running ? (
              <>
                <button
                  type="button"
                  onClick={() => saveHistory(markDone(history, running.key, new Date()))}
                  className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-[0.9375rem] font-black text-[#0b0b14] hover:brightness-95"
                >
                  <Check size={16} aria-hidden /> C&apos;est fait
                </button>
                <button
                  type="button"
                  onClick={() => shown && router.push(shown.href)}
                  className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-extrabold hover:bg-white/25"
                >
                  Reprendre <ArrowRight size={14} aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={start}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-[0.9375rem] font-black text-[#0b0b14] hover:brightness-95"
              >
                Commencer <ArrowRight size={16} aria-hidden />
              </button>
            )}
            {plan.alternative && !inProgress && (
              <button
                type="button"
                onClick={() => setShowAlternative((value) => !value)}
                className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-extrabold hover:bg-white/25"
              >
                <Shuffle size={14} aria-hidden /> {showAlternative ? "Revenir" : "Autre idée"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-inset p-5">
          <p className="t-label inline-flex items-center gap-1.5">
            <Target size={14} aria-hidden /> Ton prochain mouvement
          </p>
          <h2 id="next-move-titre" className="t-subhead mt-2">
            Rien ne tient en {formatMinutesSpan(plan.availableMinutes)}.
          </h2>
          <p className="t-meta mt-1">Choisis une durée un peu plus longue.</p>
        </div>
      )}

      <div className="px-1 pt-4 sm:px-2">
        {/* ── EN COURS ── */}
        {running && !inProgress && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-inset px-4 py-3">
            <p className="text-[0.875rem] font-bold text-ink">
              En cours : {running.title}
              <span className="t-meta"> · {MOVE_KIND_LABEL[running.kind]}</span>
            </p>
            <button type="button" onClick={() => saveHistory(markDone(history, running.key, new Date()))} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-accent hover:underline">
              <Check size={15} aria-hidden /> C&apos;est fait
            </button>
          </div>
        )}

        {/* ── POURQUOI ── */}
        {shown && reasons.length > 0 && (
          <div>
            <h3 className="t-label">Pourquoi ?</h3>
            <ul className="mt-1.5 space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-[0.9375rem] font-semibold text-ink">
                  <span aria-hidden className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0">{reason}</span>
                </li>
              ))}
            </ul>
            <p className="t-meta mt-2 text-[0.8125rem]">{shown.instruction}</p>
          </div>
        )}

        {/* ── PUIS ── */}
        {following.length > 0 && (
          <div className="mt-4">
            <h3 className="t-label">Puis</h3>
            <ol className="mt-1.5 space-y-1">
              {following.map((step, index) => (
                <li key={`${step.candidate?.key ?? "pause"}-${index}`} className={cn("text-[0.9375rem] font-semibold", step.type === "pause" ? "text-muted" : "text-ink")}>
                  → {stepLine(step)}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── J'AI… ── */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="t-label">J&apos;ai</span>
          <SegmentedControl
            ariaLabel="Temps disponible"
            size="sm"
            options={BUDGETS}
            value={budget}
            onChange={(value) => {
              setBudget(value);
              setShowAlternative(false);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {shown ? (
            <button type="button" onClick={skip} className="inline-flex min-h-10 items-center text-sm font-bold text-muted hover:text-ink max-lg:min-h-11">
              Pas maintenant
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setDetails((value) => !value)}
            aria-expanded={details}
            aria-controls="next-move-details"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-accent hover:underline max-lg:min-h-11"
          >
            Détails <ChevronDown size={15} aria-hidden className={cn("transition-transform", details && "rotate-180")} />
          </button>
        </div>

        {/* ── DÉTAILS ── */}
        {details && (
          <div id="next-move-details" className="mt-3 space-y-4 border-t border-line pt-4">
            {shown && (
              <div>
                <h3 className="t-label">Le calcul, point par point</h3>
                <ul className="mt-1.5 space-y-1">
                  {shown.terms.map((term) => (
                    <li key={`${term.id}-${term.reason}`} className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                      <span className="min-w-0 text-ink">{term.reason}</span>
                      <span className={cn("tabular shrink-0 font-bold", term.points > 0 ? "text-ink" : term.points < 0 ? "text-rose-300" : "text-subtle")}>
                        {term.points === 0 ? "info" : signed(term.points)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.ranked.length > 1 && (
              <div>
                <h3 className="t-label">Autres options</h3>
                <ul className="mt-1.5 space-y-1">
                  {plan.ranked
                    .filter((candidate) => candidate.key !== shown?.key)
                    .slice(0, 4)
                    .map((candidate) => (
                      <li key={candidate.key} className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                        <span className="min-w-0 text-ink">
                          {candidate.title}
                          <span className="text-subtle"> · {candidate.action}</span>
                        </span>
                        <span className="tabular shrink-0 font-bold text-subtle">{candidate.score}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {plan.context.length > 0 && <p className="t-meta text-[0.8125rem]">Contexte : {plan.context.join(" · ")}.</p>}
            {summary.sufficient && (
              <p className="t-meta text-[0.8125rem]">
                Ces 14 derniers jours : {summary.followRate} % des propositions suivies ({summary.done + summary.started} sur {summary.proposed})
                {summary.mostPostponed ? `, ${subjectInSentence(summary.mostPostponed.subject)} souvent remis à plus tard (${summary.mostPostponed.count} fois)` : ""}.
              </p>
            )}
            <p className="t-meta text-[0.8125rem]">
              Une suggestion calculée d&apos;après tes données (échéances, mémoire, erreurs, objectifs, notes, séances récentes) — pas une vérité. Tu restes le meilleur juge.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
