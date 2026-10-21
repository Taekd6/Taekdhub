"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { computeAnkiProgress, DECK_VERDICT_LABEL, PROGRESS_FRAGILE, PROGRESS_MIN_REVIEWED, PROGRESS_SOLID, type DeckVerdict } from "@/lib/anki-progress";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

const BADGE: Record<DeckVerdict, "success" | "default" | "warning"> = {
  solide: "success",
  moyen: "default",
  fragile: "warning",
  peu: "default",
  calme: "default",
};

/**
 * AI-JE AVANCÉ ? — le bilan des cartes apprises d'après le dernier relevé
 * (lib/anki-progress.ts). Des faits et une phrase qui les cite : pas de note,
 * et les seuils sont dits à l'écran.
 */
export function AnkiProgressSection({ snapshots, overrides }: { snapshots: AnkiSnapshot[]; overrides: Record<string, string | null> }) {
  const progress = useMemo(() => computeAnkiProgress(snapshots, overrides, new Date()), [snapshots, overrides]);

  if (!progress.available) {
    return (
      <Section variant="panel" title="As-tu avancé ?" description="Ce que tes cartes disent de ta semaine.">
        <p className="t-body">{progress.sentence}</p>
      </Section>
    );
  }

  const { totals } = progress;
  return (
    <Section variant="panel" title="As-tu avancé ?" description="D'après le dernier relevé Anki : cartes nouvelles apprises et cartes passées sans « À revoir ».">
      <p className="t-subhead text-ink">{progress.sentence}</p>

      <StatRow className="mt-5">
        <Stat label="Révisées (7 j)" value={totals.reviewed7} size="sm" />
        <Stat label="Nouvelles apprises (7 j)" value={totals.introduced7} size="sm" />
        <Stat label="Sans « À revoir »" value={totals.keptRate === null ? "—" : `${Math.round(totals.keptRate * 100)} %`} detail={totals.keptRate === null ? `moins de ${PROGRESS_MIN_REVIEWED} cartes` : undefined} size="sm" />
      </StatRow>

      <ul className="mt-5 space-y-1">
        {progress.lines.map((line) => (
          <li key={line} className="t-meta">
            {line}
          </li>
        ))}
      </ul>

      <ul className="mt-5 divide-y divide-line">
        {progress.decks.slice(0, 10).map((deck) => (
          <li key={deck.deck} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-semibold text-ink">{deck.chapterId ? (PROGRAMME_BY_ID.get(deck.chapterId)?.title ?? deck.deck) : deck.deck}</p>
              <p className="t-meta text-2xs">
                {deck.reviewed7} révisées · {deck.introduced7} nouvelles · {deck.keptRate === null ? "taux non calculé" : `${Math.round(deck.keptRate * 100)} % sans « À revoir »`}
                {deck.chapterId ? ` · ${deck.deck}` : ""}
              </p>
            </div>
            <Badge variant={BADGE[deck.verdict]}>{DECK_VERDICT_LABEL[deck.verdict]}</Badge>
          </li>
        ))}
      </ul>

      <p className="t-meta mt-4 text-2xs">
        Lecture provisoire, pas une mesure de ta compétence : « solide » = au moins {Math.round(PROGRESS_SOLID * 100)} % des cartes sans « À revoir », « fragile » = moins de {Math.round(PROGRESS_FRAGILE * 100)} %, au moins {PROGRESS_MIN_REVIEWED} cartes révisées pour juger.
        Le relevé ne bouge pas quand tu fais tes cartes : refais-en un (ordinateur, Anki ouvert) pour intégrer ta séance.
      </p>
    </Section>
  );
}
