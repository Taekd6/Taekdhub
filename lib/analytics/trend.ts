/**
 * TENDANCES — et surtout, le droit de ne pas en avoir.
 *
 * C'est le module le plus important de toute la couche analytique, et le
 * plus petit. Tout le reste s'appuie dessus pour décider s'il a le droit de
 * conclure.
 *
 * Le piège d'un tableau de bord scolaire n'est pas de mal calculer : c'est
 * de conclure trop vite. Deux exercices réussis sur deux ne font pas
 * « 100 % de réussite », une note de plus ne fait pas « tes résultats
 * progressent », et une semaine de travail ne fait pas un rythme. Ces
 * phrases-là sont pourtant exactement celles qu'un élève de prépa va lire à
 * 22 h un dimanche, et sur lesquelles il va fonder une décision.
 *
 * D'où une abstraction qui refuse par défaut : `computeTrend` ne renvoie une
 * direction QUE si l'échantillon la porte, et le dit sinon
 * (`insuffisant`). Le degré de confiance voyage AVEC la tendance, il n'est
 * pas une option d'affichage — l'interface ne peut donc pas « oublier » de
 * le montrer.
 *
 * Fonction pure : input → output.
 */

export type TrendDirection =
  /** En hausse — sur la période observée, et rien de plus. */
  | "hausse"
  /** En baisse. */
  | "baisse"
  /** Stable : l'écart existe peut-être, mais il est sous le seuil de bruit. */
  | "stable"
  /** Pas assez de points pour parler de tendance. Ce n'est PAS « stable ». */
  | "insuffisant";

export type TrendConfidence = "faible" | "moyenne" | "élevée";

export interface Trend {
  direction: TrendDirection;
  /**
   * Écart entre la dernière valeur et la première, dans l'unité d'origine.
   * `null` quand `direction` vaut `insuffisant` : il n'y a alors rien à
   * annoncer, pas même « 0 ».
   */
  delta: number | null;
  /** Écart relatif en pourcentage, arrondi. `null` si la première valeur est nulle (une division par zéro n'est pas une progression). */
  deltaPercent: number | null;
  /** Nombre de points réellement observés — toujours exposé, pour que l'interface puisse le montrer. */
  samples: number;
  /**
   * `faible` sous `TREND_SOLID_SAMPLES` points : l'écart est descriptif,
   * pas une tendance. L'interface DOIT alors le signaler.
   */
  confidence: TrendConfidence;
  /** Première et dernière valeur retenues — pour écrire « 42 → 67 » sans recalculer. */
  first: number | null;
  last: number | null;
}

/**
 * Deux points : on peut décrire une variation (« +2 h »), pas affirmer une
 * tendance. En dessous, il n'y a rien à dire du tout.
 */
export const TREND_MIN_SAMPLES = 2;
/** À partir de quatre points, une direction cesse d'être l'effet d'une seule journée. */
export const TREND_SOLID_SAMPLES = 4;

/**
 * En dessous de cet écart relatif, deux valeurs sont tenues pour STABLES.
 *
 * Sans ce seuil, 8 h 00 → 8 h 05 deviendrait « en hausse », et l'élève
 * apprendrait en une semaine que la flèche ne veut rien dire. 5 % : l'ordre
 * de grandeur d'une séance déplacée dans une semaine de travail.
 */
export const TREND_NOISE_PERCENT = 5;

/**
 * Tendance d'une série chronologique, du plus ancien au plus récent.
 *
 * La direction compare la MOYENNE DE LA PREMIÈRE MOITIÉ à celle de la
 * seconde, et non le premier point au dernier : sur cinq semaines, une
 * dernière semaine creuse (maladie, vacances) inverserait à elle seule le
 * verdict d'une progression réelle. Le `delta`, lui, reste l'écart brut
 * premier → dernier, parce que c'est ce nombre-là que l'élève lit et
 * vérifie.
 *
 * `absoluteNoise` permet de fixer le bruit dans l'unité d'origine plutôt
 * qu'en pourcentage — indispensable pour une note sur 20, où 5 % de 10
 * valent un demi-point mais 5 % de 2 ne valent rien.
 */
