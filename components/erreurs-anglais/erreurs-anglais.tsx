"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Shuffle, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import {
  ERREURS_ANGLAIS,
  ERREURS_CATEGORIES,
  ERREURS_MAJ,
  filterByCategory,
  formatDate,
  groupByCategory,
  shuffledOrder,
  sortByOrder,
  type ErreurAnglais,
} from "@/lib/erreurs-anglais";

const ALL = "all";

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/**
 * /erreurs-anglais — MES ERREURS D'ANGLAIS (lib/erreurs-anglais.ts).
 *
 *   Lecture   les erreurs rangées par catégorie : la règle en encadré, puis
 *             pour chaque erreur la phrase, ma version barrée, la correction.
 *   Révision  l'interrupteur cache la correction ; on la découvre en touchant
 *             la carte. Ma version fausse reste visible : c'est elle qu'il
 *             faut corriger de tête. « Mélanger » abandonne les groupes (qui
 *             disent déjà de quelle règle il s'agit) pour une seule pile dans
 *             un ordre au hasard ; la catégorie n'apparaît qu'avec la correction.
 *
 * Pensée pour l'iPad, au doigt : 18 px au minimum (même la source et la
 * date), cartes entières cliquables, et une icône en plus de la couleur
 * (✗ / ✓) pour ne pas dépendre du rouge et du vert. Rien n'est stocké : le
 * contenu vient de data/erreurs-anglais.json.
 */
