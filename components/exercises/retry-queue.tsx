"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, EyeOff, Lightbulb, Lock, Plus, RotateCcw } from "lucide-react";
import { ChapterSelect } from "@/components/exercises/chapter-select";
import { CopyRequest } from "@/components/exercises/copy-request";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { useAnnales } from "@/hooks/use-annales";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import {
  ATTEMPT_CAUSE_LABEL,
  ATTEMPT_CAUSES,
  ATTEMPT_HELP_LABEL,
  ATTEMPT_HELPS,
  ATTEMPT_RESULTS,
  EXERCISE_LEVEL_LABEL,
  EXERCISE_LEVELS,
  normalizeAnalysis,
  upsertAttempts,
  type AttemptCause,
  type BlockAnalysis,
  type ExerciseAttempt,
  type AttemptHelp,
  type AttemptResult,
  type ExerciseLevel,
} from "@/lib/attempts";
import { cn } from "@/lib/cn";
import { courseLocks, lockSentence } from "@/lib/course-lock";
import { fixableIssues, QUALITY_ISSUE_LABEL, qualityIssues, transferRequest } from "@/lib/exercise-quality";
import { buildExercises, createRetryAttempt, dueRetries, progressLine, upcomingRetries, type Exercise } from "@/lib/exercises";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { manualExerciseKey } from "@/lib/session-debrief";
import { localData } from "@/lib/storage";
import { dayKey, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { createTransferAttempt, methodCardFrom, transferChecks, type TransferCheck } from "@/lib/transfer";

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function fmtDay(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

const RESULT_STYLE: Record<AttemptResult, string> = {
  réussi: "bg-emerald-400/[0.16] text-emerald-300",
  partiel: "bg-amber-400/[0.16] text-amber-300",
  échec: "bg-rose-400/[0.14] text-rose-300",
};

/**
 * « À REFAIRE SANS AIDE » — la file des exercices ratés (lib/exercises.ts).
 *
 * Un exercice raté revient à la date programmée. On le refait CORRECTION
 * CACHÉE, chrono lancé, puis on dit honnêtement le résultat et l'aide
 * utilisée. Seule une réussite sans aide le sort de la file.
 *
 * Fonctionne sans compte et hors ligne : les tentatives saisies ici vivent
 * dans la collection `attempts`. Les annales du compte (useAnnales) s'y
 * ajoutent quand elles sont disponibles.
 *
 * `?refaire=<clé>` ouvre directement un exercice (lien de Next Move).
 *
 * « COMPRENDRE POURQUOI JE BLOQUE » : après un échec, quatre réponses
 * courtes (attempt.analysis) deviennent une fiche de méthode dans « À revoir ».
 * TRANSFERT (lib/transfer.ts) : une fois l'exercice réussi sans aide, on
 * vérifie la méthode sur un AUTRE énoncé — `?transfert=<clé d'origine>`
 * ouvre directement ce formulaire.
 */
export function RetryQueue() {
  const params = useSearchParams();
  const { attempts, saveAttempts, preferences, ready, saveReviewItems, reviewItems } = usePrepahubData();
  const { logs } = useAnnales();
  const today = dayKey(new Date());
  const exercises = useMemo(() => buildExercises({ annales: logs, attempts, retryDelaysDays: preferences.retryDelaysDays, today }), [logs, attempts, preferences.retryDelaysDays, today]);
  const due = useMemo(() => dueRetries(exercises), [exercises]);
  // Verrou de cours (lib/course-lock.ts) : un exercice d'un chapitre verrouillé attend que les fiches soient retrouvées.
  const locks = useMemo(() => courseLocks(reviewItems, new Date()), [reviewItems]);
  const lockOf = (exercise: Exercise) => (exercise.chapterId ? locks.find((lock) => lock.key === exercise.chapterId) ?? null : null);
  const upcoming = useMemo(() => upcomingRetries(exercises).slice(0, 5), [exercises]);
  const verified = useMemo(() => exercises.filter((exercise) => exercise.status === "vérifié").sort((a, b) => (b.verifiedOn ?? "").localeCompare(a.verifiedOn ?? "")).slice(0, 5), [exercises]);
  const transfers = useMemo(() => transferChecks(exercises, attempts, preferences.retryDelaysDays, today), [exercises, attempts, preferences.retryDelaysDays, today]);
  const transfersOpen = useMemo(() => transfers.filter((check) => check.status !== "acquis").slice(0, 6), [transfers]);
  // Contrôle qualité : les exercices saisis ici dont le chapitre ou le niveau manque (lib/exercise-quality.ts).
  const incomplete = useMemo(() => exercises.filter((exercise) => fixableIssues(exercise).length > 0).slice(0, 5), [exercises]);
  const [openKey, setOpenKey] = useState<string | null>(() => params.get("refaire"));
  const [transferKey, setTransferKey] = useState<string | null>(() => params.get("transfert"));
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  if (!ready) return null;
  const open = openKey ? exercises.find((exercise) => exercise.key === openKey) ?? null : null;
  const openTransfer = transferKey ? transfers.find((check) => check.exercise.key === transferKey && check.status !== "acquis") ?? null : null;

  /**
   * La fiche de méthode, ajoutée au carnet « À revoir ». Relu sur le disque
   * au moment d'écrire : le carnet s'écrit en REMPLACEMENT, et la copie du
   * hook de cet écran pourrait être plus ancienne que celle d'un autre onglet.
   */
  function addMethodCard(analysis: BlockAnalysis | undefined, subject: Subject): boolean {
    if (!analysis) return false;
    const current = localData.reviewItems();
    const card = methodCardFrom(analysis, subject, current, new Date());
    if (!card) return false;
    saveReviewItems([...current, card]);
    return true;
  }

  function record(exercise: Exercise, input: SessionInput) {
    const created = createRetryAttempt(exercise, input, new Date());
    if (!created) return;
    const attempt = input.analysis ? { ...created, analysis: input.analysis } : created;
    saveAttempts(upsertAttempts(attempts, [attempt]));
    const carded = addMethodCard(input.analysis, created.subject);
    setOpenKey(null);
    setFlash(
      input.result === "réussi" && input.help === "sans"
        ? `« ${exercise.label} » : réussi sans aide. La correction est vérifiée. Dans ${TRANSFER_DELAY_LABEL}, un exercice de transfert vérifiera la méthode sur un autre énoncé.`
        : `« ${exercise.label} » : noté. L'exercice reviendra plus tard — c'est la règle tant qu'il n'est pas réussi sans aide.${carded ? " Fiche de méthode ajoutée à « À revoir »." : ""}`
    );
  }

  /** Complète chapitre et niveau sur toutes les tentatives saisies de l'exercice — la tentative elle-même ne change pas. */
  function completeExercise(exercise: Exercise, patch: { chapterId: string | null; level: ExerciseLevel | null }) {
    const at = new Date().toISOString();
    const updated = attempts
      .filter((attempt) => attempt.exerciseKey === exercise.key)
      .map((attempt) => ({
        ...attempt,
        ...(patch.chapterId && !attempt.chapterId ? { chapterId: patch.chapterId } : {}),
        ...(patch.level && !attempt.level ? { level: patch.level } : {}),
        updatedAt: at,
      }));
    if (updated.length === 0) return;
    saveAttempts(upsertAttempts(attempts, updated));
    setFlash(`« ${exercise.label} » complété : il compte maintenant dans le diagnostic.`);
  }

  function recordTransfer(check: TransferCheck, input: TransferInput) {
    const attempt = createTransferAttempt(check.exercise, input, new Date());
    if (!attempt) return;
    saveAttempts(upsertAttempts(attempts, [attempt]));
    setTransferKey(null);
    setFlash(
      input.result === "réussi" && input.help === "sans"
        ? `Transfert réussi sans aide : la méthode de « ${check.exercise.label} » est acquise — sur deux énoncés différents.`
        : `Transfert noté. La méthode n'est pas encore transférée : un autre exercice de transfert reviendra plus tard.`
    );
  }

  return (
    <Section
      variant="panel"
      title="À refaire sans aide"
      description={
        due.length > 0
          ? `${due.length} exercice${due.length > 1 ? "s" : ""} à refaire aujourd'hui. Correction cachée, chrono lancé, puis un résultat honnête.`
          : "Rien à refaire aujourd'hui. Les exercices ratés reviennent ici à la date prévue."
      }
      action={
        <Button variant="ghost" size="sm" onClick={() => setAdding((value) => !value)} aria-expanded={adding}>
          <Plus size={14} aria-hidden /> Noter un exercice
        </Button>
      }
    >
      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink">
          {flash}
        </p>
      )}

      {adding && (
        <NewExerciseForm
          onCancel={() => setAdding(false)}
          onSave={(attempt) => {
            saveAttempts(upsertAttempts(attempts, [attempt]));
            const carded = addMethodCard(attempt.analysis, attempt.subject);
            setAdding(false);
            setFlash(`« ${attempt.label} » noté.${carded ? " Fiche de méthode ajoutée à « À revoir »." : ""}`);
          }}
        />
      )}

      {open ? (
        <RetrySession key={open.key} exercise={open} onCancel={() => setOpenKey(null)} onSave={(input) => record(open, input)} />
      ) : openTransfer ? (
        <TransferForm key={openTransfer.exercise.key} check={openTransfer} onCancel={() => setTransferKey(null)} onSave={(input) => recordTransfer(openTransfer, input)} />
      ) : (
        <>
          {due.length > 0 && (
            <ul className="divide-y divide-line">
              {due.map((exercise) => {
                const lock = lockOf(exercise);
                return lock ? (
                  <ExerciseRow
                    key={exercise.key}
                    exercise={exercise}
                    detail={`Verrouillé : ${lockSentence(lock)}.`}
                    action={
                      <Link href={`/revoir/session?subject=${encodeURIComponent(lock.subject)}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                        <Lock size={14} aria-hidden /> Cours d&apos;abord
                      </Link>
                    }
                  />
                ) : (
                  <ExerciseRow key={exercise.key} exercise={exercise} action={<Button size="sm" onClick={() => { setFlash(null); setOpenKey(exercise.key); }}><RotateCcw size={14} aria-hidden /> Refaire</Button>} />
                );
              })}
            </ul>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Programmés</p>
              <ul className="divide-y divide-line">
                {upcoming.map((exercise) => (
                  <ExerciseRow key={exercise.key} exercise={exercise} action={<span className="t-meta text-2xs">le {fmtDay(exercise.nextRetryDay!)}</span>} />
                ))}
              </ul>
            </>
          )}
          {transfersOpen.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Transferts à vérifier</p>
              <p className="t-meta mb-1 text-2xs">Réussir à nouveau le même énoncé prouve qu&apos;on sait le refaire, pas qu&apos;on a compris la méthode. Un énoncé différent, sans aide, le prouve.</p>
              <ul className="divide-y divide-line">
                {transfersOpen.map((check) => (
                  <ExerciseRow
                    key={check.exercise.key}
                    exercise={check.exercise}
                    detail={transferDetail(check)}
                    action={
                      check.status === "à-faire" ? (
                        <Button size="sm" variant="ghost" onClick={() => { setFlash(null); setTransferKey(check.exercise.key); }}>
                          <ArrowRightLeft size={14} aria-hidden /> Transfert
                        </Button>
                      ) : (
                        <span className="t-meta text-2xs">le {fmtDay(check.dueDay!)}</span>
                      )
                    }
                  />
                ))}
              </ul>
            </>
          )}
          {incomplete.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Données à compléter</p>
              <p className="t-meta mb-1 text-2xs">Sans chapitre ni niveau, un exercice ne peut pas guider les recommandations.</p>
              <ul className="divide-y divide-line">
                {incomplete.map((exercise) => (
                  <QualityRow key={exercise.key} exercise={exercise} onSave={(patch) => completeExercise(exercise, patch)} />
                ))}
              </ul>
            </>
          )}
          {verified.length > 0 && (
            <>
              <p className="t-label mb-1 mt-5">Corrections vérifiées</p>
              <ul className="divide-y divide-line">
                {verified.map((exercise) => (
                  <ExerciseRow key={exercise.key} exercise={exercise} action={<Badge variant="success"><CheckCircle2 size={12} aria-hidden /> {fmtDay(exercise.verifiedOn!)}</Badge>} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Section>
  );
}

const TRANSFER_DELAY_LABEL = "une semaine";

function transferDetail(check: TransferCheck): string {
  const failed = check.attempts.length;
  const method = check.analysis?.tool ? `Méthode : ${check.analysis.tool}` : "Même méthode, autre énoncé";
  return failed > 0 ? `${method} · ${failed} transfert${failed > 1 ? "s" : ""} pas encore réussi${failed > 1 ? "s" : ""} sans aide` : method;
}

type SessionInput = { result: AttemptResult; help: AttemptHelp; minutes: number | null; cause: AttemptCause | null; lackOfTime: boolean; note: string; analysis?: BlockAnalysis };
type TransferInput = { label: string; result: AttemptResult; help: AttemptHelp; minutes: number | null; cause: AttemptCause | null; level: ExerciseLevel | null };

function ExerciseRow({ exercise, action, detail }: { exercise: Exercise; action: React.ReactNode; detail?: string }) {
  const chapter = exercise.chapterId ? PROGRAMME_BY_ID.get(exercise.chapterId) : null;
  const last = exercise.steps[exercise.steps.length - 1];
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-ink">{exercise.label}</p>
        <p className="t-meta text-2xs">
          {exercise.subject ?? "Matière inconnue"}
          {chapter ? ` · ${chapter.title}` : ""} · dernier essai {last.result}, {ATTEMPT_HELP_LABEL[last.help].toLowerCase()}
          {!last.helpDeclared ? " (déduit des indices)" : ""}
        </p>
        {detail && <p className="mt-1 text-2xs font-semibold text-accent">{detail}</p>}
        {exercise.changeApproach && <p className="mt-1 text-2xs font-semibold text-amber-300">{exercise.changeApproach}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function RetrySession({
  exercise,
  onCancel,
  onSave,
}: {
  exercise: Exercise;
  onCancel: () => void;
  onSave: (input: SessionInput) => void;
}) {
  const started = useRef(Date.now());
  const [analysis, setAnalysis] = useState<BlockAnalysis>(EMPTY_ANALYSIS);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [help, setHelp] = useState<AttemptHelp>("sans");
  const [minutes, setMinutes] = useState("");
  const [cause, setCause] = useState<AttemptCause | null>(null);
  const [lackOfTime, setLackOfTime] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.round((now - started.current) / 60_000);
  const progress = progressLine(exercise);
  const minutesValue = minutes.trim() === "" ? elapsed : Number(minutes);

  return (
    <div className="well rounded-2xl p-4 sm:p-5">
      <p className="t-subhead">{exercise.label}</p>
      <p className="t-meta mt-1">
        {exercise.steps.length} tentative{exercise.steps.length > 1 ? "s" : ""} avant celle-ci{progress ? ` · ${progress}` : ""}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-semibold text-ink">
        <EyeOff size={14} aria-hidden /> Correction cachée : ne l&apos;ouvre qu&apos;après avoir fini.
      </p>
      <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-muted" aria-live="off">
        {elapsed} min
      </p>

      <fieldset className="mt-4">
        <legend className="t-label mb-2">Résultat</legend>
        <div className="grid grid-cols-3 gap-2">
          {ATTEMPT_RESULTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={result === value}
              onClick={() => setResult(value)}
              className={cn("min-h-11 rounded-xl text-[0.875rem] font-semibold capitalize transition-colors", result === value ? RESULT_STYLE[value] : "bg-inset text-muted hover:text-ink")}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="t-label mb-1.5 block">Aide utilisée</span>
          <Select value={help} onChange={(event) => setHelp(event.target.value as AttemptHelp)}>
            {ATTEMPT_HELPS.map((value) => (
              <option key={value} value={value}>
                {ATTEMPT_HELP_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Temps (min)</span>
          <Input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder={String(elapsed)} />
        </label>
        {result && result !== "réussi" && (
          <label className="block sm:col-span-2">
            <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
            <Select value={cause ?? ""} onChange={(event) => setCause((event.target.value || null) as AttemptCause | null)}>
              <option value="">Non précisé</option>
              {ATTEMPT_CAUSES.map((value) => (
                <option key={value} value={value}>
                  {ATTEMPT_CAUSE_LABEL[value]}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-muted sm:col-span-2">
          <input type="checkbox" checked={lackOfTime} onChange={(event) => setLackOfTime(event.target.checked)} className="h-4 w-4 accent-[var(--btn-g1)]" />
          J&apos;ai manqué de temps
        </label>
        <label className="block sm:col-span-2">
          <span className="t-label mb-1.5 block">Note (facultatif)</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={400} placeholder="Ce qui a débloqué, ou ce qui manque encore" />
        </label>
      </div>

      {result && (result !== "réussi" || help !== "sans") && <BlockAnalysisFields value={analysis} onChange={setAnalysis} />}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          disabled={!result}
          onClick={() => {
            if (!result) return;
            const kept = result !== "réussi" || help !== "sans" ? normalizeAnalysis(analysis) ?? undefined : undefined;
            onSave({ result, help, minutes: Number.isFinite(minutesValue) ? minutesValue : null, cause, lackOfTime, note, ...(kept ? { analysis: kept } : {}) });
          }}
        >
          Enregistrer la tentative
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

/** Un exercice incomplet : ce qui manque, et de quoi le compléter sur place. */
function QualityRow({ exercise, onSave }: { exercise: Exercise; onSave: (patch: { chapterId: string | null; level: ExerciseLevel | null }) => void }) {
  const fixable = fixableIssues(exercise);
  const [chapterId, setChapterId] = useState<string | null>(exercise.chapterId);
  const [level, setLevel] = useState<ExerciseLevel | null>(null);
  const issues = qualityIssues(exercise);
  return (
    <li className="py-3">
      <p className="truncate text-[0.9375rem] font-semibold text-ink">{exercise.label}</p>
      <ul className="t-meta text-2xs">
        {issues.map((issue) => (
          <li key={issue}>{QUALITY_ISSUE_LABEL[issue]}</li>
        ))}
      </ul>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {fixable.includes("chapitre") && exercise.subject && <ChapterSelect subject={exercise.subject} value={chapterId} onChange={setChapterId} />}
        {fixable.includes("niveau") && (
          <Select aria-label="Difficulté" value={level ?? ""} onChange={(event) => setLevel((event.target.value || null) as ExerciseLevel | null)}>
            <option value="">Difficulté…</option>
            {EXERCISE_LEVELS.map((value) => (
              <option key={value} value={value}>
                {EXERCISE_LEVEL_LABEL[value]}
              </option>
            ))}
          </Select>
        )}
        <Button size="sm" variant="ghost" disabled={(chapterId === exercise.chapterId || !chapterId) && !level} onClick={() => onSave({ chapterId: chapterId !== exercise.chapterId ? chapterId : null, level })}>
          Compléter
        </Button>
      </div>
    </li>
  );
}

const EMPTY_ANALYSIS: BlockAnalysis = { missed: "", derailedAt: "", tool: "", cue: "" };

const ANALYSIS_FIELDS: { key: keyof BlockAnalysis; label: string; placeholder: string }[] = [
  { key: "missed", label: "Ce que je n'ai pas compris", placeholder: "Pourquoi on passe par la série entière" },
  { key: "derailedAt", label: "La première étape où j'ai déraillé", placeholder: "J'ai voulu calculer directement au lieu de majorer" },
  { key: "tool", label: "Le réflexe ou le théorème à mobiliser", placeholder: "Convergence dominée" },
  { key: "cue", label: "Ce que je dois reconnaître la prochaine fois", placeholder: "Une limite d'intégrales avec un paramètre n" },
];

/**
 * « COMPRENDRE POURQUOI JE BLOQUE » — quatre réponses courtes, à remplir
 * correction en main. Le réflexe ou l'indice à reconnaître suffisent à faire
 * une fiche de méthode ; le reste la complète.
 */
function BlockAnalysisFields({ value, onChange }: { value: BlockAnalysis; onChange: (value: BlockAnalysis) => void }) {
  return (
    <details className="mt-4 rounded-xl bg-inset p-3">
      <summary className="inline-flex cursor-pointer items-center gap-2 text-[0.875rem] font-semibold text-ink">
        <Lightbulb size={14} aria-hidden /> Comprendre pourquoi je bloque
      </summary>
      <p className="t-meta mt-2 text-2xs">Correction en main, après l&apos;essai. Le réflexe et ce qu&apos;il faut reconnaître deviennent une fiche de méthode dans « À revoir ».</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ANALYSIS_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="t-label mb-1.5 block">{field.label}</span>
            <Input value={value[field.key]} onChange={(event) => onChange({ ...value, [field.key]: event.target.value })} maxLength={300} placeholder={field.placeholder} />
          </label>
        ))}
      </div>
    </details>
  );
}

/** L'essai de TRANSFERT : un autre énoncé, la même méthode. */
function TransferForm({ check, onCancel, onSave }: { check: TransferCheck; onCancel: () => void; onSave: (input: TransferInput) => void }) {
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [help, setHelp] = useState<AttemptHelp>("sans");
  const [cause, setCause] = useState<AttemptCause | null>(null);
  const [minutes, setMinutes] = useState("");
  const [level, setLevel] = useState<ExerciseLevel | null>(null);
  const sameStatement = label.trim().toLowerCase() === check.exercise.label.trim().toLowerCase();

  return (
    <div className="well rounded-2xl p-4 sm:p-5">
      <p className="t-label">Exercice de transfert</p>
      <p className="t-subhead mt-1">Même méthode que « {check.exercise.label} », autre énoncé</p>
      {check.analysis && (
        <ul className="t-meta mt-2 space-y-0.5 text-2xs">
          {check.analysis.cue && <li>À reconnaître : {check.analysis.cue}</li>}
          {check.analysis.tool && <li>Réflexe : {check.analysis.tool}</li>}
        </ul>
      )}
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-semibold text-ink">
        <EyeOff size={14} aria-hidden /> Sans relire la correction de l&apos;exercice d&apos;origine.
      </p>
      <CopyRequest text={transferRequest(check.exercise, check.analysis?.tool || null)} className="mt-3" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="t-label mb-1.5 block">Le nouvel exercice</span>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder="TD 6 — exercice 3, ou l'énoncé donné par Claude" />
          {sameStatement && <span className="mt-1 block text-2xs font-semibold text-amber-300">C&apos;est le même énoncé : un transfert se vérifie sur un exercice différent.</span>}
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Résultat</span>
          <Select value={result ?? ""} onChange={(event) => setResult((event.target.value || null) as AttemptResult | null)}>
            <option value="">—</option>
            {ATTEMPT_RESULTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Aide</span>
          <Select value={help} onChange={(event) => setHelp(event.target.value as AttemptHelp)}>
            {ATTEMPT_HELPS.map((value) => (
              <option key={value} value={value}>
                {ATTEMPT_HELP_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
        {result && result !== "réussi" && (
          <label className="block">
            <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
            <Select value={cause ?? ""} onChange={(event) => setCause((event.target.value || null) as AttemptCause | null)}>
              <option value="">Non précisé</option>
              {ATTEMPT_CAUSES.map((value) => (
                <option key={value} value={value}>
                  {ATTEMPT_CAUSE_LABEL[value]}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="block">
          <span className="t-label mb-1.5 block">Temps (min)</span>
          <Input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Difficulté</span>
          <Select value={level ?? ""} onChange={(event) => setLevel((event.target.value || null) as ExerciseLevel | null)}>
            <option value="">Non précisée</option>
            {EXERCISE_LEVELS.map((value) => (
              <option key={value} value={value}>
                {EXERCISE_LEVEL_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button disabled={!result || !label.trim() || sameStatement} onClick={() => result && onSave({ label, result, help, minutes: minutes ? Number(minutes) : null, cause, level })}>
          Enregistrer le transfert
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function NewExerciseForm({ onCancel, onSave }: { onCancel: () => void; onSave: (attempt: ExerciseAttempt) => void }) {
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult>("échec");
  const [help, setHelp] = useState<AttemptHelp>("sans");
  const [cause, setCause] = useState<AttemptCause | null>(null);
  const [minutes, setMinutes] = useState("");
  const [level, setLevel] = useState<ExerciseLevel | null>(null);
  const [analysis, setAnalysis] = useState<BlockAnalysis>(EMPTY_ANALYSIS);

  function save() {
    const name = label.trim();
    if (!name) return;
    const key = manualExerciseKey(name);
    const attempt = createRetryAttempt({ key, label: name, subject, chapterId, origin: "exercice" }, { result, help, minutes: minutes ? Number(minutes) : null, cause, level }, new Date());
    if (!attempt) return;
    const kept = result !== "réussi" || help !== "sans" ? normalizeAnalysis(analysis) : null;
    onSave(kept ? { ...attempt, analysis: kept } : attempt);
  }

  return (
    <div className="well mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="t-label mb-1.5 block">Exercice</span>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} placeholder="TD 4 — exercice 12" />
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Matière</span>
        <Select value={subject} onChange={(event) => { setSubject(event.target.value as Subject); setChapterId(null); }}>
          {subjects.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Chapitre</span>
        <ChapterSelect subject={subject} value={chapterId} onChange={setChapterId} />
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Résultat</span>
        <Select value={result} onChange={(event) => setResult(event.target.value as AttemptResult)}>
          {ATTEMPT_RESULTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Aide</span>
        <Select value={help} onChange={(event) => setHelp(event.target.value as AttemptHelp)}>
          {ATTEMPT_HELPS.map((value) => (
            <option key={value} value={value}>
              {ATTEMPT_HELP_LABEL[value]}
            </option>
          ))}
        </Select>
      </label>
      {result !== "réussi" && (
        <label className="block">
          <span className="t-label mb-1.5 block">Ce qui a bloqué</span>
          <Select value={cause ?? ""} onChange={(event) => setCause((event.target.value || null) as AttemptCause | null)}>
            <option value="">Non précisé</option>
            {ATTEMPT_CAUSES.map((value) => (
              <option key={value} value={value}>
                {ATTEMPT_CAUSE_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="block">
        <span className="t-label mb-1.5 block">Temps (min)</span>
        <Input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      </label>
      <label className="block">
        <span className="t-label mb-1.5 block">Difficulté</span>
        <Select value={level ?? ""} onChange={(event) => setLevel((event.target.value || null) as ExerciseLevel | null)}>
          <option value="">Non précisée</option>
          {EXERCISE_LEVELS.map((value) => (
            <option key={value} value={value}>
              {EXERCISE_LEVEL_LABEL[value]}
            </option>
          ))}
        </Select>
      </label>
      {(result !== "réussi" || help !== "sans") && (
        <div className="sm:col-span-2">
          <BlockAnalysisFields value={analysis} onChange={setAnalysis} />
        </div>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button size="sm" onClick={save} disabled={!label.trim()}>
          Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
