import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANKI_MIN_REVIEWED, ankiByChapter, mapDecks } from "@/lib/anki-mapping";
import type { AnkiDeckStat, AnkiSnapshot } from "@/lib/anki-snapshot";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { REFERENTIEL_DECK_CHAPTERS } from "@/lib/referentiel-decks";

/**
 * Les paquets du référentiel s'appellent `TaekdHub::Référentiel::<matière>::<chapitre>` : le pont Anki ne les rattache
 * au diagnostic que si leur dernier segment est un alias SANS AMBIGUÏTÉ d'un chapitre du programme. Ce test fige la
 * table et empêche qu'un nouveau paquet soit rattaché à tort (ou un ancien détaché sans qu'on le voie).
 */
const REF = join(process.cwd(), "referentiel");
const MATIERES: Record<string, string> = { maths: "Mathématiques", physique: "Physique", chimie: "Chimie", info: "Informatique" };

const EXPECTED = REFERENTIEL_DECK_CHAPTERS;
/** Paquets volontairement laissés « non classés » (plusieurs chapitres possibles, ou aucun). */
const UNMAPPED = [
  "analyse-vectorielle", "complexes-polynomes", "complexite-tri", "conducteurs-induction", "dipole-rayonnant", "dipoles",
  "electronique-numerique", "fonctions-vectorielles", "rappels-mpsi-algebre", "rappels-mpsi-analyse", "rappels-mpsi-chimie",
  "rappels-mpsi-physique", "rappels-ordres-de-grandeur", "rappels-particules-chargees",
];

function decks(): { name: string; slug: string }[] {
  const out = new Map<string, string>();
  for (const dir of readdirSync(REF)) {
    const matiere = MATIERES[dir];
    if (!matiere || !statSync(join(REF, dir)).isDirectory()) continue;
    for (const chapter of readdirSync(join(REF, dir))) {
      const folder = join(REF, dir, chapter);
      for (const file of readdirSync(folder).filter((f) => /^cartes.*\.jsonl$/.test(f))) {
        for (const line of readFileSync(join(folder, file), "utf8").split("\n").filter(Boolean)) {
          const slug = (JSON.parse(line) as { chapitre: string }).chapitre;
          out.set(`TaekdHub::Référentiel::${matiere}::${slug}`, slug);
        }
      }
    }
  }
  return [...out].map(([name, slug]) => ({ name, slug }));
}

