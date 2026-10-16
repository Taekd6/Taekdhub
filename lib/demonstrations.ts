import data from "@/data/demonstrations.json";
import { foldText } from "@/lib/annales";
import type { AnkiTransport } from "@/lib/anki-connect";
import { ensureDeck } from "@/lib/anki-export";
import { DEMO_GAP_KINDS, isCleanSuccess, upsertAttempts, type AttemptHelp, type AttemptResult, type DemoGap, type DemoGapKind, type ExerciseAttempt } from "@/lib/attempts";
import { DEMO_MODEL_NAME, demoNote, demoRef, type DemoNote, type Demonstration } from "@/lib/demo-cards";
import { dayDiff } from "@/lib/fsrs";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { Subject } from "@/lib/supabase/types";

/**
 * DÉMONSTRATIONS — apprendre dans Anki, restituer sans aide, faire remonter
 * ce qui a manqué dans TaekdHub.
 *
 * TROIS RESPONSABILITÉS, SÉPARÉES
 *   Anki        la carte (lib/demo-cards.ts) et sa répétition espacée. TaekdHub
 *               ne planifie rien, ne touche à aucun intervalle.
 *   TaekdHub    les OBSERVATIONS : une restitution est une tentative
 *               (lib/attempts.ts, origine « démonstration », clé
 *               `demo:<id>`) — le même historique que les DS et les
 *               exercices, pas un second. Ouvrir une carte ou y passer du
 *               temps n'est jamais une observation.
 *   L'IA        compare la restitution à la preuve de référence et rend un
 *               JSON (`parseRestitution`) que l'élève vérifie avant
 *               qu'il ne soit enregistré.
 *
 * ÉTATS — dérivés de la DERNIÈRE restitution enregistrée, jamais du temps :
 *   non-travaillée           aucune restitution enregistrée ;
 *   restitution-incomplète   la dernière est partielle ou ratée ;
 *   réussite-avec-aide       la dernière est réussie, avec indices ou avec la preuve sous les yeux ;
 *   réussite-autonome        la dernière est réussie SANS aide, il y a moins de `REACTIVATE_AFTER_DAYS` ;
 *   à-réactiver              réussite autonome… mais ancienne : on vérifie qu'elle tient encore.
 * `REACTIVATE_AFTER_DAYS` n'est PAS l'intervalle d'Anki : c'est le délai
 * après lequel une restitution réussie cesse de prouver quoi que ce soit.
 *
 * Fonctions pures, sauf `sendDemoNotes` / `findDemoNotes` (transport injecté).
 */

export const REACTIVATE_AFTER_DAYS = 21;
/** Une même lacune dans autant de restitutions distinctes mérite une carte ciblée. */
export const RECURRING_GAP_MIN = 2;
/** Échecs d'affilée au-delà desquels refaire ne suffit plus : on demande une explication. */
export const EXPLAIN_AFTER_FAILS = 3;

export const DEMONSTRATIONS: Demonstration[] = (data.demonstrations as Demonstration[]).filter((demo) => PROGRAMME_BY_ID.has(demo.chapterId));

export function demoById(id: string): Demonstration | null {
  return DEMONSTRATIONS.find((demo) => demo.id === id) ?? null;
}

export function demoChapter(demo: Demonstration) {
  return PROGRAMME_BY_ID.get(demo.chapterId)!;
}

export function demoSubject(demo: Demonstration): Subject {
  return demoChapter(demo).subject;
}

/** Le paquet du chapitre — celui que le pont Anki associe tout seul au chapitre (lib/anki-mapping.ts). */
export function demoDeck(demo: Demonstration): string {
  const chapter = demoChapter(demo);
  return `TaekdHub::${chapter.subject}::${chapter.title}`;
}

export function demoNoteOf(demo: Demonstration): DemoNote {
  return demoNote(demo, demoDeck(demo), demoChapter(demo).title);
}

export function demoKey(id: string): string {
  return `demo:${id}`;
}

/* ── États ────────────────────────────────────────────────────────── */

