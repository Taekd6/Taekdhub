import { NextResponse } from "next/server";
import { guardHintRequest } from "@/lib/ai/guard";
import { createAnthropicProvider, DEFAULT_MODEL } from "@/lib/ai/providers/anthropic";
import { unconfiguredProvider, type AIProvider } from "@/lib/ai/provider";
import type { AIFailure } from "@/lib/ai/types";

/**
 * L'UNIQUE POINT DE PASSAGE VERS LE FOURNISSEUR IA.
 *
 * CONSÉQUENCE ASSUMÉE SUR L'ARCHITECTURE : jusqu'ici, TaekdHub était
 * intégralement statique — 23 pages prérendues, aucune fonction serveur, tout
 * dans le localStorage. Une vraie intégration IA ne peut pas le rester : une
 * clé d'API ne doit JAMAIS atteindre le navigateur, donc il faut un endroit
 * qui s'exécute côté serveur. C'est cette route, et elle seule. Les 23 pages
 * restent statiques ; seule `/api/ai` est dynamique, et elle n'existe que si
 * quelqu'un l'appelle.
 *
 * Le corollaire est important pour l'hébergement : l'application continue de
 * fonctionner en export statique pur SANS cette route — sans Copilot, mais
 * complète. Voir README pour Vercel.
 *
 * `force-dynamic` : sans cela, Next tenterait de préévaluer la route au build,
 * où `TAEKDHUB_AI_API_KEY` n'existe pas.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clé côté SERVEUR uniquement. Jamais `NEXT_PUBLIC_*` — ce préfixe est précisément ce qui expose une variable au navigateur. */
const API_KEY_ENV = "TAEKDHUB_AI_API_KEY";
const MODEL_ENV = "TAEKDHUB_AI_MODEL";

/**
 * Construit le fournisseur À CHAQUE REQUÊTE plutôt qu'au chargement du module.
 *
 * Un module chargé une fois fige la configuration au démarrage : ajouter la
 * clé dans le tableau de bord de l'hébergeur n'aurait alors aucun effet avant
 * un redéploiement, et le diagnostic serait incompréhensible. Le coût est un
 * objet client par requête, ce qui est négligeable devant l'appel lui-même.
 */
function resolveProvider(): AIProvider {
  const key = process.env[API_KEY_ENV];
  if (!key || !key.trim()) return unconfiguredProvider;
  return createAnthropicProvider(key.trim(), process.env[MODEL_ENV]?.trim() || DEFAULT_MODEL);
}

function failure(code: AIFailure["code"], message: string, status: number) {
  return NextResponse.json({ ok: false, failure: { code, message } } satisfies { ok: false; failure: AIFailure }, { status });
}

/**
 * `GET` — l'interface demande « le Copilot est-il disponible ? » AVANT
 * d'afficher quoi que ce soit. Ne consomme aucun jeton, ne révèle pas la clé,
 * et permet au mode hors-ligne d'être le comportement par défaut plutôt qu'un
 * rattrapage après un échec visible.
 */
export async function GET() {
  const configured = resolveProvider().name !== "aucun";
  return NextResponse.json({ configured });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("bad-request", "Requête illisible.", 400);
  }

  const guarded = guardHintRequest(body);
  if (!guarded.ok) return failure("bad-request", guarded.message, 400);

  const provider = resolveProvider();
  if (provider.name === "aucun") {
    // 503 et non 500 : ce n'est pas une panne, c'est une absence de
    // configuration — l'interface doit masquer le Copilot, pas afficher une erreur.
    return failure("not-configured", "Le Copilot IA n'est pas configuré sur ce serveur.", 503);
  }

  // `request.signal` : si l'élève ferme l'exercice, l'appel est abandonné
  // plutôt que payé jusqu'au bout.
  const outcome = await provider.generate(guarded.request, request.signal);
  if (!outcome.ok) {
    const status = outcome.failure.code === "provider" ? 502 : outcome.failure.code === "bad-request" ? 400 : 504;
    return NextResponse.json({ ok: false, failure: outcome.failure }, { status });
  }

  return NextResponse.json({ ok: true, response: outcome.response });
}