describe("paquets du référentiel → chapitres du programme", () => {
  const all = decks();
  const mapping = new Map(mapDecks(all.map((d) => d.name), {}).map((m) => [m.deck, m]));

  it("couvre les paquets du référentiel", () => expect(all.length).toBeGreaterThan(50));

  it("rattache avec certitude les chapitres de la table, et seulement eux", () => {
    for (const { name, slug } of all) {
      const m = mapping.get(name)!;
      if (slug in EXPECTED) {
        expect(m.kind, name).toBe("certaine");
        expect(m.chapterId, name).toBe(EXPECTED[slug]);
      } else {
        expect(m.chapterId, `${name} ne doit pas être rattaché`).toBeNull();
      }
    }
  });

  it("classe chaque paquet du référentiel : dans la table, ou explicitement non classé (aucun oubli silencieux)", () => {
    const known = new Set([...Object.keys(EXPECTED), ...UNMAPPED]);
    expect(all.map((d) => d.slug).filter((slug) => !known.has(slug))).toEqual([]);
    expect(Object.keys(EXPECTED).filter((slug) => !all.some((d) => d.slug === slug))).toEqual([]);
  });

  it("n'altère pas le rattachement des paquets de cours existants (nom = titre du chapitre)", () => {
    const m = mapDecks(["TaekdHub::Mathématiques::Séries numériques", "TaekdHub::Physique::Thermodynamique : premier et second principes"], {});
    expect(m.map((x) => x.chapterId)).toEqual(["m1-series", "p1-thermo"]);
  });

  it("ne capte pas un paquet de l'élève qui contient lui aussi un segment « Référentiel »", () => {
    const own = "MP::Référentiel::Mathématiques::Réduction des endomorphismes";
    expect(mapDecks([own], {})[0]).toMatchObject({ kind: "certaine", chapterId: "m2-reduction" });
    const other = "Cours::Référentiel::Physique::thermodynamique";
    // Ancienne règle (alias historique du chapitre de sup), pas la table : le chapitre de spé « p2-thermo-ouverts » n'est PAS attribué.
    expect(mapDecks([other], {})[0].chapterId).not.toBe("p2-thermo-ouverts");
  });

  it("respecte le choix manuel de l'élève, qui prime sur la table", () => {
    const deck = "TaekdHub::Référentiel::Physique::thermodynamique";
    expect(mapDecks([deck], { [deck]: "p1-thermo" })[0]).toMatchObject({ kind: "manuelle", chapterId: "p1-thermo" });
    expect(mapDecks([deck], { [deck]: null })[0]).toMatchObject({ kind: "ignoré", chapterId: null });
  });

  it("ne cible que des chapitres existants de la bonne matière", () => {
    for (const [slug, id] of Object.entries(EXPECTED)) {
      const chapter = PROGRAMME_BY_ID.get(id);
      expect(chapter, slug).toBeDefined();
      const deck = all.find((d) => d.slug === slug)!;
      expect(deck.name, slug).toContain(`::${chapter!.subject}::`);
    }
  });
});

describe("les révisions du référentiel alimentent les chiffres Anki par chapitre (diagnostic)", () => {
  const deck = (name: string, reviewed30: number, failed30: number): AnkiDeckStat => ({ name, total: 100, due: 5, reviewed30, failed30, mature: 20, lapsing: 3 });
  const snapshot = (decks: AnkiDeckStat[]): AnkiSnapshot => ({ id: "anki:2026-10-19", day: "2026-10-19", takenAt: "2026-10-19T08:00:00Z", source: "ankiconnect", decks, reviewsByDay: [], manual: null });

  it("additionne le paquet du référentiel et le paquet de cours déjà associé au même chapitre", () => {
    const legacy = deck("TaekdHub::Mathématiques::Réduction des endomorphismes", 30, 6);
    const referentiel = deck("TaekdHub::Référentiel::Mathématiques::reduction", 40, 20);
    const stats = ankiByChapter(snapshot([legacy, referentiel]), {});
    const entry = stats.get("m2-reduction")!;
    expect(entry.decks.sort()).toEqual([legacy.name, referentiel.name].sort());
    expect(entry.reviewed30).toBe(70);
    expect(entry.failed30).toBe(26);
    expect(entry.reviewed30).toBeGreaterThanOrEqual(ANKI_MIN_REVIEWED);
    expect(entry.failRate).toBeCloseTo(26 / 70, 5);
  });

  it("compte les échecs du référentiel seul, et ignore un paquet non classé", () => {
    const stats = ankiByChapter(snapshot([deck("TaekdHub::Référentiel::Physique::ondes-em-vide", 25, 10), deck("TaekdHub::Référentiel::Physique::dipoles", 50, 50)]), {});
    expect([...stats.keys()]).toEqual(["p2-ondes-em"]);
    expect(stats.get("p2-ondes-em")!.failRate).toBeCloseTo(0.4, 5);
  });

  it("respecte le choix manuel : « aucun chapitre » retire le paquet du diagnostic", () => {
    const name = "TaekdHub::Référentiel::Physique::ondes-em-vide";
    expect(ankiByChapter(snapshot([deck(name, 25, 10)]), { [name]: null }).size).toBe(0);
    expect(ankiByChapter(snapshot([deck(name, 25, 10)]), { [name]: "p2-maxwell" }).get("p2-maxwell")!.failed30).toBe(10);
  });
});

