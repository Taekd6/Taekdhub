import type { Subject, WorkSession } from "@/lib/supabase/types";

export const subjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];

/**
 * Identité de matière — une lettre, une teinte.
 *
 * La teinte n'est plus choisie ici : elle vient des variables `--subj-<clé>`
 * (lib/subject-colors.ts), réglables par l'élève (palette + surcharge par
 * matière). Les classes ci-dessous ne font que les RÉFÉRENCER — c'est pour ça
 * qu'elles restent écrites en entier, et non construites : Tailwind ne
 * génère que les classes qu'il lit littéralement (lib/ est dans `content`).
 *
 *   `className`  pastille : fond teinté à 18 % + lettre à l'encre de la
 *                matière (assombrie en thème clair pour tenir 4,5:1) ;
 *   `solid`      aplat plein — barre, segment, point de légende ;
 *   `ink`        texte seul, à la couleur de la matière ;
 *   `fill`       couleur CSS brute, pour un `style` ou un trait SVG.
 */
export const subjectMeta: Record<Subject, { short: string; className: string; solid: string; ink: string; fill: string }> = {
  Mathématiques: { short: "M", className: "bg-subj-math/[0.18] text-subj-math-ink", solid: "bg-subj-math", ink: "text-subj-math-ink", fill: "rgb(var(--subj-math))" },
  Physique: { short: "P", className: "bg-subj-phys/[0.18] text-subj-phys-ink", solid: "bg-subj-phys", ink: "text-subj-phys-ink", fill: "rgb(var(--subj-phys))" },
  Chimie: { short: "C", className: "bg-subj-chim/[0.18] text-subj-chim-ink", solid: "bg-subj-chim", ink: "text-subj-chim-ink", fill: "rgb(var(--subj-chim))" },
  "Informatique TC": { short: "IT", className: "bg-subj-itc/[0.18] text-subj-itc-ink", solid: "bg-subj-itc", ink: "text-subj-itc-ink", fill: "rgb(var(--subj-itc))" },
  "Informatique Spé": { short: "IS", className: "bg-subj-isp/[0.18] text-subj-isp-ink", solid: "bg-subj-isp", ink: "text-subj-isp-ink", fill: "rgb(var(--subj-isp))" },
  Français: { short: "F", className: "bg-subj-fr/[0.18] text-subj-fr-ink", solid: "bg-subj-fr", ink: "text-subj-fr-ink", fill: "rgb(var(--subj-fr))" },
  Anglais: { short: "A", className: "bg-subj-en/[0.18] text-subj-en-ink", solid: "bg-subj-en", ink: "text-subj-en-ink", fill: "rgb(var(--subj-en))" },
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
