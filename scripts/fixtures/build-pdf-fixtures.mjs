/**
 * Génère les PDF de test de l'import de feuilles.
 *
 * Écrits à la main (aucune dépendance, aucun LaTeX à installer) : c'est le
 * seul moyen de contrôler AU POINT PRÈS les positions, tailles de police et
 * glyphes dont dépend la détection des exposants, des indices et des symboles
 * mathématiques. Les PDF produits sont committés dans lib/import/fixtures/ ;
 * ce script sert à les régénérer si les cas de test doivent changer.
 *
 *   node scripts/fixtures/build-pdf-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "lib/import/fixtures");

/** Un flux de contenu PDF, construit run par run. */
class Content {
  constructor() {
    this.parts = [];
  }
  /** @param font "F1" (Times), "F2" (Times italique), "FB" (Times gras), "FS" (Symbol) */
  text(font, size, x, y, str) {
    const escaped = str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    this.parts.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escaped}) Tj ET`);
    return this;
  }
  /** Glyphes du jeu Symbol, désignés par code octal. */
  symbol(size, x, y, codes) {
    const octal = codes.map((c) => `\\${c.toString(8).padStart(3, "0")}`).join("");
    this.parts.push(`BT /FS ${size} Tf ${x} ${y} Td (${octal}) Tj ET`);
    return this;
  }
  toString() {
    return this.parts.join("\n");
  }
}

function buildPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length; // numéro d'objet (1-indexé)
  };

  const fontTimes = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");
  const fontItalic = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
  const fontSymbol = add("<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>");
  const resources = `<< /Font << /F1 ${fontTimes} 0 R /F2 ${fontItalic} 0 R /FB ${fontBold} 0 R /FS ${fontSymbol} 0 R >> >>`;

  const pageObjNumbers = [];
  const pageBodies = [];
  const pagesObjNumber = objects.length + pages.length * 2 + 1;
  for (const content of pages) {
    const stream = content.toString();
    const streamObj = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageObj = add(
      `<< /Type /Page /Parent ${pagesObjNumber} 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents ${streamObj} 0 R >>`
    );
    pageObjNumbers.push(pageObj);
    pageBodies.push(pageObj);
  }
  const pagesObj = add(`<< /Type /Pages /Count ${pageObjNumbers.length} /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`);
  if (pagesObj !== pagesObjNumber) throw new Error(`numérotation incohérente : ${pagesObj} ≠ ${pagesObjNumber}`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// Codes du jeu Symbol utilisés ici.
const SYM = { alpha: 0x61, integral: 0xf2, leq: 0xa3, in: 0xce, arrow: 0xae, infinity: 0xa5, sum: 0xe5 };

// ── Feuille réaliste : 2 pages, 3 exercices, le 2e à cheval sur la coupure ──
const p1 = new Content();
p1.text("FB", 15, 72, 780, "Feuille 4 - Integrales et suites");
p1.text("F1", 10, 72, 762, "Lycee Jean Perrin - MP - 2026");

p1.text("FB", 12, 72, 720, "Exercice 1.");
p1.text("F1", 11, 130, 720, "Convergence d'une suite recurrente");
p1.text("F1", 11, 72, 700, "Soit ");
p1.text("F2", 11, 96, 700, "u");
p1.text("F2", 8, 103, 697, "n");
p1.text("F1", 11, 109, 700, " la suite definie par ");
p1.text("F2", 11, 212, 700, "u");
p1.text("F2", 8, 219, 697, "0");
p1.text("F1", 11, 225, 700, " = 1 et ");
p1.text("F2", 11, 262, 700, "u");
p1.text("F2", 8, 269, 697, "n+1");
p1.text("F1", 11, 286, 700, " = ");
p1.text("F2", 11, 300, 700, "u");
p1.text("F2", 8, 307, 697, "n");
p1.text("F1", 8, 314, 704, "2");
p1.text("F1", 11, 322, 700, " + 1.");
p1.text("F1", 11, 72, 682, "1. Montrer que ");
p1.text("F2", 11, 146, 682, "u");
p1.text("F2", 8, 153, 679, "n");
p1.text("F1", 11, 159, 682, " est croissante.");
p1.text("F1", 11, 72, 664, "2. En deduire que ");
p1.text("F2", 11, 158, 664, "u");
p1.text("F2", 8, 165, 661, "n");
p1.symbol(11, 172, 664, [SYM.arrow]);
p1.symbol(11, 186, 664, [SYM.infinity]);
p1.text("F1", 11, 196, 664, ".");

p1.text("FB", 12, 72, 620, "Exercice 2.");
p1.text("F1", 11, 130, 620, "Une integrale a parametre");
p1.text("F1", 11, 72, 600, "Pour ");
p1.text("F2", 11, 98, 600, "a");
p1.symbol(11, 106, 600, [SYM.in]);
p1.text("F1", 11, 120, 600, "R, on pose ");
p1.text("F2", 11, 172, 600, "I");
p1.text("F1", 11, 178, 600, "(");
p1.text("F2", 11, 182, 600, "a");
p1.text("F1", 11, 189, 600, ") = ");
p1.symbol(14, 206, 598, [SYM.integral]);
p1.text("F1", 8, 214, 610, "1");
p1.text("F1", 8, 214, 594, "0");
p1.text("F2", 11, 224, 600, "x");
p1.text("F2", 8, 231, 606, "a");
p1.text("F1", 11, 238, 600, " dx.");
p1.text("F1", 11, 72, 582, "a) Determiner le domaine de definition de ");
p1.text("F2", 11, 264, 582, "I");
p1.text("F1", 11, 270, 582, ".");

const p2 = new Content();
p2.text("F1", 10, 520, 800, "2");
p2.text("F1", 11, 72, 760, "b) Calculer ");
p2.text("F2", 11, 128, 760, "I");
p2.text("F1", 11, 134, 760, "(");
p2.text("F2", 11, 138, 760, "a");
p2.text("F1", 11, 145, 760, ") pour ");
p2.text("F2", 11, 178, 760, "a");
p2.text("F1", 11, 186, 760, " > 0.");
p2.text("F1", 11, 72, 742, "c) Etudier la continuite de ");
p2.text("F2", 11, 200, 742, "I");
p2.text("F1", 11, 206, 742, " sur son domaine.");

p2.text("FB", 12, 72, 700, "Exercice 3.");
p2.text("F1", 11, 130, 700, "Somme de Riemann");
p2.text("F1", 11, 72, 680, "Soit ");
p2.text("F2", 11, 96, 680, "f");
p2.text("F1", 11, 103, 680, " continue sur [0, 1] telle que 0 ");
p2.symbol(11, 250, 680, [SYM.leq]);
p2.text("F2", 11, 264, 680, "f");
p2.text("F1", 11, 271, 680, "(");
p2.text("F2", 11, 275, 680, "x");
p2.text("F1", 11, 282, 680, ") ");
p2.symbol(11, 290, 680, [SYM.leq]);
p2.text("F1", 11, 304, 680, " 1.");
p2.text("F1", 11, 72, 662, "Etudier la limite de la somme ");
p2.symbol(13, 210, 661, [SYM.sum]);
p2.text("F2", 11, 224, 662, "f");
p2.text("F1", 11, 231, 662, "(");
p2.text("F2", 11, 235, 662, "k");
p2.text("F1", 11, 242, 662, "/");
p2.text("F2", 11, 246, 662, "n");
p2.text("F1", 11, 253, 662, ") quand ");
p2.text("F2", 11, 294, 662, "n");
p2.symbol(11, 303, 662, [SYM.arrow]);
p2.symbol(11, 317, 662, [SYM.infinity]);
p2.text("F1", 11, 327, 662, ".");
p2.text("F1", 11, 72, 644, "On pourra utiliser une somme de Riemann et la constante ");
p2.symbol(11, 340, 644, [SYM.alpha]);
p2.text("F1", 11, 348, 644, ".");

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "feuille-integrales.pdf"), buildPdf([p1, p2]));

// ── Feuille sans aucun texte extractible (page scannée) ──
const blank = new Content();
writeFileSync(path.join(OUT, "feuille-scannee.pdf"), buildPdf([blank]));

// ── Feuille d'un seul exercice, sans en-tête « Exercice » ──
const solo = new Content();
solo.text("FB", 13, 72, 780, "Devoir maison - Espaces vectoriels");
solo.text("F1", 11, 72, 750, "Montrer que l'ensemble des suites reelles bornees est un");
solo.text("F1", 11, 72, 732, "sous-espace vectoriel de l'espace des suites reelles.");
writeFileSync(path.join(OUT, "feuille-sans-numerotation.pdf"), buildPdf([solo]));

console.log("fixtures écrites dans", OUT);
