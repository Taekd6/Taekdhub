import { describe, expect, it } from "vitest";
import type { ExerciseAttempt } from "@/lib/attempts";
import { normalizeChapterNotes, setChapterExos } from "@/lib/chapter-notes";
import {
  addExos,
  attemptForGrade,
  caseKey,
  caseState,
  caseStates,
  chapterStats,
  dueCases,
  entryCases,
  exoFromUrl,
  forecast,
  intervalFor,
  normalizeExoEntries,
  parseCaseKey,
  progression,
  streakDays,
  activityDays,
  undoLastAttempt,
  weakChapters,
  withQuestion,
  type ExoEntry,
  type ExoStatus,
} from "@/lib/exos";
import { addChapterExos, describeChapterExos, describeExosOverview, logChapterExos } from "@/lib/mcp-exos";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

const evn = PROGRAMME_BY_ID.get("m2-evn")!;
const reduction = PROGRAMME_BY_ID.get("m2-reduction")!;
const NOW = new Date("2026-11-20T10:00:00Z");

function entry(over: Partial<ExoEntry> = {}): ExoEntry {
  return { id: "e1", source: "annale", titre: "CCINP Maths 1 · MP 2025", questions: ["1", "2", "3"], createdAt: NOW.toISOString(), ...over };
}

let clock = 0;
function attempt(key: string, day: string, status: ExoStatus, note: string | null = null): ExerciseAttempt {
  clock += 1;
  const stamp = new Date(`${day}T08:00:00Z`).getTime() + clock;
  return {
    id: `a${clock}`,
    exerciseKey: key,
    label: key,
    subject: "Mathématiques",
    chapterId: "m2-evn",
    origin: "annale",
    day,
    createdAt: new Date(stamp).toISOString(),
    updatedAt: new Date(stamp).toISOString(),
    result: status === "rate" ? "échec" : "réussi",
    help: status === "indices" ? "indices" : "sans",
    minutes: null,
    plannedMinutes: null,
    cause: null,
    lackOfTime: false,
    gradeId: null,
    note,
  };
}

describe("catalogue", () => {
  it("normalise une entrée et rejette ce qui est inutilisable", () => {
    const list = normalizeExoEntries(
      [
        { id: "a", source: "beos", titre: " BEOS n° 12 ", url: "javascript:alert(1)", questions: [] },
        { id: "b", source: "inconnu", titre: "x" },
        { id: "c", source: "manuel", titre: "" },
        { id: "d", source: "manuel", titre: "Livre · exo 3", questions: ["a", "b", "a", 4], niveau: 5, page: "p. 12" },
      ],
      NOW.toISOString()
    );
    expect(list.map((e) => e.id)).toEqual(["a", "d"]);
    expect(list[0].url).toBeUndefined();
    expect(list[1].questions).toEqual(["a", "b", "4"]);
    expect(list[1].niveau).toBeUndefined();
  });

  it("ajoute, et met à jour une entrée de même lien sans changer son identifiant", () => {
    const first = addExos([], [{ source: "annale", titre: "Sujet A", url: "https://x.fr/a", questions: 3 }], NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.items[0].questions).toEqual(["1", "2", "3"]);
    const second = addExos(first.items, [{ source: "annale", titre: "Sujet A (corrigé)", url: "https://x.fr/a/", questions: 4 }], NOW);
    expect(second.ok && second.updated).toBe(1);
    if (!second.ok) return;
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).toBe(first.items[0].id);
    expect(second.items[0].questions).toHaveLength(4);
  });

  it("refuse un lien qui n'est pas http(s)", () => {
    const result = addExos([], [{ source: "autre", titre: "X", url: "ftp://x" }], NOW);
    expect(result.ok).toBe(false);
  });

  it("garde le catalogue dans chapterNotes sans toucher au cours", () => {
    const notes = normalizeChapterNotes([{ id: "m2-evn", cours: "Cours", methodes: [], updatedAt: "2026-11-01T00:00:00Z" }]);
    const next = setChapterExos(notes, "m2-evn", [entry()], NOW);
    const reread = normalizeChapterNotes(JSON.parse(JSON.stringify(next)));
    expect(reread[0].cours).toBe("Cours");
    expect(reread[0].exos?.[0].titre).toBe("CCINP Maths 1 · MP 2025");
  });
});

