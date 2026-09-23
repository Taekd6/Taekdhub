"use client";

import { useCountUp } from "@/hooks/use-count-up";
import { useReveal } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";

/**
 * NOMBRE QUI MONTE QUAND ON LE VOIT — `useCountUp` retenu par `useReveal`.
 *
 * Le compteur reste à 0 tant que le chiffre n'est pas entré dans l'écran,
 * puis monte en 1,2 s sur la courbe d'apple.com. `format` met en forme
 * l'entier courant (« 3 h 20 », « 72 % »…) ; la valeur FINALE est toujours
 * lue par les lecteurs d'écran (`aria-label`), jamais les étapes.
 */
export function CountUp({
  value,
  format = (current) => String(current),
  duration,
  className,
}: {
  value: number;
  format?: (current: number) => React.ReactNode;
  duration?: number;
  className?: string;
}) {
  const [ref, revealed] = useReveal<HTMLSpanElement>();
  const current = useCountUp(value, duration, revealed);
  const final = format(Number.isFinite(value) ? Math.round(value) : 0);

  return (
    <span ref={ref} className={cn("tabular", className)} aria-label={typeof final === "string" ? final : undefined}>
      <span aria-hidden={typeof final === "string" ? true : undefined}>{format(current)}</span>
    </span>
  );
}
