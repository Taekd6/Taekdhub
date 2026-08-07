"use client";

import { Download, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { localData } from "@/lib/storage";

export function DataBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  function exportData() {
    const data = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        exercises: localData.exercises(),
        sessions: localData.sessions(),
        preferences: localData.preferences(),
      },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prepahub-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Sauvegarde téléchargée.");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.exercises) || !Array.isArray(data.sessions) || !data.preferences) throw new Error();
        localData.saveExercises(data.exercises);
        localData.saveSessions(data.sessions);
        localData.savePreferences(data.preferences);
        setMessage("Sauvegarde restaurée. Recharge la page.");
      } catch {
        setMessage("Ce fichier n'est pas une sauvegarde Prepahub valide.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
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
      {message && (
        <p role="status" className="mt-4 text-sm text-accent">
          {message}
        </p>
      )}
    </Card>
  );
}
