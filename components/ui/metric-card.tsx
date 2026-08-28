"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Refonte design : n'est plus une carte bordée avec une icône dans un badge
 * (icône décorative — elle ne portait aucune information que le libellé ne
 * donnait déjà). Un grand chiffre et son contexte suffisent, dans le même
 * langage que `DeltaFigure` (progress-overview.tsx) et `Stat` (dashboard) —
 * une seule façon de présenter "un chiffre qui compte" dans toute l'app.
 */
export function MetricCard({
  label,
  value,
  detail,
  className,
  delay = 0,
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={cn("min-w-0", className)}
    >
      <p className="t-meta">{label}</p>
      <p className="mt-1.5 t-figure">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </motion.div>
  );
}
