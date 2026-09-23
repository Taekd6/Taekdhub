"use client";

import type { CSSProperties } from "react";
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
    accent: "bg-accent",
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--hairline-rgb) / 0.07)" strokeWidth={strokeWidth} />
        {clamped > 0 && (
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

export interface RingArc {
  /** Identifiant stable (la matière). */
  id: string;
  /** Début et longueur, en fraction du tour (0–1) — voir lib/day-stack.ts#ringSegments. */
  start: number;
  length: number;
  /** Couleur CSS du segment. */
  color: string;
}

/**
 * ANNEAU SEGMENTÉ — la même mesure qu'un `Ring`, mais découpée : chaque
 * segment est une part colorée du tour (une matière, pour l'objectif du
 * jour). Chaque segment POUSSE depuis son point de départ (`.ring-grow` :
 * c'est le motif de tirets qui s'anime, pas le décalage — un décalage ferait
 * GLISSER le segment au lieu de l'allonger), l'un après l'autre.
 *
 * Aucun texte dans le SVG : le centre (`children`) et la légende de
 * l'appelant disent la valeur, le dessin ne fait que la montrer.
 */
export function SegmentRing({
  arcs,
  size = 180,
  strokeWidth = 14,
  label,
  children,
}: {
  arcs: RingArc[];
  size?: number;
  strokeWidth?: number;
  /** Résumé en toutes lettres pour les lecteurs d'écran. */
  label: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div role="img" aria-label={label} className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--hairline-rgb) / 0.07)" strokeWidth={strokeWidth} />
        {arcs.map((arc, index) => {
          const length = Math.max(0.0001, arc.length) * circumference;
          return (
            <circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              /* Le tracé visible fait `length` ; le reste du tour est vide.
                 Le décalage négatif place le début du segment à `start`. */
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-arc.start * circumference}
              className="ring-grow"
              style={{ "--ring-from": `0 ${circumference}`, "--i": index } as CSSProperties}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
