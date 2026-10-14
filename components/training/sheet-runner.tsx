"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, Eye, Lightbulb, Lock, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/state";
import { SegmentedControl } from "@/components/ui/segmented";
import { ATTEMPT_CAUSE_LABEL, ATTEMPT_CAUSES, ATTEMPT_HELP_LABEL, EXERCISE_LEVEL_LABEL, isCleanSuccess, upsertAttempts, type AttemptCause, type AttemptHelp, type AttemptResult, type ExerciseAttempt } from "@/lib/attempts";
import type { AnnaleLog } from "@/lib/annales";
import { buildExercises, createRetryAttempt } from "@/lib/exercises";
import {
  declarableHelps,
  helpFromReveal,
  NOTHING_REVEALED,
  revealCorrection,
  revealNextHint,
  SHEET_ORIGIN_LABEL,
  sheetKey,
  trainingHref,
  type ExerciseSheet,
  type Reveal,
} from "@/lib/exercise-sheets";
import { createPracticeSession } from "@/lib/practice-session";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { formatDueDay } from "@/lib/spaced-repetition";
import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";

const RESULT_OPTIONS: { value: AttemptResult; label: string }[] = [
  { value: "réussi", label: "Réussi" },
  { value: "partiel", label: "Partiel" },
  { value: "échec", label: "Échec" },
];

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Le libellé d'exercice qui apparaîtra dans le suivi (« À refaire », Next Move, diagnostic). */
export function sheetLabel(sheet: ExerciseSheet): string {
  const chapter = PROGRAMME_BY_ID.get(sheet.chapterId)?.title ?? sheet.subject;
  return `${chapter} — ${sheet.notion ?? sheet.competence}`.slice(0, 160);
}

/**
 * LE LECTEUR D'EXERCICE — l'énoncé d'abord, le reste à la demande.
 *
 *   1. L'ÉNONCÉ est la première chose affichée, avec le chrono.
 *   2. Les INDICES se montrent un à un. Chacun ouvert est compté.
 *   3. La CORRECTION n'apparaît qu'après une confirmation : l'essai sera
 *      noté « correction ouverte ».
 *   4. « J'ai fini » ouvre le résultat. L'aide proposée est celle RÉELLEMENT
 *      utilisée (lib/exercise-sheets.ts#helpFromReveal) : on peut en déclarer
 *      une plus forte, jamais une plus légère. « Sans aide » reste donc la
 *      seule tentative qui prouve quelque chose (lib/attempts.ts).
 *
 * L'essai rejoint le suivi existant : une `ExerciseAttempt` de clé
 * `fiche:<id>` (synchronisée avec le compte), lue par « À refaire », le
 * diagnostic et Next Move ; le temps passé devient une séance de travail,
 * comme pour une khôlle.
 */
