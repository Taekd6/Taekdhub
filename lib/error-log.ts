import { dayKey, subjects } from "@/lib/study";
import { REVIEW_TEXT_MAX, type NewReviewItemInput } from "@/lib/review-items";
import { ERROR_SOURCES, ERROR_TYPES, type ErrorEntry, type ErrorSource, type ErrorType, type GradeKind, type ReviewItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * CARNET D'ERREURS — noter une erreur en dix secondes, et voir ce qui revient.
 *
 * Modèle pur (création, suppression, comptes, tendance, constat) : la
 * persistance vit dans lib/storage.ts (`ErrorEntry`, `localData.errors`), la
 * réactivité dans hooks/use-prepahub-data.ts — même contrat que
 * lib/review-items.ts et lib/grades.ts. Aucune dépendance à localStorage, à
 * React ni au DOM.
 *
 * POURQUOI CLASSER. Une liste d'erreurs non classées se relit mal : on y voit
 * vingt cas particuliers. Classées en six genres, les mêmes vingt lignes
 * disent « la moitié, c'est du calcul » — et ça, c'est une chose qu'on peut
 * travailler. Le type est donc le seul champ que le carnet COMPTE ; tout le
 * reste (description, bonne idée) sert à relire.
 *
 * CE QUE LES CHIFFRES NE DISENT PAS. Le carnet compte des erreurs NOTÉES, pas
 * des erreurs COMMISES. Une hausse d'un mois sur l'autre peut vouloir dire
 * « tu te trompes plus » comme « tu notes plus » (ou « il y a eu trois DS ce
 * mois-ci »). Aucune phrase de ce module n'affirme le premier sens : on dit
 * « tu as noté », jamais « tu fais ». Et sous `ERROR_INSIGHT_MIN` entrées, on
 * ne dit rien du tout — sur trois erreurs, « ton erreur n°1 » est du bruit
 * présenté comme un diagnostic.
 */

/** Au-delà, ce n'est plus une ligne mais un paragraphe — même borne que le carnet « À revoir », pour la même raison. */
export const ERROR_TEXT_MAX = 200;

/**
 * En dessous de ce nombre d'erreurs notées sur la période (et dans la
 * portée demandée), aucun constat n'est formulé. Cinq, parce qu'avec moins,
 * un type « dominant » peut n'être qu'une seule erreur d'avance — le hasard
 * d'une colle, pas une tendance.
 */
export const ERROR_INSIGHT_MIN = 5;

/** « Ce mois-ci » = les 30 derniers jours glissants, pas le mois calendaire : le 2 du mois, le mois calendaire serait presque vide. */
export const ERROR_PERIOD_DAYS = 30;

/**
 * Les six genres d'erreur. `hint` : l'explication d'une ligne affichée sous
 * le sélecteur — sans elle, « méthode » et « cours » se confondent. `advice` :
 * ce qu'on peut faire quand ce genre domine. Des conseils de travail
 * ordinaires, pas des promesses : aucun ne garantit qu'il fera baisser le
 * compte.
 */
export const ERROR_TYPE_META: Record<ErrorType, { label: string; hint: string; advice: string }> = {
  calcul: {
    label: "Calcul",
    hint: "Signe, algèbre, étourderie — la méthode était bonne.",
    advice:
      "Refais les calculs sans calculatrice, puis vérifie chaque résultat : homogénéité, signe attendu, un cas particulier (n = 0, x = 1…).",
  },
  méthode: {
    label: "Méthode",
    hint: "Je ne savais pas par où commencer ni quel outil prendre.",
    advice:
      "Après chaque corrigé, note l'idée de départ en une ligne (« suite récurrente → étudier f ») comme méthode dans le carnet À revoir, et relis-les avant le DS.",
  },
  cours: {
    label: "Cours",
    hint: "Il me manquait une définition ou un théorème.",
    advice:
      "Ajoute la définition ou le théorème au carnet « À revoir » (à apprendre), puis récite-le de mémoire avant de le relire.",
  },
  lecture: {
    label: "Lecture",
    hint: "J'ai mal lu l'énoncé ou oublié une hypothèse.",
    advice: "Surligne les hypothèses et ce qui est demandé avant de commencer, et relis la question juste avant de conclure.",
  },
  rédaction: {
    label: "Rédaction",
    hint: "Raisonnement juste, justification absente ou floue.",
    advice: "Nomme le théorème utilisé et vérifie ses hypothèses une par une, par écrit : c'est cette ligne qui rapporte les points.",
  },
  temps: {
    label: "Temps",
    hint: "Je n'ai pas eu le temps de finir.",
    advice:
      "Entraîne-toi chronométré, et en épreuve laisse une question bloquante après quelques minutes pour y revenir à la fin.",
  },
};

export const ERROR_SOURCE_META: Record<ErrorSource, { label: string }> = {
  colle: { label: "Colle" },
  DS: { label: "DS" },
  DM: { label: "DM" },
  exercice: { label: "Exercice" },
  "concours blanc": { label: "Concours blanc" },
  autre: { label: "Autre" },
};

/* ── Création, suppression ───────────────────────────────────────── */

/** Ramène un texte saisi à une ligne, ou `null` s'il est vide ou trop long — même règle que `sanitizeReviewText`. */
export function sanitizeErrorText(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > ERROR_TEXT_MAX) return null;
  return text;
}

