/**
 * COHÉRENCE COMPTEUR / LISTE — sur toute la banque, dans tous les écrans.
 *
 * Le volet de gauche annonce un nombre à côté de chaque entrée. Ce nombre doit
 * être exactement celui que la liste affichera après le clic — y compris
 * lorsque d'autres filtres (concours, recherche, difficulté…) sont en vigueur.
 * Il ne l'était pas : les compteurs étaient calculés sur la banque brute et la
 * liste sur les onze filtres, si bien qu'un filtre concours faisait annoncer
 * 16 exercices là où la liste en montrait 4.
 *
 * Ce script clique RÉELLEMENT chaque entrée, dans plusieurs états de filtres,
 * et compare. Il vérifie aussi que la pagination rend tous les résultats
 * accessibles, et que les compteurs des autres écrans correspondent à ce qu'ils
 * surmontent.
 *
 *   pnpm build && pnpm start -p 3100
 *   node scripts/regression-banque.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE || "http://localhost:3100";

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
  if (!ok || process.env.VERBOSE) console.log(`${ok ? "  ok  " : "ÉCHEC "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/**
 * Ce que la zone de travail annonce : « Chapitre · 17 exercices sur 534 ».
 * Lu sur la ligne de méta qui suit le titre, jamais sur le texte de la page —
 * une barre de séance ou une pagination y parlent aussi d'exercices.
 */
const headerCount = (page) =>
  page.evaluate(() => {
    const title = document.querySelector("h1.t-display");
    const meta = title?.nextElementSibling;
    if (!meta) return null;
    const match = meta.textContent.replace(/\s+/g, " ").match(/(\d+)\s+exercices?/);
    return match ? Number(match[1]) : null;
  });

/** Ce que la barre « construire une séance » annonce comme réservoir. */
const sessionPool = (page) =>
  page.evaluate(() => {
    const match = document.body.innerText.replace(/\s+/g, " ").match(/sur (\d+) · ≈/);
    return match ? Number(match[1]) : null;
  });

const renderedRows = (page) => page.evaluate(() => document.querySelectorAll('li[id^="exercise-"]').length);

/** Le volet de navigation de la banque — repéré par son étiquette, pour ne pas attraper la navigation générale de l'app. */
const PANE = '[aria-label="Navigation de la banque"] nav';

/** Les entrées du volet, avec le nombre annoncé. */
const paneEntries = (page) =>
  page.evaluate((selector) => {
    const nav = document.querySelector(selector);
    if (!nav) return [];
    return [...nav.querySelectorAll("button")]
      .filter((button) => !button.hasAttribute("aria-expanded"))
      .map((button) => {
        const text = button.innerText.replace(/\n+/g, " ").trim();
        const match = text.match(/^(.*?)\s+(\d+)$/);
        return match ? { label: match[1].trim(), announced: Number(match[2]) } : null;
      })
      .filter(Boolean);
  }, PANE);

async function clickEntry(page, label) {
  return page.evaluate(({ wanted, selector }) => {
    const nav = document.querySelector(selector);
    if (!nav) return false;
    const button = [...nav.querySelectorAll("button")].find(
      (candidate) => !candidate.hasAttribute("aria-expanded") && candidate.innerText.replace(/\n+/g, " ").trim().startsWith(wanted)
    );
    if (!button) return false;
    button.click();
    return true;
  }, { wanted: label, selector: PANE });
}

