import { MemoryOverview } from "@/components/memory/memory-overview";

export const metadata = { title: "Ma mémoire — TaekdHub" };

/**
 * La mémoire des chapitres (FSRS). Atteinte depuis la carte « À ne pas
 * oublier » de l'accueil — comme /revoir et /erreurs, elle ne prend PAS de
 * place dans la barre de navigation (voir components/app-nav.tsx).
 */
export default function MemoirePage() {
  return <MemoryOverview />;
}
