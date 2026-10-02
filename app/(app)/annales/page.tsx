import { Suspense } from "react";
import { AnnalesOverview } from "@/components/annales/annales-overview";
import { Skeleton } from "@/components/ui/state";

export const metadata = { title: "Mes annales — TaekdHub" };

/**
 * Les annales corrigées avec Claude (connecteur MCP → `exercise_logs`).
 * Atteinte depuis le hub de chaque matière et depuis Next Move (« Mes
 * annales ») — comme /erreurs et /memoire, elle ne prend PAS de place dans
 * la barre de navigation (voir components/app-nav.tsx).
 */
export default function AnnalesPage() {
  // `?refaire=` (lien de Next Move) est lu par `useSearchParams` : la limite <Suspense> garde la page prérendue.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <AnnalesOverview />
    </Suspense>
  );
}
