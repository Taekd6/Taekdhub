import { subjects } from "@/lib/study";
import type { ExerciseRecommendation } from "@/lib/recommendation";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * COUVERTURE — la question qu'aucun module ne posait : « qu'est-ce que je
 * suis en train d'abandonner ? »
 *
 * Le moteur répond très bien à « quel exercice maintenant »
 * (lib/recommendation.ts) et le plan à « comment répartir mon temps entre
 * intentions » (lib/plan.ts). Ni l'un ni l'autre ne peut voir qu'une matière
 * entière n'a pas été touchée depuis trois semaines : `urgencyScore` additionne
 * onze termes dont aucun ne compte les jours de silence d'une matière, et
 * `diversifyByChapter` ne diversifie QUE la liste déjà classée — si le budget
 * se vide avant le deuxième tour, la matière disparaît sans que rien ne le
 * signale.
 *
 * ## Le délaissement est un défaut de CONTACT, pas un déficit de temps
 * Mesurer le délaissement en minutes conduirait mécaniquement à l'uniformité,
 * et sur cette banque à une absurdité : imposer autant de temps à
 * Informatique TC (20 exercices) qu'aux Mathématiques (196). Le produit tient
 * déjà la bonne intuition dans `neglectedSubjects` (lib/week.ts), qui ne dit
 * pas « peu de temps » mais « zéro seconde ET du travail en attente ».
 *
 * Ici : une matière est délaissée quand elle a été RÉELLEMENT travaillée au
 * moins une fois, qu'il lui reste du travail, et qu'aucune séance n'y a touché
 * depuis plus de `SUBJECT_DEBT_DAYS` jours. Trois conditions, toutes
 * décidables, aucune pondération.
 *
 * ## Équilibre ≠ égalité
 * Rien ici ne vise la parité de temps. 70 % maths / 5 % chimie est parfaitement
 * légitime TANT QUE la chimie reste touchée dans son cycle. Ce module ne
 * réclame jamais une part du budget : il réclame un CONTACT.
 *
 * ## Ce qu'il ne prétend pas savoir
 * - Le travail fait hors de TaekdHub est invisible. « Sans contact » signifie
 *   toujours « sans contact DANS TaekdHub » — les libellés le disent.
 * - Une matière jamais ouverte n'est pas délaissée : c'est peut-être un
 *   chapitre pas encore traité en cours, information que l'app ne possède pas.
 *   D'où un état « jamais ouverte » distinct, jamais fondu dans « délaissée »
 *   (même principe que « jamais testée » dans lib/notions.ts).
 */

/**
 * Au-delà de dix jours sans contact réel, une matière encore inachevée est
 * considérée comme délaissée.
 *
 * Valeur choisie DANS l'échelle que le produit utilise déjà, pas importée
 * d'ailleurs : `CHAPTER_STALE_DAYS` vaut 7 (un chapitre non retravaillé se
 * signale à une semaine) et `MASTERY_STALE_DAYS` vaut 21 (au-delà, un exercice
 * maîtrisé redevient éligible). Une matière entière est un objet plus gros
 * qu'un chapitre et plus petit qu'un exercice maîtrisé : son seuil se place
 * entre les deux. L'invariant `CHAPTER_STALE_DAYS < SUBJECT_DEBT_DAYS <
 * MASTERY_STALE_DAYS` est testé, pour que les trois horloges du produit ne
 * dérivent jamais l'une par rapport aux autres.
 *
 * Aucune littérature ne fixe l'intervalle optimal de ré-exposition d'une
 * matière de prépa — il n'existe ni item atomique, ni test de rappel, ni
 * mesure de rétention dans cette app. Ce seuil est donc une convention
 * assumée et cohérente, jamais un résultat scientifique déguisé.
 */
export const SUBJECT_DEBT_DAYS = 10;

/** État de contact d'une matière — quatre cas mutuellement exclusifs, tous décidables sans pondération. */
export type CoverageState = "à jour" | "délaissée" | "jamais ouverte" | "à jour (rien en attente)";

export interface SubjectCoverage {
  subject: Subject;
  /** Exercices actifs de la matière — 0 signifie que la matière n'existe pas dans cette banque. */
  activeCount: number;
  /** Exercices de la matière encore retenus par le moteur (le « reste à faire » réel, jamais une estimation). */
  pendingCount: number;
  /** Dernière séance RÉELLE (une `WorkSession` sur un exercice de la matière), `null` si aucune. Proposer n'est pas travailler. */
  lastContact: string | null;
  /** Jours entiers depuis `lastContact` — `null` si la matière n'a jamais été travaillée. */
  daysSinceContact: number | null;
  /** `true` dès qu'une séance a réellement touché la matière. */
  engaged: boolean;
  state: CoverageState;
  /** Jours de retard au-delà du seuil — 0 sauf pour une matière délaissée. Sert au classement, jamais à un score. */
  debtDays: number;
}

