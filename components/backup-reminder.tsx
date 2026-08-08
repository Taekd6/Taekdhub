"use client";

import { Download, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { BACKUP_REMINDER_DAYS, daysSinceBackup, exportBackup } from "@/lib/storage";

/**
 * Rappel de sauvegarde (finalisation V1) — discret, jamais bloquant.
 *
 * Réutilise `exportBackup()` (lib/storage.ts), le même mécanisme que
 * Réglages > Données locales : aucun second système de sauvegarde.
 *
 * Masqué : tant qu'il n'y a rien à protéger (banque et historique vides),
 * une fois la sauvegarde faite (le clic ici appelle le même export que
 * Réglages, donc réapparaît/disparaît selon la même règle des deux côtés),
 * ou pour le reste de la visite si l'utilisateur l'ignore (pas de "snooze"
 * persistant — un nouveau chargement de page réévalue depuis zéro, pour ne
 * jamais désactiver silencieusement le rappel pour de bon).
 */
export function BackupReminder() {
  const { exercises, sessions, lastBackupAt, ready, refresh } = usePrepahubData();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || dismissed) return null;

  const hasData = exercises.length > 0 || sessions.length > 0;
  if (!hasData) return null;

  const days = daysSinceBackup(lastBackupAt);
  const overdue = days === null || days >= BACKUP_REMINDER_DAYS;
  if (!overdue) return null;

  function handleExport() {
    exportBackup();
    refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm">
      <p className="text-zinc-300">
        {days === null ? "Tu n'as encore jamais sauvegardé tes données." : `Ta dernière sauvegarde date de ${days} jours.`}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleExport}>
          <Download size={14} /> Exporter maintenant
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ignorer le rappel" onClick={() => setDismissed(true)}>
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
