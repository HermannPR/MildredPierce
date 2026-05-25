import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EYETV — Mildred Pierce",
  description: "Click the eye. Add hype for the next release.",
};

const EyeTV = dynamic(
  () => import("@/components/ui/tamagotchi").then(m => m.EyeTV),
  { ssr: false }
);

export default function GamePage() {
  return (
    <>
      <style>{`
        @keyframes crt-flicker {
          0%, 88%, 91%, 95%, 100% { opacity: 1; }
          89% { opacity: 0.94; }
          92% { opacity: 0.97; }
        }
        .eyetv-canvas-wrap canvas {
          animation: crt-flicker 12s infinite;
          filter:
            drop-shadow(0 0 6px rgba(20, 80, 140, 0.45))
            drop-shadow(0 0 18px rgba(10, 50, 90, 0.25))
            brightness(0.92) contrast(1.08);
        }
      `}</style>

      <main
        style={{
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#030507",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* CRT scanlines overlay */}
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 20,
          pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
        }} />

        {/* Vignette */}
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 19,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,0.92) 100%)",
        }} />

        {/* Horizontal bleed — subtle CRT roll artifact */}
        <div style={{
          position: "fixed",
          top: "30%",
          left: 0, right: 0,
          height: 1,
          zIndex: 18,
          pointerEvents: "none",
          background: "rgba(20,60,100,0.06)",
        }} />

        {/* Canvas */}
        <div className="eyetv-canvas-wrap" style={{ position: "relative", zIndex: 10 }}>
          <EyeTV />
        </div>

        {/* Back */}
        <a
          href="/"
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 6,
            color: "#0e1820",
            letterSpacing: "0.2em",
            textDecoration: "none",
            zIndex: 30,
          }}
        >
          ← BACK
        </a>
      </main>
    </>
  );
}
