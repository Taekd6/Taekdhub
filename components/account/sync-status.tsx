"use client";

import { useMemo } from "react";
import { useAccount } from "@/components/account/account-provider";
import { cn } from "@/lib/cn";
import { COLLECTION_LABELS, MEANINGFUL_COLLECTIONS, type CollectionName } from "@/lib/sync/collections";
import { SYNC_STATE_LABEL, type CollectionSyncState } from "@/lib/sync/status";

const DOT: Record<CollectionSyncState, string> = {
  envoyée: "bg-emerald-400",
  "en-attente": "bg-amber-400",
  "jamais-envoyée": "bg-rose-400",
  vide: "bg-zinc-400",
  "hors-compte": "bg-zinc-400",
};

/**
 * « Ces échéances sont-elles dans mon compte ? » — une ligne, sous le titre d'un
 * écran. Ce que CET appareil sait (lib/sync/status.ts), pas une lecture du serveur.
 * Rien sans compte configuré.
 */
export function CollectionSyncLine({ collection, className }: { collection: CollectionName; className?: string }) {
  const account = useAccount();
  // Recalculé quand l'état du compte change (envoi terminé, nouvelle synchro).
  const status = useMemo(() => account.syncStatusOf(collection), [account, collection]);
  if (!status) return null;
  // « 1 échéance », « 3 échéances » : les libellés sont au pluriel.
  const plural = COLLECTION_LABELS[collection];
  const count = `${status.localCount} ${status.localCount > 1 ? plural : plural.replace(/s$/, "")}`;
  return (
    <p className={cn("t-meta flex items-center gap-2 text-[0.8125rem]", className)} data-sync-state={status.state}>
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[status.state])} />
      <span>
        {status.state === "vide" ? `Rien sur cet appareil (${plural}).` : `${count} sur cet appareil — ${SYNC_STATE_LABEL[status.state]}.`}
      </span>
    </p>
  );
}

/** Réglages → Compte : ce qui est (ou non) dans le compte, collection de travail par collection. */
export function SyncOverview() {
  const account = useAccount();
  const rows = useMemo(() => MEANINGFUL_COLLECTIONS.map((collection) => account.syncStatusOf(collection)).filter((row) => row !== null), [account]);
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1 py-3 pr-4 sm:pr-5" aria-label="État de synchronisation par collection">
      {rows.map((row) => (
        <li key={row.collection} className="flex items-center justify-between gap-3 text-[0.875rem]" data-sync-state={row.state}>
          <span className="flex min-w-0 items-center gap-2 text-ink">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[row.state])} />
            <span className="first-letter:uppercase">{COLLECTION_LABELS[row.collection]}</span>
            <span className="tabular text-subtle">{row.localCount}</span>
          </span>
          <span className="t-meta shrink-0 text-[0.8125rem]">{SYNC_STATE_LABEL[row.state]}</span>
        </li>
      ))}
    </ul>
  );
}
