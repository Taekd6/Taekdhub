"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { FORMULAIRE_SUBJECTS, formulaGroups, type FormulaCard } from "@/lib/formulaire-data";
import { cardsFor, FORMULA_HISTORY_KEY, groupMastery, weakestCards } from "@/lib/formulaire";
import { drawQuestion, KHOLLE_GRADES, parseKholleHistory, recordGrade, tally, type KholleGrade, type KholleHistory } from "@/lib/kholle";
import { readFlag, writeFlag } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

const SHORT_SUBJECT: Record<string, string> = { Mathématiques: "Maths", Physique: "Physique", Chimie: "Chimie" };

const GRADE_STYLE: Record<KholleGrade, { label: string; className: string }> = {
  su: { label: "Su", className: "bg-emerald-400/[0.16] text-emerald-300 hover:bg-emerald-400/[0.24]" },
  hésitant: { label: "Hésitant", className: "bg-amber-400/[0.16] text-amber-300 hover:bg-amber-400/[0.24]" },
  "pas su": { label: "Pas su", className: "bg-rose-400/[0.14] text-rose-300 hover:bg-rose-400/[0.22]" },
};

const DOT: Record<KholleGrade, string> = { su: "bg-emerald-400", hésitant: "bg-amber-400", "pas su": "bg-rose-400" };

type Mode = "flash" | "fiche";

/**
 * /formulaire — LE FORMULAIRE (lib/formulaire.ts).
 *
 *   « S'entraîner » : une carte tirée (pondérée), on écrit la formule de
 *   tête, on retourne, on s'évalue. Une série de 10 cartes, puis le bilan.
 *   « Fiche » : tout le formulaire de la matière, lisible d'un coup d'œil,
 *   avec la pastille du dernier résultat de chaque carte.
 *
 * Rien n'est synchronisé : l'historique des cartes est propre à l'appareil.
 */
