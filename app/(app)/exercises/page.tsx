import { ExerciseManager } from "@/components/exercises/exercise-manager";

/**
 * Aucun en-tête ici : l'écran est composé en VOLET + ZONE DE TRAVAIL (voir
 * `Workbench`, components/ui/layout.tsx), et son titre est celui de la
 * sélection courante — « Réduction des endomorphismes », pas « Exercices ».
 * Un en-tête fixe au-dessus aurait redit ce que l'onglet actif indique déjà,
 * en poussant la liste 150 px plus bas.
 */
export default function ExercisesPage() {
  return <ExerciseManager />;
}
