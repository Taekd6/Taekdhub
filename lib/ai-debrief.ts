import { foldText, toSubject } from "@/lib/annales";
import { ATTEMPT_CAUSES, EXERCISE_LEVELS, type AttemptCause, type ExerciseLevel } from "@/lib/attempts";
import { QUESTION_OUTCOMES, slug, type DebriefQuestion, type QuestionOutcome } from "@/lib/debrief";
import { bestProgrammeMatch } from "@/lib/programme";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { Grade, GradeKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * DÉBRIEF PRODUIT PAR UNE IA — de la copie analysée à un brouillon que
 * l'élève valide.
 *
 * L'élève fait analyser sa copie par l'IA de son choix (ChatGPT, Claude…),
 * avec la consigne de `aiDebriefPrompt`. L'IA répond par UN objet JSON
 * (`AiDebriefInput`). TaekdHub le LIT ici — `parseAiDebrief` — et n'écrit
 * RIEN : il rend des questions que l'écran /debrief affiche pour correction.
 * Rien n'entre dans l'historique avant le clic « Enregistrer » de l'élève, et
 * l'enregistrement passe par le chemin habituel (`buildDebrief` →
 * `applyDebrief`, lib/debrief.ts) : mêmes tentatives, même carnet d'erreurs,
 * mêmes identifiants dérivés de la note et du libellé — renvoyer le même
 * débrief REMPLACE, n'ajoute pas.
 *
 * L'IA NE DEVINE PAS :
 *   — une cause dont elle n'est pas sûre porte `confiance: "incertaine"` :
 *     elle n'est PAS enregistrée (la question reste « cause non précisée »,
 *     l'élève tranche) ; la cause envisagée n'est gardée que dans la note ;
 *   — un chapitre non reconnu n'est pas rattaché au hasard : la question reste
 *     sans chapitre, signalée ;
 *   — les doutes globaux (copie illisible, corrigé absent) vont dans
 *     `incertitudes` et sont montrés tels quels.
 *
 * Le JSON vient d'ailleurs : tout est validé, borné, nettoyé des caractères
 * de contrôle. Aucun champ inconnu n'est conservé.
 *
 * Fonctions pures.
 */

export const AI_DEBRIEF_VERSION = 1;
export const AI_DEBRIEF_MAX_CHARS = 60_000;
export const AI_DEBRIEF_MAX_QUESTIONS = 60;

export type AiConfidence = "certaine" | "probable" | "incertaine";
const AI_CONFIDENCES: readonly AiConfidence[] = ["certaine", "probable", "incertaine"];

const GRADE_KINDS: readonly GradeKind[] = ["ds", "colle", "concours", "interro", "autre"];

export interface AiDebriefGrade {
  subject: Subject;
  title: string;
  kind: GradeKind;
  date: string;
  /** Note annoncée par l'IA (copie corrigée), ou `null`. */
  score: number | null;
  maxScore: number;
}

export interface AiDebriefParsed {
  grade: AiDebriefGrade;
  questions: DebriefQuestion[];
  summary: string | null;
  /** Doutes globaux de l'IA, tels qu'elle les a écrits. */
  uncertainties: string[];
  /** Ce que TaekdHub n'a pas pu retenir ou a dû décider (chapitre inconnu, confiance absente…). */
  warnings: string[];
  /** Questions dont la cause reste à trancher par l'élève. */
  toConfirm: string[];
}

export type AiDebriefResult = { ok: true; value: AiDebriefParsed } | { ok: false; errors: string[] };

