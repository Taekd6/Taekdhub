"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { exportBackup, localData, validateBackupPayload, type BackupPayload } from "@/lib/storage";

export function DataBackup() {
  const { refresh } = usePrepahubData();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);

  function exportData() {
    exportBackup();
    refresh();
    setMessage("Sauvegarde téléchargée.");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!validateBackupPayload(data)) throw new Error();
        // Rien n'est écrit ici : on attend la confirmation explicite de l'utilisateur.
        setMessage("");
        setPendingImport(data);
      } catch {
        setPendingImport(null);
        setMessage("Ce fichier n'est pas une sauvegarde TaekdHub valide.");
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    localData.saveExercises(pendingImport.exercises);
    localData.saveSessions(pendingImport.sessions);
    localData.savePreferences(pendingImport.preferences);
    // Chapitres : indispensables pour que les `chapter_id` des exercices
    // pointent vers un catalogue réel. Absents d'une sauvegarde ancienne
    // (exportée avant l'ajout des chapitres à l'export) → restaurés à [].
    localData.saveChapters(pendingImport.chapters ?? []);
    // Sauvegarde d'avant le Sprint 2.1 : pas de weekSnapshots dans le fichier, restaurés à [] proprement.
    localData.saveWeekSnapshots(pendingImport.weekSnapshots ?? []);
    setPendingImport(null);
    setMessage("Sauvegarde restaurée. Recharge la page.");
  }

  function cancelImport() {
    // Aucune donnée locale n'a été touchée : on jette simplement le fichier lu.
    setPendingImport(null);
    setMessage("Import annulé, aucune donnée n'a été modifiée.");
  }

  return (
    <Card className="max-w-2xl p-6">
      <p className="eyebrow">Données locales</p>
      <h2 className="mt-2 text-lg font-semibold">Tes données restent sous ton contrôle.</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Exporte une sauvegarde avant un changement d&apos;ordinateur ou restaure une sauvegarde existante.
        L&apos;import remplace uniquement les données stockées localement sur cet appareil.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportData}>
          <Download size={16} /> Exporter
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Upload size={16} /> Restaurer
        </Button>
        <input ref={input} onChange={importData} type="file" accept="application/json" className="hidden" />
      </div>

      <AnimatePresence>
        {pendingImport && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div className="text-sm leading-6 text-zinc-300">
                <p className="font-semibold text-zinc-100">Remplacer tes données locales ?</p>
                <p className="mt-1 text-zinc-400">
                  Ce fichier contient <span className="font-medium text-zinc-200">{pendingImport.exercises.length}</span> exercice
                  {pendingImport.exercises.length > 1 ? "s" : ""}, <span className="font-medium text-zinc-200">{pendingImport.sessions.length}</span> séance
                  {pendingImport.sessions.length > 1 ? "s" : ""}
                  {pendingImport.chapters?.length ? (
                    <>
                      , <span className="font-medium text-zinc-200">{pendingImport.chapters.length}</span> chapitre
                      {pendingImport.chapters.length > 1 ? "s" : ""}
                    </>
                  ) : null}
                  {pendingImport.weekSnapshots?.length ? (
                    <>
                      {" "}
                      et <span className="font-medium text-zinc-200">{pendingImport.weekSnapshots.length}</span> semaine
                      {pendingImport.weekSnapshots.length > 1 ? "s" : ""} de progression
                    </>
                  ) : null}
                  {pendingImport.exportedAt && ` (exporté le ${new Date(pendingImport.exportedAt).toLocaleDateString("fr-FR")})`}. Cette
                  action remplacera définitivement tes exercices, chapitres, séances, préférences et historique de progression actuels sur cet appareil.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancelImport}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={confirmImport}>
                Confirmer le remplacement
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <p role="status" className="mt-4 text-sm text-accent">
          {message}
        </p>
      )}
    </Card>
  );
}
