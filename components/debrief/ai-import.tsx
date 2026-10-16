"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, FileInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { aiDebriefPrompt, matchGrade, mergeWithSaved, parseAiDebrief } from "@/lib/ai-debrief";
import type { ExerciseAttempt } from "@/lib/attempts";
import { DEBRIEF_DRAFT_KEY, questionsFromAttempts } from "@/lib/debrief";
import { createGrade, formatAverage, GRADE_KIND_META } from "@/lib/grades";
import { writeFlag, type ErrorEntry, type Grade } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/**
 * IMPORTER UN DÉBRIEF PRODUIT PAR UNE IA.
 *
 * Colle la réponse JSON de l'IA : TaekdHub la vérifie et montre CE QU'IL A
 * COMPRIS (note, questions, causes à trancher, doutes de l'IA). Rien n'est
 * enregistré ici : « Ouvrir pour vérification » prépare un BROUILLON (sur cet
 * appareil) dans l'éditeur habituel ; l'historique n'est modifié qu'au clic
 * « Enregistrer » de l'élève, par le chemin ordinaire (lib/debrief.ts).
 * Seule exception, dite à l'écran : si la note n'existe pas encore, elle est
 * créée à l'ouverture (il en faut une pour porter le débrief).
 */
export function AiDebriefImport({
  grades,
  saveGrades,
  attempts,
  errors,
  onOpen,
}: {
  grades: Grade[];
  saveGrades: (items: Grade[]) => void;
  attempts: ExerciseAttempt[];
  errors: ErrorEntry[];
  onOpen: (gradeId: string) => void;
}) {
  const [text, setText] = useState("");
  const [analysed, setAnalysed] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [score, setScore] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const today = dayKey(new Date());
  const result = useMemo(() => (analysed ? parseAiDebrief(text, today) : null), [analysed, text, today]);
  const existing = result?.ok ? matchGrade(grades, result.value.grade) : null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiDebriefPrompt());
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  function open() {
    if (!result?.ok) return;
    const { value } = result;
    let gradeId = existing?.id ?? null;
    if (!gradeId) {
      const typed = score.trim() === "" ? null : Number(score.replace(",", "."));
      const created = createGrade({ ...value.grade, score: typed !== null && Number.isFinite(typed) ? typed : null }, new Date());
      if (!created) {
        setProblem("Indique la note obtenue pour créer la note de cette épreuve.");
        return;
      }
      saveGrades([...grades, created]);
      gradeId = created.id;
    }
    const saved = questionsFromAttempts(gradeId, attempts, errors);
    const questions = saved.length > 0 ? mergeWithSaved(value.questions, saved) : value.questions;
    writeFlag(DEBRIEF_DRAFT_KEY, JSON.stringify({ gradeId, ai: true, questions, notes: { summary: value.summary, uncertainties: value.uncertainties, warnings: value.warnings } }));
    onOpen(gradeId);
  }

  const value = result?.ok ? result.value : null;
  const missed = value ? value.questions.filter((question) => question.outcome !== "réussie").length : 0;

  return (
    <Section variant="panel" title="Importer un débrief IA" description="Fais analyser ta copie par ChatGPT ou Claude, colle sa réponse : tu vérifies tout avant que ça n'entre dans ton historique.">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={copyPrompt}>
          <ClipboardCopy size={14} aria-hidden /> Copier la consigne pour l&apos;IA
        </Button>
        {copied === "ok" && <span className="t-meta text-2xs">Copiée — colle-la dans la conversation, avec ta copie.</span>}
        {copied === "fail" && <span role="alert" className="text-2xs font-semibold text-rose-300">Copie impossible : autorise le presse-papiers.</span>}
      </div>
      <label className="mt-4 block">
        <span className="t-label mb-1.5 block">Réponse de l&apos;IA (JSON)</span>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setAnalysed(false);
            setProblem(null);
          }}
          rows={6}
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-inset p-3 font-mono text-[0.8125rem] text-ink"
          placeholder='{ "matiere": "maths", "titre": "DS 3", "date": "2026-10-10", "questions": [ … ] }'
        />
      </label>
      <Button className="mt-3" size="sm" onClick={() => setAnalysed(true)} disabled={!text.trim()}>
        <FileInput size={14} aria-hidden /> Vérifier
      </Button>

      {result && !result.ok && (
        <ul role="alert" className="mt-4 list-disc space-y-1 pl-5 text-[0.875rem] font-semibold text-rose-300">
          {result.errors.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}

      {value && (
        <div className="mt-5 space-y-4 text-[0.875rem] leading-relaxed text-muted">
          <p className="text-[0.9375rem] font-semibold text-ink">
            {value.grade.title} · {value.grade.subject} · {GRADE_KIND_META[value.grade.kind].short} · {value.grade.date}
          </p>
          {value.summary && <p>{value.summary}</p>}
          <p>
            {value.questions.length} question{value.questions.length > 1 ? "s" : ""}, {missed} à reprendre.
            {value.toConfirm.length > 0 && <> Cause à trancher par toi : {value.toConfirm.join(", ")}.</>}
          </p>
          {value.uncertainties.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Doutes de l&apos;IA</p>
              <ul className="list-disc pl-5">
                {value.uncertainties.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          )}
          {value.warnings.length > 0 && (
            <div>
              <p className="font-semibold text-ink">À vérifier</p>
              <ul className="list-disc pl-5">
                {value.warnings.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          )}
          {existing ? (
            <p>
              Cette copie correspond à ta note « {existing.title || GRADE_KIND_META[existing.kind].label} »
              {typeof existing.score === "number" ? ` (${formatAverage(existing.score)}/${formatAverage(existing.maxScore)})` : ""} : le débrief s&apos;y rattachera, et un second envoi remplacera les questions de même libellé sans en ajouter.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <p className="basis-full">Aucune note correspondante : elle sera créée à l&apos;ouverture. Note obtenue sur {formatAverage(value.grade.maxScore)} :</p>
              <Input
                aria-label="Note obtenue"
                inputMode="decimal"
                className="w-28"
                value={score}
                placeholder={value.grade.score === null ? "" : formatAverage(value.grade.score)}
                onChange={(event) => setScore(event.target.value)}
              />
              {value.grade.score !== null && score === "" && (
                <Button variant="ghost" size="sm" onClick={() => setScore(String(value.grade.score))}>
                  Reprendre {formatAverage(value.grade.score)} (annoncée par l&apos;IA)
                </Button>
              )}
            </div>
          )}
          <Button onClick={open}>Ouvrir pour vérification</Button>
          {problem && (
            <p role="alert" className="font-semibold text-rose-300">
              {problem}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
