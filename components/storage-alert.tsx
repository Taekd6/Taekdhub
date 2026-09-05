"use client";

import { AlertTriangle, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/state";
import { exportBackup, lastStorageWriteFailure } from "@/lib/storage";

/**
 * Alerte « le navigateur a REFUSÉ d'enregistrer » — le seul écran de toute
 * l'app qui doit interrompre le travail en cours.
 *
 * TaekdHub n'a pas de compte : `localStorage` est la seule mémoire du
 * produit. Or une écriture peut être refusée (quota dépassé — la banque
 * pèse déjà quelques mégaoctets sur un budget de cinq, navigation privée,
 * stockage bloqué par le navigateur). Jusqu'ici cet échec était totalement
 * muet : l'élève déclarait « réussi », voyait l'écran de fin de séance
 * défiler normalement, et retrouvait une séance vide au rechargement. Le
 * pire mode de défaillance possible pour un outil de révision — celui où
 * l'on croit avoir travaillé pour rien.
 *
 * `lastStorageWriteFailure` (lib/storage.ts) enregistre ces refus. Il ne
 * restait qu'à le DIRE. Affiché dans l'AppShell, donc sur toutes les pages :
 * une écriture échoue le plus souvent en pleine séance, pas sur le tableau
 * de bord.
 *
 * Ce composant SCRUTE volontairement le refus au lieu de lire le
 * `writeFailedAt` de `usePrepahubData` : ce hook n'est pas un magasin
 * partagé, chaque appel crée son propre `useState`. L'alerte, montée dans
 * l'AppShell, a donc sa propre instance — qui n'enregistre jamais rien et ne
 * verrait jamais l'échec provoqué par l'instance de la page. Vérifié en
 * simulant un quota dépassé dans le navigateur : la première version, câblée
 * sur le hook, restait muette exactement dans le cas qu'elle existe pour
 * couvrir. Le refus étant conservé au niveau du module, une relecture
 * périodique le voit quelle que soit l'instance qui l'a subi ; deux secondes
 * suffisent, et c'est un chemin d'erreur, pas un chemin chaud.
 *
 * L'export est proposé sur-le-champ : il lit les données déjà en mémoire et
 * n'écrit rien dans `localStorage` (hors l'horodatage, lui-même sans
 * conséquence s'il échoue à son tour), c'est donc la seule action qui
 * fonctionne encore quand le stockage est plein — et celle qui sauve
 * réellement le travail de l'élève.
 */
export function StorageAlert() {
  const [failedAt, setFailedAt] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setFailedAt(lastStorageWriteFailure()?.at ?? null);
    read();
    const id = setInterval(read, 2000);
    return () => clearInterval(id);
  }, []);

  if (!failedAt) return null;

  return (
    <Notice
      tone="danger"
      className="mb-6"
      action={
        <Button size="sm" variant="secondary" onClick={() => exportBackup()}>
          <Download size={14} /> Exporter maintenant
        </Button>
      }
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
        <span>
          <strong className="font-medium text-ink">Ton navigateur a refusé d&apos;enregistrer.</strong> Le travail fait
          depuis peut être perdu au prochain rechargement. Exporte une sauvegarde maintenant, puis libère de
          l&apos;espace pour ce site.
        </span>
      </span>
    </Notice>
  );
}