export interface NewErrorInput {
  subject: Subject;
  /** "AAAA-MM-JJ" ; par défaut aujourd'hui. */
  date?: string;
  source: ErrorSource;
  type: ErrorType;
  description: string;
  fix?: string;
}

export function createErrorEntry(input: NewErrorInput, now: Date = new Date()): ErrorEntry | null {
  const description = sanitizeErrorText(input.description);
  if (description === null) return null;
  // La bonne idée est facultative : vide, elle vaut `null` ; trop longue,
  // elle fait échouer la saisie plutôt que d'être coupée en silence.
  const rawFix = input.fix?.trim() ?? "";
  const fix = rawFix ? sanitizeErrorText(rawFix) : null;
  if (rawFix && fix === null) return null;
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : dayKey(now);
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    date,
    source: input.source,
    type: input.type,
    description,
    fix,
    // Renvois HÉRITÉS de l'ancienne banque d'exercices — plus rien ne les
    // saisit (voir `ErrorEntry`, lib/storage.ts).
    chapterId: null,
    exerciseId: null,
    reviewItemId: null,
    createdAt: now.toISOString(),
  };
}

/** Une erreur SE SUPPRIME (saisie ratée) — voir `localData.saveErrors`, qui remplace au lieu de fusionner. */
export function removeErrorEntry(entries: ErrorEntry[], id: string): ErrorEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/* ── Périodes, filtres ──────────────────────────────────────────── */

function shiftDay(now: Date, days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return dayKey(date);
}

/**
 * Bornes (incluses, "AAAA-MM-JJ") de la fenêtre de `days` jours finissant
 * aujourd'hui, décalée de `offset` fenêtres vers le passé : offset 0 = les 30
 * derniers jours, offset 1 = les 30 d'avant.
 */
export function periodBounds(now: Date, days: number = ERROR_PERIOD_DAYS, offset = 0): { from: string; to: string } {
  return { from: shiftDay(now, days * (offset + 1) - 1), to: shiftDay(now, days * offset) };
}

export function entriesBetween(entries: ErrorEntry[], from: string, to: string): ErrorEntry[] {
  return entries.filter((entry) => entry.date >= from && entry.date <= to);
}

/** Les erreurs de la période courante (`ERROR_PERIOD_DAYS` derniers jours). */
export function recentErrors(entries: ErrorEntry[], now: Date = new Date(), days: number = ERROR_PERIOD_DAYS): ErrorEntry[] {
  const { from, to } = periodBounds(now, days);
  return entriesBetween(entries, from, to);
}

export function filterErrors(entries: ErrorEntry[], filter: { subject?: Subject | null; type?: ErrorType | null }): ErrorEntry[] {
  return entries.filter((entry) => (!filter.subject || entry.subject === filter.subject) && (!filter.type || entry.type === filter.type));
}

