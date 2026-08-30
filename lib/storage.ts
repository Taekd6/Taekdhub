import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import { DEFAULT_ACCENT, DEFAULT_THEME_MODE, THEME_MODES, type ThemeMode } from "@/lib/theme";
import type { AttemptResult, Difficulty, Exercise, ExerciseLevel, ExerciseStatus, ExerciseType, LicenseStatus, Mastery, ProgrammeLevel, Subject, WorkSession } from "@/lib/supabase/types";

const ATTEMPT_RESULTS: readonly AttemptResult[] = ["réussi", "partiel", "échoué"];

const sessionsKey = "prepahub:sessions";
const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";
const chaptersKey = "prepahub:chapters";
const lastBackupKey = "prepahub:last-backup";
const weekSnapshotsKey = "prepahub:week-snapshots";
const goalsKey = "prepahub:goals";
const contestProgressKey = "prepahub:contest-progress";

/**
 * `accent` (Sprint identité visuelle) : hex de la couleur d'accent choisie — voir lib/theme.ts.
 * `themeMode` (Sprint personnalisation) : clair/sombre/système — voir lib/theme.ts#ThemeMode, indépendant de `accent`.
 * `weeklyGoalMinutes` (Sprint Plan de travail) : objectif hebdomadaire, indépendant de `dailyGoalMinutes`
 * (voir lib/week.ts#computeWeeklySummary) — alimente le Dashboard ("Cette semaine") et les statistiques.
 * Absents d'une préférence enregistrée avant leur sprint respectif : retombent sur `defaults` via le
 * merge ci-dessous, comme tout champ ajouté après coup.
 */
export type Preferences = { displayName: string; dailyGoalMinutes: number; weeklyGoalMinutes: number; contestDate: string; accent: string; themeMode: ThemeMode };
// `dailyGoalMinutes: 60` correspond exactement au plus haut des trois préréglages du
// Dashboard/Réglages (PLAN_DURATION_PRESETS = [30, 45, 60], lib/plan.ts) : un premier
// objectif ambitieux mais tenable, jamais un chiffre hors de tout préréglage cliquable
// (l'ancien défaut de 240 min produisait un "Commencer une séance de 240 min" absurde
// dès la toute première visite, avant tout réglage par l'élève). `weeklyGoalMinutes: 300`
// reste cohérent avec ce nouveau quotidien (5 × 60 min ≈ une semaine de cours).
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 60, weeklyGoalMinutes: 300, contestDate: "", accent: DEFAULT_ACCENT, themeMode: DEFAULT_THEME_MODE };

/**
 * Chapitre/thème (Sprint 3D) — créé et géré par l'utilisateur, jamais
 * pré-rempli (voir lib/chapters.ts). Pas de miroir Supabase : comme
 * `Preferences`, ce concept n'existe qu'en local pour l'instant.
 */
export type Chapter = { id: string; subject: Subject; label: string };

/**
 * Objectif (Adaptive Planning Engine) — créé et géré par l'utilisateur, comme
 * `Chapter` : pas de miroir Supabase, purement local. Volontairement simple
 * (pas de "quantité de travail" séparée du système existant) :
 * `lib/goals.ts` calcule tout ce qui est nécessaire (préparation, plan,
 * urgence) à partir de ce périmètre et des données déjà présentes
 * (exercices, séances) — un objectif ne PORTE aucune donnée de progression
 * lui-même, il ne fait que la DÉLIMITER.
 *
 * `subjects` non vide en pratique (voir `normalizeGoal`) : un objectif sans
 * matière valide retombe sur `subjects` de lib/study.ts (toutes les
 * matières), pour représenter honnêtement les objectifs du type "préparer la
 * semaine de rentrée" plutôt que d'inventer une restriction qui n'a pas de
 * sens.
 *
 * `chapterIds` vide = tout le périmètre des `subjects` ciblées, pas de
 * restriction supplémentaire. Une référence vers un chapitre supprimé ou
 * archivé depuis n'est jamais une erreur : voir `lib/goals.ts#scopeToGoal`,
 * qui filtre simplement sans rien trouver — même principe que `chapter_id`
 * sur `Exercise`.
 */
export type GoalStatus = "active" | "completed" | "abandoned";
/** 1 = basse, 2 = normale (défaut), 3 = haute — échelle volontairement grossière, jamais un score continu à calibrer. */
export type GoalPriority = 1 | 2 | 3;

