"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Group, Row } from "@/components/ui/grouped";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeDataHealth, type HealthStatus } from "@/lib/data-health";
import { cn } from "@/lib/cn";

const DOT: Record<HealthStatus, string> = {
  ok: "bg-emerald-400",
  ancien: "bg-amber-400",
  vide: "bg-zinc-500",
};

const STATE_LABEL: Record<HealthStatus, string> = { ok: "À jour", ancien: "Ancien", vide: "Vide" };

/** Où aller pour remédier, par ligne. */
const ACTION: Record<string, { href: string; label: string }> = {
  seances: { href: "/timer", label: "Chrono" },
  exercices: { href: "/entrainement", label: "Exercices" },
  anki: { href: "/anki", label: "Anki" },
};

/**
 * MES DONNÉES — ce que TaekdHub a reçu, et depuis quand (lib/data-health.ts).
 * L'évaluation ne vaut que ce qu'on lui donne : trois lignes, un fait et un
 * geste chacune. Aucun score.
 */
export function DataHealth() {
  const { sessions, attempts, ankiSnapshots, ready } = usePrepahubData();
  const lines = useMemo(() => computeDataHealth({ sessions, attempts, ankiSnapshots, now: new Date() }), [sessions, attempts, ankiSnapshots]);

  if (!ready) {
    return (
      <Group id="donnees" title="Mes données">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </Group>
    );
  }

  return (
    <Group id="donnees" title="Mes données" footer="TaekdHub ne peut évaluer que ce qu'il reçoit : une ligne ancienne ou vide veut dire que ses conseils reposent sur peu de choses.">
      {lines.map((line) => {
        const action = ACTION[line.id];
        return (
          <Row
            key={line.id}
            stack
            label={
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", DOT[line.status])} />
                {line.label}
                <span className="t-meta">· {STATE_LABEL[line.status]}</span>
              </span>
            }
            hint={
              <>
                {line.detail}
                {line.hint ? ` ${line.hint}` : ""}{" "}
                {line.status !== "ok" && action && (
                  <Link href={action.href} className="font-semibold text-accent underline-offset-2 hover:underline">
                    {action.label}
                  </Link>
                )}
              </>
            }
          />
        );
      })}
    </Group>
  );
}
