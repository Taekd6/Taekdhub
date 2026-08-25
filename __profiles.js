const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const D = 86400000;

/* Chaque profil réécrit exercises + sessions puis relit les 4 surfaces. */
const seed = (kind) => {
  const D = 86400000;
  const ex = JSON.parse(localStorage.getItem("prepahub:exercises") || "[]");
  ex.forEach((e) => { e.status = "à faire"; e.mastery = 0; e.attempts = 0; e.last_worked_at = null; e.favorite = false; });
  const now = Date.now();
  const S = [];
  const withChap = ex.filter((e) => e.chapter_id && !e.archived);
  const chapIds = [...new Set(withChap.map((e) => e.chapter_id))];
  const mk = (e, o) => ({
    id: "s" + Math.random(), subject: e.subject, exercise_id: e.id,
    started_at: new Date(o.at).toISOString(), ended_at: null,
    duration_seconds: o.sec === undefined ? 900 : o.sec, note: null,
    created_at: new Date(o.at).toISOString(), result: o.result, hints_used: o.hints ?? null,
  });

  if (kind === "A") { /* nouvel élève : rien */ }

  if (kind === "B") { // faible : échecs partout
    ex.filter((e) => chapIds.slice(0, 3).includes(e.chapter_id)).slice(0, 12).forEach((e, i) => {
      e.status = "à revoir"; e.mastery = 25; e.attempts = 2; e.last_worked_at = new Date(now - (i + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i + 1) * D, result: "échoué", hints: 1 }));
    });
  }

  if (kind === "C") { // en progression : réussites autonomes croissantes
    ex.filter((e) => e.chapter_id === chapIds[0]).slice(0, 8).forEach((e, i) => {
      e.status = i < 4 ? "maîtrisé" : "en cours"; e.mastery = i < 4 ? 100 : 50; e.attempts = 1;
      e.last_worked_at = new Date(now - (i + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i + 1) * D, result: i < 6 ? "réussi" : "partiel", hints: 0 }));
    });
  }

  if (kind === "D") { // avancé : longue série de réussites autonomes, difficulté haute
    ex.filter((e) => !e.archived).slice(0, 30).forEach((e, i) => {
      e.status = "maîtrisé"; e.mastery = 100; e.attempts = 2;
      e.last_worked_at = new Date(now - (i + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i + 1) * 3600000, result: "réussi", hints: 0 }));
    });
  }

  if (kind === "E") { // irrégulier : un gros pic il y a 3 semaines, plus rien depuis
    ex.filter((e) => !e.archived).slice(0, 10).forEach((e, i) => {
      e.status = "en cours"; e.mastery = 50; e.attempts = 1;
      e.last_worked_at = new Date(now - 21 * D).toISOString();
      S.push(mk(e, { at: now - 21 * D, result: i % 2 ? "réussi" : "partiel", hints: 0 }));
    });
  }

  if (kind === "F") { // beaucoup d'indices : ne réussit qu'assisté
    ex.filter((e) => !e.archived).slice(0, 15).forEach((e, i) => {
      e.status = "maîtrisé"; e.mastery = 100; e.attempts = 1;
      e.last_worked_at = new Date(now - (i + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i + 1) * D, result: "réussi", hints: 4 }));
    });
  }

  if (kind === "G") { // historique totalement déséquilibré : que des maths
    ex.filter((e) => e.subject === "Mathématiques" && !e.archived).slice(0, 40).forEach((e, i) => {
      e.status = "maîtrisé"; e.mastery = 100; e.attempts = 1;
      e.last_worked_at = new Date(now - (i % 14 + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i % 14 + 1) * D, result: "réussi", hints: 0 }));
    });
  }

  if (kind === "H") { // stagnant : beaucoup de temps, jamais de réussite
    ex.filter((e) => !e.archived).slice(0, 20).forEach((e, i) => {
      e.status = "à revoir"; e.mastery = 25; e.attempts = 4;
      e.last_worked_at = new Date(now - (i % 10 + 1) * D).toISOString();
      S.push(mk(e, { at: now - (i % 10 + 1) * D, result: i % 3 === 0 ? "partiel" : "échoué", hints: 3, sec: 2400 }));
    });
  }

  localStorage.setItem("prepahub:exercises", JSON.stringify(ex));
  localStorage.setItem("prepahub:sessions", JSON.stringify(S));
  return S.length;
};

const T = (s, n = 130) => (s || "?").replace(/\s+/g, " ").trim().slice(0, n);

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE " + m.text().slice(0, 160)); });

  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const profiles = {
    A: "nouvel élève", B: "élève faible", C: "élève en progression", D: "élève avancé",
    E: "élève irrégulier", F: "élève à indices", G: "historique déséquilibré", H: "élève stagnant",
  };

  for (const [k, label] of Object.entries(profiles)) {
    await page.evaluate(seed, k);
    await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    console.log(`\n══════ PROFIL ${k} — ${label} ══════`);
    console.log("héros    :", T(await page.locator("section h2").first().innerText().catch(() => null), 90));
    console.log("pourquoi :", T(await page.locator("section p.text-zinc-400").first().innerText().catch(() => null), 110));
    const plan = await page.locator("ol").first().innerText().catch(() => null);
    const planTotal = await page.locator("text=/Total :/").first().innerText().catch(() => null);
    console.log("plan     :", T(plan, 200), "|", T(planTotal, 40));
    const conso = await page.locator("text=Ces chapitres méritent ton attention").count();
    console.log("consolider:", conso ? "présent" : "aucun chapitre signalé");
    const xp = await page.locator("nav, aside").first().innerText().catch(() => null);
    console.log("niveau/XP:", T((xp || "").split("\n").filter((l) => /Niveau|XP|\d+ j/.test(l)).join(" | "), 90));

    await page.goto(BASE + "/progress", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const prio = await page.locator("ol").first().innerText().catch(() => null);
    console.log("priorités:", T(prio, 190));
  }

  console.log("\nERREURS:", errors.length ? [...new Set(errors)].slice(0, 4) : "aucune");
  await b.close();
})();
