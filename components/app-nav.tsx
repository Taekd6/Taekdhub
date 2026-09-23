"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Clock3, History, Home, Layers, Settings, Trophy } from "lucide-react";
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
 * CINQ destinations + deux outils. « Chronomètre » et « Réglages » ne sont
 * pas des lieux où l'on va travailler : ce sont des outils, en icônes à
 * droite. « Séance » n'est pas une destination non plus, c'est l'ACTION —
 * elle part de l'écran d'accueil.
 *
 * LA BANQUE N'EST PLUS UNE DESTINATION : TaekdHub pilote une progression, il
 * ne vend pas un catalogue. Elle reste atteignable depuis chaque hub, et
 * /exercises répond toujours.
 */
const DESTINATIONS = [
  { href: "/dashboard", label: "Aujourd'hui", short: "Aujourd'hui", icon: Home },
  { href: "/preparation", label: "Matières", short: "Matières", icon: Layers },
  { href: "/concours", label: "Concours", short: "Concours", icon: Trophy },
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
          La barre d'apple.com : translucide (le contenu passe DESSOUS,
          flouté et saturé), 56 px, aucun cadre — un filet d'un pixel à
          peine visible la sépare de la page. `sticky` et non `fixed` : la
          page garde son flux normal, et la barre ne recouvre jamais une
          ancre atteinte au clavier. */}
      <header className="sticky top-0 z-40 border-b border-hairline/[0.07] bg-canvas/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[var(--shell-max)] items-center gap-2 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="press mr-1 flex min-h-11 shrink-0 items-center rounded-lg pr-2 lg:mr-6"
            aria-label="TaekdHub — accueil"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Sections" className="hidden min-w-0 lg:block">
            <div ref={listRef} className="relative flex items-center gap-0.5">
              {/* Pastille glissante — premier enfant, d'où `activeIndex + 1`
                  à la mesure. Un simple voile, pas un bouton : la barre reste
                  du texte, comme sur apple.com, et la pastille dit seulement
                  « tu es ici ». */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 top-0 rounded-full bg-hairline/[0.10] transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
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
                      "press relative z-10 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200",
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
                    "press grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 max-lg:h-11 max-lg:w-11",
                    active ? "bg-hairline/[0.10] text-ink" : "text-muted hover:text-ink"
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
          La barre d'onglets d'iOS : translucide, floutée, cinq cibles de
          56 px avec la marge de sécurité des téléphones à encoche. L'onglet
          actif prend l'accent (icône ET libellé), les autres restent gris —
          pas de pastille, pas de fond. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline/[0.07] bg-canvas/75 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        {DESTINATIONS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2 text-[0.6875rem] font-semibold transition-colors duration-200",
                active ? "text-accent" : "text-subtle"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="leading-none">{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * SIGNATURE — le nom, en noir franc (800), d'une seule couleur : l'encre.
 * Plus de « Hub » à l'accent ni de point de couleur — l'accent est réservé
 * à l'action, et la marque d'Apple n'est jamais en bleu.
 */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("t-wordmark inline-flex items-baseline text-ink", className)}>TaekdHub</span>;
}
