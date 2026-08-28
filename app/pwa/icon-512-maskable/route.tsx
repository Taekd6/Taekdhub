import { ImageResponse } from "next/og";

/**
 * Variante "maskable" (spec PWA) : le système applique son propre masque
 * (cercle, squircle…) sur ce carré plein-bord — le motif doit donc rester
 * dans la zone de sécurité centrale (~80% du canevas), sans coins arrondis
 * ni marge transparente, sous peine d'être rogné par le masque.
 */
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6376f9",
          fontSize: 220,
          fontWeight: 700,
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        T
      </div>
    ),
    { width: 512, height: 512 }
  );
}
