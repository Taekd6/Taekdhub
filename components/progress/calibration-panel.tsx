"use client";

import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { WhyItWorks } from "@/components/checkin/why-it-works";
import { CALIBRATION_MIN_SAMPLES, computeCalibration, describeCalibration, type CalibrationPoint } from "@/lib/calibration";
import { formatPrediction, GRADE_KIND_META, isPending, removeGrade, resolveGrade } from "@/lib/grades";
import { subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Grade } from "@/lib/storage";

/**
 * CALIBRATION DES NOTES — deux blocs pour la section « Tes notes ».
 *
 *  — `PendingGrades` : les épreuves passées dont la copie n'est pas rendue.
 *    L'élève y a noté ce qu'il PENSE avoir ; il y complète la vraie note le
 *    jour venu. Une note en attente n'entre dans aucune moyenne (voir
 *    lib/grades.ts#isScored).
 *  — `CalibrationPanel` : l'écart entre ces pronostics et les résultats,
 *    en points sur 20, par matière — voir lib/calibration.ts.
 *
 * Tous deux reçoivent `grades` et `onSave` de `GradesSection`, qui les tient
 * elle-même de la page : aucun n'appelle le hook.
 */

export function PendingGrades({ grades, onSave, className }: { grades: Grade[]; onSave: (grades: Grade[]) => void; className?: string }) {
  const pending = useMemo(() => grades.filter(isPending).sort((a, b) => b.date.localeCompare(a.date)), [grades]);
  if (pending.length === 0) return null;
  return (
    <div className={className}>
      <p className="t-label mb-2">En attente de la copie</p>
      <ul className="divide-y divide-line border-y border-line">
        {pending.map((grade) => (
          <PendingRow
            key={grade.id}
            grade={grade}
            onResolve={(score) => onSave(resolveGrade(grades, grade.id, score))}
            onRemove={() => onSave(removeGrade(grades, grade.id))}
          />
        ))}
      </ul>
    </div>
  );
}

function PendingRow({ grade, onResolve, onRemove }: { grade: Grade; onResolve: (score: number) => void; onRemove: () => void }) {
  const [value, setValue] = useState("");
  const parsed = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const label = grade.title || GRADE_KIND_META[grade.kind].label;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <SubjectAvatar subject={grade.subject} size="sm" />
      {/* `basis-40` : sous ~360 px, la saisie passe à la ligne plutôt que
          d'écraser la date et le pronostic en « 21 septembre · pro… ». */}
      <span className="min-w-0 flex-1 basis-40">
        <span className="block truncate text-sm text-ink">{label}</span>
        <span className="t-meta mt-0.5 block truncate text-2xs">
          {longDate.format(new Date(`${grade.date}T00:00:00`))} · pronostic {formatPrediction(grade) ?? "—"}
        </span>
      </span>
      <form
        className="ml-auto flex shrink-0 items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onResolve(parsed);
        }}
      >
        <Input
          aria-label={`Note obtenue pour ${label}`}
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Note"
          className="w-16 text-center"
        />
        <span className="t-meta">/{grade.maxScore}</span>
        <Button type="submit" size="icon" variant="secondary" disabled={!valid} aria-label={`Enregistrer la note de ${label}`}>
          <Check size={14} />
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Supprimer ${label}`} onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </form>
    </li>
  );
}

/**
 * La phrase par matière, puis la figure. Rien tant qu'aucune note n'a de
 * pronostic ; un compte de ce qui manque tant que le seuil n'est pas atteint.
 */
export function CalibrationPanel({ grades, className }: { grades: Grade[]; className?: string }) {
  const calibration = useMemo(() => computeCalibration(grades), [grades]);
  const hasAnyPrediction = grades.some((grade) => typeof grade.predictedScore === "number");
  if (!hasAnyPrediction) return null;

  const { overall, bySubject, points } = calibration;
  const sentences = bySubject.map((row) => ({ row, text: describeCalibration(row) })).filter((entry) => entry.text !== null);
  const overallText = describeCalibration(overall);

  return (
    <div className={cn("space-y-3", className)}>
      <p className="t-label">Tes pronostics face à tes notes</p>

      {!overall.sufficient ? (
        <p className="t-meta">
          {overall.count} pronostic{overall.count > 1 ? "s" : ""} confronté{overall.count > 1 ? "s" : ""} à une note sur {CALIBRATION_MIN_SAMPLES}{" "}
          nécessaires. Note ce que tu penses avoir en sortant de l&apos;épreuve, avant la copie.
        </p>
      ) : (
        <div className="space-y-1">
          {sentences.length > 0 ? (
            sentences.map(({ row, text }) => (
              <p key={row.subject} className="t-body">
                {text}
              </p>
            ))
          ) : (
            overallText && <p className="t-body">{overallText}</p>
          )}
          {/* Pas de phrase « toutes matières » à côté des phrases par matière :
              une surestimation en physique et une sous-estimation en maths se
              compensent en « bien calibré », ce qui serait faux dans les deux
              cas. L'écart absolu ci-dessous dit l'ampleur globale sans ce biais. */}
          {overall.meanAbsoluteError !== null && (
            <p className="t-meta text-2xs">
              Écart moyen, dans un sens ou dans l&apos;autre : {formatPoints(overall.meanAbsoluteError)} pt sur {overall.count} épreuves.
              {bySubject.some((row) => !row.sufficient) && ` Les matières à moins de ${CALIBRATION_MIN_SAMPLES} pronostics notés n'ont pas encore de phrase.`}
            </p>
          )}
        </div>
      )}

      {points.length > 0 && <CalibrationChart points={points.slice(-16)} />}

      <WhyItWorks>
        <p>
          Juger ce qu&apos;on sait est une compétence à part entière, la métacognition, et les élèves ont tendance à se surestimer
          (Dunlosky &amp; Rawson, 2012). Or c&apos;est ce jugement qui décide quand on arrête de réviser un chapitre.
        </p>
        <p>
          Noter ton pronostic avant la copie, puis le comparer au résultat, te donne un retour chiffré sur ce jugement. Ça ne change pas ta note
          en soi : ça t&apos;aide à repérer si tu t&apos;arrêtes trop tôt, ou si tu doutes plus qu&apos;il ne faut.
        </p>
      </WhyItWorks>
    </div>
  );
}

