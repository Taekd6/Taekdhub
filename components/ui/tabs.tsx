"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * ONGLETS — la pilule segmentée d'apple.com (« Vue d'ensemble · Caractéristiques
 * · Acheter ») : une piste grise, une pastille qui GLISSE d'un onglet à
 * l'autre, et un contenu qui passe en fondu en venant du côté où l'on va.
 *
 * API
 *
 *   items         `{ id, label, content }[]` — `id` sert de clé, d'ancre
 *                 (`#id`) et d'identifiant ARIA. `content` n'est rendu que
 *                 pour l'onglet ouvert.
 *   value /       mode contrôlé (optionnel). Sans `value`, le composant
 *   onChange      garde son propre état, initialisé par `defaultValue` (ou
 *                 le premier onglet).
 *   syncHash      `true` : l'onglet ouvert s'écrit dans l'URL (`#id`, sans
 *                 entrée d'historique), et une URL qui arrive avec `#id`
 *                 ouvre cet onglet. Un lien partagé rouvre donc le bon.
 *   ariaLabel     nom de la liste d'onglets pour les lecteurs d'écran.
 *   align         `center` (défaut, comme sur apple.com) ou `start`.
 *
 * ACCESSIBILITÉ — le motif ARIA « tabs » complet : `tablist` / `tab` /
 * `tabpanel`, `aria-selected`, `aria-controls` / `aria-labelledby`, focus
 * ITINÉRANT (un seul onglet dans l'ordre de tabulation), flèches gauche /
 * droite (en boucle), Début / Fin ; l'onglet atteint au clavier s'ouvre
 * (activation automatique). Le panneau est focalisable pour qu'on y entre
 * d'une tabulation.
 *
 * MOUVEMENT — la pastille est mesurée dans le DOM (les libellés n'ont pas
 * la même largeur) et glisse en `transform` ; le panneau entre par
 * `.tab-in-next` / `.tab-in-prev` (app/globals.css). Sous mouvement réduit,
 * les deux sont instantanés.
 */
export interface TabItem {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  syncHash = false,
  ariaLabel,
  align = "center",
  className,
  panelClassName,
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  syncHash?: boolean;
  ariaLabel: string;
  align?: "center" | "start";
  className?: string;
  panelClassName?: string;
}) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? items[0]?.id ?? "");
  const current = value ?? inner;
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === current));
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const select = useCallback(
    (id: string) => {
      const from = items.findIndex((item) => item.id === current);
      const to = items.findIndex((item) => item.id === id);
      if (to < 0 || id === current) return;
      setDirection(to > from ? "next" : "prev");
      if (value === undefined) setInner(id);
      onChange?.(id);
      if (syncHash) window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    },
    [current, items, onChange, syncHash, value]
  );

  // Ancre à l'arrivée, et à chaque changement d'ancre (lien interne,
  // bouton précédent). Un `hashchange`, pas un écouteur de défilement.
  useEffect(() => {
    if (!syncHash) return;
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (items.some((item) => item.id === id)) select(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // `select` change à chaque onglet : ne relire l'ancre qu'au montage et
    // quand la liste change, pas à chaque sélection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncHash, items]);

  /* ── Pastille glissante ── */
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tab = list.querySelectorAll<HTMLElement>('[role="tab"]')[currentIndex];
      setBox(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [currentIndex, items.length]);

  /* ── Clavier ── */
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: currentIndex === last ? 0 : currentIndex + 1,
      ArrowLeft: currentIndex === 0 ? last : currentIndex - 1,
      Home: 0,
      End: last,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(items[next].id);
    tabRefs.current[next]?.focus();
  }

  const active = items[currentIndex];
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  return (
    <div className={className}>
      <div className={cn("flex", align === "center" ? "justify-center" : "justify-start")}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="scrollbar-none relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-inset p-1"
        >
          <span
            aria-hidden
            className={cn(
              "chip-on pointer-events-none absolute bottom-1 left-0 top-1 rounded-full transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
              box ? "opacity-100" : "opacity-0"
            )}
            style={box ? { width: box.width, transform: `translateX(${box.left}px)` } : undefined}
          />
          {items.map((item, index) => {
            const selected = index === currentIndex;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={tabId(item.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(item.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(item.id)}
                className={cn(
                  "press relative z-10 min-h-9 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] font-semibold transition-colors max-lg:min-h-11 min-[400px]:px-4 sm:px-5 sm:text-sm",
                  selected ? "text-ink" : "text-muted hover:text-ink"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div
          key={active.id}
          id={panelId(active.id)}
          role="tabpanel"
          aria-labelledby={tabId(active.id)}
          tabIndex={0}
          className={cn("mt-8 rounded-2xl", direction === "next" ? "tab-in-next" : "tab-in-prev", panelClassName)}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
