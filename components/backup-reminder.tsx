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
 * Masqué : tant que l'élève n'a produit AUCUN travail personnel. La banque
 * est amorcée avec 402 exercices dès la première seconde (lib/seed.ts) : se
 * fier à `exercises.length` accueillait donc tout nouvel arrivant par un
 * bandeau d'avertissement orange — « tu n'as jamais sauvegardé tes données » —
 * avant même qu'il ait quoi que ce soit à perdre. Première impression du
 * produit : une corvée. Seul l'historique de séances prouve un travail réel,
 * c'est donc lui qui déclenche le rappel.
 *
 * Masqué aussi :
 * une fois la sauvegarde faite (le clic ici appelle le même export que
 * Réglages, donc réapparaît/disparaît selon la même règle des deux côtés),
 * ou pour le reste de la visite si l'utilisateur l'ignore (pas de "snooze"
 * persistant — un nouveau chargement de page réévalue depuis zéro, pour ne
 * jamais désactiver silencieusement le rappel pour de bon).
 */
export function BackupReminder() {
  const { sessions, lastBackupAt, ready, refresh } = usePrepahubData();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || dismissed) return null;

  if (sessions.length === 0) return null;

  const days = daysSinceBackup(lastBackupAt);
  const overdue = days === null || days >= BACKUP_REMINDER_DAYS;
  if (!overdue) return null;

  function handleExport() {
    exportBackup();
    refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm">
      {/* Dire la CONSÉQUENCE, pas seulement le fait : « ta dernière sauvegarde
          date de 9 jours » se lit comme une corvée administrative. Sans compte,
          une sauvegarde est la seule chose qui protège réellement l'année de
          travail de l'élève — il doit savoir pourquoi on l'embête. */}
      <p className="text-ink">
        {days === null
          ? "Ton travail n'existe que dans ce navigateur : une sauvegarde te permet de le retrouver ailleurs."
          : `Dernière sauvegarde il y a ${days} jours — ton travail n'existe que dans ce navigateur.`}
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
