#!/usr/bin/env node
/**
 * Fabrique des données de TEST avec la VRAIE interface de TaekdHub (aucune écriture
 * directe dans le stockage), puis les copie dans un fichier. Elles servent de
 * fixture à `lib/revision-context.ui-fixture.test.ts` : le constructeur du contexte
 * de révision est ainsi éprouvé sur des données TELLES QUE L'APPLICATION LES ÉCRIT,
 * pas seulement sur celles que des fonctions de test fabriquent.
 *
 *   BASE_URL=http://localhost:3116 node scripts/e2e/capture-ui-data.mjs
 *
 * Tous les titres commencent par « [TEST] ». Les dates sont fixes (octobre 2026).
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const load = createRequire(import.meta.url);
const { chromium } = load(`${execSync("npm root -g").toString().trim()}/playwright`);
const BASE = process.env.BASE_URL || "http://localhost:3116";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = new URL("../../lib/__fixtures__/ui-capture.json", import.meta.url);

const DEBRIEF = (titre, date, libelle) =>
  JSON.stringify({ matiere: "maths", titre, date, note: 9, questions: [{ libelle, chapitre: "m1-applications-lineaires", resultat: "fausse", cause: "cours", confiance: "certaine", description: "[TEST] hypothèse du théorème du rang oubliée" }] });
const RESTITUTION = (date) =>
  JSON.stringify({ demonstration: "m1-theoreme-du-rang", date, resultat: "incomplète", aide: "sans", lacunes: [{ type: "hypothèse", detail: "[TEST] dimension finie oubliée", confiance: "certaine" }] });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const step = (message) => console.log(`... ${message}`);

try {
  // 1. Une khôlle datée, saisie dans l'écran Échéances.
  step("échéance : khôlle de maths");
  await page.goto(`${BASE}/echeances`, { waitUntil: "networkidle" });
  await page.getByLabel("Intitulé du travail").fill("[TEST] Khôlle maths vendredi");
  await page.getByLabel("Nature du travail").selectOption({ label: "Colle" }).catch(async () => page.getByLabel("Nature du travail").selectOption("colle"));
  await page.getByLabel("Matière du travail").selectOption("Mathématiques");
  await page.getByLabel("Date d'échéance").fill("2026-10-23");
  await page.getByRole("button", { name: /Ajouter/ }).first().click();
  await page.getByText("[TEST] Khôlle maths vendredi").first().waitFor();

  // 2. Son programme : le chapitre est créé dans Mémoire depuis le formulaire du programme, puis rattaché.
  step("programme : « Applications linéaires »");
  await page.getByRole("button", { name: /Préparer « \[TEST\] Khôlle maths vendredi »/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Choisir le programme" }).click();
  await dialog.getByPlaceholder("Séries entières…").fill("Applications linéaires");
  await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
  await dialog.getByRole("button", { name: /Enregistrer le programme/ }).click();
  await page.getByText(/Programme · 1/).first().waitFor();

  // 3. Deux DS débriefés par une IA (réponse collée, vérifiée, enregistrée par le clic).
  for (const [titre, date, libelle] of [["[TEST] DS 1 — applications linéaires", "2026-09-26", "Q2"], ["[TEST] DS 2 — applications linéaires", "2026-10-10", "Q4"]]) {
    step(`débrief IA : ${titre}`);
    await page.goto(`${BASE}/debrief`, { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: /Réponse de l/ }).fill(DEBRIEF(titre, date, libelle));
    await page.getByRole("button", { name: "Vérifier", exact: true }).click();
    await page.getByLabel("Note obtenue").fill("9");
    await page.getByRole("button", { name: "Ouvrir pour vérification" }).click();
    await page.waitForURL(/note=/);
    await page.getByRole("button", { name: /Enregistrer et voir le plan/ }).click();
    await page.getByRole("heading", { name: "Plan d'action" }).waitFor();
  }

  // 4. Deux restitutions incomplètes du théorème du rang, enregistrées par le panneau Démonstrations.
  await page.goto(`${BASE}/anki`, { waitUntil: "networkidle" });
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Démonstrations" }) });
  for (const date of ["2026-10-08", "2026-10-13"]) {
    step(`restitution du ${date}`);
    await panel.getByRole("textbox", { name: /Réponse de l/ }).fill(RESTITUTION(date));
    await panel.getByRole("button", { name: "Vérifier", exact: true }).last().click();
    await panel.getByRole("button", { name: "Enregistrer la restitution" }).click();
  }

  // 5. Ce que l'application a écrit, tel quel.
  const dump = await page.evaluate(() => {
    const read = (key) => JSON.parse(localStorage.getItem(key) || "null");
    return { workItems: read("prepahub:work-items"), chapterMemory: read("prepahub:chapterMemory"), grades: read("prepahub:grades"), attempts: read("prepahub:attempts"), errors: read("prepahub:errors"), preferences: read("prepahub:preferences"), ankiSnapshots: read("prepahub:anki-snapshots") };
  });
  const counts = Object.fromEntries(Object.entries(dump).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0]));
  console.log("collections capturées :", JSON.stringify(counts));
  if (errors.length) throw new Error(`erreurs JavaScript : ${errors.join(" | ")}`);
  writeFileSync(OUT, `${JSON.stringify(dump, null, 1)}\n`);
  console.log(`écrit : ${OUT.pathname}`);
} catch (error) {
  console.error("ECHEC :", error.message.split("\n")[0]);
  await page.screenshot({ path: "/tmp/claude-0/capture-echec.png", fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
