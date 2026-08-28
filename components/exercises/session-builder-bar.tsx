"use client";

import { PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildFreeSessionPlan, PLAN_STORAGE_KEY } from "@/lib/plan";
import { estimatedDurationMinutes } from "@/lib/recommendation";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * "Séance libre" (Phase 7 pédagogie) — construit une séance directement à
 * partir de la sélection déjà filtrée par l'élève dans la banque (matière,
 * chapitre, sous-thème, difficulté, recherche…), sans passer par
 * `recommendExercises` : c'est l'élève qui a déjà décidé quoi travailler en
 * filtrant, pas le moteur de recommandation. Comble le manque identifié par
 * le retour utilisateur : filtrer une liste précise ne menait auparavant qu'à
 * ouvrir les exercices un par un en Focus, jamais à enchaîner une vraie
 * séance sur cette sélection.
 *
 * Réutilise EXACTEMENT le mécanisme de transfert Dashboard → /session déjà
 * existant (`PLAN_STORAGE_KEY`, lib/plan.ts) : `SessionRunner` n'a besoin
 * d'aucune modification, il traite cette séance libre comme n'importe quel
 * plan déposé — chaînage, timer, résultats, écran de fin, tout est déjà géré.
 */
export function SessionBuilderBar({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const router = useRouter();
  const [count, setCount] = useState(8);

  // Le nombre choisi ne peut jamais dépasser ce qui est réellement disponible
  // dans la sélection filtrée — pas de valeur "fantôme" affichée si l'élève
  // resserre ses filtres après avoir choisi un nombre plus grand.
  const effectiveCount = Math.min(Math.max(1, count), Math.max(1, exercises.length));
  const picked = useMemo(() => exercises.slice(0, effectiveCount), [exercises, effectiveCount]);
  const estimatedMinutes = useMemo(
    () => picked.reduce((sum, exercise) => sum + estimatedDurationMinutes(exercise, sessions), 0),
    [picked, sessions]
  );

  if (exercises.length === 0) return null;

  const start = () => {
    const plan = buildFreeSessionPlan(exercises, sessions, effectiveCount);
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    router.push("/session");
  };

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted">Séance libre sur cette sélection :</span>
        <Input
          type="number"
          min={1}
          max={exercises.length}
          // Affiche `effectiveCount` (déjà borné à ce qui est réellement
          // disponible), jamais `count` brut : sans ça, resserrer les filtres
          // après avoir choisi un grand nombre laisserait affiché un nombre
          // supérieur à ce qui sera réellement lancé (ex. "8" affiché alors
          // qu'un seul exercice correspond aux filtres) — incohérent avec le
          // "sur {exercises.length}" et la durée juste à côté, qui eux
          // reflètent déjà la sélection réelle.
          value={effectiveCount}
          onChange={(event) => setCount(Math.max(1, Math.round(Number(event.target.value) || 1)))}
          className="h-8 w-16 px-2 py-0 text-center text-xs"
          aria-label="Nombre d'exercices pour la séance libre"
        />
        <span className="text-xs text-muted">
          sur {exercises.length} · ≈ {estimatedMinutes} min
        </span>
      </div>
      <Button size="sm" onClick={start}>
        <PlayCircle size={15} /> Démarrer la séance
      </Button>
    </Card>
  );
}
