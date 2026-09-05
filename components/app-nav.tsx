"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Clock3, History, Home, Settings, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * NAVIGATION — une barre haute, pas une colonne latérale.
 *
 * La barre latérale de 240 px prélevait un sixième d'un écran de portable sur
 * toute la hauteur, en permanence, pour afficher sept liens et beaucoup de
 * vide. Or TaekdHub est un produit de LECTURE : ce qu'il faut donner à
 * l'écran, c'est de la largeur pour le contenu et une mesure de texte stable,
 * pas un meuble vertical.
 *
 * Une barre haute de 56 px coûte 6 % de la hauteur, disparaît complètement en
 * mode focus, et donne la même géométrie sur les trois formats. Sur mobile,
 * elle est doublée d'une barre d'onglets en bas — les mêmes destinations, à
 * portée de pouce.
 *
 * SEPT entrées sont devenues CINQ destinations + deux outils. « Focus » et
 * « Réglages » ne sont pas des lieux où l'on va travailler : ce sont des
 * outils, ils passent en icônes à droite. « Séance » n'est pas une
 * destination non plus, c'est l'ACTION — elle est déclenchée depuis l'écran
 * d'accueil, où elle est le premier élément.
 */
const DESTINATIONS = [
  { href: "/dashboard", label: "Aujourd'hui", short: "Aujourd'hui", icon: Home },
  { href: "/exercises", label: "Exercices", short: "Exercices", icon: BookOpen },
  { href: "/concours", label: "Concours", short: "Concours", icon: Trophy },
  { href: "/progress", label: "Progression", short: "Progrès", icon: BarChart3 },
  { href: "/history", label: "Séances", short: "Séances", icon: History },
];

const TOOLS = [
  { href: "/timer", label: "Chronomètre", icon: Clock3 },
  { href: "/settings", label: "Réglages", icon: Settings },
];

/** Une section est active si l'URL commence par son chemin — les écrans de détail (`/exercises?...`) gardent leur onglet allumé. */
function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const isActive = useActive();

  return (
    <>
      {/* ── BARRE HAUTE ────────────────────────────────────────────
          `sticky` et non `fixed` : la page garde son flux normal, donc aucun
          décalage à compenser en haut du contenu, et la barre ne recouvre
          jamais une ancre atteinte au clavier. */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-[6px]">
        <div className="mx-auto flex h-14 max-w-[var(--shell-max)] items-center gap-2 px-4 sm:px-6">
          <Link
            href="/dashboard"
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
                  {/* Le repère actif est un TRAIT posé sur le filet de la
                      barre, pas une pastille derrière le mot : il se lit comme
                      un onglet et n'ajoute aucune surface. En CSS pur : il est
                      toujours présent, et seule son échelle horizontale change
                      — donc il se déploie depuis le centre sans qu'aucun
                      JavaScript n'ait à mesurer quoi que ce soit. */}
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

      {/* ── BARRE D'ONGLETS MOBILE ─────────────────────────────────
          Cinq cibles de 44 px minimum, ancrées au bas de l'écran, avec la
          marge de sécurité des téléphones à encoche. */}
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
 * graphique : un trait d'accent sous la première syllabe. Pas de carré
 * arrondi avec une étincelle dedans : c'est le logo par défaut de tous les
 * outils de productivité depuis dix ans.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("t-wordmark relative text-ink", className)}>
      Taekd
      <span className="text-muted">Hub</span>
      <span
        aria-hidden
        className="absolute -bottom-[3px] left-0 h-[2px] w-[2.35em] rounded-full bg-accent-brand"
      />
    </span>
  );
}
