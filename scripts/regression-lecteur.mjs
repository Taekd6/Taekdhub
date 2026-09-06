/**
 * TESTS DE RÉGRESSION DU LECTEUR — dans un vrai navigateur.
 *
 * Trois des bugs corrigés ne sont PAS observables depuis vitest : un plantage
 * du moteur de rendu, une fuite d'état entre deux montages, et la restauration
 * du défilement. Ce script les rejoue dans Chromium sur le BUILD DE
 * PRODUCTION, et sort en code 1 au premier échec.
 *
 *   pnpm build && pnpm start -p 3100
 *   node scripts/regression-lecteur.mjs            # défaut : http://localhost:3100
 *   BASE=http://localhost:3000 node scripts/regression-lecteur.mjs
 *
 * Playwright n'est pas une dépendance du projet (il ne sert qu'ici) : le
 * script le cherche dans le projet puis dans les modules globaux, et explique
 * quoi installer s'il ne le trouve pas.
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
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : "ÉCHEC "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const readerText = (page) =>
  page.evaluate(() => {
    const layer = document.querySelector("div.fixed.inset-0");
    return layer ? layer.innerText : "";
  });

async function main() {
  const executablePath = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

  // ── Amorçage : on lit la banque semée dans localStorage une seule fois, et
  //    on la réinjecte dans chaque contexte pour ne pas la re-semer à chaque
  //    fois (et pour que les identifiants restent stables).
  const seedCtx = await browser.newContext(mobile);
  const seedPage = await seedCtx.newPage();
  await seedPage.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await seedPage.waitForTimeout(2500);
  const { storage, withDisplayMath } = await seedPage.evaluate(() => {
    const dump = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
    const exercises = JSON.parse(localStorage.getItem("prepahub:exercises") || "[]");
    const active = exercises.filter((e) => !e.archived);
    const hasBlock = (e) =>
      /\$\$[\s\S]+?\$\$/.test([e.statement, e.correction, ...(e.hints || [])].filter(Boolean).join("\n"));
    return {
      storage: dump,
      withDisplayMath: active.filter(hasBlock).map((e) => ({ id: e.id, title: e.title.slice(0, 60) })),
    };
  });
  await seedCtx.close();

  const context = async () => {
    const ctx = await browser.newContext(mobile);
    await ctx.addInitScript((dump) => {
      const parsed = JSON.parse(dump);
      for (const key of Object.keys(parsed)) localStorage.setItem(key, parsed[key]);
    }, JSON.stringify(storage));
    return ctx;
  };

  // ═══ 1. Formules centrées : aucun plantage du moteur de rendu ═══
  {
    let crashes = 0;
    const ctx = await context();
    for (const target of withDisplayMath) {
      const page = await ctx.newPage();
      let crashed = false;
      page.on("crash", () => (crashed = true));
      await page.goto(`${BASE}/exercises?focus=${target.id}`, { waitUntil: "domcontentloaded" }).catch(() => (crashed = true));
      await page.waitForTimeout(1100);
      const opened = crashed ? false : await page.evaluate(() => !!document.querySelector("div.fixed.inset-0 h1")).catch(() => false);
      if (crashed || !opened) {
        crashes += 1;
        console.log(`       ↳ ${crashed ? "PLANTAGE" : "lecteur non ouvert"} : ${target.title}`);
      }
      await page.close();
    }
    await ctx.close();
    check(
      `formules centrées : ${withDisplayMath.length} exercices ouverts sans plantage`,
      withDisplayMath.length > 50 && crashes === 0,
      crashes ? `${crashes} en échec` : ""
    );
  }

  // ═══ 2-5. Parcours de lecture, depuis la liste ═══
  {
    const ctx = await context();
    const page = await ctx.newPage();
    let crashed = false;
    page.on("crash", () => (crashed = true));
    await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2400);

    // L'ordre AFFICHÉ : c'est lui que « suivant » doit suivre, quoi qu'il
    // arrive au classement une fois un résultat noté.
    const displayed = await page.evaluate(() =>
      [...document.querySelectorAll('li[id^="exercise-"]')].map((el) => el.id.replace("exercise-", ""))
    );
    const titleOf = (id) =>
      page.evaluate((exerciseId) => {
        const bank = JSON.parse(localStorage.getItem("prepahub:exercises") || "[]");
        const found = bank.find((e) => e.id === exerciseId);
        return found ? found.title.trim() : null;
      }, id);

    await page.evaluate(() => document.querySelectorAll('li[id^="exercise-"]')[0].querySelector("button").click());
    await page.waitForTimeout(1500);
    const titleBefore = await page.evaluate(() => document.querySelector("div.fixed.inset-0 h1")?.textContent?.trim());
    // Le titre est rendu en KaTeX : on compare sur la partie hors formule.
    const plain = (t) => (t || "").split("$")[0].trim();
    check("le lecteur s'ouvre sur la rangée cliquée", Boolean(titleBefore) && titleBefore.startsWith(plain(await titleOf(displayed[0]))), titleBefore);

    // 2. Isolation de l'état : on révèle un indice avant d'enchaîner.
    const hintButton = page.getByRole("button", { name: /Indice/ });
    const hasHints = (await hintButton.count()) > 0;
    if (hasHints) {
      await hintButton.first().click();
      await page.waitForTimeout(500);
    }
    const hintsBefore = await page.evaluate(() =>
      [...document.querySelectorAll("div.fixed.inset-0 p.t-label")].filter((p) => /^Indice \d/.test(p.textContent || "")).length
    );
    const chronoBefore = (await readerText(page)).match(/\d+:\d\d/)?.[0] ?? "?";

    // Terminer → noter « réussi » → écran « Exercice noté ».
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    check("écran de qualification proposé en fin de tentative", (await readerText(page)).includes("Comment ça s'est passé"));
    await page.keyboard.press("1");
    await page.waitForTimeout(1000);
    const committedScreen = await readerText(page);
    check(
      "après notation, le lecteur propose la suite",
      /Exercice noté/.test(committedScreen) && /Exercice suivant/.test(committedScreen)
    );

    // 4-5. Enchaînement au clavier, dans l'ordre AFFICHÉ (et pas dans le
    //      classement recalculé par le moteur après la notation).
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1600);
    const titleAfter = await page.evaluate(() => document.querySelector("div.fixed.inset-0 h1")?.textContent?.trim());
    const expected = await titleOf(displayed[1]);
    check("« Exercice suivant » ouvre bien un autre exercice", Boolean(titleAfter) && titleAfter !== titleBefore, `${titleBefore} → ${titleAfter}`);
    check("l'ordre de lecture reste celui de la liste, pas le reclassement", Boolean(titleAfter) && titleAfter.startsWith(plain(expected)), `attendu « ${expected} »`);

    // 2 (suite). L'exercice suivant repart d'un état vierge.
    const hintsAfter = await page.evaluate(() =>
      [...document.querySelectorAll("div.fixed.inset-0 p.t-label")].filter((p) => /^Indice \d/.test(p.textContent || "")).length
    );
    const chronoAfter = (await readerText(page)).match(/\d+:\d\d/)?.[0] ?? "?";
    check("aucun indice hérité de l'exercice précédent", hintsAfter === 0 && (!hasHints || hintsBefore > 0), `${hintsBefore} → ${hintsAfter}`);
    check("chronomètre remis à zéro", /^0:0[0-4]$/.test(chronoAfter), `${chronoBefore} → ${chronoAfter}`);

    // 3. hints_used et durée écrits dans la WorkSession.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await page.keyboard.press("1");
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1300);
    // Les séances sont stockées de la plus récente à la plus ancienne.
    const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem("prepahub:sessions") || "[]").slice(0, 2));
    const [second, premier] = sessions;
    check(
      "la séance du 1er exercice retient les indices consommés",
      Boolean(premier) && premier.hints_used === hintsBefore && premier.result === "réussi",
      premier ? `hints_used=${premier.hints_used} result=${premier.result}` : "aucune séance"
    );
    check(
      "la séance du 2e exercice repart de 0 indice et d'une durée propre",
      Boolean(second) && second.hints_used === 0 && Number.isInteger(second.duration_seconds) && second.duration_seconds >= 0,
      second ? `hints_used=${second.hints_used} durée=${second.duration_seconds}s` : "aucune séance"
    );
    check("Échap depuis « Exercice noté » revient à la liste", await page.evaluate(() => !!document.querySelector('li[id^="exercise-"]')));
    check("aucun plantage pendant le parcours", !crashed);
    await ctx.close();
  }

  // ═══ 6. Retour à la liste : position conservée ═══
  {
    const ctx = await context();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2400);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => Math.round(window.scrollY));
    // Clic natif sur une rangée DÉJÀ visible : le test ne provoque aucun défilement.
    const opened = await page.evaluate(() => {
      const row = [...document.querySelectorAll('li[id^="exercise-"]')].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top > 140 && r.bottom < window.innerHeight - 140;
      });
      if (!row) return false;
      row.querySelector("button").click();
      return true;
    });
    await page.waitForTimeout(1300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => Math.round(window.scrollY));
    check("position dans la liste restaurée au retour du lecteur", opened && before === after, `avant=${before} après=${after}`);
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("ERREUR", error);
  process.exit(1);
});
