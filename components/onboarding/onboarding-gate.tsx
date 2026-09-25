"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isOnboardingSnoozed, shouldOnboard } from "@/lib/onboarding";
import { localData } from "@/lib/storage";

/**
 * AIGUILLAGE DU PREMIER LANCEMENT — posé autour de l'accueil
 * (app/(app)/dashboard/page.tsx).
 *
 * Au montage, et une seule fois : si lib/onboarding.ts#shouldOnboard dit que
 * cet élève n'a encore rien fixé (et qu'il n'a pas choisi « Plus tard » dans
 * cet onglet), on le conduit sur /bienvenue. Sinon, l'accueil s'affiche.
 *
 * PAS D'ÉCLAIR DE L'ACCUEIL. Rien n'est rendu tant que la décision n'est pas
 * prise : un élève envoyé sur /bienvenue ne voit jamais l'accueil
 * apparaître puis disparaître. La décision est synchrone (une lecture du
 * `localStorage`), donc l'attente se compte en millisecondes pour tous les
 * autres.
 *
 * LECTURE SEULE, directement dans `localData` : l'aiguillage n'écrit rien et
 * n'ouvre donc pas de second `usePrepahubData` à côté de celui de l'accueil —
 * la règle « un seul appelant du hook par écran » vise les écritures
 * concurrentes, qu'on ne crée pas ici.
 *
 * `replace` et non `push` : « Retour » depuis /bienvenue ne doit pas
 * ramener sur un accueil qui renverrait aussitôt sur /bienvenue.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    const evidence = {
      sessions: localData.sessions(),
      grades: localData.grades(),
      workItems: localData.workItems(),
      reviewItems: localData.reviewItems(),
      errors: localData.errors(),
      checkins: localData.checkins(),
    };
    if (!isOnboardingSnoozed() && shouldOnboard(localData.preferences(), evidence)) {
      router.replace("/bienvenue");
      return;
    }
    setDecided(true);
  }, [router]);

  if (!decided) return <div className="min-h-[60vh]" aria-busy />;
  return <>{children}</>;
}
