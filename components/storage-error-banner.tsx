"use client";

import { AlertTriangle, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { exportBackup } from "@/lib/storage";

/**
 * Bandeau d'échec d'écriture locale (robustesse stockage) — distinct de
 * `BackupReminder` (rappel doux, réapparaît selon une durée) : ceci signale
 * un fait qui vient de se produire ("ta dernière action n'a pas été
 * enregistrée"), donc rendu en rose (danger), pas en ambre.
 *
 * Monté une seule fois dans `AppShell` (pas sur une page précise) : l'échec
 * peut survenir n'importe où (FocusView en pleine séance, Réglages,
 * import…) et doit rester visible quelle que soit la page où l'utilisateur
 * navigue ensuite — voir `hooks/use-prepahub-data.ts#storageError`.
 *
 * Cause la plus probable : quota `localStorage` dépassé (banque volumineuse
 * après plusieurs mois d'usage) ou navigation privée. Aucun moyen fiable de
 * distinguer les deux depuis le navigateur, donc un message générique plutôt
 * que d'inventer un diagnostic précis.
 */
export function StorageErrorBanner() {
  const { storageError, dismissStorageError } = usePrepahubData();

  if (!storageError) return null;

  function handleExport() {
    // Best-effort : si l'export échoue aussi (même cause sous-jacente), on
    // n'aggrave pas la situation — l'utilisateur garde au moins le bandeau
    // et le message d'explication.
    try {
      exportBackup();
    } catch {
      // Rien de plus à faire ici : le stockage est indisponible des deux côtés.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
        <p className="text-zinc-300">
          Ta dernière modification n&apos;a pas pu être enregistrée — stockage local plein ou inaccessible. Exporte tes
          données existantes, puis libère de l&apos;espace (historique/cache du navigateur) avant de continuer.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleExport}>
          <Download size={14} /> Exporter ce qui est sauvegardé
        </Button>
        <Button size="icon" variant="ghost" aria-label="Ignorer l'alerte" onClick={dismissStorageError}>
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
