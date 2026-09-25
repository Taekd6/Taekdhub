import Link from "next/link";
import type { CSSProperties } from "react";
import { CARD_TONES } from "@/lib/theme";
import { cn } from "@/lib/cn";

/**
 * TON D'UNE CARTE EN DÉGRADÉ.
 *
 *   un nombre   la k-ième carte d'une série : la palette en fournit quatre
 *               paires, reprises en BOUCLE (0 → tone-1, 4 → tone-1 à
 *               nouveau). Ce n'est PAS une couleur attribuée à une matière —
 *               l'élève a rejeté l'identité colorée des matières (refonte
 *               « Nuit ») : la couleur dit seulement « carte suivante » ;
 *   "review"    la bannière des révisions du jour ;
 *   "brand"     le dégradé de marque (c1 → c2).
 */
export type GradientTone = number | "review" | "brand";

export function toneClass(tone: GradientTone): string {
  if (typeof tone === "number") return `tone-${(Math.abs(Math.trunc(tone)) % CARD_TONES) + 1}`;
  return `tone-${tone}`;
}

/**
 * CARTE EN DÉGRADÉ — la pièce maîtresse de la maquette « Revolut clair » :
 * un dégradé vif, du texte BLANC, une ombre de la couleur de la carte, un
 * reflet qui passe (`.sheen`), et un soulèvement incliné au survol
 * (`.tilt-hover`).
 *
 * `float` fait flotter la carte en boucle lente (`.floaty`). Le flottement
 * et l'inclinaison animent tous deux `transform` : ils sont donc posés sur
 * DEUX éléments — une enveloppe qui flotte, la carte qui s'incline —, sans
 * quoi l'animation écraserait le survol.
 *
 * `href` fait de la carte entière un lien (elle ne doit alors rien contenir
 * d'autre de cliquable).
 */
export function GradientCard({
  tone = 0,
  href,
  float = false,
  tilt = true,
  index = 0,
  className,
  wrapperClassName,
  style,
  children,
  ...props
}: {
  tone?: GradientTone;
  href?: string;
  float?: boolean;
  tilt?: boolean;
  /** Décale le flottement et le reflet entre cartes voisines. */
  index?: number;
  className?: string;
  wrapperClassName?: string;
  style?: CSSProperties;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "style" | "children">) {
  const classes = cn("grad-card sheen block", toneClass(tone), tilt && "tilt-hover", className);
  const cardStyle = { "--i": index, ...style } as CSSProperties;
  const card = href ? (
    <Link href={href} className={classes} style={cardStyle} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </Link>
  ) : (
    <div className={classes} style={cardStyle} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
  if (!float) return card;
  return (
    <div className={cn("floaty", wrapperClassName)} style={{ "--i": index } as CSSProperties}>
      {card}
    </div>
  );
}