export interface Goal {
  id: string;
  title: string;
  subjects: Subject[];
  chapterIds: string[];
  /** Date cible (jour), ISO — `null` : objectif sans échéance (voir lib/goals.ts, qui traite ce cas explicitement, jamais comme "urgent par défaut"). */
  targetDate: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Concours reconnus pour le catalogue de sujets (lib/contests.ts) — mêmes
 * libellés canoniques que `COMPETITION_ALIASES` (lib/exercise-import.ts,
 * banque d'exercices), étendus à X et ENS. Ces deux derniers sont hors
 * périmètre de la banque d'EXERCICES (`EXCLUDED_COMPETITIONS`, consigne
 * produit) mais légitimes ici : un sujet de concours est une référence
 * bibliographique (concours + année + épreuve + lien vers le portail
 * officiel), jamais l'énoncé reproduit — voir `ContestPaper`. Rien n'oblige
 * à peupler X/ENS immédiatement : `distinctContestCompetitions`
 * (lib/contests.ts) ne propose au filtre que ce qui existe réellement dans
 * le catalogue, jamais la liste complète du type.
 */
export type Competition = "CCINP" | "Mines-Ponts" | "Centrale" | "e3a" | "PT" | "X" | "ENS";

/** Nature de l'épreuve — écrit (le cas de très loin le plus courant en MP) ou oral. */
export type ContestPaperKind = "écrit" | "oral";

/**
 * Disponibilité RÉELLE d'un document (sujet ou corrigé) — chantier "bibliothèque
 * de sujets PDF". Toujours DÉRIVÉE (voir `contestDocumentAvailability`/
 * `contestCorrectionAvailability`, lib/contests.ts), jamais stockée telle
 * quelle dans le dataset : un champ dénormalisé pourrait diverger des chemins
 * réels (fichier renommé/supprimé) sans qu'aucun code ne le détecte, alors
 * qu'une fonction pure calculée à partir de `localDocumentPath`/`resourceUrl`
 * ne peut structurellement jamais mentir.
 *
 * - "bundled" : le PDF est un asset statique livré avec l'app
 *   (`public/contest-papers/<id>.pdf`), lisible et fonctionnel hors ligne dès
 *   qu'il a été ouvert une première fois en ligne (mis en cache par le
 *   service worker comme toute ressource statique du même domaine — voir
 *   service-worker/sw.template.js, `staleWhileRevalidate`). Réservé aux
 *   documents dont la redistribution est explicitement établie
 *   (`ContestPaper.licenseStatus === "libre"` — voir
 *   scripts/validate-contests.mjs, qui refuse tout `localDocumentPath` sans
 *   cette condition).
 * - "official-link" : aucun fichier embarqué, mais un lien vers le PORTAIL
 *   OFFICIEL du concours existe (`resourceUrl`/`correctionUrl`) — jamais
 *   disponible hors ligne, TaekdHub ne le prétend jamais.
 * - "unavailable" : ni fichier embarqué, ni source officielle identifiée.
 */
export type ContestDocumentAvailability = "bundled" | "official-link" | "unavailable";

/**
 * Progression de l'élève sur un sujet — volontairement plus simple que
 * `ExerciseStatus` (pas de "à revoir"/"maîtrisé" : un sujet de concours
 * entier ne se "maîtrise" pas au sens gradué d'un exercice, voir la doc de
 * `ContestPaper`). "fait" ne juge jamais la qualité du résultat, seulement
 * que le sujet a été traité en entier.
 */
export type ContestPaperStatus = "à faire" | "en cours" | "fait";

/**
 * Un sujet de concours (chantier "Banque de sujets de concours") — un
 * document d'épreuve ENTIER (Mathématiques 1 de Centrale 2024, par exemple),
 * une granularité différente et complémentaire de `Exercise` (un problème
 * isolé). Un sujet de concours n'est PAS transformé en `Exercise` : les deux
 * cohabitent, jamais fusionnés (voir lib/contests.ts).
 *
 * RÉFÉRENCE BIBLIOGRAPHIQUE UNIQUEMENT — même politique que les entrées
 * "Annale" de lib/exercise-import.ts : TaekdHub ne reproduit JAMAIS l'énoncé
 * (droits d'auteur non levés), seulement des métadonnées publiques et un
 * lien vers le PORTAIL OFFICIEL du concours (page d'archives, jamais un
 * lien direct vers un PDF non vérifié — voir `resourceUrl`).
 *
 * Catalogue LIVRÉ avec l'app (`datasets/contest-papers.json`, importé par
 * lib/contests.ts), jamais copié ni migré en `localStorage` : contrairement
 * à `Exercise`/`Chapter`, ce catalogue n'est ni créé ni modifié par
 * l'utilisateur, donc aucune logique de seed/reconciliation (lib/seed.ts)
 * n'est nécessaire ici — un nouveau build livre simplement un catalogue à
 * jour. Seule la PROGRESSION de l'élève (`ContestProgress`, ci-dessous) est
 * réellement stockée, par `id` de sujet.
 */
export interface ContestPaper {
  id: string;
  competition: Competition;
  year: number;
  subject: Subject;
  /** Nom de l'épreuve, ex. "Mathématiques 1", "Physique-Chimie" — distinct du thème. */
  title: string;
  /** Thème public identifié de l'épreuve (ex. "fonction de Wallis"), ou `null` si non identifiable sans lire l'énoncé complet — jamais déduit ni inventé. */
  theme: string | null;
  kind: ContestPaperKind;
  /** Difficulté intrinsèque, ou `null` si non évaluée (nécessiterait de lire l'énoncé complet, non reproduit). */
  difficulty: Difficulty | null;
  /** Durée officielle de l'épreuve en minutes, ou `null` si non vérifiée. */
  durationMinutes: number | null;
  /**
   * Chapitres évoqués, par LIBELLÉ (pas par id) : le catalogue de chapitres
   * de l'utilisateur (lib/chapters.ts) n'a pas d'id stable connu à l'avance
   * (créé au fil des exercices, propre à chaque installation) — voir
   * `resolveContestChapters` (lib/contests.ts) qui fait la résolution
   * libellé → chapitre réel au moment de l'affichage, avec repli silencieux
   * si le chapitre n'existe pas (déjà supprimé/renommé). `[]` si le thème
   * n'a pas été identifié ou ne correspond à aucun chapitre de la banque
   * TaekdHub — jamais une couverture exhaustive inventée : l'épreuve entière
   * couvre presque toujours largement plus de notions que ce thème public.
   */
  chapterLabels: string[];
  tags: string[];
  /** Libellé source complet, ex. "Centrale-Supélec Maths 1 MP-MPI 2024". */
  source: string;
  /** Portail officiel du concours (page d'archives), jamais un lien direct vers un PDF non vérifié. `null` si aucune source fiable identifiée — voir `contestDocumentAvailability` (lib/contests.ts), qui pilote l'affichage honnête du CTA (PDF embarqué / portail officiel / indisponible). */
  resourceUrl: string | null;
  /** Lien vers un corrigé, si une source fiable existe. `null` sinon — jamais deviné. */
  correctionUrl: string | null;
  /**
   * Chemin de l'asset PDF du SUJET embarqué sous `public/contest-papers/`
   * (ex. "/contest-papers/ccinp-2024-maths1.pdf"), servi statiquement par
   * Next.js et mis en cache par le service worker dès la première ouverture
   * en ligne — donc lisible hors ligne ensuite. `null` tant qu'aucun fichier
   * vérifié n'est embarqué (voir la doc de `ContestDocumentAvailability`).
   * Un `localDocumentPath` non nul EXIGE `licenseStatus === "libre"` — imposé
   * par `scripts/validate-contests.mjs`, jamais une simple convention.
   */
  localDocumentPath: string | null;
  /** Taille en octets du PDF embarqué — uniquement quand `localDocumentPath` est renseigné, pour affichage et pour que le script de validation détecte un fichier substitué/tronqué. `null` sinon. */
  documentSizeBytes: number | null;
  /** Même principe que `localDocumentPath`, pour un CORRIGÉ embarqué séparément du sujet — un corrigé peut être disponible (ou non) indépendamment de l'énoncé. `null` tant qu'aucun corrigé n'est embarqué. */
  localCorrectionPath: string | null;
  /** Taille en octets du corrigé embarqué — même rôle que `documentSizeBytes`, pour `localCorrectionPath`. `null` sinon. */
  correctionSizeBytes: number | null;
  /** Statut de réutilisation du SUJET — voir `LicenseStatus` (lib/supabase/types.ts), même sémantique que pour un exercice importé d'un concours. Condition nécessaire (mais pas suffisante à elle seule : voir `scripts/validate-contests.mjs`) pour embarquer `localDocumentPath`. */
  licenseStatus: LicenseStatus;
  /** Précision destinée à l'élève (ex. pourquoi l'énoncé n'est pas reproduit, ce qui est identifié ou non) — `null` si non renseigné. */
  note: string | null;
}

/**
 * Progression de l'élève sur UN sujet — la SEULE chose que TaekdHub stocke
 * réellement pour les sujets de concours (voir `ContestPaper`). Une entrée
 * par sujet touché ; l'absence d'entrée pour un `paperId` donné vaut "à
 * faire, jamais favori, jamais commencé" — jamais stockée explicitement,
 * exactement comme un `Exercise` nouvellement créé n'a pas besoin d'un
 * enregistrement séparé pour dire "non commencé" (voir `withContestProgress`,
 * lib/contests.ts).
 *
 * Ne duplique JAMAIS `WorkSession`/`Exercise` : un sujet de concours garde sa
 * propre notion de progression, plus simple, sans transformer le sujet en
 * exercice ni créer un second système de séances chronométrées (consigne
 * produit du chantier — voir lib/contests.ts).
 */
export interface ContestProgress {
  paperId: string;
  status: ContestPaperStatus;
  favorite: boolean;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/** Temps investi durant la semaine figée, pour une matière — voir `WeekSnapshot`. */
export interface WeekSnapshotSubjectTime {
  subject: Subject;
  seconds: number;
}

/** Progression d'une matière au moment où la semaine a été figée — mêmes champs que `SubjectProgress` (lib/progress.ts), dupliqués ici en valeur (pas en référence) pour que le snapshot reste correct même si les règles de calcul évoluent plus tard. */
export interface WeekSnapshotSubjectProgress {
  subject: Subject;
  total: number;
  mastered: number;
  completionRate: number;
}

/**
 * Instantané figé d'une semaine ÉCOULÉE (Sprint 5) — la mémoire hebdomadaire
 * de la progression. Créé une seule fois par semaine, jamais modifié ni
 * dupliqué ensuite (voir lib/week-snapshot.ts#findMissingSnapshotWeekStart).
 *
 * `weekStart` (lundi 00:00 ISO, voir lib/week.ts#startOfWeek) sert
 * d'identifiant unique — c'est la clé de dédoublonnage.
 *
 * Approximation assumée : `activeCount`/`masteredCount`/`completionRate`/
 * `bySubjectProgress` reflètent l'état de la banque au moment de la capture
 * (`capturedAt`), pas exactement à minuit le dimanche soir — la maîtrise
 * n'étant pas elle-même historisée, c'est la meilleure donnée honnête
 * disponible sans l'inventer.
 */
export interface WeekSnapshot {
  weekStart: string;
  /** Horodatage ISO de la capture réelle — peut être postérieur de quelques jours à la fin de la semaine si l'app n'a pas été ouverte au bon moment. */
  capturedAt: string;
  totalSeconds: number;
  bySubject: WeekSnapshotSubjectTime[];
  activeCount: number;
  masteredCount: number;
  completionRate: number;
  bySubjectProgress: WeekSnapshotSubjectProgress[];
}

/**
 * Valeurs par défaut pour les champs Sprint 2.5 — proposées, à ajuster si
 * besoin (voir rapport de sprint). Utilisées à la fois pour la migration des
 * anciennes données (ci-dessous) et pour la création d'un nouvel exercice
 * (components/exercises/exercise-manager.tsx), afin de n'avoir qu'une seule
 * source de vérité pour ces défauts.
 */
export const DEFAULT_MASTERY: Mastery = 0;
const MASTERY_VALUES: readonly Mastery[] = [0, 25, 50, 75, 100];
const PROGRAMME_LEVELS: readonly ProgrammeLevel[] = ["sup", "spe", "sup_spe"];
const EXERCISE_LEVELS: readonly ExerciseLevel[] = [1, 2, 3, 4, 5, 6];
const LICENSE_STATUSES: readonly LicenseStatus[] = ["libre", "à vérifier", "restreint"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Une date ISO RÉELLEMENT exploitable, ou `null`.
 *
 * Vérifier `typeof === "string"` ne suffisait pas : une chaîne quelconque
 * ("pas-une-date", un champ tronqué par une sauvegarde interrompue, un JSON
 * édité à la main) traversait la normalisation, puis faisait lever
 * `new Date(...).toISOString()` — `RangeError: Invalid time value` — bien
 * plus loin, au moment du rendu. Comme toutes les données de TaekdHub vivent
 * dans le `localStorage` du navigateur, une seule date corrompue suffisait à
 * afficher une page BLANCHE sur toute l'application, sans aucun moyen de
 * revenir en arrière depuis l'interface (trouvé en test de destruction).
 *
 * La frontière de confiance est ici : rien d'invalide ne doit ressortir de
 * `normalize*`. Une valeur rejetée retombe sur un défaut sûr plutôt que de
 * contaminer le reste de l'app.
 */
function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : value;
}

/**
 * Correspondances des anciennes valeurs vers le modèle actuel — appliquées
 * une seule fois, à la lecture, pour que les données locales et les
 * sauvegardes déjà exportées continuent de fonctionner sans conversion
 * manuelle. Étendre ces tables au fil des sprints plutôt que d'en créer
 * ailleurs si de nouvelles valeurs sont un jour retirées/renommées.
 */
const LEGACY_SUBJECT_MAP: Record<string, Subject> = {
  Informatique: "Informatique TC",
};
const LEGACY_STATUS_MAP: Record<string, ExerciseStatus> = {
  terminé: "maîtrisé",
};

function migrateSubject(raw: unknown): Subject {
  if (typeof raw === "string") {
    if ((subjects as string[]).includes(raw)) return raw as Subject;
    if (raw in LEGACY_SUBJECT_MAP) return LEGACY_SUBJECT_MAP[raw];
  }
  return "Mathématiques";
}

function migrateStatus(raw: unknown): ExerciseStatus {
  if (typeof raw === "string") {
    if ((exerciseStatuses as string[]).includes(raw)) return raw as ExerciseStatus;
    if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
  }
  return "à faire";
}

function migrateType(raw: unknown): ExerciseType {
  if (typeof raw === "string" && (exerciseTypes as string[]).includes(raw)) return raw as ExerciseType;
  return "Personnel";
}

function migrateDifficulty(raw: unknown): Difficulty {
  return typeof raw === "number" && raw >= 1 && raw <= 5 ? (Math.round(raw) as Difficulty) : 3;
}


function migrateMastery(raw: unknown): Mastery {
  return typeof raw === "number" && (MASTERY_VALUES as number[]).includes(raw) ? (raw as Mastery) : DEFAULT_MASTERY;
}

function stringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
}

/**
 * Ramène une session, potentiellement issue d'une ancienne sauvegarde
 * (matière, champs manquants), vers la forme actuelle de `WorkSession`.
 * Exportée (Sprint 5) pour que lib/storage.test.ts vérifie directement la
 * rétrocompatibilité et le round-trip export/import de `result`, sans avoir
 * à simuler `localStorage`.
 */
export function normalizeSession(raw: unknown): WorkSession {
  const item = isRecord(raw) ? raw : {};
  const startedAt = isoDate(item.started_at) ?? new Date().toISOString();
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    /** Absent avant le Sprint 2.5 : aucune ancienne session n'était liée à un exercice. */
    exercise_id: typeof item.exercise_id === "string" ? item.exercise_id : null,
    started_at: startedAt,
    ended_at: isoDate(item.ended_at),
    duration_seconds: typeof item.duration_seconds === "number" && Number.isFinite(item.duration_seconds) ? item.duration_seconds : 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: isoDate(item.created_at) ?? startedAt,
    // Absent de toute séance antérieure à ce champ (et de toute séance libre,
    // sans exercice) : null, jamais deviné — voir la doc du champ dans
    // lib/supabase/types.ts.
    result: (ATTEMPT_RESULTS as string[]).includes(item.result as string) ? (item.result as AttemptResult) : null,
    // `null` (et non 0) quand le champ est absent ou invalide : une séance
    // enregistrée avant l'introduction de ce champ n'a PAS prouvé que l'élève
    // s'est passé d'indices — voir la doc du champ dans lib/supabase/types.ts.
    hints_used:
      typeof item.hints_used === "number" && Number.isFinite(item.hints_used) && item.hints_used >= 0
        ? Math.round(item.hints_used)
        : null,
    // `null` (et non `false`) quand le champ est absent : une séance
    // enregistrée avant l'introduction de ce champ n'a PAS prouvé que l'élève
    // s'est passé de la correction — voir la doc du champ dans
    // lib/supabase/types.ts. Traiter l'absence comme `false` créditerait
    // rétroactivement tout l'historique d'une autonomie jamais observée.
    correction_viewed: typeof item.correction_viewed === "boolean" ? item.correction_viewed : null,
  };
}

