"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Shuffle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { rateChapter } from "@/lib/chapter-memory";
import { cn } from "@/lib/cn";
import {
  drawQuestion,
  KHOLLE_GRADE_RATING,
  KHOLLE_GRADES,
  KHOLLE_HISTORY_KEY,
  KHOLLE_TARGET_MINUTES,
  memoryFor,
  parseKholleHistory,
  questionsFor,
  recordGrade,
  reviewCardFor,
  tally,
  type KholleGrade,
  type KholleHistory,
  type KholleQuestion,
} from "@/lib/kholle";
import { createPracticeSession } from "@/lib/practice-session";
import { PROGRAMME, PROGRAMME_BY_ID, PROGRAMME_SUBJECTS } from "@/lib/programme-data";
import { readFlag, writeFlag } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const SHORT_SUBJECT: Record<string, string> = { Mathématiques: "Maths", Physique: "Physique", Chimie: "Chimie" };

const GRADE_STYLE: Record<KholleGrade, { label: string; className: string }> = {
  su: { label: "Su", className: "bg-emerald-400/[0.16] text-emerald-300 hover:bg-emerald-400/[0.24]" },
  hésitant: { label: "Hésitant", className: "bg-amber-400/[0.16] text-amber-300 hover:bg-amber-400/[0.24]" },
  "pas su": { label: "Pas su", className: "bg-rose-400/[0.14] text-rose-300 hover:bg-rose-400/[0.22]" },
};

