import { describe, expect, it } from "vitest";
import { ORPHAN_AFTER_MS, ORPHAN_MAX_AGE_MS, isOrphan, parseMirror } from "@/lib/timer-recovery";

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
    expect(isOrphan(mirror(), "tab-b", null, NOW)).toBe(true);
  });

  it("jamais le sien, jamais un onglet qui bat encore", () => {
    expect(isOrphan(mirror(), "tab-a", null, NOW)).toBe(false);
    expect(isOrphan(mirror({ heartbeatAgo: 30_000 }), "tab-b", null, NOW)).toBe(false);
  });

  it("jamais une séance déjà enregistrée, ni une séance trop ancienne", () => {
    const m = mirror();
    expect(isOrphan(m, "tab-b", m.snapshot.startedAt, NOW)).toBe(false);
    expect(isOrphan(mirror({ startedAgo: ORPHAN_MAX_AGE_MS + 1000 }), "tab-b", null, NOW)).toBe(false);
  });

  it("pas de miroir : rien", () => {
    expect(isOrphan(null, "tab-b", null, NOW)).toBe(false);
  });
});
