// Validation de datasets/contest-papers.json — exécuté à la demande
// (`npm run contests:validate`), jamais au build : c'est un outil pour la
// PERSONNE qui alimente la banque (ajout d'un sujet, d'un PDF embarqué), pas
// une étape bloquante de CI pour l'instant. Vérifie la cohérence
// dataset ↔ fichiers réels sous public/contest-papers/, jamais le contenu
// des PDF eux-mêmes (ce script ne contourne aucune protection, ne télécharge
// rien : il ne fait que relire ce qui est déjà dans le dépôt).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const datasetPath = path.join(root, "datasets", "contest-papers.json");
const documentsDir = path.join(root, "public", "contest-papers");

const KNOWN_COMPETITIONS = new Set(["CCINP", "Mines-Ponts", "Centrale", "e3a", "PT", "X", "ENS"]);
const KNOWN_SUBJECTS = new Set(["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"]);
const KNOWN_KINDS = new Set(["écrit", "oral"]);
const KNOWN_LICENSES = new Set(["libre", "à vérifier", "restreint"]);

const errors = [];
const warnings = [];
function fail(message) {
  errors.push(message);
}
function warn(message) {
  warnings.push(message);
}

let papers;
try {
  papers = JSON.parse(readFileSync(datasetPath, "utf8"));
} catch (error) {
  console.error(`[contests:validate] ${datasetPath} illisible : ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(papers) || papers.length === 0) {
  fail("Le dataset est vide ou n'est pas un tableau — la banque livrée ne serait plus représentative.");
}

const seenIds = new Set();
const currentYear = new Date().getFullYear();
const referencedLocalFiles = new Set();

function checkLocalAsset(paper, field, sizeField, expectedPrefix) {
  const relPath = paper[field];
  if (relPath === null) {
    if (paper[sizeField] !== null) fail(`${paper.id}: ${sizeField} renseigné sans ${field} — incohérent, les deux doivent aller de pair.`);
    return;
  }
  if (typeof relPath !== "string" || !relPath.startsWith(expectedPrefix) || !relPath.endsWith(".pdf")) {
    fail(`${paper.id}: ${field} ("${relPath}") doit commencer par "${expectedPrefix}" et finir par ".pdf".`);
    return;
  }
  const absPath = path.join(root, "public", relPath);
  if (!existsSync(absPath)) {
    fail(`${paper.id}: ${field} référence "${relPath}", introuvable sur disque (public${relPath}).`);
    return;
  }
  referencedLocalFiles.add(path.resolve(absPath));
  const actualSize = statSync(absPath).size;
  if (typeof paper[sizeField] !== "number") {
    fail(`${paper.id}: ${sizeField} doit être renseigné (taille réelle en octets) dès que ${field} l'est.`);
  } else if (paper[sizeField] !== actualSize) {
    fail(`${paper.id}: ${sizeField} déclare ${paper[sizeField]} octets mais le fichier réel fait ${actualSize} octets — fichier substitué/tronqué ou métadonnée périmée.`);
  }
  if (field === "localDocumentPath" && paper.licenseStatus !== "libre") {
    fail(`${paper.id}: localDocumentPath est renseigné mais licenseStatus vaut "${paper.licenseStatus}" — un PDF n'est embarqué QUE si la redistribution est établie ("libre").`);
  }
}

function isPlausibleOfficialUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

for (const paper of Array.isArray(papers) ? papers : []) {
  if (typeof paper.id !== "string" || !paper.id.trim()) {
    fail(`Entrée sans id exploitable : ${JSON.stringify(paper).slice(0, 80)}`);
    continue;
  }
  if (seenIds.has(paper.id)) fail(`Id dupliqué : "${paper.id}".`);
  seenIds.add(paper.id);

  if (!KNOWN_COMPETITIONS.has(paper.competition)) fail(`${paper.id}: concours inconnu ("${paper.competition}").`);
  if (!KNOWN_SUBJECTS.has(paper.subject)) fail(`${paper.id}: matière inconnue ("${paper.subject}").`);
  if (!KNOWN_KINDS.has(paper.kind)) fail(`${paper.id}: type d'épreuve inconnu ("${paper.kind}").`);
  if (!KNOWN_LICENSES.has(paper.licenseStatus)) fail(`${paper.id}: licenseStatus inconnu ("${paper.licenseStatus}").`);
  if (!Number.isInteger(paper.year) || paper.year < 2000 || paper.year > currentYear) fail(`${paper.id}: année implausible (${paper.year}).`);
  if (paper.difficulty !== null && (!Number.isInteger(paper.difficulty) || paper.difficulty < 1 || paper.difficulty > 5)) {
    fail(`${paper.id}: difficulté invalide (${paper.difficulty}) — doit être 1-5 ou null.`);
  }
  if (paper.durationMinutes !== null && (!Number.isInteger(paper.durationMinutes) || paper.durationMinutes <= 0)) {
    fail(`${paper.id}: durée invalide (${paper.durationMinutes}).`);
  }
  if (!Array.isArray(paper.chapterLabels)) fail(`${paper.id}: chapterLabels doit être un tableau.`);
  if (!Array.isArray(paper.tags)) fail(`${paper.id}: tags doit être un tableau.`);
  if (typeof paper.note !== "string" || !paper.note.trim()) fail(`${paper.id}: note manquante — chaque sujet doit porter une précision honnête pour l'élève.`);

  if (paper.resourceUrl !== null && !isPlausibleOfficialUrl(paper.resourceUrl)) {
    fail(`${paper.id}: resourceUrl ("${paper.resourceUrl}") doit être une URL https syntaxiquement valide, jamais un lien direct vers un fichier.`);
  }
  if (paper.correctionUrl !== null && !isPlausibleOfficialUrl(paper.correctionUrl)) {
    fail(`${paper.id}: correctionUrl ("${paper.correctionUrl}") doit être une URL https syntaxiquement valide.`);
  }

  checkLocalAsset(paper, "localDocumentPath", "documentSizeBytes", "/contest-papers/");
  checkLocalAsset(paper, "localCorrectionPath", "correctionSizeBytes", "/contest-papers/");

  // Cohérence du statut de disponibilité (Phase 9) : un sujet sans AUCUNE
  // source (ni fichier embarqué, ni lien officiel) est un état légitime
  // ("unavailable" — voir ContestDocumentAvailability) et n'échoue donc pas
  // la validation, mais mérite un avis pour la revue humaine plutôt qu'un
  // passage totalement silencieux.
  if (paper.localDocumentPath === null && paper.resourceUrl === null) {
    warn(`${paper.id}: ni PDF embarqué ni lien officiel — sujet marqué "unavailable" (vérifier que c'est bien voulu).`);
  }
}

// Fichiers présents sur disque mais référencés par AUCUNE entrée — un ajout
// de fichier oublié dans le dataset, ou un résidu d'un sujet retiré.
if (existsSync(documentsDir)) {
  for (const entry of readdirSync(documentsDir)) {
    if (!entry.toLowerCase().endsWith(".pdf")) continue;
    const abs = path.resolve(path.join(documentsDir, entry));
    if (!referencedLocalFiles.has(abs)) fail(`Fichier orphelin : public/contest-papers/${entry} n'est référencé par aucune entrée du dataset.`);
  }
}

if (warnings.length > 0) {
  console.warn(`[contests:validate] ${warnings.length} avis :\n`);
  for (const message of warnings) console.warn(`  - ${message}`);
}

if (errors.length > 0) {
  console.error(`\n[contests:validate] ${errors.length} problème(s) bloquant(s) :\n`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`\n[contests:validate] OK — ${papers.length} sujet(s), aucun problème bloquant.`);
