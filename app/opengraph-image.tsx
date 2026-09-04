import { ImageResponse } from "next/og";

/**
 * Aperçu des liens partagés (WhatsApp, Discord, iMessage, réseaux) — généré,
 * jamais un fichier binaire à maintenir, exactement comme app/icon.tsx.
 *
 * Sans lui, une URL TaekdHub envoyée à un camarade n'affichait qu'un titre et
 * un rectangle gris : le principal canal d'acquisition d'un produit de prépa
 * est le partage entre élèves, et un lien sans aperçu ne donne pas envie
 * d'être ouvert.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TaekdHub — ton système de travail en prépa";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#09090b",
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#d4f36b",
              borderRadius: 14,
              fontSize: 34,
              fontWeight: 700,
              color: "#09090b",
            }}
          >
            T
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#d4f36b", letterSpacing: 2 }}>TAEKDHUB</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 78, fontWeight: 700, color: "#fafafa", lineHeight: 1.05 }}>
          Chaque heure compte.
        </div>
        <div style={{ marginTop: 30, fontSize: 33, color: "#a1a1aa", lineHeight: 1.4, maxWidth: 940 }}>
          Il te dit quoi travailler maintenant — et pourquoi. Une banque d’exercices de prépa scientifique, classée selon tes résultats réels.
        </div>
      </div>
    ),
    size
  );
}
