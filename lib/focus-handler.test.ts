import { describe, expect, it } from "vitest";
import { handleFocus, isoLocal, type FocusEnv } from "@/lib/focus-handler";
import { createWorkItem } from "@/lib/work-items";

const TOKEN = "x".repeat(40);
const now = new Date(2026, 9, 28, 18, 0, 0);
const task = createWorkItem({ title: "TD séries exo 3", kind: "autre", subject: null, estimatedMinutes: 45, dueDate: "2026-10-28" }, now);

function env(items: unknown[] = [task]): FocusEnv {
  return {
    token: TOKEN,
    userId: "u1",
    siteUrl: "https://taekdhub.vercel.app",
    store: () => ({ read: async () => ({ items, revision: 1 }), write: async () => "ok" }),
    now: () => now,
  };
}
const req = (method: string, body?: unknown, token = TOKEN) =>
  new Request("https://taekdhub.vercel.app/api/session", { method, headers: { authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("/api/session", () => {
  it("refuse sans le bon jeton", async () => {
    expect((await handleFocus(req("GET", undefined, "y".repeat(40)), env())).status).toBe(401);
  });

  it("GET propose les objectifs du soir", async () => {
    const res = await handleFocus(req("GET"), env());
    const data = await res.json();
    expect(data.choix).toEqual(["TD séries exo 3", "Autre"]);
    expect(data.reglages.workMinutes).toBe(50);
  });

  it("POST relie l'objectif à la tâche et calcule les alertes", async () => {
    const data = await (await handleFocus(req("POST", { objectif: "td séries exo 3", cycles: 2 }), env())).json();
    expect(data.id).toBe(task.id);
    expect(data.alertes.map((a: { heure: string }) => a.heure)).toEqual(["18:50", "19:00", "19:50"]);
    expect(data.alertes[2].url).toContain(`/echeances?t=${task.id}`);
    expect(data.alertes[0].url).toBeNull();
    expect(data.lien).toContain("/session?objectif=");
  });

  it("objectif libre ou absent", async () => {
    const free = await (await handleFocus(req("POST", { objectif: "Relire le cours d'optique" }), env())).json();
    expect(free.id).toBeNull();
    expect(free.objectif).toBe("Relire le cours d'optique");
    const none = await (await handleFocus(req("POST", {}), env([]))).json();
    expect(none.objectif).toBe("Séance libre");
  });

  it("isoLocal garde l'heure locale avec son décalage", () => {
    expect(isoLocal(now.getTime())).toMatch(/^2026-10-28T18:00:00[+-]\d\d:\d\d$/);
  });
});