export type DemoState = "non-travaillée" | "restitution-incomplète" | "réussite-avec-aide" | "réussite-autonome" | "à-réactiver";

export const DEMO_STATE_LABEL: Record<DemoState, string> = {
  "non-travaillée": "Non travaillée",
  "restitution-incomplète": "Restitution incomplète",
  "réussite-avec-aide": "Réussite avec aide",
  "réussite-autonome": "Réussite autonome",
  "à-réactiver": "À réactiver",
};

export interface DemoStatus {
  state: DemoState;
  /** La phrase qui justifie l'état, avec son observation. */
  because: string;
  /** Restitutions enregistrées. */
  restitutions: number;
  lastDay: string | null;
}

export function restitutionsOf(demoId: string, attempts: readonly ExerciseAttempt[]): ExerciseAttempt[] {
  return attempts.filter((attempt) => attempt.exerciseKey === demoKey(demoId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

const HELP_PHRASE: Record<AttemptHelp, string> = { sans: "sans aide", indices: "avec indices", correction: "avec la preuve sous les yeux" };

export function demoStatus(demoId: string, attempts: readonly ExerciseAttempt[], today: string): DemoStatus {
  const list = restitutionsOf(demoId, attempts);
  if (list.length === 0) return { state: "non-travaillée", because: "Aucune restitution enregistrée : ouvrir la carte ou y passer du temps ne compte pas.", restitutions: 0, lastDay: null };
  const last = list[list.length - 1];
  const base = { restitutions: list.length, lastDay: last.day };
  if (last.result !== "réussi") {
    const gaps = last.gaps?.length ?? 0;
    return { ...base, state: "restitution-incomplète", because: `Restitution du ${last.day} ${last.result === "partiel" ? "incomplète" : "ratée"}${gaps > 0 ? ` (${gaps} lacune${gaps > 1 ? "s" : ""} relevée${gaps > 1 ? "s" : ""})` : ""}.` };
  }
  if (!isCleanSuccess(last)) return { ...base, state: "réussite-avec-aide", because: `Réussie le ${last.day}, mais ${HELP_PHRASE[last.help]} : pas encore une restitution autonome.` };
  const age = dayDiff(last.day, today);
  if (age >= REACTIVATE_AFTER_DAYS) return { ...base, state: "à-réactiver", because: `Dernière réussite autonome il y a ${age} jours (le ${last.day}) : à vérifier de nouveau.` };
  return { ...base, state: "réussite-autonome", because: `Restituée sans aide le ${last.day}${list.length > 1 ? ` (${list.length} restitutions enregistrées)` : " (une seule restitution enregistrée)"}.` };
}

/* ── Lacunes et actions ───────────────────────────────────────────── */

export interface RecurringGap {
  kind: DemoGapKind;
  /** Libellé de la lacune la plus récente de ce groupe. */
  detail: string;
  step?: number;
  /** Restitutions distinctes où elle apparaît, depuis la dernière réussite autonome. */
  count: number;
  days: string[];
  /** Jour de la réussite autonome qui a suivi : la difficulté est vérifiée corrigée. `null` : encore ouverte. */
  correctedOn: string | null;
}

function gapKey(gap: DemoGap): string {
  return gap.step ? `${gap.kind}#${gap.step}` : `${gap.kind}|${foldText(gap.detail)}`;
}

/**
 * Les lacunes qui REVIENNENT : même type et même étape (ou même texte), dans
 * au moins `RECURRING_GAP_MIN` restitutions distinctes — comptées depuis la
 * dernière RÉUSSITE AUTONOME. Une réussite sans aide ferme toutes les
 * lacunes ouvertes (elles passent en « corrigées », avec le jour de la
 * preuve) ; si l'une revient ensuite, elle repart de zéro. Les révisions de
 * la carte dans Anki n'entrent jamais ici : seules comptent les restitutions.
 */
function gapRuns(demoId: string, attempts: readonly ExerciseAttempt[]): { open: RecurringGap[]; corrected: RecurringGap[] } {
  let open = new Map<string, RecurringGap>();
  const corrected: RecurringGap[] = [];
  for (const attempt of restitutionsOf(demoId, attempts)) {
    if (isCleanSuccess(attempt)) {
      for (const group of open.values()) if (group.count >= RECURRING_GAP_MIN) corrected.push({ ...group, correctedOn: attempt.day });
      open = new Map();
      continue;
    }
    const seenHere = new Set<string>();
    for (const gap of attempt.gaps ?? []) {
      const key = gapKey(gap);
      if (seenHere.has(key)) continue;
      seenHere.add(key);
      const current = open.get(key);
      open.set(key, { kind: gap.kind, detail: gap.detail, step: gap.step, count: (current?.count ?? 0) + 1, days: [...(current?.days ?? []), attempt.day], correctedOn: null });
    }
  }
  return { open: [...open.values()].filter((group) => group.count >= RECURRING_GAP_MIN).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)), corrected };
}

export function recurringGaps(demoId: string, attempts: readonly ExerciseAttempt[]): RecurringGap[] {
  return gapRuns(demoId, attempts).open;
}

/** Les lacunes récurrentes qu'une réussite autonome a depuis vérifiées corrigées. */
export function correctedGaps(demoId: string, attempts: readonly ExerciseAttempt[]): RecurringGap[] {
  return gapRuns(demoId, attempts).corrected;
}

/**
 * Le lien carte ↔ démonstration après une VÉRIFICATION dans Anki : exactement
 * les démonstrations retrouvées. Une carte supprimée dans Anki n'y reste pas
 * marquée ; une carte déjà connue garde sa date.
 */
export function syncDemoCards(current: Readonly<Record<string, string>>, found: readonly string[], known: readonly string[], at: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of known) if (found.includes(id)) out[id] = current[id] ?? at;
  // Un identifiant que ce code ne connaît plus est conservé tel quel : on ne perd pas une donnée sur une simple vérification.
  for (const [id, date] of Object.entries(current)) if (!known.includes(id)) out[id] = date;
  return out;
}

