"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAnnales } from "@/hooks/use-annales";
import { useKholleHistory } from "@/hooks/use-kholle-history";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ExerciseAttempt } from "@/lib/attempts";
import { buildDiagnosticContext } from "@/lib/diagnostic-context";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { activeWeeklyFocus, type ChapterMemory, type ErrorEntry, type Preferences, type WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import { adoptFocus, computeWeeklyLearning } from "@/lib/weekly-learning";

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function fr(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

/**
 * BILAN DES COMPÉTENCES DE LA SEMAINE (lib/weekly-learning.ts) — à côté du
 * bilan du temps. Cinq rubriques, chacune adossée à des preuves ; les
 * décisions ne pèsent sur Next Move que si l'élève les adopte.
 */
export function WeeklyLearningSection({
  attempts,
  chapterMemory,
  errors,
  ankiSnapshots,
  workItems,
  preferences,
  savePreferences,
}: {
  attempts: ExerciseAttempt[];
  chapterMemory: ChapterMemory[];
  errors: ErrorEntry[];
  ankiSnapshots: AnkiSnapshot[];
  workItems: WorkItem[];
  preferences: Preferences;
  savePreferences: (preferences: Preferences) => void;
}) {
  const { logs: annales } = useAnnales();
  const kholle = useKholleHistory();
  const today = dayKey(new Date());
  const learning = useMemo(
    () => computeWeeklyLearning(buildDiagnosticContext({ chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle, now: new Date() }), attempts, preferences.retryDelaysDays, today),
    [chapterMemory, attempts, errors, ankiSnapshots, workItems, preferences, annales, kholle, today]
  );
  const focus = activeWeeklyFocus(preferences, today);
  const proposed = adoptFocus(learning, today);
  const alreadyAdopted = focus !== null && proposed !== null && focus.chapterIds.join() === proposed.chapterIds.join();

  return (
    <Section variant="panel" label="Cette semaine" title="Ce que tu sais faire" description={`Du ${fr(learning.from)} au ${fr(learning.to)}. Seules des preuves comptent : un exercice réussi sans aide, jamais le temps passé.`}>
      <div className="space-y-6">
        <div>
          <p className="t-label mb-2">Compétences vérifiées</p>
          {learning.verified.length === 0 ? (
            <p className="t-meta">Aucune cette semaine : un exercice raté puis réussi sans aide, ou un transfert réussi, apparaîtra ici.</p>
          ) : (
            <ul className="space-y-2">
              {learning.verified.map((skill) => (
                <li key={`${skill.label}-${skill.on}`} className="flex items-start gap-2 text-[0.9375rem] text-ink">
                  <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-300" />
                  <span>
                    <span className="font-semibold">{skill.label}</span>
                    <span className="t-meta block text-2xs">
                      {skill.proof}
                      {skill.chapter ? ` · ${skill.chapter}` : ""} · {fr(skill.on)}
                      {skill.minutes ? ` · ${skill.minutes}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="t-label mb-2">Difficultés récurrentes</p>
          {learning.recurring.length === 0 ? (
            <p className="t-meta">Aucune cause d&apos;échec ne revient sur plusieurs exercices d&apos;un même chapitre. Un échec isolé ne suffit pas à conclure.</p>
          ) : (
            <ul className="space-y-2">
              {learning.recurring.map((entry) => (
                <li key={`${entry.chapterId}-${entry.cause}`} className="text-[0.9375rem] text-ink">
                  <span className="font-semibold">{entry.chapter}</span> <span className="t-meta">({entry.subject})</span>
                  <span className="t-meta block text-2xs">{entry.fact}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="t-label mb-2">Progrès</p>
          <ul className="space-y-1">
            {learning.progress.map((line) => (
              <li key={line} className="t-meta">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="t-label mb-2">Chapitres à travailler</p>
          {learning.toWork.length === 0 ? (
            <p className="t-meta">Le diagnostic ne voit rien de récent à travailler en priorité.</p>
          ) : (
            <ul className="space-y-3">
              {learning.toWork.map((entry) => (
                <li key={entry.chapterId} className="text-[0.9375rem] text-ink">
                  <span className="font-semibold">{entry.chapter}</span> · {entry.label}{" "}
                  <Badge variant={entry.level === "établi" ? "warning" : "default"}>{entry.level}</Badge>
                  {entry.fact && <span className="t-meta block text-2xs">Fait : {entry.fact}</span>}
                  <span className="t-meta block text-2xs">Hypothèse : {entry.hypothesis}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="t-label mb-2">Ajustements pour la semaine prochaine</p>
          {learning.decisions.length === 0 ? (
            <p className="t-meta">Rien à changer : continue le plan.</p>
          ) : (
            <ul className="space-y-1.5">
              {learning.decisions.map((decision) => (
                <li key={decision.text} className="text-[0.9375rem] text-ink">
                  {decision.text}
                </li>
              ))}
            </ul>
          )}
          {proposed && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={alreadyAdopted} onClick={() => savePreferences({ ...preferences, weeklyFocus: proposed })}>
                {alreadyAdopted ? "Priorités adoptées" : "Adopter ces priorités pour 7 jours"}
              </Button>
              {focus && (
                <Button size="sm" variant="ghost" onClick={() => savePreferences({ ...preferences, weeklyFocus: null })}>
                  Retirer les priorités
                </Button>
              )}
            </div>
          )}
          {focus && (
            <p className="t-meta mt-2 text-2xs">
              En vigueur jusqu&apos;au {fr(focus.until)} (exclu) : {focus.chapterIds.map((id) => PROGRAMME_BY_ID.get(id)?.title ?? id).join(", ")}. Next Move et le plan du jour font passer ces chapitres devant, tant que le diagnostic y voit encore un problème.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
