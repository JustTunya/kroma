import { ImageResponse } from "next/og";

export const alt = "KROMA Coffee & Bakehouse — Specialty Roastery & Micro-Bakehouse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#1A1816",
          color: "#F8F6F0",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, opacity: 0.7 }}>CLUJ-NAPOCA / ROASTERY &amp; BAKEHOUSE</div>
        <div style={{ fontSize: 220, letterSpacing: -8, lineHeight: 1 }}>KROMA</div>
        <div style={{ fontSize: 34 }}>Roasted Tuesday. Baked this morning. Collected at the bar.</div>
      </div>
    ),
    size,
  );
}