export type DemoActionKind = "revoir-carte" | "ajouter-carte" | "creer-carte-ciblee" | "refaire" | "expliquer" | "rien";

export interface DemoAction {
  kind: DemoActionKind;
  why: string;
  /** La lacune visée, pour une carte ciblée. */
  target?: RecurringGap;
}

/**
 * QUE FAIRE, d'après ce qui a été OBSERVÉ — une table, pas un score :
 *
 *   expliquer          une lacune de « raisonnement » (on ne comprend pas), ou
 *                      `EXPLAIN_AFTER_FAILS` échecs d'affilée : une carte ne
 *                      répare pas ce qu'on n'a pas compris ;
 *   carte ciblée       UNE lacune (hypothèse, étape, justification) qui
 *                      revient dans `RECURRING_GAP_MIN` restitutions distinctes,
 *                      ET la carte de la démonstration est déjà dans Anki
 *                      (sinon : d'abord l'ajouter). Jamais pour une première
 *                      lacune ni pour toutes ;
 *   revoir la carte    une hypothèse ou une justification oubliée, une fois ;
 *   refaire            une étape manquante, une restitution sans lacune
 *                      précisée, une réussite avec aide, une réussite ancienne ;
 *   rien               réussite autonome récente : Anki assure la suite.
 */
