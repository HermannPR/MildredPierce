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
        <SmokeBackground smokeColor="#cc0000" />
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
        <ShaderAnimation className="w-full h-full" paused={!shaderVisible} />
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col md:flex-row w-full h-full">

        {/* ── Spline — top on mobile, right on desktop ── */}
        <section className="
          order-1 md:order-2
          h-[44vh] md:h-full
          -mb-[20vh] md:mb-0
          w-full md:w-[42%] lg:w-[46%]
          flex-shrink-0 relative
          z-0 md:z-auto
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
          relative z-10 md:z-auto
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
          <div className="flex flex-col gap-5">

            {/* ── PRE-SAVE block ── */}
            <div className="flex flex-col gap-2">
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
                  <span style={{
                    display: "inline-block",
                    width: "0.55em", height: "0.55em",
                    borderRadius: "50%",
                    backgroundColor: "#e8102a",
                    flexShrink: 0,
                    boxShadow: "0 0 6px 2px rgba(232,16,42,0.7)",
                    animation: "presavePulse 1.2s ease-in-out infinite",
                  }} />
                  PRE-SAVE
                  <span style={{ opacity: 0.7, fontSize: "0.75em" }}>↗</span>
                </div>
                <div
                  className="font-display uppercase transition-opacity group-hover:opacity-60"
                  style={{
                    color: "#d4a800",
                    fontSize: "clamp(0.7rem, 2vw, 0.85rem)",
                    letterSpacing: "0.3em",
                    paddingLeft: "calc(0.55em + 0.75rem)",
                  }}
                >
                  by amuse
                </div>
              </a>

              {/* Platform badges */}
              <div
                className="flex items-center gap-4"
                style={{ paddingLeft: "calc(0.55em + 0.75rem)" }}
              >
                <span className="font-display uppercase" style={{ color: "rgba(245,237,213,0.28)", fontSize: "clamp(0.65rem, 2vw, 0.72rem)", letterSpacing: "0.22em" }}>
                  save on
                </span>
                {/* Spotify */}
                <a
                  href="https://share.amuse.io/track/mildred-pierce-fractal-agreement"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-opacity hover:opacity-80 active:opacity-55"
                  style={{ color: "#1DB954", textDecoration: "none", padding: "6px 0", minHeight: "44px" }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  <span className="font-display uppercase" style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", letterSpacing: "0.18em" }}>Spotify</span>
                </a>
                <span style={{ color: "rgba(245,237,213,0.15)" }}>·</span>
                {/* Apple Music */}
                <a
                  href="https://share.amuse.io/track/mildred-pierce-fractal-agreement"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-opacity hover:opacity-80 active:opacity-55"
                  style={{ color: "#fc3c44", textDecoration: "none", padding: "6px 0", minHeight: "44px" }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.08-.003-.16-.006-.24-.007H5.55c-.08.001-.16.004-.24.007a10.496 10.496 0 00-1.564.15 5.022 5.022 0 00-1.877.726C.75 1.624.005 2.624-.312 3.934a9.23 9.23 0 00-.24 2.19c-.003.08-.004.16-.005.24v11.272c.001.08.002.16.005.24a9.23 9.23 0 00.24 2.19c.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 001.877.726c.497.095 1.026.143 1.564.15.08.003.16.005.24.006h12.792c.08-.001.16-.003.24-.006a10.5 10.5 0 001.564-.15 5.022 5.022 0 001.877-.726c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 00.24-2.19c.003-.08.004-.16.005-.24V6.364c-.001-.08-.002-.16-.005-.24zM16.25 8.62l-4.737 1.152v4.593c0 .032-.002.064-.003.097a1.995 1.995 0 01-.233.853 2.005 2.005 0 01-3.532-.326 2.005 2.005 0 01.376-2.155 2.006 2.006 0 012.392-.47v-5.64l6-1.459v4.355z"/>
                  </svg>
                  <span className="font-display uppercase" style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", letterSpacing: "0.18em" }}>Apple Music</span>
                </a>
              </div>
            </div>

            {/* ── Separator ── */}
            <div style={{ height: 1, background: "rgba(245,237,213,0.1)", width: "100%" }} />

            {/* ── Countdown block ── */}
            <PreSaveCountdown targetDate={RELEASE_DATE} />

            {/* ── Instagram ── */}
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
