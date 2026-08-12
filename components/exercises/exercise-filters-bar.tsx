"use client";

import { Plus, Search, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import type { ExerciseFilters } from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, ExerciseStatus, ExerciseType, Mastery, Priority, Subject } from "@/lib/supabase/types";

const MASTERY_VALUES: Mastery[] = [0, 25, 50, 75, 100];

/**
 * Recherche + filtres de la banque d'exercices. Purement présentationnelle :
 * toute la logique vit dans lib/exercise-filters.ts. Ajouter un filtre =
 * ajouter un `<Select>` ici lié à un nouveau champ de `ExerciseFilters`, sans
 * toucher au reste.
 */
export function ExerciseFiltersBar({
  filters,
  onChange,
  chapterOptions,
  yearOptions,
  onAddClick,
  onImportClick,
}: {
  filters: ExerciseFilters;
  onChange: (patch: Partial<ExerciseFilters>) => void;
  chapterOptions: Chapter[];
  yearOptions: number[];
  onAddClick: () => void;
  onImportClick: () => void;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            id="exercise-search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className="pl-10"
            placeholder="Rechercher un titre, une source, un tag, une année, un type…"
          />
        </div>
        <Button variant="secondary" onClick={onImportClick} className="shrink-0">
          <Upload size={17} /> Importer
        </Button>
        <Button onClick={onAddClick} className="shrink-0">
          <Plus size={17} /> Ajouter
        </Button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
        <Select value={filters.subject} onChange={(event) => onChange({ subject: event.target.value as Subject | "Toutes", chapter: "Tous" })} className="w-auto min-w-[150px]">
          {["Toutes", ...subjects].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select value={filters.chapter} onChange={(event) => onChange({ chapter: event.target.value })} className="w-auto min-w-[130px]" disabled={chapterOptions.length === 0}>
          <option value="Tous">Tous</option>
          {chapterOptions.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.label}
            </option>
          ))}
        </Select>
        <Select value={filters.type} onChange={(event) => onChange({ type: event.target.value as ExerciseType | "Tous" })} className="w-auto min-w-[110px]">
          {["Tous", ...exerciseTypes].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(event) => onChange({ status: event.target.value as ExerciseStatus | "Tous" })} className="w-auto min-w-[110px]">
          {["Tous", ...exerciseStatuses].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          value={filters.difficulty}
          onChange={(event) => onChange({ difficulty: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Difficulty) })}
          className="w-auto min-w-[130px]"
        >
          <option value="Toutes">Toutes difficultés</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option value={value} key={value}>
              Difficulté {value}/5
            </option>
          ))}
        </Select>
        <Select
          value={filters.priority}
          onChange={(event) => onChange({ priority: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Priority) })}
          className="w-auto min-w-[120px]"
        >
          <option value="Toutes">Toutes priorités</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option value={value} key={value}>
              Priorité {value}/5
            </option>
          ))}
        </Select>
        <Select
          value={filters.mastery}
          onChange={(event) => onChange({ mastery: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Mastery) })}
          className="w-auto min-w-[130px]"
        >
          <option value="Toutes">Toutes maîtrises</option>
          {MASTERY_VALUES.map((value) => (
            <option value={value} key={value}>
              Maîtrise {value}%
            </option>
          ))}
        </Select>
        <Select
          value={filters.year}
          onChange={(event) => onChange({ year: event.target.value === "Toutes" ? "Toutes" : Number(event.target.value) })}
          className="w-auto min-w-[110px]"
          disabled={yearOptions.length === 0}
        >
          <option value="Toutes">Toutes années</option>
          {yearOptions.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </Select>
        <Button
          variant={filters.favoritesOnly ? "primary" : "secondary"}
          size="icon"
          onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          aria-pressed={filters.favoritesOnly}
          aria-label={filters.favoritesOnly ? "Ne montrer que les favoris (actif)" : "Ne montrer que les favoris"}
          className={filters.favoritesOnly ? "shrink-0 border-accent/40 bg-accent/15 text-accent-text" : "shrink-0"}
        >
          <Star size={17} />
        </Button>
      </div>
    </Card>
  );
}