export function demoActions(input: { demo: Demonstration; attempts: readonly ExerciseAttempt[]; cardInAnki: boolean; today: string }): DemoAction[] {
  const { demo, attempts, cardInAnki, today } = input;
  const status = demoStatus(demo.id, attempts, today);
  const list = restitutionsOf(demo.id, attempts);
  const card: DemoAction = cardInAnki ? { kind: "revoir-carte", why: "La carte est dans Anki : revois-la avant de refaire la preuve." } : { kind: "ajouter-carte", why: "La carte de cette démonstration n'est pas encore dans Anki : ajoute-la (aperçu, puis ta validation)." };

  switch (status.state) {
    case "non-travaillée":
      return cardInAnki
        ? [{ kind: "refaire", why: "Aucune restitution enregistrée : restitue-la sans support, puis fais comparer à la référence." }]
        : [{ kind: "ajouter-carte", why: "Ajoute la carte à Anki (aperçu, puis ta validation), apprends-la, puis restitue-la sans support et fais comparer à la référence." }];
    case "réussite-autonome":
      return [{ kind: "rien", why: "Restituée sans aide récemment : la répétition espacée d'Anki prend le relais." }];
    case "réussite-avec-aide":
      return [{ kind: "refaire", why: "Réussie avec aide : refais la démonstration entière sans aucun support — c'est cette réussite-là qui compte." }];
    case "à-réactiver":
      return [card, { kind: "refaire", why: `Plus de ${REACTIVATE_AFTER_DAYS} jours sans restitution : refais-la sans aide pour vérifier qu'elle tient.` }];
    default:
      break;
  }

  const actions: DemoAction[] = [];
  const last = list[list.length - 1];
  const gaps = last.gaps ?? [];
  let trailingFails = 0;
  for (let index = list.length - 1; index >= 0 && !isCleanSuccess(list[index]); index -= 1) trailingFails += 1;
  const reasoning = gaps.find((gap) => gap.kind === "raisonnement");
  if (reasoning || trailingFails >= EXPLAIN_AFTER_FAILS) {
    actions.push({
      kind: "expliquer",
      why: reasoning ? `Lacune de raisonnement (« ${reasoning.detail} ») : demande à l'IA de t'expliquer l'enchaînement, sans refaire une carte.` : `${trailingFails} restitutions ratées d'affilée : refaire ne suffit plus, demande une explication à l'IA.`,
    });
  }
  const recurring = recurringGaps(demo.id, attempts).find((gap) => gap.kind !== "raisonnement");
  if (recurring && cardInAnki) {
    actions.push({ kind: "creer-carte-ciblee", target: recurring, why: `La même lacune (${recurring.kind}${recurring.step ? `, étape ${recurring.step}` : ""}) revient dans ${recurring.count} restitutions distinctes : elle mérite sa propre carte.` });
  } else if (gaps.some((gap) => gap.kind === "hypothèse" || gap.kind === "justification")) {
    actions.push(card);
  }
  if (recurring && !cardInAnki) actions.push(card);
  if (gaps.length === 0 || gaps.some((gap) => gap.kind === "étape") || actions.length === 0) {
    actions.push({ kind: "refaire", why: gaps.length === 0 ? "Aucune lacune précisée : refais la démonstration entière, puis fais-la comparer à la référence." : "Une étape manquait : refais la démonstration entière, sans support." });
  }
  const seen = new Set<DemoActionKind>();
  return actions.filter((action) => !seen.has(action.kind) && seen.add(action.kind)).slice(0, 3);
}

/* ── Lecture de la restitution rendue par l'IA ────────────────────── */

export const RESTITUTION_VERSION = 1;

export interface ProposedCard {
  front: string;
  back: string;
}

export interface ParsedRestitution {
  demo: Demonstration;
  day: string;
  result: AttemptResult;
  help: AttemptHelp;
  minutes: number | null;
  gaps: DemoGap[];
  note: string | null;
  mastered: string[];
  uncertainties: string[];
  /** Lacunes que l'IA donne pour incertaines : NON enregistrées, à confirmer. */
  unconfirmed: string[];
  warnings: string[];
  proposedCard: ProposedCard | null;
}

export type ParseRestitutionResult = { ok: true; value: ParsedRestitution } | { ok: false; errors: string[] };

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function validDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? value : null;
}

const RESULT_WORDS: Record<string, AttemptResult> = { reussie: "réussi", reussi: "réussi", incomplete: "partiel", partielle: "partiel", partiel: "partiel", echec: "échec", ratee: "échec", fausse: "échec" };

