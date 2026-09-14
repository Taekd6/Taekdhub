"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/state";
import { formatMinutes } from "@/lib/domain/date";
import { useStore } from "@/lib/store/store";

/**
 * DONNÉES — export, restauration, remise à zéro.
 *
 * Tout vit dans le navigateur : pas de compte, pas de serveur, donc aucune
 * récupération possible en cas de perte. L'export est la seule vraie
 * assurance, et il doit être trivial à trouver. La restauration REMPLACE tout
 * — on le dit explicitement avant, parce qu'on ne peut pas revenir en arrière.
 */
export function DataPanel() {
  const { state, exportBackup, importBackup, resetAll } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "warning" | "danger"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const workedMinutes = state.timeEntries.reduce((total, entry) => total + entry.minutes, 0);

  async function onFile(file: File) {
    const text = await file.text();
    if (importBackup(text)) setMessage({ tone: "info", text: "Sauvegarde restaurée." });
    else setMessage({ tone: "danger", text: "Ce fichier n'est pas une sauvegarde TaekdHub lisible." });
  }

  return (
    <Section
      label="Données"
      title="Sauvegarde"
      description="Tes données vivent dans ce navigateur, nulle part ailleurs. Exporte-les régulièrement."
    >
      <div className="space-y-4">
        <p className="t-meta">
          {state.tasks.length} tâches · {state.goals.length} objectifs · {state.routines.length} routines ·{" "}
          {formatMinutes(workedMinutes)} de travail enregistré.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download size={15} /> Exporter
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Restaurer
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
        </div>

        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        <div className="border-t border-line pt-4">
          {confirmReset ? (
            <Notice
              tone="danger"
              title="Tout effacer, définitivement ?"
              action={
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmReset(false)}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      resetAll();
                      setConfirmReset(false);
                      setMessage({ tone: "warning", text: "Toutes les données ont été effacées." });
                    }}
                  >
                    Effacer
                  </Button>
                </span>
              }
            >
              Tâches, objectifs, routines et historique de travail. Exporte d&apos;abord si tu hésites.
            </Notice>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={14} /> Tout effacer
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
