"use client";

import { ChevronDown, Layers, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { subjects as allSubjects } from "@/lib/study";
import { cn } from "@/lib/cn";
import { scopeBaseline, type ExerciseFilters } from "@/lib/exercise-filters";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * NAVIGATEUR DE LA BANQUE — le volet persistant de l'écran Exercices.
 *
 * Il remplace un PARCOURS PAR ÉTAPES : on cliquait « Mathématiques », la
 * grille des matières disparaissait au profit de celle des chapitres, on
 * cliquait « Réduction », les chapitres disparaissaient au profit de la
 * liste. Chaque changement de chapitre imposait donc deux retours en arrière,
 * et on ne voyait jamais en même temps où l'on était et ce qu'il y avait à
 * côté — sur une banque de 537 exercices répartis en 50 chapitres, c'est le
 * défaut qui coûte le plus cher.
 *
 * Ici l'arborescence reste à l'écran en permanence : la matière ouverte
 * déroule ses chapitres, la sélection courante est mise en évidence, et
 * passer de « Réduction » à « Matrices » est UN clic, sans rien perdre.
 *
 * Aucun état de sélection propre : tout est dérivé de `filters` et écrit par
 * les callbacks de l'appelant. Le seul état local est le déploiement d'une
 * matière — une préférence d'affichage, pas une donnée.
 */
export function BankNavigator({
  exercises,
  chapters,
  filters,
  onSelectAll,
  onSelectFavorites,
  onSelectSubject,
  onSelectChapter,
}: {
  exercises: Exercise[];
  chapters: Chapter[];
  filters: ExerciseFilters;
  onSelectAll: () => void;
  onSelectFavorites: () => void;
  onSelectSubject: (subject: Subject) => void;
  onSelectChapter: (subject: Subject, chapterId: string) => void;
}) {
  const active = useMemo(() => exercises.filter((item) => !item.archived), [exercises]);

  /*
   * COMPTEURS — ce que la liste montrera après le clic, pas autre chose.
   *
   * Voir `filtersForScope` (lib/exercise-filters.ts) : « Toute la banque » et
   * « Favoris » remettent tous les filtres à zéro, donc se comptent sur la
   * banque entière ; une matière ou un chapitre CONSERVE les autres filtres,
   * donc se compte dans `baseline`. C'est cette distinction qui manquait :
   * tout était compté sur la banque brute, si bien qu'un filtre concours en
   * vigueur faisait annoncer 16 exercices là où la liste en montrait 4.
   */
  const baseline = useMemo(() => scopeBaseline(exercises, filters), [exercises, filters]);

  const totalActive = active.length;
  const favorites = useMemo(() => active.filter((item) => item.favorite).length, [active]);

  const countBySubject = useMemo(() => {
    const counts = new Map<Subject, number>();
    for (const item of baseline) counts.set(item.subject, (counts.get(item.subject) ?? 0) + 1);
    return counts;
  }, [baseline]);

  const statsByChapter = useMemo(() => {
    const stats = new Map<string, { total: number; masterySum: number }>();
    for (const item of baseline) {
      if (!item.chapter_id) continue;
      const entry = stats.get(item.chapter_id) ?? { total: 0, masterySum: 0 };
      entry.total += 1;
      entry.masterySum += item.mastery;
      stats.set(item.chapter_id, entry);
    }
    return stats;
  }, [baseline]);

  /*
   * STRUCTURE de l'arborescence — établie sur la banque ENTIÈRE, pas sur les
   * filtres courants.
   *
   * Si les entrées apparaissaient et disparaissaient au rythme des filtres,
   * poser un filtre concours ferait s'effondrer l'arbre à quelques chapitres
   * et il deviendrait impossible d'aller ailleurs sans d'abord tout effacer.
   * Les entrées restent donc en place ; ce sont leurs nombres qui bougent, et
   * une entrée à zéro se voit du premier coup d'œil.
   */
  const structure = useMemo(() => {
    const present = allSubjects.filter((subject) => active.some((item) => item.subject === subject));
    const byChapter = new Map<Subject, Chapter[]>();
    for (const subject of present) {
      byChapter.set(
        subject,
        chapters
          .filter((chapter) => chapter.subject === subject && active.some((item) => item.chapter_id === chapter.id))
          .sort((a, b) => a.label.localeCompare(b.label, "fr"))
      );
    }
    return { present, byChapter };
  }, [active, chapters]);

  // La matière ouverte suit la sélection courante ; on ne l'ouvre à la main
  // que pour aller regarder ailleurs sans quitter sa liste.
  const [manuallyOpen, setManuallyOpen] = useState<Subject | null>(null);
  const openSubject = manuallyOpen ?? (filters.subject !== "Toutes" ? filters.subject : structure.present[0] ?? null);

  const allSelected = filters.subject === "Toutes" && filters.chapter === "Tous" && !filters.favoritesOnly;

  return (
    <nav className="space-y-1">
      {/* Quand d'autres filtres sont en vigueur, les nombres des matières et
          des chapitres ne comptent qu'à l'intérieur de ceux-ci — tandis que
          « Toute la banque » les efface, et compte donc tout. Sans cette
          ligne, l'écart entre les deux serait incompréhensible. */}
      {baseline.length !== totalActive && (
        <p className="t-meta mb-2 rounded-md bg-inset px-2 py-1.5 text-2xs">
          Filtres actifs : <span className="tabular text-ink">{baseline.length}</span> exercice
          {baseline.length > 1 ? "s" : ""} sur {totalActive}. Les nombres ci-dessous comptent dans cette sélection.
        </p>
      )}
      <Entry icon={<Layers size={15} />} label="Toute la banque" count={totalActive} active={allSelected} onClick={onSelectAll} />
      {favorites > 0 && (
        <Entry
          icon={<Star size={15} />}
          label="Favoris"
          count={favorites}
          active={filters.favoritesOnly}
          onClick={onSelectFavorites}
        />
      )}

      <div className="pt-4">
        <p className="t-label mb-1.5 px-2">Matières</p>
        {structure.present.map((subject) => {
            const expanded = openSubject === subject;
            const subjectChapters = structure.byChapter.get(subject) ?? [];
            const subjectSelected = filters.subject === subject && filters.chapter === "Tous";
            const subjectCount = countBySubject.get(subject) ?? 0;
            const entry = { subject };

            return (
              <div key={entry.subject}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setManuallyOpen(entry.subject);
                      onSelectSubject(entry.subject);
                    }}
                    aria-current={subjectSelected ? "true" : undefined}
                    className={cn(
                      "row-hover flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-2 pl-2 pr-1 text-left text-sm max-lg:min-h-11",
                      subjectSelected ? "bg-inset font-medium text-ink" : "text-muted"
                    )}
                  >
                    <SubjectAvatar subject={entry.subject} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{entry.subject}</span>
                    <span className={cn("t-meta tabular shrink-0 text-2xs", subjectCount === 0 && "opacity-45")}>{subjectCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManuallyOpen(expanded ? ("" as unknown as Subject) : entry.subject)}
                    aria-expanded={expanded}
                    aria-label={expanded ? `Replier ${entry.subject}` : `Déplier ${entry.subject}`}
                    className="row-hover grid h-8 w-7 shrink-0 place-items-center rounded-md text-subtle max-lg:h-11"
                  >
                    <ChevronDown size={14} className={cn("transition-transform duration-150", expanded && "rotate-180")} />
                  </button>
                </div>

                {expanded && subjectChapters.length > 0 && (
                  <ul className="mb-1 ml-[1.4375rem] border-l border-line pl-2">
                    {subjectChapters.map((chapter) => {
                      const selected = filters.chapter === chapter.id;
                      const stats = statsByChapter.get(chapter.id);
                      const total = stats?.total ?? 0;
                      const averageMastery = stats && stats.total ? Math.round(stats.masterySum / stats.total) : 0;
                      return (
                        <li key={chapter.id}>
                          <button
                            type="button"
                            onClick={() => onSelectChapter(entry.subject, chapter.id)}
                            aria-current={selected ? "true" : undefined}
                            className={cn(
                              "row-hover flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-1 text-left text-[0.8125rem] max-lg:min-h-11",
                              selected ? "bg-inset font-medium text-ink" : "text-muted"
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate">{chapter.label}</span>
                            {/* Le point de maîtrise vaut mieux qu'une barre dans
                                une colonne de 15 rem : il se lit sans mesurer. */}
                            {averageMastery > 0 && (
                              <span
                                aria-hidden
                                title={`${averageMastery} % de maîtrise moyenne`}
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  averageMastery >= 70 ? "bg-emerald-400" : "bg-amber-400"
                                )}
                              />
                            )}
                            <span className={cn("t-meta tabular shrink-0 text-2xs", total === 0 && "opacity-45")}>{total}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
        })}
      </div>
    </nav>
  );
}

function Entry({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "row-hover flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm max-lg:min-h-11",
        active ? "bg-inset font-medium text-ink" : "text-muted"
      )}
    >
      <span className="shrink-0 text-subtle">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="t-meta tabular shrink-0 text-2xs">{count}</span>
    </button>
  );
}
