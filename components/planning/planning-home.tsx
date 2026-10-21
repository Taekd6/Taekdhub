"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { EMPTY_PLAN, PLAN_KEY, addTask, buildDay, loadPlan, openCount, removeTask, savePlan, shiftDay, toggleDone, weekDays, weekStart, type PlanState } from "@/lib/plan-tasks";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { dayKey, subjectMeta } from "@/lib/study";

/**
 * L'ACCUEIL = LE PLANNING. Une semaine en haut, et sous elle ce qu'il y a à
 * faire le jour choisi, avec une case à cocher par chose. On peut ajouter ses
 * propres tâches à un jour. Voir lib/plan-tasks.ts pour d'où vient chaque
 * ligne et où se range ce qui est coché.
 */
const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

const fromKey = (key: string) => new Date(`${key}T12:00:00`);

export function PlanningHome() {
  const { workItems, ready } = usePrepahubData();
  const [today, setToday] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanState>(EMPTY_PLAN);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);

  // La date et l'état stocké ne se lisent qu'après le montage : le serveur ne les connaît pas.
  useEffect(() => {
    const now = dayKey(new Date());
    setToday(now);
    setSelected((current) => current ?? now);
    setPlan(loadPlan());
    setLoaded(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAN_KEY) setPlan(loadPlan());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: PlanState) => {
    setPlan(next);
    setFailed(!savePlan(next));
  }, []);

  const start = selected ? weekStart(selected) : null;
  const days = useMemo(() => (start ? weekDays(start) : []), [start]);
  const sources = useMemo(() => ({ workItems }), [workItems]);
  const built = useMemo(() => days.map((date) => buildDay(date, plan, sources)), [days, plan, sources]);
  const current = built.find((day) => day.date === selected) ?? null;

  if (!loaded || !ready || !selected || !today || !start || !current) {
    return <div className="mx-auto min-h-[60vh] max-w-[44rem]" aria-busy />;
  }

  const remaining = openCount(current);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    update(addTask(plan, selected, draft, crypto.randomUUID()));
    setDraft("");
  };

  return (
    <div className="mx-auto max-w-[44rem] space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink lg:text-5xl">Planning</h1>
          <p className="mt-1 text-sm font-medium text-muted first-letter:uppercase">{monthYear.format(fromKey(start))}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Semaine précédente" onClick={() => setSelected(shiftDay(selected, -7))}>
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(today)} disabled={selected === today}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="sm" aria-label="Semaine suivante" onClick={() => setSelected(shiftDay(selected, 7))}>
            <ChevronRight size={18} aria-hidden />
          </Button>
        </div>
      </header>

      <nav aria-label="Semaine" className="surface grid grid-cols-7 gap-1.5 p-2">
        {built.map((day) => {
          const date = fromKey(day.date);
          const active = day.date === selected;
          const open = openCount(day);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelected(day.date)}
              aria-current={active ? "date" : undefined}
              aria-label={`${longDay.format(date)}${open > 0 ? `, ${open} à faire` : ""}`}
              className={cn(
                "press flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-sm transition-colors",
                active ? "bg-accent/10 font-semibold text-accent" : "text-muted hover:bg-inset"
              )}
            >
              <span className="text-xs capitalize">{weekdayShort.format(date).replace(".", "")}</span>
              <span className={cn("text-lg tabular", day.date === today && !active && "text-ink font-semibold")}>{date.getDate()}</span>
              <span className={cn("h-1.5 w-1.5 rounded-full", open > 0 ? "bg-accent" : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </nav>

      <section aria-label={longDay.format(fromKey(selected))} className="surface space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="t-card-title capitalize">{selected === today ? "Aujourd'hui" : longDay.format(fromKey(selected))}</h2>
          <span className="text-sm text-muted">{current.items.length === 0 ? "" : remaining === 0 ? "Tout est fait" : `${remaining} à faire`}</span>
        </div>

        {current.rest && <p className="rounded-xl bg-inset px-4 py-3 text-sm text-muted">{current.rest}</p>}

        {current.items.length === 0 && !current.rest && <p className="text-sm text-muted">Rien de prévu ce jour-là.</p>}

        <ul className="space-y-1">
          {current.items.map((item) => {
            const subject = item.subject ? subjectMeta[item.subject] : null;
            return (
              <li key={item.id} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-inset/60">
                <input
                  type="checkbox"
                  id={`plan-${item.id}`}
                  checked={item.done}
                  onChange={() => update(toggleDone(plan, item.id))}
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-accent"
                />
                <label htmlFor={`plan-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className={cn("block text-[0.9375rem] font-semibold text-ink", item.done && "text-subtle line-through")}>{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[item.time, subject ? item.subject : null, item.kind === "echeance" ? "Échéance" : null].filter(Boolean).join(" · ")}
                  </span>
                  {item.detail && <span className="mt-1 block text-xs leading-5 text-subtle">{item.detail}</span>}
                </label>
                {item.href && (
                  <Link href={item.href} className="shrink-0 pt-0.5 text-xs font-semibold text-accent hover:underline">
                    Ouvrir
                  </Link>
                )}
                {item.removable && (
                  <button
                    type="button"
                    aria-label={`Supprimer « ${item.title} »`}
                    onClick={() => update(removeTask(plan, item.id.slice(2)))}
                    className="press shrink-0 rounded-full p-1 text-subtle hover:bg-inset hover:text-ink"
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={submit} className="flex gap-2 border-t border-line pt-4">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ajouter une tâche à ce jour" aria-label="Nouvelle tâche" maxLength={200} />
          <Button type="submit" size="md" disabled={!draft.trim()} aria-label="Ajouter la tâche">
            <Plus size={18} aria-hidden />
          </Button>
        </form>

        {failed && (
          <p role="alert" className="text-sm text-rose-400">
            Le navigateur a refusé l&apos;enregistrement : ce que tu coches ne sera pas conservé.
          </p>
        )}
      </section>
    </div>
  );
}
