import { ImageResponse } from "next/og";

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
          borderRadius: 40,
          fontSize: 112,
          fontWeight: 700,
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        T
      </div>
    ),
    { width: 192, height: 192 }
  );
}
