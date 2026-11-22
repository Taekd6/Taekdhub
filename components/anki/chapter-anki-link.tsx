"use client";

import { ExternalLink } from "lucide-react";

import { useAnkiPlatform } from "@/components/memory/anki-link";
import { ankiStudyUrl } from "@/lib/anki";
import { chapterAnkiDecks, deckShortName } from "@/lib/anki-chapter-decks";
import { cn } from "@/lib/cn";

/**
 * « OUVRIR DANS ANKI » pour un chapitre du programme : renvoie pile au bon
 * paquet (lib/anki-chapter-decks.ts). Sur iPad / iPhone, le bouton lance la
 * séance d'étude du paquet principal (AnkiMobile 25.07.1+, voir lib/anki.ts) ;
 * quand le chapitre a d'autres paquets, ils sont proposés à côté. Sur
 * ordinateur, Anki n'a pas de schéma d'URL : pas de lien mort, une phrase
 * avec le nom du paquet. Chapitre sans paquet : un message — jamais un
 * bouton qui ne mènerait nulle part.
 *
 * Lu APRÈS le montage (la plateforme n'est connue qu'au navigateur) : rien
 * ne s'affiche d'ici là, pour que les rendus serveur et client coïncident.
 */
export function ChapterAnkiLink({ chapterId, size = "sm", showEmpty = false, icon = false, label, className }: { chapterId: string; size?: "sm" | "md"; showEmpty?: boolean; /** Pastille ronde sans texte (vignettes du programme) — rien sur ordinateur ni sans paquet. */ icon?: boolean; /** Nom du chapitre, pour l'étiquette d'accessibilité de la pastille. */ label?: string; className?: string }) {
  const platform = useAnkiPlatform();
  const decks = chapterAnkiDecks(chapterId);
  if (!platform) return null;

  if (icon) {
    const url = decks.length > 0 ? ankiStudyUrl(decks[0], platform) : null;
    if (!url) return null;
    return (
      <a href={url} aria-label={`Ouvrir ${label ? `« ${label} »` : "le chapitre"} dans Anki`} title="Ouvrir dans Anki" data-anki-link="study-icon" className={cn("press grid h-11 w-11 place-items-center rounded-full bg-inset text-subtle hover:text-ink", className)}>
        <ExternalLink size={16} aria-hidden />
      </a>
    );
  }

  if (decks.length === 0) {
    return showEmpty ? <p className={cn("t-meta text-2xs", className)}>Pas de paquet Anki pour ce chapitre.</p> : null;
  }

  const [main, ...others] = decks;
  const mainUrl = ankiStudyUrl(main, platform);
  if (!mainUrl) {
    return (
      <p className={cn("t-meta text-2xs", className)}>
        Ouvre Anki sur ton iPad · paquet <span className="font-semibold text-ink">{deckShortName(main)}</span>
      </p>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <a
        href={mainUrl}
        className={cn(
          "grad-brand bounce-press inline-flex items-center gap-1.5 rounded-full font-semibold [box-shadow:0_8px_18px_-8px_var(--g1)]",
          size === "sm" ? "min-h-9 px-4 text-sm max-lg:min-h-11" : "min-h-11 px-5 text-[0.9375rem]"
        )}
        data-anki-link="study"
        title={main.replaceAll("::", " › ")}
      >
        <ExternalLink size={14} strokeWidth={2.6} aria-hidden /> Ouvrir dans Anki
      </a>
      {others.map((deck) => (
        <a key={deck} href={ankiStudyUrl(deck, platform) ?? undefined} className="t-meta text-2xs text-accent hover:underline" data-anki-link="study-more" title={deck.replaceAll("::", " › ")}>
          + {deckShortName(deck)}
        </a>
      ))}
    </span>
  );
}
