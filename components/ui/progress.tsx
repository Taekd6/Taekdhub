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
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/[0.07]", className)}>
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

export function CircularProgress({ value, size = 80, strokeWidth = 7 }: { value: number; size?: number; strokeWidth?: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(212,243,107,0.8)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-semibold">{clamped}%</span>
    </div>
  );
}
