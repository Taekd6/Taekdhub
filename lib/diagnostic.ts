import { ANKI_MIN_REVIEWED, type ChapterAnki } from "@/lib/anki-mapping";
import { AT_RISK_THRESHOLD, retrievabilityToday } from "@/lib/chapter-memory";
import { examScopeIndex } from "@/lib/exam-prep";
import type { Exercise, ExerciseStep } from "@/lib/exercises";
import { DESIRED_RETENTION } from "@/lib/fsrs";
import type { KholleHistory } from "@/lib/kholle";
import { bestProgrammeMatch } from "@/lib/programme";
import { PROGRAMME, PROGRAMME_BY_ID, type ProgrammeChapter } from "@/lib/programme-data";
import type { ChapterMemory, ErrorEntry, ErrorType, WorkItem } from "@/lib/storage";
import { activeWorkItems, daysUntilDue } from "@/lib/work-items";

/**
 * DIAGNOSTIC DES LACUNES — « dans ce chapitre, qu'est-ce qui coince, et
 * qu'est-ce qui le prouve ? »
 *
 * Pour chaque chapitre du programme, le moteur rassemble les TRACES
 * disponibles et n'énonce un constat que lorsqu'un seuil d'observations est
 * atteint. Pas de score composite : chaque constat dit sur quoi il repose.
 *
 * SOURCES (toutes facultatives) :
 *   mémoire   Mémoire des chapitres (FSRS de TaekdHub), via le rapprochement
 *             titre → chapitre (lib/programme.ts) ;
 *   anki      chiffres par chapitre des paquets associés avec SÛRETÉ
 *             (lib/anki-mapping.ts), relevé de moins de 7 jours ;
 *   exercices annales, questions de DS/épreuves, nouvelles tentatives
 *             (lib/exercises.ts) — résultat, aide, temps, cause ;
 *   carnet    erreurs reliées au chapitre (débrief) ;
 *   khôlle    dernières évaluations des questions de cours (appareil).
 *
 * CONSTATS ET SEUILS (fenêtre : 60 jours pour exercices, erreurs, khôlle) :
 *
 *   cours        mémoire < 85 % ; OU Anki : ≥ 20 % des cartes révisées
 *                ratées au moins une fois (sur ≥ 20 cartes) ; OU ≥ 2 échecs
 *                dont la cause déclarée est le cours ; OU ≥ 2 erreurs de
 *                cours au carnet.
 *   démonstration ≥ 2 questions de cours de khôlle « pas su » ou « hésitant ».
 *   méthode      ≥ 2 échecs cause « méthode » ; OU ≥ 2 erreurs de méthode ;
 *                OU ≥ 2 annales réussies seulement avec ≥ 2 indices.
 *   application  ≥ 3 tentatives d'exercice, moins de la moitié réussies sans
 *                aide. Quand le cours TIENT (mémoire ≥ 90 %, ou Anki < 10 %
 *                d'échecs sur ≥ 20 cartes), le constat le dit : la priorité
 *                est l'exercice, pas une heure de cours de plus.
 *   calcul       ≥ 2 échecs cause « calcul » ou erreurs de calcul.
 *   temps        ≥ 2 tentatives à plus de 1,5 × le temps prévu, ou marquées
 *                « manque de temps », ou erreurs de temps.
 *   démarrage    ≥ 2 échecs cause « démarrage ».
 *   difficile    exercices directs/classiques réussis sans aide (≥ 2/3, sur
 *                ≥ 2) mais difficiles ratés (< 1/2, sur ≥ 2) : l'application
 *                de base tient, l'enchaînement dans un problème long non.
 *                Remplace alors le constat « application ».
 *
 * FAITS ET HYPOTHÈSES : `evidence` ne contient que des faits chiffrés ;
 * `hypothesis` est leur interprétation, présentée comme telle.
 *
 * FRAÎCHEUR : un constat dont la dernière observation a plus de
 * `STALE_DAYS` jours redevient un « signal », à confirmer.
 *
 * Un constat est « établi » quand il repose sur ≥ 2 sources différentes ou
 * ≥ 4 observations, « signal » sinon. Sous les seuils : rien n'est dit, et
 * le chapitre est marqué « données insuffisantes » s'il a quelques traces.
 *
 * ORDRE DE PRIORITÉ (pas de score) : constats établis d'abord ; puis un
 * chapitre au programme d'une épreuve dans les 14 jours ; puis le plus de
 * constats ; puis la trace la plus récente. DANS un chapitre (`mainFinding`) :
 * si le cours ET l'application sont en cause, le cours d'abord ; sinon le
 * constat établi, puis cours → méthode → application → le reste.
 *
 * Fonctions pures.
 */

