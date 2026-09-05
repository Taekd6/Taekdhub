"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * SYSTÈME DE MISE EN PAGE.
 *
 * Ce qui manquait jusqu'ici : TOUS les écrans étaient la même colonne
 * centrée, un en-tête en haut puis des sections empilées de haut en bas. On
 * pouvait changer les polices, les couleurs et les composants — la structure
 * restait identique d'un écran à l'autre, et surtout identique à ce qu'elle
 * avait toujours été. Un empilement vertical impose deux choses fausses :
 *
 *   — il n'existe qu'UN axe de lecture, donc toute information secondaire
 *     coûte un défilement à l'information principale ;
 *   — sur un écran de 1440 px, la moitié droite est vide pendant qu'on fait
 *     défiler la moitié gauche.
 *
 * Trois compositions, choisies selon la QUESTION que l'écran doit résoudre :
 *
 *   `Workbench`   un volet de navigation persistant + une zone de travail.
 *                 Pour explorer un ensemble (la banque d'exercices) : on doit
 *                 pouvoir changer de chapitre sans perdre sa liste.
 *
 *   `Split`       une colonne principale + un rail secondaire.
 *                 Pour décider (l'accueil) : « ce que je fais » à gauche,
 *                 « où j'en suis » à droite, simultanément.
 *
 *   `Stack`       une colonne unique bornée à la mesure de lecture.
 *                 Pour lire ou saisir (réglages, un formulaire).
 *
 * En dessous de `lg`, les trois se replient sur une colonne — mais dans un
 * ORDRE choisi par l'appelant, pas dans l'ordre du DOM.
 */

/** Bandeau d'écran : le titre vit DANS la composition, pas au-dessus d'elle. */
export function PageBar({
  title,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** Une ligne de contexte : un compte, une date, un fil d'Ariane. Jamais un paragraphe d'explication. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="t-display">{title}</h1>
        {meta && <div className="t-meta mt-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * VOLET + ZONE DE TRAVAIL.
 *
 * Le volet est COLLANT et défile indépendamment : on garde l'arborescence des
 * chapitres sous les yeux pendant qu'on parcourt trois cents exercices. C'est
 * la différence entre un site qu'on visite et un outil qu'on utilise.
 */
export function Workbench({
  pane,
  children,
  paneLabel,
  paneSummary,
  scopeKey,
}: {
  pane: React.ReactNode;
  children: React.ReactNode;
  /** Nomme le volet pour les lecteurs d'écran — « Navigation de la banque », par exemple. */
  paneLabel: string;
  /** Ce que le déclencheur mobile affiche : la sélection courante. */
  paneSummary: React.ReactNode;
  /**
   * Identifie la sélection courante. Quand elle change, le volet mobile se
   * referme tout seul — parce qu'on vient précisément de choisir, et que ce
   * qu'on veut voir ensuite est le résultat, pas de nouveau la liste des
   * choix. Passer par une clé plutôt que par un callback évite d'enfiler une
   * fonction « fermer le volet » à travers tout le navigateur.
   */
  scopeKey: string;
}) {
  /*
   * SUR MOBILE, LE VOLET EST REPLIÉ PAR DÉFAUT.
   *
   * Déplié, il plaçait 26 chapitres avant le premier exercice : il fallait
   * traverser tout l'arbre pour atteindre le contenu, ce qui est exactement
   * le défaut qu'un volet persistant est censé corriger sur grand écran.
   * Replié, on arrive sur la liste, et l'arbre est à une frappe.
   */
  const [open, setOpen] = useState(false);
  const previousScope = useRef(scopeKey);
  useEffect(() => {
    if (previousScope.current === scopeKey) return;
    previousScope.current = scopeKey;
    setOpen(false);
  }, [scopeKey]);

  return (
    <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-9">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="row-hover mb-4 flex min-h-11 w-full items-center gap-2 rounded-lg border border-line px-3 text-left text-sm lg:hidden"
      >
        <span className="t-label shrink-0">Parcourir</span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{paneSummary}</span>
        <ChevronDown size={15} className={cn("shrink-0 text-subtle transition-transform duration-150", open && "rotate-180")} />
      </button>

      <aside
        aria-label={paneLabel}
        className={cn(
          "scrollbar-none",
          open ? "mb-6 border-b border-line pb-5" : "hidden",
          // À partir de `lg`, le volet est toujours là, collant et défilant
          // indépendamment de la zone de travail.
          "lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:mb-0 lg:block lg:max-h-[calc(100vh-var(--nav-h)-3rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8"
        )}
      >
        {pane}
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * COLONNE PRINCIPALE + RAIL.
 *
 * Le rail passe SOUS le contenu principal en dessous de `lg` — jamais
 * au-dessus : sur un téléphone, la première chose à l'écran doit rester
 * l'action, pas les compteurs.
 */
export function Split({
  children,
  rail,
  railLabel,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  railLabel: string;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={railLabel}
        className="mt-10 border-t border-line pt-8 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:mt-0 lg:h-fit lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
      >
        {rail}
      </aside>
    </div>
  );
}

/** Colonne unique bornée à la mesure de lecture — écrans de saisie et de lecture. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("measure-wide", className)}>{children}</div>;
}
