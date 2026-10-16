import { ankiByChapter, type ChapterAnki } from "@/lib/anki-mapping";
import { ANKI_TREND_STALE_DAYS, latestFullSnapshot, normalizeAnkiSnapshots, snapshotAgeHours, type AnkiSnapshot } from "@/lib/anki-snapshot";
import { demoRef } from "@/lib/demo-cards";
import { DEMONSTRATIONS, DEMO_STATE_LABEL, demoActions, demoStatus, type DemoActionKind, type DemoState } from "@/lib/demonstrations";
import { chapterReadiness } from "@/lib/exam-prep";
import { DESIRED_RETENTION } from "@/lib/fsrs";
import { evaluationHistory, pedagogyInputFrom, recurringDifficulties, type PedagogyInput, type Support } from "@/lib/pedagogy";
import { bestProgrammeMatch } from "@/lib/programme";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { normalizePreferences, type ChapterMemory, type Preferences, type WorkItem, type WorkItemKind } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { activeWorkItems, daysUntilDue } from "@/lib/work-items";

/**
 * CONTEXTE DE RÉVISION — « que dois-je réviser pour cette khôlle / ce DS ? »
 * LECTURE SEULE. L'outil MCP `get_contexte_revision` (app/api/mcp/[key]/route.ts)
 * l'appelle : l'IA n'a plus besoin qu'on lui recopie son contexte.
 *
 * AUCUN NOUVEAU STOCKAGE. Le programme d'une épreuve est celui que l'élève a
 * saisi : `WorkItem.scope` (les chapitres de MÉMOIRE rattachés à l'échéance,
 * lib/exam-prep.ts). Ici, ces chapitres sont rapprochés du programme officiel
 * (lib/programme.ts) par leur TITRE, avec la règle existante (rapprochement
 * certain seulement). Tout le reste est LU dans les modules existants :
 *
 *   difficultés et corrections   lib/pedagogy.ts (événements distincts, corrigée
 *                                seulement par une réussite sans aide postérieure) ;
 *   démonstrations               lib/demonstrations.ts (états observés, actions) ;
 *   mémoire                      lib/exam-prep.ts (souvenir attendu le jour J, FSRS) ;
 *   Anki                         le dernier relevé chiffré par paquet (lib/anki-mapping.ts).
 *
 * CE QUI N'EST JAMAIS DÉDUIT
 *   — le programme d'une épreuve à partir de sa matière : sans chapitre
 *     rattaché, l'épreuve est signalée « programme inconnu » et AUCUNE
 *     recommandation de chapitre n'en sort ;
 *   — qu'une démonstration appartient à une épreuve parce qu'elle est de la
 *     même matière : elle y entre seulement par le chapitre rattaché ;
 *   — que la carte Anki existe ou qu'elle a été révisée : TaekdHub ne voit que
 *     des chiffres par paquet, d'un relevé fait depuis l'ordinateur.
 *
 * ORDRE DES PRIORITÉS — explicite, sans score. Pour chaque épreuve, par rang :
 *   khôlle   1 restitution ratée ou incomplète · 2 difficulté récurrente · 3 démonstration à (re)faire ·
 *            4 mémoire qui ne tiendra pas · 5 cartes Anki dues · 6 signal à confirmer ;
 *   DS       2 et 1 permutés : d'abord la difficulté récurrente.
 * Puis, entre épreuves : le rang, ensuite l'échéance la plus proche. Chaque
 * recommandation porte ses FAITS ; une recommandation sans fait n'existe pas.
 *
 * Fonctions pures.
 */

export type ExamTypeFilter = "colle" | "DS" | "concours" | "toutes";
const KIND_OF: Record<Exclude<ExamTypeFilter, "toutes">, WorkItemKind> = { colle: "colle", DS: "ds", concours: "concours" };
const EXAM_KINDS: readonly WorkItemKind[] = ["colle", "ds", "concours"];
const TYPE_LABEL: Record<string, string> = { colle: "khôlle", ds: "DS", concours: "concours blanc" };

export const DEFAULT_HORIZON_DAYS = 21;
export const MAX_HORIZON_DAYS = 90;
const CHAPTERS_MAX = 12;
const ACTIONS_PER_EXAM = 6;
const PRIORITIES_MAX = 8;
const OBSERVATIONS_SHOWN = 3;

