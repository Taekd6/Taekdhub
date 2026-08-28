// Exécuté après `next build` (voir le script "postbuild" de package.json).
// Produit public/sw.js à partir de service-worker/sw.template.js en y
// injectant l'identifiant de build Next comme version de cache — jamais
// commité (voir .gitignore), régénéré à chaque build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildIdPath = path.join(root, ".next", "BUILD_ID");
const templatePath = path.join(root, "service-worker", "sw.template.js");
const outputPath = path.join(root, "public", "sw.js");

let buildId;
try {
  buildId = readFileSync(buildIdPath, "utf8").trim();
} catch {
  console.error(`[generate-sw] ${buildIdPath} introuvable — ce script doit tourner après "next build", jamais seul.`);
  process.exit(1);
}

if (!buildId) {
  console.error("[generate-sw] BUILD_ID vide — build Next incomplet ou corrompu.");
  process.exit(1);
}

const template = readFileSync(templatePath, "utf8");
const output = template.replaceAll("__CACHE_VERSION__", `taekdhub-${buildId}`);
// `public/` n'existe pas forcément (aucun fichier statique n'y vivait avant
// ce script — un clone frais du dépôt n'a pas de dossier vide à offrir, git
// ne les suit pas).
if (!existsSync(path.dirname(outputPath))) mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output);
console.log(`[generate-sw] public/sw.js généré (cache "taekdhub-${buildId}").`);
