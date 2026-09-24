"use client";

import type { CSSProperties } from "react";
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
 * ensuite neutraliser pour rester dans le système « Apple ». Les couleurs viennent
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

/** Proportions du repère de la courbe, en unités du `viewBox`. Le tracé est étiré à la largeur disponible (`preserveAspectRatio="none"`). */
const VIEW = { width: 320, height: 120 };

/**
 * ÉCHELLE « RONDE » — le haut de l'axe tombe sur une valeur qu'on lit sans
 * calculer : l'heure entière au-delà d'une heure, le quart d'heure en deçà.
 * Un axe qui culmine à « 3 h 47 » oblige à deviner la hauteur de chaque
 * barre ; un axe à « 4 h » la donne.
 */
function niceMinutes(value: number): number {
  if (value <= 0) return 60;
  if (value <= 60) return Math.ceil(value / 15) * 15;
  if (value <= 360) return Math.ceil(value / 60) * 60;
  return Math.ceil(value / 120) * 120;
}

/**
 * INFO-BULLE D'UNE COLONNE — posée au-dessus de la colonne survolée.
 *
 * Alignée à GAUCHE pour le premier quart de la série, à DROITE pour le
 * dernier, centrée ailleurs : une bulle centrée sur la première barre
 * sortirait du graphique. Purement visuelle (`aria-hidden`) : la valeur est
 * déjà dans l'`aria-label` de la figure.
 */
function Tip({ index, count, children }: { index: number; count: number; children: React.ReactNode }) {
  const side = index < count / 4 ? "left-0" : index >= (count * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      aria-hidden
      className={cn(
        "floating pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-2xs leading-tight text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100",
        side
      )}
    >
      {children}
    </span>
  );
}

export interface LinePoint {
  label: string;
  /** `null` = pas de mesure pour cette période. La courbe s'interrompt — elle ne descend pas à zéro. */
  value: number | null;
}

