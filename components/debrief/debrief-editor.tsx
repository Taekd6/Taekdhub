"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { ChapterSelect } from "@/components/exercises/chapter-select";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { Input, Select } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { useAnnales } from "@/hooks/use-annales";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { ankiByChapter } from "@/lib/anki-mapping";
import { latestFullSnapshot } from "@/lib/anki-snapshot";
import { ATTEMPT_CAUSE_LABEL, ATTEMPT_CAUSES, EXERCISE_LEVEL_LABEL, EXERCISE_LEVELS, type AttemptCause, type ExerciseLevel } from "@/lib/attempts";
import { cn } from "@/lib/cn";
import { applyDebrief, buildDebrief, DEBRIEF_DRAFT_KEY, debriefPlan, QUESTION_OUTCOMES, questionsFromAttempts, validateQuestions, type DebriefQuestion, type QuestionOutcome } from "@/lib/debrief";
import { buildExercises } from "@/lib/exercises";
import { createGrade, formatAverage, GRADE_KIND_META, isScored } from "@/lib/grades";
import { readFlag, writeFlag, type Grade, type GradeKind } from "@/lib/storage";
import { dayKey, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";


const OUTCOME_STYLE: Record<QuestionOutcome, string> = {
  réussie: "bg-emerald-400/[0.16] text-emerald-300",
  partielle: "bg-amber-400/[0.16] text-amber-300",
  fausse: "bg-rose-400/[0.14] text-rose-300",
  "non abordée": "bg-zinc-400/20 text-muted",
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function emptyQuestion(index: number): DebriefQuestion {
  return { label: `Q${index}`, chapterId: null, outcome: "fausse", cause: null, lackOfTime: false, points: null, minutes: null, linkedExerciseKey: null, note: "" };
}

function readDraft(gradeId: string): DebriefQuestion[] | null {
  try {
    const raw = readFlag(DEBRIEF_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { gradeId?: string; questions?: { label: string; points: number; outcome: QuestionOutcome; minutes: number | null }[] };
    if (draft.gradeId !== gradeId || !Array.isArray(draft.questions)) return null;
    return draft.questions.map((question) => ({ ...emptyQuestion(0), label: question.label, points: question.points, outcome: question.outcome, minutes: question.minutes }));
  } catch {
    return null;
  }
}

/**
 * /debrief — DÉBRIEF D'UNE COPIE (lib/debrief.ts).
 *
 *   1. La note — choisie parmi les notes déjà saisies, ou saisie ici.
 *   2. Les questions — chapitre, résultat, cause, manque de temps, barème,
 *      exercice relié. Pré-remplies depuis une épreuve blanche, ou depuis un
 *      débrief déjà enregistré (on le corrige).
 *   3. Le plan — six étapes, recalculé à chaque enregistrement.
 *
 * Écrit dans les collections EXISTANTES : tentatives (À refaire) et carnet
 * d'erreurs. Aucun second carnet.
 */
export function DebriefEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const data = usePrepahubData();
  const { grades, saveGrades, attempts, saveAttempts, errors, saveErrors, preferences, ankiSnapshots, ready } = data;
  const { logs: annales } = useAnnales();
  const gradeId = params.get("note");
  const grade = gradeId ? grades.find((entry) => entry.id === gradeId) ?? null : null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-[56rem] space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const hero = <PageHero title="Débrief" lede="De la copie rendue à un plan d'action qu'on peut vérifier." illustration={<Illustration name="erreurs" size={56} />} />;

  if (!grade) {
    return (
      <div className="mx-auto max-w-[56rem] space-y-8">
        {hero}
        <GradePicker grades={grades} attemptsGradeIds={new Set(attempts.map((attempt) => attempt.gradeId).filter((id): id is string => Boolean(id)))} onPick={(id) => router.push(`/debrief?note=${encodeURIComponent(id)}`)} onCreate={(created) => { saveGrades([...grades, created]); router.push(`/debrief?note=${encodeURIComponent(created.id)}`); }} />
        {gradeId && <p role="alert" className="text-[0.875rem] font-bold text-rose-300">Cette note n&apos;existe plus sur cet appareil.</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[56rem] space-y-8">
      {hero}
      <QuestionsEditor
        key={grade.id}
        grade={grade}
        initial={(() => {
          const saved = questionsFromAttempts(grade.id, attempts, errors);
          return saved.length > 0 ? saved : readDraft(grade.id) ?? [emptyQuestion(1)];
        })()}
        exercises={buildExercises({ annales, attempts, retryDelaysDays: preferences.retryDelaysDays, today: dayKey(new Date()) }).filter((exercise) => exercise.subject === grade.subject && !exercise.key.startsWith(`ds:${grade.id}:`))}
        onSave={(questions) => {
          const built = buildDebrief(grade, questions, new Date());
          const next = applyDebrief(grade.id, { attempts, errors }, built);
          const okAttempts = saveAttempts(next.attempts);
          saveErrors(next.errors);
          if (okAttempts) writeFlag(DEBRIEF_DRAFT_KEY, "");
          return { attempts: next.attempts, ok: okAttempts };
        }}
        plan={(questions, allAttempts) =>
          debriefPlan({
            grade,
            questions,
            attempts: allAttempts,
            annales,
            retryDelaysDays: preferences.retryDelaysDays,
            ankiDecksByChapter: new Map([...ankiByChapter(latestFullSnapshot(ankiSnapshots), preferences.ankiDeckChapters)].map(([id, entry]) => [id, entry.decks])),
            today: dayKey(new Date()),
          })
        }
      />
    </div>
  );
}

function GradePicker({
  grades,
  attemptsGradeIds,
  onPick,
  onCreate,
}: {
  grades: Grade[];
  attemptsGradeIds: Set<string>;
  onPick: (id: string) => void;
  onCreate: (grade: Grade) => void;
}) {
  const recent = useMemo(() => [...grades].filter((grade) => grade.kind !== "dm").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12), [grades]);
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [kind, setKind] = useState<GradeKind>("ds");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dayKey(new Date()));
  const [score, setScore] = useState("");
  const [max, setMax] = useState("20");
  const parsed = Number(score.replace(",", "."));
  const parsedMax = Number(max.replace(",", "."));

  return (
    <>
      <Section variant="panel" title="Quelle copie ?" description="Choisis la note à débriefer.">
        {recent.length === 0 ? (
          <EmptyState className="py-6" title="Aucune note pour l'instant" description="Saisis-la ci-dessous : elle ira aussi dans Progression." />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((grade) => (
              <li key={grade.id}>
                <button type="button" onClick={() => onPick(grade.id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-inset">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-bold text-ink">{grade.title || GRADE_KIND_META[grade.kind].label}</span>
                    <span className="t-meta text-2xs">
                      {grade.subject} · {GRADE_KIND_META[grade.kind].short} · {dateFormat.format(new Date(`${grade.date}T12:00:00`))}
                      {attemptsGradeIds.has(grade.id) ? " · déjà débriefée" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.9375rem] font-extrabold tabular-nums text-ink">{isScored(grade) ? `${formatAverage(grade.score)}/${formatAverage(grade.maxScore)}` : "en attente"}</span>
                  <ArrowRight size={16} aria-hidden className="shrink-0 text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section variant="panel" title="Ou saisir la note">
        <div className="grid gap-3 sm:grid-cols-3">
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
            <span className="t-label mb-1.5 block">Épreuve</span>
            <Select value={kind} onChange={(event) => setKind(event.target.value as GradeKind)}>
              {(["ds", "concours", "colle", "interro", "autre"] as GradeKind[]).map((entry) => (
                <option key={entry} value={entry}>
                  {GRADE_KIND_META[entry].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="t-label mb-1.5 block">Date</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="t-label mb-1.5 block">Titre</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="DS 3 — réduction" maxLength={80} />
          </label>
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="t-label mb-1.5 block">Note</span>
              <Input inputMode="decimal" value={score} onChange={(event) => setScore(event.target.value)} />
            </label>
            <label className="block w-20">
              <span className="t-label mb-1.5 block">Sur</span>
              <Input inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} />
            </label>
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!(Number.isFinite(parsed) && score.trim() !== "" && parsedMax > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)}
          onClick={() => {
            const created = createGrade({ subject, title, kind, date, score: parsed, maxScore: parsedMax }, new Date());
            if (created) onCreate(created);
          }}
        >
          Enregistrer la note et débriefer
        </Button>
      </Section>
    </>
  );
}

function QuestionsEditor({
  grade,
  initial,
  exercises,
  onSave,
  plan,
}: {
  grade: Grade;
  initial: DebriefQuestion[];
  exercises: { key: string; label: string }[];
  onSave: (questions: DebriefQuestion[]) => { attempts: Parameters<typeof debriefPlan>[0]["attempts"]; ok: boolean };
  plan: (questions: DebriefQuestion[], attempts: Parameters<typeof debriefPlan>[0]["attempts"]) => ReturnType<typeof debriefPlan>;
}) {
  const [questions, setQuestions] = useState<DebriefQuestion[]>(initial);
  const [result, setResult] = useState<{ steps: ReturnType<typeof debriefPlan>; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<DebriefQuestion>) {
    setQuestions((current) => current.map((question, position) => (position === index ? { ...question, ...patch } : question)));
    setResult(null);
  }

  function save() {
    const invalid = validateQuestions(questions);
    setError(invalid);
    if (invalid) return;
    const saved = onSave(questions);
    setResult({ steps: plan(questions, saved.attempts), ok: saved.ok });
  }

  const missed = questions.filter((question) => question.outcome !== "réussie").length;

  return (
    <>
      <Section
        variant="panel"
        title={`${grade.title || GRADE_KIND_META[grade.kind].label} · ${grade.subject}`}
        description={`${isScored(grade) ? `${formatAverage(grade.score)}/${formatAverage(grade.maxScore)} · ` : ""}${dateFormat.format(new Date(`${grade.date}T12:00:00`))} · ${questions.length} question${questions.length > 1 ? "s" : ""}, ${missed} à reprendre`}
        action={
          <Link href="/debrief" className="text-[0.8125rem] font-bold text-accent hover:underline">
            Autre copie
          </Link>
        }
      >
        <ol className="space-y-4">
          {questions.map((question, index) => (
            <li key={index} className="well rounded-2xl p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="t-label mb-1.5 block">Question</span>
                  <Input value={question.label} onChange={(event) => update(index, { label: event.target.value })} maxLength={40} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="t-label mb-1.5 block">Chapitre</span>
                  <ChapterSelect subject={grade.subject} value={question.chapterId} onChange={(chapterId) => update(index, { chapterId })} />
                </label>
                <label className="block">
                  <span className="t-label mb-1.5 block">Points</span>
                  <Input inputMode="decimal" value={question.points ?? ""} onChange={(event) => update(index, { points: event.target.value.trim() === "" ? null : Number(event.target.value.replace(",", ".")) || null })} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Résultat de ${question.label}`}>
                {QUESTION_OUTCOMES.map((outcome) => (
                  <button
                    key={outcome}
                    type="button"
                    aria-pressed={question.outcome === outcome}
                    onClick={() => update(index, { outcome, ...(outcome === "réussie" ? { cause: null, lackOfTime: false } : {}) })}
                    className={cn("min-h-9 rounded-full px-3 text-[0.8125rem] font-bold transition-colors max-lg:min-h-11", question.outcome === outcome ? OUTCOME_STYLE[outcome] : "text-subtle hover:text-ink")}
                  >
                    {outcome}
                  </button>
                ))}
              </div>
              {question.outcome !== "réussie" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="t-label mb-1.5 block">Ce qui a manqué</span>
                    <Select value={question.cause ?? ""} onChange={(event) => update(index, { cause: (event.target.value || null) as AttemptCause | null })}>
                      <option value="">Non précisé</option>
                      {ATTEMPT_CAUSES.map((cause) => (
                        <option key={cause} value={cause}>
                          {ATTEMPT_CAUSE_LABEL[cause]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="t-label mb-1.5 block">Rappelle un exercice déjà fait</span>
                    <Select value={question.linkedExerciseKey ?? ""} onChange={(event) => update(index, { linkedExerciseKey: event.target.value || null })}>
                      <option value="">Aucun</option>
                      {exercises.map((exercise) => (
                        <option key={exercise.key} value={exercise.key}>
                          {exercise.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="t-label mb-1.5 block">Difficulté</span>
                    <Select value={question.level ?? ""} onChange={(event) => update(index, { level: (event.target.value || null) as ExerciseLevel | null })}>
                      <option value="">Non précisée</option>
                      {EXERCISE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {EXERCISE_LEVEL_LABEL[level]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-muted">
                    <input type="checkbox" checked={question.lackOfTime} onChange={(event) => update(index, { lackOfTime: event.target.checked })} className="h-4 w-4 accent-[var(--btn-g1)]" />
                    J&apos;ai manqué de temps
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="t-label mb-1.5 block">Note (facultatif)</span>
                    <Input value={question.note} onChange={(event) => update(index, { note: event.target.value })} maxLength={200} placeholder="Ce qui s'est passé" />
                  </label>
                </div>
              )}
              <div className="mt-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => { setQuestions((current) => current.filter((_, position) => position !== index)); setResult(null); }} aria-label={`Retirer ${question.label}`}>
                  <Trash2 size={14} aria-hidden /> Retirer
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setQuestions((current) => [...current, emptyQuestion(current.length + 1)]); setResult(null); }}>
            <Plus size={14} aria-hidden /> Ajouter une question
          </Button>
          <Button onClick={save} disabled={questions.length === 0}>
            <ClipboardCheck size={15} aria-hidden /> Enregistrer et voir le plan
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[0.875rem] font-bold text-rose-300">
            {error}
          </p>
        )}
      </Section>

      {result && (
        <Section variant="feature" title="Plan d'action">
          {!result.ok && (
            <p role="alert" className="mb-4 text-[0.875rem] font-bold text-rose-300">
              Le navigateur a refusé l&apos;enregistrement (stockage plein ou bloqué) : le plan ci-dessous n&apos;est pas sauvegardé.
            </p>
          )}
          <ol className="space-y-5">
            {result.steps.map((step) => (
              <li key={step.title}>
                <p className="text-[0.9375rem] font-extrabold text-ink">{step.title}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.875rem] leading-relaxed text-muted">
                  {step.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/annales" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
              Voir « À refaire »
            </Link>
            <Link href={`/erreurs?subject=${encodeURIComponent(grade.subject)}`} className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
              Noter les bonnes idées au carnet
            </Link>
          </div>
        </Section>
      )}
    </>
  );
}
