"use client";

import { useEffect, useMemo, useState } from "react";
import { PageBar, Split } from "@/components/ui/layout";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { ReviewCapture, ReviewList } from "@/components/review/review-capture";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { countBySubject, isOpen, REVIEW_KIND_META, selectReviewItems } from "@/lib/review-items";
import { REVIEW_KINDS, type ReviewKind } from "@/lib/storage";
import { subjectMeta, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE CARNET « À REVOIR » EN ENTIER.
 *
 * L'accueil n'en montre que six lignes, le hub d'une matière que la sienne :
 * ici, tout, filtrable par matière et par nature. C'est l'écran qu'on ouvre
 * le dimanche pour faire le tri, ou la veille d'un DS pour relire ses
 * cartouches — pas celui où l'on note au fil de l'eau, même si la saisie y
 * est aussi.
 *
 * Composition `Split`, comme l'accueil et les échéances : la liste à gauche,
 * l'état du carnet (combien d'ouvertes, où) à droite. Aucune statistique
 * inventée : des comptes, et rien d'autre.
 *
 * Les entrées cochées sont repliées par défaut — SAUF quand on regarde les
 * méthodes : une cartouche maîtrisée fait toujours partie du recueil (voir
 * lib/review-items.ts), la cacher derrière un clic reviendrait à la traiter
 * comme une tâche finie.
 */
export function ReviewNotebook() {
  const { reviewItems, saveReviewItems, ready } = usePrepahubData();
  const [subject, setSubject] = useState<Subject | "all">("all");
  const [kind, setKind] = useState<ReviewKind | "all">("all");
  const [showDone, setShowDone] = useState(false);

  // `?subject=` / `?kind=` — arriver ici depuis le hub d'une matière déjà
  // filtré. Lu au montage plutôt que par `useSearchParams`, qui imposerait
  // une limite Suspense pour un simple état initial.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedSubject = params.get("subject");
    const wantedKind = params.get("kind");
    if (wantedSubject && (subjects as string[]).includes(wantedSubject)) setSubject(wantedSubject as Subject);
    if (wantedKind && (REVIEW_KINDS as string[]).includes(wantedKind)) setKind(wantedKind as ReviewKind);
  }, []);

  const counts = useMemo(() => countBySubject(reviewItems), [reviewItems]);
  const scoped = useMemo(
    () => selectReviewItems(reviewItems, { subject: subject === "all" ? null : subject, kind: kind === "all" ? null : kind }),
    [reviewItems, subject, kind]
  );
  const open = scoped.filter(isOpen);
  const done = scoped.filter((item) => !isOpen(item));
  const doneExpanded = showDone || kind === "méthode";
  const openTotal = counts.reduce((sum, entry) => sum + entry.open, 0);

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  // Le filtre ne propose que les matières qui ont au moins une entrée — plus
  // celle qui est sélectionnée, pour qu'un lien `?subject=` vers une matière
  // encore vide n'affiche pas un sélecteur sans rien d'allumé.
  const subjectOptions = subjects.filter((entry) => counts.some((count) => count.subject === entry) || entry === subject);

  return (
    <Split
      railLabel="État du carnet"
      rail={
        <div className="space-y-6">
          <div>
            <p className="t-label">Ouvertes</p>
            <p className="t-figure-md tabular mt-1">{openTotal}</p>
            <p className="t-meta mt-0.5 text-2xs">
              sur {reviewItems.length} entrée{reviewItems.length > 1 ? "s" : ""} notée{reviewItems.length > 1 ? "s" : ""}
            </p>
          </div>
          {counts.length > 0 && (
            <ul className="divide-y divide-line border-y border-line">
              {counts.map((entry) => (
                <li key={entry.subject}>
                  <button
                    type="button"
                    onClick={() => setSubject(subject === entry.subject ? "all" : entry.subject)}
                    aria-pressed={subject === entry.subject}
                    className={cn(
                      "row-hover flex w-full items-center gap-2.5 rounded-md py-2 text-left max-lg:min-h-11",
                      subject === entry.subject && "bg-inset"
                    )}
                  >
                    <SubjectAvatar subject={entry.subject} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">{entry.subject}</span>
                    <span className="tabular shrink-0 text-2xs text-muted">
                      {entry.open} / {entry.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="t-meta text-2xs">
            Une méthode cochée est « maîtrisée » : elle quitte l&apos;accueil mais reste dans le recueil de sa matière.
          </p>
        </div>
      }
    >
      <div className="space-y-8">
        <PageBar
          title="À revoir"
          lede="Ce que tu as noté en relisant tes corrigés — à revoir, à apprendre, et les méthodes que tu en as tirées."
        />

        <ReviewCapture items={reviewItems} saveItems={saveReviewItems} ready={ready} showList={false} />

        <Section
          label="Le carnet"
          title={kind === "méthode" ? "Cartouches" : "Entrées"}
          action={
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {subjectOptions.length > 1 && (
                <SegmentedControl
                  size="sm"
                  ariaLabel="Matière"
                  value={subject}
                  onChange={setSubject}
                  options={[
                    { value: "all" as const, label: "Toutes" },
                    ...subjectOptions.map((entry) => ({ value: entry, label: subjectMeta[entry].short })),
                  ]}
                />
              )}
              <SegmentedControl
                size="sm"
                ariaLabel="Nature"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all" as const, label: "Tout" },
                  ...REVIEW_KINDS.map((value) => ({ value, label: REVIEW_KIND_META[value].filter })),
                ]}
              />
            </div>
          }
        >
          <ReviewList
            items={reviewItems}
            saveItems={saveReviewItems}
            rows={open}
            showSubject={subject === "all"}
            showKind={kind === "all"}
            emptyText={
              reviewItems.length === 0
                ? "Le carnet est vide. Tape une ligne ci-dessus — « Revoir intégration par parties » — puis Entrée."
                : "Rien d'ouvert avec ces filtres."
            }
          />

          {done.length > 0 && (
            <div className="mt-6">
              {doneExpanded ? (
                <>
                  <p className="t-label mb-2">
                    {kind === "méthode" ? "Maîtrisées" : "Cochées"} · <span className="tabular">{done.length}</span>
                  </p>
                  <ReviewList items={reviewItems} saveItems={saveReviewItems} rows={done} showSubject={subject === "all"} showKind={kind === "all"} />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDone(true)}
                  className="t-meta inline-flex min-h-6 items-center text-2xs text-accent hover:underline max-lg:min-h-11"
                >
                  {done.length > 1 ? `Voir les ${done.length} entrées cochées` : "Voir l'entrée cochée"}
                </button>
              )}
            </div>
          )}
        </Section>
      </div>
    </Split>
  );
}
