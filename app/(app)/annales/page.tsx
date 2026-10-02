import { AnnalesOverview } from "@/components/annales/annales-overview";

export const metadata = { title: "Mes annales — TaekdHub" };

/**
 * Les annales corrigées avec Claude (connecteur MCP → `exercise_logs`).
 * Atteinte depuis le hub de chaque matière et depuis Next Move (« Mes
 * annales ») — comme /erreurs et /memoire, elle ne prend PAS de place dans
 * la barre de navigation (voir components/app-nav.tsx).
 */
export default function AnnalesPage() {
  return <AnnalesOverview />;
}
