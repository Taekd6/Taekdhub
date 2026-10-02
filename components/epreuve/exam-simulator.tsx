"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flag, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { Input, Select } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import {
  addQuestion,
  createExamSim,
  DEFAULT_DURATION_MINUTES,
  DURATION_PRESETS,
  elapsedSeconds,
  endExam,
  EXAM_SIM_KEY,
  focusQuestion,
  parseExamSim,
  QUESTION_STATUSES,
  questionSeconds,
  remainingSeconds,
  removeQuestion,
  scoreExam,
  timeSinks,
  updateQuestion,
  type ExamSim,
  type QuestionStatus,
} from "@/lib/epreuve";
import { errorLogHref } from "@/lib/error-log";
import { createGrade, formatAverage } from "@/lib/grades";
import { createPracticeSession } from "@/lib/practice-session";
import { readFlag, writeFlag } from "@/lib/storage";
import { DEBRIEF_DRAFT_KEY } from "@/lib/debrief";
import { dayKey, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

function clock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "+" : "";
  const seconds = Math.abs(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${sign}${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

const STATUS_STYLE: Record<QuestionStatus, string> = {
  faite: "bg-emerald-400/[0.16] text-emerald-300",
  partielle: "bg-amber-400/[0.16] text-amber-300",
  fausse: "bg-rose-400/[0.14] text-rose-300",
  "pas abordée": "bg-inset text-muted",
};

function clearStored() {
  try {
    localStorage.removeItem(EXAM_SIM_KEY);
  } catch {
    // Stockage bloqué : rien à effacer.
  }
}

/**
 * /epreuve — LE SIMULATEUR D'ÉPREUVE (lib/epreuve.ts).
 *
 *   1. Préparer — matière, sujet, durée, nombre de questions.
 *   2. Composer — le compte à rebours, et la question en cours (toucher une
 *      question y bascule le chrono : on sait ensuite où le temps est passé).
 *   3. Corriger — avec le corrigé : faite, partielle, fausse, pas abordée ;
 *      la note brute sur 20 et les questions où l'on s'est enlisé.
 *   4. Enregistrer — une note « concours blanc » (ou une note en attente,
 *      pronostic compris, si quelqu'un d'autre corrige), une séance pour le
 *      temps passé, et le chemin vers le carnet d'erreurs.
 *
 * L'épreuve en cours vit sur l'appareil (localStorage) : un rechargement ou
 * un onglet déchargé par le téléphone ne la perd pas.
 */
export function ExamSimulator() {
  const { grades, saveGrades, saveSessions, ready } = usePrepahubData();
  const [sim, setSim] = useState<ExamSim | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<{ subject: Subject; outOf20: number | null; pending: boolean; gradeId: string | null } | null>(null);

  // Setup.
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [count, setCount] = useState("10");

  useEffect(() => {
    setSim(parseExamSim(readFlag(EXAM_SIM_KEY)));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!sim || sim.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sim]);

  function update(next: ExamSim | null) {
    setSim(next);
    if (next) writeFlag(EXAM_SIM_KEY, JSON.stringify(next));
    else clearStored();
  }

  if (!ready || !loaded) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const current = new Date(now);
  const hero = <PageHero title="Épreuve blanche" lede="Un sujet de concours, en conditions réelles." illustration={<Illustration name="chrono" size={56} />} />;

  /* ── 1. Préparer ── */
  if (!sim) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-8 sm:space-y-10">
        {hero}
        {saved && (
          <Section variant="feature" title="Épreuve enregistrée">
            <p className="text-[0.9375rem] font-semibold text-ink">
              {saved.pending
                ? `Ton pronostic (${saved.outOf20 === null ? "—" : formatAverage(saved.outOf20)}/20) attend la vraie note dans Progression : c'est ce qui mesure ta calibration.`
                : `${saved.outOf20 === null ? "—" : formatAverage(saved.outOf20)}/20 enregistré dans tes notes, et le temps passé dans tes séances.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {saved.gradeId && (
                <Link href={`/debrief?note=${encodeURIComponent(saved.gradeId)}`} className="grad-btn inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold max-lg:min-h-11">
                  Débriefer cette épreuve
                </Link>
              )}
              <Link href={errorLogHref({ subject: saved.subject, source: "concours blanc", date: dayKey(new Date()) })} className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
                Noter mes erreurs
              </Link>
              <Link href="/progress#notes" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
                Voir mes notes
              </Link>
            </div>
          </Section>
        )}
        <Section variant="panel" title="Préparer l'épreuve" description="Compose sur papier ; TaekdHub tient l'horloge et le barème.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="t-label mb-1.5 block">Matière</span>
              <Select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
                {subjects.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="t-label mb-1.5 block">Sujet</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mines-Ponts 2023 MP1" maxLength={80} />
            </label>
            <div>
              <span className="t-label mb-1.5 block">Durée</span>
              <SegmentedControl
                ariaLabel="Durée"
                value={duration}
                onChange={setDuration}
                options={DURATION_PRESETS.map((value) => ({ value, label: `${value / 60} h` }))}
              />
            </div>
            <label className="block">
              <span className="t-label mb-1.5 block">Questions (modifiables ensuite)</span>
              <Input type="number" inputMode="numeric" min={0} max={60} value={count} onChange={(event) => setCount(event.target.value)} />
            </label>
          </div>
          <Button
            className="mt-6"
            onClick={() => {
              setSaved(null);
              update(createExamSim({ subject, title, durationMinutes: duration, questionCount: Number(count) || 0 }, new Date()));
            }}
          >
            <Flag size={15} aria-hidden /> Lancer le chrono
          </Button>
        </Section>
      </div>
    );
  }

  const left = remainingSeconds(sim, current);
  const score = scoreExam(sim);

  /* ── 2. Composer ── */
  if (!sim.endedAt) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-8 sm:space-y-10">
        <Section
          variant="feature"
          title={`${sim.title} · ${sim.subject}`}
          action={
            <Button variant="secondary" size="sm" onClick={() => update(endExam(sim, new Date()))}>
              Rendre la copie
            </Button>
          }
        >
          <p className={cn("font-mono text-5xl font-black tabular-nums sm:text-6xl", left < 0 ? "text-rose-300" : left < 15 * 60 ? "text-amber-300" : "text-ink")}>
            {clock(left)}
          </p>
          <p className="t-meta mt-2">{left < 0 ? "Temps écoulé — rends la copie." : `restant sur ${sim.durationMinutes / 60} h · ${minutes(elapsedSeconds(sim, current))} écoulées`}</p>
        </Section>

        <Section variant="panel" title="Questions" description="Touche la question sur laquelle tu travailles : son chrono tourne. Ajuste le barème si le sujet le donne.">
          <ul className="divide-y divide-line">
            {sim.questions.map((question) => {
              const active = sim.active?.id === question.id;
              return (
                <li key={question.id} className={cn("flex items-center gap-2 py-2", active && "-mx-2 rounded-xl bg-accent/[0.08] px-2")}>
                  <button
                    type="button"
                    onClick={() => update(focusQuestion(sim, question.id, new Date()))}
                    aria-pressed={active}
                    className={cn("min-h-10 min-w-0 flex-1 rounded-lg px-2 text-left text-[0.9375rem] font-bold max-lg:min-h-11", active ? "text-accent" : "text-ink")}
                  >
                    {question.label}
                    <span className="ml-2 text-2xs font-semibold tabular-nums text-subtle">{clock(questionSeconds(sim, question, current))}</span>
                  </button>
                  <BaremeInput value={question.points} onChange={(points) => update(updateQuestion(sim, question.id, { points }))} label={question.label} />
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => update(addQuestion(sim))}>
            <Plus size={14} aria-hidden /> Ajouter une question
          </Button>
        </Section>

        <AbandonButton onConfirm={() => update(null)} />
      </div>
    );
  }

  /* ── 3. Corriger ── */
  const sinks = timeSinks(sim, current);

  function save(pending: boolean) {
    if (!sim) return;
    const end = new Date(sim.endedAt!);
    const note = score.outOf20;
    let gradeId: string | null = null;
    if (note !== null) {
      const grade = createGrade(
        { subject: sim.subject, title: sim.title, kind: "concours", date: dayKey(sim.startedAt), maxScore: 20, score: pending ? null : note, predictedScore: pending ? note : null },
        new Date()
      );
      if (grade) {
        saveGrades([...grades, grade]);
        gradeId = grade.id;
        // Le débrief (/debrief) reprend les questions, leur barème et leur temps : on n'a plus qu'à dire le chapitre et la cause.
        const outcome = { faite: "réussie", partielle: "partielle", fausse: "fausse", "pas abordée": "non abordée" } as const;
        writeFlag(
          DEBRIEF_DRAFT_KEY,
          JSON.stringify({
            gradeId,
            questions: sim.questions.map((question) => ({ label: question.label, points: question.points, outcome: outcome[question.status], minutes: question.seconds >= 60 ? Math.round(question.seconds / 60) : null })),
          })
        );
      }
    }
    const session = createPracticeSession({ subject: sim.subject, startedAt: new Date(sim.startedAt), endedAt: end, note: `Épreuve : ${sim.title}` });
    if (session) saveSessions([session]);
    setSaved({ subject: sim.subject, outOf20: note, pending, gradeId });
    update(null);
  }

  return (
    <div className="mx-auto max-w-[52rem] space-y-8 sm:space-y-10">
      {hero}
      <Section variant="feature" title={`Correction · ${sim.title}`}>
        <StatRow>
          <Stat label="Note brute" value={score.outOf20 === null ? "—" : `${formatAverage(score.outOf20)}/20`} detail={`${formatAverage(score.earned)} pts sur ${formatAverage(score.total)}`} />
          <Stat label="Faites" value={score.counts.faite} detail={`${score.counts.partielle} partielle${score.counts.partielle > 1 ? "s" : ""}`} />
          <Stat label="Durée" value={minutes(elapsedSeconds(sim, current))} detail={`sur ${sim.durationMinutes} min`} />
        </StatRow>
        <p className="t-meta mt-4 text-2xs">Note brute ramenée sur 20 : une note de concours est harmonisée sur tous les candidats, ce que rien ici ne connaît.</p>
      </Section>

      <Section variant="panel" title="Question par question" description="Avec le corrigé sous les yeux : faite, partielle (la moitié des points), fausse, ou pas abordée.">
        <ul className="divide-y divide-line">
          {sim.questions.map((question) => (
            <li key={question.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[0.9375rem] font-bold text-ink">{question.label}</span>
                <span className="t-meta text-2xs tabular-nums">{minutes(question.seconds)}</span>
                <BaremeInput value={question.points} onChange={(points) => update(updateQuestion(sim, question.id, { points }))} label={question.label} />
                <button
                  type="button"
                  onClick={() => update(removeQuestion(sim, question.id, new Date()))}
                  aria-label={`Supprimer ${question.label}`}
                  className="grid h-8 w-8 place-items-center rounded text-subtle hover:text-rose-300 max-lg:h-11 max-lg:w-11"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Correction de ${question.label}`}>
                {QUESTION_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={question.status === status}
                    onClick={() => update(updateQuestion(sim, question.id, { status }))}
                    className={cn(
                      "min-h-8 rounded-full px-3 text-2xs font-bold transition-colors max-lg:min-h-10",
                      question.status === status ? STATUS_STYLE[status] : "bg-transparent text-subtle hover:text-ink"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => update(addQuestion(sim))}>
          <Plus size={14} aria-hidden /> Ajouter une question
        </Button>
      </Section>

      {sinks.length > 0 && (
        <Section variant="panel" title="Où le temps est passé">
          <ul className="space-y-2 text-[0.9375rem] font-semibold text-ink">
            {sinks.map((entry) => (
              <li key={entry.question.id}>
                {entry.question.label} : {minutes(entry.seconds)} pour un barème qui en justifiait {minutes(entry.fairSeconds)}.
              </li>
            ))}
          </ul>
          <p className="t-meta mt-3">Le jour J, fixe-toi une limite par question et passe à la suite quand elle tombe.</p>
        </Section>
      )}

      <Section variant="panel" title="Enregistrer">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)} disabled={score.outOf20 === null}>
            Corrigé par moi : enregistrer la note
          </Button>
          <Button variant="secondary" onClick={() => save(true)} disabled={score.outOf20 === null}>
            Un prof corrige : garder en pronostic
          </Button>
        </div>
        <p className="t-meta mt-3 text-2xs">La note entre dans Progression (concours blanc), le temps dans tes séances.</p>
      </Section>

      <AbandonButton onConfirm={() => update(null)} />
    </div>
  );
}

function BaremeInput({ value, onChange, label }: { value: number; onChange: (points: number) => void; label: string }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => setText(String(value).replace(".", ",")), [value]);
  return (
    <label className="inline-flex shrink-0 items-center gap-1 text-2xs font-bold text-subtle">
      <Input
        aria-label={`Barème de ${label}`}
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = Number(text.replace(",", "."));
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
          else setText(String(value).replace(".", ","));
        }}
        className="w-16 text-right tabular-nums"
      />
      pt
    </label>
  );
}

function AbandonButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="text-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.confirm("Abandonner cette épreuve ? Rien ne sera enregistré.")) onConfirm();
        }}
      >
        <Trash2 size={14} aria-hidden /> Abandonner l&apos;épreuve
      </Button>
    </div>
  );
}
