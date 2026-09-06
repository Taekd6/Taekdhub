import type { PdfItem, PdfPage } from "@/lib/import/types";

/**
 * SEUL POINT DU PIPELINE QUI TOUCHE À pdf.js ET À UN FICHIER.
 *
 * pdf.js est chargé DYNAMIQUEMENT : il ne pèse que sur l'écran d'import, et
 * pas un octet sur les autres pages de l'app. C'est aussi ce qui permet à
 * tout le reste du pipeline (lignes, mathématiques, découpage, doublons) de
 * rester une suite de fonctions pures testables sans navigateur.
 */

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: Record<string, unknown>) => PdfJsLoadingTask;
}

interface PdfJsDocument {
  numPages: number;
  getPage: (index: number) => Promise<PdfJsPage>;
}

/** Le `destroy` qui libère le worker vit sur la tâche de chargement, pas sur le document. */
interface PdfJsLoadingTask {
  promise: Promise<PdfJsDocument>;
  destroy: () => Promise<void>;
}

interface PdfJsPage {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: (PdfJsTextItem | { type: string })[] }>;
}

/*
 * Le worker et les polices standard sont SERVIS depuis `public/pdfjs/`, copiés
 * là par scripts/copy-pdfjs-assets.mjs au `prebuild`. Les référencer par
 * `new URL(..., import.meta.url)` faisait échouer le build : webpack tente de
 * résoudre le chemin comme un module et ne trouve pas un dossier de polices.
 * Une URL absolue du domaine ne passe par aucun empaqueteur — et reste servie
 * hors ligne, comme le reste de l'app.
 */
export const WORKER_URL = "/pdfjs/pdf.worker.min.mjs";
export const STANDARD_FONTS_URL = "/pdfjs/standard_fonts/";

let modulePromise: Promise<PdfJsModule> | null = null;

/**
 * Charge pdf.js une seule fois par session. Le worker est servi depuis le
 * paquet lui-même (aucun CDN) : l'app reste utilisable hors ligne, comme le
 * reste de TaekdHub.
 */
async function loadPdfJs(): Promise<PdfJsModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
      return pdfjs;
    })();
  }
  return modulePromise;
}

function isTextItem(item: PdfJsTextItem | { type: string }): item is PdfJsTextItem {
  return typeof (item as PdfJsTextItem).str === "string";
}

/** Convertit la sortie de pdf.js en structure neutre — c'est cette frontière qui garde le reste du pipeline testable. */
export function toPdfPage(
  number: number,
  width: number,
  height: number,
  items: (PdfJsTextItem | { type: string })[]
): PdfPage {
  const converted: PdfItem[] = [];
  for (const item of items) {
    if (!isTextItem(item) || !item.str) continue;
    const [scaleX, , , , x, y] = item.transform;
    converted.push({
      text: item.str,
      x,
      y,
      width: item.width,
      // `height` vaut 0 sur les fragments d'espacement : la matrice, elle, porte
      // toujours l'échelle réelle.
      size: item.height || Math.abs(scaleX) || 0,
      font: item.fontName,
    });
  }
  return { number, width, height, items: converted };
}

export interface ReadPdfOptions {
  /** Appelé après chaque page — l'écran d'import s'en sert pour sa barre de progression. */
  onProgress?: (page: number, total: number) => void;
}

/** Lit un PDF et rend ses pages sous forme de fragments positionnés. */
export async function readPdf(data: ArrayBuffer, options: ReadPdfOptions = {}): Promise<PdfPage[]> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    // Polices standard servies depuis le paquet, jamais depuis un CDN.
    standardFontDataUrl: STANDARD_FONTS_URL,
    isEvalSupported: false,
  });
  const document = await task.promise;
  try {
    const pages: PdfPage[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pages.push(toPdfPage(index, viewport.width, viewport.height, content.items));
      options.onProgress?.(index, document.numPages);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
