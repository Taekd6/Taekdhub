"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * RANGÉE DE RACCOURCIS ILLUSTRÉS — le « chapternav » d'apple.com : sous la
 * barre haute, une ligne de petites vignettes, chacune un dessin au-dessus
 * d'un mot court. C'est elle qui donne « envie de cliquer partout » : on voit
 * d'un coup d'œil tout ce qu'un écran contient, et chaque entrée a un visage.
 *
 * API
 *
 *   items       `{ href, label, icon }[]` — `icon` est un nœud React : une
 *               illustration (`<SubjectIllustration subject=… />`,
 *               `<Illustration name=… />`, components/ui/illustrations.tsx)
 *               ou une icône. Taille conseillée : 36 à 44 px.
 *   activeHref  lien actif imposé. Absent : le lien dont le chemin ET la
 *               requête correspondent à l'URL courante (ou, à défaut, le
 *               premier dont le chemin correspond).
 *   ariaLabel   nom du repère de navigation (« Matières », « Outils »…).
 *
 * COMPORTEMENT
 *
 *   — Centrée sur grand écran ; sur mobile, la rangée DÉFILE horizontalement
 *     (sans barre visible, avec accroche douce) et déborde jusqu'aux bords
 *     de l'écran : la vignette coupée à droite dit « il y en a d'autres ».
 *   — Au survol, le dessin monte de 3 px et passe du gris à l'encre ; à
 *     l'appui, toute la vignette s'enfonce (`.press`).
 *   — L'entrée active : dessin à l'encre, libellé à l'encre en gras, et un
 *     trait de 2 px sous le libellé. `aria-current="page"`.
 *   — Clavier : ce sont de simples liens, dans l'ordre de lecture ; le focus
 *     est visible (règle globale `:focus-visible`) et fait défiler la rangée.
 *   — Mouvement réduit : plus de montée au survol (règle globale).
 */
export interface ChapterNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function matches(href: string, pathname: string, search: string): "exact" | "path" | false {
  const [path, query = ""] = href.split("?");
  if (path !== pathname) return false;
  if (!query) return "path";
  return search.replace(/^\?/, "") === query ? "exact" : false;
}

export function ChapterNav({
  items,
  activeHref,
  ariaLabel,
  className,
}: {
  items: ChapterNavItem[];
  activeHref?: string;
  ariaLabel: string;
  className?: string;
}) {
  const pathname = usePathname();
  // `useSearchParams` obligerait chaque page qui monte la rangée à se
  // mettre sous <Suspense> ; la requête n'est utile qu'au départage entre
  // deux liens de même chemin, donc lue APRÈS montage (le rendu serveur et
  // le premier rendu client restent identiques — pas d'écart d'hydratation).
  const [search, setSearch] = useState("");
  useEffect(() => {
    const read = () => setSearch(window.location.search);
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [pathname]);
  const active =
    activeHref ??
    items.find((item) => matches(item.href, pathname, search) === "exact")?.href ??
    items.find((item) => matches(item.href, pathname, search) === "path")?.href;

  return (
    <nav aria-label={ariaLabel} className={cn("-mx-4 sm:-mx-6", className)}>
      <ul className="scrollbar-none flex snap-x snap-proximity gap-1 overflow-x-auto px-4 sm:px-6 lg:justify-center lg:gap-3">
        {items.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href} className="snap-start">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "press group flex min-w-[5.5rem] flex-col items-center gap-2 whitespace-nowrap rounded-2xl px-2 pb-2 pt-3 text-center",
                  current ? "text-ink" : "text-muted hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "grid h-11 place-items-center transition-[transform,color] duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-[3px] motion-reduce:group-hover:translate-y-0",
                    current ? "text-ink" : "text-subtle group-hover:text-ink"
                  )}
                >
                  {item.icon}
                </span>
                <span className={cn("relative text-xs leading-tight", current ? "font-bold" : "font-medium")}>
                  {item.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-ink transition-opacity duration-300",
                      current ? "opacity-100" : "opacity-0"
                    )}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