/** Ramène un exercice, potentiellement issu d'une ancienne sauvegarde (Sprint 1/2A), vers la forme actuelle de `Exercise`. */
function normalizeExercise(raw: unknown): Exercise {
  const item = isRecord(raw) ? raw : {};
  // Sprint 2.5 : `chapter` (Sprint 1/2A) devient `title` ; `chapter_id` est un
  // nouveau champ qui référencera le futur catalogue de chapitres.
  const title = typeof item.title === "string" ? item.title : typeof item.chapter === "string" ? item.chapter : "";
  // Absent de toute donnée antérieure à ce champ (import/localStorage/sauvegarde) :
  // "" par défaut, jamais deviné à partir d'un autre champ (voir la doc du
  // champ dans lib/supabase/types.ts).
  const statement = typeof item.statement === "string" ? item.statement : "";
  const createdAt = isoDate(item.created_at) ?? new Date().toISOString();
  // Sprint 2.5 : `last_opened_at` renommé `last_worked_at`.
  // Même garde que `created_at` : une date illisible ici cassait la Heatmap et le calcul de récence du moteur.
  const lastWorkedAt = isoDate(item.last_worked_at) ?? isoDate(item.last_opened_at);
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    title,
    statement,
    chapter_id: typeof item.chapter_id === "string" ? item.chapter_id : null,
    source: typeof item.source === "string" ? item.source : "",
    year: typeof item.year === "number" ? item.year : null,
    // Champs ajoutés pour l'infrastructure banque concours (sourcing/licence/
    // niveau de programme) — absents de toute donnée antérieure, normalisés à
    // `null` plutôt que devinés (voir lib/exercise-import.ts pour ce qui les
    // renseigne réellement).
    competition: typeof item.competition === "string" && item.competition.trim() ? item.competition : null,
    programme_level: (PROGRAMME_LEVELS as string[]).includes(item.programme_level as string) ? (item.programme_level as ProgrammeLevel) : null,
    license_status: (LICENSE_STATUSES as string[]).includes(item.license_status as string) ? (item.license_status as LicenseStatus) : null,
    external_id: typeof item.external_id === "string" && item.external_id.trim() ? item.external_id : null,
    source_url: typeof item.source_url === "string" && item.source_url.trim() ? item.source_url : null,
    prerequisites: stringArray(item.prerequisites),
    pedagogical_goal: typeof item.pedagogical_goal === "string" && item.pedagogical_goal.trim() ? item.pedagogical_goal : null,
    level: (EXERCISE_LEVELS as number[]).includes(item.level as number) ? (item.level as ExerciseLevel) : null,
    type: migrateType(item.type),
    difficulty: migrateDifficulty(item.difficulty),
    mastery: migrateMastery(item.mastery),
    status: migrateStatus(item.status),
    // Sprint 2.6 : `duration_minutes` n'existe plus — le temps passé se
    // calcule à la demande via `minutesSpentOnExercise` (lib/study.ts). Un
    // éventuel `duration_minutes` présent dans d'anciennes données (Sprint 1
    // à 2.5) est simplement ignoré ici, pas migré.
    estimated_minutes: typeof item.estimated_minutes === "number" ? item.estimated_minutes : null,
    attempts: typeof item.attempts === "number" ? item.attempts : 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: createdAt,
    updated_at: isoDate(item.updated_at) ?? createdAt,
    tags: stringArray(item.tags),
    favorite: Boolean(item.favorite),
    archived: Boolean(item.archived),
    hints: stringArray(item.hints),
    correction: typeof item.correction === "string" ? item.correction : null,
    last_worked_at: lastWorkedAt,
  };
}

