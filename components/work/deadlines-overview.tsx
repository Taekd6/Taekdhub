"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Illustration } from "@/components/ui/illustrations";
import { GradientCard } from "@/components/ui/gradient-card";
import { Split } from "@/components/ui/layout";
import { BlockHeader } from "@/components/ui/list-card";
import { PageHero } from "@/components/ui/page-hero";
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

  /*
   * MISE EN PAGE « REVOLUT CLAIR » (`Split`, components/ui/layout.tsx).
   * Une colonne sur téléphone : l'en-tête, la carte-héros en dégradé (le
   * reste à faire en très grand, qui compte), la saisie, la frise des
   * échéances en cartes-listes blanches, puis la semaine. Sur grand écran,
   * la semaine passe dans le rail collant à droite, dans sa propre tuile.
   */
  return (
    <Split
      railLabel="Les 7 prochains jours"
      rail={
        /* LES 7 PROCHAINS JOURS — la capacité en barres à dégradé, puis le
           détail jour par jour. */
        <>
          <h2 className="text-xl font-black tracking-[-0.02em] text-ink">Les 7 prochains jours</h2>
          <p className="mt-1 text-[0.875rem] font-semibold text-muted">
            <span className="tabular font-extrabold text-ink">{formatSpan(weekPlanned * 60)}</span> prévues sur{" "}
            <span className="tabular">{formatSpan(weekCapacity * 60)}</span>
          </p>
          <CapacityBars days={week} />
          <div className="mt-4 divide-y divide-line border-t border-line">
            {week.map((day, index) => (
              <DayPlan key={day.date} day={day} label={dayLabel(day.date, index)} dense />
            ))}
          </div>
        </>
      }
    >
      <div className="min-w-0 space-y-8 sm:space-y-10">
        <PageHero title="Échéances" lede="Ce que tu as à rendre, et quand le travailler." illustration={<Illustration name="echeances" size={48} />} />

        {/* LES TROIS CHIFFRES, dans une carte en dégradé : le reste à faire en
            très grand, puis deux pastilles de verre. Ils montent quand on
            les voit. */}
        <GradientCard tone="brand" tilt={false} className="reveal p-5 sm:p-7" style={{ "--i": 1 } as CSSProperties}>
          <dl>
            <div>
              <dt className="text-[0.8125rem] font-bold opacity-80">Reste à faire</dt>
              <dd className="t-card-figure mt-1 whitespace-nowrap">
                <CountUp value={totalRemaining} duration={1400} format={(minutes) => formatSpan(minutes * 60)} />
              </dd>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[0.8125rem] font-extrabold">
              <div className="flex items-baseline gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
                <dd className="tabular text-[0.9375rem] font-black">
                  <CountUp value={open.length} />
                </dd>
                <dt>{open.length > 1 ? "échéances" : "échéance"}</dt>
              </div>
              <div className="flex items-baseline gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
                <dd className="tabular text-[0.9375rem] font-black">
                  <CountUp value={Math.max(0, weekCapacity - weekPlanned)} format={(minutes) => formatSpan(minutes * 60)} />
                </dd>
                <dt>libres sur 7 j</dt>
              </div>
            </div>
          </dl>
        </GradientCard>

        <Section variant="panel" label="Ajouter" title="Qu'est-ce que tu as à faire ?" description="Le titre suffit : le reste se case tout seul.">
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
          <section aria-labelledby="arbitrer-titre" className="reveal rounded-[1.625rem] border border-amber-400/30 bg-amber-400/[0.06] p-5 sm:p-7">
            <h2 id="arbitrer-titre" className="t-heading">
              Ce qui ne rentre pas dans tes journées
            </h2>
            <p className="mt-1 max-w-[60ch] text-[0.875rem] font-semibold text-muted">
              L&apos;échéance n&apos;a pas bougé : à toi d&apos;arbitrer.
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
          <div className="space-y-6">
            {groups.map((group, index) => (
              <section
                key={group.id}
                aria-labelledby={`periode-${group.id}`}
                className="surface reveal px-1.5 py-2"
                style={{ "--i": index } as CSSProperties}
              >
                <BlockHeader
                  id={`periode-${group.id}`}
                  className={`px-3 pb-1 pt-2.5 ${group.id === "retard" ? "[&_h2]:text-rose-300" : ""}`}
                  title={
                    <>
                      {group.title} <span className="tabular font-bold text-subtle">· {group.items.length}</span>
                    </>
                  }
                />
                <ul className="divide-y divide-line px-3">
                  {group.items.map((priority, position) => (
                    <WorkItemRow
                      key={priority.item.id}
                      priority={priority}
                      tone={position}
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
            <p className="t-meta mt-2 max-w-[44ch]">Note un DM, un DS ou une révision ci-dessus : il se répartit sur tes journées.</p>
          </div>
        )}
      </div>

    </Split>
  );
}

/**
 * LA CAPACITÉ DE LA SEMAINE EN BARRES — une colonne par jour : sa hauteur
 * est ce que la journée peut porter (le creux gris), le dégradé ce qui y
 * est prévu. Orange → rose quand la journée déborde : c'est le seul jour
 * qui demande une décision. Les barres poussent en cascade à l'entrée.
 */
function CapacityBars({ days }: { days: { date: string; load: { plannedMinutes: number; capacityMinutes: number } }[] }) {
  const max = Math.max(1, ...days.map((day) => Math.max(day.load.capacityMinutes, day.load.plannedMinutes)));
  return (
    <figure
      className="mt-5"
      role="img"
      aria-label={`Capacité des 7 prochains jours : ${days
        .map((day, index) => `${dayLabel(day.date, index)}, ${formatSpan(day.load.plannedMinutes * 60)} prévues sur ${formatSpan(day.load.capacityMinutes * 60)}`)
        .join(" ; ")}.`}
    >
      <div aria-hidden className="flex h-28 items-end gap-2">
        {days.map((day, index) => {
          const { plannedMinutes, capacityMinutes } = day.load;
          const over = plannedMinutes > capacityMinutes;
          const track = (Math.max(capacityMinutes, plannedMinutes) / max) * 100;
          const fill = capacityMinutes > 0 ? Math.min(100, (plannedMinutes / Math.max(capacityMinutes, plannedMinutes)) * 100) : plannedMinutes > 0 ? 100 : 0;
          return (
            <div key={day.date} className="group flex h-full min-w-0 flex-1 items-end justify-center" title={`${dayLabel(day.date, index)} — ${formatSpan(plannedMinutes * 60)} / ${formatSpan(capacityMinutes * 60)}`}>
              <div className="relative flex w-full max-w-[1.75rem] items-end overflow-hidden rounded-[0.625rem] bg-hairline/[0.07]" style={{ height: `${Math.max(track, 6)}%` }}>
                {fill > 0 && (
                  <span
                    className={`grow-y block w-full rounded-[0.625rem] ${over ? "bg-[image:var(--review-grad)]" : "bar-grad"}`}
                    style={{ height: `${Math.max(fill, 8)}%`, "--i": index } as CSSProperties}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-2 flex gap-2">
        {days.map((day, index) => (
          <span key={day.date} className={`min-w-0 flex-1 text-center text-2xs font-bold ${index === 0 ? "text-ink" : "text-subtle"}`}>
            {index === 0 ? "Auj." : WEEKDAYS[new Date(`${day.date}T00:00:00`).getDay()].slice(0, 3)}
          </span>
        ))}
      </div>
    </figure>
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