/** Plus récente d'abord — par date de l'épreuve, puis par saisie (plusieurs erreurs notées le même soir). */
export function sortErrors(entries: ErrorEntry[]): ErrorEntry[] {
  return [...entries].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/* ── Comptes ─────────────────────────────────────────────────────── */

export interface TypeCount {
  type: ErrorType;
  count: number;
  /** Même compte, ventilé par matière (seulement les matières présentes), dans l'ordre de lib/study.ts. */
  bySubject: { subject: Subject; count: number }[];
}

/**
 * Compte par type, TOUS les types présents même à zéro (une barre absente se
 * lit comme un oubli, une barre à zéro comme une information), triés du plus
 * fréquent au moins fréquent — à égalité, dans l'ordre canonique.
 */
export function countByType(entries: ErrorEntry[]): TypeCount[] {
  return ERROR_TYPES.map((type) => {
    const ofType = entries.filter((entry) => entry.type === type);
    return {
      type,
      count: ofType.length,
      bySubject: subjects
        .map((subject) => ({ subject, count: ofType.filter((entry) => entry.subject === subject).length }))
        .filter((entry) => entry.count > 0),
    };
  }).sort((a, b) => b.count - a.count || ERROR_TYPES.indexOf(a.type) - ERROR_TYPES.indexOf(b.type));
}

/**
 * Le type le plus fréquent, s'il est SEUL en tête — `null` sur une liste vide
 * ou une égalité. Désigner un « n°1 » à 3 contre 3 serait choisir au hasard,
 * et l'élève lirait un diagnostic là où il n'y a qu'un ex æquo.
 */
export function topType(entries: ErrorEntry[]): { type: ErrorType; count: number; total: number } | null {
  const [first, second] = countByType(entries);
  if (!first || first.count === 0) return null;
  if (second && second.count === first.count) return null;
  return { type: first.type, count: first.count, total: entries.length };
}

export interface SubjectErrorCount {
  subject: Subject;
  total: number;
  byType: Record<ErrorType, number>;
  /** Type dominant, seulement s'il est seul en tête ET que la matière compte au moins `ERROR_INSIGHT_MIN` erreurs. */
  top: ErrorType | null;
}

/** Une ligne par matière ayant au moins une erreur, la plus fournie d'abord. */
export function countBySubject(entries: ErrorEntry[]): SubjectErrorCount[] {
  return subjects
    .map((subject) => {
      const own = entries.filter((entry) => entry.subject === subject);
      const byType = Object.fromEntries(ERROR_TYPES.map((type) => [type, own.filter((entry) => entry.type === type).length])) as Record<
        ErrorType,
        number
      >;
      const top = own.length >= ERROR_INSIGHT_MIN ? (topType(own)?.type ?? null) : null;
      return { subject, total: own.length, byType, top };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || subjects.indexOf(a.subject) - subjects.indexOf(b.subject));
}

/** Le type qui domine l'ensemble — base du conseil affiché. `null` sous le seuil ou en cas d'égalité. */
export function dominantType(entries: ErrorEntry[]): ErrorType | null {
  if (entries.length < ERROR_INSIGHT_MIN) return null;
  return topType(entries)?.type ?? null;
}

/* ── Tendance ───────────────────────────────────────────────────── */

export interface ErrorTrend {
  recent: number;
  previous: number;
  direction: "hausse" | "baisse" | "stable" | "insuffisant";
}

/**
 * Les 30 derniers jours contre les 30 d'avant.
 *
 * « insuffisant » quand l'une des deux fenêtres est vide (le carnet vient
 * d'être commencé : tout serait « en hausse ») ou quand les deux réunies
 * n'atteignent pas `ERROR_INSIGHT_MIN`. « stable » tant que l'écart ne
 * dépasse pas un quart de la fenêtre précédente (et au moins 2 erreurs) : de
 * 6 à 7 erreurs notées, ce n'est pas une tendance.
 *
 * Rappel de l'en-tête : ce sont des erreurs NOTÉES. L'interface dit « tu en
 * as noté plus », pas « tu en fais plus ».
 */
export function computeErrorTrend(entries: ErrorEntry[], now: Date = new Date(), days: number = ERROR_PERIOD_DAYS): ErrorTrend {
  const current = periodBounds(now, days, 0);
  const before = periodBounds(now, days, 1);
  const recent = entriesBetween(entries, current.from, current.to).length;
  const previous = entriesBetween(entries, before.from, before.to).length;
  if (recent === 0 || previous === 0 || recent + previous < ERROR_INSIGHT_MIN) return { recent, previous, direction: "insuffisant" };
  const threshold = Math.max(2, Math.ceil(previous / 4));
  const delta = recent - previous;
  return { recent, previous, direction: Math.abs(delta) < threshold ? "stable" : delta > 0 ? "hausse" : "baisse" };
}

/* ── Le constat ─────────────────────────────────────────────────── */

/** « en physique », « en informatique TC » — le nom de matière dans une phrase. */
export function subjectInSentence(subject: Subject): string {
  return subject.charAt(0).toLowerCase() + subject.slice(1);
}

export interface ErrorInsight {
  subject: Subject;
  type: ErrorType;
  count: number;
  total: number;
  text: string;
}

/**
 * « Ton erreur n°1 en physique ce mois-ci : calcul (6 sur 9). »
 *
 * Sur les `ERROR_PERIOD_DAYS` derniers jours, dans la matière demandée — ou,
 * sans matière, dans celle qui compte le plus d'erreurs notées. `null` (et
 * donc AUCUNE phrase) tant que cette matière n'atteint pas
 * `ERROR_INSIGHT_MIN` erreurs, ou quand deux types sont à égalité en tête.
 * Le total est toujours donné à côté du compte : « 6 » seul ne dit pas si
 * c'est la moitié ou la quasi-totalité.
 */
export function buildErrorInsight(entries: ErrorEntry[], now: Date = new Date(), subject?: Subject | null): ErrorInsight | null {
  const recent = recentErrors(entries, now);
  const scope = subject ?? countBySubject(recent)[0]?.subject;
  if (!scope) return null;
  const own = recent.filter((entry) => entry.subject === scope);
  if (own.length < ERROR_INSIGHT_MIN) return null;
  const top = topType(own);
  if (!top) return null;
  return {
    subject: scope,
    type: top.type,
    count: top.count,
    total: top.total,
    text: `Ton erreur n°1 en ${subjectInSentence(scope)} ce mois-ci : ${ERROR_TYPE_META[top.type].label.toLowerCase()} (${top.count} sur ${top.total}).`,
  };
}

/* ── Liste par récence ──────────────────────────────────────────── */

export interface ErrorGroup {
  key: "today" | "week" | "month" | "older";
  label: string;
  entries: ErrorEntry[];
}

/**
 * Quatre paquets — aujourd'hui, 7 derniers jours, 30 derniers jours, avant —
 * plutôt qu'un en-tête par jour : un DS produit six erreurs le même jour, et
 * trente intertitres pour trente lignes ne se lisent plus. Les paquets vides
 * disparaissent.
 */
export function groupErrorsByRecency(entries: ErrorEntry[], now: Date = new Date()): ErrorGroup[] {
  const today = dayKey(now);
  const week = shiftDay(now, 6);
  const month = shiftDay(now, ERROR_PERIOD_DAYS - 1);
  const groups: ErrorGroup[] = [
    { key: "today", label: "Aujourd'hui", entries: [] },
    { key: "week", label: "Cette semaine", entries: [] },
    { key: "month", label: "Ce mois-ci", entries: [] },
    { key: "older", label: "Plus ancien", entries: [] },
  ];
  for (const entry of sortErrors(entries)) {
    // Une date dans le futur (saisie « demain » par erreur) reste en tête, avec aujourd'hui.
    const index = entry.date >= today ? 0 : entry.date >= week ? 1 : entry.date >= month ? 2 : 3;
    groups[index].entries.push(entry);
  }
  return groups.filter((group) => group.entries.length > 0);
}

/* ── Passerelles ────────────────────────────────────────────────── */

/**
 * Nature d'une note (lib/grades.ts) → source d'erreur, pour le lien « Noter
 * les erreurs de ce DS » après la saisie d'une note. Une interro n'a pas
 * d'équivalent : elle retombe sur « autre » plutôt que d'être déguisée en DS.
 */
export function sourceForGradeKind(kind: GradeKind): ErrorSource {
  const map: Record<GradeKind, ErrorSource> = { ds: "DS", dm: "DM", colle: "colle", concours: "concours blanc", interro: "autre", autre: "autre" };
  return map[kind];
}

export interface ErrorPrefill {
  subject?: Subject;
  source?: ErrorSource;
  date?: string;
}

/**
 * Lit `?subject=&source=&date=` — toute valeur inconnue est ignorée, jamais
 * propagée. Les anciens `&chapter=`/`&exercise=` (liens de l'ancienne banque
 * d'exercices) sont simplement ignorés.
 */
export function parseErrorPrefill(search: string): ErrorPrefill {
  const params = new URLSearchParams(search);
  const prefill: ErrorPrefill = {};
  const subject = params.get("subject");
  const source = params.get("source");
  const date = params.get("date");
  if (subject && (subjects as string[]).includes(subject)) prefill.subject = subject as Subject;
  if (source && (ERROR_SOURCES as string[]).includes(source)) prefill.source = source as ErrorSource;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) prefill.date = date;
  return prefill;
}

/** Lien vers le carnet pré-rempli — construit ici pour que les points d'entrée n'aient pas à connaître les paramètres. */
export function errorLogHref(prefill: ErrorPrefill = {}): string {
  const params = new URLSearchParams();
  if (prefill.subject) params.set("subject", prefill.subject);
  if (prefill.source) params.set("source", prefill.source);
  if (prefill.date) params.set("date", prefill.date);
  const query = params.toString();
  return query ? `/erreurs?${query}` : "/erreurs";
}

/**
 * Mémoire de la dernière saisie : matière ET source. On note les erreurs
 * d'une même colle d'affilée — les redemander à chaque ligne doublerait le
 * temps de saisie.
 */
export const ERROR_MEMORY_KEY = "prepahub:errors:last-capture";

export function parseErrorMemory(raw: string | null): { subject: Subject | null; source: ErrorSource | null } {
  try {
    const value = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      subject: typeof value.subject === "string" && (subjects as string[]).includes(value.subject) ? (value.subject as Subject) : null,
      source: typeof value.source === "string" && (ERROR_SOURCES as string[]).includes(value.source) ? (value.source as ErrorSource) : null,
    };
  } catch {
    return { subject: null, source: null };
  }
}

