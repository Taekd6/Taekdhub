import { describe, expect, it } from "vitest";
import { concoursBadge } from "@/lib/exo-concours";
import { exoAnchor, exoHref, parseExoTarget } from "@/lib/exo-target";

describe("exo-target", () => {
  it("ancre et lien", () => {
    expect(exoAnchor("wp-ccinp_physique_mp_2023")).toBe("exo-wp-ccinp_physique_mp_2023");
    expect(exoHref("p1-machines", "wp-x", "46")).toBe("/exos/p1-machines#exo-wp-x~46");
    expect(exoHref("p1-machines", "wp-x")).toBe("/exos/p1-machines#exo-wp-x");
  });
  it("relit la cible depuis le hash", () => {
    expect(parseExoTarget("#exo-wp-x~46")).toEqual({ id: "wp-x", question: "46" });
    expect(parseExoTarget("#exo-wp-x")).toEqual({ id: "wp-x", question: null });
    expect(parseExoTarget("#autre")).toBeNull();
    expect(parseExoTarget("")).toBeNull();
    expect(parseExoTarget("#exo-")).toBeNull();
  });
});

describe("concoursBadge", () => {
  const e = (titre: string, source: "annale" | "beos" = "annale", concours?: string) => ({ titre, source, concours });
  it("reconnaît les concours", () => {
    expect(concoursBadge(e("CCINP Physique-Chimie · MP 2020"))?.key).toBe("ccinp");
    expect(concoursBadge(e("CentraleSupélec Physique-Chimie 1 · MP 2023"))?.key).toBe("centrale");
    expect(concoursBadge(e("Mines-Ponts Physique 1 · MP 2023"))?.key).toBe("mines");
    expect(concoursBadge(e("E3A Physique-Chimie · PSI 2023"))?.key).toBe("e3a");
    expect(concoursBadge(e("X-ENS Physique · MP 2021"))?.key).toBe("x-ens");
    expect(concoursBadge(e("Polytechnique Physique · MP 2021"))?.key).toBe("x-ens");
    expect(concoursBadge(e("Banque PT Physique B · PT 2024"))?.key).toBe("pt");
  });
  it("BEOS par la source, rien d'inconnu", () => {
    expect(concoursBadge(e("BEOS n° 6123", "beos"))?.key).toBe("beos");
    expect(concoursBadge(e("Freslon exo 4.3"))).toBeNull();
  });
});
