import { BilanReport } from "@/components/bilan/bilan-report";

export const metadata = { title: "Bilan — TaekdHub" };

/** Le bilan imprimable d'une période (lib/bilan.ts), atteint depuis Progression et l'écran Matières. */
export default function BilanPage() {
  return <BilanReport />;
}
