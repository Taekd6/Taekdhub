#!/usr/bin/env node
/**
 * VÉRIFIER L'ACCÈS HERMES — un vrai appel au serveur MCP, sans jamais afficher le jeton.
 *
 * Usage :
 *   node scripts/hermes-check.mjs <url> [chemin/vers/.env]
 *
 *   <url>     https://taekdhub.vercel.app/api/mcp-hermes (production)
 *   .env      fichier contenant TAEKDHUB_MCP_TOKEN=… (celui d'Hermes, par exemple
 *             %LOCALAPPDATA%\hermes\.env). Sans fichier, la variable d'environnement
 *             TAEKDHUB_MCP_TOKEN est utilisée. VERCEL_AUTOMATION_BYPASS_SECRET, si présente,
 *             n'est envoyée qu'aux URL de Preview (jamais à la production).
 *
 * Ce que le script affiche : codes HTTP, noms des outils, clés de la réponse, fraîcheur.
 * Ce qu'il n'affiche JAMAIS : le jeton, le contournement, le contenu des données.
 *
 * Essais faits, dans l'ordre :
 *   1. sans jeton                → 401 attendu
 *   2. jeton aléatoire           → 401 attendu
 *   3. bon jeton : tools/list    → exactement get_today, list_echeances
 *   4. get_today, list_echeances → HTTP 200 et JSON lisible
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const [url, envFile] = process.argv.slice(2);
if (!url || !/^https?:\/\/[^?#]+\/api\/mcp-hermes$/.test(url)) {
  console.error("Usage : node scripts/hermes-check.mjs https://taekdhub.vercel.app/api/mcp-hermes [chemin/.env]");
  console.error("(l'URL ne doit contenir aucun paramètre : le jeton ne va jamais dans l'URL)");
  process.exit(2);
}

const env = { ...process.env };
if (envFile) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    // Espaces et retour chariot autour de la valeur : sinon un faux 401.
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "").trim();
  }
}
const token = env.TAEKDHUB_MCP_TOKEN?.trim() || undefined;
// Le jeton ne part jamais en clair : HTTPS obligatoire (sauf essai local).
if (token && !/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("Refus : le jeton ne s'envoie qu'en HTTPS.");
  process.exit(2);
}
const isPreview = !/^https:\/\/taekdhub\.vercel\.app\//.test(url);
const bypass = isPreview ? env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined;

const EXPECTED_TOOLS = ["get_today", "list_echeances"];
let failures = 0;
const ok = (label) => console.log(`  ✓ ${label}`);
const ko = (label) => {
  failures += 1;
  console.log(`  ✗ ${label}`);
};

function parseBody(body) {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const data = trimmed.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).pop();
  return data ? JSON.parse(data) : null;
}

async function rpc(method, params, authorization) {
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (authorization) headers.Authorization = authorization;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = await response.text();
  let json = null;
  try {
    json = parseBody(body);
  } catch {
    /* corps non JSON (« Unauthorized ») */
  }
  return { status: response.status, json };
}

console.log(`Serveur : ${url}${isPreview ? " (Preview)" : " (production)"}`);
console.log(`Jeton fourni : ${token ? `oui, ${token.length} caractères` : "NON"}${isPreview ? ` · contournement Preview : ${bypass ? "oui" : "non"}` : ""}`);

console.log("\n1. Refus sans jeton");
const anonymous = await rpc("tools/list", {}, null);
if (anonymous.status === 401) ok("401 sans jeton");
else ko(`attendu 401, reçu ${anonymous.status}`);

console.log("2. Refus d'un jeton inventé");
const wrong = await rpc("tools/list", {}, `Bearer ${randomBytes(32).toString("hex")}`);
if (wrong.status === 401) ok("401 avec un jeton aléatoire");
else ko(`attendu 401, reçu ${wrong.status}`);

if (!token) {
  console.log("\nPas de jeton : les essais authentifiés sont sautés (TAEKDHUB_MCP_TOKEN absent).");
  process.exit(failures ? 1 : 0);
}

console.log("3. Outils annoncés avec le bon jeton");
const list = await rpc("tools/list", {}, `Bearer ${token}`);
if (list.status === 401) {
  ko("401 avec ton jeton : il ne correspond pas à MCP_HERMES_TOKEN de CE déploiement (valeur différente, ou déploiement construit avant la variable → redéployer)");
  process.exit(1);
}
const tools = (list.json?.result?.tools ?? []).map((tool) => tool.name).sort();
if (JSON.stringify(tools) === JSON.stringify([...EXPECTED_TOOLS].sort())) ok(`outils : ${tools.join(", ")}`);
else ko(`outils inattendus : ${tools.join(", ") || "(aucun)"} — HTTP ${list.status}`);

console.log("4. Lectures");
for (const [name, args] of [["get_today", {}], ["list_echeances", { jours: 14 }]]) {
  const call = await rpc("tools/call", { name, arguments: args }, `Bearer ${token}`);
  const text = call.json?.result?.content?.[0]?.text ?? "";
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* message texte */
  }
  if (call.status !== 200) ko(`${name} : HTTP ${call.status}`);
  else if (!parsed) ko(`${name} : réponse non JSON — « ${text.slice(0, 100)} »`);
  else {
    const fraicheur = parsed.meta?.fraicheur;
    ok(`${name} : JSON, clés ${Object.keys(parsed).join(", ")}`);
    if (fraicheur) console.log(`     fraîcheur : dernière synchro ${fraicheur.derniere_synchro_travail ?? "?"} · données anciennes ${fraicheur.donnees_anciennes} · consigne ${JSON.stringify(fraicheur.consigne)}`);
    if (parsed.donnees_indisponibles?.length) console.log(`     indisponible : ${parsed.donnees_indisponibles.join(", ")}`);
    if (name === "list_echeances") {
      console.log(`     échéances : ${parsed.echeances?.length ?? "?"} · liste concluante : ${parsed.liste_concluante} · échéances synchronisées : ${fraicheur?.echeances_synchronisees}`);
      if (parsed.liste_concluante === false) console.log("     ⚠ liste non concluante : aucune échéance n'a jamais été synchronisée — une liste vide ne veut pas dire « aucune échéance ».");
    }
  }
}

console.log(failures ? `\n${failures} échec(s).` : "\nTout est bon : Hermes peut lire TaekdHub.");
process.exit(failures ? 1 : 0);