/** Durées indicatives par type d'action, en minutes — des ESTIMATIONS grossières, affichées comme telles. */
export const ACTION_MINUTES = { "restituer-demonstration": 20, "revoir-carte-anki": 10, "ajouter-carte-anki": 5, "creer-carte-ciblee": 5, "demander-explication": 15, "refaire-exercice": 30, "rappel-actif": 20 } as const;
export type RevisionActionKind = keyof typeof ACTION_MINUTES;

export interface RevisionInput extends PedagogyInput {
  /** Programme de colle de la semaine (chapitres du programme), SANS date : `preferences.colleChapters`. */
  colleChapters: readonly string[];
  demoCards: Readonly<Record<string, string>>;
  ankiSnapshot: AnkiSnapshot | null;
  ankiByChapter: ReadonlyMap<string, ChapterAnki>;
  now: Date;
}

export interface RevisionFilter {
  type?: ExamTypeFilter;
  subject?: Subject | null;
  chapterId?: string | null;
  examId?: string | null;
  /** Fenêtre en jours à partir d'aujourd'hui (21 par défaut, 90 au plus). */
  horizonDays?: number;
  /** Temps disponible : les priorités sont alors choisies pour y tenir. */
  minutes?: number | null;
}

export interface RevisionFact {
  /** D'où vient le fait : une démonstration, une difficulté de chapitre, la mémoire, des cartes Anki dues. */
  source: "demonstration" | "difficulte" | "memoire" | "anki";
  /** Chapitre du programme officiel concerné, ou `null` (chapitre propre à l'élève). */
  programmeChapterId: string | null;
  /** État observé de la démonstration (source « demonstration »). */
  demoState?: DemoState;
  /** Niveau de la difficulté (source « difficulte »). */
  difficulty?: "récurrente" | "signal";
  tier: number;
  action: RevisionActionKind;
  quoi: string;
  chapitre: string | null;
  demonstration?: string;
  pourquoi: string[];
  supports: Support[];
  verification: string;
  /** Pourquoi à ce rang. */
  rang: string;
}

type Fact = RevisionFact;

const VERIFY = {
  restituer: "Restituer sans aucune aide, puis faire comparer à la référence : une réussite autonome ferme la difficulté.",
  anki: "Revoir des cartes ne prouve pas que c'est su : vérifier ensuite par une restitution ou un exercice sans aide. Les révisions d'Anki ne comptent pas comme des réussites.",
  exercice: "Réussir sans aide un exercice du chapitre : relire la correction ne ferme pas la difficulté.",
  explication: "Après l'explication, refaire sans aide la partie qui bloquait.",
  memoire: "Un rappel actif noté dans Mémoire : le souvenir attendu le jour J est recalculé.",
} as const;

/* ── Le programme d'une épreuve ───────────────────────────────────── */

interface ResolvedChapter {
  /** Identifiant du programme officiel, ou `null` si le titre saisi n'y correspond à rien de certain. */
  programmeId: string | null;
  title: string;
  memory: ChapterMemory[];
}

function resolveProgramme(item: WorkItem, input: RevisionInput) {
  const byProgramme = new Map<string, ResolvedChapter>();
  const own: ResolvedChapter[] = [];
  const unrecognized: string[] = [];
  const memory = new Map(input.chapterMemory.map((chapter) => [chapter.id, chapter]));
  for (const id of item.scope?.chapterIds ?? []) {
    const chapter = memory.get(id);
    if (!chapter) {
      unrecognized.push("un chapitre rattaché à l'épreuve a été supprimé de Mémoire");
      continue;
    }
    const match = bestProgrammeMatch(chapter.subject, chapter.title);
    if (!match) {
      own.push({ programmeId: null, title: chapter.title, memory: [chapter] });
      continue;
    }
    const current = byProgramme.get(match.id);
    if (current) current.memory.push(chapter);
    else byProgramme.set(match.id, { programmeId: match.id, title: match.title, memory: [chapter] });
  }
  const noteText = item.note?.match(/Chapitres : (.+?)(?: — |$)/)?.[1] ?? null;
  return { chapters: [...byProgramme.values(), ...own], unrecognized, noteText };
}

/* ── Les faits d'un chapitre ──────────────────────────────────────── */

