"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { SubjectTargetList } from "@/components/work/subject-targets";
import { computeSubjectTargets } from "@/lib/subject-targets";
import type { Preferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * TON BUDGET PAR MATIÈRE — la même mesure que le rail de l'accueil, en plus
 * lisible : le reste à faire et ce qui était attendu à ce stade de la
 * semaine sont écrits, pas seulement suggérés par une barre.
 *
 * Placée juste après « Combien tu travailles » : cette section-là dit
 * COMBIEN, celle-ci dit OÙ, face à ce que l'élève s'était fixé. Même calcul
 * que l'accueil (lib/subject-targets.ts), même pondération par la capacité :
 * les deux écrans ne peuvent pas se contredire.
 *
 * Rien n'est affiché quand aucune matière n'a de budget — l'écran
 * Progression dit déjà tout le reste, et une section vide qui renvoie vers
 * les réglages serait de la publicité pour un réglage.
 */
export function SubjectTargetsSection({ sessions, preferences }: { sessions: WorkSession[]; preferences: Preferences }) {
  const rows = useMemo(
    () => computeSubjectTargets(sessions, preferences.weeklySubjectTargets, new Date(), preferences.capacityByWeekday),
    [sessions, preferences]
  );

  if (rows.length === 0) return null;

  return (
    <Section
      label="Cette semaine"
      title="Ton budget par matière"
      description="Le temps noté depuis lundi, face à ce que tu t'es fixé pour chaque matière."
      action={
        <Link href="/settings" className="t-meta rounded hover:text-ink max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
          Régler les budgets
        </Link>
      }
    >
      <SubjectTargetList rows={rows} size="comfortable" />
    </Section>
  );
}
