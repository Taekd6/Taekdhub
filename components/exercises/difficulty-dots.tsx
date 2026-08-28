import { cn } from "@/lib/cn";
import type { Difficulty } from "@/lib/supabase/types";

export function DifficultyDots({ value }: { value: Difficulty }) {
  return (
    <span aria-label={`Difficulté ${value} sur 5`} className="inline-flex gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={cn("h-1.5 w-4 rounded-full", index < value ? "bg-accent" : "bg-hairline/[0.08]")} />
      ))}
    </span>
  );
}