/** En dessous de cette durée, une séance ne contient en pratique qu'un seul exercice — le régime de couverture y est différent (voir `coverageDebtThresholdFor`). */
export const SHORT_SESSION_MINUTES = 45;

/**
 * Ancienneté qu'une matière doit atteindre pour mériter l'unique place d'une
 * SÉANCE COURTE.
 *
 * Volontairement égal à `MASTERY_STALE_DAYS` (lib/recommendation.ts) : au-delà
 * de trois semaines, le produit considère déjà qu'un exercice maîtrisé
 * redevient éligible. C'est la plus longue horloge qu'il tolère ; une matière
 * entièrement silencieuse au-delà ne « dort » plus, elle décroche. L'égalité
 * est testée, pour que les deux ne dérivent pas l'une de l'autre.
 */
export const SHORT_SESSION_DEBT_DAYS = 21;

/**
 * Nombre de places réservées à la couverture selon le budget.
 *
 * Une place, pas une enveloppe : c'est la leçon des deux régressions déjà
 * corrigées dans lib/plan.ts (une part de 32 min n'accueille pas un exercice
 * de 35 min ; une part de 15 min n'accueille aucun exercice). Réserver
 * « 15 minutes de chimie » est une promesse invérifiable ; réserver « cet
 * exercice de chimie » est un fait testable.
 *
 * ## Pourquoi les séances courtes ont fini par obtenir une place
 * Ce module a d'abord refusé toute couverture sous 45 minutes, au motif
 * qu'avec un seul exercice au programme, sacrifier le point faible du jour
 * était un mauvais échange. Le rejeu de 90 jours a montré que l'arbitrage
 * n'était pas celui-là : un élève à 20 min/jour qui échoue ne voyait QUE des
 * mathématiques sur trois mois. Le vrai choix n'était pas « point faible
 * aujourd'hui contre couverture aujourd'hui », mais « point faible tous les
 * jours pendant trois mois contre toucher la chimie une seule fois ».
 *
 * Une séance courte reçoit donc une place — mais sous une barre bien plus
 * haute (`SHORT_SESSION_DEBT_DAYS`), atteinte rarement. Concrètement, la
 * matière la plus silencieuse récupère environ une séance toutes les trois
 * semaines ; tout le reste continue d'aller au point faible.
 */
export function coverageSlotsFor(budgetMinutes: number): number {
  if (budgetMinutes < 120) return 1;
  return 2;
}

/**
 * Ancienneté minimale pour qu'une matière mérite une place, selon le budget.
 *
 * Deux régimes, un seul principe : plus la séance est courte, plus la preuve
 * doit être forte pour lui prendre sa seule place.
 */
export function coverageDebtThresholdFor(budgetMinutes: number): number {
  return budgetMinutes < SHORT_SESSION_MINUTES ? SHORT_SESSION_DEBT_DAYS : SUBJECT_DEBT_DAYS;
}

/** Préfixe de la raison portée par un exercice retenu au titre de la couverture.
 *
 * Volontairement DISTINCT de « Non retravaillé depuis » : `planIntent`
 * (lib/plan.ts) teste ce préfixe-là pour classer un exercice en « réviser ».
 * Une raison de couverture mal préfixée déplacerait silencieusement l'exercice
 * d'intention et casserait la structure annoncée à l'élève. */
export const COVERAGE_REASON_PREFIX = "Zone délaissée : ";

/** Jours entiers écoulés — même convention que `daysSinceLastWorked` (lib/recommendation.ts). */
function daysBetween(from: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(from).getTime()) / 86400000);
}

/**
 * État de contact de chaque matière portant du contenu.
 *
 * Prend les candidats DÉJÀ calculés par `recommendExercises` plutôt que
 * d'appeler le moteur lui-même : c'est ce qui garantit qu'il n'existe qu'une
 * seule définition de « reste à faire » dans tout le produit, et que
 * `computeDailyPlan` n'appelle le moteur qu'une fois (contrainte de
 * performance ET d'architecture — voir les tests d'invariants).
 *
 * Les matières sans aucun exercice actif (Français, Anglais, Informatique Spé
 * dans la banque livrée) sont omises : une zone vide ne peut pas être
 * délaissée, et l'afficher comme telle serait un reproche sans objet.
 */
