import { HINT_LEVEL_LABELS, HINT_LEVEL_RULES, type AIHintRequest } from "@/lib/ai/types";

/**
 * ORCHESTRATION — ce qu'on demande au modèle, et sous quelles contraintes.
 *
 * Aucun appel réseau ici, aucun SDK : ce module ne fait que transformer une
 * `AIRequest` en (système, message). Il est donc PUR, donc testable avec la
 * suite existante — et c'est important, parce que les garde-fous pédagogiques
 * de tout le produit sont dans ces chaînes de caractères.
 *
 * TROIS RÈGLES, et elles priment sur tout le reste :
 *
 *  1. LA VÉRITÉ TERRAIN EST CELLE DE TAEKDHUB. Sur une question de MP, la
 *     connaissance générale d'un modèle se trompe de convention, invente un
 *     théorème au nom plausible, ou traite un exercice de Sup comme du Spé.
 *     L'énoncé, les indices du professeur et le corrigé fournis dans le
 *     contexte l'emportent, systématiquement.
 *
 *  2. LE PALIER EST UN PLAFOND. Toute la valeur de l'échelle tient à ce
 *     qu'un palier 2 ne dise pas ce qu'un palier 4 dirait. Un modèle serviable
 *     donne spontanément la solution ; il faut donc le lui interdire à chaque
 *     appel, pas une fois dans un préambule.
 *
 *  3. NE PAS SAVOIR SE DIT. Sans corrigé et avec un énoncé vide, la seule
 *     réponse honnête est `insufficientData: true`. Le schéma la rend
 *     exprimable, le prompt la rend obligatoire.
 */

/**
 * Le prompt système — STABLE d'un appel à l'autre, donc cacheable par le
 * fournisseur (voir lib/ai/providers/anthropic.ts). Tout ce qui varie est dans
 * le message utilisateur.
 */
export const HINT_SYSTEM_PROMPT = `Tu es le copilote pédagogique de TaekdHub, utilisé par UN élève de classe préparatoire scientifique MP (deuxième année, programme français).

TON RÔLE
Tu fais RÉFLÉCHIR l'élève. Tu ne fais pas l'exercice à sa place. Le problème que tu traites est précis : cet élève réussit un exercice proche d'un exercice déjà vu, et bloque dès que la situation est nouvelle. Lui donner la solution aggrave exactement ce problème.

RÈGLE ABSOLUE — LA SOURCE
Tu réponds à partir de l'ÉNONCÉ, des INDICES DU PROFESSEUR et du CORRIGÉ qui te sont fournis. Ils font autorité, y compris contre ce que tu crois savoir : les notations, les conventions et le découpage du programme de MP sont ceux de ces documents.
- Si le corrigé est fourni, il tranche.
- Si aucun corrigé n'est fourni, tu peux raisonner à partir de l'énoncé, mais tu ne prétends jamais connaître LA solution attendue.
- Tu n'inventes JAMAIS un théorème, un nom de résultat, une référence ou une formule. Si tu n'es pas sûr d'un énoncé de théorème, tu décris la propriété en mots plutôt que de la nommer faussement.
- Si l'énoncé est vide ou inexploitable, tu réponds insufficientData: true et tu expliques ce qui manque. Tu ne combles pas le vide.

RÈGLE ABSOLUE — LE PALIER
On te demande un palier précis. Ce palier est un PLAFOND, jamais un plancher.
- Tu ne dis rien qui appartienne à un palier supérieur, même si c'est tentant, même si l'élève le demande, même si cela paraît plus utile.
- Tu ne donnes ni la réponse finale, ni le résultat numérique, tant que le palier 6 n'est pas demandé.

FORME
- Tu écris en français, en tutoyant l'élève, à l'oral d'un professeur qui accompagne — pas d'un manuel.
- "question" est ce que l'élève doit se demander AVANT de lire l'aide. C'est une vraie question ouverte, pas une formalité.
- "hint" est court : deux à quatre phrases. Les mathématiques s'écrivent en LaTeX entre $ … $.
- Tu ne félicites pas, tu ne dramatises pas, tu ne commentes pas son niveau.`;

/** Rendu lisible du contexte — du texte étiqueté plutôt que du JSON brut : un modèle lit mieux des sections nommées. */
export function renderHintPrompt(request: AIHintRequest): string {
  const { context, level, studentSaid } = request;
  const { exercise, learner } = context;

  const parts: string[] = [];

  parts.push(`## Exercice
Titre : ${exercise.title}
Matière : ${exercise.subject}${exercise.chapter ? `
Chapitre : ${exercise.chapter}` : ""}
Difficulté déclarée : ${exercise.difficulty}/5${exercise.level !== null ? `
Palier de la fiche : ${exercise.level}/6` : ""}${exercise.prerequisites.length > 0 ? `
Prérequis notés sur la fiche : ${exercise.prerequisites.join(", ")}` : ""}${exercise.pedagogicalGoal ? `
Objectif pédagogique de la fiche : ${exercise.pedagogicalGoal}` : ""}`);

  parts.push(`## Énoncé
${exercise.statement.trim() || "(aucun énoncé saisi dans TaekdHub)"}`);

  if (exercise.hints.length > 0) {
    parts.push(`## Indices déjà rédigés par le professeur (dans l'ordre)
${exercise.hints.map((hint, index) => `${index + 1}. ${hint}`).join("\n")}

Ces indices sont la progression voulue par le professeur : appuie-toi dessus, ne les contredis pas, et ne dévoile pas ceux qui vont au-delà du palier demandé.`);
  }

  if (exercise.correction) {
    parts.push(`## Corrigé (vérité terrain — ne le recopie pas, sers-t'en pour viser juste)
${exercise.correction}`);
  } else {
    parts.push(`## Corrigé
Aucun corrigé n'est disponible pour cet exercice. Tu ne prétends donc pas connaître la solution attendue.`);
  }

  parts.push(`## L'élève
Classe : ${learner.classe}
Maîtrise déclarée de cette fiche : ${learner.exerciseMastery}/100${learner.chapterMastery !== null ? `
Maîtrise moyenne du chapitre : ${learner.chapterMastery}/100` : ""}
Tentatives déjà enregistrées sur cette fiche : ${learner.attemptsOnExercise}
Temps déjà passé dessus : ${learner.minutesOnExercise} min${
    learner.previousResults
      ? `
Résultats déclarés sur les tentatives précédentes : ${learner.previousResults.succeeded} réussies, ${learner.previousResults.partial} partielles, ${learner.previousResults.failed} échouées`
      : `
Aucune tentative notée pour l'instant (on ne sait pas comment ça s'est passé — n'en conclus rien).`
  }`);

  if (studentSaid) {
    parts.push(`## Ce que l'élève dit avoir tenté
${studentSaid}

Pars de CE QU'IL DIT. S'il se trompe, ne le corrige pas frontalement : amène-le à voir où ça coince.`);
  }

  parts.push(`## Ce qui t'est demandé
Palier ${level} sur 6 — « ${HINT_LEVEL_LABELS[level]} ».
Règle de ce palier : ${HINT_LEVEL_RULES[level]}

Tu réponds UNIQUEMENT pour ce palier. Le champ "level" de ta réponse vaut exactement ${level}.`);

  return parts.join("\n\n");
}

/** Bornes de génération — un indice est court, `max_tokens` n'a aucune raison d'être large, et c'est aussi une borne de coût. */
export const HINT_MAX_TOKENS = 1200;
