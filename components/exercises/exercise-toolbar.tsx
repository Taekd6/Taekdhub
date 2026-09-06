"use client";

import { FileUp, Plus, Search, SlidersHorizontal, Star, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { defaultExerciseFilters, type ExerciseFilters } from "@/lib/exercise-filters";
import { exerciseStatuses, exerciseTypes, masteryLevels, subjects } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, ExerciseStatus, ExerciseType, Mastery, Subject } from "@/lib/supabase/types";

/**
 * BARRE D'OUTILS DE LA BANQUE.
 *
 * L'ancienne barre alignait ONZE sélecteurs natifs en permanence, sur deux
 * rangées, avant le premier exercice : un mur de rectangles vides qui
 * occupait un tiers de l'écran pour un réglage qu'on ne touche presque
 * jamais. Le remplacement suit une règle simple :
 *
 *   TOUJOURS VISIBLE   la recherche (le vrai moyen de retrouver un exercice
 *                      parmi 537), le tri, le compte, et les filtres ACTIFS
 *                      sous forme de puces retirables.
 *   REPLIÉ             tous les sélecteurs, derrière un bouton « Filtres »
 *                      qui affiche le nombre de critères actifs.
 *
 * Le panneau replié est le MÊME sur ordinateur et sur téléphone : un panneau
 * distinct par format, c'est deux comportements à maintenir et deux occasions
 * de diverger.
 */
