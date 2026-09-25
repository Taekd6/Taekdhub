"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * BARRE DE PROGRESSION — un trait arrondi de 6 px.
 *
 * Elle POUSSE depuis zéro au montage (`.grow-x`, 0,9 s, une seule fois) :
 * c'est ce qui fait lire la valeur comme une quantité accumulée plutôt que
 * comme un décor. Sur une page qui en aligne beaucoup, `index` les décale
 * d'un cran chacune (55 ms) pour que la liste se remplisse en cascade et non
 * d'un bloc. Au CHANGEMENT de valeur, c'est la largeur qui glisse.
 */
export function Meter({
  value,
  className,
  barClassName,
  tone = "accent",
  color,
  index,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  /** Couleur CSS explicite de la barre (ex. `subjectMeta[s].fill`) — prime sur `tone`. */
  color?: string;
  /** Rang dans la cascade d'entrée. */
  index?: number;
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const tones = {
    // Le dégradé de marque (refonte « Revolut clair ») : une jauge « vivante ».
    accent: "grad-brand",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    neutral: "bg-hairline/[0.14]",
  } as const;

  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-hairline/[0.07]", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("grow-x h-full rounded-full transition-[width] duration-700 ease-out", !color && tones[tone], barClassName)}
        style={{ width: `${clamped}%`, ...(color ? { backgroundColor: color } : null), ...(index !== undefined ? ({ "--i": index } as CSSProperties) : null) }}
      />
    </div>
  );
}

/** Compat : ancien nom du même composant. */
export const ProgressBar = Meter;

/**
 * ANNEAU — réservé à UNE valeur par écran. Il se TRACE au montage
 * (`.ring-draw`) : l'arc part de zéro et se pose sur sa valeur.
 */
export function Ring({
  value,
  size = 76,
  strokeWidth = 6,
  variant = "grad",
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  /**
   * `grad`  : l'arc en dégradé de palette (g1 → g2), sur fond clair ;
   * `white` : l'arc blanc sur piste translucide, POSÉ SUR UNE CARTE EN
   *           DÉGRADÉ (galerie des matières, héros d'une matière).
   */
  variant?: "grad" | "white";
  children?: React.ReactNode;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const white = variant === "white";
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {!white && (
          <defs>
            <linearGradient id={`ring-${uid}`} x1="0" x2="1" y1="1" y2="0">
              <stop offset="0" stopColor="var(--g2)" />
              <stop offset="1" stopColor="var(--g1)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={white ? "rgb(255 255 255 / 0.25)" : "rgb(var(--hairline-rgb) / 0.07)"} strokeWidth={strokeWidth} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={white ? "#fff" : `url(#ring-${uid})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (clamped / 100) * circumference}
            strokeLinecap="round"
            className="ring-draw transition-[stroke-dashoffset] duration-700 ease-out"
            style={{ "--ring-len": circumference } as CSSProperties}
          />
        )}
      </svg>
      <div className="absolute grid place-items-center text-center">
        {children ?? <span className="t-figure text-lg">{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
}

/** Compat : ancien nom. */
export const CircularProgress = Ring;
