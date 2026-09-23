import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

/**
 * ILLUSTRATIONS AU TRAIT — les « petites photos » d'apple.com, version
 * TaekdHub.
 *
 * apple.com met une vignette au-dessus de chaque raccourci et au cœur de
 * chaque tuile : c'est ce qui donne envie de cliquer. Des photos n'auraient
 * pas de sens ici (quelle photo pour « Chimie » qui ne soit pas une banque
 * d'images ?) ; des pictogrammes génériques non plus — ce sont eux qui font
 * ressembler un outil à tous les autres. D'où une petite famille de dessins
 * au trait, faits pour ce produit :
 *
 *   — UN trait de 1,5 (dans une grille de 48), bouts et angles arrondis,
 *     comme la police ronde ;
 *   — le dessin en `currentColor` (donc gris ou encre selon le parent) ;
 *   — UN détail à l'accent — la courbe, le noyau, le liquide, la barre
 *     oblique… — pour que l'œil sache où se poser. Jamais deux couleurs.
 *
 * Décoratives par défaut (`aria-hidden`) : le libellé est toujours écrit à
 * côté. Passer `title` quand l'illustration est seule à porter le sens.
 */

type IllustrationProps = {
  /** Côté en pixels (le dessin est carré). */
  size?: number;
  className?: string;
  /** Nom accessible — seulement si aucun texte visible ne dit déjà la même chose. */
  title?: string;
  /** Épaisseur du trait, en unités de la grille de 48. */
  strokeWidth?: number;
};