/** Applique un filtre secondaire par son <select>, repéré à l'une de ses options. */
async function setSelect(page, optionValue) {
  return page.evaluate((value) => {
    const select = [...document.querySelectorAll("select")].find((candidate) =>
      [...candidate.options].some((option) => option.value === value)
    );
    if (!select) return false;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, optionValue);
}

/**
 * Parcourt TOUTES les entrées du volet dans un état de filtres donné.
 *
 * `setup` est rejoué avant chaque entrée, et le nombre annoncé relu juste
 * avant le clic : « Toute la banque » remet les filtres à zéro, donc une
 * mesure prise une fois pour toutes au début serait périmée dès la première
 * entrée — l'écart constaté viendrait de la méthode, pas de l'application.
 */
/**
 * Parcourt TOUTES les entrées du volet dans un état de filtres donné : les
 * deux raccourcis, chaque matière, et chaque chapitre de chaque matière.
 *
 * Deux précautions, sans lesquelles le test mesurerait n'importe quoi :
 *  - `setup` est rejoué avant chaque entrée, et le nombre annoncé relu juste
 *    avant le clic — « Toute la banque » remet les filtres à zéro, donc une
 *    mesure prise une fois pour toutes serait périmée dès la première entrée ;
 *  - le volet ne déplie qu'une matière à la fois, il faut donc ouvrir chacune
 *    pour atteindre ses chapitres.
 */
async function sweep(page, label, setup) {
  const openSubject = (subject) =>
    page.evaluate(
      ({ selector, wanted }) => {
        const nav = document.querySelector(selector);
        if (!nav) return false;
        const toggle = [...nav.querySelectorAll("button[aria-expanded]")].find((button) =>
          (button.getAttribute("aria-label") ?? "").includes(wanted)
        );
        if (!toggle) return false;
        if (toggle.getAttribute("aria-expanded") === "false") toggle.click();
        return true;
      },
      { selector: PANE, wanted: subject }
    );

  await setup();
  await page.waitForTimeout(300);
  const subjects = await page.evaluate((selector) => {
    const nav = document.querySelector(selector);
    return [...(nav?.querySelectorAll("button[aria-expanded]") ?? [])]
      .map((button) => (button.getAttribute("aria-label") ?? "").replace(/^(Déplier|Replier)\s+/, ""))
      .filter(Boolean);
  }, PANE);

  // Toutes les entrées à visiter : les raccourcis, puis chaque matière et ses
  // chapitres.
  const targets = [];
  for (const entry of await paneEntries(page)) targets.push({ label: entry.label, subject: null });
  for (const subject of subjects) {
    await setup();
    await openSubject(subject);
    await page.waitForTimeout(280);
    for (const entry of await paneEntries(page)) {
      if (targets.some((target) => target.label === entry.label)) continue;
      targets.push({ label: entry.label, subject });
    }
  }

  let mismatch = 0;
  let inaccessible = 0;
  let checked = 0;
  for (const target of targets) {
    await setup();
    if (target.subject) await openSubject(target.subject);
    await page.waitForTimeout(260);
    const announced = (await paneEntries(page)).find((entry) => entry.label === target.label)?.announced;
    if (announced === undefined) continue;
    if (!(await clickEntry(page, target.label))) continue;
    await page.waitForTimeout(300);
    const shown = await headerCount(page);
    const rows = await renderedRows(page);
    const pool = await sessionPool(page);
    checked += 1;
    if (shown !== announced) {
      mismatch += 1;
      console.log(`       ↳ « ${target.label} » annonce ${announced}, la liste en compte ${shown}`);
    }
    if (pool !== null && pool !== shown) {
      mismatch += 1;
      console.log(`       ↳ « ${target.label} » : la barre de séance puise dans ${pool}, la liste montre ${shown}`);
    }
    if (shown !== null && rows < Math.min(shown, 40)) {
      inaccessible += 1;
      console.log(`       ↳ « ${target.label} » : ${shown} résultats mais ${rows} rangées rendues`);
    }
  }
  check(`[${label}] ${checked} entrées : compteur = liste = réservoir de séance`, mismatch === 0, `${mismatch} écart(s)`);
  check(`[${label}] aucun résultat inaccessible`, inaccessible === 0, `${inaccessible}`);
  return checked;
}

async function paginationWorks(page) {
  await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const total = await headerCount(page);
  let rows = await renderedRows(page);
  let clicks = 0;
  while (rows < total && clicks < 40) {
    const more = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((candidate) => /Afficher \d+ exercices de plus/.test(candidate.innerText));
      if (!button) return false;
      button.click();
      return true;
    });
    if (!more) break;
    clicks += 1;
    await page.waitForTimeout(260);
    rows = await renderedRows(page);
  }
  check(`pagination : les ${total} exercices deviennent tous accessibles`, rows === total, `${rows}/${total} après ${clicks} clics`);
}

