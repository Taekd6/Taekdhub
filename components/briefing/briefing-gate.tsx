"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRIEFING_SEEN_KEY, LAST_ACTIVITY_KEY, briefingShownInThisTab, buildBriefing, shouldShowBriefing } from "@/lib/briefing";
import { KHOLLE_HISTORY_KEY, parseKholleHistory } from "@/lib/kholle";
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
    // Déjà montré dans cet onglet : jamais de second aiguillage (voir lib/briefing.ts#briefingShownInThisTab).
    if (!briefingShownInThisTab() && shouldShowBriefing(preferences, readFlag(BRIEFING_SEEN_KEY), now, readFlag(LAST_ACTIVITY_KEY))) {
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
        // Les mêmes données que l'écran du point (sauf les annales, propres au compte) :
        // sinon l'aiguillage et l'écran pouvaient juger différemment « rien à dire ».
        attempts: localData.attempts(),
        ankiSnapshots: localData.ankiSnapshots(),
        kholle: parseKholleHistory(readFlag(KHOLLE_HISTORY_KEY)),
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
