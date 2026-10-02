import { FormulaTrainer } from "@/components/formulaire/formula-trainer";

export const metadata = { title: "Formulaire — TaekdHub" };

/** Le formulaire en cartes flash (lib/formulaire.ts), atteint depuis l'écran Matières. */
export default function FormulairePage() {
  return <FormulaTrainer />;
}
