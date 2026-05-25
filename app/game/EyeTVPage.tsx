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
        overflow: "hidden",
        gap: 0,
      }}>

        {/* Animated scanlines — subtly rolling */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 20, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 4px)",
          animation: "scanroll 0.12s steps(1) infinite",
        }} />

        {/* Vignette — less aggressive, leaves center visible */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 19, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 48%, transparent 35%, rgba(0,0,0,0.70) 80%, rgba(0,0,0,0.95) 100%)",
        }} />

        {/* Phosphor ambient glow — blue halo behind the canvas */}
        <div style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 380, height: 380,
          zIndex: 8,
          pointerEvents: "none",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,80,160,0.18) 0%, transparent 70%)",
        }} />

        {/* Station ID — top label */}
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "#1e3a50",
          letterSpacing: "0.35em",
          marginBottom: 18,
          position: "relative",
          zIndex: 10,
          textTransform: "uppercase",
        }}>
          EYETV — CH. 00
        </p>

        {/* Canvas */}
        <div className="eyetv-canvas-wrap" style={{ position: "relative", zIndex: 10 }}>
          <EyeTV />
        </div>

        {/* Bottom scan artifact line */}
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
            bottom: 22,
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
