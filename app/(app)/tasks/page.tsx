import { Suspense } from "react";
import { TasksScreen } from "@/components/tasks/tasks-screen";

export const metadata = { title: "Tâches — TaekdHub" };

/**
 * `useSearchParams` impose une frontière `Suspense` au prérendu (le filtre
 * « en retard » arrive par l'URL depuis le rail d'Aujourd'hui). Le repli est
 * vide plutôt qu'un squelette : la lecture des paramètres est instantanée,
 * un squelette qui clignote coûterait plus qu'il n'apporte.
 */
export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksScreen />
    </Suspense>
  );
}
