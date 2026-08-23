#!/usr/bin/env node
// Vérification reproductible de l'import du Cahier de calcul (professeur) :
// compte indépendamment les pages/fiches/calculs directement dans la source
// brute (sources/cahier-de-calcul/), puis compare au dataset importé
// (datasets/cahier-de-calcul-professeur.json). Ne fait CONFIANCE à aucun des
// deux chiffres a priori — recompte les deux et vérifie qu'ils coïncident
// exactement, item par item (pas seulement en nombre total : un décompte égal
// pourrait masquer un doublon compensé par un manquant).
//
// Usage : node scripts/verify-cahier-calcul.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT, "sources/cahier-de-calcul/cahier-de-calcul-professeur-source.md");
const DATASET_PATH = path.join(ROOT, "datasets/cahier-de-calcul-professeur.json");

const source = readFileSync(SOURCE_PATH, "utf-8");
const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf-8"));

let ok = true;
function check(label, condition, detail) {
  const status = condition ? "OK" : "ÉCHEC";
  console.log(`[${status}] ${label}${detail ? " — " + detail : ""}`);
  if (!condition) ok = false;
}

// --- 1. Pages : 119 marqueurs "## PAGE NNN", séquence continue 001-119. ---
const pageNumbers = [...source.matchAll(/^## PAGE (\d+)$/gm)].map((m) => Number(m[1])).sort((a, b) => a - b);
check("119 pages présentes dans la source", pageNumbers.length === 119, `trouvé ${pageNumbers.length}`);
const expectedPages = Array.from({ length: 119 }, (_, i) => i + 1);
const pagesMatch = JSON.stringify(pageNumbers) === JSON.stringify(expectedPages);
check("Séquence de pages 001-119 continue, sans trou ni doublon", pagesMatch);

// --- 2. Fiches : 16 en-têtes "Fiche de calcul no N" dans la source. ---
const ficheHeaders = [...source.matchAll(/Fiche de calcul no\s*(\d+)/g)].map((m) => Number(m[1]));
const distinctFiches = [...new Set(ficheHeaders)].sort((a, b) => a - b);
check("16 fiches distinctes trouvées dans la source", distinctFiches.length === 16, `trouvé ${distinctFiches.length}: ${distinctFiches.join(",")}`);

// --- 3. Calculs : compte "Calcul N.M" en début de ligne, dans la zone énoncés uniquement (avant "Réponses et corrigés"). ---
const reponsesTitleIdx = source.indexOf("Réponses et corrigés\n```");
const enoncesZone = reponsesTitleIdx > 0 ? source.slice(0, reponsesTitleIdx) : source;
const calcMatches = [...enoncesZone.matchAll(/^Calcul (\d+)\.(\d+)/gm)];
const calcIds = calcMatches.map((m) => `${m[1]}.${m[2]}`);
const distinctCalcIds = new Set(calcIds);
check("122 blocs \"Calcul N.M\" trouvés dans les énoncés de la source", calcIds.length === 122, `trouvé ${calcIds.length}`);
check("Aucun doublon parmi les \"Calcul N.M\" de la source", distinctCalcIds.size === calcIds.length, `${calcIds.length - distinctCalcIds.size} doublon(s)`);

// --- 4. Dataset : 122 entrées, externalId CDC-N.M unique par entrée, correspond exactement à l'ensemble des calculs source. ---
check("122 entrées dans le dataset importé", dataset.length === 122, `trouvé ${dataset.length}`);

const externalIds = dataset.map((e) => e.externalId);
const distinctExternalIds = new Set(externalIds);
check("Aucun externalId dupliqué dans le dataset", distinctExternalIds.size === externalIds.length, `${externalIds.length - distinctExternalIds.size} doublon(s)`);

const datasetCalcIds = new Set(externalIds.map((id) => id.replace(/^CDC-/, "")));
const missingFromDataset = [...distinctCalcIds].filter((id) => !datasetCalcIds.has(id));
const extraInDataset = [...datasetCalcIds].filter((id) => !distinctCalcIds.has(id));
check("Chaque \"Calcul N.M\" de la source a une entrée dans le dataset", missingFromDataset.length === 0, missingFromDataset.length ? `manquants: ${missingFromDataset.join(", ")}` : "");
check("Le dataset ne contient aucun calcul absent de la source", extraInDataset.length === 0, extraInDataset.length ? `en trop: ${extraInDataset.join(", ")}` : "");

// --- 5. Champs minimaux présents sur chaque entrée. ---
const missingFields = dataset.filter((e) => !e.title || !e.statement || !e.source || !e.subject || !e.chapter);
check("Chaque entrée a title/statement/source/subject/chapter", missingFields.length === 0, missingFields.length ? `${missingFields.length} entrée(s) incomplète(s)` : "");

const wrongSource = dataset.filter((e) => e.source !== "Cahier de calcul — professeur");
check('Toutes les entrées portent source: "Cahier de calcul — professeur"', wrongSource.length === 0, wrongSource.length ? `${wrongSource.length} avec une autre source` : "");

// --- 5bis. Sanité LaTeX (statement/correction/answer) — détecte un LaTeX
// manifestement cassé (délimiteurs ou accolades non équilibrés) et les
// artefacts connus de l'extraction pdftotext qui n'auraient pas dû survivre
// à la reconstruction (glyphe de mapsto mal décodé, pointillés de case-
// réponse recopiés, caractères de la zone privée Unicode utilisée par les
// polices du PDF source). Ne vérifie pas la validité syntaxique complète de
// chaque commande LaTeX (hors de portée sans faire tourner KaTeX) — seulement
// des défauts structurels grossiers, qui suffisent à repérer une
// reconstruction interrompue ou mal échappée.
function findLatexIssues(text) {
  if (typeof text !== "string" || !text) return [];
  const issues = [];
  const dollarCount = (text.match(/(?<!\\)\$/g) || []).length;
  if (dollarCount % 2 !== 0) issues.push("délimiteurs $ non équilibrés");
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth !== 0) issues.push(`accolades non équilibrées (delta ${depth})`);
  if (/7−→|7-->/.test(text)) issues.push("artefact d'extraction (glyphe mapsto mal décodé)");
  if (/\.\s\.\s\.\s\.\s\./.test(text)) issues.push("pointillés de case-réponse recopiés");
  if (/[-]/.test(text)) issues.push("caractère de la zone privée Unicode (glyphe de police PDF)");
  return issues;
}

const latexIssues = [];
for (const e of dataset) {
  for (const field of ["statement", "correction", "answer"]) {
    const issues = findLatexIssues(e[field]);
    if (issues.length) latexIssues.push(`${e.externalId}.${field} : ${issues.join(", ")}`);
  }
}
check(
  "Aucun LaTeX manifestement cassé (délimiteurs/accolades non équilibrés, artefact d'extraction résiduel) dans statement/correction/answer",
  latexIssues.length === 0,
  latexIssues.length ? `${latexIssues.length} problème(s) : ${latexIssues.slice(0, 10).join(" | ")}${latexIssues.length > 10 ? " …" : ""}` : "",
);

// --- 6. Difficulté (pictogrammes horloge, extraits visuellement des pages du PDF) ---
// Une entrée est soit résolue (difficulty 1-4 numérique, tag "difficulté non
// vérifiée" absent), soit explicitement non résolue (tag présent). Les deux états
// ne doivent jamais coexister ni être tous les deux absents (silence = donnée
// invérifiable jamais signalée = interdit par la consigne de fidélité).
const unresolvedTag = "difficulté non vérifiée";
const difficultyInconsistent = dataset.filter((e) => {
  const hasTag = (e.tags || []).includes(unresolvedTag);
  const hasNumericDifficulty = typeof e.difficulty === "number" && e.difficulty >= 1 && e.difficulty <= 4;
  return hasTag === hasNumericDifficulty; // les deux vrais ou les deux faux = incohérent
});
check(
  "Chaque entrée a soit une difficulté 1-4 résolue, soit le tag \"difficulté non vérifiée\" (jamais les deux, jamais aucun)",
  difficultyInconsistent.length === 0,
  difficultyInconsistent.length ? `${difficultyInconsistent.length} entrée(s) incohérente(s) : ${difficultyInconsistent.map((e) => e.externalId).join(", ")}` : "",
);

const difficultyCounts = { 1: 0, 2: 0, 3: 0, 4: 0, unknown: 0 };
for (const e of dataset) {
  const hasTag = (e.tags || []).includes(unresolvedTag);
  if (!hasTag && typeof e.difficulty === "number" && e.difficulty >= 1 && e.difficulty <= 4) {
    difficultyCounts[e.difficulty] += 1;
  } else {
    difficultyCounts.unknown += 1;
  }
}

// --- 7. Réponses brutes (grille "Réponses", extraite visuellement des pages du PDF) ---
const withAnswer = dataset.filter((e) => typeof e.answer === "string" && e.answer.trim().length > 0).length;
const withoutAnswer = dataset.length - withAnswer;

// --- 8. Statistiques (informatif, pas un critère pass/fail). ---
const withCorrection = dataset.filter((e) => e.correction).length;
const withoutCorrection = dataset.length - withCorrection;
const fichesCovered = new Set(dataset.map((e) => e.chapter));
console.log("");
console.log("=== Statistiques ===");
console.log(`Fiches (chapitres) couvertes par le dataset : ${fichesCovered.size} / 16`);
console.log(`Entrées avec corrigé détaillé : ${withCorrection} / ${dataset.length}`);
console.log(`Entrées sans corrigé détaillé (réponse brute source non décomposée par item, voir sources/cahier-de-calcul/README.md) : ${withoutCorrection} / ${dataset.length}`);
console.log(`Difficulté 1 : ${difficultyCounts[1]} / ${dataset.length}`);
console.log(`Difficulté 2 : ${difficultyCounts[2]} / ${dataset.length}`);
console.log(`Difficulté 3 : ${difficultyCounts[3]} / ${dataset.length}`);
console.log(`Difficulté 4 : ${difficultyCounts[4]} / ${dataset.length}`);
console.log(`Difficulté unknown (tag "${unresolvedTag}") : ${difficultyCounts.unknown} / ${dataset.length}`);
console.log(`Réponses brutes associées (answer non vide) : ${withAnswer} / ${dataset.length}`);
console.log(`Réponses brutes null : ${withoutAnswer} / ${dataset.length}`);

console.log("");
console.log(ok ? "RÉSULTAT : toutes les vérifications passent." : "RÉSULTAT : ÉCHEC — voir les lignes [ÉCHEC] ci-dessus.");
process.exit(ok ? 0 : 1);
