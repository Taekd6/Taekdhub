"use client";

import { Archive, ArrowLeft, BookOpenCheck, LayoutGrid, List } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { findPersistedSessionSuffix } from "@/hooks/use-work-timer";
import { ArchivedExercises } from "@/components/exercises/archived-exercises";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { ExerciseBrowser } from "@/components/exercises/exercise-browser";
import { ExerciseFiltersBar } from "@/components/exercises/exercise-filters-bar";
import { ExerciseForm, type NewExerciseInput } from "@/components/exercises/exercise-form";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { ExerciseImport } from "@/components/exercises/exercise-import";
import { ExerciseListRow } from "@/components/exercises/exercise-list-row";
import { ExerciseReviewPanel } from "@/components/exercises/exercise-review-panel";
import { FOCUS_TIMER_PREFIX, FocusView } from "@/components/exercises/focus-view";
import { addChapter, removeChapter, renameChapter } from "@/lib/chapters";
import { chapterOptionsForSubject, defaultExerciseFilters, distinctYears, filterExercises, type ExerciseFilters } from "@/lib/exercise-filters";
import { defaultExerciseSort, exerciseSortOptions, sortExercises, type ExerciseSort } from "@/lib/exercise-sort";
import { createExerciseFromInput } from "@/lib/exercise-import";
import { minutesByExerciseMap } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Exercise, Subject } from "@/lib/supabase/types";

type ViewMode = "cards" | "list";