/** Valide la réponse JSON d'une IA qui a comparé ma restitution à la preuve de référence. Ne lit rien d'autre, n'écrit rien. */
export function parseRestitution(raw: string, today: string): ParseRestitutionResult {
  if (!raw.trim()) return { ok: false, errors: ["Colle d'abord la réponse de l'IA."] };
  if (raw.length > 30_000) return { ok: false, errors: ["Texte trop long : demande une réponse plus courte."] };
  let parsed: unknown;
  try {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first === -1 || last <= first) return { ok: false, errors: ["Aucun objet JSON trouvé dans le texte collé."] };
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return { ok: false, errors: ["Le JSON est invalide (virgule ou guillemet manquant ?). Demande à l'IA de le corriger."] };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, errors: ["Le texte collé n'est pas un objet JSON."] };
  const root = parsed as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (root.version !== undefined && root.version !== RESTITUTION_VERSION) errors.push(`Version de format non reconnue : ${RESTITUTION_VERSION} attendue.`);
  const demo = typeof root.demonstration === "string" ? demoById(root.demonstration.trim()) : null;
  if (!demo) errors.push(`« demonstration » doit être l'un de : ${DEMONSTRATIONS.map((entry) => entry.id).join(", ")}.`);
  const day = validDay(root.date);
  if (!day) errors.push("« date » doit être un jour réel au format AAAA-MM-JJ.");
  else if (day > today) errors.push("« date » est dans le futur.");
  const result = RESULT_WORDS[foldText(clean(root.resultat, 20))];
  if (!result) errors.push("« resultat » doit valoir réussie, incomplète ou échec.");
  const helpRaw = foldText(clean(root.aide, 20));
  const help: AttemptHelp | null = helpRaw === "sans" || helpRaw === "indices" || helpRaw === "correction" ? helpRaw : null;
  if (result === "réussi" && !help) errors.push("« aide » est obligatoire pour une réussite : sans, indices ou correction (seule une réussite « sans » prouve la maîtrise).");
  const minutes = typeof root.minutes === "number" && root.minutes >= 0 && root.minutes <= 240 ? Math.round(root.minutes) : null;

  const gaps: DemoGap[] = [];
  const unconfirmed: string[] = [];
  if (root.lacunes !== undefined && !Array.isArray(root.lacunes)) errors.push("« lacunes » doit être une liste.");
  for (const [index, entry] of (Array.isArray(root.lacunes) ? root.lacunes : []).slice(0, 12).entries()) {
    const item = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : null;
    const kind = item ? DEMO_GAP_KINDS.find((candidate) => foldText(candidate) === foldText(clean(item.type, 20))) : undefined;
    const detail = item ? clean(item.detail, 200) : "";
    if (!item || !kind || !detail) {
      errors.push(`Lacune ${index + 1} : « type » (${DEMO_GAP_KINDS.join(", ")}) et « detail » sont obligatoires.`);
      continue;
    }
    const step = typeof item.etape === "number" && Number.isInteger(item.etape) && item.etape >= 1 && item.etape <= (demo?.steps.length ?? 0) ? item.etape : undefined;
    if (item.etape !== undefined && !step && demo) warnings.push(`Lacune ${index + 1} : étape ${String(item.etape)} inexistante dans la preuve de référence (${demo.steps.length} étapes) — numéro ignoré.`);
    if (foldText(clean(item.confiance, 20)) === "incertaine") {
      unconfirmed.push(`${kind} : ${detail}`);
      continue;
    }
    gaps.push({ kind, detail, ...(step ? { step } : {}) });
  }
  if (result === "réussi" && (gaps.length > 0 || unconfirmed.length > 0)) errors.push("Une restitution « réussie » ne peut pas avoir de lacunes : l'IA doit choisir « incomplète » ou retirer les lacunes.");
  if (errors.length > 0 || !demo || !day || !result) return { ok: false, errors };

  if (result !== "réussi" && gaps.length === 0) warnings.push("Aucune lacune précisée avec certitude : l'action proposée sera de refaire la démonstration entière.");
  const proposal = typeof root.carte_proposee === "object" && root.carte_proposee !== null ? (root.carte_proposee as Record<string, unknown>) : null;
  const front = proposal ? clean(proposal.recto, 400) : "";
  const back = proposal ? clean(proposal.verso, 600) : "";
  return {
    ok: true,
    value: {
      demo,
      day,
      result,
      help: help ?? "sans",
      minutes,
      gaps,
      note: clean(root.commentaire, 400) || null,
      mastered: (Array.isArray(root.points_maitrises) ? root.points_maitrises : []).map((entry) => clean(entry, 200)).filter(Boolean).slice(0, 8),
      uncertainties: (Array.isArray(root.incertitudes) ? root.incertitudes : []).map((entry) => clean(entry, 200)).filter(Boolean).slice(0, 8),
      unconfirmed,
      warnings,
      proposedCard: front && back ? { front, back } : null,
    },
  };
}