function ankiFacts(input: RevisionInput, chapterId: string | null) {
  const entry = chapterId ? input.ankiByChapter.get(chapterId) : undefined;
  if (!entry || !input.ankiSnapshot) return null;
  return {
    paquets: entry.decks,
    cartes_au_total: entry.total,
    cartes_dues: entry.due,
    revisees_30j: entry.reviewed30,
    ratees_30j: entry.failed30,
    releve_le: input.ankiSnapshot.day,
    releve_ancien: snapshotAgeHours(input.ankiSnapshot.takenAt, input.now) / 24 > ANKI_TREND_STALE_DAYS,
    attention: "Ce sont des révisions Anki, pas des restitutions : elles ne prouvent pas qu'une démonstration ou un exercice est réussi sans aide.",
  };
}

function ankiAvailability(input: RevisionInput): string {
  if (!input.ankiSnapshot) return "Aucun relevé Anki enregistré : TaekdHub ne sait rien de l'état de tes cartes. Fais un relevé depuis l'ordinateur (page Anki, AnkiConnect).";
  return `Dernier relevé du ${input.ankiSnapshot.day} : TaekdHub ne voit que des chiffres par paquet (cartes dues, révisées et ratées sur 30 jours) pour les paquets reliés à un chapitre. Il ne voit ni les cartes une à une, ni leur planification, ni si une carte précise existe ou a été révisée.`;
}

/* ── Le contexte ──────────────────────────────────────────────────── */

export interface RevisionExamRef {
  id: string;
  titre: string;
  type: string;
  date: string;
  dans_jours: number;
}

/** Les faits ordonnés, chacun avec l'épreuve qui les motive — la source UNIQUE des priorités (outil MCP ET Next Move). */
export interface RevisionFactOnExam {
  fact: RevisionFact;
  exam: RevisionExamRef;
  kind: WorkItemKind;
}

/** Le contexte pour l'outil MCP. Voir `computeRevision`. */
export function buildRevisionContext(input: RevisionInput, filter: RevisionFilter = {}) {
  return computeRevision(input, filter).context;
}

/** Les faits de révision, tous, dans l'ordre des priorités entre épreuves (rang, puis échéance), sans doublon d'action. */
export function revisionFacts(input: RevisionInput, filter: RevisionFilter = {}): RevisionFactOnExam[] {
  return computeRevision(input, filter).merged;
}

