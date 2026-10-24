import { isActive } from "@/lib/work-items";
import type { WorkItem } from "@/lib/storage";

/**
 * LA LISTE « À FAIRE » (accueil) — les travaux encore à faire, rangés par
 * échéance : en retard, aujourd'hui, demain, cette semaine, plus tard, sans
 * date. Rien n'est calculé ni proposé : c'est la liste de l'élève, dans
 * l'ordre du calendrier.
 *
 * Fonctions pures. Les jours sont des "AAAA-MM-JJ" en heure locale (comme
 * `WorkItem.dueDate`).
 */

export type TodoGroupId = "retard" | "aujourdhui" | "demain" | "semaine" | "plus-tard" | "sans-date";

export interface TodoGroup {
  id: TodoGroupId;
  title: string;
  items: WorkItem[];
}

const TITLES: Record<TodoGroupId, string> = {
  retard: "En retard",
  aujourdhui: "Aujourd'hui",
  demain: "Demain",
  semaine: "Cette semaine",
  "plus-tard": "Plus tard",
  "sans-date": "Sans date",
};

const ORDER: TodoGroupId[] = ["retard", "aujourdhui", "demain", "semaine", "plus-tard", "sans-date"];

/** Le jour `days` après `day` ("AAAA-MM-JJ", heure locale). */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(year, month - 1, date + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

function groupOf(item: WorkItem, today: string): TodoGroupId {
  if (!item.dueDate) return "sans-date";
  if (item.dueDate < today) return "retard";
  if (item.dueDate === today) return "aujourdhui";
  if (item.dueDate === addDays(today, 1)) return "demain";
  if (item.dueDate <= addDays(today, 7)) return "semaine";
  return "plus-tard";
}

/** Les groupes non vides, dans l'ordre du calendrier ; dans un groupe, par échéance puis heure, puis par date de création. */
export function groupTodo(items: WorkItem[], today: string): TodoGroup[] {
  const buckets = new Map<TodoGroupId, WorkItem[]>(ORDER.map((id) => [id, []]));
  for (const item of items.filter(isActive)) buckets.get(groupOf(item, today))!.push(item);
  return ORDER.map((id) => ({
    id,
    title: TITLES[id],
    items: buckets.get(id)!.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99") || a.createdAt.localeCompare(b.createdAt)),
  })).filter((group) => group.items.length > 0);
}

/** « sam. 24 oct. » ; une date illisible est rendue telle quelle. */
export function shortDay(day: string): string {
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? day : parsed.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
