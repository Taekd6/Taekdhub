import { Suspense } from "react";
import { KholleTrainer } from "@/components/kholle/kholle-trainer";
import { Skeleton } from "@/components/ui/state";

export const metadata = { title: "Khôlle — TaekdHub" };

/**
 * Le mode khôlle (lib/kholle.ts). `?chapitre=` interroge sur un chapitre
 * précis (depuis la carte du programme) : lu par `useSearchParams`, d'où la
 * limite <Suspense> qui garde la route prérendue.
 */
export default function KhollePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <KholleTrainer />
    </Suspense>
  );
}