/** L'observation : une tentative de l'historique existant. Même jour, même démonstration : elle REMPLACE (jamais deux comptages). */
export function restitutionAttempt(parsed: ParsedRestitution, now: Date): ExerciseAttempt {
  const { demo } = parsed;
  return {
    id: `demo:${demo.id}:${parsed.day}`,
    exerciseKey: demoKey(demo.id),
    label: `${demo.title} (démonstration)`,
    subject: demoSubject(demo),
    chapterId: demo.chapterId,
    origin: "démonstration",
    day: parsed.day,
    createdAt: `${parsed.day}T12:00:00.000Z`,
    updatedAt: now.toISOString(),
    result: parsed.result,
    help: parsed.help,
    minutes: parsed.minutes,
    plannedMinutes: null,
    cause: null,
    lackOfTime: false,
    gradeId: null,
    note: parsed.note,
    ...(parsed.gaps.length > 0 ? { gaps: parsed.gaps } : {}),
    byAi: true,
  };
}

export function recordRestitution(attempts: ExerciseAttempt[], parsed: ParsedRestitution, now: Date): ExerciseAttempt[] {
  return upsertAttempts(attempts, [restitutionAttempt(parsed, now)]);
}

/** La carte ciblée proposée par l'IA, prête à verser dans Anki — jamais envoyée sans validation. */
export function targetedCard(demo: Demonstration, card: ProposedCard, gap: RecurringGap): { id: string; front: string; back: string; deck: string; tags: string[] } {
  return { id: `${demoRef(demo.id)}-${gap.kind}${gap.step ?? ""}`, front: card.front, back: card.back, deck: demoDeck(demo), tags: ["taekdhub", "démonstration", "ciblée", demoRef(demo.id)] };
}

/* ── La consigne à donner à l'IA ──────────────────────────────────── */

export function restitutionPrompt(): string {
  const example = {
    version: RESTITUTION_VERSION,
    demonstration: DEMONSTRATIONS[0]?.id ?? "m1-theoreme-du-rang",
    date: "2026-10-14",
    resultat: "incomplète",
    aide: "sans",
    minutes: 9,
    lacunes: [
      { type: "hypothèse", detail: "A oublié que E doit être de dimension finie.", confiance: "certaine" },
      { type: "étape", etape: 4, detail: "N'a pas montré la surjectivité de la restriction.", confiance: "probable" },
    ],
    points_maitrises: ["Choix du supplémentaire de Ker u", "Injectivité de la restriction"],
    commentaire: "Une phrase sur l'ensemble.",
    incertitudes: [],
    carte_proposee: { recto: "Théorème du rang : quelle hypothèse porte sur E ?", verso: "E de dimension finie (F quelconque)." },
  };
  return [
    "Compare ma restitution à la démonstration de RÉFÉRENCE (que je te donne) et réponds par UN SEUL objet JSON, sans texte autour, dans ce format :",
    "",
    JSON.stringify(example, null, 2),
    "",
    "RÈGLES",
    "- « demonstration » : l'identifiant de la liste ci-dessous.",
    "- « resultat » : réussie (tout y est) | incomplète (il manque quelque chose) | échec. « aide » : sans | indices | correction (obligatoire pour une réussite : « sans » seulement si je n'avais RIEN sous les yeux).",
    "- « lacunes » : seulement ce que tu constates en comparant ; type = hypothèse | étape | justification | raisonnement. « etape » = numéro de l'étape de la référence, si tu peux le dire. N'invente aucune lacune : si tu hésites, mets « confiance »: « incertaine » (elle ne sera pas enregistrée) ou omets-la.",
    "- « raisonnement » = une erreur de logique, ou un enchaînement que je n'ai pas compris : propose-moi alors de m'expliquer, pas une carte.",
    "- « carte_proposee » : facultatif, UNE seule carte courte et ciblée sur la lacune la plus importante, jamais toute la démonstration. Je la validerai ; elle ne sera retenue que si la même lacune revient.",
    "",
    "DÉMONSTRATIONS CONNUES",
    ...DEMONSTRATIONS.map((demo) => `  ${demo.id} = ${demo.title} (${demoChapter(demo).title}) — ${demo.steps.length} étapes`),
  ].join("\n");
}

