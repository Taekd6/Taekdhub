"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  barClassName,
  animated = true,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  animated?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-hairline/[0.08]", className)}>
      {animated ? (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full bg-accent", barClassName)}
        />
      ) : (
        <div className={cn("h-full rounded-full bg-accent transition-all", barClassName)} style={{ width: `${clamped}%` }} />
      )}
    </div>
  );
}

/**
 * Anneau — la signature visuelle de "aujourd'hui" (refonte "vivant") : partout
 * ailleurs, une progression se lit en barre (comparer plusieurs valeurs entre
 * elles, une liste de chapitres, de matières...). Ici, une seule valeur qui
 * compte plus que les autres — l'objectif du jour, sur le Dashboard — porte
 * une forme différente, jamais utilisée pour autre chose. C'est ce qui la
 * rend reconnaissable comme "le" repère du jour plutôt qu'une barre de plus.
 *
 * `center` remplace le pourcentage par défaut quand le chiffre exact importe
 * plus que le ratio (ex. "45/60 min" plutôt que "75%").
 */
export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 7,
  center,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  center?: React.ReactNode;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--hairline-rgb) / 0.08)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--accent-rgb) / 0.85)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums">{center ?? `${clamped}%`}</span>
    </div>
  );
}
