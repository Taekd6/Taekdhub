"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration } from "@/components/ui/illustrations";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistorySummary } from "@/components/history/history-summary";
import { SessionRow } from "@/components/history/session-row";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildWeeklyPlan } from "@/lib/planning";
import { defaultHistoryFilters, filterSessions, summarizeSessions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";
import { subjects } from "@/lib/study";
import { formatSpan } from "@/lib/utils";

/** Lignes montées d'un coup — voir `visibleCount`. */
const HISTORY_PAGE_SIZE = 100;

/**
 * Page Historique (Sprint 3F) — orchestration uniquement : filtrage et
 * agrégation viennent de lib/history.ts, l'affichage des filtres/de
 * l'agrégat/des lignes vient de components/history/*. Ce fichier ne fait
 * que les assembler.
 *
 * REFONTE « APPLE » : un grand titre illustré, les filtres en pastilles
 * juste dessous, puis le journal en FRISE — une tuile par jour, les séances
 * reliées par un fil vertical, l'heure à gauche, la durée à droite. La
 * synthèse (total, séances, part de chaque matière) est une tuile collante
 * à droite sur grand écran, et passe sous les filtres sur téléphone.
 */
export function SessionHistory() {
  const { sessions, workItems, preferences, ready } = usePrepahubData();
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

  const workItemTitleById = useMemo(() => new Map(workItems.map((item) => [item.id, item.title])), [workItems]);

  const filtered = useMemo(() => filterSessions(sessions, filters), [sessions, filters]);
  const summary = useMemo(() => summarizeSessions(filtered), [filtered]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [filtered]
  );
  // Les pastilles de matière comptent les séances de la PÉRIODE choisie,
  // toutes matières confondues : le compte ne s'effondre pas quand on en
  // choisit une.
  const subjectCounts = useMemo(() => {
    const inPeriod = filterSessions(sessions, { ...filters, subject: "Toutes" });
    return subjects
      .map((subject) => ({ subject, count: inPeriod.filter((session) => session.subject === subject).length }))
      .filter((entry) => entry.count > 0 || entry.subject === filters.subject);
  }, [sessions, filters]);

  /*
   * PRÉVU vs RÉALISÉ — pour AUJOURD'HUI seulement, et c'est délibéré.
   *
   * Le planning n'est pas persisté : il est recalculé à chaque affichage
   * (voir lib/planning.ts). On ne peut donc pas savoir ce qui était prévu
   * un mardi passé — et l'inventer à partir du planning d'aujourd'hui serait
   * exactement le genre d'affirmation que ce produit s'interdit.
   *
   * ATTENTION AU LIBELLÉ : ce nombre est le RESTE À CASER, pas l'intention
   * de la journée. `buildWeeklyPlan` ampute déjà la capacité d'aujourd'hui du
   * temps déjà travaillé (lib/planning.ts#remainingPlannableToday).
   */
  const plannedToday = useMemo(
    () => buildWeeklyPlan(workItems, sessions, preferences, new Date()).days[0]?.load.plannedMinutes ?? 0,
    [workItems, sessions, preferences]
  );

  /*
   * LE JOURNAL EST GROUPÉ PAR JOUR — une tuile chacun.
   *
   * À plat, trente-six lignes portant chacune « 14 sept. 2026, 05:30 » se
   * lisent comme un export de base de données. Groupée, la même liste répond
   * à « qu'est-ce que j'ai fait mardi » — et le total du jour s'y écrit
   * gratuitement.
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
      <div className="space-y-6">
        <Skeleton className="h-24 w-72" />
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="space-y-10">
        <PageHero title="Séances" />
        <EmptyState
          illustration={<Illustration name="chrono" size={56} />}
          title="Ton journal est prêt."
          description="Chaque séance chronométrée ou déclarée y laissera sa durée, sa matière et ta note. Rien n'y est écrit à ta place."
          action={
            <Link href="/timer" className={buttonVariants({ variant: "primary" })}>
              Lancer le chronomètre
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHero
        title="Séances"
        lede="La trace exacte du travail accompli : ce qui a été travaillé, quand, et combien de temps."
        illustration={<Illustration name="chrono" size={56} />}
      />

      {/* Les filtres appartiennent au bord de ce qu'ils filtrent : en tête du
          journal, jamais dans le rail — sur téléphone, le rail passe sous cent
          lignes. */}
      <HistoryFilters filters={filters} onChange={updateFilters} subjects={subjectCounts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.38fr)] lg:gap-8">
        <aside aria-label="Synthèse de la période" className="lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:order-2 lg:h-fit">
          <HistorySummary summary={summary} />
        </aside>

        <section aria-label="Journal des séances" className="min-w-0 lg:order-1">
          <h2 className="sr-only">
            {sorted.length} séance{sorted.length > 1 ? "s" : ""}
          </h2>
          {sorted.length ? (
            <div className="space-y-4">
              {visibleDays.map((day, index) => (
                <section key={day.key} className="surface reveal p-2 sm:p-3" style={{ "--i": Math.min(index, 4) } as React.CSSProperties}>
                  {/* L'en-tête du jour : son nom, son total. */}
                  <h3 className="flex items-baseline justify-between gap-3 px-3 pb-2 pt-3 sm:px-4">
                    <span className="t-subhead first-letter:uppercase">{formatDayLabel(day.date)}</span>
                    <span className="tabular shrink-0 whitespace-nowrap text-[0.9375rem] font-bold text-ink">
                      {formatSpan(day.seconds)}
                      {/* Les mots disparaissent sous `sm` : à 320 px, ils
                          faisaient déborder toute la page horizontalement.
                          Les deux chiffres, eux, restent. */}
                      {isToday(day.date) && plannedToday > 0 && (
                        <span className="font-medium text-subtle">
                          <span className="hidden sm:inline"> réalisées</span> · {formatSpan(plannedToday * 60)}
                          <span className="hidden sm:inline"> encore au planning</span>
                        </span>
                      )}
                    </span>
                  </h3>
                  <ul>
                    {day.sessions.map((session, position) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        workItemTitle={session.work_item_id ? workItemTitleById.get(session.work_item_id) : undefined}
                        dateInHeader
                        last={position === day.sessions.length - 1}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              className="surface"
              illustration={<Illustration name="chrono" size={56} />}
              title="Aucune séance ne correspond."
              description="Change de période ou de matière pour retrouver ton journal."
              action={
                <Button variant="secondary" onClick={() => updateFilters(defaultHistoryFilters)}>
                  Tout afficher
                </Button>
              }
            />
          )}

          {sorted.length > visibleCount && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button variant="secondary" onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}>
                Afficher {Math.min(HISTORY_PAGE_SIZE, sorted.length - visibleCount)} de plus <ChevronDown size={15} />
              </Button>
              <p className="t-meta tabular">
                {visibleCount} sur {sorted.length}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
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

/** Le jour en cours — seul jour pour lequel « prévu » est une donnée connue et non une reconstitution. */
function isToday(date: Date): boolean {
  return date.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
}
