"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * TRANSITIONS ENTRE LES PAGES — l'API View Transitions (voir app/globals.css,
 * bloc « NAVIGATION »). Un clic sur un lien interne qui change de page est
 * intercepté : le navigateur fige l'ancienne page, Next charge la nouvelle,
 * puis l'ancienne s'efface pendant que la nouvelle monte en se défloutant.
 * La barre de navigation (`.vt-nav-*`) ne bouge pas.
 *
 * AMÉLIORATION PROGRESSIVE : sans `document.startViewTransition` ou sous
 * `prefers-reduced-motion`, rien n'est intercepté et le lien se comporte
 * comme avant. Un clic modifié (Cmd/Ctrl/Maj/Alt, bouton du milieu), un lien
 * externe, `target`, `download` ou un simple changement de `?query`/`#ancre`
 * sur la même page ne sont pas touchés.
 *
 * Le clic est pris en phase de capture et `preventDefault` : le `<Link>` de
 * Next voit `defaultPrevented` et ne navigue pas lui-même ; c'est ce
 * composant qui appelle `router.push`. La transition attend le changement de
 * chemin, au plus 700 ms (au-delà, la navigation continue sans animation).
 */
const MAX_WAIT_MS = 700;

export function NavTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<(() => void) | null>(null);

  // Le chemin a changé : la nouvelle page est montée, on laisse la transition la montrer.
  useEffect(() => {
    const done = pending.current;
    if (!done) return;
    pending.current = null;
    requestAnimationFrame(() => requestAnimationFrame(done));
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return;
    const root = document.documentElement;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      event.preventDefault();
      root.classList.add("vt-running");
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            pending.current = resolve;
            window.setTimeout(resolve, MAX_WAIT_MS);
            router.push(`${url.pathname}${url.search}${url.hash}`);
          })
      );
      transition.finished.finally(() => root.classList.remove("vt-running"));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
