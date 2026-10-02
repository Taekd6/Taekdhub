import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLLECTIONS, mergeCollection } from "@/lib/sync/collections";

describe("collections synchronisées", () => {
  it("la base accepte exactement les collections de l'application (migrations 0006 + 0008)", () => {
    const sql = readFileSync("supabase/migrations/0008_attempts_anki_sync.sql", "utf8");
    const check = sql.slice(sql.lastIndexOf("add constraint user_collections_known"));
    const accepted = [...check.slice(0, check.indexOf(";")).matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
    expect(accepted.sort()).toEqual([...COLLECTIONS].sort());
  });

  it("tentatives : union par identifiant, la version modifiée le plus récemment l'emporte", () => {
    const base = { exerciseKey: "k", subject: "Physique", result: "échec", createdAt: "2026-09-30T10:00:00.000Z" };
    const local = [{ ...base, id: "a", updatedAt: "2026-09-30T10:00:00.000Z" }, { ...base, id: "b", updatedAt: "2026-09-30T10:00:00.000Z" }];
    const remote = [{ ...base, id: "a", result: "réussi", updatedAt: "2026-10-01T10:00:00.000Z" }, { ...base, id: "c", updatedAt: "2026-09-30T10:00:00.000Z" }];
    const merged = mergeCollection("attempts", local, remote, true) as { id: string; result: string }[];
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(merged[0].result).toBe("réussi");
  });

  it("relevés Anki : le relevé le plus récent d'un même jour l'emporte, sans doublon", () => {
    const local = [{ id: "anki:2026-10-01", takenAt: "2026-10-01T08:00:00.000Z" }];
    const remote = [{ id: "anki:2026-10-01", takenAt: "2026-10-01T18:00:00.000Z" }, { id: "anki:2026-09-30", takenAt: "2026-09-30T18:00:00.000Z" }];
    const merged = mergeCollection("ankiSnapshots", local, remote, true) as { id: string; takenAt: string }[];
    expect(merged).toHaveLength(2);
    expect(merged.find((entry) => entry.id === "anki:2026-10-01")!.takenAt).toBe("2026-10-01T18:00:00.000Z");
  });
});
