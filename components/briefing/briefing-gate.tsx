"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRIEFING_SEEN_KEY, LAST_ACTIVITY_KEY, buildBriefing, shouldShowBriefing } from "@/lib/briefing";
import { localData, readFlag } from "@/lib/storage";

/**
 * AIGUILLAGE VERS « LE POINT » — posé autour de l'accueil, après celui du
 * premier lancement (components/onboarding/onboarding-gate.tsx), et sur le
 * même modèle : décision synchrone au montage, rien d'affiché avant, et
 * `replace` pour que « Retour » depuis le point ne ramène pas ici en boucle.
 *
 * On y va à la première ouverture de la journée (et après une longue
 * absence), seulement s'il y a quelque chose à dire : un nouvel inscrit sans
 * aucune donnée arrive directement sur l'accueil.
 */
export function BriefingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    const now = new Date();
    const preferences = localData.preferences();
    if (shouldShowBriefing(preferences, readFlag(BRIEFING_SEEN_KEY), now, readFlag(LAST_ACTIVITY_KEY))) {
      const briefing = buildBriefing({
        sessions: localData.sessions(),
        workItems: localData.workItems(),
        grades: localData.grades(),
        reviewItems: localData.reviewItems(),
        errors: localData.errors(),
        checkins: localData.checkins(),
        chapterMemory: localData.chapterMemory(),
        preferences,
        history: localData.nextMoves(),
        now,
      });
      if (briefing.hasContent) {
        router.replace("/point");
        return;
      }
    }
    setDecided(true);
  }, [router]);

  if (!decided) return <div className="min-h-[60vh]" aria-busy />;
  return <>{children}</>;
}
