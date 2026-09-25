"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Illustration } from "@/components/ui/illustrations";
import { Split } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { Notice, Skeleton } from "@/components/ui/state";
import { DayPlan } from "@/components/work/day-plan";
import { WorkItemForm } from "@/components/work/work-item-form";
import { WorkItemRow } from "@/components/work/work-item-row";
import { setWorkItemPlan } from "@/lib/intentions";
import type { WorkItemPlan } from "@/lib/storage";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import type { WorkItemPriority } from "@/lib/deadlines";
import { buildWeeklyPlan, postponeWorkItem } from "@/lib/planning";
import { abandonWorkItem, completeWorkItem } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import type { WorkItem } from "@/lib/storage";

/**
 * ÉCHÉANCES — l'écran où l'on répond à « pour quand ».
 *
 * Composé comme une page d'apple.com : un dessin et un grand titre, trois
 * chiffres qui montent quand on les voit (reste à faire, échéances
 * ouvertes, capacité des sept jours), puis la FRISE — les échéances
 * rangées par période (« En retard », « Cette semaine », « Plus tard »,
 * « Sans date »), chacune avec sa page de calendrier. Le formulaire d'ajout
 * vit dans une tuile juste au-dessus ; le rail de droite montre la
 * capacité jour par jour.
 *
 * L'écran n'invente aucun calcul : il assemble `buildWeeklyPlan`,
 * `computeWorkItemPriority` et `postponeWorkItem`. Tout ce qu'il affiche est
 * recalculé à chaque rendu depuis les travaux, les séances et la capacité —
 * le planning n'est jamais stocké, donc jamais périmé.
 */
