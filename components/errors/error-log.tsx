"use client";

import Link from "next/link";
import { BookmarkCheck, BookmarkPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorCapture } from "@/components/errors/error-capture";
import { ErrorStats, WhyItWorks, type StatsPeriod } from "@/components/errors/error-stats";
import { SubjectAvatar } from "@/components/subject-avatar";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration } from "@/components/ui/illustrations";
import { FilterPills } from "@/components/ui/pills";
import { Section } from "@/components/ui/section";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import {
  canSendToReview,
  ERROR_SOURCE_META,
  ERROR_TYPE_META,
  filterErrors,
  groupErrorsByRecency,
  linkReviewItem,
  parseErrorPrefill,
  removeErrorEntry,
  reviewInputFromError,
} from "@/lib/error-log";
import { createReviewItem } from "@/lib/review-items";
import { ERROR_TYPES, type ErrorEntry, type ErrorType, type ReviewItem } from "@/lib/storage";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE CARNET D'ERREURS EN ENTIER — noter, relire, voir ce qui revient.
 *
 * Comme /revoir (refonte « Apple ») : la saisie et la liste dans des tuiles à gauche, ce
 * qui revient à droite (sous la liste sur téléphone — l'action d'abord).
 *
 * SEUL appelant de `usePrepahubData()` sur cet écran : la saisie, la liste et
 * les statistiques reçoivent tout en props. `saveErrors` et
 * `saveReviewItems` REMPLACENT, et deux copies du hook sur le même écran
 * s'effaceraient mutuellement leurs ajouts.
 */
