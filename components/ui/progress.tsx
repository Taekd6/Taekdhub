"use client";

import { cn } from "@/lib/cn";

/**
 * BARRE DE PROGRESSION — un trait, pas un tube.
 *
 * 4 px de haut et des coins à peine adoucis : c'est une mesure posée sous une
 * ligne de texte, pas un objet en soi. L'animation d'entrée (une barre qui
 * pousse depuis zéro à chaque montage) a été retirée : sur la page
 * Progression, trente barres qui se remplissent ensemble transforment un
 * bilan en animation. Elle ne s'anime plus qu'au CHANGEMENT de valeur, ce qui
 * est la seule chose qu'on ait besoin de voir.
 */
export function Meter({
  value,
  className,
  barClassName,
  tone = "accent",
}: {
  value: number;
  className?: string;
  barClassName?: string;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const tones = {
    accent: "bg-accent",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    neutral: "bg-hairline/25",
  } as const;

  return (
    <div
      className={cn("h-1 overflow-hidden rounded-full bg-hairline/[0.10]", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tones[tone], barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Compat : ancien nom du même composant. */
export const ProgressBar = Meter;

/**
 * ANNEAU — réservé à UNE valeur par écran (l'objectif du jour). Un anneau
 * n'est pas plus lisible qu'une barre ; il est simplement plus visible, ce
 * qui n'a d'intérêt que pour la mesure qu'on veut voir en premier.
 */
export function Ring({
  value,
  size = 76,
  strokeWidth = 5,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--hairline-rgb) / 0.10)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--accent-ink-rgb))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
        {children ?? <span className="t-figure text-lg">{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
}

/** Compat : ancien nom. */
export const CircularProgress = Ring;
