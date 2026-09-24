"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { FilterPills } from "@/components/ui/pills";
import { cn } from "@/lib/cn";
import { LineChart } from "@/components/ui/chart";
import { SubjectAvatar } from "@/components/subject-avatar";
import { Insufficient } from "@/components/progress/insufficient";
import { GradeErrorsLink } from "@/components/errors/error-links";
import { computeGradesByKind, computeGradesBySubject } from "@/lib/tracking";
import { computeGradeTrend, createGrade, formatAverage, formatGrade, formatPrediction, GRADE_KIND_META, gradedSubjects, isScored, normalizedScore, removeGrade } from "@/lib/grades";
import { CalibrationPanel, PendingGrades } from "@/components/progress/calibration-panel"; // calibration des notes
import { describeConfidence, withSign } from "@/lib/analytics/trend";
import { subjects } from "@/lib/study";
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
  /** Dernière note ajoutée — porte le lien « Noter les erreurs de ce DS » (carnet d'erreurs). */
  const [justAdded, setJustAdded] = useState<Grade | null>(null);
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

  /*
   * QUATRE TUILES, dans l'ordre d'un retour de copie : on NOTE (saisie et
   * épreuves en attente), on REGARDE la courbe, on COMPARE matière par
   * matière et épreuve par épreuve, puis on confronte ses PRONOSTICS. Tout
   * tenait auparavant dans une seule section de 2 000 px, où la courbe se
   * perdait entre le formulaire et la liste.
   */
  return (
    <div className="space-y-5">
      <Section
        variant="panel"
        label="Tes résultats"
        title="Ajouter une note"
        description="Saisies par toi : c'est le seul regard extérieur sur ton travail. Un pronostic seul crée l'épreuve « en attente » de la copie."
      >
        <GradeForm
          onCreate={(grade) => {
            onSave([grade, ...grades]);
            setJustAdded(grade);
          }}
        />
        {/* Carnet d'erreurs : la copie est encore sous les yeux, c'est le moment. */}
        {justAdded && grades.some((grade) => grade.id === justAdded.id) && <GradeErrorsLink grade={justAdded} className="mt-3" />}

        {/* ── Calibration : épreuves en attente de la copie ── */}
        <PendingGrades grades={grades} onSave={onSave} className="mt-7" />
      </Section>

      {!grades.some(isScored) ? (
        <Insufficient
          what="Aucune note enregistrée."
          how="Ajoute un DS ou une interro ci-dessus : deux notes suffisent à voir une variation, quatre à dégager une tendance."
        />
      ) : (
        <>
          <Section
            variant="panel"
            title="Ta courbe"
            description="Les barèmes sont ramenés sur 20 pour être comparables, en moyenne simple. Survole un point pour l'épreuve."
          >
            <div className="space-y-3">
              {byKind.length > 1 && (
                <FilterPills
                  ariaLabel="Nature d'épreuve affichée"
                  value={kind}
                  onChange={(value) => setKind(value as GradeKind | "toutes")}
                  options={[
                    { value: "toutes" as const, label: "Toutes les épreuves" },
                    ...byKind.map((entry) => ({ value: entry.kind, label: GRADE_KIND_META[entry.kind].label })),
                  ]}
                />
              )}
              {available.length > 1 && (
                <FilterPills
                  ariaLabel="Matière affichée"
                  value={subject}
                  onChange={setSubject}
                  options={[{ value: "toutes" as const, label: "Toutes les matières" }, ...available.map((entry) => ({ value: entry, label: entry }))]}
                />
              )}
            </div>

            {result.grades.length >= 2 ? (
              <div className="mt-8">
                <div className="mb-6 flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="t-label">Moyenne</p>
                    <p className="t-figure-lg mt-1">
                      {formatAverage(result.stats.average ?? 0)}
                      <span className="text-2xl font-semibold text-subtle"> /20</span>
                    </p>
                  </div>
                  <p className="t-meta pb-1.5">
                    sur {result.stats.count} note{result.stats.count > 1 ? "s" : ""}
                    {result.trend.direction !== "insuffisant" && result.trend.delta !== null && (
                      <> · {withSign(Math.round(result.trend.delta * 10) / 10, " pt")} de la première à la dernière</>
                    )}
                    {result.trend.direction !== "insuffisant" && (
                      <>
                        <br />
                        Tes notes sont {TREND_WORDS[result.trend.direction]}.
                        {describeConfidence(result.trend) && <> {describeConfidence(result.trend)}</>}
                      </>
                    )}
                  </p>
                </div>
                <LineChart
                  points={result.grades.map((grade) => ({
                    label: `${grade.title || GRADE_KIND_META[grade.kind].label} · ${shortDate.format(new Date(`${grade.date}T00:00:00`))}`,
                    value: normalizedScore(grade),
                  }))}
                  min={0}
                  max={20}
                  formatValue={(value) => formatAverage(value)}
                  ariaLabel={`Notes ${scope ?? "toutes matières"} : ${result.grades
                    .map((grade) => `${shortDate.format(new Date(`${grade.date}T00:00:00`))} ${formatGrade(grade)}`)
                    .join(", ")}.`}
                />
              </div>
            ) : (
              <Insufficient
                className="mt-6"
                what={`${result.stats.count} note enregistrée${scope ? ` en ${scope}` : ""} — pas encore de courbe.`}
                how="Il en faut au moins deux pour voir une variation."
              />
            )}
          </Section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* UNE LIGNE PAR MATIÈRE : dernière note, moyenne, tendance. Le
                tableau que la liste chronologique ne remplace pas — elle dit
                « quand », il dit « où j'en suis ». */}
            {bySubject.length > 1 && (
              <Section variant="panel" title="Par matière" description={kindScope ? GRADE_KIND_META[kindScope].label : "Toutes épreuves confondues."}>
                <ul className="-mx-2 space-y-0.5">
                  {bySubject.map((row) => (
                    <li key={row.subject} className="row-hover flex items-center gap-3 rounded-xl px-2 py-2.5">
                      <SubjectAvatar subject={row.subject} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{row.subject}</span>
                        <span className="t-meta tabular block text-2xs">
                          moy. {row.stats.average !== null ? formatAverage(row.stats.average) : "—"}
                        </span>
                      </span>
                      <span className="tabular shrink-0 whitespace-nowrap text-right text-[0.9375rem] font-bold text-ink">
                        {row.stats.latest ? formatGrade(row.stats.latest) : "—"}
                      </span>
                      {/* « — » et non une flèche quand une seule note existe :
                          deux points font une variation, pas une tendance. */}
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold",
                          row.trend.direction === "hausse" ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted"
                        )}
                        role="img"
                        aria-label={row.trend.direction === "insuffisant" ? "tendance non mesurable" : `tendance ${TREND_WORDS[row.trend.direction]}`}
                      >
                        {row.trend.direction === "insuffisant"
                          ? "–"
                          : row.trend.direction === "hausse"
                            ? "↑"
                            : row.trend.direction === "baisse"
                              ? "↓"
                              : "→"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section
              variant="panel"
              title="Toutes tes épreuves"
              description={`${result.grades.length} note${result.grades.length > 1 ? "s" : ""}, de la plus récente à la plus ancienne.`}
              className={bySubject.length > 1 ? undefined : "lg:col-span-2"}
            >
              <ul className="-mx-2 space-y-0.5">
                {[...result.grades].reverse().map((grade) => (
                  <li key={grade.id} className="row-hover flex items-center gap-3 rounded-xl py-2 pl-2">
                    <SubjectAvatar subject={grade.subject} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-semibold text-ink">{grade.title || GRADE_KIND_META[grade.kind].label}</span>
                      <span className="t-meta mt-0.5 block truncate text-2xs">
                        {GRADE_KIND_META[grade.kind].short} · {longDate.format(new Date(`${grade.date}T00:00:00`))}
                        {formatPrediction(grade) && <> · pronostic {formatPrediction(grade)}</>}
                      </span>
                    </span>
                    <span className="t-figure-sm tabular shrink-0 whitespace-nowrap text-xl">{formatGrade(grade)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Supprimer la note ${formatGrade(grade)} du ${grade.date}`}
                      onClick={() => onSave(removeGrade(grades, grade.id))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </>
      )}

      {/* ── Calibration : pronostics face aux notes ── */}
      <CalibrationPanel grades={grades} />
    </div>
  );
}

/**
 * Saisie d'une note — tout tient sur deux rangées.
 *
 * Il faut une note OU un pronostic. Avec un pronostic seul, la note est
 * créée EN ATTENTE : on la complète le jour où la copie est rendue (voir
 * components/progress/calibration-panel.tsx#PendingGrades).
 */
function GradeForm({ onCreate }: { onCreate: (grade: Grade) => void }) {
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [kind, setKind] = useState<GradeKind>("ds");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState(20);
  const [prediction, setPrediction] = useState("");

  const parsed = parseScore(score);
  const predicted = parseScore(prediction);
  const valid = parsed !== null || predicted !== null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const grade = createGrade({ subject, title, kind, date, score: parsed, maxScore, predictedScore: predicted });
    if (!grade) return;
    onCreate(grade);
    setTitle("");
    setScore("");
    setPrediction("");
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
        <Plus size={15} /> {parsed === null && predicted !== null ? "En attente" : "Ajouter"}
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
        {/* Calibration : ce que tu penses avoir, AVANT la copie. */}
        <label className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
          <span className="t-meta shrink-0 text-2xs">Pronostic</span>
          <Input
            aria-label="Pronostic, avant la copie"
            inputMode="decimal"
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
            placeholder="facultatif"
            className="w-24 text-center"
          />
          <span className="t-meta">/{maxScore}</span>
        </label>
      </div>
    </form>
  );
}

/** Champ numérique à la française (« 11,5 ») — `null` si vide ou illisible. */
function parseScore(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const TREND_WORDS: Record<"hausse" | "baisse" | "stable", string> = {
  hausse: "en hausse",
  baisse: "en baisse",
  stable: "stables",
};

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