export function ErrorLog() {
  const { errors, saveErrors, reviewItems, saveReviewItems, ready } = usePrepahubData();
  const [subject, setSubject] = useState<Subject | "all">("all");
  const [type, setType] = useState<ErrorType | "all">("all");
  const [period, setPeriod] = useState<StatsPeriod>("recent");
  const [lastSaved, setLastSaved] = useState<ErrorEntry | null>(null);

  // `?subject=` filtre aussi la liste : arriver depuis le hub de physique,
  // c'est vouloir voir les erreurs de physique.
  useEffect(() => {
    const prefill = parseErrorPrefill(window.location.search);
    if (prefill.subject) setSubject(prefill.subject);
  }, []);

  useEffect(() => {
    if (!lastSaved) return;
    const timeout = window.setTimeout(() => setLastSaved(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [lastSaved]);

  const scoped = useMemo(
    () => filterErrors(errors, { subject: subject === "all" ? null : subject, type: type === "all" ? null : type }),
    [errors, subject, type]
  );
  const groups = useMemo(() => groupErrorsByRecency(scoped), [scoped]);

  /** Une erreur de cours → une ligne « à apprendre » du carnet À revoir, reliée pour ne pas la proposer deux fois. */
  function sendToReview(entry: ErrorEntry) {
    const item = createReviewItem(reviewInputFromError(entry));
    if (!item) return;
    saveReviewItems([item, ...reviewItems]);
    saveErrors(linkReviewItem(errors, entry.id, item.id));
    if (lastSaved?.id === entry.id) setLastSaved({ ...entry, reviewItemId: item.id });
  }

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  // Filtre matière : seulement les matières qui ont au moins une erreur, plus la sélectionnée.
  const subjectOptions = subjects.filter((entry) => errors.some((error) => error.subject === entry) || entry === subject);
  const freshCours = lastSaved && lastSaved.type === "cours" && canSendToReview(lastSaved, reviewItems) ? lastSaved : null;

  return (
    <div className="space-y-10">
      <PageHero
        title="Carnet d'erreurs"
        lede="Chaque erreur de colle, de DS ou d'exercice, notée en dix secondes avec la bonne idée — pour voir ce qui revient et le travailler."
        illustration={<Illustration name="erreurs" size={56} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.38fr)] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <Section variant="panel" title="Noter une erreur">
            <ErrorCapture errors={errors} saveErrors={saveErrors} ready={ready} onSaved={setLastSaved} />
            {freshCours && (
              <p role="status" className="t-meta mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
                Erreur de cours notée.
                <Button type="button" variant="link" size="sm" className="min-h-6 px-0" onClick={() => sendToReview(freshCours)}>
                  <BookmarkPlus size={13} aria-hidden /> L&apos;ajouter au carnet « À revoir » (à apprendre)
                </Button>
              </p>
            )}
          </Section>

          <Section variant="panel" label="Le carnet" title="Erreurs notées">
            {errors.length > 0 && (
              <div className="mb-6 space-y-3">
                {/* Sept options : des pastilles qui passent à la ligne. Un
                    sélecteur segmenté les coupait en « Cou… » à 375 px. */}
                <FilterPills
                  ariaLabel="Type d'erreur"
                  value={type}
                  onChange={setType}
                  options={[{ value: "all" as const, label: "Tous les types" }, ...ERROR_TYPES.map((value) => ({ value, label: ERROR_TYPE_META[value].label }))]}
                />
                {subjectOptions.length > 1 && (
                  <FilterPills
                    ariaLabel="Matière"
                    value={subject}
                    onChange={setSubject}
                    options={[
                      { value: "all" as const, label: "Toutes les matières" },
                      ...subjectOptions.map((entry) => ({ value: entry, label: entry, count: errors.filter((error) => error.subject === entry).length })),
                    ]}
                  />
                )}
              </div>
            )}

            {groups.length === 0 ? (
              errors.length === 0 ? (
                <EmptyState
                  className="py-8"
                  illustration={<Illustration name="erreurs" size={56} />}
                  title="Aucune erreur notée."
                  description="Après ta prochaine colle ou ton prochain DS, note chaque erreur ci-dessus : ce qui s'est passé, son type, et la bonne idée."
                />
              ) : (
                <p className="t-meta py-6 text-center">Aucune erreur avec ces filtres.</p>
              )
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.key}>
                    <p className="t-label mb-1.5">
                      {group.label} · <span className="tabular">{group.entries.length}</span>
                    </p>
                    <ul className="divide-y divide-line">
                      {group.entries.map((entry) => (
                        <ErrorRow
                          key={entry.id}
                          entry={entry}
                          showSubject={subject === "all"}
                          reviewItems={reviewItems}
                          fresh={entry.id === lastSaved?.id}
                          onSendToReview={() => sendToReview(entry)}
                          onRemove={() => saveErrors(removeErrorEntry(errors, entry.id))}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* CE QUI REVIENT — une tuile collante à droite sur grand écran, sous
            la liste sur téléphone (l'action d'abord). */}
        <aside aria-label="Ce qui revient" className="h-fit space-y-4 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
          <div className="surface p-6">
            <ErrorStats errors={errors} subject={subject === "all" ? null : subject} period={period} onPeriod={setPeriod} />
          </div>
          <WhyItWorks />
        </aside>
      </div>
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * UNE ERREUR — ce qui s'est passé, la bonne idée en dessous, puis type,
 * source et date. Pas de case à cocher : une erreur est un constat,
 * pas une tâche (voir `ErrorEntry`). La croix supprime — toujours visible,
 * comme dans le carnet À revoir, pour rester atteignable au doigt.
 */
function ErrorRow({
  entry,
  showSubject,
  reviewItems,
  fresh,
  onSendToReview,
  onRemove,
}: {
  entry: ErrorEntry;
  showSubject: boolean;
  reviewItems: ReviewItem[];
  fresh: boolean;
  onSendToReview: () => void;
  onRemove: () => void;
}) {
  const sendable = entry.type === "cours" && canSendToReview(entry, reviewItems);
  const sent = entry.type === "cours" && !sendable;
  return (
    <li className={cn("flex items-start gap-2.5 py-2.5", fresh && "animate-fade-in")}>
      {showSubject && (
        <span className="translate-y-px">
          <SubjectAvatar subject={entry.subject} size="sm" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words text-[0.8125rem] leading-5 text-ink">{entry.description}</p>
        {entry.fix && <p className="break-words text-[0.8125rem] leading-5 text-muted">→ {entry.fix}</p>}
        <p className="t-meta mt-0.5 text-2xs">
          <span className="font-medium text-ink">{ERROR_TYPE_META[entry.type].label}</span>
          {" · "}
          {ERROR_SOURCE_META[entry.source].label}
          {" · "}
          {dateFormat.format(new Date(`${entry.date}T00:00:00`))}
        </p>
        {sendable && (
          <button
            type="button"
            onClick={onSendToReview}
            className="t-meta mt-1 inline-flex min-h-6 items-center gap-1 text-2xs text-accent hover:underline max-lg:min-h-11"
          >
            <BookmarkPlus size={12} aria-hidden /> À apprendre : ajouter au carnet « À revoir »
          </button>
        )}
        {sent && (
          <Link href={`/revoir?subject=${encodeURIComponent(entry.subject)}&kind=${encodeURIComponent("à apprendre")}`} className="t-meta mt-1 inline-flex min-h-6 items-center gap-1 text-2xs hover:text-ink max-lg:min-h-11">
            <BookmarkCheck size={12} aria-hidden /> Dans le carnet « À revoir »
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer : ${entry.description}`}
        title="Supprimer"
        className="grid shrink-0 place-items-center rounded text-subtle transition-colors hover:text-rose-300 max-lg:-m-2.5 max-lg:h-11 max-lg:w-11 lg:h-5 lg:w-5"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  );
}