export type FindingKind = "cours" | "démonstration" | "méthode" | "application" | "difficile" | "calcul" | "temps" | "démarrage";

export const FINDING_LABEL: Record<FindingKind, string> = {
  cours: "Cours à mémoriser",
  démonstration: "Démonstrations et énoncés",
  méthode: "Méthode mal assimilée",
  application: "Difficulté d'application",
  difficile: "Bloque sur les problèmes difficiles",
  calcul: "Erreurs de calcul",
  temps: "Gestion du temps",
  démarrage: "Difficulté à démarrer",
};

export type Source = "mémoire" | "anki" | "exercices" | "carnet" | "khôlle";

export interface Finding {
  kind: FindingKind;
  level: "établi" | "signal";
  sources: Source[];
  observations: number;
  /** Les faits, chiffrés, qui fondent le constat. */
  evidence: string[];
  /** Ce qu'il faut faire. */
  action: string;
  /** Comment savoir que c'est réglé. */
  doneWhen: string;
  /**
   * L'INTERPRÉTATION des faits — une hypothèse, présentée comme telle. Les
   * faits sont dans `evidence` ; ceci est ce qu'ils suggèrent.
   */
  hypothesis: string;
  /** Jour de la dernière observation (aujourd'hui pour une mesure Mémoire/Anki). */
  lastSeen: string | null;
  /** Dernière observation de plus de `STALE_DAYS` jours : le constat est ramené à « signal », à confirmer. */
  stale: boolean;
}

export interface ChapterDiagnosis {
  chapter: ProgrammeChapter;
  findings: Finding[];
  /** Quelques traces, mais sous tous les seuils : on ne conclut pas. */
  insufficient: boolean;
  /** Ce que le moteur sait du cours et de l'application, en une ligne chacun — `null` sans donnée. */
  course: { state: "tient" | "fragile" | "inconnu"; detail: string };
  application: { state: "tient" | "fragile" | "inconnu"; detail: string };
  /** Épreuve proche qui porte ce chapitre (ou sa matière), en jours. */
  examInDays: number | null;
  lastEvidenceDay: string | null;
  /** Exercices à refaire dans ce chapitre (clés). */
  retryKeys: string[];
  /** Paquet Anki principal du chapitre, quand il est associé. */
  ankiDecks: string[];
}

export interface DiagnosticInput {
  chapterMemory: ChapterMemory[];
  exercises: Exercise[];
  errors: ErrorEntry[];
  /** Chiffres Anki par chapitre — `null` si aucun relevé utilisable (absent ou trop vieux). */
  anki: Map<string, ChapterAnki> | null;
  kholle: KholleHistory;
  workItems: WorkItem[];
  today: string;
}

export const WINDOW_DAYS = 60;
const EXAM_HORIZON_DAYS = 14;
const MIN_PAIR = 2;
const MIN_APPLICATION_ATTEMPTS = 3;
const APPLICATION_WEAK = 0.5;
const ANKI_FAIL_HIGH = 0.2;
const ANKI_FAIL_LOW = 0.1;
const TIME_OVERRUN = 1.5;
const ESTABLISHED_OBSERVATIONS = 4;