export function FormulaTrainer() {
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [mode, setMode] = useState<Mode>("flash");
  const [groups, setGroups] = useState<string[] | null>(null);
  const [history, setHistory] = useState<KholleHistory>({});
  const [card, setCard] = useState<FormulaCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState<{ card: FormulaCard; grade: KholleGrade }[] | null>(null);
  const asked = useRef(new Set<string>());

  useEffect(() => setHistory(parseKholleHistory(readFlag(FORMULA_HISTORY_KEY))), []);

  const allGroups = useMemo(() => formulaGroups(subject), [subject]);
  const pool = useMemo(() => cardsFor(subject, groups), [subject, groups]);
  const mastery = useMemo(() => groupMastery(pool, history), [pool, history]);
  const weakest = useMemo(() => weakestCards(pool, history, new Date()), [pool, history]);

  const ROUND_SIZE = 10;

  function changeSubject(next: Subject) {
    setSubject(next);
    setGroups(null);
    setCard(null);
    setRound(null);
  }

  function toggleGroup(group: string) {
    const current = groups ?? allGroups;
    const next = current.includes(group) ? current.filter((entry) => entry !== group) : [...current, group];
    setGroups(next.length === allGroups.length ? null : next);
  }

  function draw() {
    const next = drawQuestion(pool, history, new Date(), asked.current);
    setCard(next);
    setRevealed(false);
  }

  function start() {
    asked.current = new Set();
    setRound([]);
    draw();
  }

  function grade(value: KholleGrade) {
    if (!card || !round) return;
    const updated = recordGrade(history, card.id, value, new Date());
    setHistory(updated);
    writeFlag(FORMULA_HISTORY_KEY, JSON.stringify(updated));
    asked.current.add(card.id);
    const results = [...round, { card, grade: value }];
    setRound(results);
    if (results.length >= ROUND_SIZE) {
      setCard(null);
      return;
    }
    const next = drawQuestion(pool, updated, new Date(), asked.current);
    setCard(next);
    setRevealed(false);
  }

  const inRound = round !== null && card !== null;
  const roundDone = round !== null && card === null && round.length > 0;
  const counts = tally(round ?? []);

  return (
    <div className="mx-auto max-w-[52rem] space-y-8 sm:space-y-10">
      <PageHero title="Formulaire" lede="Ce qui se sait par cœur, en cartes flash." illustration={<Illustration name="revisions" size={56} />} />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Matière"
          value={subject}
          onChange={changeSubject}
          options={FORMULAIRE_SUBJECTS.map((entry) => ({ value: entry, label: SHORT_SUBJECT[entry] ?? entry }))}
        />
        <SegmentedControl
          ariaLabel="Mode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setCard(null);
            setRound(null);
          }}
          options={[
            { value: "flash" as Mode, label: "S'entraîner" },
            { value: "fiche" as Mode, label: "Fiche" },
          ]}
        />
      </div>

      {mode === "flash" ? (
        <>
          {inRound && card ? (
            <Section variant="feature" title={`${card.group} · ${round!.length + 1}/${Math.min(ROUND_SIZE, pool.length)}`}>
              <p className="t-heading leading-snug">{card.front}</p>
              {revealed ? (
                <>
                  <p className="well mt-5 rounded-2xl p-4 font-mono text-[0.9375rem] font-bold leading-relaxed text-ink">{card.back}</p>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {KHOLLE_GRADES.map((value) => (
                      <button key={value} type="button" onClick={() => grade(value)} className={cn("min-h-12 rounded-2xl text-[0.9375rem] font-extrabold transition-colors", GRADE_STYLE[value].className)}>
                        {GRADE_STYLE[value].label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="t-meta mt-4">Écris-la de tête sur une feuille, puis retourne la carte.</p>
                  <Button className="mt-5" onClick={() => setRevealed(true)}>
                    <Eye size={15} aria-hidden /> Retourner
                  </Button>
                </>
              )}
            </Section>
          ) : roundDone ? (
            <Section variant="feature" title="Série terminée" action={<Button size="sm" onClick={start}><RotateCcw size={14} aria-hidden /> Encore</Button>}>
              <p className="text-[0.9375rem] font-semibold text-ink">
                {counts.su} sue{counts.su > 1 ? "s" : ""} sur {counts.asked} · {counts.hésitant} hésitante{counts.hésitant > 1 ? "s" : ""} · {counts["pas su"]} pas sue{counts["pas su"] > 1 ? "s" : ""}
              </p>
              <ul className="mt-4 divide-y divide-line">
                {round!.map((entry) => (
                  <li key={entry.card.id} className="flex items-start gap-3 py-2.5">
                    <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[entry.grade])} />
                    <div className="min-w-0">
                      <p className="text-[0.875rem] font-bold text-ink">{entry.card.front}</p>
                      {entry.grade !== "su" && <p className="mt-0.5 font-mono text-[0.8125rem] text-muted">{entry.card.back}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <Section
              variant="panel"
              title="Une série de 10 cartes"
              description={`${pool.length} carte${pool.length > 1 ? "s" : ""} · ${mastery.su} sue${mastery.su > 1 ? "s" : ""} · ${mastery.toReview} à revoir · ${mastery.unseen} jamais vue${mastery.unseen > 1 ? "s" : ""}`}
              action={
                <Button size="sm" onClick={start} disabled={pool.length === 0}>
                  <Shuffle size={14} aria-hidden /> Commencer
                </Button>
              }
            >
              <p className="t-label mb-2">Rubriques</p>
              <ul className="flex flex-wrap gap-2">
                {allGroups.map((group) => {
                  const on = groups === null || groups.includes(group);
                  return (
                    <li key={group}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleGroup(group)}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-bold transition-colors max-lg:min-h-11",
                          on ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted hover:text-ink"
                        )}
                      >
                        {on && <Check size={13} aria-hidden />}
                        {group}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {weakest.length > 0 && (
                <>
                  <p className="t-label mb-2 mt-5">Reviennent en priorité</p>
                  <ul className="space-y-1.5">
                    {weakest.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
                        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[history[entry.id].grade])} />
                        {entry.front}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          )}
        </>
      ) : (
        allGroups.map((group) => (
          <Section key={group} variant="panel" title={group}>
            <dl className="divide-y divide-line">
              {cardsFor(subject, [group]).map((entry) => {
                const last = history[entry.id]?.grade;
                return (
                  <div key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                    <dt className="flex items-start gap-2 text-[0.875rem] font-bold text-muted">
                      <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", last ? DOT[last] : "bg-zinc-400/30")} />
                      {entry.front}
                    </dt>
                    <dd className="font-mono text-[0.875rem] font-semibold leading-relaxed text-ink">{entry.back}</dd>
                  </div>
                );
              })}
            </dl>
          </Section>
        ))
      )}
    </div>
  );
}