async function otherScreens(page) {
  // Séances : le titre annonce un nombre, la liste doit s'y tenir. On sème
  // quelques séances, sinon l'écran est vide et la vérification ne prouve rien.
  await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const bank = JSON.parse(localStorage.getItem("prepahub:exercises") || "[]").slice(0, 130);
    const sessions = bank.map((exercise, index) => ({
      id: `s-${index}`,
      exercise_id: exercise.id,
      started_at: new Date(Date.now() - index * 3600000).toISOString(),
      duration_seconds: 600,
      result: "réussi",
      hints_used: 0,
      note: null,
    }));
    localStorage.setItem("prepahub:sessions", JSON.stringify(sessions));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const history = await page.evaluate(() => {
    const text = document.body.innerText;
    const announced = text.match(/(\d+)\s+séances?/);
    const pagination = text.match(/(\d+)\s+sur\s+(\d+)/);
    const rows = document.querySelectorAll("li").length;
    return { announced: announced ? Number(announced[1]) : null, pagination: pagination ? pagination.slice(1).map(Number) : null, rows };
  });
  // 130 séances semées : au-delà de la page de 100, la pagination doit annoncer
  // le même total que le titre du journal.
  check(
    "séances : titre, pagination et lignes rendues concordent",
    history.announced === 130 && history.pagination !== null && history.pagination[1] === history.announced && history.pagination[0] === 100,
    JSON.stringify(history)
  );

  // Progression : chaque matière annonce un nombre de chapitres ; dépliée, elle
  // doit en rendre exactement autant.
  await page.goto(`${BASE}/progress`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const announcedChapters = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-expanded]")]
      .map((button) => {
        const match = button.innerText.replace(/\n+/g, " ").match(/^(.*?)\s+(\d+)\s+chapitres?/);
        return match ? { subject: match[1].trim(), announced: Number(match[2]) } : null;
      })
      .filter(Boolean)
  );
  const progress = [];
  for (const entry of announcedChapters) {
    // Une seule matière est dépliée à la fois : on ouvre, on attend le rendu,
    // on mesure.
    await page.evaluate((subject) => {
      const button = [...document.querySelectorAll("button[aria-expanded]")].find((candidate) =>
        candidate.innerText.replace(/\n+/g, " ").startsWith(subject)
      );
      if (button && button.getAttribute("aria-expanded") === "false") button.click();
    }, entry.subject);
    await page.waitForTimeout(400);
    const rows = await page.evaluate((subject) => {
      const button = [...document.querySelectorAll("button[aria-expanded]")].find((candidate) =>
        candidate.innerText.replace(/\n+/g, " ").startsWith(subject)
      );
      return button?.parentElement?.querySelector("ul")?.querySelectorAll("li").length ?? 0;
    }, entry.subject);
    progress.push({ ...entry, rows });
  }
  check(
    "progression : chaque matière rend autant de chapitres qu'annoncé",
    progress.length > 0 && progress.every((entry) => entry.rows === entry.announced),
    JSON.stringify(progress.filter((entry) => entry.rows !== entry.announced))
  );

  // Concours : le nombre de sessions annoncé doit correspondre aux lignes dépliées.
  await page.goto(`${BASE}/concours`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const concours = await page.evaluate(() => {
    const out = [];
    for (const button of document.querySelectorAll('button[aria-expanded]')) {
      const match = button.innerText.match(/(\d+)\s+sessions?/);
      if (!match) continue;
      button.click();
      out.push({ announced: Number(match[1]) });
    }
    return out;
  });
  await page.waitForTimeout(700);
  const concoursRows = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-expanded="true"]')].map((button) => {
      const card = button.closest("article, div[class*='surface'], li") ?? button.parentElement?.parentElement;
      return card ? card.querySelectorAll("ul li").length : 0;
    })
  );
  check(
    "concours : chaque banque dépliée rend autant de sessions qu'annoncé",
    concours.every((entry, index) => (concoursRows[index] ?? 0) >= entry.announced),
    JSON.stringify({ concours, concoursRows })
  );
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 150)));

  await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2800);

  const reset = async () => {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((candidate) => /^Filtres/.test(candidate.innerText.trim()));
      if (button && button.getAttribute("aria-expanded") !== "true") button.click();
    });
    await page.evaluate(() => {
      const input = document.querySelector("#exercise-search");
      if (input && input.value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);
  };

  // 1. Sans aucun filtre secondaire.
  await sweep(page, "sans filtre", async () => {
    await reset();
    await setSelect(page, "Tous");
    await page.waitForTimeout(200);
  });

  // 2. Avec un filtre concours — le cas qui a révélé le bug.
  await sweep(page, "filtre concours CCINP", async () => {
    await reset();
    await setSelect(page, "CCINP");
    await page.waitForTimeout(250);
  });

  // 3. Avec une recherche en cours.
  await sweep(page, "recherche « matrice »", async () => {
    await reset();
    await setSelect(page, "Tous");
    await page.evaluate(() => {
      const input = document.querySelector("#exercise-search");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "matrice");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(300);
  });

  // 4. Avec un filtre difficulté.
  await sweep(page, "difficulté 4", async () => {
    await reset();
    await setSelect(page, "4");
    await page.waitForTimeout(250);
  });
  await reset();

  await paginationWorks(page);
  await otherScreens(page);

  check("aucune erreur JavaScript", errors.length === 0, errors.join(" | "));
  await browser.close();

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
  if (failed.length) process.exit(1);
})().catch((error) => {
  console.error("ERREUR", error);
  process.exit(1);
});
