/**
 * ANKI — ouvrir l'application depuis TaekdHub.
 *
 * L'élève révise ses cartes dans Anki, sur son téléphone ou son iPad. Quand
 * TaekdHub lui dit « tu risques d'oublier ce chapitre », le geste suivant
 * est d'ouvrir Anki : ce module fabrique le lien, et seulement des liens
 * dont le comportement est DOCUMENTÉ.
 *
 * CE QUE L'ON SAIT, ET D'OÙ.
 *
 *   iOS / iPadOS — AnkiMobile (manuel officiel, « URL Schemes »,
 *   docs.ankimobile.net/url-schemes.html) :
 *     • `anki://` ouvre l'application, sur la liste des paquets ;
 *     • `anki://x-callback-url/search?query=…` (AnkiMobile 2.0.90 et plus)
 *       ouvre l'écran de RECHERCHE (le navigateur de cartes) avec la
 *       requête donnée. Il ne lance PAS une séance d'étude : il montre les
 *       cartes du paquet. D'où le choix ci-dessous — le bouton principal
 *       ouvre l'application (on y étudie en touchant le paquet, dont on
 *       affiche le nom), et la recherche n'est qu'un lien secondaire.
 *     Il n'existe pas, à notre connaissance, d'URL documentée qui ouvre
 *     directement la séance d'étude d'un paquet donné.
 *
 *   Android — AnkiDroid (paquet `com.ichi2.anki`) : AnkiDroid ne déclare
 *   pas le schéma `anki://` nu. Les versions récentes acceptent
 *   `anki://x-callback-url/browser?search=…`, mais ce lien n'est pas encore
 *   dans toutes les versions installées. On utilise donc une URL `intent:`
 *   de Chrome qui lance l'activité principale du paquet — c'est-à-dire la
 *   liste des paquets, comme sur iOS — et que Chrome redirige vers le Play
 *   Store si AnkiDroid n'est pas installé.
 *
 *   Ordinateur — Anki (bureau) n'enregistre aucun schéma d'URL. Un lien
 *   `anki://` y serait MORT : on n'en affiche pas, on dit « Ouvre Anki sur
 *   ton téléphone ».
 *
 * Module pur : la détection reçoit le user-agent en paramètre.
 */

export type AnkiPlatform = "ios" | "android" | "desktop";

/** Paquet Android d'AnkiDroid (applicationId). */
export const ANKIDROID_PACKAGE = "com.ichi2.anki";

/**
 * La plateforme, d'après le user-agent et le nombre de points tactiles.
 *
 * iPadOS 13+ se présente comme un Mac (« Macintosh ») : seul un écran
 * tactile multipoint le trahit — aucun Mac n'en a.
 */
export function detectAnkiPlatform(userAgent: string, maxTouchPoints = 0): AnkiPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** Lien qui ouvre Anki sur la liste des paquets, ou `null` là où aucun lien ne marcherait (ordinateur). */
export function ankiOpenUrl(platform: AnkiPlatform): string | null {
  if (platform === "ios") return "anki://";
  if (platform === "android") {
    return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${ANKIDROID_PACKAGE};end`;
  }
  return null;
}

/**
 * La requête de recherche Anki qui sélectionne un paquet ET ses sous-paquets :
 * `deck:"Maths::Intégrales"`. Dans la syntaxe de recherche d'Anki, `*` et `_`
 * sont des jokers et `"` / `\` délimitent : on les échappe d'une barre
 * oblique inverse pour chercher le nom exact.
 */
export function ankiDeckQuery(deck: string): string {
  const escaped = deck.trim().replace(/[\\"*_]/g, (char) => `\\${char}`);
  return `deck:"${escaped}"`;
}

/**
 * Lien qui ouvre la recherche d'AnkiMobile sur le paquet — iOS seulement
 * (voir l'en-tête). `null` ailleurs, ou sans nom de paquet.
 */
export function ankiDeckSearchUrl(deck: string | undefined, platform: AnkiPlatform): string | null {
  if (platform !== "ios" || !deck?.trim()) return null;
  return `anki://x-callback-url/search?query=${encodeURIComponent(ankiDeckQuery(deck))}`;
}
