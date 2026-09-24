"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration } from "@/components/ui/illustrations";
import { FilterPills } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { ReviewCapture, ReviewList } from "@/components/review/review-capture";
import { DueToday } from "@/components/review/due-today";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { countBySubject, isOpen, REVIEW_KIND_META, selectReviewItems } from "@/lib/review-items";
import { REVIEW_KINDS, type ReviewKind } from "@/lib/storage";
import { subjects } from "@/lib/study";
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
 * Refonte « Apple » : grand titre illustré, la saisie et la liste dans des
 * tuiles, filtres en pastilles, et l'état du carnet dans une tuile collante à
 * droite (sous la liste sur téléphone). Comme avant : la liste à gauche,
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
    <div className="space-y-10">
      <PageHero
        title="À revoir"
        lede="Ce que tu as noté en relisant tes corrigés — à revoir, à apprendre, et les méthodes que tu en as tirées."
        illustration={<Illustration name="revisions" size={56} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.38fr)] lg:gap-8">
        <div className="min-w-0 space-y-5">
          {/* Révisions espacées — suit le filtre de matière du carnet. */}
          <DueToday items={reviewItems} subject={subject === "all" ? null : subject} />

          <Section variant="panel" title="Noter" description="Une ligne, Entrée, c'est noté — la matière est retenue d'une fois sur l'autre.">
            <ReviewCapture items={reviewItems} saveItems={saveReviewItems} ready={ready} showList={false} />
          </Section>

          <Section variant="panel" label="Le carnet" title={kind === "méthode" ? "Cartouches" : "Entrées"}>
            <div className="mb-6 space-y-3">
              <FilterPills
                ariaLabel="Nature"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all" as const, label: "Tout" },
                  ...REVIEW_KINDS.map((value) => ({ value, label: REVIEW_KIND_META[value].filter })),
                ]}
              />
              {subjectOptions.length > 1 && (
                <FilterPills
                  ariaLabel="Matière"
                  value={subject}
                  onChange={setSubject}
                  options={[
                    { value: "all" as const, label: "Toutes les matières" },
                    ...subjectOptions.map((entry) => ({ value: entry, label: entry, count: counts.find((count) => count.subject === entry)?.open })),
                  ]}
                />
              )}
            </div>

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
                  <Button variant="link" size="sm" className="px-0" onClick={() => setShowDone(true)}>
                    {done.length > 1 ? `Voir les ${done.length} entrées cochées` : "Voir l'entrée cochée"}
                  </Button>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* L'ÉTAT DU CARNET — une tuile collante à droite sur grand écran,
            sous la liste sur téléphone (l'action d'abord). */}
        <aside aria-label="État du carnet" className="surface h-fit p-6 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
          <p className="t-label">Ouvertes</p>
          <p className="t-figure-lg tabular mt-1">{openTotal}</p>
          <p className="t-meta mt-1 text-[0.8125rem]">
            sur {reviewItems.length} entrée{reviewItems.length > 1 ? "s" : ""} notée{reviewItems.length > 1 ? "s" : ""}
          </p>
          {counts.length > 0 && (
            <ul className="-mx-2 mt-5 space-y-0.5 border-t border-line pt-4">
              {counts.map((entry) => (
                <li key={entry.subject}>
                  <button
                    type="button"
                    onClick={() => setSubject(subject === entry.subject ? "all" : entry.subject)}
                    aria-pressed={subject === entry.subject}
                    className={cn(
                      "row-hover flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left",
                      subject === entry.subject && "bg-inset"
                    )}
                  >
                    <SubjectAvatar subject={entry.subject} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{entry.subject}</span>
                    <span className="tabular shrink-0 text-[0.8125rem] text-muted">
                      {entry.open} / {entry.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="t-meta mt-4 text-2xs">
            Une méthode cochée est « maîtrisée » : elle quitte l&apos;accueil mais reste dans le recueil de sa matière.
          </p>
        </aside>
      </div>
    </div>
  );
}
