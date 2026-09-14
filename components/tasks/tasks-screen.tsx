"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageBar } from "@/components/ui/layout";
import { SegmentedControl } from "@/components/ui/segmented";
import { List, Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/state";
import { TaskRow } from "@/components/tasks/task-row";
import { useComposer } from "@/components/tasks/composer";
import { CATEGORY_FAMILY_LABELS, CATEGORY_FAMILY_ORDER, CATEGORY_META, categoriesByFamily } from "@/lib/domain/categories";
import { formatMinutes } from "@/lib/domain/date";
import { activeSubjects } from "@/lib/domain/subjects";
import { dueInfo, filterTasks, isDeadlineTask, isOverdue, isScheduled, remainingMinutes, sortByDue } from "@/lib/domain/tasks";
import { useStore } from "@/lib/store/store";
import type { Task, TaskCategory } from "@/lib/domain/types";

/**
 * ============================================================================
 * TÂCHES — la liste complète, et le seul écran où l'on cherche.
 * ============================================================================
 *
 * Regroupée par URGENCE, jamais par date de création : « En retard »,
 * « Aujourd'hui », « Cette semaine », « Plus tard », « Sans échéance ». Un
 * élève ne se demande jamais « qu'est-ce que j'ai saisi le 3 octobre » ; il
 * se demande « qu'est-ce qui me tombe dessus ».
 *
 * Les filtres tiennent sur UNE ligne et sont repliés par défaut sur mobile :
 * une barre de huit sélecteurs occupant le tiers de l'écran avant la première
 * tâche est le défaut classique de ce genre d'écran.
 */

type Scope = "open" | "done" | "all";

const GROUPS = [
  { id: "overdue", label: "En retard", tone: "danger" as const },
  { id: "today", label: "Aujourd'hui", tone: "warning" as const },
  { id: "week", label: "Cette semaine", tone: "default" as const },
  { id: "later", label: "Plus tard", tone: "default" as const },
  { id: "none", label: "Sans échéance", tone: "default" as const },
];

export function TasksScreen() {
  const { state, ready } = useStore();
  const { add, open } = useComposer();
  const params = useSearchParams();

  const [scope, setScope] = useState<Scope>("open");
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState<TaskCategory | "">("");
  const [unscheduledOnly, setUnscheduledOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const overdueFromUrl = params.get("filter") === "overdue";

  const now = useMemo(() => new Date(), []);

  const groups = useMemo(() => {
    const filtered = filterTasks(
      state.tasks,
      {
        status: scope === "all" ? undefined : scope === "done" ? "done" : "open",
        search: search || undefined,
        subjectId: subjectId || undefined,
        category: category || undefined,
        unscheduledOnly: unscheduledOnly || undefined,
        overdueOnly: overdueFromUrl || undefined,
      },
      now
    );

    const buckets: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [], none: [] };
    for (const task of sortByDue(filtered)) {
      if (isOverdue(task, now)) buckets.overdue.push(task);
      else {
        const info = dueInfo(task, now);
        if (info.state === "none") buckets.none.push(task);
        else if (info.state === "today") buckets.today.push(task);
        else if (info.state === "tomorrow" || info.state === "soon") buckets.week.push(task);
        else buckets.later.push(task);
      }
    }
    return buckets;
  }, [state.tasks, scope, search, subjectId, category, unscheduledOnly, overdueFromUrl, now]);

  const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
  // Le temps annoncé est du TRAVAIL : la durée d'un DS est celle de l'épreuve,
  // pas un effort à fournir en soirée, et l'additionner gonflait le total de
  // quatre heures fantômes.
  const totalMinutes = Object.values(groups)
    .flat()
    .filter((task) => !isDeadlineTask(task))
    .reduce((sum, task) => sum + remainingMinutes(task, state.timeEntries), 0);
  const unplanned = state.tasks.filter((task) => task.status === "todo" && !isScheduled(task) && !isDeadlineTask(task)).length;

  return (
    <div className="space-y-7">
      <PageBar
        title="Tâches"
        meta={
          ready
            ? `${total} tâche${total > 1 ? "s" : ""} · ${formatMinutes(totalMinutes)} de travail${unplanned > 0 ? ` · ${unplanned} sans créneau` : ""}`
            : undefined
        }
        actions={
          <Button onClick={() => add()} className="max-lg:hidden">
            <Plus size={16} /> Ajouter
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Portée"
            size="sm"
            options={[
              { value: "open", label: "À faire" },
              { value: "done", label: "Terminées" },
              { value: "all", label: "Toutes" },
            ]}
            value={scope}
            onChange={setScope}
            className="sm:w-auto"
          />
          <span className="relative flex min-w-[12rem] flex-1 items-center">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une tâche"
              className="pl-8"
              aria-label="Rechercher une tâche"
            />
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}>
            <Filter size={14} /> Filtres
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <Select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              aria-label="Matière"
              wrapperClassName="w-auto min-w-[10rem]"
            >
              <option value="">Toutes les matières</option>
              {activeSubjects(state.subjects).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </Select>

            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory | "")}
              aria-label="Type de tâche"
              wrapperClassName="w-auto min-w-[11rem]"
            >
              <option value="">Tous les types</option>
              {CATEGORY_FAMILY_ORDER.map((family) => (
                <optgroup key={family} label={CATEGORY_FAMILY_LABELS[family]}>
                  {categoriesByFamily(family).map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_META[value].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>

            <Button
              size="sm"
              variant={unscheduledOnly ? "primary" : "secondary"}
              onClick={() => setUnscheduledOnly((value) => !value)}
              aria-pressed={unscheduledOnly}
            >
              Sans créneau
            </Button>

            {(subjectId || category || unscheduledOnly || search) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSubjectId("");
                  setCategory("");
                  setUnscheduledOnly(false);
                  setSearch("");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        )}
      </div>

      {ready && total === 0 && (
        <EmptyState
          title={search || subjectId || category ? "Aucune tâche ne correspond" : "Aucune tâche"}
          description={
            search || subjectId || category
              ? "Élargis la recherche ou réinitialise les filtres."
              : "Ajoute ce que tu as à faire : un TD, un DM, un chapitre à apprendre."
          }
          action={
            <Button onClick={() => add()}>
              <Plus size={15} /> Ajouter une tâche
            </Button>
          }
        />
      )}

      {GROUPS.map((group) => {
        const tasks = groups[group.id];
        if (!tasks || tasks.length === 0) return null;
        const minutes = tasks
          .filter((task) => !isDeadlineTask(task))
          .reduce((sum, task) => sum + remainingMinutes(task, state.timeEntries), 0);
        return (
          <Section
            key={group.id}
            title={group.label}
            action={
              <Badge variant={group.tone}>
                {tasks.length} · {formatMinutes(minutes)}
              </Badge>
            }
          >
            <List>
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={open} now={now} />
              ))}
            </List>
          </Section>
        );
      })}
    </div>
  );
}
