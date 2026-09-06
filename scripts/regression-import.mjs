/**
 * TEST NAVIGATEUR DU WORKFLOW D'IMPORT — de bout en bout, sur le build de
 * production.
 *
 *   ouvrir l'import → choisir un PDF → analyser → vérifier l'aperçu →
 *   ajouter → ouvrir l'exercice importé dans le lecteur → enchaîner
 *
 * Ce que les tests unitaires ne peuvent pas voir : pdf.js chargé dynamiquement
 * dans un vrai navigateur, son worker servi depuis `public/pdfjs/`, l'écriture
 * dans localStorage, et le fait qu'un exercice importé se comporte comme les
 * autres dans le lecteur.
 *
 *   pnpm build && pnpm start -p 3100
 *   node scripts/regression-import.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE || "http://localhost:3100";
const FIXTURE = path.resolve(process.cwd(), "lib/import/fixtures/feuille-integrales.pdf");
const SCANNED = path.resolve(process.cwd(), "lib/import/fixtures/feuille-scannee.pdf");

function loadPlaywright() {
  for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* essai suivant */
    }
  }
  console.error("Playwright introuvable. `npm i -g playwright` puis relancer.");
  process.exit(2);
}

const { chromium } = loadPlaywright();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  ok  " : "ÉCHEC "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const bankSize = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("prepahub:exercises") || "[]").length);

async function openImport(page) {
  await page.getByRole("button", { name: /feuille d'exercices \(PDF\)|Feuille PDF/i }).click();
  await page.waitForTimeout(500);
}

async function run(browser, viewport, label) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));
  page.on("crash", () => errors.push("PLANTAGE"));

  await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const before = await bankSize(page);

  await openImport(page);
  check(`[${label}] l'écran d'import s'ouvre`, await page.getByText("D'un PDF à des exercices travaillables").isVisible());

  // ── Feuille scannée : message compréhensible, aucun jargon ──
  await page.setInputFiles('input[type="file"][accept*="pdf"]', SCANNED);
  await page.waitForTimeout(2500);
  const scannedMessage = await page.evaluate(() => document.body.innerText);
  check(
    `[${label}] une feuille scannée donne une explication en français`,
    /image \(feuille scannée ou photographiée\)/.test(scannedMessage) && !/ERROR|Exception|undefined/.test(scannedMessage)
  );

  // ── Feuille réelle ──
  await page.setInputFiles('input[type="file"][accept*="pdf"]', FIXTURE);
  await page.waitForTimeout(4000);
  const previewText = await page.evaluate(() => document.body.innerText);
  check(`[${label}] les 3 exercices sont détectés`, /3 exercices détectés/.test(previewText), previewText.match(/\d+ exercices? détectés?/)?.[0] ?? "");
  check(`[${label}] l'exercice à cheval affiche ses deux pages`, /p\. 1–2/.test(previewText));
  check(`[${label}] le titre lu sur la feuille est repris`, /Convergence d'une suite recurrente/.test(previewText));

  // Métadonnées communes, saisies une seule fois.
  await page.getByPlaceholder("Feuille 4 — Intégrales").fill("Feuille 4 — Intégrales");
  await page.getByPlaceholder("Lycée Jean Perrin — M. Dupont").fill("Lycée Jean Perrin");
  await page.waitForTimeout(400);

  // Import partiel : on écarte le troisième exercice.
  const boxes = page.locator('input[type="checkbox"]');
  await boxes.nth(2).uncheck();
  await page.waitForTimeout(400);
  const button = page.getByRole("button", { name: /Ajouter \d+ exercices?/ });
  check(`[${label}] le bouton reflète la sélection partielle`, /Ajouter 2 exercices/.test(await button.innerText()), await button.innerText());

  await button.click();
  await page.waitForTimeout(1600);
  const after = await bankSize(page);
  check(`[${label}] seuls les exercices retenus entrent dans la banque`, after === before + 2, `${before} → ${after}`);

  const imported = await page.evaluate(() => {
    const bank = JSON.parse(localStorage.getItem("prepahub:exercises") || "[]");
    return bank
      .filter((exercise) => typeof exercise.external_id === "string" && exercise.external_id.startsWith("feuille:"))
      .map((exercise) => ({ id: exercise.id, title: exercise.title, source: exercise.source, statement: exercise.statement, provenance: exercise.provenance, status: exercise.status, attempts: exercise.attempts }));
  });
  check(`[${label}] la source de la feuille est conservée`, imported.every((e) => e.source === "Feuille 4 — Intégrales — Lycée Jean Perrin — 2026"), imported[0]?.source ?? "");
  check(`[${label}] les formules ont survécu jusque dans la banque`, imported.some((e) => e.statement.includes("$u_{n+1} = u_{n}^{2} + 1$")));
  check(`[${label}] les exercices importés partent d'un état neuf`, imported.every((e) => e.status === "à faire" && e.attempts === 0));

  // ── Le lecteur ne fait aucune différence ──
  const target = imported[0];
  await page.goto(`${BASE}/exercises?focus=${target.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const readerTitle = await page.evaluate(() => document.querySelector("div.fixed.inset-0 h1")?.textContent?.trim() ?? "");
  check(`[${label}] l'exercice importé s'ouvre dans le lecteur`, readerTitle.length > 0, readerTitle);
  const katex = await page.evaluate(() => document.querySelectorAll("div.fixed.inset-0 .katex").length);
  check(`[${label}] ses formules sont rendues par KaTeX`, katex > 0, `${katex} formules`);

  // Chronomètre, indices, notation, enchaînement : le parcours ordinaire.
  const readerText = () => page.evaluate(() => document.querySelector("div.fixed.inset-0")?.innerText ?? "");
  check(`[${label}] le chronomètre démarre à zéro`, /0:0\d/.test(await readerText()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  check(`[${label}] la notation est proposée comme pour tout exercice`, (await readerText()).includes("Comment ça s'est passé"));
  await page.keyboard.press("1");
  await page.waitForTimeout(900);
  const committed = await readerText();
  check(`[${label}] l'enchaînement fonctionne sur un exercice importé`, /Exercice noté/.test(committed) && /Exercice suivant/.test(committed));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("prepahub:sessions") || "[]")[0] ?? null);
  check(`[${label}] la séance est enregistrée comme pour un exercice ordinaire`, Boolean(session) && session.result === "réussi" && session.hints_used === 0);

  // ── Réimport : aucun doublon ──
  await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2400);
  const beforeSecond = await bankSize(page);
  await openImport(page);
  await page.setInputFiles('input[type="file"][accept*="pdf"]', FIXTURE);
  await page.waitForTimeout(4000);
  const secondText = await page.evaluate(() => document.body.innerText);
  check(`[${label}] le réimport signale les exercices déjà présents`, /déjà dans la banque|déjà présent/.test(secondText));
  const secondButton = page.getByRole("button", { name: /Ajouter \d+ exercices?/ });
  await secondButton.click().catch(() => {});
  await page.waitForTimeout(1400);
  const afterSecond = await bankSize(page);
  check(`[${label}] réimporter n'ajoute que ce qui manquait`, afterSecond - beforeSecond <= 1, `${beforeSecond} → ${afterSecond}`);

  check(`[${label}] aucune erreur JavaScript`, errors.length === 0, errors.join(" | "));
  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  await run(browser, { width: 1440, height: 900 }, "bureau");
  await run(browser, { width: 390, height: 844 }, "mobile");
  await browser.close();
  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
  if (failed.length) process.exit(1);
})().catch((error) => {
  console.error("ERREUR", error);
  process.exit(1);
});
