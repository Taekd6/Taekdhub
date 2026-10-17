import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REF = join(process.cwd(), "referentiel");
const TYPES = ["définition", "énoncé", "hypothèses", "piège", "contre-exemple", "exemple", "méthode", "formule", "démonstration", "ordre de grandeur"];

type Carte = {
  id: string;
  chapitre: string;
  groupe: string;
  type: string;
  recto: string;
  verso: string;
  validation: { mathematique: string; source: string; exigibilite: string };
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(REF).filter((f) => /cartes[^/]*\.jsonl$/.test(f));
const cartes = files.flatMap((f) =>
  readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => ({ file: f, ...(JSON.parse(l) as Carte) })),
);
const sources: { id: string; statut_acces: string }[] = JSON.parse(readFileSync(join(REF, "sources.json"), "utf8")).sources;

describe("référentiel de cours : cartes", () => {
  it("contient des cartes", () => expect(cartes.length).toBeGreaterThan(0));

  it("n'inclut aucun fichier ni groupe d'anglais (hors périmètre)", () => {
    for (const f of files) expect(f).not.toMatch(/anglais|english/i);
    for (const c of cartes) expect(`${c.chapitre} ${c.groupe}`).not.toMatch(/\b(anglais|english)\b/i);
  });

  it("a des identifiants uniques et des types connus", () => {
    expect(new Set(cartes.map((c) => c.id)).size).toBe(cartes.length);
    for (const c of cartes) expect(TYPES).toContain(c.type);
  });

  it("a un recto interrogatif et un verso borné", () => {
    for (const c of cartes) {
      expect(c.recto.length, c.id).toBeGreaterThan(10);
      expect(c.verso.length, c.id).toBeLessThanOrEqual(450);
    }
  });

  it("ne cite qu'une source effectivement lue", () => {
    const lues = new Set(sources.filter((s) => s.statut_acces.startsWith("lue")).map((s) => s.id));
    for (const c of cartes) {
      const src = c.validation.source;
      if (src.startsWith("aucune")) continue;
      for (const id of src.split(", ")) expect(lues.has(id), `${c.id} cite ${id}`).toBe(true);
    }
  });
});