/**
 * COURBE — pour ce qui évolue dans le temps (les notes, sur 20).
 *
 * Une valeur `null` INTERROMPT le tracé au lieu de le ramener à zéro. La
 * distinction est capitale : une semaine sans note n'est pas une semaine à
 * zéro, et une courbe qui plonge à chaque vacance raconterait une
 * régression qui n'a pas eu lieu.
 *
 * REFONTE « APPLE ». Un trait à l'accent sur un voile d'accent très pâle,
 * trois repères d'axe en filets presque invisibles, et un point par mesure.
 * Le trait SE DESSINE quand la figure entre dans l'écran (`.ring-draw` sur
 * un tracé de longueur normalisée à 1 : le même geste que les anneaux), le
 * voile arrive en fondu juste derrière.
 *
 * AUCUN TEXTE NI AUCUN POINT DANS LE SVG. Le tracé a besoin de
 * `preserveAspectRatio="none"` pour occuper toute la largeur ; or cet
 * attribut étire aussi les lettres et change les cercles en ellipses. Les
 * étiquettes d'axe ET les points sont donc composés en HTML par-dessus, en
 * pourcentages : ils ne se déforment jamais, et chaque point porte son
 * info-bulle au survol.
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

  // Positions en FRACTIONS (0–1), partagées par le SVG et par les points HTML.
  const fx = (index: number) => (points.length === 1 ? 0.5 : 0.02 + (index * 0.96) / (points.length - 1));
  const fy = (value: number) => 0.06 + (1 - (value - lowest) / span) * 0.88;

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

  const toSvg = (segment: { index: number; value: number }[]) =>
    segment.map((point) => `${fx(point.index) * VIEW.width},${fy(point.value) * VIEW.height}`);
  const middle = lowest + span / 2;
  const lastMeasured = measured[measured.length - 1];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-3">
        <div className="relative h-44 min-w-0 flex-1">
          {/* Repères : haut, milieu, bas — des filets, l'étiquette à droite. */}
          {[highest, middle, lowest].map((value, index) => (
            <div key={index} aria-hidden className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${fy(value) * 100}%` }}>
              <span className={cn("h-px flex-1", index === 2 ? "bg-line" : "bg-hairline/[0.07]")} />
            </div>
          ))}
          <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="line-chart-veil" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent-ink-rgb))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="rgb(var(--accent-ink-rgb))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {segments.map((segment, index) =>
              segment.length > 1 ? (
                <polygon
                  key={`veil-${index}`}
                  className="reveal"
                  style={{ "--i": 3 } as CSSProperties}
                  fill="url(#line-chart-veil)"
                  points={[
                    `${fx(segment[0].index) * VIEW.width},${VIEW.height * 0.94}`,
                    ...toSvg(segment),
                    `${fx(segment[segment.length - 1].index) * VIEW.width},${VIEW.height * 0.94}`,
                  ].join(" ")}
                />
              ) : null
            )}
            {segments.map((segment, index) => (
              <polyline
                key={index}
                fill="none"
                stroke="rgb(var(--accent-ink-rgb))"
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={0}
                className="ring-draw"
                style={{ "--ring-len": 1 } as CSSProperties}
                points={toSvg(segment).join(" ")}
              />
            ))}
          </svg>
          {/* Les points, en HTML : ronds à toutes les largeurs, survolables. */}
          {points.map((point, index) =>
            point.value === null ? null : (
              <span
                key={index}
                className="group absolute -ml-3 -mt-3 grid h-6 w-6 place-items-center"
                style={{ left: `${fx(index) * 100}%`, top: `${fy(point.value) * 100}%` }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "reveal block rounded-full border-2 border-[rgb(var(--accent-ink-rgb))] transition-transform duration-200 group-hover:scale-150",
                    point === lastMeasured ? "h-3 w-3 bg-[rgb(var(--accent-ink-rgb))]" : "h-2.5 w-2.5 bg-panel"
                  )}
                  style={{ "--i": 4 } as CSSProperties}
                />
                <Tip index={index} count={points.length}>
                  <span className="font-bold tabular">{formatValue(point.value)}</span>
                  <span className="text-muted"> · {point.label}</span>
                </Tip>
              </span>
            )
          )}
        </div>
        <div aria-hidden className="relative w-8 shrink-0">
          {[highest, middle, lowest].map((value, index) => (
            <span key={index} className="tabular t-meta absolute left-0 -translate-y-1/2 text-2xs" style={{ top: `${fy(value) * 100}%` }}>
              {formatValue(value)}
            </span>
          ))}
        </div>
      </div>

      {/* Première et dernière abscisse seulement : toutes les afficher les
          ferait se chevaucher à 390 px, ce qui est pire que l'absence. */}
      <div aria-hidden className="mr-11 mt-2 flex justify-between">
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
 * DEUX BARRES CÔTE À CÔTE, et non superposées : dès que le réalisé
 * atteignait le prévu, un contour dessiné derrière disparaissait, et la
 * comparaison — la seule raison d'être de la figure — devenait invisible.
 *
 * LE PRÉVU EN GRIS, LE RÉALISÉ À L'ACCENT : l'œil va d'abord à ce qui a eu
 * lieu. Les barres sont BORNÉES EN LARGEUR (sept paires étalées sur 1 440 px
 * deviennent des pavés) et poussent depuis la ligne de base, en cascade,
 * quand la figure entre dans l'écran. Au survol, une info-bulle donne les
 * deux valeurs.
 *
 * Un jour sans intention enregistrée n'a PAS de barre « prévu » — il n'est
 * pas « prévu à zéro », il est hors comparaison, et cette différence-là doit
 * se voir.
 */
export function PairedBars({
  bars,
  ariaLabel,
  formatValue = (value) => String(value),
  className,
}: {
  bars: PairedBar[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  if (bars.length === 0) return null;
  const highest = niceMinutes(Math.max(1, ...bars.flatMap((bar) => [bar.planned ?? 0, bar.actual])));
  // Un minimum visible pour toute valeur non nulle : une séance de dix
  // minutes ne doit pas disparaître face à une journée de quatre heures.
  const height = (value: number) => `${Math.max(value > 0 ? 3 : 0, (value / highest) * 100)}%`;

  return (
    <figure role="img" aria-label={ariaLabel} className={cn("w-full", className)}>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2">
          <span className="h-px flex-1 bg-hairline/[0.07]" />
          <span className="tabular t-meta text-2xs">{formatValue(highest)}</span>
        </div>
        <div aria-hidden className="flex h-44 items-end gap-2 border-b border-line pr-12 pt-3 sm:gap-4">
          {bars.map((bar, index) => (
            <div key={bar.id} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-1">
              <span
                className={cn("grow-y w-full max-w-[1.25rem] rounded-t-[0.75rem] bg-zinc-700", bar.planned === null && "invisible")}
                style={{ height: bar.planned === null ? "0%" : height(bar.planned), "--i": index } as CSSProperties}
              />
              <span
                className="grow-y w-full max-w-[1.25rem] rounded-t-[0.75rem] bg-[rgb(var(--accent-ink-rgb))] transition-opacity group-hover:opacity-80"
                style={{ height: height(bar.actual), "--i": index } as CSSProperties}
              />
              <Tip index={index} count={bars.length}>
                <span className="text-muted">prévu </span>
                <span className="font-bold tabular">{bar.planned === null ? "—" : formatValue(bar.planned)}</span>
                <span className="text-muted"> · fait </span>
                <span className="font-bold tabular">{formatValue(bar.actual)}</span>
              </Tip>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-2 pr-12 sm:gap-4">
        {bars.map((bar) => (
          <span key={bar.id} className="t-meta min-w-0 flex-1 truncate text-center text-2xs font-semibold">
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
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
 * travaille régulièrement, et combien », à laquelle un peigne répond mieux
 * qu'une courbe — un trou s'y voit immédiatement.
 *
 * GRIS ET UN ACCENT. Toutes les barres en gris ; la DERNIÈRE (aujourd'hui,
 * ou la semaine en cours) à l'accent — c'est celle qu'on cherche. Au survol,
 * la barre passe à l'accent et son info-bulle donne la date et la durée.
 *
 * UN AXE QU'ON LIT : deux filets (le haut arrondi à l'heure et sa moitié),
 * étiquetés à droite, et — quand l'appelant le fournit — la ligne de
 * l'OBJECTIF en pointillé d'accent, qui dit d'un regard quels jours l'ont
 * atteint.
 *
 * UN JOUR À ZÉRO GARDE SA PLACE, avec un socle d'un pixel : c'est
 * l'information principale de la figure. Le masquer donnerait une série
 * continue là où il y a eu une interruption.
 *
 * Les barres POUSSENT depuis la base, en cascade, quand la figure entre dans
 * l'écran (`.grow-y`). Sur mobile, où le survol n'existe pas, rien n'est
 * perdu : le total et la moyenne sont dits en texte par l'appelant, et
 * chaque barre est décrite dans l'`aria-label`.
 */
export function VolumeBars({
  bars,
  ariaLabel,
  formatValue,
  goal,
  goalLabel = "objectif",
  className,
}: {
  bars: VolumeBar[];
  ariaLabel: string;
  formatValue: (minutes: number) => string;
  /** Repère horizontal (minutes par barre) — l'objectif quotidien, typiquement. Omis : pas de ligne. */
  goal?: number;
  goalLabel?: string;
  className?: string;
}) {
  if (bars.length === 0) return null;
  const observed = Math.max(...bars.map((bar) => bar.minutes), 1);
  const showGoal = goal !== undefined && goal > 0 && goal <= observed * 1.6;
  const max = niceMinutes(Math.max(observed, showGoal ? (goal as number) : 0));
  const dense = bars.length > 14;

  return (
    <figure className={cn("w-full", className)} role="img" aria-label={ariaLabel}>
      <div className="relative">
        {/* Filets de repère, étiquetés dans la marge droite. */}
        {[1, 0.5].map((ratio) => (
          <div key={ratio} aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${ratio * 100}%` }}>
            <span className="h-px flex-1 bg-hairline/[0.07]" />
            {/* Étiquette tue quand la ligne d'objectif passe tout près : deux
                valeurs superposées dans la marge ne se lisent plus. */}
            <span className={cn("tabular t-meta w-10 translate-y-1/2 text-2xs", showGoal && Math.abs(ratio - (goal as number) / max) < 0.12 && "invisible")}>
              {formatValue(max * ratio)}
            </span>
          </div>
        ))}
        {showGoal && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] flex items-center gap-2" style={{ bottom: `${((goal as number) / max) * 100}%` }}>
            <span className="h-0 flex-1 border-t border-dashed border-[rgb(var(--accent-ink-rgb)/0.7)]" />
            <span className="tabular w-10 translate-y-1/2 text-2xs font-bold text-accent">{formatValue(goal as number)}</span>
          </div>
        )}
        <div aria-hidden className={cn("flex h-48 items-end border-b border-line pr-12", dense ? "gap-[3px]" : "gap-2 sm:gap-4")}>
          {bars.map((bar, index) => {
            const last = index === bars.length - 1;
            return (
              <div key={bar.id} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className={cn(
                    "grow-y w-full transition-colors duration-200",
                    dense ? "rounded-t-[3px]" : "max-w-[2.5rem] rounded-t-[0.875rem]",
                    bar.minutes === 0
                      ? "bg-line"
                      : last
                        ? "bg-[rgb(var(--accent-ink-rgb))]"
                        : "bg-zinc-600 group-hover:bg-[rgb(var(--accent-ink-rgb)/0.7)]"
                  )}
                  style={{ height: bar.minutes > 0 ? `${Math.max(2, (bar.minutes / max) * 100)}%` : "1px", "--i": index } as CSSProperties}
                />
                <Tip index={index} count={bars.length}>
                  <span className="font-bold tabular">{formatValue(bar.minutes)}</span>
                  <span className="text-muted"> · {bar.title}</span>
                </Tip>
              </div>
            );
          })}
        </div>
      </div>
      {/* Les libellés en HTML, jamais dans le SVG : voir `LineChart`. */}
      <div className={cn("mt-2 flex pr-12", dense ? "gap-[3px]" : "gap-2 sm:gap-4")} aria-hidden>
        {bars.map((bar, index) => (
          <span
            key={bar.id}
            className={cn("t-meta min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-2xs font-semibold", index === bars.length - 1 && "text-ink")}
          >
            {bar.label}
          </span>
        ))}
      </div>
    {showGoal && (
        <figcaption aria-hidden className="t-meta mt-3 flex items-center gap-2 text-[0.8125rem]">
          <span className="w-4 border-t border-dashed border-[rgb(var(--accent-ink-rgb))]" />
          {goalLabel} · <span className="tabular font-semibold text-ink">{formatValue(goal as number)}</span>
        </figcaption>
      )}
    </figure>
  );
}