export function computeRevision(input: RevisionInput, filter: RevisionFilter = {}) {
  const horizon = Math.min(MAX_HORIZON_DAYS, Math.max(0, Math.round(filter.horizonDays ?? DEFAULT_HORIZON_DAYS)));
  const wanted = filter.type && filter.type !== "toutes" ? [KIND_OF[filter.type]] : EXAM_KINDS;
  const exams = activeWorkItems([...input.workItems])
    .filter((item) => wanted.includes(item.kind) && item.dueDate !== null)
    .filter((item) => (!filter.subject || item.subject === filter.subject) && (!filter.examId || item.id === filter.examId))
    .map((item) => ({ item, days: daysUntilDue(item, input.now) }))
    .filter((entry): entry is { item: WorkItem; days: number } => entry.days !== null && entry.days >= 0 && entry.days <= horizon)
    .sort((a, b) => a.days - b.days || a.item.id.localeCompare(b.item.id));

  // Difficultés de chapitre : SANS les restitutions de démonstration, qui ont leur propre vue (pas de double compte).
  const withoutDemos: PedagogyInput = { ...input, attempts: input.attempts.filter((attempt) => attempt.origin !== "démonstration") };
  const difficulties = recurringDifficulties(withoutDemos);
  const difficultyOf = new Map(difficulties.recommandations.map((entry) => [entry.chapitre.id, entry]));
  const correctedOf = new Map(difficulties.corrigees.map((entry) => [entry.chapitre, entry]));
  const missing: string[] = [];
  const all: RevisionFactOnExam[] = [];

  const echeances = exams.map(({ item, days }) => {
    const type = TYPE_LABEL[item.kind];
    const exam = { id: item.id, titre: item.title, type, date: item.dueDate!, dans_jours: days };
    const when = `${type} « ${item.title} » le ${item.dueDate} (dans ${days} j)`;
    const { chapters, unrecognized, noteText } = resolveProgramme(item, input);
    const known = chapters.length > 0;
    const examMissing: string[] = [];
    if (!known) examMissing.push(`Programme de « ${item.title} » inconnu : aucun chapitre n'y est rattaché. Rien n'est déduit de la matière seule — renseigne ses chapitres (écran Échéances, ou update_echeance) pour obtenir des recommandations.`);
    if (noteText) examMissing.push(`Chapitres notés en texte libre mais non rattachés (absents de Mémoire) : ${noteText}. Ajoute-les à Mémoire pour qu'ils entrent dans l'analyse.`);
    for (const title of unrecognized) examMissing.push(title);

    const facts: Fact[] = [];
    const chapitres = chapters
      .filter((chapter) => !filter.chapterId || chapter.programmeId === filter.chapterId)
      .slice(0, CHAPTERS_MAX)
      .map((chapter) => {
        const programmeId = chapter.programmeId;
        const difficulty = programmeId ? difficultyOf.get(programmeId) : undefined;
        const corrected = correctedOf.get(chapter.title);
        const previous = programmeId
          ? evaluationHistory(withoutDemos, { chapterId: programmeId, last: 3 })
              .flatMap((evaluation) => evaluation.questions.filter((q) => q.chapitre?.id === programmeId && q.resultat !== "réussi" && !q.etat.startsWith("corrigée")).map((q) => ({ evaluation: evaluation.titre, date: evaluation.date, question: q.libelle, cause: q.cause, confiance: q.confiance, etat: q.etat })))
              .slice(0, OBSERVATIONS_SHOWN)
          : [];
        const demos = DEMONSTRATIONS.filter((demo) => programmeId !== null && demo.chapterId === programmeId).map((demo) => {
          const status = demoStatus(demo.id, input.attempts, input.today);
          const cardKnown = Boolean(input.demoCards[demo.id]);
          const actions = demoActions({ demo, attempts: input.attempts, cardInAnki: cardKnown, today: input.today });
          return { demo, status, cardKnown, actions };
        });
        const memories = chapter.memory.filter((entry) => !entry.archived).map((entry) => chapterReadiness(entry, input.today, item.dueDate!, []));
        const weakest = memories.length ? Math.min(...memories.map((entry) => entry.onExam)) : null;
        const anki = ankiFacts(input, programmeId);

        // ─ Les recommandations de ce chapitre, chacune avec ses faits.
        const isColle = item.kind === "colle";
        const tiers = { failedDemo: isColle ? 1 : 2, recurring: isColle ? 2 : 1, demoTodo: 3, memory: 4, ankiDue: 5, signal: 6 };
        for (const { demo, status, cardKnown, actions } of demos) {
          if (status.state === "réussite-autonome") continue;
          const top = actions.find((action) => action.kind !== "rien");
          if (!top) continue;
          const failed = status.state === "restitution-incomplète";
          const action = { "revoir-carte": "revoir-carte-anki", "ajouter-carte": "ajouter-carte-anki", "creer-carte-ciblee": "creer-carte-ciblee", refaire: "restituer-demonstration", expliquer: "demander-explication" }[top.kind as Exclude<DemoActionKind, "rien">] as RevisionActionKind;
          facts.push({
            source: "demonstration",
            programmeChapterId: programmeId,
            demoState: status.state,
            tier: failed ? tiers.failedDemo : tiers.demoTodo,
            action,
            quoi: `${demo.title}`,
            chapitre: chapter.title,
            demonstration: demo.id,
            pourquoi: [`${when} : « ${chapter.title} » est au programme`, `${DEMO_STATE_LABEL[status.state]} : ${status.because}`, top.why, cardKnown ? "La carte Anki est connue de TaekdHub." : "TaekdHub ne sait pas si la carte est dans Anki."],
            supports: action === "restituer-demonstration" ? ["exercice"] : action === "demander-explication" ? ["ia"] : ["anki"],
            verification: action === "demander-explication" ? VERIFY.explication : action === "restituer-demonstration" ? VERIFY.restituer : VERIFY.anki,
            rang: failed ? "restitution observée ratée ou incomplète sur un chapitre au programme" : "démonstration du programme pas encore restituée sans aide, ou à réactiver",
          });
          // Revoir ou ajouter une carte ne ferme rien : la RESTITUTION sans aide est la vérification, listée juste après.
          // (Pas après « demander une explication » : restituer ce qu'on n'a pas compris serait prématuré.)
          if (action === "revoir-carte-anki" || action === "ajouter-carte-anki" || action === "creer-carte-ciblee") {
            facts.push({
              source: "demonstration",
              programmeChapterId: programmeId,
              demoState: status.state,
              tier: failed ? tiers.failedDemo : tiers.demoTodo,
              action: "restituer-demonstration",
              quoi: demo.title,
              chapitre: chapter.title,
              demonstration: demo.id,
              pourquoi: [`${when} : « ${chapter.title} » est au programme`, `${DEMO_STATE_LABEL[status.state]} : ${status.because}`, "Après la carte, une restitution sans aide : c'est elle qui ferme la difficulté."],
              supports: ["exercice"],
              verification: VERIFY.restituer,
              rang: failed ? "restitution observée ratée ou incomplète sur un chapitre au programme" : "démonstration du programme pas encore restituée sans aide, ou à réactiver",
            });
          }
        }
        if (difficulty) {
          const recurrent = difficulty.niveau === "récurrente";
          for (const support of difficulty.supports.length ? [difficulty.supports[0]] : []) {
            const action: RevisionActionKind = support === "ia" ? "demander-explication" : support === "exercice" ? "refaire-exercice" : anki ? "revoir-carte-anki" : "rappel-actif";
            facts.push({
              source: "difficulte",
              programmeChapterId: programmeId,
              difficulty: difficulty.niveau,
              tier: recurrent ? tiers.recurring : tiers.signal,
              action,
              quoi: difficulty.action,
              chapitre: chapter.title,
              pourquoi: [`${when} : « ${chapter.title} » est au programme`, difficulty.justification, ...difficulty.observations.slice(0, OBSERVATIONS_SHOWN)],
              supports: difficulty.supports,
              // Revoir des cartes n'est pas une preuve : la vérification dit ce qui fermerait réellement la difficulté.
              verification: action === "revoir-carte-anki" ? `${VERIFY.anki} ${difficulty.verification}` : difficulty.verification,
              rang: recurrent ? "difficulté récurrente non corrigée" : "une seule observation : signal à confirmer, pas une conclusion",
            });
          }
        }
        if (weakest !== null && weakest < DESIRED_RETENTION) {
          facts.push({
            source: "memoire",
            programmeChapterId: programmeId,
            tier: tiers.memory,
            action: anki ? "revoir-carte-anki" : "rappel-actif",
            quoi: `Rappel de « ${chapter.title} »`,
            chapitre: chapter.title,
            pourquoi: [`${when} : « ${chapter.title} » est au programme`, `Souvenir attendu le jour J sans révision : ${Math.round(weakest * 100)} % (modèle de mémoire de TaekdHub, pas une note)`],
            supports: anki ? ["anki", "cours"] : ["cours"],
            verification: VERIFY.memoire,
            rang: "le souvenir attendu le jour J est sous la rétention visée",
          });
        }
        if (anki && anki.cartes_dues > 0) {
          facts.push({
            source: "anki",
            programmeChapterId: programmeId,
            tier: tiers.ankiDue,
            action: "revoir-carte-anki",
            quoi: `${anki.cartes_dues} carte${anki.cartes_dues > 1 ? "s" : ""} due${anki.cartes_dues > 1 ? "s" : ""} dans ${anki.paquets.join(", ")}`,
            chapitre: chapter.title,
            pourquoi: [`${when} : « ${chapter.title} » est au programme`, `Relevé Anki du ${anki.releve_le} : ${anki.cartes_dues} cartes dues${anki.releve_ancien ? " (relevé ancien : à rafraîchir)" : ""}`],
            supports: ["anki"],
            verification: VERIFY.anki,
            rang: "cartes Anki dues d'après le dernier relevé",
          });
        }
        if (programmeId === null) examMissing.push(`« ${chapter.title} » ne correspond à aucun chapitre certain du programme : ses démonstrations et difficultés ne peuvent pas être retrouvées.`);
        else if (!difficulty && previous.length === 0 && demos.every((entry) => entry.status.restitutions === 0) && !corrected) examMissing.push(`« ${chapter.title} » : aucune observation (débrief, restitution) — rien à prioriser par les faits, seulement mémoire et Anki si disponibles.`);

        return {
          chapitre: { id: programmeId, titre: chapter.title },
          difficulte: difficulty ? { niveau: difficulty.niveau, justification: difficulty.justification, observations: difficulty.observations.slice(0, OBSERVATIONS_SHOWN), donnees_suffisantes: difficulty.donnees_suffisantes } : null,
          deja_corrigee: corrected ? { preuve: corrected.preuve } : null,
          erreurs_ouvertes_evaluations_precedentes: previous,
          demonstrations: demos.map(({ demo, status, cardKnown, actions }) => ({
            id: demo.id,
            titre: demo.title,
            etat: DEMO_STATE_LABEL[status.state],
            pourquoi: status.because,
            restitutions_enregistrees: status.restitutions,
            actions: actions.map((a) => ({ action: a.kind, pourquoi: a.why })),
            carte_anki: { reference: demoRef(demo.id), dans_anki: cardKnown ? "oui, d'après TaekdHub (envoyée ou retrouvée depuis l'ordinateur)" : "inconnu" },
          })),
          memoire: weakest === null ? null : { souvenir_attendu_le_jour_j_pct: Math.round(weakest * 100), cible_pct: Math.round(DESIRED_RETENTION * 100) },
          anki,
        };
      });
    if (known && chapitres.length === 0 && filter.chapterId) examMissing.push("Le chapitre demandé n'est pas au programme de cette épreuve.");

    const ranked = facts.sort((a, b) => a.tier - b.tier || (a.chapitre ?? "").localeCompare(b.chapitre ?? "") || a.quoi.localeCompare(b.quoi)).slice(0, ACTIONS_PER_EXAM);
    for (const fact of ranked) all.push({ fact, exam, kind: item.kind });
    missing.push(...examMissing.map((line) => `${exam.titre} : ${line}`));

    // Les erreurs des anciennes évaluations de la matière, SANS en tirer de plan : le programme de l'épreuve ne les désigne pas.
    const subjectErrors =
      !known && item.subject
        ? evaluationHistory(withoutDemos, { subject: item.subject, last: 3 })
            .flatMap((evaluation) => evaluation.questions.filter((q) => q.resultat !== "réussi" && !q.etat.startsWith("corrigée")).map((q) => ({ evaluation: evaluation.titre, date: evaluation.date, chapitre: q.chapitre?.titre ?? null, question: q.libelle, cause: q.cause, etat: q.etat })))
            .slice(0, 6)
        : [];

    return {
      echeance: { ...exam, matiere: item.subject, minutes_prevues: item.estimatedMinutes },
      programme: {
        connu: known,
        source: known ? "chapitres rattachés à l'épreuve (Mémoire), rapprochés du programme officiel par leur titre" : null,
        non_rattaches_texte: noteText,
      },
      chapitres,
      recommandations: ranked.map((fact) => publicAction(fact, exam)),
      ...(subjectErrors.length ? { erreurs_de_la_matiere_hors_programme: { portee: "matière seulement : le programme de cette épreuve est inconnu, ces erreurs ne désignent pas ce qu'il faut réviser", erreurs: subjectErrors } } : {}),
    };
  });

  // Priorités entre épreuves : rang, puis échéance la plus proche. Une même action n'apparaît qu'une fois.
  const seen = new Set<string>();
  const merged = all
    .sort((a, b) => a.fact.tier - b.fact.tier || a.exam.dans_jours - b.exam.dans_jours || a.fact.quoi.localeCompare(b.fact.quoi))
    .filter(({ fact }) => {
      const key = `${fact.action}|${fact.chapitre}|${fact.demonstration ?? fact.quoi}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
  const budget = typeof filter.minutes === "number" && filter.minutes > 0 ? Math.round(filter.minutes) : null;
  let used = 0;
  const priorites = merged.slice(0, PRIORITIES_MAX).map(({ fact, exam }) => {
    const minutes = ACTION_MINUTES[fact.action];
    const fits = budget === null || used + minutes <= budget;
    if (budget !== null && fits) used += minutes;
    return { ...publicAction(fact, exam), ...(budget !== null ? { tient_dans_le_temps: fits } : {}) };
  });

  const colle = filter.type === "colle" || !filter.type || filter.type === "toutes" ? [...new Set(input.colleChapters)].flatMap((id) => {
          const chapter = PROGRAMME_BY_ID.get(id);
          return chapter && (!filter.subject || chapter.subject === filter.subject) ? [chapter] : [];
        })
      : [];
  if (exams.length === 0) missing.push(`Aucune ${filter.type && filter.type !== "toutes" ? TYPE_LABEL[KIND_OF[filter.type]] : "épreuve (khôlle, DS, concours blanc)"} datée dans les ${horizon} prochains jours${filter.subject ? ` en ${filter.subject}` : ""} : ajoute-la dans TaekdHub (écran Échéances, ou add_echeance).`);
  if (priorites.length === 0 && exams.length > 0) missing.push("Aucune recommandation fondée sur des faits : programmes inconnus ou aucune observation enregistrée (débrief, restitution). Il manque des données, pas une priorité à inventer.");

  const context = {
    date: input.today,
    fenetre_jours: horizon,
    echeances,
    priorites,
    ...(budget !== null ? { temps_disponible_min: budget, temps_utilise_min: used, remarque_temps: "Durées estimées grossièrement par type d'action (restituer une démonstration 20 min, revoir des cartes 10 min, exercice 30 min…) ; ce ne sont pas des mesures." } : {}),
    programme_colle_de_la_semaine: colle.length
      ? { chapitres: colle.map((c) => ({ id: c.id, titre: c.title, matiere: c.subject })), attention: "Saisi dans l'écran Khôlle, SANS date : il n'est rattaché à aucune khôlle précise. Ne le suppose pas valable pour une khôlle datée sans que l'élève le confirme." }
      : null,
    anki: ankiAvailability(input),
    donnees_manquantes: missing,
    ordre_des_priorites: "Rang d'abord (khôlle : restitution ratée > difficulté récurrente > démonstration à faire > mémoire > cartes dues > signal ; DS : difficulté récurrente > restitution ratée > …), puis échéance la plus proche. Aucun score : chaque priorité cite ses faits.",
  };
  return { context, merged };

  function publicAction(fact: Fact, exam: { id: string; titre: string; dans_jours: number }) {
    return {
      action: fact.action,
      quoi: fact.quoi,
      chapitre: fact.chapitre,
      ...(fact.demonstration ? { demonstration: fact.demonstration } : {}),
      echeance: { id: exam.id, titre: exam.titre, dans_jours: exam.dans_jours },
      pourquoi: fact.pourquoi,
      pourquoi_ce_rang: fact.rang,
      supports: fact.supports,
      minutes_estimees: ACTION_MINUTES[fact.action],
      verification: fact.verification,
      ...(fact.action === "creer-carte-ciblee" ? { validation: "La carte est proposée par l'IA et validée par l'élève avant tout ajout dans Anki." } : {}),
    };
  }
}

/** Les collections synchronisées brutes (éventuellement abîmées), normalisées, plus ce qu'il faut en plus de pedagogyInputFrom. */
export function revisionInputFrom(collections: Record<string, unknown>, annaleRows: unknown, now: Date): RevisionInput {
  const base = pedagogyInputFrom(collections, annaleRows, now);
  const preferences = normalizePreferences(collections.preferences ?? {});
  const snapshot = latestFullSnapshot(normalizeAnkiSnapshots(collections.ankiSnapshots));
  return {
    ...base,
    colleChapters: preferences.colleChapters,
    demoCards: preferences.demoCards,
    ankiSnapshot: snapshot,
    ankiByChapter: ankiByChapter(snapshot, preferences.ankiDeckChapters),
    now,
  };
}

/**
 * L'entrée du contexte de révision à partir de ce que Next Move possède déjà
 * (mêmes collections, mêmes préférences) : le moteur et l'outil MCP lisent
 * ainsi EXACTEMENT les mêmes données avec la même fonction. Structurel : ce
 * module n'importe pas le moteur.
 */
export function revisionInputFromState(state: {
  workItems: readonly WorkItem[];
  grades: PedagogyInput["grades"];
  errors: PedagogyInput["errors"];
  attempts?: PedagogyInput["attempts"];
  annales?: PedagogyInput["annales"];
  chapterMemory: readonly ChapterMemory[];
  preferences: Pick<Preferences, "retryDelaysDays" | "colleChapters" | "demoCards" | "ankiDeckChapters">;
  ankiSnapshots?: readonly AnkiSnapshot[];
  now: Date;
}): RevisionInput {
  const snapshot = latestFullSnapshot([...(state.ankiSnapshots ?? [])]);
  return {
    grades: state.grades,
    attempts: state.attempts ?? [],
    errors: state.errors,
    workItems: state.workItems,
    chapterMemory: state.chapterMemory,
    annales: state.annales ?? [],
    retryDelaysDays: state.preferences.retryDelaysDays,
    today: dayKey(state.now),
    colleChapters: state.preferences.colleChapters,
    demoCards: state.preferences.demoCards,
    ankiSnapshot: snapshot,
    ankiByChapter: ankiByChapter(snapshot, state.preferences.ankiDeckChapters),
    now: state.now,
  };
}