export function computeSubjectCoverage(
  candidates: ExerciseRecommendation[],
  exercises: Exercise[],
  sessions: WorkSession[],
  now: Date = new Date()
): SubjectCoverage[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  const activeById = new Map(active.map((exercise) => [exercise.id, exercise]));

  const pendingBySubject = new Map<Subject, number>();
  for (const candidate of candidates) {
    if (candidate.exercise.archived) continue;
    pendingBySubject.set(candidate.exercise.subject, (pendingBySubject.get(candidate.exercise.subject) ?? 0) + 1);
  }

  // Dernier contact RÉEL : une séance rattachée à un exercice encore présent
  // et actif. Une séance libre (`exercise_id` nul) porte bien une matière,
  // mais rien ne dit sur quoi elle a porté — elle ne prouve donc pas le
  // contact avec le travail restant, et n'est pas comptée.
  const lastContactBySubject = new Map<Subject, string>();
  for (const session of sessions) {
    if (!session.exercise_id) continue;
    const exercise = activeById.get(session.exercise_id);
    if (!exercise) continue;
    // Une date illisible ou postérieure à maintenant est ÉCARTÉE, jamais
    // ramenée à zéro : les deux cas masquaient une matière réellement
    // délaissée en la déclarant « à jour », et la chaîne brute remontait
    // jusqu'à l'objet rendu. Même principe de seconde ligne de défense que
    // `daysSinceLastWorked` (lib/recommendation.ts).
    const startedAt = new Date(session.started_at).getTime();
    if (Number.isNaN(startedAt) || startedAt > now.getTime()) continue;
    const current = lastContactBySubject.get(exercise.subject);
    if (!current || startedAt > new Date(current).getTime()) {
      lastContactBySubject.set(exercise.subject, session.started_at);
    }
  }

  return subjects
    .map((subject) => {
      const activeCount = active.filter((exercise) => exercise.subject === subject).length;
      const pendingCount = pendingBySubject.get(subject) ?? 0;
      const lastContact = lastContactBySubject.get(subject) ?? null;
      const daysSinceContact = lastContact ? Math.max(0, daysBetween(lastContact, now)) : null;
      const engaged = lastContact !== null;

      let state: CoverageState;
      if (pendingCount === 0) state = "à jour (rien en attente)";
      else if (!engaged) state = "jamais ouverte";
      else if ((daysSinceContact ?? 0) > SUBJECT_DEBT_DAYS) state = "délaissée";
      else state = "à jour";

      return {
        subject,
        activeCount,
        pendingCount,
        lastContact,
        daysSinceContact,
        engaged,
        state,
        debtDays: state === "délaissée" ? (daysSinceContact ?? 0) - SUBJECT_DEBT_DAYS : 0,
      };
    })
    .filter((entry) => entry.activeCount > 0);
}

/**
 * Les matières à servir en priorité au titre de la couverture, de la plus en
 * retard à la moins en retard.
 *
 * Départage par nom de matière à dette égale : l'ordre doit être strictement
 * déterministe, jamais dépendant de l'ordre incident d'un tableau.
 */
export function findNeglectedSubjects(coverage: SubjectCoverage[]): SubjectCoverage[] {
  return coverage
    .filter((entry) => entry.state === "délaissée")
    .sort((a, b) => b.debtDays - a.debtDays || a.subject.localeCompare(b.subject, "fr"));
}

/**
 * Les matières en retard que le plan ne touchera PAS — quel que soit le
 * chemin par lequel un exercice y serait entré.
 *
 * Définition UNIQUE, partagée par le moteur (`DailyPlan.deferred`) et par
 * l'écran. Elles ont divergé une fois : le plan filtrait sur les matières
 * n'ayant pas obtenu de PLACE DE COUVERTURE, l'écran sur celles qu'aucun
 * exercice ne touchait. Une matière servie par la consolidation ordinaire
 * était donc « laissée de côté » pour l'un et servie pour l'autre — deux
 * réponses à une même phrase affichée. C'est la seconde qui est juste : ce
 * qui compte pour l'élève, c'est que sa matière soit travaillée, pas par
 * quel mécanisme elle a été retenue.
 */
export function deferredSubjects(coverage: SubjectCoverage[], touchedSubjects: Subject[]): SubjectCoverage[] {
  const touched = new Set(touchedSubjects);
  return findNeglectedSubjects(coverage).filter((entry) => !touched.has(entry.subject));
}

/**
 * LE CHIFFRE À MONTRER : le plus long silence, jamais une moyenne.
 *
 * Une moyenne se laisse compenser — trois matières fraîches masquent une
 * matière abandonnée depuis un mois, ce qui est exactement la chose à
 * détecter. Le maximum, lui, ne se compense pas.
 *
 * `null` quand aucune matière engagée n'attend : il n'y a alors rien d'honnête
 * à signaler, et le produit se tait plutôt que d'inventer une inquiétude.
 */
export function longestSilence(coverage: SubjectCoverage[]): SubjectCoverage | null {
  const waiting = coverage.filter((entry) => entry.pendingCount > 0 && entry.engaged && entry.daysSinceContact !== null);
  if (waiting.length === 0) return null;
  return waiting.reduce((worst, entry) =>
    (entry.daysSinceContact ?? 0) > (worst.daysSinceContact ?? 0) ||
    ((entry.daysSinceContact ?? 0) === (worst.daysSinceContact ?? 0) && entry.subject.localeCompare(worst.subject, "fr") < 0)
      ? entry
      : worst
  );
}
