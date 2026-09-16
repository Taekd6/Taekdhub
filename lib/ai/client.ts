import { parseHintResponse } from "@/lib/ai/schema";
import type { AIFailure, AIHintRequest, AIHintResponse } from "@/lib/ai/types";

/**
 * APPEL DEPUIS LE NAVIGATEUR — la seule moitié cliente de la chaîne.
 *
 * Ne connaît ni fournisseur, ni clé, ni prompt : juste une URL, un délai, et
 * le validateur. C'est ce qui rend le changement de fournisseur invisible
 * d'ici.
 *
 * REVALIDATION CÔTÉ CLIENT, alors que la route a déjà validé : ce n'est pas de
 * la paranoïa, c'est la règle de ce projet. Une réponse peut venir d'un cache,
 * d'un proxy d'entreprise, d'une route plus ancienne restée déployée. Ce qui
 * atteint le rendu a été vérifié par le code qui fait le rendu.
 */

export const AI_ENDPOINT = "/api/ai";
/** Le client abandonne AVANT le serveur (25 s) — sinon l'élève voit une roue tourner après que tout est déjà perdu. */
export const CLIENT_TIMEOUT_MS = 30_000;

export type AIHintOutcome = { ok: true; response: AIHintResponse } | { ok: false; failure: AIFailure };

function networkFailure(message = "Le Copilot IA est injoignable."): AIHintOutcome {
  return { ok: false, failure: { code: "network", message } };
}

/**
 * « Le Copilot est-il configuré ? » — appelé UNE FOIS au montage, jamais à
 * chaque rendu. Sans clé, l'interface n'affiche aucune entrée IA : le mode
 * sans IA est le défaut, pas une erreur qu'on rattrape.
 */
export async function probeAIAvailability(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(AI_ENDPOINT, { method: "GET", signal });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && (body as { configured?: unknown }).configured === true;
  } catch {
    // Route absente (export statique), hors-ligne, bloquée : dans tous les cas,
    // pas de Copilot. Aucune raison de distinguer — le résultat est le même.
    return false;
  }
}

export async function requestHint(request: AIHintRequest, signal?: AbortSignal): Promise<AIHintOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  // L'abandon de l'appelant (fermeture de l'exercice) et le délai mènent au
  // même endroit : une seule sortie à gérer.
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      return { ok: false, failure: { code: "invalid-response", message: "La réponse reçue n'était pas exploitable." } };
    }

    if (!response.ok) {
      const failure = readFailure(body);
      return { ok: false, failure: failure ?? { code: "provider", message: "Le Copilot IA a renvoyé une erreur." } };
    }

    const parsed = parseHintResponse(
      typeof body === "object" && body !== null ? (body as { response?: unknown }).response : null,
      request.level
    );
    if (!parsed) {
      return { ok: false, failure: { code: "invalid-response", message: "La réponse reçue n'était pas exploitable." } };
    }
    return { ok: true, response: parsed };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return networkFailure("Le Copilot IA n'a pas répondu à temps.");
    }
    return networkFailure();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Lit le `failure` d'une réponse d'erreur, sans jamais faire confiance à sa forme. */
export function readFailure(body: unknown): AIFailure | null {
  if (typeof body !== "object" || body === null) return null;
  const failure = (body as { failure?: unknown }).failure;
  if (typeof failure !== "object" || failure === null) return null;
  const code = (failure as { code?: unknown }).code;
  const message = (failure as { message?: unknown }).message;
  const codes = ["not-configured", "network", "provider", "invalid-response", "bad-request"];
  if (typeof code !== "string" || !codes.includes(code)) return null;
  if (typeof message !== "string" || !message.trim()) return null;
  return { code: code as AIFailure["code"], message: message.trim() };
}
