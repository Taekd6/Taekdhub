"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/state";
import { exportBackup } from "@/lib/storage";
import { COLLECTION_LABELS, MEANINGFUL_COLLECTIONS } from "@/lib/sync/collections";
import type { DataCounts, DecisionChoice, PendingDecision } from "@/lib/sync/engine";

/** « 124 séances, 12 notes, 3 erreurs » — seulement ce qui existe. */
export function describeCounts(counts: DataCounts): string {
  const parts = MEANINGFUL_COLLECTIONS.map((collection) => ({ collection, count: counts[collection] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${COLLECTION_LABELS[entry.collection]}`);
  return parts.length > 0 ? parts.join(", ") : "aucune donnée de travail";
}

/**
 * LA DÉCISION DU PREMIER LOGIN — la seule fenêtre modale de TaekdHub.
 *
 * Elle s'impose parce que l'enjeu est de PERDRE des données : rien n'est
 * envoyé ni remplacé tant que l'élève n'a pas choisi, et on ne peut pas la
 * fermer d'un clic à côté.
 *
 *   IMPORT    l'appareil a des données, le compte est vide
 *             → « Importer mes données » (recommandé) ou « Commencer sans elles ».
 *   CONFLIT   les deux en ont
 *             → « Fusionner » (recommandé) ou « Garder seulement le compte ».
 *
 * Toute option qui REMPLACE l'appareil télécharge d'abord une sauvegarde
 * complète (le même fichier que Réglages → Exporter) : même un mauvais clic
 * se rattrape par Réglages → Restaurer.
 *
 * « Me déconnecter » annule tout : l'appareil reste exactement tel quel.
 */
export function SyncDecisionDialog({
  decision,
  error,
  onChoose,
  onCancel,
}: {
  decision: PendingDecision;
  error: string | null;
  onChoose: (choice: DecisionChoice) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function choose(choice: DecisionChoice) {
    setBusy(true);
    // Remplacer l'appareil : une copie d'abord, toujours.
    if (choice === "compte") exportBackup();
    await onChoose(choice);
    setBusy(false);
  }

  const importing = decision.kind === "import";
  const title = importing ? "Importer tes données existantes ?" : "Ton compte contient déjà des données";

  return (
    <Dialog
      open
      title={title}
      dismissible={false}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button size="lg" disabled={busy} onClick={() => void choose(importing ? "importer" : "fusionner")}>
            {importing ? "Importer mes données" : "Fusionner les deux"}
          </Button>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => void choose("compte")}>
            {importing ? "Commencer sans elles" : "Garder seulement le compte"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Me déconnecter
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <p className="t-body">
          {importing ? "Nous avons trouvé des données TaekdHub sur cet appareil :" : "Cet appareil et ton compte ont chacun des données :"}
        </p>
        <dl className="space-y-2 rounded-2xl bg-inset px-4 py-3">
          <div>
            <dt className="t-label">Sur cet appareil</dt>
            <dd className="text-[0.9375rem] font-bold text-ink">{describeCounts(decision.local)}</dd>
          </div>
          {!importing && (
            <div>
              <dt className="t-label">Dans ton compte</dt>
              <dd className="text-[0.9375rem] font-bold text-ink">{describeCounts(decision.remote)}</dd>
            </div>
          )}
        </dl>
        {decision.foreignOwner && (
          <Notice tone="warning">Ces données locales ont été créées avec un autre compte. Ne les importe que si elles sont bien à toi.</Notice>
        )}
        <p className="t-meta">
          {importing
            ? "Les importer les envoie dans ton compte : tu les retrouveras sur tes autres appareils. Sinon, une sauvegarde de ces données est d'abord téléchargée, puis l'appareil repart de ton compte."
            : "Fusionner réunit tout, sans rien effacer (recommandé). Garder seulement le compte remplace les données de cet appareil — une sauvegarde en est d'abord téléchargée."}
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}