export function SheetRunner({
  sheet,
  attempts,
  annales,
  retryDelaysDays,
  saveAttempts,
  saveSessions,
  onDelete,
}: {
  sheet: ExerciseSheet;
  attempts: ExerciseAttempt[];
  annales: AnnaleLog[];
  retryDelaysDays: number[];
  saveAttempts: (attempts: ExerciseAttempt[]) => void;
  saveSessions: (sessions: WorkSession[]) => void;
  onDelete: () => void;
}) {
  const key = sheetKey(sheet.id);
  const chapter = PROGRAMME_BY_ID.get(sheet.chapterId);
  const past = useMemo(() => attempts.filter((attempt) => attempt.exerciseKey === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [attempts, key]);

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [frozen, setFrozen] = useState<number | null>(null);
  useEffect(() => {
    if (frozen !== null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [frozen]);
  const seconds = Math.max(0, Math.round(((frozen ?? now) - startedAt) / 1000));

  const [reveal, setReveal] = useState<Reveal>(NOTHING_REVEALED);
  // Ce qui était ouvert au moment de « J'ai fini » : lire la correction APRÈS avoir rendu son essai ne change plus l'aide déclarée.
  const [fixed, setFixed] = useState<Reveal | null>(null);
  const [viewAfter, setViewAfter] = useState(false);
  const [askCorrection, setAskCorrection] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<AttemptResult>("réussi");
  const [help, setHelp] = useState<AttemptHelp | null>(null);
  const [minutes, setMinutes] = useState("");
  const [cause, setCause] = useState<AttemptCause | "">("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const used = fixed ?? reveal;
  const helps = declarableHelps(used);
  const chosenHelp: AttemptHelp = help !== null && helps.includes(help) ? help : helpFromReveal(used);
  const nextHint = reveal.hintsShown < sheet.hints.length;

  function finish() {
    setFrozen(Date.now());
    setFixed(reveal);
    setAskCorrection(false);
    setFinishing(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const end = new Date();
    const typed = Number(minutes);
    const worked = minutes.trim() && Number.isFinite(typed) && typed > 0 ? Math.round(typed) : Math.max(1, Math.round(seconds / 60));
    const attempt = createRetryAttempt(
      { key, label: sheetLabel(sheet), subject: sheet.subject, chapterId: sheet.chapterId, origin: "exercice" },
      { result, help: chosenHelp, minutes: worked, cause: result === "réussi" ? null : cause || null, level: sheet.level, note: note || null },
      end
    );
    if (!attempt) return;
    const next = upsertAttempts(attempts, [attempt]);
    saveAttempts(next);
    // Le temps passé compte comme n'importe quelle séance (objectif du jour, budget de la matière).
    const session = createPracticeSession({ subject: sheet.subject, startedAt: new Date(end.getTime() - worked * 60_000), endedAt: end, note: `Entraînement : ${sheetLabel(sheet)}`, chapterId: sheet.chapterId }, end);
    if (session) saveSessions([session]);

    const exercise = buildExercises({ annales, attempts: next, retryDelaysDays, today: dayKey(end) }).find((entry) => entry.key === key);
    const proven = isCleanSuccess(attempt);
    setOutcome(
      proven
        ? exercise?.status === "vérifié"
          ? "Réussi sans aide : la correction est vérifiée. Dans une semaine, un exercice de transfert vérifiera la méthode sur un autre énoncé."
          : "Réussi sans aide du premier coup : c'est la seule tentative qui prouve que tu sais le faire."
        : result === "réussi"
          ? `Réussi, mais ${chosenHelp === "indices" ? "avec indices" : "avec la correction ouverte"} : cela ne prouve pas encore que tu sais le faire seul. L'exercice reviendra ${exercise?.nextRetryDay ? formatDueDay(exercise.nextRetryDay, end) : "bientôt"}.`
          : `Noté. L'exercice reviendra ${exercise?.nextRetryDay ? formatDueDay(exercise.nextRetryDay, end) : "bientôt"} — c'est la règle tant qu'il n'est pas réussi sans aide.`
    );
  }

  /* ── Après l'enregistrement ── */
  if (outcome) {
    return (
      <div className="space-y-4">
        <Notice tone="info" title="Tentative enregistrée">
          {outcome}
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href="/revision" className={buttonVariants({ variant: "primary", size: "md" })}>
            Retour au programme <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href={trainingHref({ chapterId: sheet.chapterId })} className={buttonVariants({ variant: "secondary", size: "md" })}>
            Autres exercices du chapitre
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── L'EXERCICE, ET D'OÙ IL VIENT ── */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sheet.origin === "ia" ? "accent" : "default"}>
            {sheet.origin === "ia" ? <Sparkles size={12} aria-hidden /> : <ExternalLink size={12} aria-hidden />} {SHEET_ORIGIN_LABEL[sheet.origin]}
          </Badge>
          <Badge>{EXERCISE_LEVEL_LABEL[sheet.level]}</Badge>
          <Badge>{sheet.subject}</Badge>
        </div>
        <h2 className="t-heading break-words">{chapter?.title ?? sheet.subject}</h2>
        <p className="t-meta">
          {sheet.notion ? `${sheet.notion} · ` : ""}Compétence : <span className="font-semibold text-ink">{sheet.competence}</span>
        </p>
        {sheet.source && (
          <p className="t-meta">
            Source :{" "}
            {sheet.source.url ? (
              <a href={sheet.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                {sheet.source.name} <ExternalLink size={12} aria-hidden />
              </a>
            ) : (
              <span className="font-semibold text-ink">{sheet.source.name}</span>
            )}
          </p>
        )}
      </header>

      {/* ── 1. L'ÉNONCÉ — toujours d'abord ── */}
      <section aria-labelledby="enonce-titre" className="surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="enonce-titre" className="t-label">
            Énoncé
          </h3>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-muted" aria-label={`Temps écoulé : ${clock(seconds)}`}>
            <Timer size={14} aria-hidden /> {clock(seconds)}
            {sheet.estimatedMinutes ? <span className="text-subtle">/ {sheet.estimatedMinutes} min</span> : null}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-7 text-ink">{sheet.statement}</p>
      </section>

      {/* ── 2. LES INDICES — un à un, comptés ── */}
      {sheet.hints.length > 0 && (
        <section aria-labelledby="indices-titre" className="surface p-5 sm:p-6">
          <h3 id="indices-titre" className="t-label inline-flex items-center gap-1.5">
            <Lightbulb size={14} aria-hidden /> Indices · {reveal.hintsShown}/{sheet.hints.length}
          </h3>
          {reveal.hintsShown > 0 && (
            <ol className="mt-2 space-y-2">
              {sheet.hints.slice(0, reveal.hintsShown).map((hint, index) => (
                <li key={index} className="rounded-xl bg-inset px-3.5 py-2.5 text-[0.9375rem] text-ink">
                  <span className="font-semibold text-subtle">Indice {index + 1} — </span>
                  {hint}
                </li>
              ))}
            </ol>
          )}
          {nextHint && frozen === null && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setReveal((current) => revealNextHint(current, sheet))}>
                <Eye size={14} aria-hidden /> Voir {reveal.hintsShown === 0 ? "un indice" : "l'indice suivant"}
              </Button>
              <p className="t-meta mt-1.5 text-2xs">Essaie d&apos;abord seul. Un indice ouvert fait noter l&apos;essai « avec indices » : ce n&apos;est plus « sans aide ».</p>
            </div>
          )}
        </section>
      )}

      {/* ── 3. LA CORRECTION — après confirmation ── */}
      {sheet.correction && (
        <section aria-labelledby="correction-titre" className="surface p-5 sm:p-6">
          <h3 id="correction-titre" className="t-label inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> Correction
          </h3>
          {reveal.correctionShown || viewAfter ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-7 text-ink">{sheet.correction}</p>
          ) : askCorrection ? (
            <div className="mt-2" role="alert">
              <p className="text-[0.9375rem] font-semibold text-ink">L&apos;essai sera noté « correction ouverte » et ne pourra pas prouver que tu sais le faire. Voir quand même ?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setReveal((current) => revealCorrection(current, sheet));
                    setAskCorrection(false);
                  }}
                >
                  Voir la correction
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAskCorrection(false)}>
                  Continuer sans
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              {frozen === null ? (
                <>
                  <p className="t-meta text-2xs">Cachée. Termine ton essai d&apos;abord : si tu bloques, mieux vaut un indice.</p>
                  <Button type="button" variant="ghost" size="sm" className="mt-1.5" onClick={() => setAskCorrection(true)}>
                    Je veux voir la correction
                  </Button>
                </>
              ) : (
                <>
                  <p className="t-meta text-2xs">Ton essai est rendu : tu peux la lire, l&apos;aide déclarée ne change plus.</p>
                  <Button type="button" variant="secondary" size="sm" className="mt-1.5" onClick={() => setViewAfter(true)}>
                    <Eye size={14} aria-hidden /> Voir la correction
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── 4. LE RÉSULTAT ── */}
      {!finishing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={finish}>
            <Check size={16} aria-hidden /> J&apos;ai fini
          </Button>
          <Link href={trainingHref({ chapterId: sheet.chapterId })} className={buttonVariants({ variant: "ghost", size: "md" })}>
            Quitter sans noter
          </Link>
        </div>
      ) : (
        <form onSubmit={save} className="surface space-y-4 p-5 sm:p-6" aria-label="Résultat de l'essai">
          <h3 className="t-subhead">Comment ça s&apos;est passé ?</h3>
          <div>
            <p className="t-label">Résultat</p>
            <SegmentedControl ariaLabel="Résultat" className="mt-1.5" options={RESULT_OPTIONS} value={result} onChange={setResult} />
          </div>
          <div>
            <p className="t-label">Aide utilisée</p>
            <SegmentedControl
              ariaLabel="Aide utilisée"
              className="mt-1.5"
              options={helps.map((entry) => ({ value: entry, label: ATTEMPT_HELP_LABEL[entry] }))}
              value={chosenHelp}
              onChange={setHelp}
            />
            {helpFromReveal(used) !== "sans" && (
              <p className="t-meta mt-1.5 text-2xs">
                {used.correctionShown ? "Tu as ouvert la correction" : `Tu as ouvert ${used.hintsShown} indice${used.hintsShown > 1 ? "s" : ""}`} : « sans aide » n&apos;est plus possible pour cet essai.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="essai-minutes" className="t-label block">
                Temps passé, en minutes
              </label>
              <Input id="essai-minutes" inputMode="numeric" className="mt-1.5" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder={String(Math.max(1, Math.round(seconds / 60)))} />
            </div>
            {result !== "réussi" && (
              <div>
                <label htmlFor="essai-cause" className="t-label block">
                  Pourquoi ça a coincé ?
                </label>
                <Select id="essai-cause" className="mt-1.5" value={cause} onChange={(event) => setCause(event.target.value as AttemptCause | "")}>
                  <option value="">Je ne sais pas encore</option>
                  {ATTEMPT_CAUSES.map((entry) => (
                    <option key={entry} value={entry}>
                      {ATTEMPT_CAUSE_LABEL[entry]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="essai-note" className="t-label block">
              Note (facultatif)
            </label>
            <Textarea id="essai-note" rows={2} className="mt-1.5" maxLength={400} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Enregistrer l&apos;essai</Button>
          </div>
        </form>
      )}

      {/* ── Tentatives précédentes ── */}
      {past.length > 0 && (
        <section aria-labelledby="essais-titre" className="surface p-5 sm:p-6">
          <h3 id="essais-titre" className="t-label">
            Tes essais précédents · {past.length}
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {past.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[0.875rem]">
                <span className="font-semibold text-ink">{formatDueDay(attempt.day, new Date())}</span>
                <span className="text-muted">
                  {attempt.result} · {ATTEMPT_HELP_LABEL[attempt.help].toLowerCase()}
                  {attempt.minutes ? ` · ${attempt.minutes} min` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="px-1">
        {confirmDelete ? (
          <p className="text-[0.8125rem] font-semibold text-ink">
            Supprimer cette fiche ? Tes essais restent dans le suivi.{" "}
            <button type="button" onClick={onDelete} className="font-semibold text-rose-300 hover:underline">
              Oui, supprimer
            </button>{" "}
            ·{" "}
            <button type="button" onClick={() => setConfirmDelete(false)} className="font-semibold text-muted hover:underline">
              Annuler
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-[0.8125rem] font-semibold text-muted hover:text-ink">
            Supprimer cette fiche
          </button>
        )}
      </div>
    </div>
  );
}
