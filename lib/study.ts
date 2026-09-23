import type { Subject, WorkSession } from "@/lib/supabase/types";

export const subjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];

/**
 * Identité de matière — une lettre, un NOM. Plus de teinte (refonte
 * « Apple », voir lib/subject-colors.ts).
 *
 *   `className`  pastille NEUTRE : aplat gris (#2c2c2e en sombre, #e8e8ed en
 *                clair) et lettre à l'encre — la même pour toutes les
 *                matières : c'est la lettre qui distingue ;
 *   `solid`      palier de gris de la matière — segment de colonne empilée,
 *                point de légende (il DOIT correspondre au segment) ;
 *   `ink`        texte d'une matière : l'encre ordinaire ;
 *   `fill`       palier de gris en couleur CSS brute, pour un `style` ou un
 *                trait SVG.
 *
 * Les classes restent écrites en entier, et non construites : Tailwind ne
 * génère que les classes qu'il lit littéralement (lib/ est dans `content`).
 */
const NEUTRAL_CHIP = "bg-zinc-800 text-zinc-100";

export const subjectMeta: Record<Subject, { short: string; className: string; solid: string; ink: string; fill: string }> = {
  Mathématiques: { short: "M", className: NEUTRAL_CHIP, solid: "bg-subj-math", ink: "text-subj-math-ink", fill: "rgb(var(--subj-math))" },
  Physique: { short: "P", className: NEUTRAL_CHIP, solid: "bg-subj-phys", ink: "text-subj-phys-ink", fill: "rgb(var(--subj-phys))" },
  Chimie: { short: "C", className: NEUTRAL_CHIP, solid: "bg-subj-chim", ink: "text-subj-chim-ink", fill: "rgb(var(--subj-chim))" },
  "Informatique TC": { short: "IT", className: NEUTRAL_CHIP, solid: "bg-subj-itc", ink: "text-subj-itc-ink", fill: "rgb(var(--subj-itc))" },
  "Informatique Spé": { short: "IS", className: NEUTRAL_CHIP, solid: "bg-subj-isp", ink: "text-subj-isp-ink", fill: "rgb(var(--subj-isp))" },
  Français: { short: "F", className: NEUTRAL_CHIP, solid: "bg-subj-fr", ink: "text-subj-fr-ink", fill: "rgb(var(--subj-fr))" },
  Anglais: { short: "A", className: NEUTRAL_CHIP, solid: "bg-subj-en", ink: "text-subj-en-ink", fill: "rgb(var(--subj-en))" },
};

export function dayKey(value: string | Date) { return new Date(value).toLocaleDateString("en-CA"); }
export function totalSeconds(sessions: WorkSession[]) { return sessions.reduce((total, session) => total + session.duration_seconds, 0); }

/** Temps déjà investi aujourd'hui (toutes matières confondues), en secondes — source unique, réutilisée par l'accueil (« Ma journée ») et le Chrono. */
export function todaySeconds(sessions: WorkSession[], now: Date = new Date()): number {
  const today = dayKey(now);
  return totalSeconds(
    sessions.filter((session) => {
      // Aujourd'hui, ET déjà passé. Une séance datée à 23 h et lue à midi
      // (horloge décalée, sauvegarde importée) faisait afficher « 90 min
      // travaillées » et un anneau « Objectif du jour » à 100 % avant même
      // d'avoir commencé.
      if (dayKey(session.started_at) !== today) return false;
      return new Date(session.started_at) <= now;
    })
  );
}