/**
 * Une erreur de COURS → une entrée « à apprendre » du carnet À revoir.
 *
 * Le texte reprend la bonne idée quand elle existe (c'est elle qu'il faut
 * apprendre), précédée de la description pour garder le contexte ; borné à
 * `REVIEW_TEXT_MAX` avec une ellipse, parce que `createReviewItem` refuse —
 * à raison — un texte trop long plutôt que de le couper.
 */
export function reviewInputFromError(entry: ErrorEntry): NewReviewItemInput {
  const full = entry.fix ? `${entry.description} → ${entry.fix}` : entry.description;
  const text = full.length > REVIEW_TEXT_MAX ? `${full.slice(0, REVIEW_TEXT_MAX - 1).trimEnd()}…` : full;
  return { subject: entry.subject, kind: "à apprendre", text };
}

/** Vrai tant que l'erreur n'a pas d'entrée « À revoir » VIVANTE — supprimée depuis, on peut la recréer. */
export function canSendToReview(entry: ErrorEntry, reviewItems: ReviewItem[]): boolean {
  return entry.reviewItemId === null || !reviewItems.some((item) => item.id === entry.reviewItemId);
}

/** Relie l'erreur à l'entrée « À revoir » créée à partir d'elle. */
export function linkReviewItem(entries: ErrorEntry[], errorId: string, reviewItemId: string): ErrorEntry[] {
  return entries.map((entry) => (entry.id === errorId ? { ...entry, reviewItemId } : entry));
}
