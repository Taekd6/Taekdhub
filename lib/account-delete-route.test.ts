import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LA ROUTE DE SUPPRESSION DE COMPTE — requêtes réelles contre le gestionnaire,
 * avec un client Supabase simulé : aucune base n'est jamais contactée.
 */

const getUser = vi.fn();
const deleteUser = vi.fn();
vi.mock("@/lib/push-server", () => ({ adminDb: () => ({ auth: { getUser, admin: { deleteUser } } }) }));

const URL_BASE = "http://localhost/api/account/delete";
const post = async (init: { token?: string; body?: unknown }) => {
  const { POST } = await import("@/app/api/account/delete/route");
  return POST(
    new Request(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  );
};

beforeEach(() => {
  getUser.mockReset();
  deleteUser.mockReset();
  vi.stubEnv("SUPABASE_URL", "http://supabase.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", "cle-factice");
});

describe("POST /api/account/delete", () => {
  it("503 si le serveur n'est pas configuré, sans rien contacter", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const response = await post({ token: "t", body: { confirmation: "SUPPRIMER" } });
    expect(response.status).toBe(503);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("401 sans jeton", async () => {
    expect((await post({ body: { confirmation: "SUPPRIMER" } })).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it.each([[undefined], [{}], [{ confirmation: "supprimer" }], [{ confirmation: true }]])("400 sans la confirmation exacte (%j)", async (body) => {
    expect((await post({ token: "t", body })).status).toBe(400);
    expect(getUser).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("401 si le jeton est invalide", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    expect((await post({ token: "faux", body: { confirmation: "SUPPRIMER" } })).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("supprime UNIQUEMENT le compte du jeton, même si la requête nomme un autre identifiant", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "moi" } }, error: null });
    deleteUser.mockResolvedValue({ error: null });
    const response = await post({ token: "ok", body: { confirmation: "SUPPRIMER", id: "un-autre", user_id: "un-autre" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ supprime: true });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("moi");
  });

  it("500 sans fuite technique quand la suppression échoue", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "moi" } }, error: null });
    deleteUser.mockResolvedValue({ error: { message: "ERREUR INTERNE SECRETE" } });
    const response = await post({ token: "ok", body: { confirmation: "SUPPRIMER" } });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("SECRETE");
  });
});