/* ── AnkiConnect (ordinateur seulement, jamais depuis le serveur) ─── */

function multiResult(entry: unknown): unknown {
  return entry && typeof entry === "object" && "result" in entry ? (entry as { result: unknown }).result : entry;
}

/** Quelles démonstrations ont déjà leur note dans Anki (recherche par `Ref`) ? Lecture seule. */
export async function findDemoNotes(transport: AnkiTransport, demos: readonly Demonstration[]): Promise<string[]> {
  if (demos.length === 0) return [];
  const results = (await transport("multi", { actions: demos.map((demo) => ({ action: "findNotes", params: { query: `Ref:${demoRef(demo.id)}` } })) })) as unknown[];
  return demos.filter((_, index) => {
    const ids = multiResult(results[index]);
    return Array.isArray(ids) && ids.length > 0;
  }).map((demo) => demo.id);
}

export interface SendDemoResult {
  added: string[];
  alreadyThere: string[];
  failed: string[];
  /** Cartes rangées par Anki hors du paquet du chapitre, puis déplacées par TaekdHub (voir `ensureDeck`). */
  moved: number;
  /** Cartes hors du paquet du chapitre qu'on n'a pas pu déplacer. */
  unplaced: number;
}

/**
 * Le type de note s'installe en IMPORTANT le paquet (.apkg), jamais en le créant
 * par AnkiConnect : un type créé par AnkiConnect reçoit un identifiant aléatoire,
 * différent de celui du paquet, et le paquet — importé plus tard, sur l'iPad ou
 * ailleurs — créerait alors un SECOND type « … Démonstration+ ». Constaté avec le
 * vrai Anki. Un seul type, donc : le paquet d'abord.
 */
export class DemoNoteTypeMissingError extends Error {
  constructor() {
    super(`Le type de note « ${DEMO_MODEL_NAME} » n'est pas dans ton Anki. Importe d'abord un paquet de démonstrations (bouton « Paquet d'essai » ou « Toutes les démonstrations »), puis recommence : l'import installe le type de note une fois pour toutes.`);
    this.name = "DemoNoteTypeMissingError";
  }
}

/**
 * Verse les démonstrations CHOISIES dans Anki : le type de note doit déjà y
 * être (voir `DemoNoteTypeMissingError`) ; une démonstration dont la note existe déjà (même `Ref`) n'est pas
 * recréée — ni modifiée : ses cartes et leur planification restent celles
 * d'Anki.
 */