/* ── Nettoyage ────────────────────────────────────────────────────── */

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function validDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Le premier objet JSON d'une réponse d'IA — avec ou sans clôture ```json, avec ou sans phrase autour. */
export function extractJson(raw: string): unknown {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("Aucun objet JSON trouvé dans le texte collé.");
  return JSON.parse(raw.slice(first, last + 1));
}

const OUTCOME_ALIASES: Record<string, QuestionOutcome> = {
  reussie: "réussie",
  reussi: "réussie",
  partielle: "partielle",
  partiel: "partielle",
  fausse: "fausse",
  faux: "fausse",
  echec: "fausse",
  "non abordee": "non abordée",
  "non abordé": "non abordée",
  abandonnee: "non abordée",
};

function toOutcome(value: unknown): QuestionOutcome | null {
  const text = foldText(clean(value, 30));
  return QUESTION_OUTCOMES.find((outcome) => foldText(outcome) === text) ?? OUTCOME_ALIASES[text] ?? null;
}

function toCause(value: unknown): AttemptCause | null {
  const text = foldText(clean(value, 30));
  return ATTEMPT_CAUSES.find((cause) => foldText(cause) === text) ?? null;
}

function toLevel(value: unknown): ExerciseLevel | null {
  const text = foldText(clean(value, 30));
  return EXERCISE_LEVELS.find((level) => level === text) ?? null;
}

function toConfidence(value: unknown): AiConfidence | null {
  const text = foldText(clean(value, 30));
  return AI_CONFIDENCES.find((entry) => entry === text) ?? null;
}

/* ── Lecture ──────────────────────────────────────────────────────── */

/** Lit et valide la réponse d'une IA. `today` (AAAA-MM-JJ) refuse une épreuve datée du futur. */
export function parseAiDebrief(raw: string, today: string): AiDebriefResult {
  if (!raw.trim()) return { ok: false, errors: ["Colle d'abord la réponse de l'IA."] };
  if (raw.length > AI_DEBRIEF_MAX_CHARS) return { ok: false, errors: [`Texte trop long (plus de ${AI_DEBRIEF_MAX_CHARS} caractères) : demande à l'IA une réponse plus courte.`] };
  let data: unknown;
  try {
    data = extractJson(raw);
  } catch (cause) {
    return { ok: false, errors: [cause instanceof SyntaxError ? "Le JSON est invalide (virgule ou guillemet manquant ?). Demande à l'IA de le corriger." : (cause as Error).message] };
  }
  const root = record(data);
  if (!root) return { ok: false, errors: ["Le texte collé n'est pas un objet JSON."] };

  const errors: string[] = [];
  const warnings: string[] = [];
  if (root.version !== undefined && root.version !== AI_DEBRIEF_VERSION) errors.push(`Version de format non reconnue (${clean(String(root.version), 10)}) : ${AI_DEBRIEF_VERSION} attendue.`);

  const subject = typeof root.matiere === "string" ? toSubject(root.matiere) : null;
  if (!subject) errors.push("« matiere » manquante ou inconnue (maths, physique, chimie, info, français, anglais).");
  const date = validDay(root.date);
  if (!date) errors.push("« date » doit être un jour réel au format AAAA-MM-JJ.");
  else if (date > today) errors.push("« date » est dans le futur : on ne débriefe qu'une épreuve passée.");
  const kind = root.type === undefined ? "ds" : GRADE_KINDS.find((entry) => entry === foldText(clean(root.type, 20)));
  if (!kind) errors.push(`« type » doit valoir : ${GRADE_KINDS.join(", ")}.`);
  const maxScore = root.bareme === undefined || root.bareme === null ? 20 : finiteNumber(root.bareme);
  if (maxScore === null || maxScore <= 0 || maxScore > 100) errors.push("« bareme » doit être un nombre entre 0 et 100.");
  const score = root.note === undefined || root.note === null ? null : finiteNumber(root.note);
  if (root.note !== undefined && root.note !== null && (score === null || score < 0 || (maxScore !== null && score > maxScore))) errors.push("« note » doit être comprise entre 0 et le barème (ou absente).");
  const title = clean(root.titre, 80);
  if (!title) errors.push("« titre » manquant (« DS 3 — réduction »).");

  const rawQuestions = Array.isArray(root.questions) ? root.questions : null;
  if (!rawQuestions || rawQuestions.length === 0) errors.push("« questions » doit être une liste non vide.");
  else if (rawQuestions.length > AI_DEBRIEF_MAX_QUESTIONS) errors.push(`Plus de ${AI_DEBRIEF_MAX_QUESTIONS} questions : découpe le débrief.`);
  if (errors.length > 0 || !subject || !date || !kind || maxScore === null || !rawQuestions) return { ok: false, errors };

  const questions: DebriefQuestion[] = [];
  const toConfirm: string[] = [];
  const seen = new Set<string>();
  rawQuestions.forEach((entry, index) => {
    const item = record(entry);
    const position = `Question ${index + 1}`;
    if (!item) {
      errors.push(`${position} : objet attendu.`);
      return;
    }
    const label = clean(item.libelle, 40);
    if (!label) {
      errors.push(`${position} : « libelle » manquant.`);
      return;
    }
    if (seen.has(slug(label))) {
      errors.push(`${label} : libellé en double (le second écraserait le premier).`);
      return;
    }
    seen.add(slug(label));
    const outcome = toOutcome(item.resultat);
    if (!outcome) {
      errors.push(`${label} : « resultat » doit valoir réussie, partielle, fausse ou non abordée.`);
      return;
    }

    // Chapitre : identifiant du programme, sinon rapprochement de titre CERTAIN, sinon rien.
    let chapterId: string | null = null;
    const chapterRaw = clean(item.chapitre, 120);
    if (chapterRaw) {
      const byId = PROGRAMME_BY_ID.get(chapterRaw);
      const match = byId ?? bestProgrammeMatch(subject, chapterRaw);
      if (match && match.subject === subject) chapterId = match.id;
      else warnings.push(`${label} : chapitre « ${chapterRaw} » non reconnu${match ? " dans cette matière" : ""} — choisis-le à la main.`);
    } else if (outcome !== "réussie") warnings.push(`${label} : aucun chapitre indiqué.`);

    let cause: AttemptCause | null = null;
    let confidence: DebriefQuestion["confidence"] = null;
    let note = clean(item.description, 200);
    const lackOfTime = item.manque_de_temps === true;
    const correction = clean(item.correction, 300) || null;
    if (outcome !== "réussie") {
      const proposed = toCause(item.cause);
      const stated = toConfidence(item.confiance);
      if (item.cause !== undefined && item.cause !== null && item.cause !== "" && !proposed) warnings.push(`${label} : cause « ${clean(item.cause, 30)} » inconnue — laissée à préciser.`);
      if (proposed && stated === "incertaine") {
        // L'IA doute : la cause n'entre PAS dans l'historique, l'élève tranche.
        toConfirm.push(label);
        note = clean(`${note}${note ? " " : ""}(Cause envisagée, non retenue : ${proposed}.)`, 200);
        confidence = "incertaine";
      } else if (proposed) {
        cause = proposed;
        if (stated === null) warnings.push(`${label} : confiance non indiquée — cause gardée comme « probable ».`);
        confidence = stated === "certaine" ? null : "probable";
      } else if (!lackOfTime) toConfirm.push(label);
    }
    const level = toLevel(item.niveau);
    const points = finiteNumber(item.points);
    const minutes = finiteNumber(item.minutes);
    questions.push({
      label,
      chapterId,
      outcome,
      cause,
      lackOfTime: outcome === "réussie" ? false : lackOfTime,
      points: points !== null && points >= 0 && points <= 200 ? points : null,
      minutes: minutes !== null && minutes >= 0 && minutes <= 600 ? Math.round(minutes) : null,
      linkedExerciseKey: null,
      note,
      level,
      confidence,
      byAi: true,
      correction: outcome === "réussie" ? null : correction,
    });
  });
  if (errors.length > 0) return { ok: false, errors };

  const uncertainties = Array.isArray(root.incertitudes) ? root.incertitudes.map((entry) => clean(entry, 200)).filter(Boolean).slice(0, 10) : [];
  return {
    ok: true,
    value: {
      grade: { subject, title, kind, date, score, maxScore },
      questions,
      summary: clean(root.resume, 500) || null,
      uncertainties,
      warnings,
      toConfirm,
    },
  };
}