export function ErreursAnglais() {
  const [revision, setRevision] = useState(false);
  const [category, setCategory] = useState<string>(ALL);
  const [order, setOrder] = useState<number[] | null>(null);
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set());

  const allGroups = useMemo(() => groupByCategory(ERREURS_CATEGORIES, ERREURS_ANGLAIS), []);
  const visible = useMemo(() => filterByCategory(ERREURS_CATEGORIES, ERREURS_ANGLAIS, category === ALL ? null : category), [category]);
  const groups = useMemo(() => groupByCategory(ERREURS_CATEGORIES, visible), [visible]);
  const mixed = useMemo(() => (revision && order ? sortByOrder(visible, order) : null), [revision, order, visible]);
  const categoryName = useMemo(() => new Map(allGroups.map((group) => [group.categorie.id, group.categorie.nom])), [allGroups]);

  function toggleRevision() {
    setRevision((on) => !on);
    setOrder(null);
    setShown(new Set());
  }

  function shuffle() {
    setOrder(shuffledOrder(ERREURS_ANGLAIS.map((erreur) => erreur.id)));
    setShown(new Set());
  }

  function toggleCard(id: number) {
    setShown((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const lede = ERREURS_MAJ
    ? `${plural(ERREURS_ANGLAIS.length, "erreur")} de thème, mises à jour le ${formatDate(ERREURS_MAJ)}.`
    : `${plural(ERREURS_ANGLAIS.length, "erreur")} de thème.`;

  const renderCard = (erreur: ErreurAnglais) =>
    revision ? (
      <li key={erreur.id}>
        <button
          type="button"
          aria-expanded={shown.has(erreur.id)}
          onClick={() => toggleCard(erreur.id)}
          className="press block w-full cursor-pointer rounded-2xl bg-inset px-5 py-5 text-left sm:px-6"
        >
          <CardBody erreur={erreur} correction={shown.has(erreur.id)} categoryName={mixed ? categoryName.get(erreur.categorie) ?? null : null} />
        </button>
      </li>
    ) : (
      <li key={erreur.id}>
        <article className="rounded-2xl bg-inset px-5 py-5 sm:px-6">
          <CardBody erreur={erreur} correction categoryName={null} />
        </article>
      </li>
    );

  return (
    <div className="mx-auto max-w-[56rem] space-y-8 sm:space-y-10">
      {/* Le chapeau de PageHero (`lede`) est à 16 px : ici le plancher est 18 px, le texte passe donc en enfant. */}
      <PageHero title="Mes erreurs d'anglais" illustration={<Illustration name="erreurs" size={56} />}>
        <p className="mt-1.5 max-w-[46ch] text-lg font-semibold leading-snug text-muted">{lede}</p>
      </PageHero>

      {ERREURS_ANGLAIS.length === 0 ? (
        <Section variant="panel">
          <EmptyState title="Aucune erreur pour l'instant" description="Les erreurs viennent de data/erreurs-anglais.json : ajoute des lignes à « erreurs » pour les voir ici." />
        </Section>
      ) : (
        <>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="button"
                role="switch"
                aria-checked={revision}
                onClick={toggleRevision}
                className="press inline-flex min-h-12 items-center gap-3 rounded-full pr-2 text-lg font-semibold text-ink"
              >
                <span aria-hidden className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200", revision ? "bg-accent-solid" : "bg-inset")}>
                  <span className={cn("absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-surface transition-transform duration-200", revision && "translate-x-6")} />
                </span>
                Mode révision
              </button>

              {revision && (
                <Button type="button" variant="secondary" size="lg" className="text-lg" onClick={shuffle}>
                  <Shuffle size={20} aria-hidden /> Mélanger
                </Button>
              )}
              {mixed && (
                <Button type="button" variant="ghost" size="lg" className="text-lg" onClick={() => setOrder(null)}>
                  <Undo2 size={20} aria-hidden /> Par catégorie
                </Button>
              )}
            </div>

            <div role="group" aria-label="Catégorie" className="flex flex-wrap gap-2.5">
              {[{ id: ALL, nom: "Toutes", count: ERREURS_ANGLAIS.length }, ...allGroups.map((group) => ({ id: group.categorie.id, nom: group.categorie.nom, count: group.erreurs.length }))].map((option) => {
                const active = option.id === category;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(option.id)}
                    className={cn(
                      "press inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-lg font-semibold",
                      active ? "chip-on text-ink" : "bg-inset text-muted hover:text-ink"
                    )}
                  >
                    {option.nom}
                    <span className={cn("tabular font-medium", active ? "text-muted" : "text-subtle")}>{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {mixed ? (
            <Section variant="panel" title="Mélange" action={<span className="text-lg font-semibold text-muted">{plural(mixed.length, "erreur")}</span>}>
              <ul className="space-y-4">{mixed.map(renderCard)}</ul>
            </Section>
          ) : (
            groups.map((group) => (
              <Section
                key={group.categorie.id}
                variant="panel"
                title={group.categorie.nom}
                action={<span className="text-lg font-semibold text-muted">{plural(group.erreurs.length, "erreur")}</span>}
              >
                <p className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-lg leading-relaxed text-ink">
                  <span className="font-bold">Règle · </span>
                  {group.categorie.regle}
                </p>
                <ul className="space-y-4">{group.erreurs.map(renderCard)}</ul>
              </Section>
            ))
          )}
        </>
      )}
    </div>
  );
}

/**
 * Le contenu d'une carte — des `span` en bloc, pas des `div` : en mode
 * révision il est posé dans un `<button>`, qui n'accepte que du texte et des
 * éléments « en ligne ».
 *
 * `correction` faux = la correction est cachée et remplacée par une invite.
 * Elle n'est alors PAS dans la page (ni lue par un lecteur d'écran).
 */
function CardBody({ erreur, correction, categoryName }: { erreur: ErreurAnglais; correction: boolean; categoryName: string | null }) {
  return (
    <>
      <span className="t-read block font-semibold text-ink">{erreur.francais}</span>

      <span className="mt-4 flex items-start gap-3 text-rose-300">
        <X size={22} strokeWidth={2.6} aria-hidden className="mt-[0.35rem] shrink-0" />
        <span className="t-read min-w-0 line-through decoration-2">
          <span className="sr-only">Ma version, fausse : </span>
          {erreur.faux}
        </span>
      </span>

      {correction ? (
        <span className="mt-3 flex items-start gap-3 text-emerald-300">
          <Check size={22} strokeWidth={2.6} aria-hidden className="mt-[0.35rem] shrink-0" />
          <span className="t-read min-w-0 font-semibold">
            <span className="sr-only">Correction : </span>
            {erreur.correct}
          </span>
        </span>
      ) : (
        <span className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border-2 border-dashed border-line px-4 text-lg font-semibold text-muted">
          <Eye size={22} aria-hidden className="shrink-0" />
          Touche la carte pour voir la correction
        </span>
      )}

      <span className="mt-4 block text-lg text-muted">
        {categoryName && correction && <span className="font-semibold">{categoryName} · </span>}
        {erreur.source} · {formatDate(erreur.date)}
      </span>
    </>
  );
}
