"use client";

import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { SubjectAvatar } from "@/components/subject-avatar";
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
      <p className="t-label mb-2">En attente de la copie · {pending.length}</p>
      <ul className="well divide-y divide-line px-4">
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
    <Section
      variant="panel"
      title="Tes pronostics face à tes notes"
      description="Ce que tu pensais avoir en sortant de l'épreuve, face à la note rendue."
      className={className}
    >
      {!overall.sufficient ? (
        <p className="t-meta">
          {overall.count} pronostic{overall.count > 1 ? "s" : ""} confronté{overall.count > 1 ? "s" : ""} à une note sur {CALIBRATION_MIN_SAMPLES}{" "}
          nécessaires. Note ce que tu penses avoir en sortant de l&apos;épreuve, avant la copie.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sentences.length > 0 ? (
            sentences.map(({ row, text }) => (
              <p key={row.subject} className="t-subhead text-ink">
                {text}
              </p>
            ))
          ) : (
            overallText && <p className="t-subhead text-ink">{overallText}</p>
          )}
          {/* Pas de phrase « toutes matières » à côté des phrases par matière :
              une surestimation en physique et une sous-estimation en maths se
              compensent en « bien calibré », ce qui serait faux dans les deux
              cas. L'écart absolu ci-dessous dit l'ampleur globale sans ce biais. */}
          {overall.meanAbsoluteError !== null && (
            <p className="t-meta pt-1 text-[0.8125rem]">
              Écart moyen, dans un sens ou dans l&apos;autre : {formatPoints(overall.meanAbsoluteError)} pt sur {overall.count} épreuves.
              {bySubject.some((row) => !row.sufficient) && ` Les matières à moins de ${CALIBRATION_MIN_SAMPLES} pronostics notés n'ont pas encore de phrase.`}
            </p>
          )}
        </div>
      )}

      {points.length > 0 && <CalibrationChart points={points.slice(-16)} />}

      <WhyItWorks className="mt-5">
        <p>
          Juger ce qu&apos;on sait est une compétence à part entière, la métacognition, et les élèves ont tendance à se surestimer
          (Dunlosky &amp; Rawson, 2012). Or c&apos;est ce jugement qui décide quand on arrête de réviser un chapitre.
        </p>
        <p>
          Noter ton pronostic avant la copie, puis le comparer au résultat, te donne un retour chiffré sur ce jugement. Ça ne change pas ta note
          en soi : ça t&apos;aide à repérer si tu t&apos;arrêtes trop tôt, ou si tu doutes plus qu&apos;il ne faut.
        </p>
      </WhyItWorks>
    </Section>
  );
}

/**
 * ÉCART PAR ÉPREUVE — une barre par pronostic noté, de part et d'autre d'une
 * ligne zéro : vers le HAUT, à l'accent, quand on s'est surestimé ; vers le
 * BAS, en gris, quand on s'est sous-estimé ; un point quand on a vu juste.
 * Plus lisible qu'un nuage de points à cette taille : la question est « dans
 * quel sens je me trompe, et de combien », et une barre signée y répond d'un
 * regard. L'accent va à la surestimation parce que c'est elle qui coûte :
 * c'est elle qui fait arrêter de réviser trop tôt.
 */
function CalibrationChart({ points }: { points: CalibrationPoint[] }) {
  const scale = Math.max(4, ...points.map((point) => Math.ceil(Math.abs(point.error))));
  const summary = points
    .map((point) => `${point.subject}, ${point.date} : pronostic ${formatPoints(point.predicted)}, note ${formatPoints(point.actual)} sur 20`)
    .join(" ; ");

  return (
    <figure className="mt-8">
      <div className="flex gap-3">
        <div role="img" aria-label={`Écart entre pronostic et note, sur 20 : ${summary}.`} className="relative flex h-44 min-w-0 flex-1 gap-1 sm:gap-2">
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-hairline/[0.07]" />
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-hairline/[0.07]" />
          {points.map((point, index) => {
            const height = `${(Math.abs(point.error) / scale) * 50}%`;
            const over = point.error > 0;
            const side = index < points.length / 4 ? "left-0" : index >= (points.length * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div key={point.id} className="group relative min-w-0 flex-1">
                {point.error === 0 ? (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 w-full max-w-[1rem] -translate-x-1/2",
                      over ? "grow-y bottom-1/2 rounded-t-[0.75rem] bg-[rgb(var(--accent-ink-rgb))]" : "grow-y top-1/2 rounded-b-md bg-zinc-600"
                    )}
                    style={{ height, "--i": index, transformOrigin: over ? undefined : "center top" } as React.CSSProperties}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "floating pointer-events-none absolute top-0 z-10 -translate-y-full whitespace-nowrap rounded-xl px-2.5 py-1.5 text-2xs leading-tight text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                    side
                  )}
                >
                  <span className="font-bold">{point.subject}</span>
                  <span className="text-muted"> · pronostic </span>
                  <span className="font-bold tabular">{formatPoints(point.predicted)}</span>
                  <span className="text-muted"> · note </span>
                  <span className="font-bold tabular">{formatPoints(point.actual)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="t-meta relative w-8 shrink-0 text-2xs tabular" aria-hidden>
          <span className="absolute top-0 -translate-y-1/2">+{formatPoints(scale)}</span>
          <span className="absolute top-1/2 -translate-y-1/2">0</span>
          <span className="absolute bottom-0 translate-y-1/2">−{formatPoints(scale)}</span>
        </div>
      </div>
      <div className="mr-11 mt-2 flex gap-1 sm:gap-2" aria-hidden>
        {points.map((point) => (
          <span key={point.id} className="t-meta min-w-0 flex-1 truncate text-center text-2xs font-semibold">
            {subjectMeta[point.subject].short}
          </span>
        ))}
      </div>
      <figcaption className="t-meta mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--accent-ink-rgb))]" /> surestimé
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-zinc-600" /> sous-estimé
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2 w-2 rounded-full bg-ink" /> vu juste
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
