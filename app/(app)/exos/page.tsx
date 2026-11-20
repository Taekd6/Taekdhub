import { ExosOverview } from "@/components/exos/exos-overview";

export const metadata = { title: "Exos — TaekdHub" };

/** Le suivi des exos : séance du jour, maîtrise, progression, points faibles et catalogue par chapitre (lib/exos.ts). */
export default function ExosPage() {
  return <ExosOverview />;
}
