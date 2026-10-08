import { describe, expect, it } from "vitest";
import { AVATAR_MAX_LENGTH, AVATAR_SIZE, avatarCrop, normalizeAvatar } from "@/lib/avatar";
import { normalizePreferences } from "@/lib/storage";

/**
 * PHOTO DE PROFIL — elle remplace l'initiale de l'accueil.
 *
 * Stockée dans les préférences sous forme d'image déjà réduite (data URL) :
 * elle voyage avec la sauvegarde et la synchronisation, et pèse quelques
 * dizaines de kilo-octets au plus, pas les mégaoctets d'une photo de
 * téléphone (le localStorage plafonne vers 5 Mo pour TOUTES les données).
 */

const tiny = (type = "jpeg", body = "AAAA") => `data:image/${type};base64,${body}`;

describe("normalizeAvatar — ce qui est accepté comme photo", () => {
  it("une image JPEG, PNG ou WebP encodée en base64 est acceptée telle quelle", () => {
    for (const type of ["jpeg", "png", "webp"]) expect(normalizeAvatar(tiny(type))).toBe(tiny(type));
  });

  it("absente, vide ou d'un autre type : pas de photo", () => {
    expect(normalizeAvatar(undefined)).toBeNull();
    expect(normalizeAvatar(null)).toBeNull();
    expect(normalizeAvatar("")).toBeNull();
    expect(normalizeAvatar(42)).toBeNull();
    expect(normalizeAvatar("https://exemple.fr/photo.jpg")).toBeNull();
    expect(normalizeAvatar("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(normalizeAvatar("data:text/html;base64,PGgxPg==")).toBeNull();
  });

  it("un contenu qui n'est pas du base64 est refusé", () => {
    expect(normalizeAvatar("data:image/jpeg;base64,<script>")).toBeNull();
  });

  it("une image trop lourde est refusée : elle viendrait d'ailleurs que du sélecteur, qui réduit toujours", () => {
    const heavy = tiny("jpeg", "A".repeat(AVATAR_MAX_LENGTH));
    expect(heavy.length).toBeGreaterThan(AVATAR_MAX_LENGTH);
    expect(normalizeAvatar(heavy)).toBeNull();
  });
});

describe("la photo dans les préférences", () => {
  it("par défaut : pas de photo (l'initiale reste affichée)", () => {
    expect(normalizePreferences({}).avatarDataUrl).toBeNull();
  });

  it("une photo valide survit à la lecture ; une valeur abîmée est écartée sans casser le reste", () => {
    expect(normalizePreferences({ avatarDataUrl: tiny() }).avatarDataUrl).toBe(tiny());
    const broken = normalizePreferences({ avatarDataUrl: "pas une image", displayName: "Alix" });
    expect(broken.avatarDataUrl).toBeNull();
    expect(broken.displayName).toBe("Alix");
  });
});

describe("avatarCrop — un carré centré, réduit à la taille de l'avatar", () => {
  it("une photo en paysage : on garde le carré central", () => {
    expect(avatarCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000, size: AVATAR_SIZE });
  });

  it("une photo en portrait : idem, en hauteur", () => {
    expect(avatarCrop(3000, 4000)).toEqual({ sx: 0, sy: 500, side: 3000, size: AVATAR_SIZE });
  });

  it("une image plus petite que l'avatar n'est pas agrandie", () => {
    expect(avatarCrop(100, 80)).toEqual({ sx: 10, sy: 0, side: 80, size: 80 });
  });

  it("une image vide ou illisible : rien à recadrer", () => {
    expect(avatarCrop(0, 300)).toBeNull();
    expect(avatarCrop(Number.NaN, 300)).toBeNull();
  });
});
