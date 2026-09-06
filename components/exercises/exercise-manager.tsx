"use client";

import { Archive, ChevronLeft, Search, Undo2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageBar, Workbench } from "@/components/ui/layout";
import { Select } from "@/components/ui/input";
import { EmptyState, Notice, Skeleton } from "@/components/ui/state";
import { MathInline } from "@/components/rich-math";
import { readerNavigation } from "@/lib/reader-navigation";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { findPersistedSessionSuffix } from "@/hooks/use-work-timer";
import { ArchivedExercises } from "@/components/exercises/archived-exercises";
import { BankNavigator } from "@/components/exercises/bank-navigator";
import { ExerciseToolbar } from "@/components/exercises/exercise-toolbar";
import { ExerciseForm, type NewExerciseInput } from "@/components/exercises/exercise-form";
import { ExerciseImport } from "@/components/exercises/exercise-import";
import { SheetImport } from "@/components/exercises/sheet-import";
import { ExerciseRow } from "@/components/exercises/exercise-row";
import { FOCUS_TIMER_PREFIX, FocusView } from "@/components/exercises/focus-view";
import { addChapter, removeChapter, renameChapter } from "@/lib/chapters";
import { chapterOptionsForSubject, competitionOptionsForFilters, defaultExerciseFilters, difficultyOptionsForFilters, distinctYears, filterExercises, filtersForScope, tagOptionsForFilters, type ExerciseFilters } from "@/lib/exercise-filters";
import { defaultExerciseSort, exerciseSortOptions, sortExercises, type ExerciseSort } from "@/lib/exercise-sort";
import { createExerciseFromInput } from "@/lib/exercise-import";
import { SessionBuilderBar } from "@/components/exercises/session-builder-bar";
import { recommendExercises } from "@/lib/recommendation";
import { minutesByExerciseMap, subjects } from "@/lib/study";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * Nombre d'exercices rendus d'un coup.
 *
 * Il n'y en avait AUCUN : la liste rendait tout ce que le filtre laissait
 * passer. Ouvrir un exercice depuis le tableau de bord réinitialisait les
 * filtres, et la page montait alors à 534 rangées — mesuré à 80 000 pixels de
 * haut, avec l'animation d'entrée de chaque carte par-dessus. C'est le défaut
 * le plus coûteux trouvé pendant la refonte.
 *
 * 40 couvre largement un chapitre entier (le plus gros en compte 37) : dans
 * l'usage normal, le bouton « Afficher plus » n'apparaît même pas.
 */
const PAGE_SIZE = 40;