/** Ramène un chapitre potentiellement corrompu (édition manuelle du localStorage) vers une forme valide, ou l'écarte. */
function normalizeChapter(raw: unknown): Chapter | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.id !== "string" || typeof item.label !== "string" || !item.label.trim()) return null;
  return { id: item.id, subject: migrateSubject(item.subject), label: item.label };
}

const GOAL_STATUSES: readonly GoalStatus[] = ["active", "completed", "abandoned"];
const GOAL_PRIORITIES: readonly GoalPriority[] = [1, 2, 3];

function goalSubjects(raw: unknown): Subject[] {
  const valid = stringArray(raw).filter((value): value is Subject => (subjects as string[]).includes(value));
  // Aucune matière valide (absente, corrompue, ou toutes invalides) : plutôt
  // que d'écarter l'objectif ou d'inventer une matière arbitraire, il porte
  // sur la banque entière — représente honnêtement un objectif du type
  // "préparer la semaine de rentrée" (voir la doc de `Goal`).
  return valid.length > 0 ? [...new Set(valid)] : [...subjects];
}

/**
 * Ramène un objectif potentiellement corrompu (édition manuelle du
 * localStorage, sauvegarde d'une version antérieure à ce champ) vers une
 * forme valide, ou l'écarte — même principe que `normalizeChapter`. Un
 * objectif sans titre n'a aucun sens à afficher : écarté plutôt que montré
 * vide.
 */