describe("cases", () => {
  it("clé d'une case, aller et retour", () => {
    expect(caseKey("m2-evn", "e1", "4")).toBe("exo:m2-evn:e1#4");
    expect(parseCaseKey("exo:m2-evn:e1#4")).toEqual({ chapterId: "m2-evn", entryId: "e1", question: "4" });
    expect(parseCaseKey("exo:m2-evn:e1")).toEqual({ chapterId: "m2-evn", entryId: "e1", question: null });
    expect(entryCases("m2-evn", entry({ questions: [] }))).toEqual([{ key: "exo:m2-evn:e1", question: null }]);
  });

  it("intervalles : raté 3, indices 7, seul 14 → 30 → 60 → 120 → 240", () => {
    expect(intervalFor("rate", 0)).toBe(3);
    expect(intervalFor("indices", 0)).toBe(7);
    expect([1, 2, 3, 4, 5, 9].map((n) => intervalFor("seul", n))).toEqual([14, 30, 60, 120, 240, 240]);
  });

  it("état d'une case : dernier statut, série de « seul », date de retour, dernier piège", () => {
    const key = caseKey("m2-evn", "e1", "1");
    const list = [attempt(key, "2026-11-01", "rate", "oublié la dimension finie"), attempt(key, "2026-11-04", "seul"), attempt(key, "2026-11-18", "seul")];
    const state = caseState(key, list)!;
    expect(state.status).toBe("seul");
    expect(state.streak).toBe(2);
    expect(state.next).toBe("2026-12-18");
    expect(state.note).toBe("oublié la dimension finie");
    expect(state.history.map((h) => h.status)).toEqual(["rate", "seul", "seul"]);
  });

  it("une tentative cochée a la forme attendue et « Effacer » retire seulement la dernière", () => {
    const a = attemptForGrade({ chapter: evn, entry: entry(), question: "2", status: "indices" }, NOW, "2026-11-20");
    expect(a.exerciseKey).toBe("exo:m2-evn:e1#2");
    expect(a.result).toBe("réussi");
    expect(a.help).toBe("indices");
    expect(a.origin).toBe("annale");
    const key = caseKey("m2-evn", "e1", "1");
    const list = [attempt(key, "2026-11-01", "rate"), attempt(key, "2026-11-02", "seul")];
    expect(undoLastAttempt(list, key).map((x) => x.day)).toEqual(["2026-11-01"]);
  });
});