export function DeadlinesOverview() {
  const { workItems, sessions, preferences, saveWorkItems, ready } = usePrepahubData();
  const [notice, setNotice] = useState<{ tone: "info" | "warning"; text: string } | null>(null);

  const plan = useMemo(() => buildWeeklyPlan(workItems, sessions, preferences, new Date()), [workItems, sessions, preferences]);

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
  /** Plan « si… alors… » — voir lib/intentions.ts. */
  const savePlan = useCallback(
    (id: string, next: WorkItemPlan | null) => {
      saveWorkItems(setWorkItemPlan(workItems, id, next));
    },
    [saveWorkItems, workItems]
  );

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
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const open = plan.priorities;
  const totalRemaining = open.reduce((sum, entry) => sum + entry.remainingMinutes, 0);
  const week = plan.days.slice(0, 7);
  const weekCapacity = week.reduce((sum, day) => sum + day.load.capacityMinutes, 0);
  const weekPlanned = week.reduce((sum, day) => sum + day.load.plannedMinutes, 0);
  const groups = groupByPeriod(open);

  return (
    <Split
      railLabel="Les 7 prochains jours"
      rail={
        <div>
          <h2 className="t-subhead">Les 7 prochains jours</h2>
          <p className="t-meta mt-1">
            <span className="tabular font-semibold text-ink">{formatSpan(weekPlanned * 60)}</span> prévues sur{" "}
            <span className="tabular">{formatSpan(weekCapacity * 60)}</span> disponibles.
          </p>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {week.map((day, index) => (
              <DayPlan key={day.date} day={day} label={dayLabel(day.date, index)} dense />
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-12">
        <header className="reveal">
          <Illustration name="echeances" size={56} className="text-muted" />
          <h1 className="t-display mt-5">Échéances.</h1>
          <p className="t-lede mt-3 max-w-[46ch]">Ce que tu as à rendre, ce que ça représente encore, et quand le travailler.</p>

          {/* TROIS CHIFFRES — pas des tuiles : des nombres posés sur le fond,
              séparés par un filet, comme les caractéristiques d'une fiche
              produit. Ils montent quand on les voit. */}
          <dl className="mt-8 grid grid-cols-3 divide-x divide-line border-y border-line">
            <Figure label="Reste à faire" value={totalRemaining} format={(minutes) => formatSpan(minutes * 60)} />
            <Figure label={open.length > 1 ? "Échéances" : "Échéance"} value={open.length} />
            <Figure label="Libre sur 7 j" value={Math.max(0, weekCapacity - weekPlanned)} format={(minutes) => formatSpan(minutes * 60)} />
          </dl>
        </header>

        <Section
          variant="panel"
          label="Ajouter"
          title="Qu'est-ce que tu as à faire ?"
          description="Le titre suffit — TaekdHub s'occupe de caser le reste dans tes journées."
        >
          <WorkItemForm workItems={workItems} sessions={sessions} onCreate={create} />
        </Section>

        {notice && (
          <Notice
            tone={notice.tone}
            action={
              <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
                Fermer
              </Button>
            }
          >
            {notice.text}
          </Notice>
        )}

        {/* CE QUI NE TIENT PAS, EN TÊTE — jamais masqué, jamais glissé après
            l'échéance en douce. Chaque ligne cite le temps qui manque. */}
        {plan.unplaceable.length > 0 && (
          <section aria-labelledby="arbitrer-titre" className="reveal rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-6 sm:p-8">
            <h2 id="arbitrer-titre" className="t-heading">
              Ce qui ne rentre pas dans tes journées
            </h2>
            <p className="t-meta mt-1.5 max-w-[60ch]">
              Ton échéance n&apos;a pas été déplacée — c&apos;est à toi de décider. Réduire une autre tâche, libérer du temps, ou accepter de
              rendre moins.
            </p>
            <ul className="mt-4 divide-y divide-line">
              {plan.unplaceable.map(({ item, reason }) => (
                <li key={item.id} className="py-3">
                  <p className="t-subhead truncate">{item.title}</p>
                  <p className="t-meta mt-0.5">{reason}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* LA FRISE — une tuile par période, dans l'ordre du temps. */}
        {groups.length > 0 ? (
          <div className="space-y-10">
            {groups.map((group, index) => (
              <section key={group.id} aria-labelledby={`periode-${group.id}`} className="reveal" style={{ "--i": index } as CSSProperties}>
                <h2 id={`periode-${group.id}`} className={`t-heading ${group.id === "retard" ? "text-rose-300" : ""}`}>
                  {group.title} <span className="tabular font-semibold text-subtle">· {group.items.length}</span>
                </h2>
                <ul className="surface mt-4 divide-y divide-line px-5 sm:px-8">
                  {group.items.map((priority) => (
                    <WorkItemRow
                      key={priority.item.id}
                      priority={priority}
                      sessions={sessions}
                      onComplete={complete}
                      onAbandon={abandon}
                      onPostpone={postpone}
                      onPlan={savePlan}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="reveal flex flex-col items-center py-12 text-center">
            <Illustration name="echeances" size={72} className="text-subtle" />
            <p className="t-heading mt-6">Rien à rendre pour l&apos;instant.</p>
            <p className="t-meta mt-2 max-w-[44ch]">
              Note un DM, un DS ou une révision ci-dessus : TaekdHub le répartira sur tes journées et te dira s&apos;il tient.
            </p>
          </div>
        )}
      </div>
    </Split>
  );
}

function Figure({ label, value, format }: { label: string; value: number; format?: (value: number) => string }) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 sm:px-6">
      <dt className="t-label truncate">{label}</dt>
      <dd className="t-figure mt-1.5 text-[clamp(1.25rem,0.9rem+1.6vw,2rem)]">
        <CountUp value={value} format={format} />
      </dd>
    </div>
  );
}

/**
 * LES PÉRIODES DE LA FRISE. À l'intérieur de chacune, l'ordre est celui du
 * CALENDRIER (on lit une frise de gauche à droite, du plus proche au plus
 * lointain) ; à date égale, l'ordre de priorité du moteur (lib/deadlines.ts)
 * départage — il est déjà celui de `plan.priorities`, et le tri est stable.
 */
function groupByPeriod(priorities: WorkItemPriority[]): { id: string; title: string; items: WorkItemPriority[] }[] {
  const byDate = [...priorities].sort((a, b) => (a.item.dueDate ?? "9999").localeCompare(b.item.dueDate ?? "9999"));
  const periods = [
    { id: "retard", title: "En retard", test: (p: WorkItemPriority) => p.overdue },
    { id: "semaine", title: "Cette semaine", test: (p: WorkItemPriority) => p.daysUntilDue !== null && p.daysUntilDue <= 6 },
    { id: "plus-tard", title: "Plus tard", test: (p: WorkItemPriority) => p.daysUntilDue !== null },
    { id: "sans-date", title: "Sans date", test: () => true },
  ];
  const seen = new Set<string>();
  return periods
    .map((period) => {
      const items = byDate.filter((priority) => !seen.has(priority.item.id) && period.test(priority));
      for (const priority of items) seen.add(priority.item.id);
      return { id: period.id, title: period.title, items };
    })
    .filter((group) => group.items.length > 0);
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