function normalizeGoal(raw: unknown): Goal | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.id !== "string" || typeof item.title !== "string" || !item.title.trim()) return null;
  const createdAt = isoDate(item.createdAt) ?? new Date().toISOString();
  return {
    id: item.id,
    title: item.title.trim(),
    subjects: goalSubjects(item.subjects),
    chapterIds: stringArray(item.chapterIds),
    targetDate: item.targetDate === null ? null : (isoDate(item.targetDate) ?? null),
    priority: (GOAL_PRIORITIES as number[]).includes(item.priority as number) ? (item.priority as GoalPriority) : 2,
    status: (GOAL_STATUSES as string[]).includes(item.status as string) ? (item.status as GoalStatus) : "active",
    createdAt,
    updatedAt: isoDate(item.updatedAt) ?? createdAt,
  };
}

const CONTEST_PAPER_STATUSES: readonly ContestPaperStatus[] = ["à faire", "en cours", "fait"];

/** Ramène une progression de sujet potentiellement corrompue (édition manuelle du localStorage, ancienne sauvegarde) vers une forme valide, ou l'écarte — même principe que `normalizeGoal`. Une entrée sans `paperId` exploitable ne référence rien : écartée plutôt que conservée orpheline. */
function normalizeContestProgress(raw: unknown): ContestProgress | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.paperId !== "string" || !item.paperId.trim()) return null;
  const updatedAt = isoDate(item.updatedAt) ?? new Date().toISOString();
  return {
    paperId: item.paperId,
    status: (CONTEST_PAPER_STATUSES as string[]).includes(item.status as string) ? (item.status as ContestPaperStatus) : "à faire",
    favorite: Boolean(item.favorite),
    startedAt: isoDate(item.startedAt),
    completedAt: isoDate(item.completedAt),
    updatedAt,
  };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeWeekSnapshotSubjectTime(raw: unknown): WeekSnapshotSubjectTime | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.subject !== "string" || !isNumber(item.seconds)) return null;
  return { subject: migrateSubject(item.subject), seconds: item.seconds };
}

