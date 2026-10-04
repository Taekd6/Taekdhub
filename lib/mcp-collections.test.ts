import { describe, expect, it } from "vitest";
import { mutateCollection, type CollectionRow, type CollectionStore } from "@/lib/mcp-collections";

/** Un serveur en mémoire qui applique la règle de révision, et peut simuler un appareil qui écrit entre la lecture et l'écriture. */
function memoryStore(initial: CollectionRow | null, interleave: Array<(row: CollectionRow | null) => CollectionRow> = []) {
  let row = initial;
  let writes = 0;
  const store: CollectionStore = {
    async read() {
      const current = row;
      const other = interleave.shift();
      if (other) row = other(row);
      return current;
    },
    async write(items, baseRevision) {
      if ((row?.revision ?? 0) !== baseRevision) return "conflict";
      writes += 1;
      row = { items, revision: baseRevision + 1 };
      return "ok";
    },
  };
  return { store, get row() { return row; }, get writes() { return writes; } };
}

const append = (value: string) => (current: unknown) => ({ ok: true as const, items: [...(Array.isArray(current) ? current : []), value], value });

describe("mutateCollection — écrire comme un appareil, sans écraser personne", () => {
  it("crée la ligne quand elle n'existe pas (révision 0 → 1)", async () => {
    const server = memoryStore(null);
    expect(await mutateCollection(server.store, append("a"))).toEqual({ ok: true, value: "a" });
    expect(server.row).toEqual({ items: ["a"], revision: 1 });
  });

  it("un appareil écrit entre la lecture et l'écriture : on relit, on rejoue, rien n'est perdu", async () => {
    const server = memoryStore({ items: ["x"], revision: 3 }, [(row) => ({ items: [...(row!.items as string[]), "appareil"], revision: row!.revision + 1 })]);
    await mutateCollection(server.store, append("claude"));
    expect(server.row).toEqual({ items: ["x", "appareil", "claude"], revision: 5 });
  });

  it("une erreur métier n'écrit rien", async () => {
    const server = memoryStore({ items: ["x"], revision: 1 });
    expect(await mutateCollection(server.store, () => ({ ok: false, error: "non" }))).toEqual({ ok: false, error: "non" });
    expect(server.writes).toBe(0);
  });

  it("abandonne proprement après des conflits répétés, et une erreur serveur remonte telle quelle", async () => {
    const busy = memoryStore({ items: [], revision: 1 }, Array.from({ length: 10 }, () => (row: CollectionRow | null) => ({ items: row!.items, revision: row!.revision + 1 })));
    expect((await mutateCollection(busy.store, append("a"))).ok).toBe(false);
    const broken: CollectionStore = { read: async () => null, write: async () => ({ error: "réseau" }) };
    expect(await mutateCollection(broken, append("a"))).toEqual({ ok: false, error: "réseau" });
  });
});