export interface StackSegment {
  /** Identifiant stable dans la colonne (la matière). */
  id: string;
  value: number;
  /** Couleur CSS du segment. */
  color: string;
}

export interface StackColumn {
  /** Identifiant STABLE — la date, jamais le libellé. */
  id: string;
  /** Ce qui s'écrit sous la colonne (« L », « M »…). */
  label: string;
  /** Libellé complet, lu au survol et par les lecteurs d'écran. */
  title: string;
  /** La colonne du jour est soulignée : c'est le repère qu'on cherche. */
  highlight?: boolean;
  /** Jour à venir : pas de socle, pour ne pas le lire comme « zéro ». */
  muted?: boolean;
  /** De bas en haut. */
  segments: StackSegment[];
}

/**
 * COLONNES EMPILÉES — la semaine en sept colonnes, chacune découpée par
 * matière.
 *
 * Répond à deux questions d'un seul regard : « ai-je travaillé chaque
 * jour ? » (la hauteur) et « sur quoi ? » (les paliers de gris, un par matière). Les segments sont
 * séparés par un liseré de la couleur de la tuile plutôt que par un espace
 * mesuré : la colonne garde sa hauteur exacte.
 *
 * Chaque colonne POUSSE depuis le bas au montage, en cascade (`.grow-y`).
 * Un jour passé sans travail garde un socle de 3 px — l'interruption doit
 * se voir ; un jour à venir n'en a pas.
 */