function normalizeWeekSnapshotSubjectProgress(raw: unknown): WeekSnapshotSubjectProgress | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.subject !== "string" || !isNumber(item.total) || !isNumber(item.mastered) || !isNumber(item.completionRate)) return null;
  return { subject: migrateSubject(item.subject), total: item.total, mastered: item.mastered, completionRate: item.completionRate };
}

/** Ramène un snapshot hebdomadaire potentiellement corrompu vers une forme valide, ou l'écarte — entièrement généré par l'app (jamais saisi ni importé), donc peu de cas réels à couvrir. */
function normalizeWeekSnapshot(raw: unknown): WeekSnapshot | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.weekStart !== "string" || typeof item.capturedAt !== "string") return null;
  if (!isNumber(item.totalSeconds) || !isNumber(item.activeCount) || !isNumber(item.masteredCount) || !isNumber(item.completionRate)) return null;
  return {
    weekStart: item.weekStart,
    capturedAt: item.capturedAt,
    totalSeconds: item.totalSeconds,
    bySubject: Array.isArray(item.bySubject) ? item.bySubject.map(normalizeWeekSnapshotSubjectTime).filter((entry): entry is WeekSnapshotSubjectTime => entry !== null) : [],
    activeCount: item.activeCount,
    masteredCount: item.masteredCount,
    completionRate: item.completionRate,
    bySubjectProgress: Array.isArray(item.bySubjectProgress)
      ? item.bySubjectProgress.map(normalizeWeekSnapshotSubjectProgress).filter((entry): entry is WeekSnapshotSubjectProgress => entry !== null)
      : [],
  };
}

