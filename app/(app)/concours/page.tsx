import { ConcoursOverview } from "@/components/concours/concours-overview";

export const metadata = { title: "Concours — TaekdHub" };

/** Titre porté par la composition elle-même — voir `PageBar` (components/ui/layout.tsx). */
export default function ConcoursPage() {
  return <ConcoursOverview />;
}
