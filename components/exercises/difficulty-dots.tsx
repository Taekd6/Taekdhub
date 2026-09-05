import { cn } from "@/lib/cn";
import type { Difficulty } from "@/lib/supabase/types";

/**
 * Difficulté — cinq traits, pas cinq gélules colorées.
 *
 * Le repère doit se lire au bord d'une ligne de liste sans jamais attirer
 * l'œil avant le titre : c'est une mesure, pas une alerte.
 */
export function DifficultyDots({ value }: { value: Difficulty }) {
  return (
    <span aria-label={`Difficulté ${value} sur 5`} className="inline-flex gap-[3px]">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn("h-[3px] w-3 rounded-full", index < value ? "bg-accent" : "bg-hairline/[0.14]")}
        />
      ))}
    </span>
  );
}
