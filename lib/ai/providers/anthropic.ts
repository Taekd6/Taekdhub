import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HINT_RESPONSE_JSON_SCHEMA, parseHintPayload } from "@/lib/ai/schema";
import { HINT_MAX_TOKENS, HINT_SYSTEM_PROMPT, renderHintPrompt } from "@/lib/ai/service";
import type { AIOutcome, AIProvider } from "@/lib/ai/provider";
import type { AIRequest } from "@/lib/ai/types";

/**
 * FOURNISSEUR ANTHROPIC.
 *
 * `import "server-only"` en première ligne : ce n'est pas décoratif. Si un
 * composant client importe ce fichier, même indirectement, la compilation
 * ÉCHOUE. C'est la garantie mécanique que la clé d'API ne peut pas se
 * retrouver dans un paquet servi au navigateur — bien plus solide qu'une
 * convention de nommage.
 *
 * Le modèle est choisi par variable d'environnement, avec un défaut explicite :
 * l'élève ne paie pas la facture, mais celui qui déploie doit pouvoir
 * descendre en gamme sans toucher au code.
 */

/** Modèle par défaut. Surchargeable par `TAEKDHUB_AI_MODEL` — voir README. */
export const DEFAULT_MODEL = "claude-opus-5";

/** Délai au-delà duquel on abandonne côté serveur. Un indice qui met 30 s n'est plus une aide. */
export const PROVIDER_TIMEOUT_MS = 25_000;

export function createAnthropicProvider(apiKey: string, model: string = DEFAULT_MODEL): AIProvider {
  const client = new Anthropic({ apiKey, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 1 });

  return {
    name: "anthropic",
    async generate(request: AIRequest, signal?: AbortSignal): Promise<AIOutcome> {
      if (request.task !== "hint") {
        return { ok: false, failure: { code: "bad-request", message: "Tâche inconnue." } };
      }

      try {
        const response = await client.messages.create(
          {
            model,
            max_tokens: HINT_MAX_TOKENS,
            // Le prompt système est STABLE d'un appel à l'autre : marqué
            // cacheable, il n'est facturé plein tarif qu'une fois par fenêtre.
            // Tout ce qui varie (l'exercice, l'élève, le palier) est dans le
            // message utilisateur, donc APRÈS le point de césure.
            system: [{ type: "text", text: HINT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: renderHintPrompt(request) }],
            // Sortie structurée : le modèle ne peut pas renvoyer de prose
            // libre là où l'interface attend des champs. La réponse est
            // REVALIDÉE derrière (lib/ai/schema.ts) — ceci contraint
            // l'émission, cela protège la réception.
            //
            // `effort: "low"` : produire un indice d'un palier donné à partir
            // d'un corrigé déjà fourni ne demande pas de longue délibération,
            // et l'effort est le premier levier de coût comme de latence.
            output_config: {
              format: { type: "json_schema", schema: HINT_RESPONSE_JSON_SCHEMA },
              effort: "low",
            },
          },
          { signal }
        );

        if (response.stop_reason === "refusal") {
          return { ok: false, failure: { code: "provider", message: "Le modèle a refusé de répondre à cette demande." } };
        }
        // Tronqué par `max_tokens` : le JSON est incomplet, donc inexploitable.
        // Mieux vaut le dire que laisser le validateur échouer sans raison lisible.
        if (response.stop_reason === "max_tokens") {
          return { ok: false, failure: { code: "invalid-response", message: "La réponse a été coupée avant d'être complète." } };
        }

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");

        const parsed = parseHintPayload(text, request.level);
        if (!parsed) {
          return { ok: false, failure: { code: "invalid-response", message: "La réponse reçue n'était pas exploitable." } };
        }
        return { ok: true, response: parsed };
      } catch (error) {
        return { ok: false, failure: classify(error) };
      }
    },
  };
}

/**
 * Traduit une erreur du SDK en `AIFailure` AFFICHABLE.
 *
 * On distingue ce que l'élève peut corriger (rien, ici) de ce qui relève du
 * déploiement : une clé invalide et une surcharge passagère n'appellent pas la
 * même phrase, et surtout pas la même conduite côté interface (réessayer a du
 * sens dans un cas, pas dans l'autre).
 */
function classify(error: unknown): { code: "network" | "provider" | "bad-request"; message: string } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { code: "provider", message: "La clé du Copilot IA est refusée par le fournisseur." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { code: "provider", message: "Le Copilot IA est momentanément saturé. Réessaie dans un instant." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { code: "bad-request", message: "La demande envoyée au Copilot a été refusée." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: "network", message: "Le Copilot IA est injoignable." };
  }
  if (error instanceof Anthropic.APIError) {
    return { code: "provider", message: "Le Copilot IA a renvoyé une erreur." };
  }
  return { code: "network", message: "Le Copilot IA est injoignable." };
}