export function computeTrend(values: number[], options: { absoluteNoise?: number } = {}): Trend {
  const points = values.filter((value) => Number.isFinite(value));

  /*
   * UNE SÉRIE ENTIÈREMENT NULLE N'EST PAS UNE SÉRIE STABLE.
   *
   * Défaut trouvé au premier test : sans ce garde-fou, un compte vierge
   * produisait `[0, 0, 0, 0, 0, 0]` — six points, écart nul — donc un
   * verdict « stable », assorti d'une confiance « élevée ». L'écran aurait
   * annoncé à un élève qui n'a jamais ouvert l'application que son rythme
   * était stable et la mesure fiable.
   *
   * Zéro partout ne veut pas dire « constant », ça veut dire « rien n'a
   * jamais été enregistré ». C'est un état vide, et il doit se dire comme
   * tel.
   */
  if (points.length > 0 && points.every((value) => value === 0)) {
    return { direction: "insuffisant", delta: null, deltaPercent: null, samples: 0, confidence: "faible", first: null, last: null };
  }

  if (points.length < TREND_MIN_SAMPLES) {
    return {
      direction: "insuffisant",
      delta: null,
      deltaPercent: null,
      samples: points.length,
      confidence: "faible",
      first: points[0] ?? null,
      last: points[points.length - 1] ?? null,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last - first;
  const deltaPercent = first !== 0 ? Math.round((delta / Math.abs(first)) * 100) : null;

  const half = Math.floor(points.length / 2);
  const olderHalf = points.slice(0, points.length - half);
  const recentHalf = points.slice(points.length - half);
  const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const shift = average(recentHalf) - average(olderHalf);

  const noise =
    options.absoluteNoise ?? (Math.abs(average(olderHalf)) * TREND_NOISE_PERCENT) / 100;
  const direction: TrendDirection = Math.abs(shift) <= noise ? "stable" : shift > 0 ? "hausse" : "baisse";

  return {
    direction,
    delta,
    deltaPercent,
    samples: points.length,
    confidence: points.length >= TREND_SOLID_SAMPLES ? "élevée" : "faible",
    first,
    last,
  };
}

/**
 * La phrase qui accompagne OBLIGATOIREMENT une tendance peu solide.
 *
 * `null` quand la tendance repose sur assez de points : pas de mise en garde
 * décorative, sinon elle cesse d'être lue là où elle compte.
 */
export function describeConfidence(trend: Trend): string | null {
  if (trend.direction === "insuffisant") {
    return trend.samples === 0
      ? "Pas encore de données."
      : `Une seule mesure — pas encore de tendance.`;
  }
  if (trend.confidence === "faible") {
    return `Écart observé sur ${trend.samples} mesures seulement — à confirmer.`;
  }
  return null;
}

/** `+2`, `−3`, `±0` — convention de signe unique de toute la couche analytique (vrai moins typographique U+2212, de la chasse d'un chiffre). */
export function withSign(value: number, unit = ""): string {
  if (value === 0) return `±0${unit}`;
  const magnitude = Math.abs(value);
  // Virgule décimale : « 4.8 h » n'est ni français ni lisible. Les entiers
  // restent entiers — « +2 pt », pas « +2,0 pt ».
  const formatted = Number.isInteger(magnitude) ? String(magnitude) : magnitude.toFixed(1).replace(".", ",");
  return `${value > 0 ? "+" : "−"}${formatted}${unit}`;
}

/**
 * Écart de DURÉE signé — « +1 h 25 », « −45 min », « ±0 ».
 *
 * Un écart de temps exprimé en heures décimales (« −4.8 h ») est illisible :
 * personne ne convertit 0,8 h en 48 minutes de tête. Cette fonction compose
 * la même forme que le reste de l'application (voir lib/utils.ts#formatSpan),
 * en lui ajoutant le signe.
 */
export function withSignMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return "±0";
  const total = Math.abs(rounded);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const body = !hours ? `${rest} min` : rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
  return `${rounded > 0 ? "+" : "−"}${body}`;
}
