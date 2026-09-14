"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LayoutList, Settings, Target, TrendingUp, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * NAVIGATION — cinq destinations, deux outils.
 *
 * L'ordre n'est pas alphabétique ni historique : il suit la HIÉRARCHIE DES
 * QUESTIONS qu'un élève se pose, de la plus immédiate à la plus lointaine.
 *
 *   Aujourd'hui   qu'est-ce que je fais maintenant ?
 *   Calendrier    à quoi ressemblent mes prochains jours ?
 *   Tâches        qu'est-ce que j'ai à faire, en entier ?
 *   Planning      est-ce que ça tient ?
 *   Bilan         est-ce que j'ai avancé, et que changer ?
 *
 * « Objectifs » et « Réglages » passent en icônes : ce ne sont pas des lieux
 * où l'on travaille, on y va pour régler quelque chose puis on en ressort.
 *
 * Une barre haute plutôt qu'une colonne latérale : 56 px coûtent 6 % de la
 * hauteur d'écran, là où une colonne de 240 px prélève un sixième de la
 * largeur en permanence. Sur mobile, elle est doublée d'une barre d'onglets
 * en bas — les mêmes cinq destinations, à portée de pouce.
 */
const DESTINATIONS = [
  { href: "/today", label: "Aujourd'hui", short: "Aujourd'hui", icon: Home },
  { href: "/calendar", label: "Calendrier", short: "Calendrier", icon: CalendarDays },
  { href: "/tasks", label: "Tâches", short: "Tâches", icon: LayoutList },
  { href: "/planning", label: "Planning", short: "Planning", icon: Gauge },
  { href: "/review", label: "Bilan", short: "Bilan", icon: TrendingUp },
];

const TOOLS = [
  { href: "/goals", label: "Objectifs", icon: Target },
  { href: "/settings", label: "Réglages", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const isActive = useActive();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-[6px]">
        <div className="mx-auto flex h-14 max-w-[var(--shell-max)] items-center gap-2 px-4 sm:px-6">
          <Link
            href="/today"
            className="mr-1 flex min-h-11 shrink-0 items-center gap-2 rounded pr-2 lg:mr-6 lg:min-h-0 lg:py-1"
            aria-label="TaekdHub — accueil"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Sections" className="hidden min-w-0 items-center lg:flex">
            {DESTINATIONS.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-[1.125rem] text-sm transition-colors",
                    active ? "font-medium text-ink" : "text-muted hover:text-ink"
                  )}
                >
                  {label}
                  {/* Le repère actif est un TRAIT posé sur le filet de la barre,
                      pas une pastille derrière le mot : il se lit comme un
                      onglet et n'ajoute aucune surface. En CSS pur — seule son
                      échelle horizontale change, donc rien à mesurer en JS. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-[2px] origin-center rounded-full bg-accent transition-transform duration-300 ease-out",
                      active ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
                    "grid h-9 w-9 place-items-center rounded-lg transition-colors max-lg:h-11 max-lg:w-11",
                    active ? "bg-inset text-ink" : "text-muted hover:bg-inset hover:text-ink"
                  )}
                >
                  <Icon size={17} strokeWidth={1.75} />
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[6px] lg:hidden"
      >
        {DESTINATIONS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 pb-1 pt-1.5 text-[0.6875rem] transition-colors",
                active ? "text-ink" : "text-subtle"
              )}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.6} />
              <span className={cn("leading-none", active && "font-medium")}>{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * SIGNATURE — le nom composé dans le serif du produit, avec une seule marque
 * graphique : un trait d'accent sous la première syllabe. Pas de carré arrondi
 * avec une étincelle dedans : c'est le logo par défaut de tous les outils de
 * productivité depuis dix ans.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("t-wordmark relative text-ink", className)}>
      Taekd
      <span className="text-muted">Hub</span>
      <span aria-hidden className="absolute -bottom-[3px] left-0 h-[2px] w-[2.35em] rounded-full bg-accent-brand" />
    </span>
  );
}