/* ── Rattachement à la note ───────────────────────────────────────── */

/**
 * La note déjà saisie qui correspond à ce débrief : même matière, même jour,
 * et le même titre — ou, sans titre identique, l'UNIQUE note de ce jour et de
 * cette matière. Deux candidates : aucune (on ne devine pas). C'est ce qui
 * fait que renvoyer le même débrief retombe sur la même note.
 */
export function matchGrade(grades: readonly Grade[], target: Pick<AiDebriefGrade, "subject" | "title" | "date" | "kind">): Grade | null {
  const sameDay = grades.filter((grade) => grade.subject === target.subject && grade.date === target.date);
  const byTitle = sameDay.filter((grade) => slug(grade.title) === slug(target.title));
  if (byTitle.length === 1) return byTitle[0];
  if (byTitle.length > 1) return null;
  const sameKind = sameDay.filter((grade) => grade.kind === target.kind);
  return sameKind.length === 1 ? sameKind[0] : null;
}

/* ── La consigne à donner à l'IA ──────────────────────────────────── */

const EXAMPLE = {
  version: AI_DEBRIEF_VERSION,
  matiere: "maths",
  type: "ds",
  titre: "DS 3 — Réduction",
  date: "2026-10-10",
  note: 12.5,
  bareme: 20,
  resume: "Deux phrases sur l'ensemble de la copie.",
  incertitudes: ["La page 3 de la copie est illisible : Q5 non évaluée."],
  questions: [
    { libelle: "Q2", chapitre: "m2-reduction", resultat: "fausse", cause: "méthode", confiance: "probable", description: "N'a pas pensé à comparer dim de l'espace propre et multiplicité.", correction: "Critère : diagonalisable ⇔ somme des dim(E_λ) = n.", points: 4, minutes: 12, manque_de_temps: false, niveau: "classique" },
    { libelle: "Q3", chapitre: "m2-reduction", resultat: "fausse", cause: "calcul", confiance: "incertaine", description: "Résultat final faux, l'origine n'est pas visible sur la copie." },
    { libelle: "Q1", chapitre: "m1-derivabilite", resultat: "réussie" },
  ],
};

