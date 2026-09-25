"use client";

import { ChevronDown } from "lucide-react";
import { Meter } from "@/components/ui/progress";
import { AT_RISK_THRESHOLD, CHAPTER_RATING_META, formatChance } from "@/lib/chapter-memory";
import { FSRS_RATINGS, previewIntervals, type FsrsRating } from "@/lib/fsrs";
import { formatDueDay, formatInterval } from "@/lib/spaced-repetition";
import type { ChapterMemory } from "@/lib/storage";

/**
 * Petites briques partagées par la carte d'accueil, la section « Chapitres »
 * des hubs et la page /memoire — un seul endroit pour le sens des couleurs,
 * les quatre boutons de note et le texte « Pourquoi ça marche ».
 */

/** Ton de la barre de rétention : au-dessus de la cible (90 %) tout va bien, sous le seuil d'alerte ça presse. */
export function retentionTone(retrievability: number): "success" | "warning" | "danger" {
  if (retrievability >= 0.9) return "success";
  if (retrievability >= AT_RISK_THRESHOLD) return "warning";
  return "danger";
}

export function RetentionBar({ retrievability, className }: { retrievability: number; className?: string }) {
  return (
    <div className={className} title={`≈ ${formatChance(retrievability)} de chances de t'en souvenir aujourd'hui`}>
      <Meter value={retrievability * 100} tone={retentionTone(retrievability)} />
    </div>
  );
}

/** « ≈ 72 % de chances de t'en souvenir » — toujours avec « ≈ » : c'est l'estimation d'un modèle moyen. */
export function chanceSentence(retrievability: number): string {
  return `≈ ${formatChance(retrievability)} de chances de t'en souvenir`;
}

/** Date lisible, y compris dans le passé (« depuis le 12 sept. »). */
export function formatDay(day: string, today: string): string {
  if (day <= today) {
    if (day === today) return "aujourd'hui";
    const [, month, date] = day.split("-").map(Number);
    return `le ${date === 1 ? "1er" : date} ${MONTHS[month - 1]}`;
  }
  return formatDueDay(day);
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * LA FEUILLE DE NOTE — « C'est révisé » : comment ça s'est passé ?
 * Quatre boutons, chacun avec l'intervalle que FSRS en tirerait, comme dans
 * Anki (les mêmes quatre mots, pour que le geste soit le même).
 */
export function RatingPanel({
  chapter,
  today,
  onRate,
  onCancel,
}: {
  chapter: ChapterMemory;
  today: string;
  onRate: (rating: FsrsRating) => void;
  onCancel: () => void;
}) {
  const preview = previewIntervals(chapter.card, today);
  return (
    <div role="group" aria-label={`Comment s'est passée la révision de « ${chapter.title} » ?`} className="mt-3 rounded-2xl bg-inset p-3">
      <p className="t-meta mb-2 text-2xs">Comment ça s&apos;est passé ? Sois honnête : c&apos;est ce qui règle le prochain rappel.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FSRS_RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onRate(rating)}
            title={CHAPTER_RATING_META[rating].hint}
            data-rating={rating}
            className="surface press flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 py-2 text-ink hover:bg-panel max-lg:min-h-16"
          >
            <span className="text-sm font-semibold">{CHAPTER_RATING_META[rating].label}</span>
            <span className="tabular text-2xs text-muted">revoir dans {formatInterval(preview[rating])}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="t-meta mt-2 inline-flex min-h-8 items-center text-2xs hover:text-ink max-lg:min-h-11">
        Annuler
      </button>
    </div>
  );
}

/**
 * « POURQUOI ÇA MARCHE » — replié par défaut. Formulations prudentes : ce
 * sont des effets moyens, mesurés, et un modèle ajusté sur une population.
 */
export function WhyMemoryWorks() {
  return (
    <details className="group px-1">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink max-lg:min-h-11 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={15} aria-hidden className="text-subtle transition-transform group-open:rotate-180" />
        Pourquoi ça marche
      </summary>
      <div className="t-meta mt-2 max-w-[62ch] space-y-2 text-[0.8125rem]">
        <p>
          <span className="text-ink">On oublie vite, puis de moins en moins vite.</span> Ebbinghaus (1885) l&apos;a mesuré sur lui-même ; la courbe
          d&apos;oubli a été retrouvée depuis dans de nombreuses études (réplication de Murre &amp; Dros, 2015). Chaque révision réussie la rend plus
          plate : on tient plus longtemps avant la suivante.
        </p>
        <p>
          <span className="text-ink">Espacer plutôt que masser.</span> À temps égal, des révisions réparties dans le temps retiennent mieux que des
          révisions groupées (méta-analyse de Cepeda et al., 2006). Se tester — chercher de tête avant de vérifier — renforce davantage que relire
          (Roediger &amp; Karpicke, 2006).
        </p>
        <p>
          <span className="text-ink">Le calcul : FSRS.</span> Le pourcentage affiché vient de FSRS, l&apos;algorithme de Jarrett Ye et du projet
          open-spaced-repetition, qu&apos;Anki propose depuis sa version 23.10. Il décrit chaque chapitre par une <i>stabilité</i> (le nombre de jours
          avant que la probabilité de s&apos;en souvenir tombe à 90 %) et une <i>difficulté</i>, mises à jour à chaque note Oublié / Dur / Bien /
          Facile, avec des coefficients ajustés sur des centaines de millions de révisions Anki. Le rappel arrive quand la probabilité estimée passe
          sous 85 % ; la révision idéale, quand elle atteint 90 %.
        </p>
        <p>
          Ce sont les coefficients <i>par défaut</i>, une moyenne sur beaucoup d&apos;utilisateurs, pas un réglage fait pour toi — et un chapitre
          entier n&apos;est pas une carte Anki. Lis « ≈ 72 % » comme un ordre de grandeur qui dit quoi revoir en premier, pas comme une mesure.
        </p>
      </div>
    </details>
  );
}
