import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERENTIEL_DECK_CHAPTERS } from "@/lib/referentiel-decks";
import { REFERENTIEL_INDEX, REFERENTIEL_LIMIT_MAX, searchReferentiel, type RefCard } from "@/lib/referentiel-search";

const REF = join(process.cwd(), "referentiel");
const MATIERES: Record<string, string> = { maths: "Mathématiques", physique: "Physique", chimie: "Chimie", info: "Informatique" };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

type Source = { id: string; titre?: string; auteur?: string; url_candidate?: string; type?: string; statut_acces: string };
const registry = new Map<string, Source>();
for (const file of [join(REF, "sources.json"), ...walk(join(REF, "sources")).filter((f) => f.endsWith(".json"))]) {
  for (const source of (JSON.parse(readFileSync(file, "utf8")) as { sources: Source[] }).sources) registry.set(source.id, source);
}

/** Reconstruit l'index depuis les `.jsonl` : doit être identique à data/referentiel-index.json (même règle que `referentiel.py index`). */
function expectedCards(): RefCard[] {
  const out: RefCard[] = [];
  for (const file of walk(REF).filter((f) => /cartes[^/]*\.jsonl$/.test(f)).sort()) {
    const matiere = MATIERES[file.slice(REF.length + 1).split("/")[0]] ?? "?";
    for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      const c = JSON.parse(line) as { id: string; chapitre: string; groupe: string; type: string; recto: string; verso: string; validation: { source: string; exigibilite: string } };
      out.push({
        id: c.id, c: c.chapitre, m: matiere, g: c.groupe, t: c.type, r: c.recto, v: c.verso,
        s: c.validation.source.startsWith("aucune") ? [] : c.validation.source.split(", "),
        e: c.validation.exigibilite.startsWith("confirmé") ? "confirmé" : "à confirmer",
      });
    }
  }
  return out;
}

describe("index du référentiel (data/referentiel-index.json)", () => {
  it("est identique aux .jsonl : sinon, relancer `python3 scripts/referentiel/referentiel.py index`", () => {
    const expected = expectedCards();
    expect(REFERENTIEL_INDEX.cartes.length).toBe(expected.length);
    const mismatched = expected.filter((card, i) => JSON.stringify(card) !== JSON.stringify(REFERENTIEL_INDEX.cartes[i])).map((card) => card.id);
    expect(mismatched.slice(0, 10)).toEqual([]);
  });

  it("ne contient que des sources du registre, lues, avec les mêmes titres", () => {
    const used = new Set(REFERENTIEL_INDEX.cartes.flatMap((card) => card.s));
    expect([...used].sort()).toEqual(Object.keys(REFERENTIEL_INDEX.sources).sort());
    for (const id of used) {
      const source = registry.get(id)!;
      expect(source, id).toBeDefined();
      expect(source.statut_acces.startsWith("lue"), id).toBe(true);
      expect(REFERENTIEL_INDEX.sources[id].titre, id).toBe(source.titre ?? "");
    }
  });

  it("a un chapitre du programme pour les paquets de la table", () => {
    const slugs = new Set(REFERENTIEL_INDEX.cartes.map((card) => card.c));
    for (const slug of Object.keys(REFERENTIEL_DECK_CHAPTERS)) expect(slugs.has(slug), slug).toBe(true);
  });
});

