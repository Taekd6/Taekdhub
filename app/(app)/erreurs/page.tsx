import { ErrorLog } from "@/components/errors/error-log";

export const metadata = { title: "Carnet d'erreurs — TaekdHub" };

/**
 * Le carnet d'erreurs. Atteint depuis le hub de chaque matière (« Mes
 * erreurs »), depuis la saisie d'une note (« Noter les erreurs de ce DS ») et
 * depuis l'accueil — comme /revoir et /echeances, il ne prend PAS de place
 * dans la barre de navigation (voir components/app-nav.tsx) : on y vient
 * au moment où l'on sort d'une épreuve, pas en flânant.
 *
 * `?subject=&source=&date=&chapter=&exercise=` pré-remplissent la saisie —
 * voir lib/error-log.ts#parseErrorPrefill.
 */
export default function ErreursPage() {
  return <ErrorLog />;
}
