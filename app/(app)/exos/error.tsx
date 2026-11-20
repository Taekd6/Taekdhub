"use client";

import { useEffect } from "react";

/**
 * Filet de l'écran Exos : une erreur d'affichage montre son message (à
 * envoyer à Claude) et un bouton pour réessayer, au lieu de la page blanche
 * « Application error » de Next.
 */
export default function ExosError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const detail = [error?.name, error?.message, error?.digest ? `digest ${error.digest}` : null, (error?.stack ?? "").split("\n").slice(0, 4).join("\n")].filter(Boolean).join("\n");
  return (
    <div className="mx-auto max-w-[40rem] space-y-4 rounded-3xl bg-white p-6 text-[#1d1d1f] shadow">
      <p className="text-sm font-semibold text-[#6e6e73]">Exos</p>
      <h1 className="text-2xl font-extrabold">L&apos;écran a rencontré une erreur</h1>
      <p>Fais une capture de ce message et envoie-la à Claude : il dit exactement ce qui a planté.</p>
      <pre className="whitespace-pre-wrap break-words rounded-2xl bg-[#f2f3f7] p-4 text-xs">{detail || "Erreur sans message."}</pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => reset()} className="rounded-xl bg-[#0a6cff] px-4 py-2.5 font-semibold text-white">
          Réessayer
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#0a6cff] px-4 py-2.5 font-semibold text-white">
          Recharger la page
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              navigator.clipboard?.writeText(detail);
            } catch {
              /* copie refusée */
            }
          }}
          className="rounded-xl bg-[#e6edfc] px-4 py-2.5 font-semibold text-[#0a6cff]"
        >
          Copier le message
        </button>
      </div>
    </div>
  );
}
