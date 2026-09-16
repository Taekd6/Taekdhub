"use client";

import { CalendarClock } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageBar, Split } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { EmptyState, Notice, Skeleton } from "@/components/ui/state";
import { DayPlan } from "@/components/work/day-plan";
import { WorkItemForm } from "@/components/work/work-item-form";
import { WorkItemRow } from "@/components/work/work-item-row";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildWeeklyPlan, postponeWorkItem } from "@/lib/planning";
import { abandonWorkItem, completeWorkItem } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import type { WorkItem } from "@/lib/storage";

/**
 * ÉCHÉANCES — l'écran où l'on répond à « pour quand ».
 *
 * Composition `Split`, comme l'accueil et le journal : la DÉCISION à gauche
 * (ce qu'il y a à faire, dans l'ordre), l'ÉTAT à droite (la semaine et sa
 * charge). Aucune nouvelle grille, aucun nouveau composant de mise en page.
 *
 * L'écran n'invente aucun calcul : il assemble `buildWeeklyPlan`,
 * `computeWorkItemPriority` et `postponeWorkItem`. Tout ce qu'il affiche est
 * recalculé à chaque rendu depuis les travaux, les séances et la capacité —
 * le planning n'est jamais stocké, donc jamais périmé.
 */
export function DeadlinesOverview() {
  const { workItems, sessions, preferences, saveWorkItems, ready } = usePrepahubData();
  const [notice, setNotice] = useState<{ tone: "info" | "warning"; text: string } | null>(null);

  const plan = useMemo(
    () => buildWeeklyPlan(workItems, sessions, preferences, new Date()),
    [workItems, sessions, preferences]
  );

  const create = useCallback(
    (item: WorkItem) => {
      saveWorkItems([item, ...workItems]);
      setNotice(null);
    },
    [saveWorkItems, workItems]
  );

  const complete = useCallback(
    (id: string) => {
      saveWorkItems(completeWorkItem(workItems, id));
      setNotice(null);
    },
    [saveWorkItems, workItems]
  );

  const abandon = useCallback(
    (id: string) => {
      saveWorkItems(abandonWorkItem(workItems, id));
      setNotice(null);
    },
    [saveWorkItems, workItems]
  );

  /*
   * REPORTER — au prochain jour réellement disponible, et le coût du choix
   * est dit tout de suite.
   *
   * `postponeWorkItem` recalcule le planning complet pour savoir si ce report
   * rend le travail infaisable. Quand c'est le cas, le report a QUAND MÊME
   * lieu (c'est la décision de l'élève) mais l'avertissement s'affiche, avec
   * ses chiffres. L'échéance, elle, n'est jamais modifiée.
   */
  const postpone = useCallback(
    (id: string) => {
      const outcome = postponeWorkItem(workItems, sessions, preferences, id, "prochain-jour-disponible");
      saveWorkItems(outcome.workItems);
      setNotice(
        outcome.breaksDeadline && outcome.warning
          ? { tone: "warning", text: `Reporté au ${formatDay(outcome.toDate)}. ${outcome.warning}` }
          : { tone: "info", text: `Reporté au ${formatDay(outcome.toDate)}.` }
      );
    },
    [saveWorkItems, workItems, sessions, preferences]
  );

  if (!ready) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const open = plan.priorities;
  const totalRemaining = open.reduce((sum, entry) => sum + entry.remainingMinutes, 0);

  return (
    <Split
      railLabel="Ta semaine"
      rail={
        <div className="space-y-8">
          <div>
            <p className="t-label mb-2">Les 7 prochains jours</p>
            <div className="divide-y divide-line border-y border-line">
              {plan.days.slice(0, 7).map((day, index) => (
                <DayPlan key={day.date} day={day} label={dayLabel(day.date, index)} dense />
              ))}
            </div>
          </div>

          <dl className="divide-y divide-line border-y border-line">
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="t-label">Reste à faire</dt>
              <dd className="t-figure-sm tabular shrink-0">{formatSpan(totalRemaining * 60)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="t-label">Échéances ouvertes</dt>
              <dd className="t-figure-sm tabular shrink-0">{open.length}</dd>
            </div>
          </dl>
        </div>
      }
    >
      <div className="space-y-9">
        <PageBar
          title="Échéances"
          lede="Ce que tu as à rendre, ce que ça représente encore, et quand le travailler."
        />

        <Section
          variant="panel"
          label="Ajouter"
          title="Qu'est-ce que tu as à faire ?"
          description="Le titre suffit — TaekdHub s'occupe de caser le reste dans tes journées."
        >
          <WorkItemForm workItems={workItems} sessions={sessions} onCreate={create} />
        </Section>

        {notice && (
          <Notice tone={notice.tone} action={<Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Fermer</Button>}>
            {notice.text}
          </Notice>
        )}

        {/* CE QUI NE TIENT PAS, EN TÊTE — jamais masqué, jamais glissé après
            l'échéance en douce. Chaque ligne cite le temps qui manque. */}
        {plan.unplaceable.length > 0 && (
          <Section
            label="À arbitrer"
            title="Ce qui ne rentre pas dans tes journées"
            description="Ton échéance n'a pas été déplacée — c'est à toi de décider quoi faire. Réduire une autre tâche, libérer du temps, ou accepter de rendre moins."
          >
            <ul className="divide-y divide-line border-y border-line">
              {plan.unplaceable.map(({ item, reason }) => (
                <li key={item.id} className="py-3">
                  <p className="t-subhead truncate">{item.title}</p>
                  <p className="t-meta mt-0.5">{reason}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section label="Ouvertes" title={open.length > 0 ? `${open.length} échéance${open.length > 1 ? "s" : ""}` : "Aucune échéance"}>
          {open.length > 0 ? (
            <ul className="divide-y divide-line border-y border-line">
              {open.map((priority) => (
                <WorkItemRow
                  key={priority.item.id}
                  priority={priority}
                  sessions={sessions}
                  onComplete={complete}
                  onAbandon={abandon}
                  onPostpone={postpone}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Rien à rendre pour l'instant."
              description="Note un DM, un DS ou une révision ci-dessus : TaekdHub le répartira sur tes journées et te dira s'il tient."
            />
          )}
        </Section>
      </div>
    </Split>
  );
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
/* `month: "short"` produit « 16 sept. » — avec son point. Suivi du point de la
   phrase, cela donnait « Reporté au mercredi 16 sept.. ». Le mois long n'a pas
   ce défaut et tient largement dans une phrase. */
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** « Aujourd'hui », « Demain », puis le jour de la semaine — ce qu'on lit le plus vite. */
function dayLabel(date: string, index: number): string {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return "Demain";
  const parsed = new Date(`${date}T00:00:00`);
  return `${WEEKDAYS[parsed.getDay()]} ${shortDate.format(parsed)}`;
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return `${WEEKDAYS[parsed.getDay()]} ${longDate.format(parsed)}`;
}
