"use client";

import { useMemo } from "react";
import type { AnnaleLog } from "@/lib/annales";
import type { ExerciseAttempt } from "@/lib/attempts";
import { recurringDifficulties } from "@/lib/pedagogy";
import type { ChapterMemory, ErrorEntry, Grade, WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/** Au-delà, la carte deviendrait le rapport complet (donné aux IA par le connecteur). */
const SHOWN = 3;

/**
 * CE QUI REVIENT D'UNE ÉVALUATION À L'AUTRE — le même calcul que celui transmis aux IA
 * (lib/pedagogy.ts#recurringDifficulties) : seules les difficultés vues dans AU MOINS
 * deux évaluations ou exercices distincts, sans réussite sans aide depuis. Une seule
 * observation n'est pas affichée ici (c'est un signal, pas une conclusion).
 */
export function RecurringDifficulties({
  grades,
  attempts,
  errors,
  workItems,
  chapterMemory,
  annales,
  retryDelaysDays,
}: {
  grades: Grade[];
  attempts: ExerciseAttempt[];
  errors: ErrorEntry[];
  workItems: WorkItem[];
  chapterMemory: ChapterMemory[];
  annales: AnnaleLog[];
  retryDelaysDays: number[];
}) {
  const report = useMemo(
    () => recurringDifficulties({ grades, attempts, errors, workItems, chapterMemory, annales, retryDelaysDays, today: dayKey(new Date()) }),
    [grades, attempts, errors, workItems, chapterMemory, annales, retryDelaysDays]
  );
  const recurring = report.recommandations.filter((entry) => entry.niveau === "récurrente");
  const signals = report.recommandations.length - recurring.length;

  return (
    <section aria-labelledby="revient-titre">
      <h2 id="revient-titre" className="t-subhead">
        D&apos;une évaluation à l&apos;autre
      </h2>
      {recurring.length === 0 ? (
        <p className="t-meta mt-1 text-[0.8125rem]">
          Aucune difficulté vue dans deux évaluations distinctes{signals > 0 ? ` (${signals} signal${signals > 1 ? "s" : ""} isolé${signals > 1 ? "s" : ""}, à confirmer)` : ""}. Ce calcul ne
          lit que les débriefs et exercices rattachés à un chapitre du programme.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {recurring.slice(0, SHOWN).map((entry) => (
            <li key={entry.chapitre.id} className="text-[0.875rem]">
              <p className="font-extrabold text-ink">{entry.chapitre.titre}</p>
              <p className="t-meta text-[0.8125rem]">
                {entry.matiere} · {entry.evenements_distincts} évaluations ou exercices · cause : {entry.cause_dominante ?? "non établie"}
              </p>
              <p className="mt-0.5 text-[0.8125rem] text-ink">{entry.action}</p>
            </li>
          ))}
        </ul>
      )}
      {report.corrigees.length > 0 && (
        <p className="t-meta mt-3 text-[0.8125rem]">
          Réglées depuis (réussite sans aide) : {report.corrigees.map((entry) => entry.chapitre).join(", ")}.
        </p>
      )}
      {report.observations_sans_chapitre > 0 && (
        <p className="t-meta mt-1 text-[0.8125rem]">
          {report.observations_sans_chapitre} question{report.observations_sans_chapitre > 1 ? "s" : ""} ratée{report.observations_sans_chapitre > 1 ? "s" : ""} sans chapitre : hors de ce calcul.
        </p>
      )}
    </section>
  );
}
