"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { FOCUS_TIMER_PREFIX, FocusView } from "@/components/exercises/focus-view";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { findPersistedSessionSuffix } from "@/hooks/use-work-timer";
import { recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import type { Exercise } from "@/lib/supabase/types";

type Phase = "loading" | "empty" | "preview" | "focus" | "between" | "summary";

/**
 * Séance de travail intelligente (Sprint 3C).
 *
 * `recommendExercises` (lib/recommendation.ts) est l'UNIQUE moteur de
 * sélection — ce composant ne fait qu'orchestrer l'affichage d'une file
 * d'exercices déjà classés, un par un, via `FocusView` réutilisé sans
 * aucune modification.
 *
 * IMPORTANT (précision produit) : quitter le Focus signifie "exercice
 * travaillé", jamais "exercice réussi". Le statut et la maîtrise ne
 * changent QUE si l'utilisateur les modifie explicitement dans `FocusView`
 * (PriorityPicker / MasteryPicker / boutons de statut, déjà existants) —
 * ce composant ne les touche jamais lui-même.
 */
export function SessionRunner() {
  const { exercises, sessions, saveSessions, saveExercises, ready } = usePrepahubData();
  const [phase, setPhase] = useState<Phase>("loading");
  const [recommendations, setRecommendations] = useState<ExerciseRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visitedCount, setVisitedCount] = useState(0);
  const initialized = useRef(false);

  // Calcule la sélection une seule fois au montage — soit une reprise d'un
  // focus interrompu (même mécanisme que exercise-manager.tsx), soit une
  // nouvelle sélection fraîche via recommendExercises.
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;

    const pendingId = findPersistedSessionSuffix(FOCUS_TIMER_PREFIX);
    const pending = pendingId ? exercises.find((item) => item.id === pendingId && !item.archived) : undefined;
    const base = recommendExercises(exercises, sessions);

    if (pending) {
      const rest = base.filter((item) => item.exercise.id !== pending.id);
      setRecommendations([{ exercise: pending, score: 0, reasons: ["Séance reprise"] }, ...rest]);
      setPhase("focus");
    } else {
      setRecommendations(base);
      setPhase(base.length ? "preview" : "empty");
    }
  }, [ready, exercises, sessions]);

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

  const startSession = useCallback(() => setPhase("focus"), []);

  // Passé à FocusView en tant que `onClose` : FocusView a déjà proprement
  // arrêté le timer et sauvegardé la WorkSession avant d'appeler ceci (voir
  // focus-view.tsx#endSession) — on ne fait ici qu'avancer dans la séance,
  // sans jamais toucher au statut ni à la maîtrise de l'exercice.
  const handleExerciseWorked = useCallback(() => {
    setVisitedCount((count) => count + 1);
    setPhase(hasNext ? "between" : "summary");
  }, [hasNext]);

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

  if (phase === "empty") {
    return (
      <Card className="p-10 text-center">
        <Sparkles className="mx-auto text-accent" size={24} />
        <p className="mt-4 font-medium">Rien à travailler pour l&apos;instant.</p>
        <p className="mt-2 text-sm text-zinc-500">Ta banque est à jour — reviens plus tard, ou explore tes exercices.</p>
        <Link href="/exercises" className="mt-6 inline-block">
          <Button variant="secondary">Voir les exercices</Button>
        </Link>
      </Card>
    );
  }

  if (phase === "focus") {
    const current = recommendations[currentIndex]?.exercise;
    if (!current) return null;
    return <FocusView item={current} update={update} sessions={sessions} saveSessions={saveSessions} onClose={handleExerciseWorked} />;
  }

  if (phase === "preview") {
    return (
      <div className="space-y-5">
        <Card className="p-8 text-center">
          <PlayCircle className="mx-auto text-accent" size={28} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Ta séance est prête</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            {recommendations.length} exercice{recommendations.length > 1 ? "s" : ""} sélectionné{recommendations.length > 1 ? "s" : ""} à partir de ta
            maîtrise, ta priorité et ton activité récente.
          </p>
          <Button size="lg" className="mt-6" onClick={startSession}>
            Commencer ma séance <ArrowRight size={16} />
          </Button>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          {recommendations.map(({ exercise, reasons }) => (
            <div key={exercise.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] p-3 text-sm">
              <SubjectAvatar subject={exercise.subject} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{exercise.title}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => (
                    <Badge key={reason} variant="warning">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "between") {
    const done = recommendations[currentIndex]?.exercise;
    const next = recommendations[currentIndex + 1]?.exercise;
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto text-accent" size={28} />
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Exercice travaillé</h2>
        {done && <p className="mt-2 text-sm text-zinc-400">{done.title}</p>}
        <p className="mt-1 text-xs text-zinc-500">
          {currentIndex + 1} / {recommendations.length}
          {next && <> · Prochain : {next.title}</>}
        </p>
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
  }

  // phase === "summary"
  return (
    <Card className="p-10 text-center">
      <CardTitle className="text-xl">Séance terminée</CardTitle>
      <p className="mt-2 text-sm text-zinc-400">
        {visitedCount} exercice{visitedCount > 1 ? "s" : ""} travaillé{visitedCount > 1 ? "s" : ""} durant cette séance.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard">
          <Button>Retour au tableau de bord</Button>
        </Link>
        <Link href="/exercises">
          <Button variant="secondary">Voir les exercices</Button>
        </Link>
      </div>
    </Card>
  );
}