interface Answered {
  question: KholleQuestion;
  grade: KholleGrade;
  seconds: number;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * /kholle — LE MODE KHÔLLE (lib/kholle.ts).
 *
 *   1. Le programme de colle — les chapitres de la semaine, gardés dans les
 *      préférences (synchronisées). `?chapitre=` (depuis la carte du
 *      programme) lance directement une interrogation sur ce chapitre.
 *   2. L'interrogation — une question tirée, le chrono, l'auto-évaluation.
 *      Ce qui n'est pas su part dans « À revoir » ; le rappel est noté dans
 *      Mémoire quand le chapitre y est.
 *   3. Le bilan — et le temps passé devient une séance.
 */
export function KholleTrainer() {
  const params = useSearchParams();
  const { preferences, savePreferences, chapterMemory, saveChapterMemory, reviewItems, saveReviewItems, saveSessions, ready } = usePrepahubData();
  const requested = params.get("chapitre");
  const direct = requested && PROGRAMME_BY_ID.has(requested) ? requested : null;

  const [subject, setSubject] = useState<Subject>(() => (direct ? PROGRAMME_BY_ID.get(direct)!.subject : "Mathématiques"));
  const [running, setRunning] = useState(false);
  const [question, setQuestion] = useState<KholleQuestion | null>(null);
  const [questionStart, setQuestionStart] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [finished, setFinished] = useState<{ minutes: number } | null>(null);
  const [toReview, setToReview] = useState(true);
  const [toMemory, setToMemory] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const history = useRef<KholleHistory>({});
  const sessionStart = useRef(0);
  // Un chapitre n'est noté qu'UNE fois par khôlle dans Mémoire : cinq questions sur la réduction ne sont pas cinq rappels.
  const ratedChapters = useRef(new Set<string>());

  useEffect(() => {
    history.current = parseKholleHistory(readFlag(KHOLLE_HISTORY_KEY));
  }, []);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const selection = useMemo(() => (direct ? [direct] : preferences.colleChapters), [direct, preferences.colleChapters]);
  const questions = useMemo(() => questionsFor(selection), [selection]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  function toggleChapter(id: string) {
    const current = preferences.colleChapters;
    savePreferences({ ...preferences, colleChapters: current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id] });
  }

  function next(asked: Answered[]) {
    const exclude = new Set(asked.map((entry) => entry.question.id));
    const drawn = drawQuestion(questions, history.current, new Date(), exclude);
    setQuestion(drawn);
    setQuestionStart(Date.now());
    setNow(Date.now());
    setToReview(true);
    setToMemory(true);
  }

  function start() {
    sessionStart.current = Date.now();
    ratedChapters.current = new Set();
    setAnswered([]);
    setFinished(null);
    setRunning(true);
    next([]);
  }

  function grade(value: KholleGrade) {
    if (!question) return;
    const at = new Date();
    const seconds = Math.round((at.getTime() - questionStart) / 1000);
    history.current = recordGrade(history.current, question.id, value, at);
    writeFlag(KHOLLE_HISTORY_KEY, JSON.stringify(history.current));

    const memory = memoryFor(question.chapter, chapterMemory);
    if (toMemory && memory.length > 0 && !ratedChapters.current.has(question.chapter.id)) {
      ratedChapters.current.add(question.chapter.id);
      const today = dayKey(at);
      const ids = new Set(memory.map((entry) => entry.id));
      saveChapterMemory(chapterMemory.map((entry) => (ids.has(entry.id) ? rateChapter(entry, KHOLLE_GRADE_RATING[value], today) : entry)));
    }
    if (value !== "su" && toReview) {
      const card = reviewCardFor(question, reviewItems, at);
      if (card) saveReviewItems([...reviewItems, card]);
    }
    const asked = [...answered, { question, grade: value, seconds }];
    setAnswered(asked);
    next(asked);
  }

  function finish() {
    const end = new Date();
    // Une séance par matière, mises bout à bout jusqu'à maintenant : le temps de chaque question compte pour SA matière.
    const bySubject = new Map<Subject, { seconds: number; chapterId: string }>();
    for (const entry of answered) {
      const current = bySubject.get(entry.question.chapter.subject);
      bySubject.set(entry.question.chapter.subject, { seconds: (current?.seconds ?? 0) + entry.seconds, chapterId: current?.chapterId ?? entry.question.chapter.id });
    }
    const sessions: WorkSession[] = [];
    let cursor = end.getTime();
    for (const [entrySubject, { seconds }] of bySubject) {
      const session = createPracticeSession({ subject: entrySubject, startedAt: new Date(cursor - seconds * 1000), endedAt: new Date(cursor), note: "Khôlle" }, end);
      if (session) sessions.push(session);
      cursor -= seconds * 1000;
    }
    if (sessions.length > 0) saveSessions(sessions);
    setRunning(false);
    setQuestion(null);
    setFinished({ minutes: Math.round((end.getTime() - sessionStart.current) / 60_000) });
  }

  const elapsed = Math.max(0, Math.round((now - questionStart) / 1000));
  const overTime = elapsed >= KHOLLE_TARGET_MINUTES * 60;
  const counts = tally(answered);
  const memoryMatch = question ? memoryFor(question.chapter, chapterMemory).length > 0 && !ratedChapters.current.has(question.chapter.id) : false;

  return (
    <div className="mx-auto max-w-[52rem] space-y-8 sm:space-y-10">
      <PageHero title="Khôlle" lede="Une question de cours, le chrono, et la vérité." illustration={<Illustration name="checkin" size={56} />} />

      {running ? (
        <Section
          variant="feature"
          title={question ? `${SHORT_SUBJECT[question.chapter.subject]} · ${question.chapter.title}` : "Plus de question"}
          action={
            <Button variant="secondary" size="sm" onClick={finish}>
              <Square size={13} aria-hidden /> Terminer
            </Button>
          }
        >
          {question ? (
            <>
              <p className="t-heading leading-snug">{question.text}</p>
              <p className={cn("mt-4 font-mono text-3xl font-black tabular-nums", overTime ? "text-amber-300" : "text-muted")} aria-live="off">
                {clock(elapsed)}
                <span className="ml-2 align-middle font-sans text-2xs font-bold text-subtle">objectif {KHOLLE_TARGET_MINUTES} min</span>
              </p>
              <p className="t-meta mt-4">Au tableau : énonce, démontre, puis vérifie dans ton cours avant de t&apos;évaluer.</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {KHOLLE_GRADES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => grade(value)}
                    className={cn("min-h-12 rounded-2xl text-[0.9375rem] font-extrabold transition-colors", GRADE_STYLE[value].className)}
                  >
                    {GRADE_STYLE[value].label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] font-semibold text-muted">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={toReview} onChange={(event) => setToReview(event.target.checked)} className="h-4 w-4 accent-[var(--btn-g1)]" />
                  Si pas su : ajouter à « À revoir »
                </label>
                {memoryMatch && (
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={toMemory} onChange={(event) => setToMemory(event.target.checked)} className="h-4 w-4 accent-[var(--btn-g1)]" />
                    Noter le rappel dans Mémoire
                  </label>
                )}
              </div>
            </>
          ) : (
            <p className="t-meta">Toutes les questions de ce programme ont été posées. Termine la séance, ou ajoute des chapitres.</p>
          )}
          {answered.length > 0 && (
            <p className="t-meta mt-5 text-2xs">
              {counts.asked} question{counts.asked > 1 ? "s" : ""} · {counts.su} su · {counts.hésitant} hésitant · {counts["pas su"]} pas su
            </p>
          )}
        </Section>
      ) : (
        <>
          {finished && answered.length > 0 && (
            <Section variant="feature" title="Bilan de la khôlle">
              <StatRow>
                <Stat label="Questions" value={counts.asked} detail={`en ${finished.minutes} min`} />
                <Stat label="Su" value={counts.su} tone="success" />
                <Stat label="À reprendre" value={counts.hésitant + counts["pas su"]} tone={counts["pas su"] > 0 ? "danger" : undefined} detail="ajoutées à « À revoir »" />
              </StatRow>
              <ul className="mt-5 divide-y divide-line">
                {answered.map((entry) => (
                  <li key={entry.question.id} className="flex items-start gap-3 py-2.5">
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold", GRADE_STYLE[entry.grade].className)}>{GRADE_STYLE[entry.grade].label}</span>
                    <p className="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug text-ink">{entry.question.text}</p>
                    <span className="t-meta shrink-0 text-2xs tabular-nums">{clock(entry.seconds)}</span>
                  </li>
                ))}
              </ul>
              <p className="t-meta mt-4">
                Les questions à reprendre t&apos;attendent dans{" "}
                <Link href="/revoir" className="text-accent hover:underline">
                  À revoir
                </Link>
                .
              </p>
            </Section>
          )}

          {direct ? (
            <Section variant="panel" title={`Interrogation : ${PROGRAMME_BY_ID.get(direct)!.title}`} description={`${questions.length} question${questions.length > 1 ? "s" : ""} de cours dans ce chapitre.`}>
              <div className="flex flex-wrap gap-2">
                <Button onClick={start}>
                  <Shuffle size={15} aria-hidden /> Tirer une question
                </Button>
                <Link href="/kholle" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
                  Mon programme de colle
                </Link>
              </div>
            </Section>
          ) : (
            <Section
              variant="panel"
              title="Programme de colle"
              description={selection.length === 0 ? "Choisis les chapitres de ta colle de la semaine." : `${selection.length} chapitre${selection.length > 1 ? "s" : ""} · ${questions.length} questions de cours`}
              action={
                <Button size="sm" onClick={start} disabled={questions.length === 0}>
                  <Shuffle size={14} aria-hidden /> Commencer
                </Button>
              }
            >
              <SegmentedControl
                ariaLabel="Matière"
                value={subject}
                onChange={setSubject}
                options={PROGRAMME_SUBJECTS.map((entry) => ({ value: entry, label: SHORT_SUBJECT[entry] ?? entry }))}
                className="mb-4"
              />
              {([1, 2] as const).map((year) => (
                <div key={year} className="mb-4 last:mb-0">
                  <p className="t-label mb-2">{year === 1 ? "Sup" : "Spé"}</p>
                  <ul className="flex flex-wrap gap-2">
                    {PROGRAMME.filter((chapter) => chapter.subject === subject && chapter.year === year).map((chapter) => {
                      const on = selection.includes(chapter.id);
                      return (
                        <li key={chapter.id}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleChapter(chapter.id)}
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-bold transition-colors max-lg:min-h-11",
                              on ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted hover:text-ink"
                            )}
                          >
                            {on && <Check size={13} aria-hidden />}
                            {chapter.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
