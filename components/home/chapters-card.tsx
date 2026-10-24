"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import type { ChapterNotes } from "@/lib/chapter-notes";
import { recentChapters } from "@/lib/chapters-overview";
import type { ErrorEntry } from "@/lib/storage";

/**
 * « MES CHAPITRES » SUR L'ACCUEIL — ce que TaekdHub garde de tes chapitres :
 * les derniers touchés (cours, méthodes, erreurs), un tap ouvre la page du
 * chapitre. TaekdHub est un outil d'organisation : il ne propose rien, il
 * range et montre (les exercices se proposent dans la conversation avec
 * Claude).
 */
export function ChaptersCard({ notes, errors, className }: { notes: ChapterNotes[]; errors: ErrorEntry[]; className?: string }) {
  const recent = useMemo(() => recentChapters(notes, errors, 6), [notes, errors]);
  return (
    <Section
      variant="panel"
      title="Mes chapitres"
      className={className}
      action={
        <Link href="/chapitres" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Tous les chapitres
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="t-body text-muted">Rien de rangé pour l&apos;instant. Envoie un cours, des méthodes ou tes erreurs à Claude dans la conversation : il les range ici, chapitre par chapitre.</p>
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((row) => (
            <li key={row.chapter.id}>
              <Link href={`/chapitre/${row.chapter.id}`} className="row-hover flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-3 sm:px-3">
                <span className="min-w-0 flex-1">
                  <span className="t-body block font-semibold">{row.chapter.title}</span>
                  <span className="t-meta">{row.chapter.subject}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Pill on={row.hasCourse} label="Cours" icon />
                  <Pill on={row.methodes > 0} label={`Méthodes ${row.methodes}`} />
                  <Pill on={row.erreurs > 0} label={`Erreurs ${row.erreurs}`} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Pill({ on, label, icon = false }: { on: boolean; label: string; icon?: boolean }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-2xs font-semibold", on ? "bg-emerald-400/[0.16] text-emerald-300" : "bg-inset text-subtle")}>
      {icon && on && <Check size={12} aria-hidden />}
      {label}
    </span>
  );
}
