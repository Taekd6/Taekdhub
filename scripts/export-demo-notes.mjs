#!/usr/bin/env node
/**
 * Écrit data/demonstrations.notes.json : le type de note Anki et les notes
 * RENDUES, à partir de data/demonstrations.json. C'est ce fichier que lit
 * scripts/build-demo-deck.py pour fabriquer le paquet — le rendu n'existe
 * donc qu'à UN endroit (lib/demo-cards.ts), et un test vérifie que ce
 * fichier est à jour.
 *
 *   node --experimental-strip-types scripts/export-demo-notes.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEMO_MODEL, demoNote } from "../lib/demo-cards.ts";
import { PROGRAMME } from "../lib/programme-data.ts";

const data = JSON.parse(readFileSync(new URL("../data/demonstrations.json", import.meta.url), "utf8"));
const chapters = new Map(PROGRAMME.map((chapter) => [chapter.id, chapter]));
const notes = data.demonstrations.map((demo) => {
  const chapter = chapters.get(demo.chapterId);
  if (!chapter) throw new Error(`Chapitre inconnu : ${demo.chapterId}`);
  return demoNote(demo, `TaekdHub::${chapter.subject}::${chapter.title}`, chapter.title);
});
writeFileSync(new URL("../data/demonstrations.notes.json", import.meta.url), JSON.stringify({ model: DEMO_MODEL, notes }, null, 1) + "\n");
console.log(`${notes.length} notes exportées`);
