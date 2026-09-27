import { BriefingScreen } from "@/components/briefing/briefing-screen";

export const metadata = { title: "Le point — TaekdHub" };

/**
 * LE POINT — l'écran d'ouverture : ce qu'il faut faire, ce qui presse, ce
 * qu'on repousse. L'accueil y conduit une fois par jour (voir
 * components/briefing/briefing-gate.tsx) ; on y revient en touchant la date
 * de l'accueil.
 */
export default function PointPage() {
  return <BriefingScreen />;
}
