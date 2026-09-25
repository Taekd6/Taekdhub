import { describe, expect, it } from "vitest";
import { ANKIDROID_PACKAGE, ankiDeckQuery, ankiDeckSearchUrl, ankiOpenUrl, detectAnkiPlatform } from "@/lib/anki";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

describe("detectAnkiPlatform", () => {
  it("reconnaît l'iPhone, l'Android et l'ordinateur", () => {
    expect(detectAnkiPlatform(UA.iphone, 5)).toBe("ios");
    expect(detectAnkiPlatform(UA.android, 5)).toBe("android");
    expect(detectAnkiPlatform(UA.windows, 0)).toBe("desktop");
  });

  it("un iPad (iPadOS se présente comme un Mac) se trahit par l'écran tactile ; un vrai Mac reste un ordinateur", () => {
    expect(detectAnkiPlatform(UA.ipadDesktopMode, 5)).toBe("ios");
    expect(detectAnkiPlatform(UA.ipadDesktopMode, 0)).toBe("desktop");
  });
});

describe("liens Anki", () => {
  it("iOS : anki:// ouvre AnkiMobile", () => {
    expect(ankiOpenUrl("ios")).toBe("anki://");
  });

  it("Android : une URL intent: qui lance AnkiDroid", () => {
    const url = ankiOpenUrl("android")!;
    expect(url.startsWith("intent:#Intent;")).toBe(true);
    expect(url).toContain(`package=${ANKIDROID_PACKAGE};`);
    expect(url.endsWith(";end")).toBe(true);
  });

  it("ordinateur : pas de lien mort", () => {
    expect(ankiOpenUrl("desktop")).toBeNull();
    expect(ankiDeckSearchUrl("Maths", "desktop")).toBeNull();
  });

  it("requête de paquet : sous-paquets compris, jokers et guillemets échappés", () => {
    expect(ankiDeckQuery("Maths::Intégrales")).toBe('deck:"Maths::Intégrales"');
    expect(ankiDeckQuery('  Chimie "orga" ')).toBe('deck:"Chimie \\"orga\\""');
    expect(ankiDeckQuery("Physique_1*")).toBe('deck:"Physique\\_1\\*"');
  });

  it("recherche AnkiMobile : x-callback-url/search avec la requête encodée", () => {
    const url = ankiDeckSearchUrl("Maths::Intégrales généralisées", "ios")!;
    expect(url).toBe(`anki://x-callback-url/search?query=${encodeURIComponent('deck:"Maths::Intégrales généralisées"')}`);
    expect(decodeURIComponent(url.split("query=")[1])).toBe('deck:"Maths::Intégrales généralisées"');
    expect(ankiDeckSearchUrl("  ", "ios")).toBeNull();
    expect(ankiDeckSearchUrl(undefined, "ios")).toBeNull();
    expect(ankiDeckSearchUrl("Maths", "android")).toBeNull();
  });
});
