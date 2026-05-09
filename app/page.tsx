"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { Instagram } from "lucide-react";
import { HoverMorphText } from "@/components/ui/hover-morph-text";
import { PreSaveCountdown } from "@/components/ui/pre-save-countdown";
import { CRTIntro } from "@/components/ui/crt-intro";
const SplineScene = dynamic(
  () => import("@/components/ui/splite").then((m) => m.SplineScene),
  { ssr: false }
);

const ShaderAnimation = dynamic(
  () => import("@/components/ui/shader-animation").then((m) => m.ShaderAnimation),
  { ssr: false }
);

const SmokeBackground = dynamic(
  () => import("@/components/ui/spooky-smoke-animation").then((m) => m.SmokeBackground),
  { ssr: false }
);

const RELEASE_DATE  = new Date("2026-05-15T22:30:00Z"); // 5:30 PM CDT (Monterrey)
const SPLINE_SCENE  = "https://prod.spline.design/Dor5qQbQC8MafFxN/scene.splinecode";

// ── Palette ──────────────────────────────────────
const IVORY = "#F5EDD5";
const PARCHMENT = "#C8B090";
const RULE  = "rgba(245,237,213,0.22)";

const TITLE_SIZE = "clamp(2.6rem, 6.8vw, 6.2rem)";
const HOLD_MS    = 3000;
const MORPH_MS   = 1300;

export default function Home() {
  const [isFractal,     setIsFractal]     = useState(false);
  const [shaderVisible, setShaderVisible] = useState(false);
  const [crtDone,       setCRTDone]       = useState(false);

  const handleCRTDone = useCallback(() => setCRTDone(true), []);

  useEffect(() => {
    if (!crtDone) return;
    let cancelled = false;
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      while (!cancelled) {
        // ── Hold MILDRED PIERCE ────────────────────────────
        await delay(HOLD_MS);
        if (cancelled) break;

        // Gooey morph starts
        setIsFractal(true);
        await delay(MORPH_MS);
        if (cancelled) break;

        // Morph done — shader appears with FRACTAL AGREEMENT
        setShaderVisible(true);

        // ── Hold FRACTAL AGREEMENT ─────────────────────────
        await delay(HOLD_MS);
        if (cancelled) break;

        // Shader fades out, then morph back
        setShaderVisible(false);
        await delay(400);
        if (cancelled) break;

        setIsFractal(false);            // gooey morph back
        await delay(MORPH_MS);
        if (cancelled) break;
      }
    })();

    return () => { cancelled = true; };
  }, [crtDone]);

  return (
    <main className="relative w-full h-screen overflow-hidden">

      {/* ── Background ─────────────────────────────────── */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: "#0a0a0a" }}>
        <SmokeBackground smokeColor="#8B0000" />
      </div>

      {/* Shader — always mounted (native WebGL), visibility controlled by shaderVisible */}
      <div
        className="fixed inset-0 z-[4] pointer-events-none"
        style={{
          mixBlendMode: "screen",
          opacity: shaderVisible ? 0.45 : 0,
          transition: "opacity 0.6s ease",
        }}
      >
        <ShaderAnimation className="w-full h-full" />
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col md:flex-row w-full h-full">

        {/* ── Spline — top on mobile, right on desktop ── */}
        <section className="
          order-1 md:order-2
          h-[20vh] md:h-full
          w-full md:w-[42%] lg:w-[46%]
          flex-shrink-0 relative
        ">
          <SplineScene scene={SPLINE_SCENE} className="w-full h-full" />
        </section>

        {/* ── Editorial content — bottom on mobile, left on desktop ── */}
        <section className="
          order-2 md:order-1
          flex flex-col justify-center flex-1
          px-6 md:px-10 lg:px-16
          py-3 md:py-0
          gap-0 overflow-hidden
        ">

          {/* Top rule */}
          <div
            className="mb-5 md:mb-8"
            style={{ height: 1, background: RULE }}
          />

          {/* ── TITLE ZONE ── */}
          <div
            className="relative"
            style={{ height: "clamp(105px, 15vw, 210px)" }}
          >
            <HoverMorphText
              from="MILDRED PIERCE"
              to="FRACTAL AGREEMENT"
              isActive={isFractal}
              color={IVORY}
              fontSize={TITLE_SIZE}
              className="absolute inset-0"
              textClassName="font-display leading-none tracking-wide"
            />

          </div>

          {/* Bottom rule */}
          <div
            className="mt-5 md:mt-8 mb-4 md:mb-6"
            style={{ height: 1, background: RULE }}
          />

          {/* Spacer */}
          <div className="h-4 md:h-8 lg:h-12" />

          {/* Links + Countdown */}
          <div className="flex flex-col gap-4">
            {/* Pre-save button */}
            <a
              href="https://share.amuse.io/track/mildred-pierce-fractal-agreement"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-fit flex flex-col gap-1 select-none"
              style={{ textDecoration: "none" }}
            >
              {/* Main label */}
              <div
                className="flex items-center gap-3 font-display uppercase transition-opacity group-hover:opacity-80 group-active:opacity-55"
                style={{
                  color: "#e8102a",
                  fontSize: "clamp(1.6rem, 3.8vw, 3.4rem)",
                  letterSpacing: "0.16em",
                  lineHeight: 1,
                  textShadow: `
                    0 0 8px rgba(232,16,42,0.9),
                    0 0 28px rgba(232,16,42,0.55),
                    0 0 60px rgba(220,10,20,0.3)
                  `,
                }}
              >
                {/* Pulsing live dot */}
                <span style={{
                  display: "inline-block",
                  width: "0.55em",
                  height: "0.55em",
                  borderRadius: "50%",
                  backgroundColor: "#e8102a",
                  flexShrink: 0,
                  boxShadow: "0 0 6px 2px rgba(232,16,42,0.7)",
                  animation: "presavePulse 1.2s ease-in-out infinite",
                }} />
                PRE-SAVE OUT NOW
                <span style={{ opacity: 0.7, fontSize: "0.75em" }}>↗</span>
              </div>
              {/* Click hint */}
              <div
                className="font-display uppercase transition-opacity group-hover:opacity-60"
                style={{
                  color: "rgba(232,16,42,0.5)",
                  fontSize: "clamp(0.55rem, 1vw, 0.75rem)",
                  letterSpacing: "0.3em",
                  paddingLeft: "calc(0.55em + 0.75rem)",
                }}
              >
                click here to save · fractal agreement
              </div>
            </a>

            <PreSaveCountdown targetDate={RELEASE_DATE} />

            <a
              href="https://www.instagram.com/mildredpierce.__?igsh=MWRnOXZwZTZydzZteQ=="
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-fit font-display tracking-widest text-xs uppercase transition-opacity hover:opacity-55"
              style={{ color: PARCHMENT, letterSpacing: "0.22em" }}
            >
              <Instagram size={13} strokeWidth={1.5} />
              Instagram
            </a>
          </div>
        </section>
      </div>

      {/* ── CRT intro ── */}
      {!crtDone && <CRTIntro onComplete={handleCRTDone} />}
    </main>
  );
}
