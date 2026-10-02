import { Suspense } from "react";
import { DebriefEditor } from "@/components/debrief/debrief-editor";
import { Skeleton } from "@/components/ui/state";

export const metadata = { title: "Débrief — TaekdHub" };

/**
 * Le débrief d'une copie (lib/debrief.ts). `?note=` désigne la note : lu par
 * `useSearchParams`, d'où la limite <Suspense> qui garde la page prérendue.
 */
export default function DebriefPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <DebriefEditor />
    </Suspense>
  );
}
