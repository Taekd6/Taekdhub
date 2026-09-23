import { isScored, type ScoredGrade } from "@/lib/grades";
import type { Grade } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * CALIBRATION — « est-ce que je sais ce que je sais ? »
 *
 * Avant de connaître sa note, l'élève saisit ce qu'il PENSE avoir
 * (`Grade.predictedScore`). Une fois la copie rendue, l'écart entre la
 * prédiction et le résultat mesure sa calibration : la capacité à juger son
 * propre niveau. Les élèves sont souvent mal calibrés, et plus souvent
 * surconfiants que l'inverse (Dunlosky & Rawson, 2012) — or c'est ce
 * jugement qui décide quand on s'arrête de réviser un chapitre.
 *
 * CE QUE CE MODULE CALCULE, ET RIEN DE PLUS : l'erreur moyenne SIGNÉE,
 * en points sur 20, prédiction − résultat.
 *
 *   > 0  surestimation (on pensait avoir plus)
 *   < 0  sous-estimation
 *
 * SIGNÉE, et pas absolue : une erreur absolue de 2 points ne dit pas dans
 * quel sens se tromper ; « tu te surestimes de 2 points » dit quoi corriger.
 * L'erreur absolue est donnée à côté, parce qu'une moyenne signée de 0 peut
 * cacher +4 et −4 qui se compensent.
 *
 * TROIS PRÉDICTIONS NOTÉES au minimum, par matière comme au total, avant de
 * dire quoi que ce soit : sur une ou deux épreuves, l'écart dit surtout
 * quelque chose de ces épreuves-là.
 *
 * Tout est ramené SUR 20, comme les moyennes de lib/grades.ts : une
 * prédiction de 7/10 contre un 5/10 vaut 4 points d'écart, pas 2.
 */

export const CALIBRATION_MIN_SAMPLES = 3;

/** En deçà (en points sur 20, en valeur absolue), l'écart moyen se lit « bien calibré ». */
export const CALIBRATION_TOLERANCE = 0.5;

export interface CalibrationPoint {
  id: string;
  subject: Subject;
  date: string;
  /** Prédiction ramenée sur 20. */
  predicted: number;
  /** Résultat ramené sur 20. */
  actual: number;
  /** predicted − actual, sur 20. Positif = surestimation. */
  error: number;
}

export interface CalibrationSummary {
  /** `null` = toutes matières. */
  subject: Subject | null;
  count: number;
  /** Vrai à partir de `CALIBRATION_MIN_SAMPLES` prédictions notées. */
  sufficient: boolean;
  /** Erreur moyenne signée, sur 20, arrondie au dixième — `null` tant que `sufficient` est faux. */
  meanError: number | null;
  /** Erreur moyenne absolue, sur 20 — même règle. */
  meanAbsoluteError: number | null;
}

export interface Calibration {
  overall: CalibrationSummary;
  /** Une ligne par matière ayant AU MOINS une prédiction notée, dans l'ordre des matières rencontrées. */
  bySubject: CalibrationSummary[];
  /** Du plus ancien au plus récent — la matière de la figure. */
  points: CalibrationPoint[];
}

type PredictedGrade = ScoredGrade & { predictedScore: number };

function hasPrediction(grade: Grade): grade is PredictedGrade {
  return isScored(grade) && typeof grade.predictedScore === "number" && Number.isFinite(grade.predictedScore) && grade.maxScore > 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Les seules notes qui mesurent une calibration : prédiction saisie ET résultat connu. Les notes en attente n'y sont pas. */
export function calibrationPoints(grades: Grade[]): CalibrationPoint[] {
  return grades
    .filter(hasPrediction)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((grade) => {
      const predicted = (grade.predictedScore / grade.maxScore) * 20;
      const actual = (grade.score / grade.maxScore) * 20;
      return { id: grade.id, subject: grade.subject, date: grade.date, predicted, actual, error: predicted - actual };
    });
}

function summarize(points: CalibrationPoint[], subject: Subject | null): CalibrationSummary {
  const sufficient = points.length >= CALIBRATION_MIN_SAMPLES;
  const total = (select: (point: CalibrationPoint) => number) => points.reduce((sum, point) => sum + select(point), 0) / points.length;
  return {
    subject,
    count: points.length,
    sufficient,
    meanError: sufficient ? round1(total((point) => point.error)) : null,
    meanAbsoluteError: sufficient ? round1(total((point) => Math.abs(point.error))) : null,
  };
}

export function computeCalibration(grades: Grade[]): Calibration {
  const points = calibrationPoints(grades);
  const subjects: Subject[] = [];
  for (const point of points) if (!subjects.includes(point.subject)) subjects.push(point.subject);
  return {
    overall: summarize(points, null),
    bySubject: subjects.map((subject) => summarize(points.filter((point) => point.subject === subject), subject)),
    points,
  };
}

function formatPoints(value: number): string {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

/** « en physique », « en informatique TC » — la matière en minuscule initiale, le reste tel quel. */
function inSubject(subject: Subject | null): string {
  if (!subject) return "";
  return ` en ${subject.charAt(0).toLowerCase()}${subject.slice(1)}`;
}

/**
 * La phrase — « Tu te surestimes de 2,1 pts en moyenne en physique. »
 * `null` sous le seuil d'échantillon : l'interface dit alors combien de
 * prédictions notées il manque.
 */
export function describeCalibration(summary: CalibrationSummary): string | null {
  if (!summary.sufficient || summary.meanError === null) return null;
  const where = inSubject(summary.subject);
  const gap = Math.abs(summary.meanError);
  if (gap < CALIBRATION_TOLERANCE) return `Tes prédictions sont bien calibrées${where} : écart moyen de ${formatPoints(gap)} pt.`;
  const unit = gap >= 2 ? "pts" : "pt";
  return `Tu te ${summary.meanError > 0 ? "surestimes" : "sous-estimes"} de ${formatPoints(gap)} ${unit} en moyenne${where}.`;
}
