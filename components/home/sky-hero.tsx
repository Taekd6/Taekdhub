"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * LE CIEL DE L'ACCUEIL (mission 22, demande de l'élève : « pas premium, pas
 * d'animation, pas d'image ») — une bannière qui VIT avec l'heure, façon
 * Météo d'Apple : aube, jour, crépuscule ou nuit étoilée, en dégradés animés
 * (CSS pur, aucune image à charger : rien qui ralentisse l'iPad ni ne casse
 * hors ligne). Grain fin, soleil ou lune qui flotte, étoiles qui scintillent.
 * Tout s'arrête sous `prefers-reduced-motion`.
 */

type Phase = "aube" | "jour" | "crepuscule" | "nuit";

function phaseOf(hour: number): Phase {
  if (hour >= 6 && hour < 9) return "aube";
  if (hour >= 9 && hour < 17) return "jour";
  if (hour >= 17 && hour < 20) return "crepuscule";
  return "nuit";
}

const GREETING: Record<Phase, string> = { aube: "Bonjour", jour: "Bonjour", crepuscule: "Bonsoir", nuit: "Bonsoir" };
const LINE: Record<Phase, string> = {
  aube: "La journée commence. Une chose à la fois.",
  jour: "Concentre-toi sur la prochaine case à cocher.",
  crepuscule: "Ta soirée est prête.",
  nuit: "Termine proprement, puis va dormir.",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const clockFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Étoiles placées une fois pour toutes (pseudo-aléatoire stable : aucune différence serveur/client). */
const STARS = Array.from({ length: 38 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: r(1) * 100, top: r(2) * 70, size: 1 + r(3) * 2, delay: r(4) * 6 };
});

export function SkyHero({ name, examLabel, done, total, className }: { name?: string; examLabel?: string | null; done: number; total: number; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const phase = phaseOf((now ?? new Date(2000, 0, 1, 20)).getHours());
  const night = phase === "nuit" || phase === "crepuscule";
  const stars = useMemo(() => STARS, []);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section aria-label="Aujourd'hui" className={cn("sky reveal relative isolate overflow-hidden rounded-[var(--radius-tile)] text-white", `sky-${phase}`, className)}>
      <div aria-hidden className="sky-layer sky-a" />
      <div aria-hidden className="sky-layer sky-b" />
      <div aria-hidden className="sky-layer sky-c" />
      {night && (
        <div aria-hidden className="absolute inset-0">
          {stars.map((star, index) => (
            <span key={index} className="sky-star" style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s` } as CSSProperties} />
          ))}
        </div>
      )}
      {phase === "nuit" && <span aria-hidden className="sky-shooting" />}
      {!night && (
        <>
          <span aria-hidden className="sky-cloud" style={{ top: "22%", width: 160, height: 34 }} />
          <span aria-hidden className="sky-cloud" style={{ top: "48%", width: 220, height: 40, animationDuration: "55s", animationDelay: "-20s" }} />
        </>
      )}
      <div aria-hidden className={cn("sky-orb", night ? "sky-moon" : "sky-sun")} />
      <div aria-hidden className="sky-hills" />
      <div aria-hidden className="sky-grain" />

      <div className="relative flex min-h-[13rem] flex-col justify-between gap-6 p-6 sm:min-h-[15rem] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-white/75 first-letter:uppercase" suppressHydrationWarning>
            {now ? dateFmt.format(now) : " "}
          </p>
          <p className="tabular text-[0.9375rem] font-bold text-white/85" suppressHydrationWarning>
            {now ? clockFmt.format(now) : " "}
          </p>
        </div>
        <div>
          <h1 className="t-display font-serif !font-semibold leading-none">
            {GREETING[phase]}
            {name ? <span className="text-white/80">, {name}</span> : null}
          </h1>
          <p className="mt-2 max-w-[34ch] t-body font-semibold text-white/85">{LINE[phase]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {total > 0 && (
            <span className="sky-chip">
              <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/25">
                <span className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </span>
              {done}/{total} ce soir
            </span>
          )}
          {examLabel && <span className="sky-chip">{examLabel}</span>}
        </div>
      </div>
    </section>
  );
}
