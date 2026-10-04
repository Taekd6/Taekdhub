"use client";

import { useState } from "react";
import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import type { AnkiPlatform } from "@/lib/anki";
import { fetchTransport } from "@/lib/anki-connect";
import { ANKI_DECK_PREFIX, ankiTextExport, exportableItems, sendToAnki } from "@/lib/anki-export";
import { localData, type ReviewItem } from "@/lib/storage";

/**
 * « Envoyer tes fiches vers Anki » (lib/anki-export.ts) — le seul endroit où
 * TaekdHub écrit dans Anki, et seulement sur ce clic.
 */
export function AnkiCardExport({ reviewItems, saveReviewItems, platform }: { reviewItems: ReviewItem[]; saveReviewItems: (items: ReviewItem[]) => void; platform: AnkiPlatform | null }) {
  const cards = exportableItems(reviewItems);
  const methods = cards.filter((item) => item.kind === "méthode").length;
  const fromClaude = cards.filter((item) => item.origin === "claude").length;
  const [busy, setBusy] = useState(false);
  const [closeAfter, setCloseAfter] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const mobile = platform === "ios" || platform === "android";

  /**
   * Les notes « À revoir » arrivées dans Anki sont marquées faites ; les méthodes restent (aide-mémoire).
   * Les fiches du verrou de cours aussi : seule leur note dans TaekdHub (ou avec Claude) déverrouille le chapitre.
   * Relu sur le disque : le carnet s'écrit en remplacement.
   */
  function closeInTaekdhub(ids: string[]) {
    const at = new Date().toISOString();
    const current = localData.reviewItems();
    saveReviewItems(current.map((item) => (ids.includes(item.id) && item.kind !== "méthode" && item.origin !== "claude" && item.doneAt === null ? { ...item, doneAt: at } : item)));
  }

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendToAnki(fetchTransport(), cards);
      if (closeAfter) closeInTaekdhub(result.inAnki);
      const parts = [`${result.added} carte${result.added > 1 ? "s" : ""} ajoutée${result.added > 1 ? "s" : ""}`];
      if (result.duplicates > 0) parts.push(`${result.duplicates} déjà dans Anki`);
      if (result.failed > 0) parts.push(`${result.failed} refusée${result.failed > 1 ? "s" : ""} par Anki`);
      setMessage({ tone: result.failed > 0 ? "error" : "ok", text: `${parts.join(", ")}. Paquets « ${ANKI_DECK_PREFIX}::… », étiquette « taekdhub ». Pense à synchroniser Anki pour les retrouver sur ton téléphone.` });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "L'envoi a échoué." });
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([ankiTextExport(cards)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taekdhub-fiches-anki-${new Date().toLocaleDateString("en-CA")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section
      variant="panel"
      title="Envoyer tes fiches vers Anki"
      description="Les fiches nées dans TaekdHub (méthodes tirées d'un blocage, notes « À revoir » avec une réponse) deviennent des cartes Anki. Rien n'est envoyé sans ce clic, et une carte déjà présente n'est pas recréée."
    >
      {cards.length === 0 ? (
        <p className="t-meta">Aucune fiche avec une réponse pour l&apos;instant. Ajoute un verso à tes notes « À revoir », ou analyse un blocage dans « À refaire » : la fiche de méthode apparaîtra ici.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.9375rem] font-semibold text-ink">
            {cards.length} fiche{cards.length > 1 ? "s" : ""} prête{cards.length > 1 ? "s" : ""}, dont {methods} méthode{methods > 1 ? "s" : ""}
            {fromClaude > 0 && `, et ${fromClaude} fiche${fromClaude > 1 ? "s" : ""} de cours de Claude`}.
          </p>
          {fromClaude > 0 && (
            <p className="t-meta text-2xs">
              Les fiches de Claude vont dans le paquet de leur chapitre (« {ANKI_DECK_PREFIX}::Matière::Chapitre »). Anki ne dit pas à TaekdHub ce que tu as retrouvé : pour déverrouiller le chapitre, retrouve-les aussi dans la séance « À revoir », ou fais-toi interroger par Claude.
            </p>
          )}
          <label className="flex items-start gap-2 text-[0.8125rem] font-semibold text-muted">
            <input type="checkbox" checked={closeAfter} onChange={(event) => setCloseAfter(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--btn-g1)]" />
            Une fois dans Anki, retirer les notes « À revoir » des révisions de TaekdHub (pour ne pas les réviser deux fois). Les méthodes restent dans leur aide-mémoire.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void send()} disabled={busy || mobile}>
              <Send size={15} aria-hidden /> {busy ? "Envoi…" : "Envoyer vers Anki"}
            </Button>
            <Button variant="secondary" size="sm" onClick={download}>
              <Download size={14} aria-hidden /> Fichier à importer
            </Button>
          </div>
          {mobile && <p className="t-meta text-2xs">Sur téléphone, l&apos;envoi direct est impossible : fais-le depuis l&apos;ordinateur où Anki est ouvert, puis synchronise.</p>}
          <p className="t-meta text-2xs">Sans AnkiConnect : « Fichier à importer », puis dans Anki (ordinateur) Fichier › Importer. Paquets et étiquettes sont déjà dans le fichier.</p>
          {message && (
            <p role="status" className={message.tone === "ok" ? "rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink" : "rounded-xl bg-rose-400/[0.1] px-3 py-2 text-[0.875rem] font-semibold text-rose-300"}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
