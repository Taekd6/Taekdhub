"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { LineChart } from "@/components/ui/chart";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { Insufficient } from "@/components/progress/insufficient";
import { computeGradesByKind, computeGradesBySubject } from "@/lib/tracking";
import { computeGradeTrend, createGrade, formatAverage, formatGrade, GRADE_KIND_META, gradedSubjects, normalizedScore, removeGrade } from "@/lib/grades";
import { describeConfidence, withSign } from "@/lib/analytics/trend";
import { subjectMeta, subjects } from "@/lib/study";
import { GRADE_KINDS, type Grade, type GradeKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * TES RÉSULTATS — la seule mesure que TaekdHub ne produit pas lui-même.
 *
 * Tout le reste de la page observe ce que l'élève fait DANS l'application ;
 * une note de DS vient d'un professeur, et c'est ce qui la rend précieuse :
 * c'est le seul regard extérieur sur le travail.
 *
 * SAISIE EN UNE LIGNE. Une note se note entre deux cours, comme un DM : si
 * elle demande un formulaire, elle ne sera jamais saisie, et toute la
 * section restera vide.
 *
 * AUCUNE CAUSALITÉ N'EST AFFIRMÉE ici ni ailleurs. TaekdHub peut montrer que
 * le volume de travail et les notes ont progressé sur la même période ; il
 * ne peut pas montrer que l'un a causé l'autre, et le laisser entendre
 * serait faux — voir `WorkAndResults` plus bas, qui s'en tient à la
 * concomitance.
 */
export function GradesSection({ grades, onSave }: { grades: Grade[]; onSave: (grades: Grade[]) => void }) {
  const [subject, setSubject] = useState<Subject | "toutes">("toutes");
  /*
   * FILTRE PAR NATURE, distinct du filtre par matière.
   *
   * Un DS, une khôlle et un DM ne se passent pas dans les mêmes conditions :
   * une courbe qui les enchaîne dans l'ordre chronologique fait alterner des
   * exigences incomparables, et sa « tendance » ne veut rien dire. Le filtre
   * rend la comparaison possible ; c'est lui qui fait le travail, pas une
   * moyenne globale qu'on n'affiche donc plus comme un verdict.
   */
  const [kind, setKind] = useState<GradeKind | "toutes">("toutes");
  const byKind = useMemo(() => computeGradesByKind(grades), [grades]);
  const kindScope = kind !== "toutes" && byKind.some((entry) => entry.kind === kind) ? kind : null;
  const scopedByKind = useMemo(
    () => (kindScope ? grades.filter((grade) => grade.kind === kindScope) : grades),
    [grades, kindScope]
  );
  const available = useMemo(() => gradedSubjects(scopedByKind), [scopedByKind]);
  const scope = subject !== "toutes" && available.includes(subject) ? subject : null;
  const result = useMemo(() => computeGradeTrend(scopedByKind, scope), [scopedByKind, scope]);
  /** Une ligne par matière : dernière note, moyenne, tendance — bornée à la nature choisie. */
  const bySubject = useMemo(() => computeGradesBySubject(scopedByKind), [scopedByKind]);

  return (
    <Section
      label="Tes résultats"
      title="Tes notes"
      description="Saisies par toi : c'est le seul regard extérieur sur ton travail. Les barèmes sont ramenés sur 20 pour être comparables, en moyenne simple."
    >
      <GradeForm onCreate={(grade) => onSave([grade, ...grades])} />

      {grades.length === 0 ? (
        <Insufficient
          className="mt-6"
          what="Aucune note enregistrée."
          how="Ajoute un DS ou une interro ci-dessus : deux notes suffisent à voir une variation, quatre à dégager une tendance."
        />
      ) : (
        <div className="mt-7 space-y-5">
          {byKind.length > 1 && (
            <SegmentedControl
              size="sm"
              ariaLabel="Nature d'épreuve affichée"
              value={kind}
              onChange={(value) => setKind(value as GradeKind | "toutes")}
              options={[
                { value: "toutes" as const, label: "Toutes" },
                ...byKind.map((entry) => ({ value: entry.kind, label: GRADE_KIND_META[entry.kind].short })),
              ]}
            />
          )}

          {available.length > 1 && (
            <SegmentedControl
              size="sm"
              ariaLabel="Matière affichée"
              value={subject}
              onChange={setSubject}
              options={[{ value: "toutes" as const, label: "Toutes" }, ...available.map((entry) => ({ value: entry, label: subjectMeta[entry].short }))]}
            />
          )}

          {result.grades.length >= 2 ? (
            <>
              <LineChart
                points={result.grades.map((grade) => ({ label: shortDate.format(new Date(`${grade.date}T00:00:00`)), value: normalizedScore(grade) }))}
                min={0}
                max={20}
                formatValue={(value) => String(Math.round(value))}
                ariaLabel={`Notes ${scope ?? "toutes matières"} : ${result.grades
                  .map((grade) => `${shortDate.format(new Date(`${grade.date}T00:00:00`))} ${formatGrade(grade)}`)
                  .join(", ")}.`}
              />
              <p className="t-body">
                Moyenne <span className="font-medium">{formatAverage(result.stats.average ?? 0)}/20</span> sur {result.stats.count} note
                {result.stats.count > 1 ? "s" : ""}
                {result.trend.direction !== "insuffisant" && result.trend.delta !== null && (
                  <> · {withSign(Math.round(result.trend.delta * 10) / 10, " pt")} de la première à la dernière</>
                )}
                .
              </p>
              {result.trend.direction !== "insuffisant" && (
                <p className="t-meta">
                  Tes notes sont {TREND_WORDS[result.trend.direction]}.
                  {describeConfidence(result.trend) && <> {describeConfidence(result.trend)}</>}
                </p>
              )}
            </>
          ) : (
            <Insufficient
              what={`${result.stats.count} note enregistrée${scope ? ` en ${scope}` : ""} — pas encore de courbe.`}
              how="Il en faut au moins deux pour voir une variation."
            />
          )}

          {/* UNE LIGNE PAR MATIÈRE : dernière note, moyenne, tendance. Le
              tableau que la liste chronologique ne remplace pas — elle dit
              « quand », il dit « où j'en suis ». */}
          {bySubject.length > 1 && (
            <div>
              <p className="t-label mb-2">Par matière{kindScope ? ` · ${GRADE_KIND_META[kindScope].label}` : ""}</p>
              <ul className="divide-y divide-line border-y border-line">
                {bySubject.map((row) => (
                  <li key={row.subject} className="flex items-center gap-3 py-2.5">
                    <SubjectAvatar subject={row.subject} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.subject}</span>
                    <span className="tabular w-14 shrink-0 whitespace-nowrap text-right text-sm text-ink">
                      {row.stats.latest ? formatGrade(row.stats.latest) : "—"}
                    </span>
                    <span className="t-meta tabular w-16 shrink-0 whitespace-nowrap text-right text-2xs">
                      moy. {row.stats.average !== null ? formatAverage(row.stats.average) : "—"}
                    </span>
                    {/* « — » et non une flèche quand une seule note existe :
                        deux points font une variation, pas une tendance. */}
                    <span className="w-6 shrink-0 text-right text-sm">
                      {row.trend.direction === "insuffisant"
                        ? "—"
                        : row.trend.direction === "hausse"
                          ? "↑"
                          : row.trend.direction === "baisse"
                            ? "↓"
                            : "→"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="divide-y divide-line border-y border-line">
            {[...result.grades].reverse().map((grade) => (
              <li key={grade.id} className="flex items-center gap-3 py-2.5">
                <SubjectAvatar subject={grade.subject} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{grade.title || GRADE_KIND_META[grade.kind].label}</span>
                  <span className="t-meta mt-0.5 block truncate text-2xs">
                    {GRADE_KIND_META[grade.kind].short} · {longDate.format(new Date(`${grade.date}T00:00:00`))}
                  </span>
                </span>
                <span className="t-figure-sm tabular shrink-0 whitespace-nowrap">{formatGrade(grade)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Supprimer la note ${formatGrade(grade)} du ${grade.date}`}
                  onClick={() => onSave(removeGrade(grades, grade.id))}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/** Saisie d'une note — tout tient sur deux rangées, et seul le score est obligatoire. */
function GradeForm({ onCreate }: { onCreate: (grade: Grade) => void }) {
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [kind, setKind] = useState<GradeKind>("ds");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState(20);

  const parsed = Number(score.replace(",", "."));
  const valid = score.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onCreate(createGrade({ subject, title, kind, date, score: parsed, maxScore }));
    setTitle("");
    setScore("");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label className="min-w-0 flex-1 basis-[10rem]">
        <span className="sr-only">Intitulé de l&apos;épreuve</span>
        <Input aria-label="Intitulé de l'épreuve" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="DS n°2, chapitre 3…" />
      </label>
      <label className="flex shrink-0 items-center gap-1">
        <span className="sr-only">Note obtenue</span>
        <Input
          aria-label="Note obtenue"
          inputMode="decimal"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          placeholder="14"
          className="w-16 text-center"
        />
        <span className="t-meta">/</span>
        <Input
          aria-label="Barème"
          type="number"
          min={1}
          value={maxScore}
          onChange={(event) => setMaxScore(Math.max(1, Math.round(Number(event.target.value) || 20)))}
          /* `w-14` coupait « 20 » en « 2C » : un champ numérique réserve la
             place de ses flèches natives en plus de son contenu. */
          className="w-[4.5rem] text-center"
        />
      </label>
      <Button type="submit" disabled={!valid} className="shrink-0">
        <Plus size={15} /> Ajouter
      </Button>

      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <label className="min-w-0">
          <span className="sr-only">Matière</span>
          <Select aria-label="Matière de l'épreuve" value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
            {subjects.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Nature de l&apos;épreuve</span>
          <Select aria-label="Nature de l'épreuve" value={kind} onChange={(event) => setKind(event.target.value as GradeKind)}>
            {GRADE_KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {GRADE_KIND_META[entry].label}
              </option>
            ))}
          </Select>
        </label>
        <label className="col-span-2 min-w-0 sm:col-span-1">
          <span className="sr-only">Date de l&apos;épreuve</span>
          <Input aria-label="Date de l'épreuve" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
    </form>
  );
}

const TREND_WORDS: Record<"hausse" | "baisse" | "stable", string> = {
  hausse: "en hausse",
  baisse: "en baisse",
  stable: "stables",
};

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