/** Le texte à coller dans la conversation avec l'IA, avec la liste des identifiants de chapitres. */
export function aiDebriefPrompt(): string {
  const chapters = [...new Set(PROGRAMME.map((chapter) => chapter.subject))]
    .map((subject) => `${subject} :\n${PROGRAMME.filter((chapter) => chapter.subject === subject).map((chapter) => `  ${chapter.id} = ${chapter.title}`).join("\n")}`)
    .join("\n");
  return [
    "Analyse la copie (et le corrigé, s'il est fourni) et réponds par UN SEUL objet JSON, sans texte autour, dans ce format.",
    "",
    JSON.stringify(EXAMPLE, null, 2),
    "",
    "RÈGLES",
    "- N'invente rien. Si la copie ou le corrigé est incomplet, dis-le dans « incertitudes » et n'évalue pas ce que tu ne vois pas (omets la question plutôt que de la deviner).",
    "- « resultat » : réussie | partielle | fausse | non abordée.",
    "- « cause » (seulement si la question n'est pas réussie) : cours | méthode | calcul | compréhension | démarrage | temps | rédaction. Omets-la si tu ne peux pas la déterminer.",
    "- « confiance » : certaine (visible sur la copie), probable (déduite), incertaine (hypothèse). Une cause « incertaine » ne sera PAS enregistrée : l'élève la tranchera.",
    "- « chapitre » : l'identifiant de la liste ci-dessous (ex. m2-reduction). Si aucun ne convient, omets-le.",
    "- « description » : ce qui s'est passé, en une phrase. « correction » : ce qu'il fallait faire, en une phrase.",
    "- Un libellé par question, jamais deux fois le même. Date au format AAAA-MM-JJ.",
    "- Distingue erreur de calcul, erreur de raisonnement, lacune de cours et problème de rédaction ; ne les mélange pas dans une même question.",
    "",
    "CHAPITRES",
    chapters,
  ].join("\n");
}

/* ── Renvoi d'un débrief déjà enregistré ──────────────────────────── */

/**
 * Fusionne un débrief IA avec ce qui est DÉJÀ enregistré pour la même note,
 * pour qu'un second envoi ne défasse pas le travail de l'élève :
 *   — une question de l'IA garde, quand l'IA ne le dit pas, le chapitre,
 *     l'exercice relié et la cause déjà posés ;
 *   — une question enregistrée que l'IA ne mentionne plus est CONSERVÉE
 *     (l'élève la retire lui-même s'il le veut).
 * Les libellés se comparent par `slug`, comme les identifiants de
 * `buildDebrief` : même libellé, même tentative — remplacée, jamais doublée.
 */
export function mergeWithSaved(incoming: readonly DebriefQuestion[], saved: readonly DebriefQuestion[]): DebriefQuestion[] {
  const savedBySlug = new Map(saved.map((question) => [slug(question.label), question]));
  const merged = incoming.map((question) => {
    const before = savedBySlug.get(slug(question.label));
    if (!before) return question;
    savedBySlug.delete(slug(question.label));
    const keepCause = question.cause === null && before.cause !== null && question.outcome !== "réussie";
    return {
      ...question,
      chapterId: question.chapterId ?? before.chapterId,
      linkedExerciseKey: before.linkedExerciseKey,
      level: question.level ?? before.level ?? null,
      ...(keepCause ? { cause: before.cause, confidence: before.confidence ?? null } : {}),
      correction: question.correction ?? before.correction ?? null,
    };
  });
  const incomingSlugs = new Set(incoming.map((question) => slug(question.label)));
  return [...merged, ...saved.filter((question) => !incomingSlugs.has(slug(question.label)))];
}
