import { describe, expect, it, vi } from "vitest";
import { fetchWithFutureJwtRetry, isFutureJwtRefusal } from "@/lib/supabase-retry";

/** Aucune clé, aucune URL réelle : des réponses fabriquées sur place. */
const refusal = () => new Response(JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }), { status: 401 });
const ok = () => new Response(JSON.stringify([{ a: 1 }]), { status: 200 });

describe("reprise sur « JWT issued at future »", () => {
  it("reconnaît ce refus précis, et lui seul", async () => {
    expect(await isFutureJwtRefusal(refusal())).toBe(true);
    expect(await isFutureJwtRefusal(new Response("JWT issued at future", { status: 401 }))).toBe(true);
    expect(await isFutureJwtRefusal(new Response("Invalid API key", { status: 401 }))).toBe(false);
    expect(await isFutureJwtRefusal(new Response("JWT issued at future", { status: 500 }))).toBe(false);
    expect(await isFutureJwtRefusal(ok())).toBe(false);
  });

  it("refait la requête une fois et renvoie la seconde réponse", async () => {
    const base = vi.fn().mockResolvedValueOnce(refusal()).mockResolvedValueOnce(ok());
    const log = vi.fn();
    const response = await fetchWithFutureJwtRetry(base, 0, log)("https://exemple.invalid/rest/v1/x", { method: "POST", body: "{}" });
    expect(response.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    expect(base.mock.calls[1]).toEqual(base.mock.calls[0]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("ne réessaie qu'une fois : un second refus est rendu tel quel", async () => {
    const base = vi.fn().mockImplementation(async () => refusal());
    const response = await fetchWithFutureJwtRetry(base, 0, () => undefined)("https://exemple.invalid");
    expect(response.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("laisse passer sans reprise une réponse normale ou un autre refus", async () => {
    const good = vi.fn().mockResolvedValue(ok());
    await fetchWithFutureJwtRetry(good, 0, () => undefined)("https://exemple.invalid");
    expect(good).toHaveBeenCalledTimes(1);

    const other = vi.fn().mockResolvedValue(new Response("Invalid API key", { status: 401 }));
    const response = await fetchWithFutureJwtRetry(other, 0, () => undefined)("https://exemple.invalid");
    expect(response.status).toBe(401);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("le journal ne contient ni clé, ni URL, ni en-tête", async () => {
    const base = vi.fn().mockResolvedValueOnce(refusal()).mockResolvedValueOnce(ok());
    const log = vi.fn();
    await fetchWithFutureJwtRetry(base, 0, log)("https://secret.exemple.invalid/rest/v1/x", { headers: { apikey: "cle-factice-ne-pas-journaliser" } });
    const written = String(log.mock.calls[0][0]);
    expect(written).not.toContain("cle-factice");
    expect(written).not.toContain("secret.exemple");
  });
});
