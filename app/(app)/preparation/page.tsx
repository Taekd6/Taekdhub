import { Suspense } from "react";
import { SubjectHub } from "@/components/hub/subject-hub";
import { Skeleton } from "@/components/ui/state";

export const metadata = { title: "Suivi par matière — TaekdHub" };

/**
 * LE SUIVI PAR MATIÈRE.
 *
 * Une seule question — « où j'en suis dans cette matière ? » — à partir de
 * ce que l'élève consigne lui-même : son temps, ses échéances, ses notes,
 * ses carnets. Aucun exercice : la banque intégrée a été retirée.
 *
 * La galerie des matières et la page de chacune (`?subject=`) sont le même
 * écran : le titre est porté par la composition (components/hub/subject-hub.tsx).
 * Elle lit la matière dans l'URL (`useSearchParams`), d'où la limite
 * <Suspense> — sans elle, toute la route basculerait en rendu dynamique.
 */
export default function PreparationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
      <SubjectHub />
    </Suspense>
  );
}
