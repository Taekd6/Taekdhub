"use client";

import { cn } from "@/lib/cn";

/**
 * GRAPHIQUES — deux primitives, en SVG, sans bibliothèque.
 *
 * POURQUOI PAS DE LIBRAIRIE. Le dépôt a retiré `framer-motion` — 46 ko sur
 * chaque page — pour un soulignement d'onglet, et un test l'empêche de
 * revenir (lib/design-system.test.ts). Recharts et ses dépendances d3
 * pèsent plusieurs centaines de kilo-octets pour deux formes que trente
 * lignes de SVG produisent, et arrivent avec leur propre langage visuel :
 * grilles, tooltips, légendes, couleurs par défaut — tout ce qu'il faudrait
 * ensuite neutraliser pour rester en papier & encre. Les couleurs viennent
 * ici des mêmes variables CSS que le reste de l'application, donc elles
 * suivent l'accent choisi par l'élève et s'inversent avec le thème sans une
 * ligne de configuration.
 *
 * DEUX FORMES, PAS DIX. Une courbe pour ce qui évolue dans le temps, des
 * barres appariées pour comparer deux séries jour par jour. La répartition
 * par matière n'en fait pas partie : une liste de `Meter` avec les durées
 * alignées se lit mieux qu'un graphique, et le composant existe déjà.
 * L'assiduité non plus : `Heatmap` existe.
 *
 * ACCESSIBILITÉ. Un graphique n'est jamais la seule façon de lire la
 * donnée : chaque figure porte un `role="img"` et un `aria-label` qui
 * résume la série en toutes lettres, et l'appelant affiche toujours la même
 * information en texte à côté (voir components/progress/*). Les axes ne
 * descendent jamais sous 11 px.
 */

/** Marges internes du repère, en unités du `viewBox`. Assez pour les étiquettes d'axe, pas plus. */
const PAD = { top: 6, right: 4, bottom: 6, left: 4 };
const VIEW = { width: 320, height: 110 };

export interface LinePoint {
  label: string;
  /** `null` = pas de mesure pour cette période. La courbe s'interrompt — elle ne descend pas à zéro. */
  value: number | null;
}

/**
 * COURBE — pour ce qui évolue dans le temps : volume de travail, maîtrise,
 * notes.
 *
 * Une valeur `null` INTERROMPT le tracé au lieu de le ramener à zéro. La
 * distinction est capitale : une semaine sans tentative notée n'est pas une
 * semaine à 0 % de réussite, et une courbe qui plonge à chaque vacance
 * raconterait une régression qui n'a pas eu lieu.
 *
 * Pas de grille, pas d'info-bulle, pas de légende : une ligne de base, deux
 * repères d'axe, et les valeurs extrêmes. Le reste est dit en texte par
 * l'appelant.
 */
