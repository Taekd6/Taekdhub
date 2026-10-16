#!/usr/bin/env node
/**
 * Parcours Chromium du panneau « Démonstrations » (/anki), DÉTERMINISTE : les notes
 * Anki sont retrouvées par leur référence (`Ref:th-demo-…`) ou leur étiquette, jamais
 * par leur rang dans la collection.
 *
 *   BASE_URL=http://localhost:3115 node scripts/e2e/demonstrations-e2e.mjs down   # AnkiConnect éteint
 *   BASE_URL=http://localhost:3115 node scripts/e2e/demonstrations-e2e.mjs up     # AnkiConnect (simulateur ou vrai) sur :8765
 *
 * Prérequis : application construite et lancée (`pnpm build && pnpm exec next start -p 3115`),
 * Playwright global (`npm i -g playwright`), Chromium (PLAYWRIGHT_BROWSERS_PATH).
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

// Playwright est installé globalement (npm i -g playwright), pas dans le projet : aucune dépendance ajoutée.
const load = createRequire(import.meta.url);
const { chromium } = load(`${execSync("npm root -g").toString().trim()}/playwright`);
const BASE = process.env.BASE_URL || "http://localhost:3115";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PHASE = process.argv[2];
const RANG = "m1-theoreme-du-rang";
const REF = `th-demo-${RANG}`;
const TRIAL_PACKAGE = new URL("../../public/anki/taekdhub-demonstration-ipad.apkg", import.meta.url).pathname;
const NOTE_TYPE = "TaekdHub — Démonstration";

const restitution = (date, extra = {}) =>
  JSON.stringify({
    demonstration: RANG, date, resultat: "incomplète", aide: "sans",
    lacunes: [{ type: "hypothèse", detail: "A oublié que E est de dimension finie", confiance: "certaine" }],
    commentaire: "Hypothèse oubliée.",
    carte_proposee: { recto: "Théorème du rang : quelle hypothèse porte sur E ?", verso: "E de dimension finie (F quelconque)." },
    ...extra,
  });
const success = (date) => JSON.stringify({ demonstration: RANG, date, resultat: "réussie", aide: "sans" });

let failed = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "OK   " : "ECHEC"} ${message}`);
  if (!condition) failed += 1;
};

/** Interroge Anki par le protocole AnkiConnect — par critères, jamais par position. */
async function anki(action, params = {}) {
  const response = await fetch("http://127.0.0.1:8765", { method: "POST", body: JSON.stringify({ action, version: 6, params }) });
  const body = await response.json();
  if (body.error) throw new Error(`${action}: ${body.error}`);
  return body.result;
}
async function notesWhere(query) {
  const ids = await anki("findNotes", { query });
  return ids.length ? anki("notesInfo", { notes: ids }) : [];
}
async function deckOf(note) {
  const [card] = await anki("cardsInfo", { cards: note.cards });
  return card.deckName;
}

