import { Timer } from "@/components/timer";

export const metadata = { title: "Chrono — TaekdHub" };

/**
 * L'écran « Focus » : un seul objet centré, le chrono. Le titre vit dans le
 * composant (components/timer.tsx) parce qu'il disparaît en plein écran —
 * un en-tête posé ici resterait sous la couche plein écran.
 */
export default function TimerPage() {
  return <Timer />;
}
