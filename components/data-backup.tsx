"use client";

import { AlertTriangle, Download, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Group, Row } from "@/components/ui/grouped";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useAccount } from "@/components/account/account-provider";
import { exportBackup, restoreBackup, validateBackupPayload, type BackupPayload } from "@/lib/storage";

export function DataBackup() {
  const { refresh } = usePrepahubData();
  // Connecté, le fichier n'est plus la seule copie — et un import part aussi vers le compte.
  const connected = useAccount().user !== null;
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
     * Toute la logique est dans lib/storage.ts#restoreBackup : elle écrit les
     * séances en premier, s'arrête au premier refus et renvoie exactement ce
     * qui est passé. Ici, on ne fait plus que le DIRE.
     *
     * L'ancienne version enchaînait les écritures sans lire un seul de leurs
     * retours, puis affichait « Sauvegarde restaurée » quoi qu'il arrive —
     * y compris quand le quota avait laissé un mélange des deux appareils,
     * notes effacées au passage.
     *
     * Une ancienne sauvegarde qui contient encore la banque d'exercices
     * (`exercises`, `chapters`) s'importe normalement : ces deux champs sont
     * ignorés, la banque ayant été retirée de l'application.
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
    <div className="space-y-4">
      {/* Dit franchement ce que « local » implique. TaekdHub n'a pas de compte :
          l'élève doit pouvoir décider en connaissance de cause, pas découvrir
          la contrainte le jour où il perd son année. */}
      <Group
        title="Tes données"
        footer={
          <>
            {/* Une ligne, mais la vraie : sans compte, la sauvegarde est la
                seule copie, et vider le navigateur efface tout. */}
            {connected ? (
              <p>Ton compte garde déjà une copie ; ce fichier en est une de plus, hors ligne. L&apos;import remplace les données de cet appareil et de ton compte.</p>
            ) : (
              <p>Tout reste dans ce navigateur, sans compte : la sauvegarde est ta seule copie. L&apos;import remplace les données de cet appareil.</p>
            )}
          </>
        }
      >
        <Row label="Exporter une sauvegarde" hint="Un fichier à garder en lieu sûr.">
          <Button variant="secondary" size="sm" onClick={exportData}>
            <Download size={15} aria-hidden /> Exporter
          </Button>
        </Row>
        <Row label="Restaurer une sauvegarde" hint="Remplace les données de cet appareil.">
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
            <Upload size={15} aria-hidden /> Restaurer
          </Button>
          <input ref={input} onChange={importData} type="file" accept="application/json" className="hidden" aria-label="Fichier de sauvegarde" />
        </Row>
      </Group>

      {pendingImport && (
        <div role="alertdialog" aria-label="Remplacer tes données locales ?" className="surface border-amber-400/30 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
            <div className="t-body text-muted">
              <p className="t-subhead text-ink">Remplacer tes données locales ?</p>
              <p className="mt-1 text-[0.9375rem]">
                Ce fichier contient <span className="font-medium text-ink">{pendingImport.sessions.length}</span> séance
                {pendingImport.sessions.length > 1 ? "s" : ""}
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
                    {pendingImport.weekSnapshots.length > 1 ? "s" : ""} figée{pendingImport.weekSnapshots.length > 1 ? "s" : ""}
                  </>
                ) : null}
                {pendingImport.exportedAt && ` (exporté le ${new Date(pendingImport.exportedAt).toLocaleDateString("fr-FR")})`}. Cette
                action remplacera définitivement tes séances, échéances, notes, carnet « À revoir », carnet d&apos;erreurs, préférences et historique de progression actuels sur cet appareil.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelImport}>
              Annuler
            </Button>
            <Button variant="danger" size="sm" onClick={confirmImport}>
              Confirmer le remplacement
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role={failed ? "alert" : "status"} className={cn("px-1 text-sm font-semibold sm:px-5", failed ? "text-rose-300" : "text-accent")}>
          {message}
        </p>
      )}
    </div>
  );
}
