/**
 * PHOTO DE PROFIL — elle remplace l'initiale de l'accueil (components/home/hero.tsx).
 *
 * Elle vit dans les préférences (`Preferences.avatarDataUrl`), sous forme
 * d'image DÉJÀ RÉDUITE, encodée en « data URL ». C'est ce qui lui permet de
 * voyager sans rien ajouter : la sauvegarde et la synchronisation du compte
 * transportent déjà les préférences.
 *
 * Réduite, parce qu'une photo de téléphone pèse plusieurs mégaoctets et que
 * le localStorage plafonne vers 5 Mo pour TOUTES les données de l'élève. Le
 * sélecteur (components/account/avatar-picker.tsx) recadre donc en carré et
 * réduit à `AVATAR_SIZE` pixels avant d'enregistrer : quelques dizaines de
 * kilo-octets.
 *
 * Fonctions pures — aucun DOM ici ; le dessin dans un canvas reste dans le
 * composant.
 */

/** Côté de l'avatar enregistré, en pixels : deux fois sa plus grande taille affichée, pour les écrans Retina. */
export const AVATAR_SIZE = 192;

/**
 * Longueur maximale acceptée pour la data URL. Une photo de 192 px en JPEG
 * fait environ 10 à 30 Ko ; au-delà de 150 000 caractères, ce n'est pas une
 * image passée par le sélecteur (fichier de sauvegarde modifié à la main,
 * donnée abîmée) : on l'écarte plutôt que de remplir le stockage.
 */
export const AVATAR_MAX_LENGTH = 150_000;

/**
 * Seuls JPEG, PNG et WebP, et seulement en base64. Le SVG est exclu : c'est
 * un document qui peut embarquer du script — une photo n'en a pas besoin.
 */
const AVATAR_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** La photo telle qu'enregistrée, si elle est valide ; sinon `null` (l'initiale reste affichée). */
export function normalizeAvatar(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > AVATAR_MAX_LENGTH) return null;
  return AVATAR_PATTERN.test(raw) ? raw : null;
}

export interface AvatarCrop {
  /** Coin supérieur gauche du carré gardé, dans l'image d'origine. */
  sx: number;
  sy: number;
  /** Côté du carré gardé, dans l'image d'origine. */
  side: number;
  /** Côté de l'image produite — jamais plus grand que l'original : on n'agrandit pas une petite image. */
  size: number;
}

/** Le carré CENTRÉ à garder d'une image `width` × `height`, et la taille finale — `null` si l'image n'a pas de dimensions. */
export function avatarCrop(width: number, height: number): AvatarCrop | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
    size: Math.min(AVATAR_SIZE, side),
  };
}
