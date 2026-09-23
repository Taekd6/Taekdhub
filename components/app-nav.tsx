"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Clock3, History, Home, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * NAVIGATION — une barre haute, pas une colonne latérale.
 *
 * TaekdHub est un produit de LECTURE : ce qu'il faut donner à l'écran, c'est
 * de la largeur pour le contenu, pas un meuble vertical. La barre haute coûte
 * 64 px, et donne la même géométrie sur les trois formats. Sur mobile, elle
 * est doublée d'une barre d'onglets en bas — les mêmes destinations, à
 * portée de pouce.
 *
 * QUATRE destinations + deux outils. « Chronomètre » et « Réglages » ne sont
 * pas des lieux où l'on va travailler : ce sont des outils, en icônes à
 * droite.
 *
 * PAS DE BANQUE, PAS DE CONCOURS : l'élève travaille sur ses propres
 * feuilles et ne fait qu'y consigner son temps et ses notes. La banque
 * d'exercices intégrée — et l'écran Concours, qui en dépendait — ont été
 * retirés.
 */
const DESTINATIONS = [
  { href: "/dashboard", label: "Aujourd'hui", short: "Aujourd'hui", icon: Home },
  { href: "/preparation", label: "Matières", short: "Matières", icon: Layers },
  { href: "/progress", label: "Progression", short: "Progrès", icon: BarChart3 },
  { href: "/history", label: "Séances", short: "Séances", icon: History },
];

const TOOLS = [
  { href: "/timer", label: "Chronomètre", icon: Clock3 },
  { href: "/settings", label: "Réglages", icon: Settings },
];

/** Une section est active si l'URL commence par son chemin — les écrans de détail (`/preparation?...`) gardent leur onglet allumé. */
function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * PASTILLE ACTIVE QUI GLISSE — mesurée, pas devinée.
 *
 * Une seule pastille, positionnée sous le lien actif et déplacée en
 * `transform` quand on change d'écran : l'œil suit le déplacement et sait où
 * il est arrivé. Les liens n'ayant pas la même largeur (« Aujourd'hui » contre
 * « Séances »), la position et la largeur sont LUES dans le DOM, et relues au
 * redimensionnement (changement de police, zoom). Tant qu'aucune mesure n'a
 * eu lieu (premier rendu serveur), la pastille est invisible plutôt que mal
 * placée.
 */
function useIndicator(activeIndex: number) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const target = activeIndex >= 0 ? (list.children[activeIndex + 1] as HTMLElement | undefined) : undefined;
      setBox(target ? { left: target.offsetLeft, width: target.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex]);

  return { listRef, box };
}

export function AppNav() {
  const isActive = useActive();
  const activeIndex = DESTINATIONS.findIndex(({ href }) => isActive(href));
  const { listRef, box } = useIndicator(activeIndex);

  return (
    <>
      {/* ── BARRE HAUTE ────────────────────────────────────────────
          `sticky` et non `fixed` : la page garde son flux normal, et la
          barre ne recouvre jamais une ancre atteinte au clavier. */}
      <header className="sticky top-0 z-40 border-b border-hairline/[0.07] bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[var(--shell-max)] items-center gap-2 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="mr-1 flex min-h-11 shrink-0 items-center rounded-lg pr-2 lg:mr-8"
            aria-label="TaekdHub — accueil"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Sections" className="hidden min-w-0 lg:block">
            <div ref={listRef} className="relative flex items-center gap-1 rounded-full bg-inset p-1">
              {/* Pastille glissante — premier enfant, d'où `activeIndex + 1` à la mesure. */}
              <span
                aria-hidden
                className={cn(
                  "chip-on pointer-events-none absolute bottom-1 top-1 left-0 rounded-full transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
                  box ? "opacity-100" : "opacity-0"
                )}
                style={box ? { width: box.width, transform: `translateX(${box.left}px)` } : undefined}
              />
              {DESTINATIONS.map(({ href, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press relative z-10 rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
                      active ? "text-ink" : "text-muted hover:text-ink"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {TOOLS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press grid h-10 w-10 place-items-center rounded-full transition-colors max-lg:h-11 max-lg:w-11",
                    active ? "chip-on" : "text-muted hover:bg-inset hover:text-ink"
                  )}
                >
                  <Icon size={18} strokeWidth={2} />
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── BARRE D'ONGLETS MOBILE ─────────────────────────────────
          Cinq cibles de 56 px de haut, ancrées au bas de l'écran, avec la
          marge de sécurité des téléphones à encoche. L'onglet actif pose une
          pastille derrière son icône, qui s'ouvre depuis le centre. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline/[0.07] bg-canvas/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {DESTINATIONS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 pb-1.5 pt-1.5 text-[0.6875rem] font-bold transition-colors",
                active ? "text-ink" : "text-subtle"
              )}
            >
              <span className="relative grid h-7 w-12 place-items-center">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-full bg-accent/[0.16] transition-[transform,opacity] duration-300 ease-out",
                    active ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  )}
                />
                <Icon size={19} strokeWidth={active ? 2.4 : 2} className={cn("relative", active && "text-accent")} />
              </span>
              <span className="leading-none">{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * SIGNATURE — le nom, en Nunito noir (900), avec « Hub » à la couleur
 * d'accent et un point qui la rappelle. Pas de carré arrondi avec une
 * étincelle dedans : c'est le logo par défaut de tous les outils de
 * productivité depuis dix ans.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("t-wordmark inline-flex items-baseline text-ink", className)}>
      Taekd
      <span className="text-accent">Hub</span>
      <span aria-hidden className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-brand" />
    </span>
  );
}
