import { describe, expect, it } from "vitest";
import { collectionSyncStatus } from "@/lib/sync/status";
import type { SyncMeta } from "@/lib/sync/engine";

const USER = "eleve";
const meta = (collections: SyncMeta["collections"], ownerId: string | null = USER): SyncMeta => ({ ownerId, collections, lastSyncedAt: null });

describe("état de synchronisation d'une collection", () => {
  it("acceptée par le serveur et rien en attente : dans le compte", () => {
    expect(collectionSyncStatus(meta({ workItems: { revision: 3, dirty: false, localUpdatedAt: null } }), "workItems", 4, USER)).toMatchObject({ state: "envoyée", localCount: 4, revision: 3 });
  });

  it("modifiée ici et pas encore acceptée : en attente", () => {
    expect(collectionSyncStatus(meta({ workItems: { revision: 3, dirty: true, localUpdatedAt: "2026-10-16T20:00:00.000Z" } }), "workItems", 5, USER).state).toBe("en-attente");
  });

  it("du contenu local sans aucune révision serveur : pas encore dans le compte", () => {
    expect(collectionSyncStatus(meta({}), "workItems", 2, USER).state).toBe("jamais-envoyée");
  });

  it("rien ici, rien côté serveur : vide — ce n'est pas une panne", () => {
    expect(collectionSyncStatus(meta({}), "workItems", 0, USER).state).toBe("vide");
  });

  it("non connecté, ou cache d'un autre compte : sur cet appareil seulement", () => {
    expect(collectionSyncStatus(meta({ workItems: { revision: 3, dirty: false, localUpdatedAt: null } }), "workItems", 4, null).state).toBe("hors-compte");
    expect(collectionSyncStatus(meta({ workItems: { revision: 3, dirty: false, localUpdatedAt: null } }, "autre"), "workItems", 4, USER).state).toBe("hors-compte");
  });
});