/**
 * ÉCART PAR ÉPREUVE — une barre par pronostic noté, de part et d'autre d'une
 * ligne zéro : vers le haut (ambre) quand on s'est surestimé, vers le bas
 * (bleu) quand on s'est sous-estimé. Plus lisible qu'un nuage de points à
 * cette taille : la question est « dans quel sens je me trompe, et de
 * combien », et une barre signée y répond d'un regard.
 */
function CalibrationChart({ points }: { points: CalibrationPoint[] }) {
  const scale = Math.max(4, ...points.map((point) => Math.abs(point.error)));
  const summary = points
    .map((point) => `${point.subject}, ${point.date} : pronostic ${formatPoints(point.predicted)}, note ${formatPoints(point.actual)} sur 20`)
    .join(" ; ");

  return (
    <figure>
      <div className="flex gap-2">
        <div className="t-meta flex w-10 shrink-0 flex-col justify-between text-right text-2xs tabular" aria-hidden>
          <span>+{formatPoints(scale)}</span>
          <span>0</span>
          <span>−{formatPoints(scale)}</span>
        </div>
        <div role="img" aria-label={`Écart entre pronostic et note, sur 20 : ${summary}.`} className="relative flex h-28 min-w-0 flex-1 gap-1">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
          {points.map((point) => {
            const height = `${(Math.abs(point.error) / scale) * 50}%`;
            const over = point.error > 0;
            return (
              <div key={point.id} className="relative min-w-0 flex-1" title={`${point.subject} — pronostic ${formatPoints(point.predicted)}, note ${formatPoints(point.actual)} /20`}>
                {point.error === 0 ? (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400" />
                ) : (
                  <span
                    aria-hidden
                    className={over ? "absolute bottom-1/2 left-1/2 w-2.5 -translate-x-1/2 rounded-t-sm bg-amber-400/80" : "absolute left-1/2 top-1/2 w-2.5 -translate-x-1/2 rounded-b-sm bg-sky-400/80"}
                    style={{ height }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 pl-12" aria-hidden>
        {points.map((point) => (
          <span key={point.id} className="t-meta min-w-0 flex-1 truncate text-center text-2xs">
            {subjectMeta[point.subject].short}
          </span>
        ))}
      </div>
      <figcaption className="t-meta mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-2 rounded-sm bg-amber-400/80" /> surestimé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-2 rounded-sm bg-sky-400/80" /> sous-estimé
        </span>
        <span>points sur 20, du plus ancien au plus récent</span>
      </figcaption>
    </figure>
  );
}

function formatPoints(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
