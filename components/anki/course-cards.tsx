"use client";

import { useState } from "react";
import { Download, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Section } from "@/components/ui/section";
import type { AnkiPlatform } from "@/lib/anki";
import { fetchTransport } from "@/lib/anki-connect";
import { sendCards } from "@/lib/anki-export";
import { COURSE_CHAPTERS, COURSE_DECK_URL, courseAnkiCards } from "@/lib/course-cards";

const TOTAL = COURSE_CHAPTERS.reduce((sum, chapter) => sum + chapter.cards.length, 0);

/**
 * CARTES DE COURS (lib/course-cards.ts) — le paquet de spé maths, à prendre
 * en entier (.apkg, iPhone compris) ou chapitre par chapitre (AnkiConnect).
 */
export function CourseCards({ platform }: { platform: AnkiPlatform | null }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const mobile = platform === "ios" || platform === "android";
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]));

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendCards(fetchTransport(), courseAnkiCards(selected));
      setMessage({
        tone: result.failed > 0 ? "error" : "ok",
        text: `${result.added} carte${result.added > 1 ? "s" : ""} ajoutée${result.added > 1 ? "s" : ""}${result.duplicates > 0 ? `, ${result.duplicates} déjà dans Anki` : ""}${result.failed > 0 ? `, ${result.failed} refusée${result.failed > 1 ? "s" : ""}` : ""}. Synchronise Anki pour les retrouver sur ton téléphone.`,
      });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "L'envoi a échoué." });
    } finally {
      setBusy(false);
    }
  }

  const shown = COURSE_CHAPTERS.find((chapter) => chapter.chapterId === preview) ?? null;

  return (
    <Section
      variant="panel"
      title="Cartes de cours — maths MP"
      description={`${TOTAL} cartes prêtes sur ${COURSE_CHAPTERS.length} chapitres de spé : définitions, théorèmes avec leurs hypothèses, et méthodes « Quand je vois… ». Un paquet par chapitre, associé tout seul au bon chapitre du diagnostic.`}
    >
      <div className="space-y-4">
        <div>
          <p className="text-[0.9375rem] font-semibold text-ink">Tout le paquet (iPhone ou ordinateur)</p>
          <p className="t-meta mt-1">
            {mobile ? "Télécharge-le, puis ouvre-le depuis l'app Fichiers : AnkiMobile l'importe." : "Télécharge-le, puis double-clique dessus (ou Fichier › Importer dans Anki)."} Réimporter une version mise à jour corrige les cartes sans les dupliquer ni perdre tes révisions.
          </p>
          <a href={COURSE_DECK_URL} download className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}>
            <Download size={14} aria-hidden /> Télécharger le paquet (.apkg)
          </a>
        </div>

        <div>
          <p className="text-[0.9375rem] font-semibold text-ink">Chapitre par chapitre</p>
          <ul className="mt-2 divide-y divide-line">
            {COURSE_CHAPTERS.map((chapter) => (
              <li key={chapter.chapterId} className="flex items-center gap-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-[0.875rem] font-semibold text-ink">
                  <input type="checkbox" checked={selected.includes(chapter.chapterId)} onChange={() => toggle(chapter.chapterId)} className="h-4 w-4 shrink-0 accent-[var(--btn-g1)]" />
                  <span className="truncate">{chapter.title}</span>
                  <span className="t-meta shrink-0 text-2xs">{chapter.cards.length} cartes</span>
                </label>
                <button type="button" onClick={() => setPreview((value) => (value === chapter.chapterId ? null : chapter.chapterId))} aria-expanded={preview === chapter.chapterId} className="shrink-0 text-2xs font-semibold text-accent hover:underline">
                  {preview === chapter.chapterId ? "Masquer" : "Voir"}
                </button>
              </li>
            ))}
          </ul>
          {shown && (
            <ul className="mt-3 space-y-2">
              {shown.cards.map((card) => (
                <li key={card.front} className="well rounded-xl p-3 text-[0.875rem]">
                  <p className="font-semibold text-ink">{card.front}</p>
                  <p className="t-meta mt-1 whitespace-pre-line">{card.back}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void send()} disabled={busy || mobile || selected.length === 0}>
              <Send size={14} aria-hidden /> {busy ? "Envoi…" : `Envoyer ${selected.length > 0 ? `${selected.length} chapitre${selected.length > 1 ? "s" : ""}` : ""} vers Anki`}
            </Button>
            {mobile && <span className="t-meta text-2xs">Envoi direct depuis l&apos;ordinateur (AnkiConnect) ; sur téléphone, prends le paquet complet.</span>}
          </div>
          {message && (
            <p role="status" className={message.tone === "ok" ? "mt-3 rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink" : "mt-3 rounded-xl bg-rose-400/[0.1] px-3 py-2 text-[0.875rem] font-semibold text-rose-300"}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