async function open(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/anki`, { waitUntil: "networkidle" });
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Démonstrations" }) });
  await panel.waitFor();
  return { page, panel, errors, li: panel.locator("li", { hasText: "Théorème du rang" }).first() };
}
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), key);
async function paste(panel, text) {
  await panel.getByRole("textbox", { name: /Réponse de l/ }).fill(text);
  await panel.getByRole("button", { name: "Vérifier", exact: true }).last().click();
}
async function saveRestitution(panel, text) {
  await paste(panel, text);
  await panel.getByRole("button", { name: /^Enregistrer la restitution$|^Restitution enregistrée$/ }).click();
}

async function phaseDown(browser) {
  console.log("— AnkiConnect INDISPONIBLE —");
  const { page, panel, li, errors } = await open(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  await panel.getByRole("button", { name: /Vérifier dans Anki/ }).click();
  await panel.getByText(/Anki ne répond pas/).waitFor();
  ok(true, "« Vérifier dans Anki » : message clair « Anki ne répond pas… »");
  ok(JSON.stringify((await stored(page, "prepahub:preferences"))?.demoCards ?? {}) === "{}", "rien n'est marqué « carte dans Anki » après l'échec");
  await li.getByLabel("Choisir Théorème du rang").check();
  await panel.getByRole("button", { name: /Envoyer 1 vers Anki/ }).click();
  await panel.getByText(/Anki ne répond pas/).waitFor();
  ok(true, "« Envoyer » : même message, pas d'exception brute");
  ok(/pas confirmée/.test(await li.textContent()), "la carte reste « pas confirmée »");
  await saveRestitution(panel, restitution("2026-10-10"));
  ok((await stored(page, "prepahub:attempts"))?.length === 1, "une restitution s'enregistre quand même, sans Anki (le panneau n'en dépend pas)");
  ok(/Restitution incomplète/.test(await li.textContent()), "l'état « incomplète » s'affiche sans Anki");
  ok((await page.locator("a[href='/anki/taekdhub-demonstration-ipad.apkg']").count()) >= 1, "le paquet d'essai iPad reste téléchargeable");
  ok(errors.length === 0, `aucune erreur JavaScript (${errors.length})`);
}

/** Repart d'une collection sans note de test : le parcours est rejouable sur la même instance d'Anki. */
async function cleanSlate() {
  const ids = [...(await anki("findNotes", { query: "deck:TaekdHub*" })), ...(await anki("findNotes", { query: "tag:ciblée" })), ...(await anki("findNotes", { query: `Ref:${REF}` }))];
  if (ids.length) await anki("deleteNotes", { notes: [...new Set(ids)] });
}

/** Installe le type de note comme le ferait l'élève : en IMPORTANT le paquet, puis retire sa note (le type reste). */
async function installNoteType() {
  await anki("importPackage", { path: TRIAL_PACKAGE });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ids = await anki("findNotes", { query: `Ref:${REF}` });
    if (ids.length) {
      await anki("deleteNotes", { notes: ids });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("l'import du paquet d'essai n'a produit aucune note");
}

async function phaseUp(browser) {
  console.log("— AnkiConnect DISPONIBLE (serveur sur 127.0.0.1:8765) —");
  await cleanSlate();
  const typeInstalled = (await anki("modelNames")).includes(NOTE_TYPE);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, panel, li, errors } = await open(context);
  ok(/Non travaillée/.test(await li.textContent()) && /Ajouter la carte à Anki/.test(await li.textContent()), "état initial : non travaillée, action « Ajouter la carte »");

  await li.getByRole("button", { name: "Voir le recto" }).click();
  const front = await li.locator("iframe").getAttribute("srcdoc");
  ok(/Sans support/.test(front) && !/Soit S un suppl/.test(front) && !/Points critiques/.test(front), "recto sans fuite de la preuve");
  ok((await li.locator("iframe").getAttribute("sandbox")) === "", "aperçu dans un cadre sans script");

  // Sans le type de note dans Anki : refus clair, rien n'est créé (jamais de second type de note).
  if (!typeInstalled) {
    await li.getByLabel("Choisir Théorème du rang").check();
    await panel.getByRole("button", { name: /Envoyer 1 vers Anki/ }).click();
    await panel.getByText(/Importe d'abord un paquet/).waitFor();
    ok((await notesWhere(`Ref:${REF}`)).length === 0 && !(await anki("modelNames")).includes(NOTE_TYPE), "type de note absent : refus clair, aucune note, aucun type créé par TaekdHub");
    await li.getByLabel("Choisir Théorème du rang").uncheck();
  } else console.log("INFO  type de note déjà présent dans cette instance d'Anki : refus « type absent » non rejoué (instance neuve requise)");
  await installNoteType();
  ok((await anki("modelNames")).filter((name) => name.startsWith(NOTE_TYPE)).length === 1, "un seul type de note après import du paquet");

  // Envoi : la note est retrouvée par sa référence, avec le bon modèle et le bon paquet.
  await li.getByLabel("Choisir Théorème du rang").check();
  await panel.getByRole("button", { name: /Envoyer 1 vers Anki/ }).click();
  await panel.getByText(/1 ajoutée/).waitFor();
  let found = await notesWhere(`Ref:${REF}`);
  ok(found.length === 1 && found[0].modelName === "TaekdHub — Démonstration", "Anki : une note retrouvée par Ref, bon type de note");
  ok((await deckOf(found[0])) === "TaekdHub::Mathématiques::Applications linéaires", "Anki : paquet du chapitre");
  ok(found[0].fields.Ref.value === REF && /Soit S un suppl/.test(found[0].fields.Preuve.value), "Anki : champs Ref et Preuve remplis");
  const reviewedBefore = (await anki("cardsInfo", { cards: found[0].cards }))[0].reps;

  // Renvoi : aucun doublon, aucune modification.
  await li.getByLabel("Choisir Théorème du rang").check();
  await panel.getByRole("button", { name: /Envoyer 1 vers Anki/ }).click();
  await panel.getByText(/0 ajoutée.*1 déjà dans Anki/).waitFor();
  found = await notesWhere(`Ref:${REF}`);
  ok(found.length === 1 && (await notesWhere('"note:TaekdHub — Démonstration"')).length === 1, "renvoi : toujours une seule note de ce type pour cette référence");
  ok((await anki("cardsInfo", { cards: found[0].cards }))[0].reps === reviewedBefore, "renvoi : la carte et son historique ne sont pas touchés");

  // Restitutions : rien n'est écrit avant le clic ; la première lacune ne crée pas de carte ciblée.
  await paste(panel, restitution("2026-10-10"));
  await panel.getByText(/État après enregistrement/).waitFor();
  ok(/Carte proposée par l'IA non retenue/.test(await panel.textContent()), "première lacune : carte ciblée proposée NON retenue");
  ok(((await stored(page, "prepahub:attempts")) ?? []).length === 0, "rien n'est enregistré avant le clic");
  await panel.getByRole("button", { name: "Enregistrer la restitution" }).click();
  ok((await stored(page, "prepahub:attempts")).length === 1, "enregistrée après le clic explicite");

  // Même lacune, autre jour : carte ciblée retenue, ajoutée seulement sur clic.
  await paste(panel, restitution("2026-10-14"));
  await panel.getByText(/Carte ciblée proposée — aperçu/).waitFor();
  ok(/Créer une carte ciblée/.test(await panel.textContent()), "même lacune dans 2 restitutions : « Créer une carte ciblée »");
  ok((await notesWhere("tag:ciblée")).length === 0, "Anki : aucune carte ciblée avant validation");
  await panel.getByRole("button", { name: "Enregistrer la restitution" }).click();
  await panel.getByRole("button", { name: /Ajouter la carte ciblée à Anki/ }).click();
  await panel.getByText("Carte ajoutée à Anki.").waitFor();
  const targeted = await notesWhere("tag:ciblée");
  ok(targeted.length === 1 && /quelle hypothèse porte sur E/.test(Object.values(targeted[0].fields)[0].value), "Anki : une carte ciblée, retrouvée par son étiquette");
  ok((await deckOf(targeted[0])) === "TaekdHub::Mathématiques::Applications linéaires", "Anki : carte ciblée dans le paquet du chapitre");
  // Message DISTINCT de celui du premier ajout : on attend la réponse du second clic, pas un texte déjà présent.
  await panel.getByRole("button", { name: /Ajouter la carte ciblée à Anki/ }).click();
  await panel.getByText(/rien n'a été créé/).waitFor();
  ok((await notesWhere("tag:ciblée")).length === 1, "ajout répété : toujours une seule carte ciblée (comptée APRÈS la réponse)");

  // Même jour renvoyé : remplacé.
  await saveRestitution(panel, restitution("2026-10-14", { resultat: "échec" }));
  ok((await stored(page, "prepahub:attempts")).length === 2, "même jour renvoyé : remplacé (2 tentatives, pas 3)");

  // Données incohérentes.
  await paste(panel, JSON.stringify({ demonstration: RANG, date: "2026-10-12", resultat: "réussie" }));
  ok(/« aide » est obligatoire/.test(await panel.getByRole("alert").first().textContent()), "réussite sans « aide » refusée");
  await paste(panel, JSON.stringify({ demonstration: RANG, date: "2026-10-12", resultat: "réussie", aide: "sans", lacunes: [{ type: "étape", detail: "x" }] }));
  ok(/ne peut pas avoir de lacunes/.test(await panel.getByRole("alert").first().textContent()), "« réussie » avec des lacunes refusée");
  await paste(panel, JSON.stringify({ demonstration: "inconnue", date: "2026-10-12", resultat: "échec" }));
  ok(/doit être l'un de/.test(await panel.getByRole("alert").first().textContent()), "démonstration inconnue refusée");
  ok((await stored(page, "prepahub:attempts")).length === 2, "les données refusées n'ont rien écrit");

  // Persistance après rechargement.
  await page.reload({ waitUntil: "networkidle" });
  const li2 = page.locator("section", { has: page.getByRole("heading", { name: "Démonstrations" }) }).locator("li", { hasText: "Théorème du rang" }).first();
  ok(/Restitution incomplète/.test(await li2.textContent()) && /Carte dans Anki : oui/.test(await li2.textContent()), "rechargement : état et lien carte restaurés");

  // Une réussite autonome ultérieure vérifie la correction.
  const panel2 = page.locator("section", { has: page.getByRole("heading", { name: "Démonstrations" }) });
  await saveRestitution(panel2, success("2026-10-15"));
  await page.reload({ waitUntil: "networkidle" });
  const li3 = page.locator("section", { has: page.getByRole("heading", { name: "Démonstrations" }) }).locator("li", { hasText: "Théorème du rang" }).first();
  ok(/Réussite autonome/.test(await li3.textContent()), "réussite autonome ultérieure : état « Réussite autonome » après rechargement");

  // « Vérifier dans Anki » reflète Anki : une note supprimée dans Anki n'est plus marquée.
  await anki("deleteNotes", { notes: found.map((note) => note.noteId) });
  await panel2.getByRole("button", { name: /Vérifier dans Anki/ }).click();
  await panel2.getByText(/Aucune carte de démonstration dans Anki/).waitFor();
  ok(/pas confirmée/.test(await page.locator("li", { hasText: "Théorème du rang" }).first().textContent()), "après suppression dans Anki puis vérification : carte « pas confirmée »");
  ok(JSON.stringify((await stored(page, "prepahub:preferences")).demoCards) === "{}", "le lien carte ↔ démonstration est retiré des réglages");
  ok((await anki("modelNames")).filter((name) => name.startsWith(NOTE_TYPE)).length === 1, "à la fin : toujours UN SEUL type de note de démonstration");
  ok(errors.length === 0, `aucune erreur JavaScript (${errors.length})`);

  // Mobile : pas d'envoi direct, mais le paquet est servi.
  const mobile = await (await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" })).newPage();
  await mobile.goto(`${BASE}/anki`, { waitUntil: "networkidle" });
  const mpanel = mobile.locator("section", { has: mobile.getByRole("heading", { name: "Démonstrations" }) });
  await mpanel.waitFor();
  ok(await mpanel.getByRole("button", { name: /Vérifier dans Anki/ }).isDisabled(), "tablette / téléphone : pas d'envoi direct (AnkiConnect indisponible)");
  for (const file of ["taekdhub-demonstrations.apkg", "taekdhub-demonstration-ipad.apkg"]) {
    const response = await mobile.request.get(`${BASE}/anki/${file}`);
    ok(response.status() === 200 && (await response.body()).length > 10_000, `${file} est servi`);
  }
}

(async () => {
  if (!["up", "down"].includes(PHASE)) throw new Error("usage : demonstrations-e2e.mjs up|down");
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    await (PHASE === "down" ? phaseDown : phaseUp)(browser);
  } finally {
    await browser.close();
  }
  console.log(failed === 0 ? "\nTOUT EST VALIDE" : `\n${failed} ÉCHEC(S)`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("ECHEC DU SCRIPT :", error.message.split("\n")[0]);
  process.exit(2);
});
