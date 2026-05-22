import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0002",
          position: "relative",
        }}
      >
        {/* Crimson radial gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(0,200,255,0.4) 0%, transparent 70%)",
          }}
        />

        {/* Text stack */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            position: "relative",
          }}
        >
          {/* Band name */}
          <span
            style={{
              color: "#ffffff",
              fontSize: "72px",
              fontWeight: 700,
              letterSpacing: "0.3em",
              fontFamily: "serif",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            MILDRED PIERCE
          </span>

          {/* Single title */}
          <span
            style={{
              color: "rgba(200,176,144,0.9)",
              fontSize: "28px",
              fontWeight: 400,
              letterSpacing: "0.4em",
              fontFamily: "serif",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            FRACTAL AGREEMENT
          </span>

          {/* Release line */}
          <span
            style={{
              color: "rgba(200,176,144,0.5)",
              fontSize: "16px",
              fontWeight: 400,
              letterSpacing: "0.5em",
              fontFamily: "sans-serif",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            DEBUT SINGLE — OUT NOW
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
