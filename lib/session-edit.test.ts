import { describe, expect, it } from "vitest";
import { SESSION_MAX_MINUTES, editSession, parseLocalDateTime, toLocalDateTime } from "@/lib/session-edit";
import { normalizeSession } from "@/lib/storage";
import { mergeList } from "@/lib/sync/collections";
import type { WorkSession } from "@/lib/supabase/types";

const NOW = new Date(2026, 8, 24, 20, 0);

function session(overrides: Partial<WorkSession> = {}): WorkSession {
  const start = new Date(2026, 8, 23, 21, 0);
  return {
    id: "s1",
    subject: "Mathématiques",
    exercise_id: null,
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + 9 * 3600_000).toISOString(),
    duration_seconds: 9 * 3600,
    note: null,
    created_at: new Date(start.getTime() + 9 * 3600_000).toISOString(),
    result: null,
    hints_used: null,
    work_item_id: "w1",
    chapter_id: "ch1",
    ...overrides,
  };
}

describe("parseLocalDateTime / toLocalDateTime", () => {
  it("aller-retour en heure locale", () => {
    const iso = new Date(2026, 8, 23, 21, 5).toISOString();
    expect(toLocalDateTime(iso)).toBe("2026-09-23T21:05");
    expect(parseLocalDateTime("2026-09-23T21:05")?.toISOString()).toBe(iso);
  });

  it("refuse l'illisible et les dates qui débordent", () => {
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime("2026-02-31T10:00")).toBeNull();
    expect(parseLocalDateTime("hier soir")).toBeNull();
  });
});

describe("editSession — corriger un chrono oublié", () => {
  it("recalcule la fin, garde le travail et le chapitre, date la correction", () => {
    const result = editSession(session(), { subject: "Physique", minutes: 90, startLocal: "2026-09-23T21:00", note: "  DM 3 " }, NOW);
    if (!("session" in result)) throw new Error("refusé");
    const edited = result.session;
    expect(edited.duration_seconds).toBe(5400);
    expect(new Date(edited.ended_at!).getTime() - new Date(edited.started_at).getTime()).toBe(5400_000);
    expect(edited).toMatchObject({ id: "s1", subject: "Physique", note: "DM 3", work_item_id: "w1", chapter_id: "ch1", updated_at: NOW.toISOString() });
  });

  it("refuse une durée nulle ou déraisonnable, un début illisible ou futur", () => {
    const base = { subject: "Physique" as const, startLocal: "2026-09-23T21:00", note: "" };
    expect(editSession(session(), { ...base, minutes: 0 }, NOW)).toEqual({ error: "durée" });
    expect(editSession(session(), { ...base, minutes: SESSION_MAX_MINUTES + 1 }, NOW)).toEqual({ error: "durée" });
    expect(editSession(session(), { ...base, minutes: 30, startLocal: "n'importe quoi" }, NOW)).toEqual({ error: "début" });
    expect(editSession(session(), { ...base, minutes: 30, startLocal: "2026-09-25T08:00" }, NOW)).toEqual({ error: "futur" });
    // Commencée il y a 10 min, mais 3 h : la fin serait dans le futur.
    expect(editSession(session(), { ...base, minutes: 180, startLocal: "2026-09-24T19:50" }, NOW)).toEqual({ error: "futur" });
    expect("session" in editSession(session(), { ...base, minutes: 10, startLocal: "2026-09-24T19:50" }, NOW)).toBe(true);
  });

  it("une note vide redevient null", () => {
    const result = editSession(session({ note: "ancienne" }), { subject: "Mathématiques", minutes: 30, startLocal: "2026-09-23T21:00", note: "   " }, NOW);
    expect("session" in result && result.session.note).toBeNull();
  });

  it("la correction survit à la normalisation et l'emporte à la synchronisation, même raccourcie", () => {
    const result = editSession(session(), { subject: "Mathématiques", minutes: 60, startLocal: "2026-09-23T21:00", note: "" }, NOW);
    if (!("session" in result)) throw new Error("refusé");
    const edited = normalizeSession(JSON.parse(JSON.stringify(result.session)));
    expect(edited.updated_at).toBe(NOW.toISOString());
    // L'autre appareil a encore la version de 9 h : la correction (plus courte) doit gagner.
    const merged = mergeList("sessions", [session()], [edited]) as WorkSession[];
    expect(merged[0].duration_seconds).toBe(3600);
    expect("updated_at" in normalizeSession(session())).toBe(false);
  });
});