describe("tableau de bord", () => {
  const entries = [entry(), entry({ id: "e2", source: "beos", titre: "BEOS n° 1", questions: [] })];
  const k = (q: string | null, id = "e1") => caseKey("m2-evn", id, q);
  const attempts = [attempt(k("1"), "2026-11-10", "seul"), attempt(k("2"), "2026-11-15", "rate", "piège"), attempt(k("3"), "2026-11-12", "indices"), attempt(k(null, "e2"), "2026-11-19", "rate")];
  const states = caseStates(attempts);
  const catalogue = [{ chapter: evn, entries }];

  it("statistiques d'un chapitre", () => {
    const stats = chapterStats(catalogue[0], states, "2026-11-20");
    expect(stats).toMatchObject({ cases: 4, done: 4, seul: 1, indices: 1, rate: 2, due: 2 });
    expect(stats.mastery).toBeCloseTo(0.375);
    expect(stats.bySource.beos).toEqual({ cases: 1, done: 1 });
  });

  it("cases dues, la plus en retard d'abord", () => {
    const due = dueCases(catalogue, states, "2026-11-20");
    expect(due.map((d) => d.question)).toEqual(["2", "3"]);
  });

  it("prévision : les retards comptent aujourd'hui", () => {
    const days = forecast(states.values(), "2026-11-20");
    expect(days[0].count).toBe(2);
    expect(days.find((d) => d.day === "2026-11-22")?.count).toBe(1);
    expect(days.find((d) => d.day === "2026-11-24")?.count).toBe(1);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(4);
  });

  it("progression : maîtrise à la fin de chaque semaine, rien sous 3 cases", () => {
    const points = progression(states.values(), "2026-11-20", 3);
    expect(points.map((p) => p.start)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(points[0].mastery).toBeNull();
    expect(points[1]).toMatchObject({ worked: 3, done: 3 });
    expect(points[1].mastery).toBeCloseTo(0.5);
    expect(points[2].worked).toBe(1);
  });

  it("série de jours et points faibles", () => {
    expect(streakDays(activityDays(states.values()), "2026-11-20")).toBe(1);
    const weak = weakChapters(catalogue, states, "2026-11-20");
    expect(weak).toHaveLength(1);
    expect(weak[0].tip).toMatch(/rates plus que tu ne bloques/);
    expect(weak[0].lastNote).toBe("piège");
  });
});

describe("liens collés", () => {
  it("Wikiprepa : concours, épreuve, filière, année, question", () => {
    const parsed = exoFromUrl("https://wikiprepa.fr/concours/ecrit/centrale_physique-chimie-1_mp_2026/corrige#q15");
    expect(parsed?.question).toBe("15");
    expect(parsed?.exo).toMatchObject({ source: "annale", titre: "CentraleSupélec · Physique chimie 1 · MP 2026", url: "https://wikiprepa.fr/concours/ecrit/centrale_physique-chimie-1_mp_2026/corrige", annee: 2026 });
  });
  it("BEOS et autres sites", () => {
    expect(exoFromUrl("https://beos.prepas.org/sujet.php?id=6123")?.exo.source).toBe("beos");
    expect(exoFromUrl("pas un lien")).toBeNull();
    expect(exoFromUrl("https://www.booleanopera.fr/exo/serie-alternee")?.exo.titre).toBe("booleanopera.fr · serie alternee");
  });
  it("une 2e question du même sujet s'ajoute, triée", () => {
    expect(withQuestion(entry({ questions: ["15"] }), "3").questions).toEqual(["3", "15"]);
  });
});

describe("connecteur", () => {
  it("add_exos puis log_exos puis get_exos", () => {
    const added = addChapterExos([], evn, [{ source: "beos", titre: "BEOS n° 6123 · Mines-Ponts 2024", url: "https://beos.example/6123" }, { source: "manuel", titre: "Manuel · ch. 3 · exo 3.7", questions: ["a", "b"], page: "p. 142" }], NOW);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const logged = logChapterExos([], added.items, evn, [{ exo: "6123", statut: "rate", piege: "pas vu la densité" }, { exo: "exo 3.7", questions: ["b"], statut: "seul" }], NOW, "2026-11-20");
    expect(logged.ok).toBe(true);
    if (!logged.ok) return;
    expect(logged.items).toHaveLength(2);
    const text = describeChapterExos(evn, added.items, logged.items, "2026-11-20");
    expect(text).toMatch(/exo: Raté \(revient le 2026-11-23\)/);
    expect(text).toMatch(/Qa: pas fait · Qb: Seul/);
    expect(describeExosOverview(added.items, logged.items, "2026-11-23")).toMatch(/À REVOIR AUJOURD'HUI \(1\)/);
  });
  it("log_exos refuse une entrée inconnue ou une question absente", () => {
    const added = addChapterExos([], reduction, [{ source: "manuel", titre: "Livre · exo 1", questions: 2 }], NOW);
    if (!added.ok) throw new Error("ajout refusé");
    expect(logChapterExos([], added.items, reduction, [{ exo: "inconnu", statut: "seul" }], NOW, "2026-11-20").ok).toBe(false);
    expect(logChapterExos([], added.items, reduction, [{ exo: "Livre · exo 1", statut: "seul" }], NOW, "2026-11-20").ok).toBe(false);
    expect(logChapterExos([], added.items, reduction, [{ exo: "Livre · exo 1", questions: ["9"], statut: "seul" }], NOW, "2026-11-20").ok).toBe(false);
  });
});
