"use client";

import { AlertTriangle, Download, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Section } from "@/components/ui/section";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { exportBackup, restoreBackup, validateBackupPayload, type BackupPayload } from "@/lib/storage";

export function DataBackup() {
  const { refresh } = usePrepahubData();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  /*
   * Un échec de restauration ne peut pas s'afficher comme une confirmation.
   * `role="alert"` (et non `status`) le fait annoncer immédiatement par un
   * lecteur d'écran, et la teinte reprend celle déjà employée par
   * <StorageAlert> pour exactement le même sujet — le disque plein.
   */
  const [failed, setFailed] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);

  function exportData() {
    exportBackup();
    refresh();
    setFailed(false);
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
        setFailed(false);
        setMessage("");
        setPendingImport(data);
      } catch {
        setPendingImport(null);
        setFailed(true);
        setMessage("Ce fichier n'est pas une sauvegarde TaekdHub valide.");
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    /*
     * Toute la logique est dans lib/storage.ts#restoreBackup : elle écrit la
     * banque en premier, s'arrête au premier refus et renvoie exactement ce
     * qui est passé. Ici, on ne fait plus que le DIRE.
     *
     * L'ancienne version enchaînait huit écritures sans lire un seul de leurs
     * retours, puis affichait « Sauvegarde restaurée » quoi qu'il arrive —
     * y compris quand le quota avait laissé les exercices de la machine face
     * aux séances du fichier, notes effacées au passage.
     */
    const outcome = restoreBackup(pendingImport);
    setPendingImport(null);
    // Dans tous les cas : l'état React doit refléter le disque, pas
    // l'intention. Sans ce `refresh`, les formulaires de Réglages gardaient
    // leur instantané d'AVANT l'import et le réécrivaient au clic suivant.
    refresh();

    setFailed(!outcome.ok);
    if (outcome.ok) {
      setMessage("Sauvegarde restaurée. Recharge la page.");
      return;
    }
    if (outcome.intact) {
      setMessage(
        `Restauration impossible : l'enregistrement a échoué sur ${outcome.failedAt}, faute de place. Rien n'a été modifié sur cet appareil — libère de l'espace, puis réessaie.`
      );
      return;
    }
    // « l'enregistrement de les séances » : les libellés portent déjà leur
    // article, on ne peut donc pas les faire suivre d'un « de ». La phrase
    // est tournée pour que l'article reste correct quel que soit l'élément.
    setMessage(
      `Restauration INCOMPLÈTE : ${outcome.restored.join(", ")} ${outcome.restored.length > 1 ? "ont été restaurés" : "a été restauré"}, puis l'enregistrement a échoué sur ${outcome.failedAt}, faute de place. Le reste est resté tel qu'il était sur cet appareil. Libère de l'espace, puis relance l'import du même fichier.`
    );
  }

  function cancelImport() {
    // Aucune donnée locale n'a été touchée : on jette simplement le fichier lu.
    setPendingImport(null);
    setFailed(false);
    setMessage("Import annulé, aucune donnée n'a été modifiée.");
  }

  return (
    <Section
      variant="panel"
      label="Données locales"
      title="Tes données restent sous ton contrôle."
      className="max-w-2xl"
    >
      {/* Dit franchement ce que « local » implique. TaekdHub n'a pas de compte :
          l'élève doit pouvoir décider en connaissance de cause, pas découvrir
          la contrainte le jour où il perd son année. */}
      <p className="t-body max-w-[64ch] text-muted">
        TaekdHub fonctionne sans compte : tes exercices, tes séances et ta progression sont enregistrés dans ce navigateur, sur cet
        appareil, et nulle part ailleurs. Ils ne partent sur aucun serveur — mais ils ne te suivent pas non plus d&apos;un appareil à
        l&apos;autre, et vider les données du navigateur les efface.
      </p>
      <p className="t-body mt-3 max-w-[64ch] text-muted">
        La sauvegarde est donc ta seule copie : exporte-la régulièrement, et restaure-la sur ton nouvel appareil.
        L&apos;import remplace les données de cet appareil, jamais celles d&apos;un autre.
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

      <>
        {pendingImport && (
          <div className="animate-rise mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div className="t-body text-muted">
                <p className="t-subhead text-ink">Remplacer tes données locales ?</p>
                <p className="mt-1">
                  Ce fichier contient <span className="font-medium text-ink">{pendingImport.exercises.length}</span> exercice
                  {pendingImport.exercises.length > 1 ? "s" : ""}, <span className="font-medium text-ink">{pendingImport.sessions.length}</span> séance
                  {pendingImport.sessions.length > 1 ? "s" : ""}
                  {pendingImport.chapters?.length ? (
                    <>
                      , <span className="font-medium text-ink">{pendingImport.chapters.length}</span> chapitre
                      {pendingImport.chapters.length > 1 ? "s" : ""}
                    </>
                  ) : null}
                  {pendingImport.reviewItems?.length ? (
                    <>
                      , <span className="font-medium text-ink">{pendingImport.reviewItems.length}</span> ligne
                      {pendingImport.reviewItems.length > 1 ? "s" : ""} du carnet « À revoir »
                    </>
                  ) : null}
                  {pendingImport.errors?.length ? (
                    <>
                      , <span className="font-medium text-ink">{pendingImport.errors.length}</span> erreur
                      {pendingImport.errors.length > 1 ? "s" : ""} du carnet d&apos;erreurs
                    </>
                  ) : null}
                  {pendingImport.weekSnapshots?.length ? (
                    <>
                      {" "}
                      et <span className="font-medium text-ink">{pendingImport.weekSnapshots.length}</span> semaine
                      {pendingImport.weekSnapshots.length > 1 ? "s" : ""} de progression
                    </>
                  ) : null}
                  {pendingImport.exportedAt && ` (exporté le ${new Date(pendingImport.exportedAt).toLocaleDateString("fr-FR")})`}. Cette
                  action remplacera définitivement tes exercices, chapitres, séances, échéances, notes, carnet « À revoir », carnet d&apos;erreurs, préférences et historique de progression actuels sur cet appareil.
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
          </div>
        )}
      </>

      {message && (
        <p role={failed ? "alert" : "status"} className={cn("mt-4 text-sm", failed ? "text-rose-300" : "text-accent")}>
          {message}
        </p>
      )}
    </Section>
  );
}
