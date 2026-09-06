import { readFileSync } from "node:fs";
import path from "node:path";
import { toPdfPage } from "@/lib/import/pdf-source";
import type { PdfPage } from "@/lib/import/types";

/**
 * Lit un PDF de test avec le VRAI pdf.js (build « legacy », qui tourne sous
 * Node), puis le fait passer par `toPdfPage` — exactement la frontière que
 * l'application utilise. Les tests portent donc sur de véritables PDF, pas sur
 * des fragments écrits à la main qui pourraient ne ressembler à rien de réel.
 *
 * Les PDF eux-mêmes sont générés par scripts/fixtures/build-pdf-fixtures.mjs.
 */
export async function readFixture(name: string): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const file = path.resolve(process.cwd(), "lib/import/fixtures", name);
  const data = new Uint8Array(readFileSync(file));
  const task = pdfjs.getDocument({
    data,
    standardFontDataUrl: path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/") + path.sep,
  });
  const document = await task.promise;
  const pages: PdfPage[] = [];
  for (let index = 1; index <= document.numPages; index++) {
    const page = await document.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push(toPdfPage(index, viewport.width, viewport.height, content.items));
  }
  await task.destroy();
  return pages;
}
