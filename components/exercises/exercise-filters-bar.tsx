"use client";

import { Plus, Search, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import type { ExerciseFilters } from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, ExerciseStatus, ExerciseType, Mastery, Subject } from "@/lib/supabase/types";

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
  tagOptions,
  difficultyOptions,
  yearOptions,
  onAddClick,
  onImportClick,
}: {
  filters: ExerciseFilters;
  onChange: (patch: Partial<ExerciseFilters>) => void;
  chapterOptions: Chapter[];
  /** Sous-thèmes disponibles pour le périmètre matière/chapitre déjà choisi — voir lib/exercise-filters.ts#tagOptionsForFilters. */
  tagOptions: string[];
  /** Difficultés présentes dans le périmètre choisi — voir lib/exercise-filters.ts#difficultyOptionsForFilters. */
  difficultyOptions: Difficulty[];
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
        {/* "Ajouter"/"Importer" en secondaire : sur une page dont tout l'objet
            est de RETROUVER un exercice parmi 402 déjà présents, créer une
            fiche est une action rare et administrative. En primaire plein
            accent, "Ajouter" était l'élément le plus visible de l'écran —
            hiérarchie inversée par rapport à ce que l'élève vient y faire.
            Les deux actions restent au même endroit, simplement au bon rang. */}
        <Button variant="secondary" onClick={onImportClick} className="shrink-0">
          <Upload size={17} /> Importer
        </Button>
        <Button variant="secondary" onClick={onAddClick} className="shrink-0">
          <Plus size={17} /> Ajouter
        </Button>
      </div>

      {/* flex-wrap plutôt que overflow-x-auto : un défilement horizontal
          masqué (scrollbar-none) rendait certains filtres invisibles sans
          aucun indice qu'ils existaient (maîtrise, année, favoris
          systématiquement hors champ à largeur d'écran normale) — un filtre
          qu'on ne peut pas découvrir équivaut, pour l'élève, à un filtre qui
          n'existe pas.

          Le filtre « priorité » a été retiré avec le champ lui-même : il
          proposait 5 valeurs pour un champ qui en valait 3 partout. */}
      <div className="mt-3 flex flex-wrap gap-2">
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
        <Select
          value={filters.tag}
          onChange={(event) => onChange({ tag: event.target.value })}
          className="w-auto min-w-[150px]"
          disabled={tagOptions.length === 0}
          aria-label="Sous-thème"
        >
          <option value="Toutes">Tous sous-thèmes</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
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
          className={filters.favoritesOnly ? "shrink-0 border-accent/40 bg-accent/15 text-accent" : "shrink-0"}
        >
          <Star size={17} />
        </Button>
      </div>
    </Card>
  );
}
