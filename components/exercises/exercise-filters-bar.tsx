"use client";

import { Plus, Search, SlidersHorizontal, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useState } from "react";
import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import { defaultExerciseFilters, type ExerciseFilters } from "@/lib/exercise-filters";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  // Combien de filtres l'élève a réellement posés — pour lui dire, sur mobile
  // où les sélecteurs sont repliés, que la liste qu'il regarde est restreinte.
  const activeCount = [
    filters.subject !== "Toutes",
    filters.chapter !== "Tous",
    filters.tag !== "Toutes",
    filters.type !== "Tous",
    filters.status !== "Tous",
    filters.difficulty !== "Toutes",
    filters.mastery !== "Toutes",
    filters.year !== "Toutes",
    filters.favoritesOnly,
  ].filter(Boolean).length;

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
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
        {/* Sur mobile, « Filtrer » remplace les huit sélecteurs : ils
            occupaient deux rangées avant le premier exercice, alors que
            filtrer y est une action ponctuelle. Créer et importer, plus rares
            encore, passent dans la feuille. */}
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
        <Button variant="secondary" onClick={onImportClick} className="hidden shrink-0 lg:inline-flex">
          <Upload size={17} /> Importer
        </Button>
        <Button variant="secondary" onClick={onAddClick} className="hidden shrink-0 lg:inline-flex">
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
      <div className="mt-3 hidden flex-wrap gap-2 lg:flex">
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
          aria-label="Favoris uniquement"
          className="shrink-0"
        >
          <Star size={17} />
        </Button>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtrer"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onChange(defaultExerciseFilters)}>
              Tout effacer
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Voir les résultats
            </Button>
          </div>
        }
      >
        {/* Les mêmes contrôles que le desktop, empilés et pleine largeur :
            un menu déroulant natif de 44 px se manipule au pouce, une rangée
            de menus étroits non. */}
        <div className="space-y-3">
          <Field label="Matière">
            <Select value={filters.subject} onChange={(event) => onChange({ subject: event.target.value as Subject | "Toutes", chapter: "Tous" })}>
              {["Toutes", ...subjects].map((value) => (
                <option key={value}>{value}</option>
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
          <Field label="Sous-thème">
            <Select value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })} disabled={tagOptions.length === 0}>
              <option value="Toutes">Tous</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={filters.status} onChange={(event) => onChange({ status: event.target.value as ExerciseStatus | "Tous" })}>
              {["Tous", ...exerciseStatuses].map((value) => (
                <option key={value}>{value}</option>
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
          <Field label="Maîtrise">
            <Select
              value={filters.mastery}
              onChange={(event) => onChange({ mastery: event.target.value === "Toutes" ? "Toutes" : (Number(event.target.value) as Mastery) })}
            >
              <option value="Toutes">Toutes</option>
              {MASTERY_VALUES.map((value) => (
                <option value={value} key={value}>
                  {value} %
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={filters.type} onChange={(event) => onChange({ type: event.target.value as ExerciseType | "Tous" })}>
              {["Tous", ...exerciseTypes].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          {yearOptions.length > 0 && (
            <Field label="Année">
              <Select value={filters.year} onChange={(event) => onChange({ year: event.target.value === "Toutes" ? "Toutes" : Number(event.target.value) })}>
                <option value="Toutes">Toutes</option>
                {yearOptions.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="flex gap-2 border-t border-hairline/[0.07] pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => { setSheetOpen(false); onImportClick(); }}>
              <Upload size={16} /> Importer
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => { setSheetOpen(false); onAddClick(); }}>
              <Plus size={16} /> Ajouter
            </Button>
          </div>
        </div>
      </Sheet>
    </Card>
  );
}

/** Étiquette + contrôle empilés — la forme lisible d'un réglage sur mobile. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
