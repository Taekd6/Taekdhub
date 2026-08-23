"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useResumableFocus } from "@/hooks/use-resumable-focus";
import { formatDuration } from "@/lib/utils";

/**
 * « Où me suis-je arrêté ? » (Sprint poste de pilotage) — jusqu'ici, une
 * séance Focus interrompue (chrono encore actif, ou après une fermeture
 * brutale) n'était détectée qu'au moment où l'utilisateur retournait sur
 * /exercises ou /session (voir exercise-manager.tsx#resumeChecked) : rien
 * n'en informait le Dashboard, alors que c'est le point d'entrée réel de la
 * journée. Priorité maximale dans l'ordre d'affichage : reprendre un travail
 * déjà commencé passe avant toute nouvelle recommandation.
 *
 * `/exercises` (sans paramètre) suffit à déclencher la reprise : cette page
 * détecte déjà la même séance interrompue à son propre montage et rouvre
 * Focus automatiquement — aucune nouvelle logique de reprise ici, seulement
 * un lien vers un mécanisme qui existe déjà.
 */
export function ResumeBanner() {
  const { exercises, ready } = usePrepahubData();
  const resumable = useResumableFocus(exercises, ready);

  if (!resumable) return null;
  const exercise = exercises.find((item) => item.id === resumable.exerciseId);
  if (!exercise) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] px-4 py-3 text-sm">
      <div className="flex items-start gap-2.5">
        <PlayCircle size={16} className="mt-0.5 shrink-0 text-accent-text" />
        <p className="text-zinc-200">
          Séance en cours sur <span className="font-semibold">{exercise.title}</span>
          {resumable.seconds > 0 && <> — {formatDuration(resumable.seconds)} déjà enregistrées</>}.
        </p>
      </div>
      <Link href="/exercises" className="shrink-0">
        <Button size="sm">
          <PlayCircle size={14} /> Reprendre
        </Button>
      </Link>
    </div>
  );
}
