"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { NOTION_STATE_META, type NotionEvidence, type NotionState } from "@/lib/notions";
import { subjectMeta } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LA CARTE — une notion, une tuile ; l'état de la notion, sa lumière.
 *
 * Le parti pris visuel tient en une phrase : CE QUI N'EST PAS PROUVÉ RESTE
 * SOMBRE. Une notion jamais testée n'est pas colorée en gris "neutre" au même
 * niveau de contraste que les autres — elle est volontairement en retrait,
 * presque éteinte. C'est la traduction visuelle exacte de la règle du moteur
 * (« l'absence de preuve n'est pas une preuve ») : au premier lancement, la
 * carte est une constellation sombre, et elle s'allume séance après séance à
 * mesure que l'élève démontre quelque chose. Aucune couleur n'est distribuée
 * d'avance, aucun pourcentage de départ n'est offert.
 *
 * La TAILLE d'une tuile suit le nombre d'exercices qui réclament la notion —
 * un fait de la banque, pas une pondération inventée : une notion demandée par
 * sept exercices porte réellement plus de poids qu'une notion isolée.
 *
 * Aucun placement aléatoire ni simulation physique : les tuiles sont posées
 * dans un ordre déterministe (état, puis poids, puis alphabétique). Une carte
 * qui se réorganise à chaque visite ne serait pas une carte — l'élève doit
 * pouvoir retrouver une notion là où il l'a laissée.
 */

/** Teinte de chaque état — `jamais testée` est le seul à ne porter aucune couleur : c'est le fond de carte, pas une catégorie de plus. */
const STATE_TILE: Record<NotionState, string> = {
  solide: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  fragile: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  "en difficulté": "border-rose-400/30 bg-rose-400/10 text-rose-200",
  "jamais testée": "border-hairline/[0.07] bg-transparent text-subtle",
};

/** Trois paliers de poids seulement : au-delà, la carte devient un nuage de tailles illisible plutôt qu'une hiérarchie. */
function weightClass(exerciseCount: number): string {
  if (exerciseCount >= 4) return "px-2.5 py-1.5 text-[0.8125rem]";
  if (exerciseCount >= 2) return "px-2 py-1 text-xs";
  return "px-1.5 py-0.5 text-2xs";
}

const STATE_ORDER: NotionState[] = ["en difficulté", "fragile", "solide", "jamais testée"];

export function NotionTile({
  evidence,
  selected,
  onSelect,
}: {
  evidence: NotionEvidence;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${evidence.notion} — ${NOTION_STATE_META[evidence.state].label}, ${evidence.exercises.length} exercice${evidence.exercises.length > 1 ? "s" : ""}`}
      className={cn(
        "focus-ring inline-flex max-w-full items-center gap-1.5 rounded-md border font-medium transition-[background-color,border-color,color] duration-150",
        weightClass(evidence.exercises.length),
        STATE_TILE[evidence.state],
        evidence.state === "jamais testée" ? "hover:border-hairline/[0.14] hover:text-muted" : "hover:brightness-110",
        selected && "ring-2 ring-accent ring-offset-1 ring-offset-canvas"
      )}
    >
      <span className="truncate">{evidence.notion}</span>
      {/* Marqueur de transversalité — la seule information que la carte ajoute
          au nom : cette notion ne vit pas dans un seul chapitre. C'est
          précisément ce qu'aucun écran par chapitre ne peut signaler. */}
      {evidence.crossesChapters && (
        <span
          aria-hidden="true"
          className={cn("h-1 w-1 shrink-0 rounded-full", evidence.state === "jamais testée" ? "bg-subtle/60" : "bg-current opacity-70")}
        />
      )}
    </button>
  );
}

/**
 * Une bande par matière — l'échelle à laquelle un élève de prépa raisonne
 * spontanément ("je suis mauvais en chimie"), à l'intérieur de laquelle la
 * carte vient justement corriger le raisonnement en montrant que le problème
 * est plus fin que la matière.
 */
export function NotionSubjectBand({
  subject,
  notions,
  selectedNotion,
  onSelect,
}: {
  subject: Subject;
  notions: NotionEvidence[];
  selectedNotion: string | null;
  onSelect: (notion: NotionEvidence) => void;
}) {
  const tested = notions.filter((item) => item.state !== "jamais testée").length;
  const sorted = [...notions].sort(
    (a, b) =>
      STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
      b.exercises.length - a.exercises.length ||
      a.notion.localeCompare(b.notion, "fr")
  );

  return (
    <section className="border-t border-hairline/[0.07] py-5 first:border-t-0 first:pt-0">
      <header className="mb-3 flex items-center gap-2.5">
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md text-[0.625rem] font-bold", subjectMeta[subject].className)}>
          {subjectMeta[subject].short}
        </span>
        <h3 className="t-title">{subject}</h3>
        <p className="text-2xs tabular-nums text-subtle">
          {notions.length} notion{notions.length > 1 ? "s" : ""}
          {tested > 0 && ` · ${tested} testée${tested > 1 ? "s" : ""}`}
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((item, index) => (
          <motion.div
            key={item.notion}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            // Cascade très courte et plafonnée : la carte doit se composer
            // sous les yeux, pas se dérouler pendant deux secondes. Au-delà
            // des premières tuiles le délai est constant — sur 600 notions,
            // un délai proportionnel finirait à la minute.
            transition={{ duration: 0.18, delay: Math.min(index, 24) * 0.008 }}
          >
            <NotionTile evidence={item} selected={selectedNotion === item.notion} onSelect={() => onSelect(item)} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** Légende — indispensable dès qu'une couleur porte du sens, et elle en porte quatre ici. */
export function NotionLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {STATE_ORDER.map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-[0.2rem] border", STATE_TILE[state])} />
          <span className="text-2xs text-muted">{NOTION_STATE_META[state].label}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-muted" />
        <span className="text-2xs text-muted">Traverse plusieurs chapitres</span>
      </li>
    </ul>
  );
}
