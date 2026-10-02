"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * « Copier la demande pour Claude » — la demande d'exercice de
 * lib/exercise-quality.ts (sous-thème, niveau, prérequis, objectif,
 * correction gardée pour après l'essai). Le texte reste lisible en dessous
 * si le presse-papiers est refusé.
 */
export function CopyRequest({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <div className={className}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const write = navigator.clipboard?.writeText(text);
          if (!write) return setCopied(false);
          void write.then(
            () => setCopied(true),
            () => setCopied(false)
          );
        }}
      >
        {copied ? <Check size={14} aria-hidden /> : <Clipboard size={14} aria-hidden />} {copied ? "Demande copiée" : "Copier la demande pour Claude"}
      </Button>
      {copied === false && <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-inset p-3 text-2xs text-ink">{text}</pre>}
    </div>
  );
}
