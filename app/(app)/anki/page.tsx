import { AnkiOverview } from "@/components/anki/anki-overview";

export const metadata = { title: "Anki — TaekdHub" };

/** Le pont avec Anki (lib/anki-snapshot.ts, lib/anki-mapping.ts), atteint depuis Mémoire et Matières. */
export default function AnkiPage() {
  return <AnkiOverview />;
}