export function StackedColumns({
  columns,
  ariaLabel,
  formatValue,
  className,
  heightClassName = "h-36",
}: {
  columns: StackColumn[];
  ariaLabel: string;
  formatValue: (value: number) => string;
  className?: string;
  /** Hauteur de la zone des colonnes — plus haute quand la carte a la place. */
  heightClassName?: string;
}) {
  if (columns.length === 0) return null;
  const max = Math.max(1, ...columns.map((column) => column.segments.reduce((sum, segment) => sum + segment.value, 0)));

  return (
    <figure role="img" aria-label={ariaLabel} className={cn("w-full", className)}>
      <div className={cn("flex items-end gap-2 sm:gap-3", heightClassName)} aria-hidden>
        {columns.map((column, index) => {
          const total = column.segments.reduce((sum, segment) => sum + segment.value, 0);
          return (
            <div
              key={column.id}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              title={`${column.title} — ${formatValue(total)}`}
            >
              {total > 0 ? (
                <div
                  className="grow-y flex w-full max-w-[2.75rem] flex-col-reverse overflow-hidden rounded-lg"
                  style={{ height: `${Math.max(4, (total / max) * 100)}%`, "--i": index } as React.CSSProperties}
                >
                  {column.segments.map((segment) => (
                    <span
                      key={segment.id}
                      className="block w-full border-t-2 border-panel last:border-t-0"
                      style={{ height: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
                    />
                  ))}
                </div>
              ) : (
                <div className={cn("h-[3px] w-full max-w-[2.75rem] rounded-full", column.muted ? "bg-transparent" : "bg-hairline/[0.10]")} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3" aria-hidden>
        {columns.map((column) => (
          <span key={column.id} className={cn("min-w-0 flex-1 text-center text-2xs font-bold", column.highlight ? "text-ink" : "text-subtle")}>
            <span className={cn("inline-grid h-6 min-w-6 place-items-center rounded-full px-1", column.highlight && "chip-on")}>{column.label}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