function Frame({ size = 48, className, title, strokeWidth = 1.5, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/** Le détail à l'accent — encre de l'accent, donc lisible dans les deux thèmes. */
function Accent({ children }: { children: React.ReactNode }) {
  return <g stroke="rgb(var(--accent-ink-rgb))">{children}</g>;
}

const ACCENT_FILL = "rgb(var(--accent-ink-rgb))";

/* ── MATIÈRES ─────────────────────────────────────────────────────── */

/** Mathématiques — un repère, une courbe, et l'aire sous la courbe en hachures : une intégrale qu'on voit. */
function Maths() {
  return (
    <>
      <path d="M9 40h31M11 42V8" />
      <path d="M8.5 11 11 8l2.5 3M37 37.5l3 2.5-3 2.5" />
      <path d="M22 26v14M26 20.5V40M30 18v22" opacity={0.45} />
      <Accent>
        <path d="M13 34c4 0 6-5 9-9s6-8 10-8 6 3 7 5" />
      </Accent>
      <circle cx={32} cy={17} r={1.6} fill={ACCENT_FILL} stroke="none" />
    </>
  );
}

/** Physique — un atome : trois orbites, le noyau à l'accent. */
function Physique() {
  return (
    <>
      <ellipse cx={24} cy={24} rx={18} ry={7} />
      <ellipse cx={24} cy={24} rx={18} ry={7} transform="rotate(60 24 24)" />
      <ellipse cx={24} cy={24} rx={18} ry={7} transform="rotate(120 24 24)" />
      <circle cx={24} cy={24} r={3} fill={ACCENT_FILL} stroke="none" />
      <circle cx={42} cy={24} r={1.4} fill="currentColor" stroke="none" />
    </>
  );
}

/** Chimie — une fiole d'Erlenmeyer, le liquide et ses bulles à l'accent. */
function Chimie() {
  return (
    <>
      <path d="M18.5 7h11M21 7v12L10.4 37.6A3 3 0 0 0 13 42h22a3 3 0 0 0 2.6-4.4L27 19V7" />
      <Accent>
        <path d="M14.6 30.5h18.8" />
        <circle cx={21} cy={36} r={1.3} />
        <circle cx={27} cy={34.5} r={1.8} />
        <circle cx={24.5} cy={25.5} r={1} />
      </Accent>
    </>
  );
}

/** Informatique (tronc commun) — une fenêtre de code, la barre oblique de `</>` à l'accent. */
function InfoTC() {
  return (
    <>
      <rect x={5} y={9} width={38} height={30} rx={5} />
      <path d="M5 16h38" />
      <circle cx={10} cy={12.5} r={0.9} fill="currentColor" stroke="none" />
      <circle cx={13.5} cy={12.5} r={0.9} fill="currentColor" stroke="none" />
      <path d="M18 23.5 13.5 28l4.5 4.5M30 23.5l4.5 4.5-4.5 4.5" />
      <Accent>
        <path d="m26.5 21.5-5 13" />
      </Accent>
    </>
  );
}

/** Informatique (spécialité) — un graphe : cinq sommets, un chemin à l'accent. */
function InfoSpe() {
  return (
    <>
      <path d="M12 13 36 11M12 13l-1 24M36 11l1 26M11 37h26" opacity={0.55} />
      <Accent>
        <path d="M12 13 24 25l13 12" />
      </Accent>
      <circle cx={12} cy={13} r={3} fill={ACCENT_FILL} stroke="none" />
      <circle cx={24} cy={25} r={3} fill={ACCENT_FILL} stroke="none" />
      <circle cx={37} cy={37} r={3} fill={ACCENT_FILL} stroke="none" />
      <circle cx={36} cy={11} r={2.6} fill="currentColor" stroke="none" />
      <circle cx={11} cy={37} r={2.6} fill="currentColor" stroke="none" />
    </>
  );
}

/** Français — un livre ouvert, quelques lignes, le signet à l'accent. */
function Francais() {
  return (
    <>
      <path d="M24 14c-5-3-11.5-3.5-17-2.5v25c5.5-1 12-.5 17 2.5 5-3 11.5-3.5 17-2.5v-25c-5.5-1-12-.5-17 2.5Z" />
      <path d="M24 14v25" />
      <path d="M11 19h8M11 24h8M11 29h5.5M29 24h8M29 29h6" opacity={0.55} />
      <Accent>
        <path d="M30.5 12.4v8.1l2.5-2 2.5 2v-8.6" />
      </Accent>
    </>
  );
}

/** Anglais — une bulle de dialogue, une ligne à l'accent. */
function Anglais() {
  return (
    <>
      <path d="M11 9h26a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H23l-8 7v-7h-4a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z" />
      <path d="M13.5 17h21" opacity={0.55} />
      <Accent>
        <path d="M13.5 23.5h13" />
      </Accent>
    </>
  );
}

const SUBJECT_DRAWINGS: Record<Subject, () => React.ReactElement> = {
  Mathématiques: Maths,
  Physique: Physique,
  Chimie: Chimie,
  "Informatique TC": InfoTC,
  "Informatique Spé": InfoSpe,
  Français: Francais,
  Anglais: Anglais,
};

/** Illustration d'une matière — une par matière de lib/study.ts. */
export function SubjectIllustration({ subject, ...props }: IllustrationProps & { subject: Subject }) {
  const Drawing = SUBJECT_DRAWINGS[subject];
  return <Frame {...props}>{Drawing ? <Drawing /> : null}</Frame>;
}

/* ── OUTILS ET RITUELS ────────────────────────────────────────────── */

/** Chronomètre — l'aiguille et son pivot à l'accent. */
function Chrono() {
  return (
    <>
      <circle cx={24} cy={27} r={14} />
      <path d="M20.5 6.5h7M24 6.5V13M35.5 14.5l2.5-2.5" />
      <path d="M24 16.5v1.5M34.5 27H33M24 37.5V36M13.5 27H15" opacity={0.55} />
      <Accent>
        <path d="M24 27v-7.5" />
      </Accent>
      <circle cx={24} cy={27} r={1.8} fill={ACCENT_FILL} stroke="none" />
    </>
  );
}

/** Révisions — des cartes empilées, la coche de la carte du dessus à l'accent. */
function Revisions() {
  return (
    <>
      <rect x={10} y={9} width={24} height={30} rx={3.5} transform="rotate(-9 22 24)" opacity={0.4} />
      <rect x={12} y={9} width={24} height={30} rx={3.5} transform="rotate(4 24 24)" opacity={0.65} />
      <rect x={14} y={11} width={24} height={30} rx={3.5} />
      <path d="M19 18.5h14M19 23.5h9" opacity={0.55} />
      <Accent>
        <path d="m19.5 32.5 3 3 6-6.5" />
      </Accent>
    </>
  );
}

/** Carnet d'erreurs — un carnet à spirale, la croix à l'accent. */
function Erreurs() {
  return (
    <>
      <rect x={12} y={6} width={27} height={36} rx={3.5} />
      <path d="M8.5 12.5H15M8.5 19.5H15M8.5 26.5H15M8.5 33.5H15" />
      <path d="M20 13h13" opacity={0.55} />
      <Accent>
        <path d="m22 21.5 8 8M30 21.5l-8 8" />
      </Accent>
    </>
  );
}

/** Notes — une copie cornée, la note entourée à l'accent. */
function Notes() {
  return (
    <>
      <path d="M12 6h17l8 8v28H12Z" />
      <path d="M29 6v8h8" />
      <path d="M17 18h8M17 23h14M17 28h7" opacity={0.55} />
      <Accent>
        <circle cx={29.5} cy={34} r={5.5} />
        <path d="m27 34 2 2 3.5-4" />
      </Accent>
    </>
  );
}

/** Échéances — un calendrier, le jour qui compte à l'accent. */
function Echeances() {
  return (
    <>
      <rect x={6.5} y={10} width={35} height={31} rx={5} />
      <path d="M6.5 18h35M16 6.5v7M32 6.5v7" />
      <g fill="currentColor" stroke="none" opacity={0.55}>
        <circle cx={14} cy={25} r={1.2} />
        <circle cx={21} cy={25} r={1.2} />
        <circle cx={28} cy={25} r={1.2} />
        <circle cx={35} cy={25} r={1.2} />
        <circle cx={14} cy={33} r={1.2} />
        <circle cx={21} cy={33} r={1.2} />
      </g>
      <rect x={25} y={29} width={13} height={8} rx={2.5} fill={ACCENT_FILL} stroke="none" />
    </>
  );
}

/** Check-in du soir — un croissant de lune, les étoiles à l'accent. */
function Checkin() {
  return (
    <>
      <path d="M29 9.5A15.5 15.5 0 1 0 39 34a12.5 12.5 0 0 1-10-24.5Z" />
      <Accent>
        <path d="M37 8v6M34 11h6" />
        <path d="M41.5 19.5v3M40 21h3" />
      </Accent>
    </>
  );
}

const TOOL_DRAWINGS = {
  chrono: Chrono,
  revisions: Revisions,
  erreurs: Erreurs,
  notes: Notes,
  echeances: Echeances,
  checkin: Checkin,
} as const;

export type IllustrationName = keyof typeof TOOL_DRAWINGS;
export const ILLUSTRATION_NAMES = Object.keys(TOOL_DRAWINGS) as IllustrationName[];

/** Illustration d'un outil ou d'un rituel (chronomètre, révisions, erreurs, notes, échéances, check-in). */
export function Illustration({ name, ...props }: IllustrationProps & { name: IllustrationName }) {
  const Drawing = TOOL_DRAWINGS[name];
  return <Frame {...props}>{Drawing ? <Drawing /> : null}</Frame>;
}
