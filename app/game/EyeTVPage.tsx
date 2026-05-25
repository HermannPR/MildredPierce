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
        @keyframes tap-flash {
          0%   { opacity: 0.55; box-shadow: inset 0 0 18px rgba(42,128,200,0.5); }
          100% { opacity: 0;    box-shadow: inset 0 0 0px transparent; }
        }
        @keyframes float-up {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1.1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-44px) scale(0.8); }
        }
        @keyframes hint-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.9; }
        }
        .eyetv-canvas-wrap canvas {
          animation: crt-flicker 10s infinite;
          background: transparent;
          filter:
            drop-shadow(0 0 12px rgba(40, 120, 220, 0.90))
            drop-shadow(0 0 32px rgba(20,  80, 160, 0.60))
            drop-shadow(0 0 70px rgba(0,   40, 100, 0.30))
            brightness(1.05) contrast(1.10);
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
