import type { ExoEntry } from "@/lib/exos";

/** La pastille d'un concours : texte court et couleur d'accent. Aucun logo officiel (non libres de droits) : des pastilles dessinées. */
export interface ConcoursBadge {
  key: string;
  label: string;
  color: string;
}

const BADGES: Array<[RegExp, ConcoursBadge]> = [
  [/e3a|polytech(?!nique)/i, { key: "e3a", label: "e3a", color: "#3fb950" }],
  [/ccinp|\bccp\b/i, { key: "ccinp", label: "CCINP", color: "#58a6ff" }],
  [/centrale|supélec|supelec/i, { key: "centrale", label: "Centrale", color: "#f47067" }],
  [/mines/i, { key: "mines", label: "Mines", color: "#e0a030" }],
  [/x-ens|polytechnique|\bens\b/i, { key: "x-ens", label: "X-ENS", color: "#b083f0" }],
  [/banque pt|banque-pt|\bpt\b/i, { key: "pt", label: "PT", color: "#39c5cf" }],
  [/enac/i, { key: "enac", label: "ENAC", color: "#8b949e" }],
];
const BEOS: ConcoursBadge = { key: "beos", label: "BEOS", color: "#d2a8ff" };

/** Le concours d'une entrée du catalogue, d'après `concours` puis le titre ; `null` si rien de reconnu. */
export function concoursBadge(entry: Pick<ExoEntry, "concours" | "titre" | "source">): ConcoursBadge | null {
  const text = `${entry.concours ?? ""} ${entry.titre}`;
  for (const [pattern, badge] of BADGES) if (pattern.test(text)) return badge;
  return entry.source === "beos" ? BEOS : null;
}
