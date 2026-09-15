"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { computeWorkTimeSeries, RHYTHM_WEEKS } from "@/lib/analytics/work-time";
import { computeTrend } from "@/lib/analytics/trend";
import { computeGradeTrend, formatAverage } from "@/lib/grades";
import { formatSpan } from "@/lib/utils";
import type { Grade } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * TRAVAIL ET RÉSULTATS — deux courbes côte à côte, et surtout AUCUN lien de
 * cause à effet.
 *
 * C'est la section la plus dangereuse de la page, et la plus brève. La
 * tentation est évidente : le volume monte, les notes montent, donc l'un
 * explique l'autre. TaekdHub ne peut pas le savoir. Un chapitre plus facile,
 * un barème plus doux, un sujet tombé juste, une méthode enfin comprise —
 * rien de tout cela n'est mesuré ici, et tout peut expliquer la note.
 *
 * Le composant se contente donc de la CONCOMITANCE : « les deux ont progressé
 * sur la même période ». Pas de « donc », pas de « grâce à », pas de
 * coefficient de corrélation — un r calculé sur quatre points n'aurait
 * aucune valeur et donnerait à la phrase une autorité scientifique
 * imméritée.
 *
 * Et il ne s'affiche PAS tant que les deux séries n'ont pas de quoi parler :
 * mieux vaut une section absente qu'un rapprochement bâti sur deux notes.
 */
export function WorkAndResults({ sessions, grades }: { sessions: WorkSession[]; grades: Grade[] }) {
  const model = useMemo(() => {
    const now = new Date();
    const weeks = computeWorkTimeSeries(sessions, "semaine", RHYTHM_WEEKS, now).slice(0, -1);
    return {
      work: computeTrend(weeks.map((point) => point.minutes)),
      workFirst: weeks[0]?.minutes ?? 0,
      workLast: weeks[weeks.length - 1]?.minutes ?? 0,
      grades: computeGradeTrend(grades),
    };
  }, [sessions, grades]);

  const { work, grades: gradeTrend } = model;
  // Les DEUX doivent être exploitables. Une seule suffisante ne permet aucun
  // rapprochement, et une section à moitié vide inviterait à en imaginer un.
  if (work.direction === "insuffisant" || gradeTrend.trend.direction === "insuffisant") return null;

  const sameDirection = work.direction === gradeTrend.trend.direction && work.direction !== "stable";

  return (
    <Section label="Travail et résultats" title="Ce qui évolue en même temps">
      <p className="t-body">
        Sur les semaines mesurées, ton volume de travail est {DIRECTION[work.direction]} ({formatSpan(model.workFirst * 60)} →{" "}
        {formatSpan(model.workLast * 60)}) et tes notes sont {DIRECTION[gradeTrend.trend.direction]} ({formatAverage(gradeTrend.trend.first ?? 0)} → {formatAverage(gradeTrend.trend.last ?? 0)} sur 20).
      </p>
      <p className="t-meta mt-2">
        {sameDirection
          ? "Les deux évoluent dans le même sens sur cette période. TaekdHub ne mesure pas ce qui cause quoi : la difficulté des chapitres, les barèmes et les sujets tombés y comptent autant que le temps passé."
          : "Les deux n'évoluent pas dans le même sens sur cette période. C'est un constat, pas un diagnostic : TaekdHub ne mesure ni la difficulté des épreuves ni ce qui a été travaillé juste avant."}
      </p>
    </Section>
  );
}

const DIRECTION: Record<"hausse" | "baisse" | "stable", string> = {
  hausse: "en hausse",
  baisse: "en baisse",
  stable: "stable",
};
