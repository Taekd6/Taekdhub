"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { PageBar, Split } from "@/components/ui/layout";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistorySummary } from "@/components/history/history-summary";
import { SessionRow } from "@/components/history/session-row";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { defaultHistoryFilters, filterSessions, resultCounts, summarizeSessions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";
import { formatSpan } from "@/lib/utils";

/** Lignes montées d'un coup — voir `visibleCount`. */
const HISTORY_PAGE_SIZE = 100;

/**
 * Page Historique (Sprint 3F) — orchestration uniquement : filtrage et
 * agrégation viennent de lib/history.ts, l'affichage des filtres/de
 * l'agrégat/des lignes vient de components/history/*. Ce fichier ne fait
 * que les assembler.
 */
export function SessionHistory() {
  const { sessions, exercises, chapters, ready } = usePrepahubData();
  const [filters, setFilters] = useState<HistoryFiltersState>(defaultHistoryFilters);
  // Combien de lignes sont réellement montées dans le DOM.
  //
  // La page en montait UNE PAR SÉANCE, sans plafond. Mesuré en test de
  // destruction : 10 000 séances (un peu plus d'un an à un rythme soutenu)
  // mettaient 26 secondes à s'afficher, contre ~2,5 s pour toutes les autres
  // pages du même jeu de données. Les agrégats du haut, eux, restent calculés
  // sur la TOTALITÉ des séances filtrées : c'est le rendu qui est paginé,
  // jamais la mesure.
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);

  const exerciseById = useMemo(() => new Map(exercises.map((item) => [item.id, item])), [exercises]);
  const chapterById = useMemo(() => new Map(chapters.map((item) => [item.id, item])), [chapters]);

  const filtered = useMemo(() => filterSessions(sessions, filters), [sessions, filters]);
  const summary = useMemo(() => summarizeSessions(filtered), [filtered]);
  const results = useMemo(() => resultCounts(filtered), [filtered]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [filtered]
  );

  /*
   * LE JOURNAL EST GROUPÉ PAR JOUR.
   *
   * À plat, trente-six lignes portant chacune « 14 sept. 2026, 05:30 » se
   * lisent comme un export de base de données : la date est répétée sur
   * chaque ligne, et pourtant on ne voit pas ce qu'a été une journée. Groupé,
   * la même liste répond à « qu'est-ce que j'ai fait mardi » — et le total du
   * jour, qui n'existait nulle part, s'y écrit gratuitement.
   *
   * Le regroupement se fait APRÈS la pagination (`visibleCount`), jamais
   * avant : la garde qui plafonne le nombre de lignes montées reste
   * exactement celle d'avant, et un groupe peut légitimement être coupé au
   * bord de la page — il se complète en affichant la suite.
   */
  const visibleDays = useMemo(() => {
    const groups: { key: string; date: Date; sessions: typeof sorted; seconds: number }[] = [];
    for (const session of sorted.slice(0, visibleCount)) {
      const date = new Date(session.started_at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.sessions.push(session);
        last.seconds += session.duration_seconds;
      } else {
        groups.push({ key, date, sessions: [session], seconds: session.duration_seconds });
      }
    }
    return groups;
  }, [sorted, visibleCount]);

  const updateFilters = (patch: Partial<HistoryFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setVisibleCount(HISTORY_PAGE_SIZE);
  };

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <EmptyState
        icon={Clock3}
        title="Ton journal est prêt."
        description="Chaque exercice travaillé y laissera sa durée, son résultat et sa date. Rien n'y est écrit à ta place."
      />
    );
  }


  return (
    <Split
      railLabel="Synthèse de la période"
      rail={<HistorySummary summary={summary} results={results} />}
    >
      <div className="space-y-8">
        <PageBar
          title="Séances"
          lede="La trace exacte du travail accompli : ce qui a été travaillé, combien de temps, avec quel résultat."
        />

      {/* Les filtres vivaient dans le rail, donc SOUS le journal sur
          téléphone : il fallait dépasser cent lignes pour restreindre la
          liste qu'on est en train de lire. Un filtre appartient au bord de ce
          qu'il filtre — il est ici l'action de la section, à côté du compte
          qu'il fait varier. Le rail ne garde que la synthèse. */}
      <Section
        label="Journal"
        title={`${sorted.length} séance${sorted.length > 1 ? "s" : ""}`}
        action={<HistoryFilters filters={filters} onChange={updateFilters} />}
      >
        {sorted.length ? (
          <div className="border-t border-line">
            {visibleDays.map((day) => (
              <section key={day.key}>
                {/* L'en-tête de jour n'est pas une barre teintée : une
                    étiquette et un total, séparés du jour précédent par le
                    filet de la liste. C'est ce que fait un relevé. */}
                <h3 className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 pt-5 first:pt-3">
                  <span className="t-label">{formatDayLabel(day.date)}</span>
                  <span className="t-meta tabular shrink-0">{formatSpan(day.seconds)}</span>
                </h3>
                <ul className="divide-y divide-line border-b border-line">
                  {day.sessions.map((session) => {
                    const exercise = session.exercise_id ? exerciseById.get(session.exercise_id) : undefined;
                    const chapter = exercise?.chapter_id ? chapterById.get(exercise.chapter_id) : undefined;
                    return (
                      <SessionRow
                        key={session.id}
                        session={session}
                        exerciseTitle={exercise?.title}
                        chapterLabel={chapter?.label}
                        dateInHeader
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="t-meta border-y border-line py-6 text-center">Aucune séance ne correspond à ces filtres.</p>
        )}

        {sorted.length > visibleCount && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}>
              Afficher {Math.min(HISTORY_PAGE_SIZE, sorted.length - visibleCount)} de plus <ChevronDown size={14} />
            </Button>
            <p className="t-meta tabular">
              {visibleCount} sur {sorted.length}
            </p>
          </div>
        )}
      </Section>
      </div>
    </Split>
  );
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/**
 * En-tête d'un jour du journal.
 *
 * « Aujourd'hui » et « Hier » plutôt que la date : ce sont les deux jours
 * qu'on vient réellement vérifier, et les nommer évite de faire le calcul de
 * tête. Au-delà, la date complète, avec le jour de la semaine — « mardi » est
 * ce dont on se souvient, pas « 09 ».
 */
function formatDayLabel(date: Date): string {
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return dayFormatter.format(date);
}