export function ExerciseManager() {
  const { exercises, saveExercises, sessions, saveSessions, chapters, saveChapters, ready } = usePrepahubData();
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const [sort, setSort] = useState<ExerciseSort>(defaultExerciseSort);
  // Combien de rangées sont réellement rendues — remis à `PAGE_SIZE` dès que
  // le résultat change (nouveau filtre, nouvelle recherche) : garder une
  // pagination étendue après un changement de filtre afficherait 200 rangées
  // d'un coup sans que personne ne l'ait demandé.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  /*
   * DEUX états distincts, qui n'en formaient qu'un.
   *
   * `selectedId` désignait à la fois l'exercice OUVERT EN LECTURE et la
   * rangée dont la FICHE est dépliée. Conséquence : en refermant le lecteur,
   * on retrouvait la liste avec la fiche complète de l'exercice grande
   * ouverte sous sa ligne — mesuré, elle ajoutait un millier de pixels, ce
   * qui décalait tout le reste et faisait échouer la restauration de la
   * position. On vient de LIRE cet exercice ; on n'a aucune raison de vouloir
   * en éditer la fiche dans la foulée.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  /** Exercice qu'on vient de lire — la rangée à mettre en évidence au retour. */
  const lastReadId = useRef<string | null>(null);
  /*
   * POSITION DE DÉFILEMENT DE LA LISTE, mise de côté pendant la lecture.
   *
   * Le lecteur remplace la liste : pendant la lecture, la page perd sa
   * hauteur et le navigateur remet le défilement à zéro. Mesuré : en ouvrant
   * un exercice depuis 1 200 px, on revenait à 0 — donc re-défiler et
   * re-chercher sa ligne APRÈS CHAQUE exercice, le geste le plus répété
   * d'une séance de travail.
   *
   * Laisser la liste montée SOUS le lecteur a été essayé : le défilement est
   * alors préservé nativement, mais une couche plein écran par-dessus une
   * page longue fait planter le moteur de rendu de Chromium dès quelques
   * centaines de pixels de défilement (reproduit à 390 px de large, à partir
   * de ~800 px ; pas de plantage à 400). On restaure donc explicitement.
   */
  const listScroll = useRef(0);
  /*
   * ORDRE FIGÉ À L'OUVERTURE DU LECTEUR.
   *
   * « Précédent » et « suivant » doivent désigner ce que l'élève A VU dans la
   * liste. Or le tri par défaut est « Recommandé » : dès qu'un résultat est
   * déclaré, le moteur reclasse, l'exercice courant change de place, et
   * « suivant » pointait alors sur un exercice arbitraire — voire sur rien du
   * tout quand l'exercice venait de tomber en dernière position, laissant un
   * bouton mort. On navigue donc dans l'ordre tel qu'il était au moment
   * d'ouvrir, pas dans un classement qui bouge sous les pieds.
   */
  const readerOrder = useRef<string[]>([]);
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
      setReaderId(pendingExerciseId);
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
  /** Déplie/replie la FICHE d'un exercice (réglages, notes, séances) — jamais l'ouverture du lecteur, qui passe par `openReader`. */
  const toggleDetail = useCallback((id: string) => setSelectedId((prev) => (prev === id ? null : id)), []);
  const openReader = useCallback((id: string) => {
    lastReadId.current = id;
    // La position de la liste est relevée ICI, à l'instant du clic : c'est la
    // seule occasion de la connaître avant que le lecteur ne remplace la
    // liste et ne fasse retomber le défilement à zéro.
    listScroll.current = typeof window === "undefined" ? 0 : window.scrollY;
    readerOrder.current = sortedRef.current.map((item) => item.id);
    setReaderId(id);
    setFocusMode(true);
  }, []);
  /*
   * ARCHIVER, avec de quoi revenir en arrière.
   *
   * Le bouton d'archivage est à deux centimètres du bouton qui ouvre
   * l'exercice, sur chaque ligne. Un archivage par mégarde faisait
   * DISPARAÎTRE l'exercice de la liste sans un mot : ni confirmation, ni
   * trace, ni moyen d'annuler autrement que d'aller ouvrir l'écran
   * « Archivés » et d'y retrouver la fiche. Pour une action qu'on déclenche
   * surtout par erreur, c'est le pire des rapports.
   *
   * On ne demande PAS de confirmation avant (une boîte de dialogue à chaque
   * archivage volontaire serait pire) : on annonce ce qui vient d'être fait
   * et on laisse annuler.
   */
  const [lastArchived, setLastArchived] = useState<{ id: string; title: string } | null>(null);

  const archiveExercise = useCallback(
    (id: string) => {
      const exercise = exercisesRef.current.find((item) => item.id === id);
      update(id, { archived: true });
      if (exercise) setLastArchived({ id, title: exercise.title });
    },
    [update]
  );

  // L'annonce s'efface d'elle-même : elle informe, elle ne réclame rien.
  useEffect(() => {
    if (!lastArchived) return;
    const timeout = setTimeout(() => setLastArchived(null), 9000);
    return () => clearTimeout(timeout);
  }, [lastArchived]);

  const undoArchive = useCallback(() => {
    setLastArchived((current) => {
      if (current) update(current.id, { archived: false });
      return null;
    });
  }, [update]);
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

  /**
   * Depuis « À revoir » ou depuis un autre écran : on OUVRE L'EXERCICE.
   *
   * Le comportement précédent était différent et coûteux : réinitialiser tous
   * les filtres, quitter le mode navigation, puis faire défiler jusqu'à la
   * rangée correspondante. Cliquer un exercice recommandé affichait donc la
   * banque ENTIÈRE (534 rangées) pour en surligner une seule — et l'élève
   * devait encore cliquer pour se mettre au travail. Ouvrir directement le
   * lecteur répond à l'intention réelle du clic, et supprime au passage le
   * rendu géant.
   */
  const jumpToExercise = useCallback((id: string) => {
    lastReadId.current = id;
    listScroll.current = typeof window === "undefined" ? 0 : window.scrollY;
    // Entrée depuis un autre écran : l'ordre visible est celui de la banque
    // telle qu'elle est filtrée à cet instant.
    readerOrder.current = sortedRef.current.map((item) => item.id);
    setReaderId(id);
    setFocusMode(true);
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

  /** Entrée depuis l'écran Concours : on montre immédiatement les exercices de cette banque, sans repasser par le parcours matière → chapitre. */
  const filterByCompetition = useCallback((competition: string) => {
    setFilters({ ...defaultExerciseFilters, competition });
  }, []);

  /** Entrée depuis le tableau « Chapitre par chapitre » (Progression) : le chapitre s'ouvre directement, la matière étant déduite du chapitre lui-même. */
  const openChapter = useCallback(
    (chapterId: string) => {
      const chapter = chaptersRef.current.find((entry) => entry.id === chapterId);
      if (!chapter) return;
      setFilters({ ...defaultExerciseFilters, subject: chapter.subject, chapter: chapterId });
    },
    []
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
      setSheetOpen(false);
    },
    [saveExercises]
  );

  const chapterOptions = useMemo(() => chapterOptionsForSubject(chapters, filters.subject), [chapters, filters.subject]);
  const tagOptions = useMemo(
    () => tagOptionsForFilters(exercises, { subject: filters.subject, chapter: filters.chapter }),
    [exercises, filters.subject, filters.chapter]
  );
  const difficultyOptions = useMemo(
    () => difficultyOptionsForFilters(exercises, { subject: filters.subject, chapter: filters.chapter }),
    [exercises, filters.subject, filters.chapter]
  );
  const yearOptions = useMemo(() => distinctYears(exercises), [exercises]);
  const competitionOptions = useMemo(() => competitionOptionsForFilters(exercises, filters), [exercises, filters]);

  // Un chapitre filtré peut devenir invalide si on change de matière : on le
  // réinitialise plutôt que de laisser un filtre "impossible" masquer
  // silencieusement toute la liste.
  useEffect(() => {
    if (filters.chapter !== "Tous" && !chapterOptions.some((chapter) => chapter.id === filters.chapter)) {
      updateFilters({ chapter: "Tous" });
    }
  }, [chapterOptions, filters.chapter, updateFilters]);

  // Même logique que ci-dessus pour le sous-thème (Phase 7 pédagogie) : un
  // tag filtré peut ne plus exister dans le périmètre matière/chapitre choisi
  // (ex. on change de chapitre après avoir sélectionné un sous-thème propre à
  // l'ancien) — on le réinitialise plutôt que de masquer silencieusement toute
  // la liste avec un filtre impossible.
  useEffect(() => {
    if (filters.tag !== "Toutes" && !tagOptions.includes(filters.tag)) {
      updateFilters({ tag: "Toutes" });
    }
  }, [tagOptions, filters.tag, updateFilters]);

  // Un seul passage sur `sessions` pour calculer le temps passé de TOUS les
  // exercices (voir lib/study.ts) — recalculé uniquement quand `sessions`
  // change, jamais par exercice ni à chaque rendu.
  const minutesMap = useMemo(() => minutesByExerciseMap(sessions), [sessions]);
  // "Pourquoi cet exercice ?" en mode focus (voir focus-view.tsx) : recalculé
  // à la volée sur TOUTE la banque active, pas seulement les exercices déjà
  // visibles dans la liste filtrée — un exercice ouvert par simple curiosité
  // en parcourant la banque garde exactement la même explication que s'il
  // avait été atteint depuis le Dashboard ou "À revoir en priorité", puisque
  // c'est le même moteur (`recommendExercises`) qui a déjà tranché. Un
  // exercice non signalé n'a simplement aucune entrée ici — FocusView
  // n'affiche alors rien, jamais de justification inventée.
  // Le MÊME appel sert aussi de tri par défaut de la banque (voir
  // `defaultExerciseSort`) : `rank` n'est que la position dans la liste que
  // le moteur vient de rendre, jamais un second classement.
  const { reasons: recommendationReasons, rank: recommendationRank } = useMemo(() => {
    const reasons = new Map<string, string[]>();
    const rank = new Map<string, number>();
    recommendExercises(exercises, sessions, exercises.length).forEach(({ exercise, reasons: why }, index) => {
      reasons.set(exercise.id, why);
      rank.set(exercise.id, index);
    });
    return { reasons, rank };
  }, [exercises, sessions]);

  const visible = useMemo(() => filterExercises(exercises, filters), [exercises, filters]);
  const sorted = useMemo(() => sortExercises(visible, sort, recommendationRank), [visible, sort, recommendationRank]);

  // Toute nouvelle sélection repart de la première page — voir `PAGE_SIZE`.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, sort]);

  const page = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);

  /*
   * `sortedRef` permet à `openReader` de lire l'ordre affiché SANS dépendre de
   * `sorted` : ce callback doit garder une identité stable d'un rendu à
   * l'autre, sinon le `memo` des rangées ne sert plus à rien et les 40 lignes
   * se re-rendent à chaque changement de la banque.
   *
   * La mise à jour se fait PENDANT LE RENDU, pas dans un effet — et c'était
   * un bug, pas un détail. `FocusQueryHandler` est un composant ENFANT : son
   * effet, qui traite `?focus=<id>`, s'exécute avant les effets du parent. Au
   * commit où les données deviennent prêtes, la référence contenait donc
   * encore la liste du tout premier rendu (vide), et l'ordre de lecture était
   * gelé à vide : un exercice ouvert depuis l'accueil arrivait SANS
   * « précédent » ni « suivant », et refermait le lecteur au lieu d'enchaîner.
   */
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  /*
   * NAVIGATION — il n'y a plus de « mode ».
   *
   * L'écran distinguait auparavant un mode PARCOURS (grille de matières, liste
   * masquée) et un mode RÉSULTATS (liste visible), et chaque callback devait
   * décider dans lequel on basculait. C'était la source de la confusion la
   * plus fréquente : cliquer une matière masquait les exercices, cliquer un
   * filtre les faisait réapparaître, sans que rien ne l'annonce.
   *
   * Désormais le volet de gauche EST la navigation, et la liste de droite
   * montre toujours le résultat des filtres courants. Ces callbacks ne font
   * plus qu'écrire dans `filters` — l'unique source de vérité.
   */
  /*
   * Les quatre entrées du volet passent par `filtersForScope` — la MÊME
   * fonction qui sert à calculer leurs compteurs (voir
   * lib/exercise-filters.ts). Tant qu'elles écrivaient leurs filtres à la
   * main ici pendant que le volet comptait autrement, les deux pouvaient
   * dire — et disaient — des choses différentes.
   */
  const goHome = useCallback(() => setFilters((prev) => filtersForScope(prev, { kind: "all" })), []);
  const showFavorites = useCallback(() => setFilters((prev) => filtersForScope(prev, { kind: "favorites" })), []);
  const selectSubject = useCallback((subject: Subject) => {
    setFilters((prev) => filtersForScope(prev, { kind: "subject", subject }));
  }, []);
  const selectChapter = useCallback((subject: Subject, chapterId: string) => {
    setFilters((prev) => filtersForScope(prev, { kind: "chapter", subject, chapterId }));
  }, []);

  /** Exercice affiché par le lecteur — distinct de la rangée dont la fiche est dépliée. */
  const selected = exercises.find((item) => item.id === readerId);

  /*
   * Au retour du lecteur : remettre la page où elle était, et marquer une
   * seconde la rangée qu'on vient de travailler — parmi trente-sept titres
   * qui se ressemblent, c'est ce qui permet à l'œil de retrouver sa ligne.
   *
   * On réessaie sur plusieurs cadres : la liste vient d'être remontée et met
   * quelques images à retrouver toute sa hauteur ; tant qu'elle est trop
   * courte, le navigateur plafonne la position demandée.
   */
  useEffect(() => {
    if (focusMode) return;
    const id = lastReadId.current;
    if (!id) return;
    lastReadId.current = null;
    const target = listScroll.current;
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      if (target > 0) window.scrollTo({ top: target, behavior: "instant" });
      if (target > 0 && Math.abs(window.scrollY - target) > 2 && attempts++ < 30) {
        frame = requestAnimationFrame(restore);
        return;
      }
      const row = document.getElementById(`exercise-${id}`);
      if (!row) return;
      row.dataset.justRead = "true";
      window.setTimeout(() => delete row.dataset.justRead, 1600);
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [focusMode]);


  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // `focusMode` court-circuite TOUT ce bloc (pas seulement la branche
      // qui le fermait explicitement) : pendant que FocusView est monté, IL
      // possède déjà Échap (voir focus-view.tsx#endSession, qui gère
      // lui-même l'écran "Comment s'est passé ?" avant d'appeler `onClose`).
      // Avant ce correctif (Phase 7 pédagogie — bug réel trouvé en testant le
      // parcours), ce handler global interceptait Échap EN MÊME TEMPS que
      // FocusView : les deux écouteurs `window.addEventListener` s'exécutent
      // pour le même événement, et celui-ci démontait FocusView (directement
      // via `setFocusMode(false)`, ou indirectement via `setSelectedId(null)`
      // qui rend `selected` undefined) avant que sa propre logique n'ait pu
      // enregistrer le résultat — la séance chronométrée (temps passé) était
      // silencieusement PERDUE, et l'écran de qualification n'apparaissait
      // jamais. Ne jamais laisser ce handler agir sur quoi que ce soit tant
      // que FocusView est affiché : c'est lui, et lui seul, qui décide quand
      // et comment se fermer.
      if (event.key === "Escape" && !focusMode) {
        if (importOpen) setImportOpen(false);
        if (sheetOpen) setSheetOpen(false);
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
  }, [focusMode, formOpen, importOpen, sheetOpen, selectedId, showArchived]);

  if (focusMode && selected) {
    /*
     * Navigation précédent/suivant DANS L'ORDRE VU PAR L'ÉLÈVE.
     *
     * L'ordre est celui de la liste au moment où le lecteur s'est ouvert
     * (`readerOrder`), pas le classement recalculé à chaque rendu — voir
     * lib/reader-navigation.ts, où la règle est isolée et testée. La
     * pagination ne borne pas la lecture : on navigue dans toute la sélection,
     * pas seulement dans les 40 lignes rendues. Un exercice ouvert depuis le
     * tableau de bord peut ne pas être dans la sélection courante ; les deux
     * boutons sont alors simplement désactivés.
     */
    const { previousId, nextId } = readerNavigation(readerOrder.current, selected.id, (id) =>
      exercises.some((item) => item.id === id && !item.archived)
    );
    const goTo = (target: string | null) => {
      if (!target) return;
      lastReadId.current = target;
      setReaderId(target);
    };

    return (
      <FocusView
        /*
         * `key` OBLIGATOIRE — et son absence était un vrai bug, pas un détail
         * de rendu.
         *
         * Le lecteur garde en état local le nombre d'indices révélés, la
         * visibilité de la correction et le chronomètre. Sans clé, passer à
         * l'exercice suivant par les flèches CONSERVAIT tout cela : mesuré au
         * navigateur, l'exercice suivant s'ouvrait avec un indice déjà
         * dévoilé que personne n'avait demandé, et le chronomètre continuait
         * de compter le temps du précédent (0:03 → 0:06 sans repartir de
         * zéro).
         *
         * Les conséquences dépassent l'affichage : `hints_used` et la durée
         * sont enregistrés dans la `WorkSession`, et le moteur s'en sert pour
         * décider si une réussite est AUTONOME. Une réussite obtenue seul
         * était donc comptée comme aidée, faussant les recommandations et
         * l'XP. Remonter le composant à chaque exercice remet tout à zéro,
         * exactement comme une ouverture depuis la liste.
         */
        key={selected.id}
        item={selected}
        update={update}
        sessions={sessions}
        saveSessions={saveSessions}
        onClose={() => setFocusMode(false)}
        reasons={recommendationReasons.get(selected.id)}
        onPrev={previousId ? () => goTo(previousId) : undefined}
        onNext={nextId ? () => goTo(nextId) : undefined}
      />
    );
  }

  if (showArchived) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(false)}>
            <ChevronLeft size={15} /> Retour aux exercices
          </Button>
          <p className="t-meta tabular">
            <span className="font-medium text-ink">{archivedExercises.length}</span> exercice
            {archivedExercises.length > 1 ? "s" : ""} archivé{archivedExercises.length > 1 ? "s" : ""}
          </p>
        </div>
        <ArchivedExercises exercises={archivedExercises} onRestore={restoreExercise} />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  // Fil d'Ariane de la sélection courante, pour que la zone de travail dise
  // toujours CE QU'ELLE MONTRE — sans quoi une liste de 37 lignes ressemble à
  // n'importe quelle autre liste de 37 lignes.
  const currentChapter = chapters.find((chapter) => chapter.id === filters.chapter);
  const query = filters.query.trim();
  /*
   * Le titre doit dire CE QU'ON REGARDE. En cherchant « diagonalis » on
   * obtenait 25 résultats sous un titre qui affirmait toujours « Toute la
   * banque » : l'écran se contredisait lui-même, et rien ne rappelait qu'une
   * recherche était en cours si on avait fait défiler la page.
   */
  const scopeLabel = query
    ? `« ${query} »`
    : filters.favoritesOnly
      ? "Favoris"
      : currentChapter
        ? currentChapter.label
        : filters.subject !== "Toutes"
          ? filters.subject
          : filters.competition !== "Tous"
            ? filters.competition
            : "Toute la banque";
  const scopeParent = query
    ? "Recherche"
    : currentChapter
      ? currentChapter.subject
      : null;

  return (
    <>
      {/* `useSearchParams` exige une limite Suspense — isolée ici pour ne pas
          faire basculer toute la page en rendu dynamique. */}
      <Suspense fallback={null}>
        <FocusQueryHandler ready={ready} onFocus={jumpToExerciseFromQuery} onCompetition={filterByCompetition} onChapter={openChapter} onSubject={selectSubject} />
      </Suspense>

      <Workbench
        paneLabel="Navigation de la banque"
        paneSummary={scopeLabel}
        scopeKey={`${filters.subject}::${filters.chapter}::${filters.favoritesOnly}::${filters.competition}`}
        pane={
          <BankNavigator
            exercises={exercises}
            chapters={chapters}
            filters={filters}
            onSelectAll={goHome}
            onSelectFavorites={showFavorites}
            onSelectSubject={selectSubject}
            onSelectChapter={selectChapter}
          />
        }
      >
        <div className="space-y-6">
          {lastArchived && (
            <Notice
              tone="info"
              action={
                <Button size="sm" variant="secondary" onClick={undoArchive}>
                  <Undo2 size={14} /> Annuler
                </Button>
              }
            >
              <span className="text-ink">
                <MathInline text={lastArchived.title} />
              </span>{" "}
              a été archivé.
            </Notice>
          )}

          <PageBar
            title={scopeLabel}
            meta={
              <>
                {scopeParent && <span>{scopeParent} · </span>}
                <span className="tabular">{sorted.length}</span> exercice{sorted.length > 1 ? "s" : ""}
                {sorted.length !== exercises.filter((item) => !item.archived).length && (
                  <> sur {exercises.filter((item) => !item.archived).length}</>
                )}
              </>
            }
            actions={
              <Button variant="ghost" size="sm" onClick={() => setShowArchived(true)}>
                <Archive size={15} /> Archivés{archivedExercises.length > 0 && ` (${archivedExercises.length})`}
              </Button>
            }
          />

          <ExerciseToolbar
            filters={filters}
            onChange={updateFilters}
            onReset={goHome}
            chapterOptions={chapterOptions}
            tagOptions={tagOptions}
            difficultyOptions={difficultyOptions}
            competitionOptions={competitionOptions}
            yearOptions={yearOptions}
            onAddClick={() => setFormOpen((value) => !value)}
            onImportClick={() => {
              setSheetOpen(false);
              setImportOpen((value) => !value);
            }}
            onSheetImportClick={() => {
              setImportOpen(false);
              setSheetOpen((value) => !value);
            }}
            sortControl={
              <label className="flex items-center gap-2">
                <span className="t-label">Trier</span>
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ExerciseSort)}
                  wrapperClassName="w-auto min-w-[10rem]"
                  className="text-xs"
                >
                  {exerciseSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            }
          />

          <ExerciseForm open={formOpen} chapters={chapters} onSubmit={create} onCancel={() => setFormOpen(false)} onCreateChapter={handleCreateChapter} />

          <SheetImport
            open={sheetOpen}
            chapters={chapters}
            existing={exercises}
            onCommit={importExercises}
            onCreateChapter={handleCreateChapter}
            onCancel={() => setSheetOpen(false)}
          />

          <ExerciseImport
            open={importOpen}
            chapters={chapters}
            existing={exercises}
            onCommit={importExercises}
            onCreateChapter={handleCreateChapter}
            onCancel={() => setImportOpen(false)}
          />

          <SessionBuilderBar exercises={sorted} sessions={sessions} />

          {page.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun exercice ne correspond."
              description="Retire un filtre, ou élargis ta recherche. La banque en compte des centaines — il y a de fortes chances que le bon soit à un critère près."
              action={
                <Button variant="secondary" onClick={goHome}>
                  Tout réinitialiser
                </Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-line border-y border-line">
                {page.map((item) => (
                  <ExerciseRow
                    key={item.id}
                    item={item}
                    expanded={selectedId === item.id}
                    minutesSpent={minutesMap.get(item.id) ?? 0}
                    chapters={chapters}
                    sessions={sessions}
                    hideSubject={filters.subject !== "Toutes"}
                    hideChapter={filters.chapter !== "Tous"}
                    onOpen={openReader}
                    onToggleDetail={toggleDetail}
                    onUpdate={update}
                    onArchive={archiveExercise}
                    onCreateChapter={handleCreateChapter}
                    onRenameChapter={handleRenameChapter}
                    onRemoveChapter={handleRemoveChapter}
                  />
                ))}
              </ul>

              {sorted.length > page.length && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <Button variant="secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                    Afficher {Math.min(PAGE_SIZE, sorted.length - page.length)} exercices de plus
                  </Button>
                  <p className="t-meta tabular">
                    {page.length} sur {sorted.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Workbench>
    </>
  );
}

/**
 * Lit les paramètres d'entrée de l'URL, déclenche l'action correspondante une
 * seule fois, puis nettoie l'URL :
 *
 *   `?focus=<id>`          ouvre directement le lecteur sur cet exercice
 *                          (lien « À revoir » du tableau de bord).
 *   `?competition=<nom>`   pré-filtre la banque sur ce concours
 *                          (bouton « Travailler cette banque », écran Concours).
 *
 * Isolé dans son propre composant car `useSearchParams` impose une limite
 * Suspense — inutile de l'imposer à tout `ExerciseManager`.
 */
function FocusQueryHandler({
  ready,
  onFocus,
  onCompetition,
  onChapter,
  onSubject,
}: {
  ready: boolean;
  onFocus: (id: string) => void;
  onCompetition: (competition: string) => void;
  onChapter: (chapterId: string) => void;
  onSubject: (subject: Subject) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current) return;
    const focusId = searchParams.get("focus");
    const competition = searchParams.get("competition");
    const chapter = searchParams.get("chapter");
    const subject = searchParams.get("subject");
    if (!focusId && !competition && !chapter && !subject) return;
    handled.current = true;
    if (focusId) onFocus(focusId);
    else if (competition) onCompetition(competition);
    else if (chapter) onChapter(chapter);
    else if (subject && (subjects as string[]).includes(subject)) onSubject(subject as Subject);
    router.replace("/exercises", { scroll: false });
  }, [ready, searchParams, onFocus, onCompetition, onChapter, onSubject, router]);

  return null;
}
