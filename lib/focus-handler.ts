import { bearerToken } from "@/lib/hermes-auth";
import { MIN_CAPTURE_TOKEN_LENGTH } from "@/lib/capture-handler";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import type { CollectionStore } from "@/lib/mcp-collections";
import { buildPhases, focusAlerts, hhmm, normalizeFocusConfig, suggestGoals, type GoalSuggestion } from "@/lib/focus-session";
import { reminderUrl } from "@/lib/rappels";
import { normalizeWorkItem, type WorkItem } from "@/lib/storage";

/**
 * LE GESTIONNAIRE DE `/api/session` — le pont entre le raccourci iOS
 * « Start session » (lancé à la voix, Apple Watch comprise) et TaekdHub.
 *
 * Même porte que la synchro Rappels : `CAPTURE_TOKEN` en `Authorization:
 * Bearer …`, `MCP_USER_ID` pour le compte. LECTURE SEULE : la route n'écrit
 * rien en base — elle propose l'objectif et calcule l'horaire.
 *
 *   GET  → { objectifs: [{ titre, id, raison }], choix: [titres…, "Autre"], reglages }
 *   POST { objectif, cycles?, travail?, pause? }
 *        → { objectif, id, debut, fin, alertes: [{ titre, heure, date, url }], lien }
 *
 * Les `alertes` deviennent des rappels à l'heure dite (liste « Session ») :
 * ce sont eux qui font vibrer la montre. La dernière porte l'adresse de la
 * tâche quand l'objectif en est une : la cocher dans Rappels la coche aussi
 * dans TaekdHub (même lien que la synchro Rappels).
 */

export interface FocusEnv {
  token: string | undefined;
  userId: string | undefined;
  siteUrl: string;
  store: (userId: string) => CollectionStore;
  now: () => Date;
}

const MAX_BODY_BYTES = 4_096;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** « 2026-10-28T18:50:00+01:00 » : date locale avec son décalage, lisible par Raccourcis. */
export function isoLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off >= 0 ? "+" : "-"}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

function readItems(raw: unknown): WorkItem[] {
  return Array.isArray(raw) ? raw.map((item) => normalizeWorkItem(item)) : [];
}

/** L'objectif dit par l'élève (titre choisi, identifiant, ou texte libre) → tâche connue ou objectif libre. */
export function resolveGoal(input: string, items: WorkItem[], suggestions: GoalSuggestion[]): { title: string; id: string | null } {
  const wanted = input.trim();
  const lower = wanted.toLowerCase();
  const byId = items.find((item) => item.id === wanted);
  if (byId) return { title: byId.title, id: byId.id };
  const suggested = suggestions.find((s) => s.title.toLowerCase() === lower);
  if (suggested) return { title: suggested.title, id: suggested.id };
  const open = items.find((item) => (item.status === "à faire" || item.status === "en cours") && item.title.toLowerCase() === lower);
  if (open) return { title: open.title, id: open.id };
  return { title: wanted.slice(0, 200), id: null };
}

export async function handleFocus(req: Request, env: FocusEnv): Promise<Response> {
  if (!env.token || env.token.length < MIN_CAPTURE_TOKEN_LENGTH || !env.userId) return json({ error: "Session non configurée sur le serveur." }, 503);
  if (!isMcpKeyValid(bearerToken(req.headers.get("authorization")), env.token)) return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });

  const now = env.now();
  let items: WorkItem[];
  try {
    items = readItems((await env.store(env.userId).read())?.items);
  } catch {
    return json({ error: "Lecture impossible. Réessaie dans un instant." }, 500);
  }
  const suggestions = suggestGoals(items, now, 5);

  if (req.method === "GET") {
    return json({
      objectifs: suggestions.map((s) => ({ titre: s.title, id: s.id, raison: s.reason })),
      choix: [...suggestions.map((s) => s.title), "Autre"],
      reglages: normalizeFocusConfig(null),
    }, 200);
  }
  if (req.method !== "POST") return json({ error: "Méthode non prise en charge." }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Requête trop grande." }, 413);
  let body: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "JSON illisible." }, 400);
    }
  }
  const said = typeof body.objectif === "string" ? body.objectif.trim() : "";
  // Rien de dit (ou « Autre » sans texte) : on prend la première proposition, sinon un objectif générique.
  const goal = said && said.toLowerCase() !== "autre" ? resolveGoal(said, items, suggestions) : suggestions[0] ? { title: suggestions[0].title, id: suggestions[0].id } : { title: "Séance libre", id: null };
  const config = normalizeFocusConfig({ cycles: body.cycles, workMinutes: body.travail, breakMinutes: body.pause });
  const start = now.getTime();
  const phases = buildPhases(start, config);
  const alerts = focusAlerts(phases, goal.title);
  const taskUrl = goal.id ? reminderUrl(env.siteUrl, goal.id) : null;
  const site = env.siteUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ objectif: goal.title, debut: String(start), cycles: String(config.cycles), travail: String(config.workMinutes), pause: String(config.breakMinutes) });
  if (goal.id) params.set("tache", goal.id);

  return json({
    objectif: goal.title,
    id: goal.id,
    reglages: config,
    debut: isoLocal(start),
    fin: isoLocal(phases[phases.length - 1].end),
    alertes: alerts.map((alert, index) => ({
      titre: alert.title,
      heure: hhmm(alert.at),
      date: isoLocal(alert.at),
      url: index === alerts.length - 1 ? taskUrl : null,
    })),
    lien: `${site}/session?${params.toString()}`,
  }, 200);
}
