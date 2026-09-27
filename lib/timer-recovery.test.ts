import { describe, expect, it } from "vitest";
import { ORPHAN_AFTER_MS, ORPHAN_MAX_AGE_MS, TOMBSTONES_KEPT, addTombstone, isOrphan, parseMirror, parseTombstones } from "@/lib/timer-recovery";

const NOW = new Date("2026-09-24T18:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function mirror(overrides: { tabId?: string; heartbeatAgo?: number; startedAgo?: number } = {}) {
  return {
    tabId: overrides.tabId ?? "tab-a",
    heartbeatAt: ago(overrides.heartbeatAgo ?? ORPHAN_AFTER_MS + 1000),
    snapshot: { startedAt: ago(overrides.startedAgo ?? 3_600_000) },
  };
}

describe("parseMirror", () => {
  it("lit un miroir valide et refuse le reste", () => {
    expect(parseMirror(JSON.stringify(mirror()))?.tabId).toBe("tab-a");
    expect(parseMirror(null)).toBeNull();
    expect(parseMirror("{")).toBeNull();
    expect(parseMirror(JSON.stringify({ tabId: "x", heartbeatAt: "hier", snapshot: { startedAt: NOW.toISOString() } }))).toBeNull();
    expect(parseMirror(JSON.stringify({ tabId: "x", heartbeatAt: NOW.toISOString() }))).toBeNull();
  });
});

describe("isOrphan", () => {
  it("un chrono d'un autre onglet qui ne bat plus est orphelin", () => {
    expect(isOrphan(mirror(), "tab-b", [], NOW)).toBe(true);
  });

  it("jamais le sien, jamais un onglet qui bat encore", () => {
    expect(isOrphan(mirror(), "tab-a", [], NOW)).toBe(false);
    expect(isOrphan(mirror({ heartbeatAgo: 30_000 }), "tab-b", [], NOW)).toBe(false);
  });

  it("jamais une séance déjà enregistrée, ni une séance trop ancienne", () => {
    const m = mirror();
    expect(isOrphan(m, "tab-b", ["autre", m.snapshot.startedAt], NOW)).toBe(false);
    expect(isOrphan(mirror({ startedAgo: ORPHAN_MAX_AGE_MS + 1000 }), "tab-b", [], NOW)).toBe(false);
  });

  it("pas de miroir : rien", () => {
    expect(isOrphan(null, "tab-b", [], NOW)).toBe(false);
  });
});

describe("pierres tombales", () => {
  it("gardent plusieurs séances closes, sans doublon, bornées", () => {
    let raw: string | null = null;
    for (let i = 0; i < TOMBSTONES_KEPT + 5; i++) raw = addTombstone(raw, `s${i}`);
    raw = addTombstone(raw, "s24");
    const list = parseTombstones(raw);
    expect(list).toHaveLength(TOMBSTONES_KEPT);
    expect(list.at(-1)).toBe("s24");
    expect(list.filter((entry) => entry === "s24")).toHaveLength(1);
    expect(list).not.toContain("s0");
  });

  it("lisent l'ancienne valeur isolée", () => {
    expect(parseTombstones("2026-09-24T10:00:00.000Z")).toEqual(["2026-09-24T10:00:00.000Z"]);
    expect(parseTombstones(null)).toEqual([]);
  });
});
