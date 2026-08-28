"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, PlayCircle, Sparkles, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { FOCUS_TIMER_PREFIX, FocusView } from "@/components/exercises/focus-view";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { findPersistedSessionSuffix } from "@/hooks/use-work-timer";
import { levelFromXp, totalXp } from "@/lib/gamification";
import { computeExerciseBankStats, estimatedDurationMinutes, explainReasons, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import { computeNextAction } from "@/lib/next-action";
import { PLAN_STORAGE_KEY, type StoredPlan } from "@/lib/plan";
import { subjects, todaySeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { AttemptResult, Exercise, Subject } from "@/lib/supabase/types";

type Phase = "loading" | "empty" | "preview" | "focus" | "between" | "summary";

/** Préréglages de temps disponible (Sprint 4) — un point de départ rapide, le champ à côté reste éditable pour toute autre valeur. */
const BUDGET_PRESETS = [15, 30, 45, 60];
/** Préréglages "par nombre d'exercices" (révisions intelligentes) — même logique que BUDGET_PRESETS, pour l'autre façon de dimensionner une séance. */
const COUNT_PRESETS = [5, 10, 15, 20];
/** Deux façons équivalentes de dimensionner la séance à venir — voir `recommendExercises` (lib/recommendation.ts) : `availableMinutes` pour la première, `limit` seul pour la seconde. Aucune troisième source de vérité, juste deux paramètres différents passés au même moteur. */
type SizingMode = "time" | "count";

/**
 * Séance de travail intelligente (Sprint 3C, bornée par le temps depuis le
 * Sprint 4).
 *
 * `recommendExercises` (lib/recommendation.ts) est l'UNIQUE moteur de
 * sélection — ce composant ne fait qu'orchestrer l'affichage d'une file
 * d'exercices déjà classés, un par un, via `FocusView` réutilisé sans
 * aucune modification. Le budget de temps choisi dans l'aperçu (`budgetMinutes`)
 * est transmis tel quel à `recommendExercises` — aucune règle de sélection
 * n'est dupliquée ici.
 *
 * IMPORTANT (précision produit) : quitter le Focus signifie "exercice
 * travaillé", jamais "exercice réussi". Le statut et la maîtrise ne
 * changent QUE si l'utilisateur les modifie explicitement dans `FocusView`
 * (MasteryPicker / boutons de statut, déjà existants) —
 * ce composant ne les touche jamais lui-même.
 *
 * Contexte matière (Sprint 3.1, depuis "Prêt pour le DS ?" — lib/readiness.ts) :
 * `/session?subject=<matière>` restreint la banque considérée à cette seule
 * matière AVANT l'appel à `recommendExercises` — le moteur lui-même n'est ni
 * modifié ni dupliqué, seule la liste d'exercices qu'on lui passe change.
 * `/session` sans paramètre garde exactement le comportement d'avant.
 */
export function SessionRunner() {
  const { exercises, sessions, preferences, saveSessions, saveExercises, ready } = usePrepahubData();
  const [phase, setPhase] = useState<Phase>("loading");
  const [recommendations, setRecommendations] = useState<ExerciseRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visitedCount, setVisitedCount] = useState(0);
  /** Résultats saisis (Focus View) durant cette séance, un par exercice qualifié — pour le résumé de fin de séance. Ni sauvegarde ni source de vérité : purement l'affichage, `WorkSession.result` reste la seule donnée persistée. */
  const [runResults, setRunResults] = useState<AttemptResult[]>([]);
  /** Temps disponible pour la séance à venir, en minutes — initialisé à l'objectif du jour restant, ajustable via les préréglages ou le champ libre. */
  const [budgetMinutes, setBudgetMinutes] = useState(0);
  /** Façon de dimensionner la séance à venir — "time" (comportement historique) ou "count", un nombre d'exercices fixe sans notion de durée. */
  const [sizingMode, setSizingMode] = useState<SizingMode>("time");
  const [countTarget, setCountTarget] = useState(10);
  /** Matière imposée par `?subject=`, ou `null` pour une séance normale (toute la banque) — voir la note Sprint 3.1 ci-dessus. */
  const [contextSubject, setContextSubject] = useState<Subject | null>(null);
  /** Sélection déposée par le Dashboard ("Commencer le plan") ou par la banque d'exercices ("Séance libre", voir lib/plan.ts) — remplace `computedSelection` tel quel quand elle est présente, jamais recalculée ici. `null` : comportement normal, inchangé. */
  const [planSelection, setPlanSelection] = useState<ExerciseRecommendation[] | null>(null);
  /** D'où vient `planSelection` — distingue uniquement le texte affiché à l'écran d'aperçu (voir StoredPlan.source, lib/plan.ts) ; la mécanique de séance est identique dans les deux cas. */
  const [planSource, setPlanSource] = useState<"plan-du-jour" | "libre">("plan-du-jour");
  const initialized = useRef(false);
  /** XP au tout premier rendu prêt de cette séance — jamais recalculé ensuite,
      pour que l'écran de fin puisse montrer "+N XP" (et un passage de niveau)
      gagnés PENDANT cette séance précisément, pas l'XP total qui inclut tout
      le travail des séances précédentes. Même moteur que la sidebar
      (lib/gamification.ts) : aucune deuxième formule d'XP. */
  const initialXpRef = useRef<number | null>(null);

  // Décide une seule fois, au montage, entre reprendre un focus interrompu
  // (même mécanisme que exercise-manager.tsx) et proposer un nouvel aperçu de
  // séance — la sélection définitive n'est calculée qu'au clic sur "Commencer
  // ma séance" (voir startSession), une fois le budget choisi.
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const subjectParam = params.get("subject");
    const scopedSubject = subjectParam && (subjects as string[]).includes(subjectParam) ? (subjectParam as Subject) : null;
    setContextSubject(scopedSubject);
    const scoped = scopedSubject ? exercises.filter((item) => item.subject === scopedSubject) : exercises;

    // `?minutes=<n>` (Sprint 7, lien "Tu as N min ?" du Dashboard) : préremplit
    // le budget de temps avec la valeur choisie hors de cette page, à la
    // place de l'objectif du jour restant — un choix explicite prime sur le
    // calcul par défaut. Ignoré si absent/invalide : comportement inchangé.
    const minutesParam = Number(params.get("minutes"));
    const requestedMinutes = Number.isFinite(minutesParam) && minutesParam > 0 ? Math.round(minutesParam) : null;

    const pendingId = findPersistedSessionSuffix(FOCUS_TIMER_PREFIX);
    const pending = pendingId ? exercises.find((item) => item.id === pendingId && !item.archived) : undefined;

    if (pending) {
      const rest = recommendExercises(scoped, sessions).filter((item) => item.exercise.id !== pending.id);
      setRecommendations([{ exercise: pending, score: 0, reasons: ["Séance reprise"] }, ...rest]);
      setPhase("focus");
      return;
    }

    // Plan du jour (Sprint Plan de travail) : un plan déposé par le Dashboard
    // ("Commencer le plan") prime sur le calcul habituel ci-dessous — mêmes
    // exercices, même ordre, AUCUNE recommandation recalculée ici (voir
    // lib/plan.ts#computeDailyPlan, qui a déjà tranché). Clé retirée dès
    // lecture : c'est un transfert à usage unique, pas un état persistant.
    const storedPlanRaw = sessionStorage.getItem(PLAN_STORAGE_KEY);
    if (storedPlanRaw) {
      sessionStorage.removeItem(PLAN_STORAGE_KEY);
      try {
        const stored = JSON.parse(storedPlanRaw) as StoredPlan;
        const picks = stored.items
          .map(({ exerciseId, reasons }) => {
            const exercise = exercises.find((item) => item.id === exerciseId && !item.archived);
            return exercise ? { exercise, score: 0, reasons } : null;
          })
          .filter((item): item is ExerciseRecommendation => item !== null);
        if (picks.length > 0) {
          setPlanSelection(picks);
          setPlanSource(stored.source ?? "plan-du-jour");
          setBudgetMinutes(stored.requestedMinutes);
          setPhase("preview");
          return;
        }
      } catch {
        // Plan corrompu ou périmé (exercices supprimés entre-temps) : on retombe sur le comportement normal ci-dessous.
      }
    }

    const hasAnyEligible = computeExerciseBankStats(scoped, sessions).toReviewCount > 0;
    if (!hasAnyEligible) {
      setPhase("empty");
      return;
    }

    const remainingToday = Math.max(0, preferences.dailyGoalMinutes - secondsToWholeMinutes(todaySeconds(sessions)));
    setBudgetMinutes(requestedMinutes ?? remainingToday);
    setPhase("preview");
  }, [ready, exercises, sessions, preferences.dailyGoalMinutes]);

  // Capturé une seule fois, au tout premier rendu prêt — voir la doc de
  // `initialXpRef` plus haut.
  useEffect(() => {
    if (ready && initialXpRef.current === null) {
      initialXpRef.current = totalXp(exercises, sessions);
    }
    // Volontairement absent des dépendances : `exercises`/`sessions` changent à
    // chaque exercice travaillé, et ne doivent JAMAIS redéclencher cette
    // capture — seul le passage à `ready` compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /** Même banque que celle évaluée au montage (voir l'effet ci-dessus), recalculée pour l'aperçu réactif au budget. */
  const scopedExercises = useMemo(
    () => (contextSubject ? exercises.filter((item) => item.subject === contextSubject) : exercises),
    [exercises, contextSubject]
  );

  // Aperçu recalculé en direct à chaque changement de budget/mode — c'est la
  // même fonction `recommendExercises` qui produira la sélection réelle au
  // clic sur "Commencer ma séance" (voir startSession), donc l'aperçu ne
  // ment jamais sur ce qui sera effectivement proposé. En mode "count", pas
  // de `availableMinutes` : `limit` (le nombre choisi) suffit, exactement le
  // même paramètre que le "top N" déjà utilisé partout ailleurs
  // (ExerciseReviewPanel notamment) — aucune nouvelle fonction nécessaire.
  const computedSelection = useMemo(
    () =>
      sizingMode === "count"
        ? recommendExercises(scopedExercises, sessions, countTarget)
        : recommendExercises(scopedExercises, sessions, 6, { availableMinutes: budgetMinutes }),
    [scopedExercises, sessions, sizingMode, countTarget, budgetMinutes]
  );
  const previewSelection = planSelection ?? computedSelection;
  const previewMinutesUsed = useMemo(
    () => previewSelection.reduce((sum, { exercise }) => sum + estimatedDurationMinutes(exercise, sessions), 0),
    [previewSelection, sessions]
  );

  // "Et maintenant ?" (écran de fin de séance) : recalculé sur les données
  // fraîches (exercises/sessions incluent déjà les résultats qu'on vient
  // d'enregistrer) — même fonction que le Hero du Dashboard
  // (lib/next-action.ts), aucune deuxième règle de recommandation. C'est ce
  // qui rend visible, tout de suite après une séance, que TaekdHub vient
  // d'apprendre de ses résultats plutôt que de forcer un aller-retour par
  // /dashboard pour le constater.
  const upcomingNextAction = useMemo(
    () => computeNextAction(exercises, sessions, preferences.dailyGoalMinutes),
    [exercises, sessions, preferences.dailyGoalMinutes]
  );

  // XP gagnée PENDANT cette séance, et passage de niveau éventuel — voir la
  // doc de `initialXpRef`. `Math.max(0, …)` : une valeur négative ne devrait
  // jamais arriver (l'XP ne diminue jamais), mais ne jamais afficher "-3 XP"
  // si un cas imprévu la faisait baisser.
  const xpGained = Math.max(0, totalXp(exercises, sessions) - (initialXpRef.current ?? totalXp(exercises, sessions)));
  const leveledUp = initialXpRef.current !== null && levelFromXp(totalXp(exercises, sessions)) > levelFromXp(initialXpRef.current);
  const newLevel = levelFromXp(totalXp(exercises, sessions));

  // Même pattern que exercise-manager.tsx#update, sans l'optimisation par
  // ref : une seule fiche est affichée à la fois ici, pas une grille de
  // centaines de cartes memoïsées.
  const update = useCallback(
    (id: string, patch: Partial<Exercise>) => {
      const updatedAt = new Date().toISOString();
      saveExercises(exercises.map((item) => (item.id === id ? { ...item, ...patch, updated_at: updatedAt } : item)));
    },
    [exercises, saveExercises]
  );

  const hasNext = currentIndex + 1 < recommendations.length;

  // Fige la sélection au moment du clic — l'aperçu peut continuer de changer
  // avant ça (ajustement du budget), la séance elle-même reste stable une
  // fois lancée, comme avant le Sprint 4.
  const startSession = useCallback(() => {
    setRecommendations(previewSelection);
    setCurrentIndex(0);
    setPhase("focus");
  }, [previewSelection]);

  // Passé à FocusView en tant que `onClose` : FocusView a déjà proprement
  // arrêté le timer et sauvegardé la WorkSession avant d'appeler ceci (voir
  // focus-view.tsx#endSession) — on ne fait ici qu'avancer dans la séance,
  // sans jamais toucher au statut ni à la maîtrise de l'exercice.
  const handleExerciseWorked = useCallback(
    (result?: AttemptResult | null) => {
      setVisitedCount((count) => count + 1);
      if (result) setRunResults((results) => [...results, result]);
      setPhase(hasNext ? "between" : "summary");
    },
    [hasNext]
  );

  const continueToNext = useCallback(() => {
    setCurrentIndex((index) => index + 1);
    setPhase("focus");
  }, []);

  const endSessionEarly = useCallback(() => setPhase("summary"), []);

  if (phase === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="surface h-40 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (phase === "focus") {
    const current = recommendations[currentIndex];
    if (!current) return null;
    return (
      <FocusView
        item={current.exercise}
        update={update}
        sessions={sessions}
        saveSessions={saveSessions}
        onClose={handleExerciseWorked}
        reasons={current.reasons}
        progress={{ index: currentIndex, total: recommendations.length }}
      />
    );
  }

  // Contenu par phase, calculé (pas retourné directement) pour que chaque
  // transition entre phases passe par le même fondu ci-dessous (voir le
  // `return` final) — la phase "focus" reste un early return, déjà gérée par
  // sa propre transition plein écran (FocusView).
  let content: React.ReactNode;

  if (phase === "empty") {
    content = (
      <EmptyState
        title={contextSubject ? `Rien à travailler en ${contextSubject} pour l'instant.` : "Rien à travailler pour l'instant."}
        description={
          contextSubject
            ? "Cette matière est à jour — reviens plus tard, ou explore tes exercices."
            : "Ta banque est à jour — reviens plus tard, ou explore tes exercices."
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/exercises">
              <Button variant="secondary">Voir les exercices</Button>
            </Link>
            {contextSubject && (
              <Link href="/session">
                <Button variant="ghost">Séance complète</Button>
              </Link>
            )}
          </div>
        }
      />
    );
  } else if (phase === "preview") {
    content = (
      <div className="space-y-5">
        <Card className="p-8 text-center">
          <PlayCircle className="mx-auto text-accent" size={28} />

          {planSelection ? (
            planSource === "libre" ? (
              <>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">Ta séance libre</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Exactement la sélection choisie dans la banque d&apos;exercices — matière, chapitre, sous-thème et difficulté filtrés à la main.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">Ton plan du jour</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Réparti sur tes matières prioritaires, dans le temps que tu as choisi depuis le tableau de bord.
                </p>
              </>
            )
          ) : (
            <>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">
                {sizingMode === "time" ? "Combien de temps as-tu devant toi ?" : "Combien d'exercices veux-tu travailler ?"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {sizingMode === "time"
                  ? "La séance tient dans ce temps — aucun exercice trop long n'est jamais forcé dedans."
                  : "Une sélection de ce nombre exact, classée par urgence et répartie sur plusieurs chapitres."}
              </p>
              {contextSubject && (
                <p className="mt-2 text-xs text-accent">
                  Ciblée sur {contextSubject} ·{" "}
                  <Link href="/session" className="underline underline-offset-2">
                    voir la séance complète
                  </Link>
                </p>
              )}

              <SegmentedControl
                className="mx-auto mt-5"
                ariaLabel="Dimensionner la séance"
                value={sizingMode}
                onChange={setSizingMode}
                options={[
                  { value: "time", label: "Par temps" },
                  { value: "count", label: "Par nombre d'exercices" },
                ]}
              />

              {/* Sélecteur segmenté, pas des boutons pleins : le préréglage
                  actif portait le style « action principale » — le même que
                  « Commencer ma séance », deux lignes plus bas. Choisir une
                  durée n'est pas agir, c'est régler. */}
              {sizingMode === "time" ? (
                <div className="mx-auto mt-4 flex max-w-sm flex-wrap items-center justify-center gap-2">
                  <SegmentedControl
                    ariaLabel="Temps disponible"
                    value={budgetMinutes}
                    onChange={setBudgetMinutes}
                    options={BUDGET_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={budgetMinutes}
                      onChange={(event) => setBudgetMinutes(Math.max(0, Math.round(Number(event.target.value) || 0)))}
                      className="w-20 text-center"
                      aria-label="Temps disponible, en minutes"
                    />
                    <span className="text-xs text-muted">min</span>
                  </div>
                </div>
              ) : (
                <div className="mx-auto mt-4 flex max-w-sm flex-wrap items-center justify-center gap-2">
                  <SegmentedControl
                    ariaLabel="Nombre d'exercices"
                    value={countTarget}
                    onChange={setCountTarget}
                    options={COUNT_PRESETS.map((preset) => ({ value: preset, label: String(preset) }))}
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={countTarget}
                      onChange={(event) => setCountTarget(Math.max(1, Math.round(Number(event.target.value) || 0)))}
                      className="w-20 text-center"
                      aria-label="Nombre d'exercices"
                    />
                    <span className="text-xs text-muted">exercice{countTarget > 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {previewSelection.length > 0 ? (
            <p className="mx-auto mt-5 max-w-md text-sm text-muted">
              {sizingMode === "time" ? (
                <>
                  {previewSelection.length} exercice{previewSelection.length > 1 ? "s" : ""} sélectionné{previewSelection.length > 1 ? "s" : ""} — environ{" "}
                  {previewMinutesUsed} min sur {budgetMinutes} min disponibles.
                </>
              ) : (
                <>
                  {previewSelection.length} exercice{previewSelection.length > 1 ? "s" : ""} sélectionné{previewSelection.length > 1 ? "s" : ""} — environ{" "}
                  {previewMinutesUsed} min au total.
                </>
              )}
            </p>
          ) : (
            <p className="mx-auto mt-5 max-w-md text-sm text-amber-300">
              {sizingMode === "time" && budgetMinutes === 0
                ? "Objectif du jour déjà atteint — choisis un temps si tu veux continuer."
                : sizingMode === "time"
                  ? "Aucun exercice ne tient dans ce créneau. Augmente le temps disponible, ou choisis-en un directement dans la banque."
                  : "Rien à proposer pour l'instant — la banque est à jour."}
            </p>
          )}

          <Button size="lg" className="mt-6" onClick={startSession} disabled={previewSelection.length === 0}>
            Commencer ma séance <ArrowRight size={16} />
          </Button>
        </Card>

        {previewSelection.length > 0 && (
          <div className="surface divide-y divide-hairline/[0.07] rounded-2xl px-4 py-1 sm:columns-2 sm:gap-6 sm:divide-y-0 sm:[&>*]:break-inside-avoid">
            {previewSelection.map(({ exercise, reasons }) => (
              // `min-w-0` obligatoire ici : un élément de grille a
              // `min-width: auto` par défaut, donc sa largeur minimale vaut
              // celle de son contenu — et le titre en `truncate`
              // (white-space: nowrap) réclame la ligne entière. Sans ça,
              // l'aperçu de séance débordait horizontalement à TOUTES les
              // largeurs mobiles (mesuré : 521 px de contenu dans 350 px
              // disponibles à 390 px de viewport), le `truncate` ne servant
              // alors jamais.
              // Une ligne, pas une carte à badges : le sommaire de séance
              // portait jusqu'à quatre étiquettes teintées par exercice, soit
              // plus de signal d'emphase que de contenu. Durée et raisons
              // tiennent sur une ligne secondaire, qui se lit d'un coup d'œil.
              <div key={exercise.id} className="flex min-w-0 items-start gap-3 py-2 text-left">
                <span className="mt-0.5 shrink-0">
                  <SubjectAvatar subject={exercise.subject} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{exercise.title}</p>
                  <p className="t-meta mt-0.5 truncate">
                    ≈ {estimatedDurationMinutes(exercise, sessions)} min{reasons.length > 0 && <> · {reasons.slice(0, 2).join(" · ")}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (phase === "between") {
    const done = recommendations[currentIndex]?.exercise;
    const nextPick = recommendations[currentIndex + 1];
    // Même sentence qu'en Focus (explainReasons) : la continuité "pourquoi le
    // suivant ?" ne doit pas s'arrêter à un simple titre entre deux exercices.
    const nextReason = nextPick ? explainReasons(nextPick.reasons) : null;
    content = (
      <Card className="p-8 text-center">
        {/* Petit rebond plutôt qu'une simple apparition : c'est le moment
            "oui, c'est fait" entre deux exercices — il mérite un geste, pas
            juste un fondu identique à celui de toute la carte. */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.55, duration: 0.5 }}
          className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent/10"
        >
          <CheckCircle2 className="text-accent" size={22} />
        </motion.div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Exercice travaillé</h2>
        {done && <p className="mt-2 text-sm text-muted">{done.title}</p>}
        <p className="mt-1 text-xs text-muted">
          {currentIndex + 1} / {recommendations.length}
          {nextPick && <> · Prochain : {nextPick.exercise.title}</>}
        </p>
        {nextReason && <p className="mx-auto mt-2 max-w-sm text-xs text-accent/90">{nextReason}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={continueToNext}>
            Continuer <ArrowRight size={16} />
          </Button>
          <Button variant="secondary" onClick={endSessionEarly}>
            Terminer la séance
          </Button>
        </div>
      </Card>
    );
  } else {
    // phase === "summary"
    const runSuccessCount = runResults.filter((result) => result === "réussi").length;
    const runPartialCount = runResults.filter((result) => result === "partiel").length;
    const runFailureCount = runResults.filter((result) => result === "échoué").length;
    content = (
      <Card className="p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.55, duration: 0.55 }}
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10"
        >
          <CheckCircle2 className="text-accent" size={28} />
        </motion.div>
        <CardTitle className="mt-4 text-xl">Séance terminée</CardTitle>
        <p className="mt-2 text-sm text-muted">
          {visitedCount} exercice{visitedCount > 1 ? "s" : ""} travaillé{visitedCount > 1 ? "s" : ""} durant cette séance.
        </p>

        {/* Retour honnête, pas décoratif : ce chiffre vient du même calcul
            d'XP que la sidebar (lib/gamification.ts), jamais une deuxième
            formule — seulement la DIFFÉRENCE avec le début de séance. Rien ne
            s'affiche si la séance n'a rapporté aucune XP (ex. rechargée sans
            rien qualifier). */}
        {xpGained > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 flex w-fit flex-wrap items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">
              <Zap size={14} /> +{xpGained} XP
            </span>
            {leveledUp && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">
                <Sparkles size={14} /> Niveau {newLevel}
              </span>
            )}
          </motion.div>
        )}

        {runResults.length > 0 && (
          <div className="mx-auto mt-3 flex max-w-sm flex-wrap items-center justify-center gap-1.5">
            {runSuccessCount > 0 && (
              <Badge variant="success">
                {runSuccessCount} réussi{runSuccessCount > 1 ? "s" : ""}
              </Badge>
            )}
            {runPartialCount > 0 && (
              <Badge variant="warning">
                {runPartialCount} partiel{runPartialCount > 1 ? "s" : ""}
              </Badge>
            )}
            {runFailureCount > 0 && (
              <Badge variant="danger">
                {runFailureCount} échoué{runFailureCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {upcomingNextAction.kind === "start-session" && (
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-hairline/[0.09] bg-hairline/[0.025] p-5 text-left">
            <p className="eyebrow">Et maintenant ?</p>
            <p className="mt-2 text-sm font-medium text-ink">{upcomingNextAction.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{upcomingNextAction.description}</p>
            <Button
              size="sm"
              className="mt-4 w-full"
              // Navigation complète (pas de Link) : SessionRunner ne
              // réinitialise sa sélection qu'au montage — un rechargement
              // complet est le moyen le plus sûr de repartir sur cette
              // nouvelle recommandation sans dupliquer sa logique de démarrage.
              onClick={() => {
                window.location.href = `/session?minutes=${upcomingNextAction.minutes}`;
              }}
            >
              {upcomingNextAction.ctaLabel} <ArrowRight size={14} />
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard">
            <Button variant={upcomingNextAction.kind === "start-session" ? "secondary" : "primary"}>Retour au tableau de bord</Button>
          </Link>
          <Link href="/exercises">
            <Button variant="secondary">Voir les exercices</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
