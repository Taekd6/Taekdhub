"use client";

import { CalendarCheck } from "lucide-react";
import { ListCard, ListRow } from "@/components/ui/list-card";
import { formatClock, intentionsForToday } from "@/lib/intentions";
import type { WorkItem } from "@/lib/storage";

/**
 * TON PLAN DU JOUR — les plans « si… alors… » relus le jour venu.
 *
 * Relire son plan au moins une fois renforce l'effet des intentions
 * d'implémentation (voir lib/intentions.ts) : c'est tout le rôle de cette
 * carte. Chaque ligne lance le chrono sur le travail. Un plan d'un jour
 * passé reste affiché, marqué « à replanifier », jusqu'à ce que le travail
 * soit terminé ou replanifié. Rien à relire : la carte ne s'affiche pas.
 */
export function IntentionsCard({ workItems, className }: { workItems: WorkItem[]; className?: string }) {
  const intentions = intentionsForToday(workItems);
  if (intentions.length === 0) return null;

  return (
    <ListCard title="Ton plan du jour" href="/echeances" hrefLabel="Échéances" className={className}>
      {intentions.slice(0, 4).map(({ item, plan, missed }) => (
        <ListRow
          key={item.id}
          href={missed ? "/echeances" : `/timer?travail=${item.id}`}
          leading={
            <span className="grid h-11 w-11 place-items-center rounded-full bg-inset text-accent" aria-hidden>
              <CalendarCheck size={18} />
            </span>
          }
          title={item.title}
          sub={missed ? "Plan passé · à replanifier" : [plan.time ? formatClock(plan.time) : "Dans la journée", plan.place].filter(Boolean).join(" · ")}
          subClassName={missed ? "text-rose-300" : undefined}
          value={missed ? undefined : "Go"}
          ariaLabel={missed ? `Replanifier « ${item.title} »` : `Lancer le chrono sur « ${item.title} »`}
        />
      ))}
    </ListCard>
  );
}
