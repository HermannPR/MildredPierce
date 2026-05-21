import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed the Signal — Mildred Pierce",
  description: "Click to feed the signal. Enter your code. Make the leaderboard.",
};

const Tamagotchi = dynamic(
  () => import("@/components/ui/tamagotchi").then(m => m.Tamagotchi),
  { ssr: false }
);

export default function GamePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-12"
      style={{ background: "#0a0a0f" }}
    >
      <div className="flex flex-col items-center gap-1">
        <h1
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(0.5rem, 2.5vw, 0.8rem)",
            color: "#7b5ea7",
            letterSpacing: "0.2em",
            textAlign: "center",
          }}
        >
          MILDRED PIERCE
        </h1>
        <h2
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(0.4rem, 2vw, 0.65rem)",
            color: "#4a3a6a",
            letterSpacing: "0.3em",
            textAlign: "center",
          }}
        >
          FEED THE SIGNAL
        </h2>
      </div>

      <Tamagotchi />

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
