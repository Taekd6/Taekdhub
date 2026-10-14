import type { MoveKind } from "@/lib/next-move/engine";

/**
 * LA PREMIÈRE ÉTAPE, PLUS PETITE — pour un blocage ou un évitement.
 *
 * Quand une tâche est repoussée ou qu'on bloque dessus, ce n'est ni une faute
 * ni un abandon : la tâche reste là, et on propose un début de cinq à dix
 * minutes où il n'y a RIEN À RÉSOUDRE. Rien n'est révélé (ni indice ni
 * correction) et rien n'est compté comme une aide.
 *
 * Fonctions pures, sans dépendance au reste : le programme de révision et la
 * suite de séance l'utilisent tous deux.
 */

export type SmallStepKind = "exercice" | "reprise" | "programme" | MoveKind;

export interface SmallStep {
  minutes: number;
  title: string;
  /** Ce qu'il y a à faire — sans rien à résoudre. */
  instruction: string;
}

/** La première étape, plus petite — pour un blocage ou un évitement. Aucune n'a quoi que ce soit à résoudre. */
export function smallStepFor(kind: SmallStepKind, chapter: string | null): SmallStep {
  const about = chapter ? ` sur « ${chapter} »` : "";
  switch (kind) {
    case "exercice":
    case "refaire":
      return {
        minutes: 5,
        title: "Juste lire l'énoncé et noter ce qu'on cherche",
        instruction: "Ouvre l'exercice et réécris l'énoncé avec tes mots : ce qu'on te donne, ce qu'on te demande. Tu n'as pas à le résoudre. Si une idée vient, continue ; sinon, c'est déjà fait — et c'est un vrai début.",
      };
    case "reprise":
    case "rappel":
      return { minutes: 5, title: `Écrire seulement les définitions${about}`, instruction: "Sans tes notes, écris les définitions et les énoncés du chapitre, même incomplets. Vérifie ensuite. Cinq minutes suffisent." };
    case "cartes":
      return { minutes: 5, title: "Cinq cartes seulement", instruction: "Fais cinq cartes, pas plus. Tu peux t'arrêter après — ou continuer si tu es lancé." };
    case "anki":
      return { minutes: 10, title: "Dix cartes Anki seulement", instruction: "Dix cartes dans Anki, puis tu décides." };
    case "erreurs":
      return { minutes: 10, title: "Reprendre UNE seule erreur", instruction: "Choisis l'erreur la plus récente, refais la question sans la correction, note la bonne idée. Une suffit." };
    case "échéance":
      return { minutes: 10, title: "Dix minutes sur la première question", instruction: "Ouvre le travail, lis la première question, écris ce que tu sais déjà. Dix minutes, puis tu choisis de continuer ou non." };
    default:
      return { minutes: 10, title: "Dix minutes pour commencer", instruction: "Dix minutes, sans objectif de résultat : ouvrir, relire, noter où tu en es." };
  }
}