/** Nombre de minutes réellement exploitable (fini, strictement positif), ou le défaut — voir `normalizePreferences`. */
function positiveMinutes(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Fusionne une préférence potentiellement partielle/corrompue (import, ancienne
 * sauvegarde, édition manuelle du localStorage) avec `defaults` — même principe
 * que `normalizeExercise`/`normalizeChapter` : un champ absent ou invalide
 * retombe sur sa valeur par défaut plutôt que de propager une valeur incohérente.
 *
 * `dailyGoalMinutes`/`weeklyGoalMinutes` : un nombre négatif, nul ou NaN
 * (localStorage édité à la main, sauvegarde bricolée) traversait auparavant
 * cette fonction tel quel — le Dashboard affichait ensuite littéralement
 * « 45 / -50 min » et un anneau à 0 %, ou pire, un `contestDate` illisible
 * transformait le compte à rebours du concours en « NaN jours ». Trouvé en
 * testant des valeurs volontairement absurdes (Phase 12 de l'audit) : ni
 * l'un ni l'autre ne faisait planter l'app, mais tous deux affichaient un
 * nombre incohérent à l'élève — même défaut de fond que les champs déjà
 * validés ci-dessus, resté sans garde ici. `themeMode`, déjà protégé, garde
 * son traitement dédié (posé tel quel en attribut DOM par `applyThemeMode`).
 */
export function normalizePreferences(raw: unknown): Preferences {
  const item = isRecord(raw) ? raw : {};
  const merged = { ...defaults, ...item };
  return {
    ...merged,
    displayName: typeof item.displayName === "string" ? item.displayName : defaults.displayName,
    dailyGoalMinutes: positiveMinutes(item.dailyGoalMinutes, defaults.dailyGoalMinutes),
    weeklyGoalMinutes: positiveMinutes(item.weeklyGoalMinutes, defaults.weeklyGoalMinutes),
    // "" (aucun concours réglé) reste "" ; une chaîne présente mais
    // illisible comme date retombe sur "" plutôt que de propager un NaN
    // jusqu'au calcul des jours restants (voir components/dashboard-
    // overview.tsx#contestDays).
    contestDate: item.contestDate === "" ? "" : (isoDate(item.contestDate) ?? defaults.contestDate),
    themeMode: (THEME_MODES as string[]).includes(item.themeMode as string) ? (item.themeMode as ThemeMode) : DEFAULT_THEME_MODE,
  };
}

/**
 * Lecture BLINDÉE d'une liste stockée localement.
 *
 * Les fonctions `normalize*` sont la frontière de confiance pour le CONTENU,
 * mais rien ne protégeait l'analyse elle-même : un `localStorage` corrompu
 * (quota atteint en pleine écriture, extension de navigateur, synchronisation
 * interrompue, édition manuelle) faisait lever `JSON.parse` — erreur non
 * rattrapée, remontée telle quelle dans le rendu. Vérifié en test de
 * destruction : une seule clé illisible suffisait.
 *
 * Une valeur qui n'est pas un tableau est traitée comme absente pour la même
 * raison : `JSON.parse("42").map` lèverait tout autant.
 */
function readList(key: string): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Pendant de `readList` pour un objet unique (préférences) — voir sa documentation. */
function readRecord(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

export const localData = {
  sessions: (): WorkSession[] => (typeof window === "undefined" ? [] : readList(sessionsKey).map(normalizeSession)),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] => (typeof window === "undefined" ? [] : readList(exercisesKey).map(normalizeExercise)),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
  chapters: (): Chapter[] =>
    typeof window === "undefined" ? [] : readList(chaptersKey).map(normalizeChapter).filter((item): item is Chapter => item !== null),
  saveChapters: (items: Chapter[]) => localStorage.setItem(chaptersKey, JSON.stringify(items)),
  preferences: (): Preferences => (typeof window === "undefined" ? defaults : normalizePreferences(readRecord(preferencesKey))),
  savePreferences: (preferences: Preferences) => localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
  /** Horodatage ISO de la dernière sauvegarde exportée (voir `exportBackup`), ou `null` si aucune n'a jamais été faite. */
  lastBackupAt: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(lastBackupKey)),
  saveLastBackupAt: (iso: string) => localStorage.setItem(lastBackupKey, iso),
  weekSnapshots: (): WeekSnapshot[] =>
    typeof window === "undefined" ? [] : readList(weekSnapshotsKey).map(normalizeWeekSnapshot).filter((item): item is WeekSnapshot => item !== null),
  saveWeekSnapshots: (items: WeekSnapshot[]) => localStorage.setItem(weekSnapshotsKey, JSON.stringify(items)),
  goals: (): Goal[] => (typeof window === "undefined" ? [] : readList(goalsKey).map(normalizeGoal).filter((item): item is Goal => item !== null)),
  saveGoals: (items: Goal[]) => localStorage.setItem(goalsKey, JSON.stringify(items)),
  contestProgress: (): ContestProgress[] =>
    typeof window === "undefined" ? [] : readList(contestProgressKey).map(normalizeContestProgress).filter((item): item is ContestProgress => item !== null),
  saveContestProgress: (items: ContestProgress[]) => localStorage.setItem(contestProgressKey, JSON.stringify(items)),
};

/**
 * Au-delà de ce nombre de jours sans export, la sauvegarde est périmée.
 *
 * SEPT jours, et pas quatorze comme auparavant : TaekdHub n'a pas de compte,
 * tout vit dans le stockage local du navigateur. Or Safari (iOS comme macOS)
 * efface le stockage local d'un site avec lequel l'utilisateur n'a pas
 * interagi depuis 7 jours. Le filet de sécurité se déclenchait donc APRÈS la
 * menace qu'il est censé couvrir : une semaine de vacances suffisait à tout
 * perdre sans que le rappel se soit jamais affiché.
 */
export const BACKUP_REMINDER_DAYS = 7;

/** Jours écoulés depuis la dernière sauvegarde, ou `null` si aucune n'a jamais été faite (distinct de 0, qui signifie "aujourd'hui"). */
export function daysSinceBackup(lastBackupAt: string | null, now: Date = new Date()): number | null {
  if (!lastBackupAt) return null;
  return Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86400000);
}

