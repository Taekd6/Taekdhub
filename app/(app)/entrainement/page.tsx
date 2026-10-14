import { Suspense } from "react";
import { TrainingScreen } from "@/components/training/training-screen";
import { Skeleton } from "@/components/ui/state";

export const metadata = { title: "Entraînement — TaekdHub" };

/**
 * L'entraînement : le lecteur d'une fiche d'exercice (énoncé, puis indices,
 * puis correction), la liste des exercices d'un chapitre, l'ajout d'un
 * exercice (lib/exercise-sheets.ts). Atteint depuis le programme de révision
 * — comme /revoir et /annales, il ne prend PAS de place dans la barre de
 * navigation (voir components/app-nav.tsx).
 *
 * Il lit `?fiche=`, `?chapitre=` et `?niveau=` (`useSearchParams`) : la limite
 * <Suspense> garde la page prérendue.
 */
export default function EntrainementPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <TrainingScreen />
    </Suspense>
  );
}