describe("searchReferentiel", () => {
  it("trouve une carte pertinente avec matière, chapitre, contenu, sources et validation", () => {
    const result = searchReferentiel({ q: "théorème spectral", matiere: "maths" });
    expect(result.total).toBeGreaterThan(0);
    const hit = result.resultats[0];
    expect(hit.matiere).toBe("Mathématiques");
    expect(hit.recto.length).toBeGreaterThan(10);
    expect(hit.verso.length).toBeGreaterThan(0);
    expect(["confirmé", "à confirmer"]).toContain(hit.exigibilite);
    expect(hit.id).toMatch(/^[a-z]+-\d+$/);
  });

  it("filtre par chapitre du programme et ne renvoie que les paquets qui lui sont rattachés", () => {
    const result = searchReferentiel({ chapterId: "m2-reduction", limit: REFERENTIEL_LIMIT_MAX });
    expect(result.total).toBeGreaterThan(50);
    expect(new Set(result.resultats.map((hit) => hit.chapitre))).toEqual(new Set(["reduction"]));
    expect(result.resultats.every((hit) => hit.programme?.id === "m2-reduction")).toBe(true);
    expect(result.affiches).toBeLessThanOrEqual(REFERENTIEL_LIMIT_MAX);
  });

  it("ne fabrique aucune source : chaque source citée est lue et vient du registre", () => {
    const result = searchReferentiel({ q: "vecteur propre", limit: REFERENTIEL_LIMIT_MAX });
    for (const hit of result.resultats) {
      for (const source of hit.sources) {
        expect(registry.get(source.id)?.statut_acces.startsWith("lue"), source.id).toBe(true);
        expect(source.titre).toBe(registry.get(source.id)!.titre ?? "");
      }
    }
    expect(result.avertissements.join(" ")).toContain("pages et sections précises ne sont pas conservées");
  });

  it("dit explicitement qu'aucune carte ne correspond, sans rien inventer", () => {
    const result = searchReferentiel({ q: "zzzqxv plorf" });
    expect(result.total).toBe(0);
    expect(result.resultats).toEqual([]);
    expect(result.avertissements.join(" ")).toContain("Aucune carte du référentiel ne correspond");
  });

  it("signale un filtre de chapitre sans paquet rattaché", () => {
    const result = searchReferentiel({ chapterId: "m1-logique", q: "récurrence" });
    expect(result.total).toBe(0);
    expect(result.avertissements.join(" ")).toContain("Aucun paquet du référentiel n'est rattaché");
  });

  it("refuse une requête vide et borne le nombre de résultats", () => {
    expect(searchReferentiel({}).avertissements[0]).toContain("Requête vide");
    expect(searchReferentiel({ matiere: "physique", limit: 1000 }).affiches).toBe(REFERENTIEL_LIMIT_MAX);
    expect(searchReferentiel({ matiere: "physique", limit: 0 }).affiches).toBe(1);
  });

  it("annonce un résultat partiel quand aucune carte ne contient tous les mots", () => {
    const result = searchReferentiel({ q: "diagonalisable zzzqxv", matiere: "maths" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.avertissements.join(" ")).toContain("résultats partiels");
  });

  it("classe les cartes dont le recto contient les mots avant celles où ils ne sont que dans le verso", () => {
    const result = searchReferentiel({ q: "polynôme minimal", chapterId: "m2-reduction", limit: 5 });
    expect(result.resultats[0].recto.toLowerCase()).toContain("minimal");
  });

  it("signale explicitement la troncature (total > affichés)", () => {
    const result = searchReferentiel({ matiere: "physique", limit: 3 });
    expect(result.total).toBeGreaterThan(3);
    expect(result.affiches).toBe(3);
    expect(result.avertissements.join(" ")).toContain("Résultats tronqués : 3 cartes affichées sur " + result.total);
  });

  it("ne trouve pas un mot au milieu d'un autre (« or » n'est pas dans « théorème »), mais trouve un début de mot", () => {
    const mid = searchReferentiel({ q: "or", matiere: "maths", limit: REFERENTIEL_LIMIT_MAX });
    expect(mid.resultats.every((hit) => /(^|[^a-zà-ÿ])or($|[^a-zà-ÿ])/i.test(`${hit.recto} ${hit.verso} ${hit.groupe} ${hit.chapitre}`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      || /\bor/i.test(`${hit.recto} ${hit.verso} ${hit.groupe}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))).toBe(true);
    expect(searchReferentiel({ q: "diagonalis", chapterId: "m2-reduction" }).total).toBeGreaterThan(0);
  });

  it("avertit quand les mots-clés sont inexploitables mais qu'un filtre existe (pas de pertinence trompeuse)", () => {
    const result = searchReferentiel({ q: "de la ∑", matiere: "chimie" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.avertissements.join(" ")).toContain("PAS classées par pertinence");
  });

  it("gère les caractères spéciaux, les regex et les entrées très longues sans erreur", () => {
    for (const q of ["(((", "[a-z]+.*", "\\", "%00 ; DROP TABLE", "é".repeat(5000), "a ".repeat(3000), "𝒮ₙ ∑ ‖x‖"]) {
      expect(() => searchReferentiel({ q, matiere: "maths" })).not.toThrow();
    }
    expect(searchReferentiel({ q: "mot ".repeat(500) + "spectral" }).resultats.length).toBeGreaterThanOrEqual(0);
  });

  it("une matière trop courte ou inconnue ne renvoie rien (jamais une matière devinée)", () => {
    expect(searchReferentiel({ q: "spectral", matiere: "m" }).total).toBe(0);
    expect(searchReferentiel({ q: "spectral", matiere: "astrologie" }).total).toBe(0);
  });

  it("renvoie les cartes sans source lue avec une liste de sources vide et l'avertissement correspondant", () => {
    const result = searchReferentiel({ q: "", chapitre: "ondes-mecaniques", limit: REFERENTIEL_LIMIT_MAX });
    const bare = result.resultats.filter((hit) => hit.sources.length === 0);
    if (bare.length > 0) expect(result.avertissements.join(" ")).toContain("aucune source lue");
    expect(result.resultats.every((hit) => hit.chapitre === "ondes-mecaniques")).toBe(true);
  });
});