function shift(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + days, 12).toLocaleDateString("en-CA");
}

function pct(value: number): string {
  return `${Math.round(value * 100)} %`;
}

const CAUSE_TO_FINDING: Partial<Record<string, FindingKind>> = { cours: "cours", méthode: "méthode", calcul: "calcul", démarrage: "démarrage", temps: "temps" };
const ERROR_TO_FINDING: Partial<Record<ErrorType, FindingKind>> = { cours: "cours", méthode: "méthode", calcul: "calcul", temps: "temps" };

const ACTIONS: Record<FindingKind, { action: (chapter: ProgrammeChapter, decks: string[]) => string; doneWhen: string }> = {
  cours: {
    action: (chapter, decks) =>
      decks.length > 0
        ? `Révise les cartes du paquet « ${decks[0]} » dans Anki, puis fais un rappel actif de « ${chapter.title} » sans tes notes.`
        : `Rappel actif de « ${chapter.title} » : définitions, théorèmes, une démonstration, sans tes notes, puis vérifie.`,
    doneWhen: "Le rappel est noté dans Mémoire (ou les cartes dues du paquet sont faites), et la prochaine question de cours sur ce chapitre est sue.",
  },
  démonstration: {
    action: (chapter) => `Khôlle sur « ${chapter.title} » : redémontre au propre les questions de cours ratées.`,
    doneWhen: "Les questions ratées sont « sues » à la prochaine khôlle (à 24 h d'écart au moins).",
  },
  méthode: {
    action: (chapter) => `Écris la méthode type de « ${chapter.title} » (quand l'utiliser, les étapes), puis refais l'exercice raté sans indice.`,
    doneWhen: "L'exercice est réussi sans aide lors de la nouvelle tentative programmée.",
  },
  application: {
    action: (chapter) => `Un exercice ciblé de « ${chapter.title} », chronométré et sans aide — pas une relecture du cours.`,
    doneWhen: "Deux exercices du chapitre réussis sans aide.",
  },
  calcul: {
    action: () => "Refais les calculs des questions ratées, posément, en vérifiant chaque ligne (signe, homogénéité, cas particulier).",
    doneWhen: "Plus d'erreur de calcul notée sur ce chapitre lors des deux prochains exercices.",
  },
  temps: {
    action: () => "Refais un exercice raté en te fixant un temps par question, et passe à la suite quand il tombe.",
    doneWhen: "Un exercice terminé dans le temps prévu.",
  },
  difficile: {
    action: (chapter) => `Un problème de niveau Mines/Centrale sur « ${chapter.title} », découpé : avant de calculer, écris le plan (questions, outils, résultat visé), puis résous sans aide.`,
    doneWhen: "Un problème difficile du chapitre réussi sans aide (ou partiel sans aide, puis réussi à la nouvelle tentative).",
  },
  démarrage: {
    action: (chapter) => `Sur trois énoncés de « ${chapter.title} », écris en 5 minutes les pistes de départ possibles, sans résoudre, puis compare au corrigé.`,
    doneWhen: "À la prochaine tentative, tu démarres seul (aide « sans » ou au plus un indice).",
  },
};

interface Evidence {
  kind: FindingKind;
  source: Source;
  count: number;
  fact: string;
  /** Jour de la plus récente observation qui fonde ce fait. */
  day: string | null;
}

/** Au-delà, un constat ne repose plus que sur du passé : il redevient un signal, à confirmer. */
export const STALE_DAYS = 21;
/** Réussite « sans aide » attendue sur les exercices directs ou classiques pour parler de blocage SUR LE DIFFICILE. */
const EASY_HOLDS = 2 / 3;