/**
 * Point d'export unique (finalisation V1) — réutilisé par Réglages (bouton
 * "Exporter") et par le rappel de sauvegarde du Dashboard, pour ne jamais
 * dupliquer le mécanisme de sauvegarde. Enregistre l'horodatage à chaque
 * export réussi, seule donnée nouvelle introduite par le rappel.
 */
export function exportBackup(): void {
  const data = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: localData.exercises(),
      sessions: localData.sessions(),
      preferences: localData.preferences(),
      // `chapters` (Sprint 3D) : indispensable dans la sauvegarde — les
      // exercices y renvoient par `chapter_id`. Sans lui, un changement
      // d'ordinateur restaurerait des exercices avec des chapitres
      // fantômes (chapter_id pointant vers un catalogue vide).
      chapters: localData.chapters(),
      weekSnapshots: localData.weekSnapshots(),
      goals: localData.goals(),
      // Progression des sujets de concours (chantier banque de sujets) —
      // indispensable dans la sauvegarde : le catalogue lui-même est livré
      // avec l'app (jamais stocké), donc SEULE cette progression serait
      // perdue sans elle lors d'un changement d'appareil.
      contestProgress: localData.contestProgress(),
    },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taekdhub-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  localData.saveLastBackupAt(new Date().toISOString());
}

/**
 * Forme d'un fichier de sauvegarde exporté par components/data-backup.tsx.
 * `weekSnapshots` est optionnel : une sauvegarde exportée avant le Sprint
 * 2.1 n'a pas ce champ — voir `validateBackupPayload` et
 * components/data-backup.tsx#confirmImport, qui restaurent `[]` dans ce cas.
 */
export interface BackupPayload {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: WorkSession[];
  preferences: Preferences;
  /** Optionnel : une sauvegarde exportée avant l'ajout des chapitres à l'export n'a pas ce champ ; restauré à `[]` dans ce cas (voir components/data-backup.tsx#confirmImport). */
  chapters?: Chapter[];
  weekSnapshots?: WeekSnapshot[];
  /** Optionnel : une sauvegarde exportée avant l'introduction des objectifs (Adaptive Planning Engine) n'a pas ce champ ; restauré à `[]` dans ce cas — même principe que `chapters`/`weekSnapshots`. */
  goals?: Goal[];
  /** Optionnel : une sauvegarde exportée avant le chantier banque de sujets de concours n'a pas ce champ ; restauré à `[]` dans ce cas — même principe que `goals`. */
  contestProgress?: ContestProgress[];
}

/**
 * Vérifie la forme MINIMALE d'un JSON importé (frontière de confiance du
 * fichier utilisateur — voir components/data-backup.tsx). Volontairement
 * permissif sur les valeurs de `subject`/`status` (juste `string`, pas la
 * liste exacte) et accepte aussi bien `title` (Sprint 2.5) que l'ancien
 * `chapter` (Sprint 1/2A) : une sauvegarde exportée avant ce sprint doit
 * rester importable, `normalizeExercise`/`normalizeSession` se chargent
 * ensuite de migrer ses valeurs au prochain chargement.
 */
function isValidExerciseShape(value: unknown): value is Exercise {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.subject === "string" &&
    (typeof value.title === "string" || typeof value.chapter === "string") &&
    typeof value.source === "string" &&
    typeof value.difficulty === "number" &&
    typeof value.status === "string" &&
    // `duration_minutes` n'est plus exigé (Sprint 2.6) : les sauvegardes
    // exportées désormais ne l'ont plus (valeur dérivée, jamais stockée) ;
    // celles exportées avant ce sprint l'ont encore mais il est ignoré.
    typeof value.created_at === "string"
  );
}

function isValidSessionShape(value: unknown): value is WorkSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.subject === "string" &&
    typeof value.started_at === "string" &&
    typeof value.duration_seconds === "number"
  );
}

export function validateBackupPayload(data: unknown): data is BackupPayload {
  if (!isRecord(data)) return false;
  if (!Array.isArray(data.exercises) || !data.exercises.every(isValidExerciseShape)) return false;
  if (!Array.isArray(data.sessions) || !data.sessions.every(isValidSessionShape)) return false;
  if (!isRecord(data.preferences)) return false;
  // Absent (sauvegarde d'avant le Sprint 2.1) ou tableau — jamais required :
  // c'est tout le sens de la rétrocompatibilité ici. La forme fine de chaque
  // entrée est revalidée par `normalizeWeekSnapshot` à la prochaine lecture
  // (même principe que exercises/sessions, voir plus haut).
  if (data.weekSnapshots !== undefined && !Array.isArray(data.weekSnapshots)) return false;
  // Idem : absent d'une sauvegarde exportée avant l'ajout des chapitres à
  // l'export ; chaque entrée est revalidée par `normalizeChapter` à la lecture.
  if (data.chapters !== undefined && !Array.isArray(data.chapters)) return false;
  // Idem : absent d'une sauvegarde exportée avant l'introduction des
  // objectifs ; chaque entrée est revalidée par `normalizeGoal` à la lecture.
  if (data.goals !== undefined && !Array.isArray(data.goals)) return false;
  // Idem : absent d'une sauvegarde exportée avant le chantier banque de
  // sujets de concours ; chaque entrée est revalidée par
  // `normalizeContestProgress` à la lecture.
  if (data.contestProgress !== undefined && !Array.isArray(data.contestProgress)) return false;
  return true;
}