export function ExerciseToolbar({
  filters,
  onChange,
  onReset,
  chapterOptions,
  tagOptions,
  difficultyOptions,
  competitionOptions,
  yearOptions,
  sortControl,
  onAddClick,
  onImportClick,
  onSheetImportClick,
}: {
  filters: ExerciseFilters;
  onChange: (patch: Partial<ExerciseFilters>) => void;
  onReset: () => void;
  chapterOptions: Chapter[];
  tagOptions: string[];
  difficultyOptions: Difficulty[];
  competitionOptions: string[];
  yearOptions: number[];
  sortControl: React.ReactNode;
  onAddClick: () => void;
  onImportClick: () => void;
  /** Import d'une feuille d'exercices (PDF) — distinct de l'import JSON, qui reste réservé aux fichiers structurés. */
  onSheetImportClick: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  /**
   * Puces des filtres actifs — la seule façon honnête de répondre à
   * « pourquoi je ne vois que 12 exercices ? ». Chacune se retire d'un clic
   * en remettant le champ à sa valeur par défaut, sans toucher aux autres.
   */
  const chips = useMemo(() => {
    const list: { key: keyof ExerciseFilters; label: string }[] = [];
    // La recherche EST un filtre : elle réduit la liste exactement comme les
    // autres, mais elle était la seule à ne pas apparaître ici. On pouvait
    // donc défiler, ne plus voir le champ, et ne pas comprendre pourquoi le
    // chapitre ouvert ne montrait que trois exercices.
    if (filters.query.trim()) list.push({ key: "query", label: `« ${filters.query.trim()} »` });
    if (filters.subject !== "Toutes") list.push({ key: "subject", label: filters.subject });
    if (filters.chapter !== "Tous") {
      const chapter = chapterOptions.find((entry) => entry.id === filters.chapter);
      if (chapter) list.push({ key: "chapter", label: chapter.label });
    }
    if (filters.tag !== "Toutes") list.push({ key: "tag", label: filters.tag });
    if (filters.origin !== "Toutes") list.push({ key: "origin", label: filters.origin });
    if (filters.competition !== "Tous") list.push({ key: "competition", label: filters.competition });
    if (filters.year !== "Toutes") list.push({ key: "year", label: String(filters.year) });
    if (filters.type !== "Tous") list.push({ key: "type", label: filters.type });
    if (filters.status !== "Tous") list.push({ key: "status", label: filters.status });
    if (filters.difficulty !== "Toutes") list.push({ key: "difficulty", label: `Difficulté ${filters.difficulty}` });
    if (filters.mastery !== "Toutes") list.push({ key: "mastery", label: `Maîtrise ${filters.mastery} %` });
    if (filters.favoritesOnly) list.push({ key: "favoritesOnly", label: "Favoris" });
    return list;
  }, [filters, chapterOptions]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pleine largeur sous `sm`. Sur la même rangée que cinq contrôles,
            à 390 px, le champ de recherche tombait à une soixantaine de
            pixels — un carré avec une loupe dedans, dans lequel on ne pouvait
            plus rien lire de ce qu'on tapait. C'est pourtant LE moyen de
            retrouver un exercice parmi 537. */}
        <label className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:basis-[18rem]">
          <span className="sr-only">Rechercher un exercice</span>
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            id="exercise-search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Rechercher un titre, une source, un concours…"
            className="pl-9"
          />
        </label>

        <Button
          variant={panelOpen || chips.length > 0 ? "secondary" : "ghost"}
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
        >
          <SlidersHorizontal size={15} /> Filtres
          {chips.length > 0 && (
            <span className="tabular ml-0.5 rounded-full bg-accent/15 px-1.5 text-2xs text-accent">{chips.length}</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={filters.favoritesOnly ? "Afficher tous les exercices" : "N'afficher que les favoris"}
          aria-pressed={filters.favoritesOnly}
          onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          className={cn(filters.favoritesOnly && "bg-inset text-accent")}
        >
          <Star size={16} fill={filters.favoritesOnly ? "currentColor" : "none"} />
        </Button>

        <span className="hidden sm:block" aria-hidden>
          <span className="block h-6 w-px bg-line" />
        </span>

        {/* Le libellé disparaît sous `sm`, faute de place. Sans `aria-label`,
            ces boutons n'ont alors PLUS AUCUN NOM : un lecteur d'écran, comme
            la navigation au clavier, n'annonce qu'« bouton ». Le nom est donc
            porté par l'attribut, à toutes les tailles. */}
        <Button variant="ghost" aria-label="Importer une feuille d'exercices (PDF)" onClick={onSheetImportClick}>
          <FileUp size={15} /> <span className="hidden sm:inline">Feuille PDF</span>
        </Button>
        <Button variant="ghost" aria-label="Importer un fichier JSON d'exercices" onClick={onImportClick}>
          <Upload size={15} /> <span className="hidden sm:inline">JSON</span>
        </Button>
        <Button variant="secondary" onClick={onAddClick}>
          <Plus size={15} /> Ajouter
        </Button>
      </div>

      {/* MÊME CONTENU, DEUX PRÉSENTATIONS.
          Sur grand écran, un panneau qui se déplie sous la barre. Sur
          téléphone, une feuille qui monte du bas : dix sélecteurs empilés
          dans le flux repoussaient le premier exercice hors de l'écran —
          c'était le mur de filtres, simplement déplacé. Les champs eux-mêmes
          ne sont écrits qu'une fois. */}
      {panelOpen && (
        <div className="animate-fade-in hidden gap-3 rounded-lg border border-line bg-inset p-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Matière">
            <Select value={filters.subject} onChange={(e) => onChange({ subject: e.target.value as Subject | "Toutes" })}>
              <option value="Toutes">Toutes les matières</option>
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </Select>
          </Field>

          <Field label="Chapitre">
            <Select value={filters.chapter} onChange={(e) => onChange({ chapter: e.target.value })}>
              <option value="Tous">Tous les chapitres</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sous-thème">
            <Select value={filters.tag} onChange={(e) => onChange({ tag: e.target.value })}>
              <option value="Toutes">Tous les sous-thèmes</option>
              {tagOptions.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </Select>
          </Field>

          <Field label="Origine">
            <Select
              value={filters.origin}
              onChange={(e) => onChange({ origin: e.target.value as ExerciseFilters["origin"] })}
            >
              <option value="Toutes">Toutes origines</option>
              <option value="Concours">Concours</option>
              <option value="Enseignant">Enseignant</option>
              <option value="TaekdHub">TaekdHub</option>
            </Select>
          </Field>

          <Field label="Concours">
            <Select value={filters.competition} onChange={(e) => onChange({ competition: e.target.value })}>
              <option value="Tous">Tous les concours</option>
              {competitionOptions.map((competition) => (
                <option key={competition}>{competition}</option>
              ))}
            </Select>
          </Field>

          <Field label="Année">
            <Select
              value={String(filters.year)}
              onChange={(e) => onChange({ year: e.target.value === "Toutes" ? "Toutes" : Number(e.target.value) })}
            >
              <option value="Toutes">Toutes les années</option>
              {yearOptions.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </Select>
          </Field>

          <Field label="Type">
            <Select value={filters.type} onChange={(e) => onChange({ type: e.target.value as ExerciseType | "Tous" })}>
              <option value="Tous">Tous les types</option>
              {exerciseTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>

          <Field label="Statut">
            <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value as ExerciseStatus | "Tous" })}>
              <option value="Tous">Tous les statuts</option>
              {exerciseStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
          </Field>

          <Field label="Difficulté">
            <Select
              value={String(filters.difficulty)}
              onChange={(e) =>
                onChange({ difficulty: e.target.value === "Toutes" ? "Toutes" : (Number(e.target.value) as Difficulty) })
              }
            >
              <option value="Toutes">Toutes difficultés</option>
              {difficultyOptions.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty} / 5
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Maîtrise">
            <Select
              value={String(filters.mastery)}
              onChange={(e) =>
                onChange({ mastery: e.target.value === "Toutes" ? "Toutes" : (Number(e.target.value) as Mastery) })
              }
            >
              <option value="Toutes">Toutes maîtrises</option>
              {masteryLevels.map((level) => (
                <option key={level} value={level}>
                  {level} %
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <Button variant="ghost" size="sm" onClick={onReset} disabled={chips.length === 0 && !filters.query}>
              Tout réinitialiser
            </Button>
          </div>
        </div>
      )}

      <Sheet open={panelOpen} onClose={() => setPanelOpen(false)} title="Filtrer la banque">
        <div className="grid gap-4">
          <Field label="Matière">
            <Select value={filters.subject} onChange={(e) => onChange({ subject: e.target.value as Subject | "Toutes" })}>
              <option value="Toutes">Toutes les matières</option>
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </Select>
          </Field>

          <Field label="Chapitre">
            <Select value={filters.chapter} onChange={(e) => onChange({ chapter: e.target.value })}>
              <option value="Tous">Tous les chapitres</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sous-thème">
            <Select value={filters.tag} onChange={(e) => onChange({ tag: e.target.value })}>
              <option value="Toutes">Tous les sous-thèmes</option>
              {tagOptions.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </Select>
          </Field>

          <Field label="Origine">
            <Select
              value={filters.origin}
              onChange={(e) => onChange({ origin: e.target.value as ExerciseFilters["origin"] })}
            >
              <option value="Toutes">Toutes origines</option>
              <option value="Concours">Concours</option>
              <option value="Enseignant">Enseignant</option>
              <option value="TaekdHub">TaekdHub</option>
            </Select>
          </Field>

          <Field label="Concours">
            <Select value={filters.competition} onChange={(e) => onChange({ competition: e.target.value })}>
              <option value="Tous">Tous les concours</option>
              {competitionOptions.map((competition) => (
                <option key={competition}>{competition}</option>
              ))}
            </Select>
          </Field>

          <Field label="Année">
            <Select
              value={String(filters.year)}
              onChange={(e) => onChange({ year: e.target.value === "Toutes" ? "Toutes" : Number(e.target.value) })}
            >
              <option value="Toutes">Toutes les années</option>
              {yearOptions.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </Select>
          </Field>

          <Field label="Type">
            <Select value={filters.type} onChange={(e) => onChange({ type: e.target.value as ExerciseType | "Tous" })}>
              <option value="Tous">Tous les types</option>
              {exerciseTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>

          <Field label="Statut">
            <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value as ExerciseStatus | "Tous" })}>
              <option value="Tous">Tous les statuts</option>
              {exerciseStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
          </Field>

          <Field label="Difficulté">
            <Select
              value={String(filters.difficulty)}
              onChange={(e) =>
                onChange({ difficulty: e.target.value === "Toutes" ? "Toutes" : (Number(e.target.value) as Difficulty) })
              }
            >
              <option value="Toutes">Toutes difficultés</option>
              {difficultyOptions.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty} / 5
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Maîtrise">
            <Select
              value={String(filters.mastery)}
              onChange={(e) =>
                onChange({ mastery: e.target.value === "Toutes" ? "Toutes" : (Number(e.target.value) as Mastery) })
              }
            >
              <option value="Toutes">Toutes maîtrises</option>
              {masteryLevels.map((level) => (
                <option key={level} value={level}>
                  {level} %
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <Button variant="ghost" size="sm" onClick={onReset} disabled={chips.length === 0 && !filters.query}>
              Tout réinitialiser
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Le compte des résultats vit dans le bandeau de l'écran (`PageBar`) :
          l'afficher ici aussi le donnait deux fois à 40 px d'écart. Ne reste
          que ce qui n'est nulle part ailleurs — les filtres actifs. */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={String(chip.key)}
            type="button"
            onClick={() => onChange({ [chip.key]: defaultExerciseFilters[chip.key] } as Partial<ExerciseFilters>)}
            // 44 px au doigt : mesurées à 36 px, ces puces étaient sous le
            // seuil tactile alors qu'elles portent l'action la plus fréquente
            // de l'écran après la recherche — retirer un filtre.
            className="row-hover inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-2xs text-muted max-lg:min-h-11"
          >
            {chip.label}
            <X size={11} aria-hidden />
            <span className="sr-only">Retirer le filtre {chip.label}</span>
          </button>
        ))}

        <div className="ml-auto">{sortControl}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="t-label mb-1 block">{label}</span>
      {children}
    </label>
  );
}
