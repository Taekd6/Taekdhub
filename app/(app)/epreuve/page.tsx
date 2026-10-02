import { ExamSimulator } from "@/components/epreuve/exam-simulator";

export const metadata = { title: "Épreuve blanche — TaekdHub" };

/** Le simulateur d'épreuve (lib/epreuve.ts), atteint depuis l'écran Matières. */
export default function EpreuvePage() {
  return <ExamSimulator />;
}
