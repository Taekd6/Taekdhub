"use client";

import { useEffect } from "react";
import { AlertOctagon, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { exportBackup } from "@/lib/storage";

/**
 * Filet de sécurité global (robustesse) — capte toute erreur non gérée
 * pendant le rendu d'une page (voir la convention Next.js App Router :
 * `app/error.tsx`), pour ne jamais laisser un écran blanc sans explication
 * ni recours. Absent jusqu'ici : TaekdHub n'avait aucun filet, alors que
 * `localStorage` est la SEULE source de données de l'app (voir
 * `components/storage-error-banner.tsx` pour le cas spécifique, plus
 * fréquent, d'une écriture qui échoue sans faire planter le rendu).
 *
 * Ne couvre pas les erreurs dans `app/layout.tsx` lui-même (il faudrait un
 * `global-error.tsx` séparé, qui redéfinit `<html>/<body>`) : le layout ne
 * fait aucune lecture de données susceptible de jeter, donc pas nécessaire
 * ici — voir ThemeSync (lib/theme.ts), purement synchrone sur des chaînes déjà validées.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function handleExport() {
    try {
      exportBackup();
    } catch {
      // Best-effort — voir storage-error-banner.tsx, même principe : rien de
      // plus à faire si le stockage est indisponible des deux côtés.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <Card className="max-w-md p-8 text-center">
        <AlertOctagon className="mx-auto text-rose-300" size={28} />
        <CardTitle className="mt-4 text-lg">Une erreur inattendue s&apos;est produite</CardTitle>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Rien n&apos;a été perdu : tes données vivent dans le navigateur, pas dans cet écran. Exporte-les par précaution,
          puis réessaie.
        </p>
        <p className="mt-3 truncate font-mono text-2xs text-zinc-600">{error.message || "Erreur sans message."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw size={14} /> Réessayer
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download size={14} /> Exporter mes données
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/dashboard")}>
            Tableau de bord
          </Button>
        </div>
      </Card>
    </div>
  );
}
