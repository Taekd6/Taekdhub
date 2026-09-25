import { dayKey } from "@/lib/study";
import { isActive } from "@/lib/work-items";
import type { WorkItem, WorkItemPlan } from "@/lib/storage";

/**
 * PLANS « SI… ALORS… » — les intentions d'implémentation.
 *
 * « Si c'est samedi 10 h, à la maison, alors je refais le TD4 de maths. »
 * Décider À L'AVANCE du moment et du lieu d'une tâche transforme un objectif
 * vague en déclencheur : le moment venu, on n'a plus à décider, seulement à
 * exécuter. C'est l'un des effets les plus robustes de la psychologie de la
 * motivation — méta-analyse de 94 études, d ≈ 0,65 sur l'atteinte des
 * objectifs (Gollwitzer & Sheeran, 2006), confirmée sur 642 tests
 * (Sheeran, Listrom & Gollwitzer, 2024). L'effet est plus fort quand le plan
 * a vraiment la forme « si… alors… » et qu'il est relu au moins une fois —
 * d'où la carte de l'accueil, qui le remet sous les yeux le jour venu.
 *
 * Un plan est porté par un travail (`WorkItem.plan`) : il ne crée aucune
 * donnée à part, et disparaît avec le travail une fois celui-ci terminé.
 *
 * Fonctions pures.
 */

export interface TodayIntention {
  item: WorkItem;
  plan: WorkItemPlan;
  /** Plan d'un jour passé, travail toujours pas terminé : à replanifier. */
  missed: boolean;
}

/**
 * Les plans à relire aujourd'hui : ceux du jour (triés par heure, les plans
 * sans heure en dernier), puis ceux des jours passés dont le travail n'est
 * pas terminé — un plan raté se replanifie, il ne s'efface pas en silence.
 */
export function intentionsForToday(items: WorkItem[], now: Date = new Date()): TodayIntention[] {
  const today = dayKey(now);
  const out: TodayIntention[] = [];
  for (const item of items) {
    if (!isActive(item) || !item.plan) continue;
    if (item.plan.day === today) out.push({ item, plan: item.plan, missed: false });
    else if (item.plan.day < today) out.push({ item, plan: item.plan, missed: true });
  }
  return out.sort((a, b) => {
    if (a.missed !== b.missed) return a.missed ? 1 : -1;
    return (a.plan.time ?? "99:99").localeCompare(b.plan.time ?? "99:99");
  });
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « 18:00 » → « 18 h », « 18:30 » → « 18 h 30 ». */
export function formatClock(time: string): string {
  return time.replace(":", " h ").replace(/ h 00$/, " h");
}

/** « Si c'est samedi 26 septembre à 10 h, à la maison, alors : DM 4. » — la phrase à relire. */
export function formatIntention(plan: WorkItemPlan, title: string, now: Date = new Date()): string {
  const when = plan.day === dayKey(now) ? "aujourd'hui" : dayFormatter.format(new Date(`${plan.day}T00:00:00`));
  const time = plan.time ? ` à ${formatClock(plan.time)}` : "";
  const place = plan.place ? `, ${plan.place}` : "";
  return `Si c'est ${when}${time}${place}, alors : ${title}.`;
}

/** Pose (ou retire, avec `null`) le plan d'un travail. */
export function setWorkItemPlan(items: WorkItem[], id: string, plan: WorkItemPlan | null): WorkItem[] {
  return items.map((item) => (item.id === id ? { ...item, plan } : item));
}
