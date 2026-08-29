"use client";

import { ChevronDown, FileCheck2, Search, SlidersHorizontal, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented";
import { contestPaperStatuses } from "@/lib/contests";
import { defaultContestFilters, type ContestFilters } from "@/lib/contests";
import { subjects } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Chapter, Competition, ContestPaperStatus } from "@/lib/storage";
import type { Difficulty, Subject } from "@/lib/supabase/types";

/**
 * Recherche + filtres de la banque de sujets — même structure que
 * `ExerciseFiltersBar` (lib/exercise-filters.ts) : présentation seule, toute
 * la logique vit dans lib/contests.ts.
 */
export function ContestFiltersBar({
  filters,
  onChange,
  competitionOptions,
  yearOptions,
  difficultyOptions,
  chapterOptions,
}: {
  filters: ContestFilters;
  onChange: (patch: Partial<ContestFilters>) => void;
  competitionOptions: Competition[];
  yearOptions: number[];
  difficultyOptions: Difficulty[];
  chapterOptions: Chapter[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const secondaryActiveCount = [
    filters.competition !== "Tous",
    filters.year !== "Toutes",
    filters.difficulty !== "Toutes",
    filters.chapter !== "Tous",
    filters.withCorrectionOnly,
    filters.favoritesOnly,
  ].filter(Boolean).length;
  const [advancedOpen, setAdvancedOpen] = useState(secondaryActiveCount > 0);
  const activeCount = secondaryActiveCount + (filters.status !== "Tous" ? 1 : 0) + (filters.subject !== "Toutes" ? 1 : 0);

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            id="contest-search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className="pl-10"
            placeholder="Rechercher un concours, un thème, une année…"
            aria-label="Rechercher un sujet de concours"
          />
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="secondary" className="flex-1" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal size={16} /> Filtrer
            {activeCount > 0 && <span className="rounded bg-accent/15 px-1.5 text-2xs font-medium text-accent">{activeCount}</span>}
          </Button>
          <Button
            variant={filters.favoritesOnly ? "primary" : "secondary"}
            size="icon"
            aria-label="Favoris uniquement"
            aria-pressed={filters.favoritesOnly}
            onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          >
            <Star size={17} />
          </Button>
        </div>
      </div>

      <div className="mt-3 hidden flex-wrap items-center gap-x-5 gap-y-2 lg:flex">
        <SegmentedControl
          ariaLabel="Matière"
          value={filters.subject}
          onChange={(value) => onChange({ subject: value as Subject | "Toutes", chapter: "Tous" })}
          options={["Toutes", ...subjects].map((value) => ({ value, label: value }))}
        />
        <SegmentedControl
          ariaLabel="Statut"
          value={filters.status}
          onChange={(value) => onChange({ status: value as ContestPaperStatus | "Tous" })}
          options={["Tous", ...contestPaperStatuses].map((value) => ({ value, label: value === "Tous" ? "Tous" : value }))}
        />
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          aria-expanded={advancedOpen}
          className="focus-ring flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-muted transition hover:text-ink"
        >
          Plus de filtres
          {secondaryActiveCount > 0 && <span className="rounded bg-accent/15 px-1.5 text-2xs font-medium text-accent">{secondaryActiveCount}</span>}
          <ChevronDown size={14} className={cn("transition-transform", advancedOpen && "rotate-180")} />
        </button>
      </div>

      {advancedOpen && (
        <div className="mt-3 hidden flex-wrap gap-2 border-t border-hairline/[0.07] pt-3 lg:flex">
          <Select
            value={filters.competition}
            onChange={(event) => onChange({ competition: event.target.value as Competition | "Tous" })}
            className="w-auto min-w-[130px]"
            disabled={competitionOptions.length === 0}
          >
            <option value="Tous">Tous concours</option>
            {competitionOptions.map((value) => (
              <option key={value} value={value}>
                {value}
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
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            value={filters.difficulty}
            onChange={(event) => onChange({ difficulty: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Difficulty) })}
            className="w-auto min-w-[150px]"
            disabled={difficultyOptions.length === 0}
          >
            <option value="Toutes">Toutes difficultés</option>
            {difficultyOptions.map((value) => (
              <option value={value} key={value}>
                Difficulté {value}/5
              </option>
            ))}
          </Select>
          <Select
            value={filters.chapter}
            onChange={(event) => onChange({ chapter: event.target.value })}
            className="w-auto min-w-[150px]"
            disabled={chapterOptions.length === 0}
          >
            <option value="Tous">Tous chapitres</option>
            {chapterOptions.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.label}
              </option>
            ))}
          </Select>
          <Button
            variant={filters.withCorrectionOnly ? "primary" : "secondary"}
            size="icon"
            onClick={() => onChange({ withCorrectionOnly: !filters.withCorrectionOnly })}
            aria-pressed={filters.withCorrectionOnly}
            aria-label="Avec corrigé uniquement"
            className="shrink-0"
          >
            <FileCheck2 size={17} />
          </Button>
          <Button
            variant={filters.favoritesOnly ? "primary" : "secondary"}
            size="icon"
            onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
            aria-pressed={filters.favoritesOnly}
            aria-label="Favoris uniquement"
            className="shrink-0"
          >
            <Star size={17} />
          </Button>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtrer"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onChange(defaultContestFilters)}>
              Tout effacer
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Voir les résultats
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Matière">
            <Select value={filters.subject} onChange={(event) => onChange({ subject: event.target.value as Subject | "Toutes", chapter: "Tous" })}>
              {["Toutes", ...subjects].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={filters.status} onChange={(event) => onChange({ status: event.target.value as ContestPaperStatus | "Tous" })}>
              {["Tous", ...contestPaperStatuses].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Concours">
            <Select value={filters.competition} onChange={(event) => onChange({ competition: event.target.value as Competition | "Tous" })} disabled={competitionOptions.length === 0}>
              <option value="Tous">Tous</option>
              {competitionOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Année">
            <Select
              value={filters.year}
              onChange={(event) => onChange({ year: event.target.value === "Toutes" ? "Toutes" : Number(event.target.value) })}
              disabled={yearOptions.length === 0}
            >
              <option value="Toutes">Toutes</option>
              {yearOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulté">
            <Select
              value={filters.difficulty}
              onChange={(event) => onChange({ difficulty: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Difficulty) })}
              disabled={difficultyOptions.length === 0}
            >
              <option value="Toutes">Toutes</option>
              {difficultyOptions.map((value) => (
                <option value={value} key={value}>
                  Difficulté {value}/5
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chapitre">
            <Select value={filters.chapter} onChange={(event) => onChange({ chapter: event.target.value })} disabled={chapterOptions.length === 0}>
              <option value="Tous">Tous</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={filters.withCorrectionOnly}
              onChange={(event) => onChange({ withCorrectionOnly: event.target.checked })}
              className="h-4 w-4 rounded border-hairline/[0.14]"
            />
            Avec corrigé uniquement
          </label>
        </div>
      </Sheet>
    </Card>
  );
}
