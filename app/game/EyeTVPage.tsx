"use client";
import dynamic from "next/dynamic";

const EyeTV = dynamic(
  () => import("@/components/ui/tamagotchi").then(m => m.EyeTV),
  { ssr: false }
);

export function EyeTVPage() {
  return (
    <>
      <style>{`
        @keyframes crt-flicker {
          0%, 85%, 91%, 96%, 100% { opacity: 1; }
          87% { opacity: 0.88; }
          93% { opacity: 0.95; }
        }
        @keyframes scanroll {
          from { background-position: 0 0; }
          to   { background-position: 0 4px; }
        }
        @keyframes tap-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.65; }
        }
        .eyetv-canvas-wrap canvas {
          animation: crt-flicker 10s infinite;
          filter:
            drop-shadow(0 0 10px rgba(30, 100, 180, 0.70))
            drop-shadow(0 0 30px rgba(10,  60, 120, 0.40))
            drop-shadow(0 0 60px rgba(0,   30,  80, 0.20))
            brightness(0.96) contrast(1.10);
        }
        .eyetv-back:hover { color: #5a9ab8 !important; }
      `}</style>

      <main style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#020406",
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
        paddingTop: 48,
        paddingBottom: 64,
        gap: 0,
      }}>

        {/* Animated scanlines */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 20, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 4px)",
          animation: "scanroll 0.12s steps(1) infinite",
        }} />

        {/* Vignette */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 19, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.95) 100%)",
        }} />

        {/* Phosphor ambient glow */}
        <div style={{
          position: "fixed",
          top: "42%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 420, height: 420,
          zIndex: 8,
          pointerEvents: "none",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,80,160,0.16) 0%, transparent 70%)",
        }} />

        {/* Station ID */}
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 8,
          color: "#1e3a50",
          letterSpacing: "0.35em",
          marginBottom: 14,
          position: "relative",
          zIndex: 10,
          textTransform: "uppercase",
        }}>
          EYETV — CH. 00
        </p>

        {/* Canvas + UI */}
        <div className="eyetv-canvas-wrap" style={{ position: "relative", zIndex: 10 }}>
          <EyeTV />
        </div>

        {/* Tap hint */}
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 6,
          color: "#2a5070",
          letterSpacing: "0.3em",
          marginTop: 18,
          position: "relative",
          zIndex: 10,
          animation: "tap-pulse 2.5s ease-in-out infinite",
        }}>
          TAP TO HYPE
        </p>

        {/* Bottom scan artifact */}
        <div style={{
          position: "fixed",
          top: "62%", left: 0, right: 0,
          height: 1, zIndex: 18, pointerEvents: "none",
          background: "linear-gradient(90deg, transparent 0%, rgba(30,80,140,0.12) 30%, rgba(30,80,140,0.12) 70%, transparent 100%)",
        }} />

        {/* Back */}
        <a
          href="/"
          className="eyetv-back"
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7,
            color: "#2a5070",
            letterSpacing: "0.25em",
            textDecoration: "none",
            zIndex: 30,
            transition: "color 0.3s",
          }}
        >
          ← BACK
        </a>
      </main>
    </>
  );
}
