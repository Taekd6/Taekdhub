"use client";

import Link from "next/link";
import { BookmarkCheck, BookmarkPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorCapture } from "@/components/errors/error-capture";
import { ErrorStats, WhyItWorks, type StatsPeriod } from "@/components/errors/error-stats";
import { SubjectAvatar } from "@/components/subject-avatar";
import { Button } from "@/components/ui/button";
import { PageBar, Split } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
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
import { subjectMeta, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE CARNET D'ERREURS EN ENTIER — noter, relire, voir ce qui revient.
 *
 * Composition `Split`, comme /revoir : la saisie et la liste à gauche, ce
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
    <Split
      railLabel="Ce qui revient"
      rail={
        <div className="space-y-6">
          <ErrorStats errors={errors} subject={subject === "all" ? null : subject} period={period} onPeriod={setPeriod} />
          <WhyItWorks />
        </div>
      }
    >
      <div className="space-y-8">
        <PageBar
          title="Carnet d'erreurs"
          lede="Chaque erreur de colle, de DS ou d'exercice, notée en dix secondes avec la bonne idée — pour voir ce qui revient et le travailler."
        />

        <Section variant="panel" label="Noter une erreur">
          <ErrorCapture
            errors={errors}
            saveErrors={saveErrors}
            ready={ready}
            onSaved={setLastSaved}
          />
          {freshCours && (
            <p role="status" className="t-meta mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
              Erreur de cours notée.
              <Button type="button" variant="link" size="sm" className="min-h-6 px-0" onClick={() => sendToReview(freshCours)}>
                <BookmarkPlus size={13} aria-hidden /> L&apos;ajouter au carnet « À revoir » (à apprendre)
              </Button>
            </p>
          )}
        </Section>

        <Section
          label="Le carnet"
          title="Erreurs notées"
          action={
            errors.length > 0 && (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {subjectOptions.length > 1 && (
                  <SegmentedControl
                    size="sm"
                    ariaLabel="Matière"
                    value={subject}
                    onChange={setSubject}
                    options={[{ value: "all" as const, label: "Toutes" }, ...subjectOptions.map((entry) => ({ value: entry, label: subjectMeta[entry].short }))]}
                  />
                )}
                {/* Sept options : des pastilles qui passent à la ligne. Un
                    sélecteur segmenté les coupait en « Cou… » à 375 px. */}
                <div role="group" aria-label="Type d'erreur" className="flex flex-wrap gap-1 sm:justify-end">
                  {(["all", ...ERROR_TYPES] as const).map((value) => {
                    const active = value === type;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setType(value)}
                        className={cn(
                          "min-h-7 rounded-md px-2 text-[0.8125rem] transition-colors max-lg:min-h-11",
                          active ? "bg-panel font-medium text-ink ring-1 ring-line" : "bg-inset text-muted hover:text-ink"
                        )}
                      >
                        {value === "all" ? "Tout" : ERROR_TYPE_META[value].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          }
        >
          {groups.length === 0 ? (
            <p className="t-meta text-2xs">
              {errors.length === 0
                ? "Aucune erreur notée. Après ta prochaine colle ou ton prochain DS, note chaque erreur ci-dessus : ce qui s'est passé, son type, et la bonne idée."
                : "Aucune erreur avec ces filtres."}
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="t-label mb-1.5">
                    {group.label} · <span className="tabular">{group.entries.length}</span>
                  </p>
                  <ul className="divide-y divide-line border-y border-line">
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
    </Split>
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
