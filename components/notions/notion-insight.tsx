"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ScanLine } from "lucide-react";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { cn } from "@/lib/cn";
import { computeNotionEvidence, computeNotionOverview, findRootCauseNotions, resolveNotionChapters } from "@/lib/notions";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * LE POINT DE BASCULE, sur le Dashboard.
 *
 * Placé JUSTE AU-DESSUS de « Ces chapitres méritent ton attention », et c'est
 * tout l'intérêt : la liste de chapitres reste vraie, mais elle n'est plus la
 * dernière réponse. Quand plusieurs échecs récents partagent une même notion,
 * ce bloc dit ce que la liste de chapitres ne peut pas dire — que le problème
 * n'est pas réparti sur trois chapitres, il est concentré sur une notion.
 *
 * Deux formes selon ce qui est réellement établi, jamais une troisième
 * inventée :
 * - une cause racine existe → le constat, nommé, avec sa preuve ;
 * - rien de transversal → une simple porte d'entrée vers la carte, sans
 *   prétendre à un diagnostic qui n'existe pas.
 *
 * Ne calcule rien de nouveau : `lib/notions.ts` compte, ce composant affiche.
 */
export function NotionInsight({
  exercises,
  sessions,
  chapters,
  className,
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  chapters: Chapter[];
  className?: string;
}) {
  const model = useMemo(() => {
    const evidence = computeNotionEvidence(exercises, sessions);
    return { overview: computeNotionOverview(evidence), rootCauses: findRootCauseNotions(exercises, sessions) };
  }, [exercises, sessions]);

  if (model.overview.total === 0) return null;

  const cause = model.rootCauses[0];
  const causeChapters = cause ? resolveNotionChapters(cause, chapters) : [];

  // ── Rien de transversal : une porte, pas un verdict ──────────────────────
  if (!cause) {
    return (
      <Link
        href="/notions"
        className={cn(
          "focus-ring group flex items-center gap-3 rounded-xl border border-hairline/[0.09] px-4 py-3.5 transition-colors hover:bg-inset",
          className
        )}
      >
        <ScanLine size={17} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Radiographie de tes notions</p>
          <p className="t-meta mt-0.5 truncate">
            {model.overview.total} notions sous tes {model.overview.crossChapter} liens entre chapitres
            {model.overview.tested > 0 ? ` · ${model.overview.tested} déjà testée${model.overview.tested > 1 ? "s" : ""}` : " · aucune encore testée"}
          </p>
        </div>
        <ArrowRight size={15} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  // ── Une cause racine : le constat que le grain chapitre ne peut pas faire ─
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn("overflow-hidden rounded-xl border border-accent/25 bg-accent/[0.05]", className)}
    >
      <Link href="/notions" className="focus-ring group block px-5 py-5 transition-colors hover:bg-accent/[0.04]">
        <div className="flex items-center gap-2">
          <ScanLine size={15} className="shrink-0 text-accent" />
          <p className="eyebrow text-accent">Radiographie</p>
        </div>

        <p className="mt-2.5 text-[1.0625rem] font-semibold leading-snug tracking-tight sm:text-lg">
          {cause.recentlyFailedExercises.length} exercices ratés
          {causeChapters.length > 1 ? ` dans ${causeChapters.length} chapitres différents` : ""}, une seule notion en commun :{" "}
          <span className="text-accent">{cause.notion}</span>.
        </p>

        <ul className="mt-3.5 space-y-1">
          {cause.recentlyFailedExercises.slice(0, 3).map((exercise) => (
            <li key={exercise.id} className="flex items-center gap-2">
              <SubjectAvatar subject={exercise.subject} size="sm" />
              <span className="min-w-0 truncate text-[0.8125rem] text-muted">{exercise.title}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent">
          Voir la radiographie
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </p>
      </Link>
    </motion.div>
  );
}
