import { afterEach, describe, expect, it, vi } from "vitest";
import { DATA_WRITTEN_EVENT, localData, STORAGE_ERROR_EVENT } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * Synchronisation intra-onglet (audit produit hors contenu, sprint
 * priorisation + sync + XP) : `usePrepahubData()` lui-même ne peut pas être
 * rendu ici (pas de jsdom/@testing-library/react dans le projet — voir
 * vitest.config.ts et le précédent déjà posé par hooks/use-work-timer.test.ts).
 * Ce fichier teste donc ce qui EST vérifiable sans rendu React :
 * - les constantes d'événement réellement exportées (distinctes, namespacées) ;
 * - le contrat de diffusion/écoute que le hook applique (événement standard
 *   `EventTarget`, disponible nativement en Node — pas besoin de DOM), combiné
 *   aux VRAIES fonctions `localData.save*`/`localData.sessions` (déjà
 *   utilisées ailleurs dans ce fichier de test, voir la suite existante).
 * Le câblage React (`useEffect`/`useState`) proprement dit reste vérifié
 * manuellement au navigateur (voir le rapport de sprint).
 */

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "s-1",
    subject: "Mathématiques",
    exercise_id: null,
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T00:10:00.000Z",
    duration_seconds: 600,
    note: null,
    created_at: "2026-01-01T00:10:00.000Z",
    result: null,
    ...overrides,
  };
}

describe("DATA_WRITTEN_EVENT — constante", () => {
  it("est distincte de STORAGE_ERROR_EVENT (jamais fusionnée en un événement fourre-tout)", () => {
    expect(DATA_WRITTEN_EVENT).not.toBe(STORAGE_ERROR_EVENT);
  });

  it("reste namespacée comme le reste du stockage applicatif", () => {
    expect(DATA_WRITTEN_EVENT.startsWith("prepahub:")).toBe(true);
  });

  it("ne réutilise jamais le nom réservé de l'événement natif inter-onglets", () => {
    expect(DATA_WRITTEN_EVENT).not.toBe("storage");
  });
});

/**
 * Reproduit exactement le contrat documenté dans hooks/use-prepahub-data.ts :
 * diffusion UNIQUEMENT après un succès d'écriture, sur un `EventTarget`
 * standard (`window` en production — un `EventTarget` nu ici, API identique,
 * disponible nativement en Node). Chaque "instance" simulée relit la VRAIE
 * donnée via `localData.sessions()`, jamais une valeur inventée localement.
 */
describe("synchronisation intra-onglet — contrat événementiel", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWorkingLocalStorage() {
    const store = new Map<string, string>();
    // `localData.sessions()` (lecture) court-circuite sur `typeof window ===
    // "undefined"` — absent par défaut en Node (voir vitest.config.ts, pas de
    // jsdom) — donc un `window` factice est requis pour que la relecture
    // fonctionne, en plus du `localStorage` stubbé (écriture seule).
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    });
  }

  function stubFailingLocalStorage() {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      getItem: () => null,
    });
  }

  /** Même geste que les callbacks `saveX` du hook : écrit, puis ne diffuse QUE si `ok`. */
  function writeAndBroadcast(bus: EventTarget, sessions: WorkSession[]): boolean {
    const ok = localData.saveSessions(sessions);
    if (ok) bus.dispatchEvent(new Event(DATA_WRITTEN_EVENT));
    return ok;
  }

  it("un événement est diffusé après une écriture réussie", () => {
    stubWorkingLocalStorage();
    const bus = new EventTarget();
    let fired = 0;
    bus.addEventListener(DATA_WRITTEN_EVENT, () => fired++);

    const ok = writeAndBroadcast(bus, [makeSession()]);

    expect(ok).toBe(true);
    expect(fired).toBe(1);
  });

  it("aucun événement n'est diffusé après un échec d'écriture", () => {
    stubFailingLocalStorage();
    const bus = new EventTarget();
    let fired = 0;
    bus.addEventListener(DATA_WRITTEN_EVENT, () => fired++);

    const ok = writeAndBroadcast(bus, [makeSession()]);

    expect(ok).toBe(false);
    expect(fired).toBe(0);
  });

  it("plusieurs instances (ex. sidebar + page courante) sont TOUTES notifiées, chacune une seule fois", () => {
    stubWorkingLocalStorage();
    const bus = new EventTarget();
    let sidebarFired = 0;
    let pageFired = 0;
    bus.addEventListener(DATA_WRITTEN_EVENT, () => sidebarFired++);
    bus.addEventListener(DATA_WRITTEN_EVENT, () => pageFired++);

    writeAndBroadcast(bus, [makeSession()]);

    expect(sidebarFired).toBe(1);
    expect(pageFired).toBe(1);
  });

  it("les instances notifiées relisent la donnée réellement écrite (jamais une valeur inventée)", () => {
    stubWorkingLocalStorage();
    const bus = new EventTarget();
    let seenBySidebar: WorkSession[] = [];
    bus.addEventListener(DATA_WRITTEN_EVENT, () => {
      seenBySidebar = localData.sessions();
    });

    writeAndBroadcast(bus, [makeSession({ id: "s-42", duration_seconds: 1234 })]);

    expect(seenBySidebar).toHaveLength(1);
    expect(seenBySidebar[0].id).toBe("s-42");
    expect(seenBySidebar[0].duration_seconds).toBe(1234);
  });

  it("aucune boucle : réagir à l'événement en relisant les données ne redéclenche jamais l'événement", () => {
    stubWorkingLocalStorage();
    const bus = new EventTarget();
    let fired = 0;
    bus.addEventListener(DATA_WRITTEN_EVENT, () => {
      fired++;
      localData.sessions(); // une simple lecture, jamais une écriture
    });

    writeAndBroadcast(bus, [makeSession()]);

    // Si la lecture avait, par erreur, redéclenché l'événement, `fired` vaudrait 2 ou plus.
    expect(fired).toBe(1);
  });

  it("un second écrivain déclenche un second événement, jamais accumulé silencieusement", () => {
    stubWorkingLocalStorage();
    const bus = new EventTarget();
    let fired = 0;
    bus.addEventListener(DATA_WRITTEN_EVENT, () => fired++);

    writeAndBroadcast(bus, [makeSession({ id: "s-1" })]);
    writeAndBroadcast(bus, [makeSession({ id: "s-1" }), makeSession({ id: "s-2" })]);

    expect(fired).toBe(2);
    expect(localData.sessions()).toHaveLength(2);
  });
});
