import type { AIFailure, AIRequest, AIResponse } from "@/lib/ai/types";

/**
 * L'ABSTRACTION FOURNISSEUR.
 *
 * Elle existe pour une raison simple : TaekdHub ne doit pas être verrouillé
 * sur un fournisseur de modèle. Tout ce qui est spécifique à un fournisseur
 * (SDK, authentification, forme des messages, sorties structurées) vit
 * derrière cette interface, dans lib/ai/providers/. Le reste de
 * l'application — le service, la route, le client, l'interface — n'en connaît
 * que la signature.
 *
 * `generate` est le seul point d'entrée : les tâches de haut niveau
 * (`giveHint`, et plus tard `analyzeAttempt`, `explainConcept`,
 * `analyzeWriting`) sont construites PAR-DESSUS dans lib/ai/service.ts, à
 * partir de `AIRequest`. Multiplier les méthodes dans l'interface obligerait
 * chaque nouveau fournisseur à toutes les réimplémenter pour n'en changer que
 * le transport.
 *
 * CE FICHIER N'EST JAMAIS IMPORTÉ PAR LE NAVIGATEUR : une implémentation
 * détient la clé d'API. Voir app/api/ai/route.ts, le seul appelant.
 */

/** Résultat d'un appel — jamais une exception : l'échec est une valeur, comme partout ailleurs dans ce projet (voir `writeKey`). */
export type AIOutcome = { ok: true; response: AIResponse } | { ok: false; failure: AIFailure };

export interface AIProvider {
  /** Nom court, pour les journaux et le diagnostic. Jamais affiché à l'élève. */
  readonly name: string;
  generate(request: AIRequest, signal?: AbortSignal): Promise<AIOutcome>;
}

/**
 * Fournisseur d'ATTENTE — renvoyé quand aucune clé n'est configurée.
 *
 * Il ne lève pas et ne se plaint pas : il répond `not-configured`, et toute la
 * chaîne au-dessus sait déjà traiter ce cas (l'interface masque le Copilot).
 * C'est ce qui rend l'IA réellement facultative plutôt que théoriquement
 * facultative — le mode « sans IA » est le chemin par défaut, pas une
 * dégradation à laquelle on penserait après coup.
 */
export const unconfiguredProvider: AIProvider = {
  name: "aucun",
  async generate() {
    return {
      ok: false,
      failure: { code: "not-configured", message: "Le Copilot IA n'est pas configuré sur ce serveur." },
    };
  },
};
