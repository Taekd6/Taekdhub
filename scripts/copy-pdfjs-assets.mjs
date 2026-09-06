/**
 * Copie les fichiers de pdf.js qui doivent être SERVIS, pas empaquetés.
 *
 * Deux ressources sont chargées à l'exécution par pdf.js, jamais importées :
 *  - son worker, qui fait tout le décodage hors du fil principal ;
 *  - les polices standard (Times, Helvetica…), nécessaires dès qu'un PDF les
 *    référence sans les embarquer — cas courant des feuilles produites par un
 *    traitement de texte.
 *
 * Elles sont copiées dans `public/pdfjs/` et servies depuis le domaine de
 * l'app : aucun CDN, donc l'import reste utilisable hors ligne comme le reste
 * de TaekdHub. Le dossier est régénéré à chaque build (`prebuild`) plutôt que
 * versionné : c'est du contenu de `node_modules`, il n'a rien à faire dans
 * l'historique.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const from = path.join(root, "node_modules", "pdfjs-dist");
const to = path.join(root, "public", "pdfjs");

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(path.join(from, "build", "pdf.worker.min.mjs"), path.join(to, "pdf.worker.min.mjs"));
cpSync(path.join(from, "standard_fonts"), path.join(to, "standard_fonts"), { recursive: true });
console.log("pdf.js : worker et polices standard copiés dans public/pdfjs/");
