import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EYETV — Mildred Pierce",
  description: "Click to feed the eye. Enter your code. Make the leaderboard.",
};

const EyeTV = dynamic(
  () => import("@/components/ui/tamagotchi").then(m => m.EyeTV),
  { ssr: false }
);

export default function GamePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-12"
      style={{ background: "#0a0a0f" }}
    >
      <h1
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(0.5rem, 2.5vw, 0.9rem)",
          color: "#7b5ea7",
          letterSpacing: "0.3em",
          textAlign: "center",
        }}
      >
        EYETV
      </h1>

      <EyeTV />

      <a
        href="/"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "#3a2a5a",
          letterSpacing: "0.2em",
          textDecoration: "none",
        }}
      >
        ← BACK
      </a>
    </main>
  );
}