export function LineChart({
  points,
  ariaLabel,
  formatValue = (value) => String(value),
  min,
  max,
  className,
}: {
  points: LinePoint[];
  /** Résumé en toutes lettres de ce que montre la courbe — la seule chose qu'un lecteur d'écran percevra. */
  ariaLabel: string;
  formatValue?: (value: number) => string;
  /** Bornes imposées — utile pour une note (0–20) ou un pourcentage (0–100), où l'échelle a un sens absolu. */
  min?: number;
  max?: number;
  className?: string;
}) {
  const measured = points.filter((point) => point.value !== null) as { label: string; value: number }[];
  if (measured.length === 0) return null;

  const values = measured.map((point) => point.value);
  const lowest = min ?? Math.min(...values);
  const highest = max ?? Math.max(...values);
  // Un plateau parfait (toutes les valeurs égales) donnerait une hauteur
  // nulle : la courbe se placerait alors au milieu, ce qui est exactement ce
  // qu'il faut montrer.
  const span = highest - lowest || 1;

  const x = (index: number) =>
    PAD.left + (points.length === 1 ? (VIEW.width - PAD.left - PAD.right) / 2 : (index * (VIEW.width - PAD.left - PAD.right)) / (points.length - 1));
  const y = (value: number) => PAD.top + (1 - (value - lowest) / span) * (VIEW.height - PAD.top - PAD.bottom);

  // Segments continus : chaque interruption (`null`) ouvre un nouveau tracé.
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ index, value: point.value });
  });
  if (current.length > 0) segments.push(current);

  const lastMeasured = [...points].reverse().find((point) => point.value !== null);
  const lastIndex = lastMeasured ? points.lastIndexOf(lastMeasured) : -1;

  /*
   * AUCUN TEXTE DANS LE SVG — défaut constaté à l'écran.
   *
   * Le tracé a besoin de `preserveAspectRatio="none"` pour occuper toute la
   * largeur disponible ; or cet attribut étire AUSSI les lettres, d'un
   * facteur qui vaut ici plus de deux sur un écran large. Les étiquettes
   * d'axe s'affichaient donc distordues horizontalement, et à 9 px — sous le
   * seuil de lisibilité que ce chantier s'impose.
   *
   * Les repères sont donc composés en HTML autour du SVG : ils reprennent
   * les rôles typographiques du produit, ne se déforment jamais, et
   * n'échappent pas au contrôle de taille du reste de l'interface.
   */
  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right">
          <span className="tabular t-meta text-2xs">{formatValue(highest)}</span>
          <span className="tabular t-meta text-2xs">{formatValue(lowest)}</span>
        </div>
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          preserveAspectRatio="none"
          className="h-28 min-w-0 flex-1"
        >
          <line
            x1={0}
            x2={VIEW.width}
            y1={VIEW.height - 1}
            y2={VIEW.height - 1}
            stroke="rgb(var(--line-rgb))"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {segments.map((segment, index) => (
            <polyline
              key={index}
              fill="none"
              stroke="rgb(var(--accent-ink-rgb))"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={segment.map((point) => `${x(point.index)},${y(point.value)}`).join(" ")}
            />
          ))}
          {/* Un seul point marqué : le dernier mesuré. Les marquer tous
              ajoute du bruit dès qu'il y en a plus de six. */}
          {lastIndex >= 0 && points[lastIndex].value !== null && (
            <circle cx={x(lastIndex)} cy={y(points[lastIndex].value as number)} r={3} fill="rgb(var(--accent-ink-rgb))" />
          )}
        </svg>
      </div>

      {/* Première et dernière abscisse seulement : toutes les afficher les
          ferait se chevaucher à 320 px, ce qui est pire que l'absence. */}
      <div className="mt-1.5 flex justify-between pl-12">
        <span className="t-meta text-2xs">{points[0]?.label}</span>
        <span className="t-meta text-2xs">{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export interface PairedBar {
  /** Identifiant STABLE et unique de la barre — la date, jamais le libellé : « mardi » et « mercredi » partagent la lettre M. */
  id: string;
  label: string;
  /** `null` = aucune intention enregistrée pour ce jour — la barre « prévu » est absente, pas à zéro. */
  planned: number | null;
  actual: number;
}

/**
 * BARRES APPARIÉES — prévu contre réalisé, jour par jour.
 *
 * DEUX BARRES CÔTE À CÔTE, et non superposées. La première version
 * dessinait le prévu en contour DERRIÈRE le réalisé : dès que le réalisé
 * atteignait le prévu, le contour disparaissait complètement, et la
 * comparaison — la seule raison d'être de la figure — devenait invisible.
 * Constaté à l'écran, pas supposé.
 *
 * Les barres sont aussi BORNÉES EN LARGEUR : réparties sur toute la largeur
 * d'un écran de 1440 px, sept paires devenaient des pavés de cent pixels,
 * qui ne se lisent plus comme des barres.
 *
 * Un jour sans intention enregistrée n'a PAS de barre « prévu » — il n'est
 * pas « prévu à zéro », il est hors comparaison, et cette différence-là doit
 * se voir.
 */
export function PairedBars({
  bars,
  ariaLabel,
  className,
}: {
  bars: PairedBar[];
  ariaLabel: string;
  className?: string;
}) {
  if (bars.length === 0) return null;
  const highest = Math.max(1, ...bars.flatMap((bar) => [bar.planned ?? 0, bar.actual]));
  // Un minimum visible pour toute valeur non nulle : une séance de dix
  // minutes ne doit pas disparaître face à une journée de quatre heures.
  const height = (value: number) => `${Math.max(value > 0 ? 4 : 0, (value / highest) * 100)}%`;

  return (
    <div role="img" aria-label={ariaLabel} className={cn("flex items-end gap-2", className)}>
      {bars.map((bar) => (
        <div key={bar.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex h-20 w-full items-end justify-center gap-1">
            {/* PRÉVU — un contour, donc reconnaissable comme une intention. */}
            <span
              aria-hidden
              className={cn("w-3 rounded-sm border border-dashed border-line", bar.planned === null && "invisible")}
              style={{ height: bar.planned === null ? "0%" : height(bar.planned) }}
            />
            {/* RÉALISÉ — un aplat. */}
            <span
              aria-hidden
              className="w-3 rounded-sm"
              style={{ height: height(bar.actual), backgroundColor: "rgb(var(--accent-ink-rgb) / 0.55)" }}
            />
          </div>
          <span className="t-meta w-full truncate text-center text-2xs">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface VolumeBar {
  /** Identifiant STABLE — la clé de période, jamais le libellé : deux jours peuvent partager une lettre. */
  id: string;
  /** Ce qui s'écrit sous la barre. Vide pour les barres intercalaires quand la série est longue. */
  label: string;
  /** Libellé complet, lu par les lecteurs d'écran et affiché au survol. */
  title: string;
  minutes: number;
}

/**
 * BARRES DE VOLUME — « combien ai-je travaillé, jour après jour ».
 *
 * Une seule série, donc une seule barre par période : c'est la figure la plus
 * simple possible, et c'est voulu. La question posée est « est-ce que je
 * travaille régulièrement, et combien », à laquelle une courbe répond moins
 * bien qu'un peigne — un trou s'y voit immédiatement.
 *
 * UN JOUR À ZÉRO GARDE SA PLACE, avec une barre résiduelle d'un pixel : c'est
 * l'information principale de la figure. Le masquer donnerait une série
 * continue là où il y a eu une interruption.
 *
 * AUCUNE INFO-BULLE N'EST NÉCESSAIRE pour comprendre : le total et la moyenne
 * sont dits en texte par l'appelant, la valeur maximale est écrite sur l'axe,
 * et chaque barre porte son libellé complet dans `title` + `aria-label`. Sur
 * mobile, où le survol n'existe pas, rien n'est donc perdu.
 */
export function VolumeBars({
  bars,
  ariaLabel,
  formatValue,
  className,
}: {
  bars: VolumeBar[];
  ariaLabel: string;
  formatValue: (minutes: number) => string;
  className?: string;
}) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((bar) => bar.minutes), 1);

  return (
    <figure className={cn("mt-4", className)} role="img" aria-label={ariaLabel}>
      <div className="flex h-32 items-end gap-[3px]" aria-hidden>
        {bars.map((bar) => (
          <div key={bar.id} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${bar.title} — ${formatValue(bar.minutes)}`}>
            <div
              className={cn(
                "w-full rounded-t-[2px] transition-[height]",
                bar.minutes > 0 ? "bg-accent/70" : "bg-line"
              )}
              /* Minimum d'un pixel : un jour sans travail reste visible comme
                 un creux, et non comme une absence de colonne. */
              style={{ height: bar.minutes > 0 ? `${Math.max(2, (bar.minutes / max) * 100)}%` : "1px" }}
            />
          </div>
        ))}
      </div>
      {/* Les libellés en HTML, jamais dans le SVG : voir `LineChart`. */}
      <div className="mt-1.5 flex gap-[3px]" aria-hidden>
        {bars.map((bar) => (
          <span key={bar.id} className="t-meta min-w-0 flex-1 truncate text-center text-2xs">
            {bar.label}
          </span>
        ))}
      </div>
      <figcaption className="t-meta mt-2 flex items-baseline justify-between text-2xs">
        <span>maximum {formatValue(max)}</span>
      </figcaption>
    </figure>
  );
}
