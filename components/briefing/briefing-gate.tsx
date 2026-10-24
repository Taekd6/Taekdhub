"use client";

/**
 * AIGUILLAGE VERS « LE POINT » — DÉSACTIVÉ à la demande de l'élève
 * (2026-10-24 : « les pop-ups qui s'affichent… je m'en fous »).
 *
 * L'écran « Le point » ne s'ouvre plus tout seul à la première ouverture de la
 * journée ni après une longue absence : l'accueil s'affiche directement. Il
 * reste disponible à la demande, sur `/point`. Le composant garde sa place
 * autour de l'accueil (app/(app)/dashboard) pour qu'on puisse le réactiver en
 * rétablissant l'ancienne décision (`shouldShowBriefing`, lib/briefing.ts).
 */
export function BriefingGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
