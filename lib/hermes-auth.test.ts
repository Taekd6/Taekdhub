import { describe, expect, it } from "vitest";
import { bearerToken, isHermesAuthorized, MIN_HERMES_TOKEN_LENGTH } from "@/lib/hermes-auth";

/**
 * Les jetons de ces tests sont des VALEURS FACTICES, fabriquées sur place :
 * aucun secret réel n'apparaît dans le dépôt.
 */
const TOKEN = "t".repeat(MIN_HERMES_TOKEN_LENGTH) + "-valeur-factice-de-test";
const bearer = (value: string) => `Bearer ${value}`;

describe("Hermes — lecture de l'en-tête Authorization", () => {
  it("extrait le jeton d'un en-tête Bearer, insensible à la casse du mot « Bearer »", () => {
    expect(bearerToken(bearer("abc123"))).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("BEARER   abc123  ")).toBe("abc123");
  });

  it.each([[null], [undefined], [""], ["Bearer"], ["Bearer "], ["Basic abc123"], ["abc123"], ["Bearer a b"], ["Token abc123"]])("%j : aucun jeton", (header) => {
    expect(bearerToken(header)).toBeUndefined();
  });
});

describe("Hermes — autorisation", () => {
  it("accepte exactement le jeton configuré", () => {
    expect(isHermesAuthorized(bearer(TOKEN), TOKEN)).toBe(true);
    expect(isHermesAuthorized(`bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("refuse un jeton faux, tronqué, allongé ou sans rapport", () => {
    expect(isHermesAuthorized(bearer(TOKEN.slice(0, -1)), TOKEN)).toBe(false);
    expect(isHermesAuthorized(bearer(`${TOKEN}x`), TOKEN)).toBe(false);
    expect(isHermesAuthorized(bearer("autre-chose"), TOKEN)).toBe(false);
    expect(isHermesAuthorized(bearer(TOKEN.toUpperCase()), TOKEN)).toBe(false);
  });

  it("refuse l'absence d'en-tête, un autre schéma et un en-tête vide", () => {
    for (const header of [null, undefined, "", "Basic abc", TOKEN, `Bearer ${TOKEN} extra`]) expect(isHermesAuthorized(header, TOKEN)).toBe(false);
  });

  it("FERMÉ PAR DÉFAUT : sans jeton configuré, même un en-tête vide ou identique ne passe pas", () => {
    for (const configured of [undefined, ""]) {
      expect(isHermesAuthorized(bearer(TOKEN), configured)).toBe(false);
      expect(isHermesAuthorized(bearer(""), configured)).toBe(false);
      expect(isHermesAuthorized(null, configured)).toBe(false);
      expect(isHermesAuthorized(bearer("undefined"), configured)).toBe(false);
    }
  });

  it("un jeton configuré trop court est refusé, même présenté à l'identique", () => {
    const short = "s".repeat(MIN_HERMES_TOKEN_LENGTH - 1);
    expect(isHermesAuthorized(bearer(short), short)).toBe(false);
    const enough = "s".repeat(MIN_HERMES_TOKEN_LENGTH);
    expect(isHermesAuthorized(bearer(enough), enough)).toBe(true);
  });

  it("n'est pas le secret du connecteur de Claude : un autre jeton, même valide ailleurs, ne passe pas", () => {
    const claudeSecret = "c".repeat(MIN_HERMES_TOKEN_LENGTH);
    expect(isHermesAuthorized(bearer(claudeSecret), TOKEN)).toBe(false);
  });
});