export function ExerciseManager() {
  const { exercises, saveExercises, sessions, saveSessions, chapters, saveChapters, ready } = usePrepahubData();
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  // Vrai tant que l'utilisateur parcourt la hiérarchie Matière → Chapitre
  // (ExerciseBrowser) sans avoir encore demandé de résultats précis : la
  // liste plate reste masquée pour ne pas reproduire, à l'échelle d'une
  // matière, le problème qu'elle est censée résoudre (des dizaines
  // d'exercices d'un coup avant même d'avoir choisi un chapitre). Passe à
  // `false` dès qu'un chapitre est choisi, qu'un filtre de la barre est
  // utilisé, ou qu'on saute vers un exercice précis (ex. depuis "À revoir").
  const [browseMode, setBrowseMode] = useState(true);
  const [sort, setSort] = useState<ExerciseSort>(defaultExerciseSort);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const resumeChecked = useRef(false);

  const updateFilters = useCallback((patch: Partial<ExerciseFilters>) => setFilters((prev) => ({ ...prev, ...patch })), []);

  // Reprend automatiquement une séance focus interrompue par un rechargement
  // de page (ex. F5 pendant un focus) : la clé sessionStorage laissée par
  // useWorkTimer encode l'exercice concerné.
  useEffect(() => {
    if (!ready || resumeChecked.current) return;
    resumeChecked.current = true;
    const pendingExerciseId = findPersistedSessionSuffix(FOCUS_TIMER_PREFIX);
    if (pendingExerciseId && exercises.some((item) => item.id === pendingExerciseId && !item.archived)) {
      setSelectedId(pendingExerciseId);
      setFocusMode(true);
    }
  }, [ready, exercises]);

  // `exercisesRef` permet à `update` de lire la liste à jour sans dépendre de
  // `exercises` dans ses propres dépendances : son identité reste stable
  // d'un rendu à l'autre. Sur une banque de centaines d'exercices, c'est ce
  // qui permet à React.memo (ExerciseCard / ExerciseListRow) d'éviter de
  // re-rendre toutes les cartes à chaque modification d'une seule d'entre elles.
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  // Même pattern pour `chapters` (voir `exercisesRef` ci-dessus) — nécessaire
  // depuis l'import en masse (Sprint infrastructure banque concours) : créer
  // plusieurs chapitres dans la même boucle synchrone (un appel à
  // `handleCreateChapter` par chapitre manquant) verrait, sans ce ref, chaque
  // appel lire le même `chapters` figé au rendu précédent — chaque
  // `saveChapters` écraserait alors le précédent au lieu de s'accumuler, ne
  // laissant survivre que le dernier chapitre créé.
  const chaptersRef = useRef(chapters);
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  // `updated_at` est maintenu automatiquement ici, pour toute modification,
  // plutôt que d'être géré au cas par cas par chaque appelant.
  //
  // `exercisesRef.current` est aussi réassigné ICI, de façon synchrone, et
  // pas seulement via l'effet ci-dessus : deux appels à `update` déclenchés
  // dans le même tick (ex. deux clics rapprochés sur des sélecteurs
  // différents, comme priorité puis maîtrise) doivent chacun voir le
  // résultat du précédent. Sans cette ligne, le second appel lirait encore
  // l'ancienne valeur de `exercisesRef.current` (l'effet ne s'exécute qu'au
  // rendu suivant) et écraserait silencieusement la première modification.
  const update = useCallback(
    (id: string, patch: Partial<Exercise>) => {
      const updatedAt = new Date().toISOString();
      const next = exercisesRef.current.map((item) => (item.id === id ? { ...item, ...patch, updated_at: updatedAt } : item));
      exercisesRef.current = next;
      saveExercises(next);
    },
    [saveExercises]
  );

  // Callbacks à identité stable (jamais recréés) — condition pour que le
  // memo des cartes/rangées serve vraiment à quelque chose.
  const toggleSelected = useCallback((id: string) => setSelectedId((prev) => (prev === id ? null : id)), []);
  const enterFocus = useCallback((id: string) => {
    setSelectedId(id);
    setFocusMode(true);
  }, []);
  const archiveExercise = useCallback((id: string) => update(id, { archived: true }), [update]);
  // Symétrique d'archiveExercise (Sprint 3H) — même `update`, ne touche à
  // rien d'autre que `archived` (+ `updated_at`, géré par `update` lui-même).
  const restoreExercise = useCallback((id: string) => update(id, { archived: false }), [update]);
  const archivedExercises = useMemo(
    () => [...exercises].filter((item) => item.archived).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [exercises]
  );

  // Chapitres (Sprint 3D) — mêmes conventions que `update` : fonctions pures
  // (lib/chapters.ts) combinées ici avec la persistance. `handleRemoveChapter`
  // lit `exercisesRef.current` (pas `exercises`) pour rester sur le chemin
  // stable du memo des cartes, comme `update`/`archiveExercise` ci-dessus.
  const handleCreateChapter = useCallback(
    (subject: Subject, label: string) => {
      const { chapters: next, chapter } = addChapter(chaptersRef.current, subject, label);
      chaptersRef.current = next;
      saveChapters(next);
      return chapter;
    },
    [saveChapters]
  );
  const handleRenameChapter = useCallback(
    (id: string, label: string) => {
      const next = renameChapter(chaptersRef.current, id, label);
      chaptersRef.current = next;
      saveChapters(next);
    },
    [saveChapters]
  );
  // Ne supprime jamais un exercice : seuls les `chapter_id` qui pointaient
  // vers ce chapitre sont réinitialisés à `null` (exercice réassigné à
  // "Sans chapitre", jamais perdu).
  const handleRemoveChapter = useCallback(
    (id: string) => {
      const nextChapters = removeChapter(chaptersRef.current, id);
      chaptersRef.current = nextChapters;
      saveChapters(nextChapters);
      const updatedAt = new Date().toISOString();
      const next = exercisesRef.current.map((item) => (item.chapter_id === id ? { ...item, chapter_id: null, updated_at: updatedAt } : item));
      exercisesRef.current = next;
      saveExercises(next);
    },
    [saveChapters, saveExercises]
  );

  // Depuis le tableau "À revoir" : on réinitialise les filtres (l'exercice
  // visé pourrait être masqué par le filtrage courant), on le sélectionne,
  // puis on l'amène à l'écran — sans quoi le clic n'aurait visiblement aucun
  // effet si l'exercice n'était pas déjà dans la liste affichée.
  const jumpToExercise = useCallback((id: string) => {
    setFilters(defaultExerciseFilters);
    // Quitte le mode navigation (voir sa définition plus haut) : sans ça, la
    // liste plate resterait masquée au profit de la grille de matières et le
    // clic depuis "À revoir" n'amènerait visiblement rien à l'écran.
    setBrowseMode(false);
    setSelectedId(id);
    requestAnimationFrame(() => {
      document.getElementById(`exercise-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  // Même geste que `jumpToExercise`, mais déclenché depuis une autre page
  // (ex. le tableau "À revoir" du Dashboard) via `?focus=<id>` dans l'URL —
  // voir `FocusQueryHandler` plus bas. On vérifie que l'exercice existe
  // encore avant de sauter dessus (il a pu être archivé entre-temps).
  //
  // Dépend de `exercises` directement (pas `exercisesRef`) : ce callback
  // n'est pas sur le chemin chaud du rendu des cartes (pas besoin d'identité
  // stable pour React.memo) et, juste après le chargement des données, l'effet
  // d'un composant enfant (FocusQueryHandler) peut s'exécuter avant que
  // `exercisesRef` n'ait été resynchronisé par l'effet du parent — lire
  // `exercises` évite cette course.
  const jumpToExerciseFromQuery = useCallback(
    (id: string) => {
      if (exercises.some((item) => item.id === id && !item.archived)) jumpToExercise(id);
    },
    [exercises, jumpToExercise]
  );

  const create = useCallback(
    (input: NewExerciseInput) => {
      const exercise = createExerciseFromInput(input);
      const next = [exercise, ...exercisesRef.current];
      exercisesRef.current = next;
      saveExercises(next);
      setFormOpen(false);
      setSelectedId(exercise.id);
    },
    [saveExercises]
  );

  // Import en masse (Sprint infrastructure banque) — mêmes exercices que
  // `create` (même constructeur `createExerciseFromInput`), en une seule
  // écriture pour toute la sélection plutôt qu'un appel par exercice.
  const importExercises = useCallback(
    (inputs: NewExerciseInput[]) => {
      const created = inputs.map(createExerciseFromInput);
      const next = [...created, ...exercisesRef.current];
      exercisesRef.current = next;
      saveExercises(next);
      setImportOpen(false);
    },
    [saveExercises]
  );

  const chapterOptions = useMemo(() => chapterOptionsForSubject(chapters, filters.subject), [chapters, filters.subject]);
  const yearOptions = useMemo(() => distinctYears(exercises), [exercises]);

  // Un chapitre filtré peut devenir invalide si on change de matière : on le
  // réinitialise plutôt que de laisser un filtre "impossible" masquer
  // silencieusement toute la liste.
  useEffect(() => {
    if (filters.chapter !== "Tous" && !chapterOptions.some((chapter) => chapter.id === filters.chapter)) {
      updateFilters({ chapter: "Tous" });
    }
  }, [chapterOptions, filters.chapter, updateFilters]);

  // Un seul passage sur `sessions` pour calculer le temps passé de TOUS les
  // exercices (voir lib/study.ts) — recalculé uniquement quand `sessions`
  // change, jamais par exercice ni à chaque rendu.
  const minutesMap = useMemo(() => minutesByExerciseMap(sessions), [sessions]);
  const visible = useMemo(() => filterExercises(exercises, filters), [exercises, filters]);
  const sorted = useMemo(() => sortExercises(visible, sort, minutesMap), [visible, sort, minutesMap]);

  // Callbacks dédiés d'ExerciseBrowser (Matière → Chapitre) : choisir une
  // matière ou remonter garde le mode navigation actif (on reste dans la
  // hiérarchie) ; choisir un chapitre en sort (ses exercices s'affichent en
  // liste normale, juste en dessous). `filters` reste l'unique source de
  // vérité du "où en est-on" — ces callbacks ne font que l'écrire.
  const goHome = useCallback(() => {
    setFilters(defaultExerciseFilters);
    setBrowseMode(true);
  }, []);
  const selectSubject = useCallback((subject: Subject) => {
    setFilters((prev) => ({ ...prev, subject, chapter: "Tous" }));
    setBrowseMode(true);
  }, []);
  const goToChapters = useCallback(() => {
    setFilters((prev) => ({ ...prev, chapter: "Tous" }));
    setBrowseMode(true);
  }, []);
  const selectChapter = useCallback((chapterId: string) => {
    setFilters((prev) => ({ ...prev, chapter: chapterId }));
    setBrowseMode(false);
  }, []);

  // Toute interaction directe avec la barre de filtres (recherche, un des
  // sélecteurs) exprime une intention explicite de voir des résultats — sort
  // du mode navigation, quel que soit le champ modifié.
  const updateFiltersFromBar = useCallback(
    (patch: Partial<ExerciseFilters>) => {
      setBrowseMode(false);
      updateFilters(patch);
    },
    [updateFilters]
  );

  const selected = exercises.find((item) => item.id === selectedId);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (focusMode) setFocusMode(false);
        else if (importOpen) setImportOpen(false);
        else if (formOpen) setFormOpen(false);
        else if (selectedId) setSelectedId(null);
        else if (showArchived) setShowArchived(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        document.getElementById("exercise-search")?.focus();
      }
      if (event.key === "n" && !event.metaKey && !event.ctrlKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        setFormOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, formOpen, importOpen, selectedId, showArchived]);

  if (focusMode && selected) {
    return (
      <FocusView
        item={selected}
        update={update}
        sessions={sessions}
        saveSessions={saveSessions}
        onClose={() => setFocusMode(false)}
      />
    );
  }

  if (showArchived) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(false)}>
            <ArrowLeft size={15} /> Retour aux exercices
          </Button>
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-200">{archivedExercises.length}</span> exercice
            {archivedExercises.length > 1 ? "s" : ""} archivé{archivedExercises.length > 1 ? "s" : ""}
          </p>
        </div>
        <ArchivedExercises exercises={archivedExercises} onRestore={restoreExercise} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* `useSearchParams` exige une limite Suspense — isolée ici pour ne pas
          faire basculer toute la page en rendu dynamique. */}
      <Suspense fallback={null}>
        <FocusQueryHandler ready={ready} onFocus={jumpToExerciseFromQuery} />
      </Suspense>

      <ExerciseBankStats exercises={exercises} sessions={sessions} />

      <ExerciseReviewPanel exercises={exercises} sessions={sessions} onSelect={jumpToExercise} />

      <ExerciseBrowser
        exercises={exercises}
        chapters={chapters}
        filters={filters}
        onGoHome={goHome}
        onSelectSubject={selectSubject}
        onGoToChapters={goToChapters}
        onSelectChapter={selectChapter}
      />

      <ExerciseFiltersBar
        filters={filters}
        onChange={updateFiltersFromBar}
        chapterOptions={chapterOptions}
        yearOptions={yearOptions}
        onAddClick={() => setFormOpen((value) => !value)}
        onImportClick={() => setImportOpen((value) => !value)}
      />

      <ExerciseForm open={formOpen} chapters={chapters} onSubmit={create} onCancel={() => setFormOpen(false)} onCreateChapter={handleCreateChapter} />

      <ExerciseImport
        open={importOpen}
        chapters={chapters}
        onCommit={importExercises}
        onCreateChapter={handleCreateChapter}
        onCancel={() => setImportOpen(false)}
      />

      <div className="flex justify-end px-1">
        <Button variant="ghost" size="sm" onClick={() => setShowArchived(true)}>
          <Archive size={15} /> Archivés{archivedExercises.length > 0 && ` (${archivedExercises.length})`}
        </Button>
      </div>

      {!browseMode && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-zinc-500">
              <span className="font-semibold text-zinc-200">{sorted.length}</span> exercice{sorted.length > 1 ? "s" : ""} affiché{sorted.length > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Select value={sort} onChange={(event) => setSort(event.target.value as ExerciseSort)} className="w-auto min-w-[150px] py-2 text-xs">
                {exerciseSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-1 rounded-xl border border-hairline/[0.09] bg-black/20 p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  aria-label="Vue cartes"
                  aria-pressed={viewMode === "cards"}
                  className={cn("rounded-lg p-1.5 transition", viewMode === "cards" ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  aria-label="Vue liste compacte"
                  aria-pressed={viewMode === "list"}
                  className={cn("rounded-lg p-1.5 transition", viewMode === "list" ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300")}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
            <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">⌘K recherche · N nouvel exercice · Esc fermer</span>
          </div>

          <div className={viewMode === "cards" ? "grid gap-3" : "grid gap-2"}>
            {sorted.map((item, index) =>
              viewMode === "cards" ? (
                <ExerciseCard
                  key={item.id}
                  item={item}
                  index={index}
                  selected={selectedId === item.id}
                  minutesSpent={minutesMap.get(item.id) ?? 0}
                  chapters={chapters}
                  sessions={sessions}
                  onToggle={toggleSelected}
                  onUpdate={update}
                  onFocus={enterFocus}
                  onArchive={archiveExercise}
                  onCreateChapter={handleCreateChapter}
                  onRenameChapter={handleRenameChapter}
                  onRemoveChapter={handleRemoveChapter}
                />
              ) : (
                <ExerciseListRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  minutesSpent={minutesMap.get(item.id) ?? 0}
                  chapters={chapters}
                  sessions={sessions}
                  onToggle={toggleSelected}
                  onUpdate={update}
                  onFocus={enterFocus}
                  onArchive={archiveExercise}
                  onCreateChapter={handleCreateChapter}
                  onRenameChapter={handleRenameChapter}
                  onRemoveChapter={handleRemoveChapter}
                />
              )
            )}
            {sorted.length === 0 && (
              <Card className="px-6 py-16 text-center">
                <BookOpenCheck className="mx-auto text-accent" />
                <p className="mt-4 font-semibold">Aucun exercice ne correspond.</p>
                <p className="mt-1 text-sm text-zinc-500">Ajuste les filtres ou ajoute une nouvelle fiche.</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Lit `?focus=<id>` dans l'URL (ex. lien "À revoir" du Dashboard), déclenche
 * `onFocus` une seule fois, puis nettoie l'URL. Isolé dans son propre
 * composant car `useSearchParams` impose une limite Suspense — inutile de
 * l'imposer à tout `ExerciseManager`.
 */
function FocusQueryHandler({ ready, onFocus }: { ready: boolean; onFocus: (id: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current) return;
    const focusId = searchParams.get("focus");
    if (!focusId) return;
    handled.current = true;
    onFocus(focusId);
    router.replace("/exercises", { scroll: false });
  }, [ready, searchParams, onFocus, router]);

  return null;
}
