"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PdfDocumentModel } from "@/lib/chapter-pdf";

/**
 * « Télécharger le PDF » — fabrique le fichier DANS LE NAVIGATEUR au moment
 * du clic (lib/chapter-pdf.ts), depuis les données du moment : il est donc
 * toujours à jour. Sur iPad, Safari le propose dans Fichiers.
 *
 * pdf-lib et les polices ne sont chargés qu'au clic : la page du chapitre
 * n'en paie pas le poids à l'ouverture.
 */
export function PdfButton({ label, fileName, build }: { label: string; fileName: string; build: () => PdfDocumentModel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le PDF qui vient d'être fabriqué : sur iPad, Safari ignore parfois l'attribut `download` d'un lien interne et ne montre rien ; ce lien permet alors de l'ouvrir dans un onglet.
  const [opened, setOpened] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ renderPdf }, regular, bold] = await Promise.all([import("@/lib/chapter-pdf-render"), loadFont("DejaVuSans.ttf"), loadFont("DejaVuSans-Bold.ttf")]);
      const bytes = await renderPdf(build(), { regular, bold });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      setOpened((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Le PDF n'a pas pu être créé. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button type="button" variant="secondary" size="md" onClick={download} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
        {label}
      </Button>
      {opened && !error && (
        <a href={opened} target="_blank" rel="noopener" className="t-meta text-accent underline-offset-[3px] hover:underline">
          Rien ne s&apos;est téléchargé ? Ouvrir le PDF
        </a>
      )}
      {error && (
        <p role="alert" className="t-meta text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

const fontCache = new Map<string, Promise<ArrayBuffer>>();

function loadFont(name: string): Promise<ArrayBuffer> {
  let cached = fontCache.get(name);
  if (!cached) {
    cached = fetch(`/fonts/${name}`).then((response) => {
      if (!response.ok) throw new Error(`police ${name} introuvable`);
      return response.arrayBuffer();
    });
    // Un échec ne reste pas en cache : le clic suivant réessaie.
    cached.catch(() => fontCache.delete(name));
    fontCache.set(name, cached);
  }
  return cached;
}
