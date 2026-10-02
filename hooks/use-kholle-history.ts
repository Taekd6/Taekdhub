"use client";

import { useEffect, useState } from "react";
import { KHOLLE_HISTORY_KEY, parseKholleHistory, type KholleHistory } from "@/lib/kholle";
import { readFlag } from "@/lib/storage";

/** L'historique des questions de khôlle de CET appareil (lib/kholle.ts) — lu une fois, après le montage. */
export function useKholleHistory(): KholleHistory {
  const [history, setHistory] = useState<KholleHistory>({});
  useEffect(() => setHistory(parseKholleHistory(readFlag(KHOLLE_HISTORY_KEY))), []);
  return history;
}