const HYPOTHESES: Record<FindingKind, string> = {
  cours: "Le cours n'est pas assez solide pour être mobilisé sans notes.",
  démonstration: "Les énoncés sont connus de nom, mais leurs démonstrations ne sont pas maîtrisées.",
  méthode: "L'outil existe dans ton cours, mais tu ne reconnais pas quand l'utiliser.",
  application: "Le passage du cours à l'exercice coince : savoir n'est pas encore savoir-faire.",
  difficile: "Les méthodes sont acquises isolément, mais leur enchaînement dans un problème long ne l'est pas.",
  calcul: "Le raisonnement est juste, l'exécution n'est pas fiable.",
  temps: "Le rythme, pas la compréhension, coûte des points.",
  démarrage: "Il manque un réflexe d'entrée : reconnaître la structure de l'énoncé.",
};

function latest(days: (string | null | undefined)[]): string | null {
  return days.filter((day): day is string => Boolean(day)).sort().pop() ?? null;
}

function cleanRate(steps: ExerciseStep[]): number {
  return steps.filter((step) => step.result === "réussi" && step.help === "sans").length / Math.max(1, steps.length);
}

export function diagnoseChapters(input: DiagnosticInput): ChapterDiagnosis[] {
  const from = shift(input.today, -(WINDOW_DAYS - 1));

  // Mémoire : chaque chapitre de Mémoire rattaché à SON chapitre du programme.
  const memoryByChapter = new Map<string, ChapterMemory[]>();
  for (const entry of input.chapterMemory) {
    if (entry.archived) continue;
    const match = bestProgrammeMatch(entry.subject, entry.title);
    if (match) memoryByChapter.set(match.id, [...(memoryByChapter.get(match.id) ?? []), entry]);
  }

  // Épreuves proches : par chapitre de Mémoire au programme, et par matière.
  const scope = examScopeIndex(input.workItems, input.today, EXAM_HORIZON_DAYS);
  const examByChapter = new Map<string, number>();
  for (const [memoryId, { days }] of scope) {
    const memory = input.chapterMemory.find((entry) => entry.id === memoryId);
    const match = memory ? bestProgrammeMatch(memory.subject, memory.title) : null;
    if (match && (!examByChapter.has(match.id) || days < examByChapter.get(match.id)!)) examByChapter.set(match.id, days);
  }
  const examBySubject = new Map<string, number>();
  const now = new Date(`${input.today}T12:00:00`);
  for (const item of activeWorkItems(input.workItems)) {
    if (!item.subject || (item.kind !== "ds" && item.kind !== "concours")) continue;
    const days = daysUntilDue(item, now);
    if (days === null || days < 0 || days > EXAM_HORIZON_DAYS) continue;
    if (!examBySubject.has(item.subject) || days < examBySubject.get(item.subject)!) examBySubject.set(item.subject, days);
  }

  const out: ChapterDiagnosis[] = [];
  for (const chapter of PROGRAMME) {
    const evidence: Evidence[] = [];
    let traces = 0;
    let lastDay: string | null = null;
    const seen = (day: string | null) => {
      if (day && (!lastDay || day > lastDay)) lastDay = day;
    };

    /* ── Cours : Mémoire et Anki ── */
    const memory = memoryByChapter.get(chapter.id) ?? [];
    const retrievability = memory.length > 0 ? Math.min(...memory.map((entry) => retrievabilityToday(entry, input.today))) : null;
    if (retrievability !== null) {
      traces += 1;
      if (retrievability < AT_RISK_THRESHOLD) evidence.push({ kind: "cours", source: "mémoire", count: 1, fact: `Mémoire : ${pct(retrievability)} de chance de t'en souvenir aujourd'hui`, day: input.today });
    }
    const anki = input.anki?.get(chapter.id);
    const ankiRate = anki && anki.reviewed30 >= ANKI_MIN_REVIEWED ? anki.failRate : null;
    if (anki) traces += 1;
    if (ankiRate !== null && ankiRate >= ANKI_FAIL_HIGH) {
      evidence.push({ kind: "cours", source: "anki", count: 1, fact: `Anki : ${pct(ankiRate)} des ${anki!.reviewed30} cartes révisées sur 30 jours ratées au moins une fois`, day: input.today });
    }

    /* ── Exercices du chapitre (fenêtre) ── */
    const exercises = input.exercises.filter((exercise) => exercise.chapterId === chapter.id);
    const steps = exercises.flatMap((exercise) => exercise.steps).filter((step) => step.day >= from && step.day <= input.today);
    traces += steps.length;
    for (const step of steps) seen(step.day);
    const failed = steps.filter((step) => step.result !== "réussi");
    const causes = new Map<FindingKind, { count: number; day: string | null }>();
    for (const step of failed) {
      const kind = step.cause ? CAUSE_TO_FINDING[step.cause] : undefined;
      if (kind) causes.set(kind, { count: (causes.get(kind)?.count ?? 0) + 1, day: latest([causes.get(kind)?.day, step.day]) });
    }
    for (const [kind, { count, day }] of causes) {
      evidence.push({ kind, source: "exercices", count, fact: `${count} tentative${count > 1 ? "s" : ""} ratée${count > 1 ? "s" : ""} pour cause de ${kind}`, day });
    }
    const overrunSteps = steps.filter((step) => step.lackOfTime || (step.minutes !== null && step.plannedMinutes !== null && step.minutes > step.plannedMinutes * TIME_OVERRUN));
    const overruns = overrunSteps.length;
    if (overruns > 0) evidence.push({ kind: "temps", source: "exercices", count: overruns, fact: `${overruns} tentative${overruns > 1 ? "s" : ""} hors du temps prévu ou en manque de temps`, day: latest(overrunSteps.map((step) => step.day)) });
    const hintedSteps = steps.filter((step) => step.result === "réussi" && step.hints !== null && step.hints >= 2);
    const hinted = hintedSteps.length;
    if (hinted > 0) evidence.push({ kind: "méthode", source: "exercices", count: hinted, fact: `${hinted} annale${hinted > 1 ? "s" : ""} réussie${hinted > 1 ? "s" : ""} seulement avec au moins 2 indices`, day: latest(hintedSteps.map((step) => step.day)) });

    /* ── Carnet d'erreurs relié au chapitre ── */
    const errors = input.errors.filter((entry) => entry.programmeChapterId === chapter.id && entry.date >= from && entry.date <= input.today);
    traces += errors.length;
    const errorTypes = new Map<FindingKind, { count: number; day: string | null }>();
    for (const entry of errors) {
      seen(entry.date);
      const kind = ERROR_TO_FINDING[entry.type];
      if (kind) errorTypes.set(kind, { count: (errorTypes.get(kind)?.count ?? 0) + 1, day: latest([errorTypes.get(kind)?.day, entry.date]) });
    }
    for (const [kind, { count, day }] of errorTypes) evidence.push({ kind, source: "carnet", count, fact: `${count} erreur${count > 1 ? "s" : ""} « ${kind} » au carnet`, day });

    /* ── Khôlle (questions de cours, sur cet appareil) ── */
    const kholle = Object.entries(input.kholle).filter(([id, entry]) => id.startsWith(`${chapter.id}#`) && entry.at.slice(0, 10) >= from);
    traces += kholle.length;
    const missedEntries = kholle.filter(([, entry]) => entry.grade !== "su");
    const missed = missedEntries.length;
    if (missed > 0) evidence.push({ kind: "démonstration", source: "khôlle", count: missed, fact: `${missed} question${missed > 1 ? "s" : ""} de cours de khôlle « pas su » ou « hésitant »`, day: latest(missedEntries.map(([, entry]) => entry.at.slice(0, 10))) });

    /* ── Constats ── */
    const findings: Finding[] = [];
    const decks = anki?.decks ?? [];
    const courseHolds = (retrievability !== null && retrievability >= DESIRED_RETENTION) || (ankiRate !== null && ankiRate < ANKI_FAIL_LOW);
    const addFinding = (kind: FindingKind, items: Evidence[], extra: string[] = []) => {
      const observations = items.reduce((sum, item) => sum + item.count, 0);
      const sources = [...new Set(items.map((item) => item.source))];
      const lastSeen = latest(items.map((item) => item.day));
      const age = lastSeen ? Math.round((new Date(`${input.today}T12:00:00`).getTime() - new Date(`${lastSeen}T12:00:00`).getTime()) / 86_400_000) : null;
      const stale = age !== null && age > STALE_DAYS;
      findings.push({
        kind,
        // Un constat ancien redevient un signal : on ne bâtit pas la semaine sur des observations d'il y a un mois.
        level: !stale && (sources.length >= 2 || observations >= ESTABLISHED_OBSERVATIONS) ? "établi" : "signal",
        sources,
        observations,
        evidence: [...items.map((item) => item.fact), ...extra, ...(stale ? [`Dernière observation il y a ${age} jours : à confirmer par un nouvel exercice.`] : [])],
        action: ACTIONS[kind].action(chapter, decks),
        doneWhen: ACTIONS[kind].doneWhen,
        hypothesis: HYPOTHESES[kind],
        lastSeen,
        stale,
      });
    };

    for (const kind of ["cours", "démonstration", "méthode", "calcul", "temps", "démarrage"] as FindingKind[]) {
      const items = evidence.filter((item) => item.kind === kind);
      if (items.length === 0) continue;
      // Mémoire et Anki sont des MESURES : un seul relevé suffit. Le reste se compte : il en faut au moins deux.
      const measured = items.some((item) => item.source === "mémoire" || item.source === "anki");
      const counted = items.filter((item) => item.source !== "mémoire" && item.source !== "anki").some((item) => item.count >= MIN_PAIR);
      if (measured || counted) addFinding(kind, items);
    }

    // Classiques réussis, difficiles ratés : l'application de base tient, l'enchaînement dans un problème long non.
    const easy = steps.filter((step) => step.level === "direct" || step.level === "classique");
    const hard = steps.filter((step) => step.level === "difficile");
    const blockedOnHard = easy.length >= MIN_PAIR && hard.length >= MIN_PAIR && cleanRate(easy) >= EASY_HOLDS && cleanRate(hard) < APPLICATION_WEAK;
    if (blockedOnHard) {
      addFinding("difficile", [
        { kind: "difficile", source: "exercices", count: easy.length, fact: `Directs et classiques : ${pct(cleanRate(easy))} réussis sans aide sur ${easy.length}`, day: latest(easy.map((step) => step.day)) },
        { kind: "difficile", source: "exercices", count: hard.length, fact: `Difficiles : ${pct(cleanRate(hard))} réussis sans aide sur ${hard.length}`, day: latest(hard.map((step) => step.day)) },
      ]);
    }

    const rate = steps.length > 0 ? cleanRate(steps) : null;
    if (!blockedOnHard && steps.length >= MIN_APPLICATION_ATTEMPTS && rate !== null && rate < APPLICATION_WEAK) {
      const fact: Evidence = { kind: "application", source: "exercices", count: steps.length, fact: `${pct(rate)} des ${steps.length} tentatives réussies sans aide`, day: latest(steps.map((step) => step.day)) };
      const extra = courseHolds
        ? [`Le cours, lui, tient (${retrievability !== null && retrievability >= DESIRED_RETENTION ? `mémoire ${pct(retrievability)}` : `Anki : ${pct(ankiRate!)} d'échecs`}) : la priorité est l'exercice, pas une heure de cours de plus.`]
        : retrievability === null && ankiRate === null
          ? ["Aucune donnée sur le cours de ce chapitre (Mémoire, Anki) : impossible de dire si le cours est en cause."]
          : [];
      addFinding("application", [fact], extra);
    }

    const course =
      retrievability === null && ankiRate === null
        ? { state: "inconnu" as const, detail: "Pas de donnée (ni Mémoire, ni paquet Anki associé)" }
        : findings.some((finding) => finding.kind === "cours" && finding.sources.some((source) => source === "mémoire" || source === "anki"))
          ? { state: "fragile" as const, detail: [retrievability !== null ? `mémoire ${pct(retrievability)}` : null, ankiRate !== null ? `Anki ${pct(ankiRate)} d'échecs` : null].filter(Boolean).join(" · ") }
          : { state: "tient" as const, detail: [retrievability !== null ? `mémoire ${pct(retrievability)}` : null, ankiRate !== null ? `Anki ${pct(ankiRate)} d'échecs` : null].filter(Boolean).join(" · ") };
    const application =
      steps.length === 0
        ? { state: "inconnu" as const, detail: "Aucun exercice noté sur 60 jours" }
        : steps.length < MIN_APPLICATION_ATTEMPTS
          ? { state: "inconnu" as const, detail: `${steps.length} tentative${steps.length > 1 ? "s" : ""} seulement (il en faut ${MIN_APPLICATION_ATTEMPTS})` }
          : { state: rate! < APPLICATION_WEAK ? ("fragile" as const) : ("tient" as const), detail: `${pct(rate!)} réussies sans aide sur ${steps.length}` };

    out.push({
      chapter,
      findings,
      insufficient: findings.length === 0 && traces > 0,
      course,
      application,
      examInDays: examByChapter.get(chapter.id) ?? examBySubject.get(chapter.subject) ?? null,
      lastEvidenceDay: lastDay,
      retryKeys: exercises.filter((exercise) => exercise.status === "à-refaire" || exercise.status === "programmé").map((exercise) => exercise.key),
      ankiDecks: decks,
    });
  }
  return out;
}

/** L'ordre de priorité documenté en tête de fichier. Seuls les chapitres avec au moins un constat. */
export function rankDiagnoses(diagnoses: ChapterDiagnosis[]): ChapterDiagnosis[] {
  const established = (diagnosis: ChapterDiagnosis) => diagnosis.findings.some((finding) => finding.level === "établi");
  return diagnoses
    .filter((diagnosis) => diagnosis.findings.length > 0)
    .sort(
      (a, b) =>
        Number(established(b)) - Number(established(a)) ||
        (a.examInDays ?? Infinity) - (b.examInDays ?? Infinity) ||
        b.findings.length - a.findings.length ||
        (b.lastEvidenceDay ?? "").localeCompare(a.lastEvidenceDay ?? "") ||
        a.chapter.id.localeCompare(b.chapter.id)
    );
}

/** Le constat à traiter d'abord dans un chapitre : établi d'abord, puis l'ordre de `FINDING_PRIORITY`. */
// Le cours d'abord quand il est en cause (on n'applique pas ce qu'on ne sait pas), puis la méthode, puis l'application.
const FINDING_PRIORITY: FindingKind[] = ["cours", "méthode", "application", "difficile", "démonstration", "démarrage", "calcul", "temps"];

export function mainFinding(diagnosis: ChapterDiagnosis): Finding | null {
  // Règle explicite : quand le cours ET l'application sont en cause, le cours d'abord — quel que soit le niveau de preuve.
  const course = diagnosis.findings.find((finding) => finding.kind === "cours");
  if (course && diagnosis.findings.some((finding) => finding.kind === "application")) return course;
  return (
    [...diagnosis.findings].sort(
      (a, b) => Number(b.level === "établi") - Number(a.level === "établi") || FINDING_PRIORITY.indexOf(a.kind) - FINDING_PRIORITY.indexOf(b.kind)
    )[0] ?? null
  );
}

export function chapterTitle(id: string | null): string | null {
  return id ? PROGRAMME_BY_ID.get(id)?.title ?? null : null;
}
