"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ankiDeckSearchUrl, ankiOpenUrl, detectAnkiPlatform, type AnkiPlatform } from "@/lib/anki";
import { cn } from "@/lib/cn";

/**
 * « OUVRIR ANKI » — le pont vers l'application où l'élève révise.
 *
 * La plateforme n'est connue qu'au navigateur (user-agent, écran tactile) :
 * elle est lue APRÈS le montage, pour que le rendu serveur et le premier
 * rendu client soient identiques. D'ici là, rien ne s'affiche — un bouton
 * qui changerait de sens une fraction de seconde plus tard serait pire.
 *
 * Sur ordinateur, pas de lien mort (Anki bureau n'a pas de schéma d'URL) :
 * une phrase, « Ouvre Anki sur ton téléphone ». Le nom du paquet, quand il
 * existe, est TOUJOURS écrit : c'est lui qui dit où aller une fois Anki
 * ouvert. Voir lib/anki.ts pour ce que fait chaque lien.
 */
export function AnkiLink({ deck, size = "sm", className }: { deck?: string; size?: "sm" | "md"; className?: string }) {
  const platform = useAnkiPlatform();
  if (!platform) return null;

  const open = ankiOpenUrl(platform);
  const search = ankiDeckSearchUrl(deck, platform);

  if (!open) {
    return (
      <p className={cn("t-meta text-2xs", className)}>
        Ouvre Anki sur ton téléphone{deck ? <> · paquet <span className="font-semibold text-ink">{deck}</span></> : null}
      </p>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <a href={open} className={buttonVariants({ variant: "secondary", size })} data-anki-link="open">
        <ExternalLink size={14} aria-hidden /> Ouvrir Anki
      </a>
      {deck && (
        <span className="t-meta text-2xs">
          paquet <span className="font-semibold text-ink">{deck}</span>
          {search && (
            <>
              {" · "}
              <a href={search} className="text-accent hover:underline" data-anki-link="search">
                voir ses cartes
              </a>
            </>
          )}
        </span>
      )}
    </span>
  );
}

function useAnkiPlatform(): AnkiPlatform | null {
  const [platform, setPlatform] = useState<AnkiPlatform | null>(null);
  useEffect(() => {
    setPlatform(detectAnkiPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
  }, []);
  return platform;
}