export async function sendDemoNotes(transport: AnkiTransport, demos: readonly Demonstration[]): Promise<SendDemoResult> {
  if (demos.length === 0) return { added: [], alreadyThere: [], failed: [], moved: 0, unplaced: 0 };
  const models = (await transport("modelNames")) as string[];
  if (!models.includes(DEMO_MODEL_NAME)) throw new DemoNoteTypeMissingError();
  const present = new Set(await findDemoNotes(transport, demos));
  const todo = demos.filter((demo) => !present.has(demo.id));
  for (const deck of new Set(todo.map(demoDeck))) await transport("createDeck", { deck });
  const notes = todo.map((demo) => {
    const note = demoNoteOf(demo);
    return { deckName: note.deck, modelName: DEMO_MODEL_NAME, fields: note.fields, tags: note.tags, options: { allowDuplicate: false, duplicateScope: "deck" } };
  });
  const ids = notes.length > 0 ? ((await transport("addNotes", { notes })) as (number | null)[]) : [];
  const added: string[] = [];
  const failed: string[] = [];
  const created = new Map<string, number[]>();
  todo.forEach((demo, index) => {
    const id = ids[index];
    if (typeof id === "number") {
      added.push(demo.id);
      created.set(demoDeck(demo), [...(created.get(demoDeck(demo)) ?? []), id]);
    } else failed.push(demo.id);
  });
  const placed = await ensureDeck(transport, [...created].map(([deck, noteIds]) => ({ deck, noteIds })));
  return { added, alreadyThere: [...present], failed, ...placed };
}

/* ── Pour le connecteur MCP (lecture seule) ───────────────────────── */

export interface DemoReportInput {
  attempts: readonly ExerciseAttempt[];
  /** Préférences `demoCards` : démonstration → instant où la carte a été envoyée ou retrouvée. */
  demoCards: Readonly<Record<string, string>>;
  today: string;
}

/**
 * L'état des démonstrations pour une IA : états observés, lacunes qui
 * reviennent, actions possibles, et ce que TaekdHub SAIT de la carte. TaekdHub
 * en production ne peut pas interroger Anki (AnkiConnect est local) : « dans
 * Anki » ne dit que ce qui a été envoyé ou retrouvé depuis l'ordinateur.
 */
export function demonstrationsReport(input: DemoReportInput, filter: { chapterId?: string | null; subject?: Subject | null; demoId?: string | null } = {}) {
  const demos = DEMONSTRATIONS.filter((demo) => (!filter.demoId || demo.id === filter.demoId) && (!filter.chapterId || demo.chapterId === filter.chapterId) && (!filter.subject || demoSubject(demo) === filter.subject));
  return demos.map((demo) => {
    const status = demoStatus(demo.id, input.attempts, input.today);
    const sentAt = input.demoCards[demo.id] ?? null;
    return {
      id: demo.id,
      titre: demo.title,
      chapitre: { id: demo.chapterId, titre: demoChapter(demo).title },
      matiere: demoSubject(demo),
      etat: DEMO_STATE_LABEL[status.state],
      pourquoi: status.because,
      restitutions: status.restitutions,
      observations: restitutionsOf(demo.id, input.attempts)
        .slice(-5)
        .reverse()
        .map((attempt) => ({ jour: attempt.day, resultat: attempt.result, aide: attempt.help, lacunes: attempt.gaps ?? [] })),
      lacunes_recurrentes: recurringGaps(demo.id, input.attempts).map((gap) => ({ type: gap.kind, detail: gap.detail, etape: gap.step ?? null, restitutions: gap.count, jours: gap.days })),
      lacunes_corrigees: correctedGaps(demo.id, input.attempts).map((gap) => ({ type: gap.kind, detail: gap.detail, etape: gap.step ?? null, corrigee_le: gap.correctedOn, preuve: "réussite autonome postérieure à la dernière occurrence" })),
      actions: demoActions({ demo, attempts: input.attempts, cardInAnki: sentAt !== null, today: input.today }).map((action) => ({ action: action.kind, pourquoi: action.why, ...(action.target ? { lacune: { type: action.target.kind, detail: action.target.detail, etape: action.target.step ?? null } } : {}) })),
      carte_anki: { reference: demoRef(demo.id), paquet: demoDeck(demo), dans_anki: sentAt ? `oui (envoyée ou retrouvée le ${sentAt.slice(0, 10)})` : "inconnu : TaekdHub ne peut pas interroger Anki à distance" },
    };
  });
}
