"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/state";
import { useStore } from "@/lib/store/store";

/**
 * « Ton navigateur a REFUSÉ d'enregistrer » — la seule alerte de l'application
 * qui a le droit d'interrompre.
 *
 * TaekdHub n'a pas de compte : le stockage du navigateur est la seule mémoire
 * du produit. Une écriture peut être refusée (quota, navigation privée,
 * stockage bloqué). Dans la version précédente, cet échec était MUET : l'élève
 * voyait sa séance enregistrée et la retrouvait disparue au rechargement. Le
 * pire mode de défaillance possible pour un outil de travail — donc on le dit,
 * et on propose sur-le-champ la seule action qui sauve encore les données :
 * l'export, qui lit la mémoire vive et n'écrit rien.
 */
export function StorageAlert() {
  const { writeFailedAt, exportBackup } = useStore();
  if (!writeFailedAt) return null;

  return (
    <Notice
      tone="danger"
      className="mb-6"
      action={
        <Button size="sm" variant="secondary" onClick={exportBackup}>
          <Download size={14} /> Exporter maintenant
        </Button>
      }
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
        <span>
          <strong className="font-medium text-ink">Ton navigateur a refusé d&apos;enregistrer.</strong> Ce que tu as
          fait depuis peut être perdu au prochain rechargement. Exporte une sauvegarde maintenant, puis libère de
          l&apos;espace pour ce site.
        </span>
      </span>
    </Notice>
  );
}
