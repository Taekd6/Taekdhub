"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAnnales } from "@/hooks/use-annales";
import { countResults, summarizeByChapter } from "@/lib/annales";
import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

const DOT: Record<string, string> = { réussi: "bg-emerald-400", partiel: "bg-amber-400", échec: "bg-rose-400" };

/**
 * Les annales d'UNE matière, dans l'onglet « Erreurs » de son hub : les
 * chapitres les plus fragiles et la sortie vers /annales. Rien du tout tant
 * qu'il n'y a aucune annale dans la matière (ou pas de compte connecté) :
 * l'onglet ne s'encombre pas d'un état vide de plus.
 */
export function SubjectAnnales({ subject }: { subject: Subject }) {
  const { logs } = useAnnales();
  const own = useMemo(() => logs.filter((log) => log.subject === subject), [logs, subject]);
  const chapters = useMemo(() => summarizeByChapter(own).slice(0, 4), [own]);
  if (own.length === 0) return null;
  const totals = countResults(own);

  return (
    <Section
      variant="panel"
      title="Annales"
      description={`${totals.count} exercice${totals.count > 1 ? "s" : ""} de concours · ${Math.round((totals.successRate ?? 0) * 100)} % de réussite`}
      action={
        <Link href="/annales" className={buttonVariants({ variant: "link", size: "sm" })}>
          Mes annales <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      <ul className="divide-y divide-line">
        {chapters.map((chapter) => (
          <li key={chapter.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{chapter.chapter}</p>
            <span className="flex items-center gap-1" aria-label={`Essais : ${chapter.history.join(", ")}`}>
              {chapter.history.slice(-6).map((result, index) => (
                <span key={index} className={cn("h-2 w-2 rounded-full", DOT[result])} />
              ))}
            </span>
            <span className="w-11 text-right text-sm font-semibold tabular-nums text-ink">{Math.round((chapter.successRate ?? 0) * 100)} %</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
