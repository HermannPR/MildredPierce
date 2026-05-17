"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { Instagram } from "lucide-react";
import { HoverMorphText } from "@/components/ui/hover-morph-text";
import { CRTIntro } from "@/components/ui/crt-intro";

const ShaderAnimation = dynamic(
  () => import("@/components/ui/shader-animation").then((m) => m.ShaderAnimation),
  { ssr: false }
);

const SmokeBackground = dynamic(
  () => import("@/components/ui/spooky-smoke-animation").then((m) => m.SmokeBackground),
  { ssr: false }
);

const YOUTUBE_ID    = "wGk5GWPWHzo";
const SPOTIFY_URL   = "https://open.spotify.com/intl-es/album/52QhMekZYeTTFNOx14Kkla?si=S4ldMHDxSMe-BuIdbfa0lg";
const YOUTUBE_URL   = "https://youtu.be/wGk5GWPWHzo?si=x5V0kTD6Rg8MN_Qp";
const INSTAGRAM_URL = "https://www.instagram.com/mildredpierce.__?igsh=MWRnOXZwZTZydzZteQ==";

// ── Palette ──────────────────────────────────────
const IVORY     = "#F5EDD5";
const PARCHMENT = "#C8B090";
const RULE      = "rgba(245,237,213,0.22)";

const TITLE_SIZE   = "clamp(2.6rem, 6.8vw, 6.2rem)";
const HOLD_MILDRED = 3000;
const HOLD_FRACTAL = 5000;  // longer hold — let the single name land
const MORPH_MS     = 1300;

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
        await delay(HOLD_MILDRED);
        if (cancelled) break;

        setIsFractal(true);
        await delay(MORPH_MS);
        if (cancelled) break;

        setShaderVisible(true);

        await delay(HOLD_FRACTAL);
        if (cancelled) break;

        setShaderVisible(false);
        await delay(400);
        if (cancelled) break;

        setIsFractal(false);
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

      {/* Shader — pulses on FRACTAL AGREEMENT state */}
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

        {/* ── Video — top on mobile, right on desktop ── */}
        <section className="
          order-1 md:order-2
          w-full md:w-[42%] lg:w-[46%]
          flex-shrink-0 relative
          flex items-center justify-center
          overflow-hidden
          h-[56vw] md:h-full
        ">
          <div style={{ width: "100%", aspectRatio: "16/9" }}>
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_ID}?rel=0&modestbranding=1&color=white`}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title="Fractal Agreement — Mildred Pierce"
            />
          </div>
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

          {/* Links */}
          <div className="flex flex-col gap-3">

            {/* Descriptor */}
            <span
              className="font-display uppercase select-none"
              style={{ color: PARCHMENT, letterSpacing: "0.22em", fontSize: "0.65rem" }}
            >
              Debut Single
            </span>

            {/* Streaming */}
            <div className="flex flex-col gap-2">
              <a
                href={SPOTIFY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit font-display uppercase transition-opacity hover:opacity-55"
                style={{ color: IVORY, letterSpacing: "0.22em", fontSize: "0.75rem" }}
              >
                → Spotify
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit font-display uppercase transition-opacity hover:opacity-55"
                style={{ color: IVORY, letterSpacing: "0.22em", fontSize: "0.75rem" }}
              >
                → YouTube
              </a>
            </div>

            {/* Instagram */}
            <a
              href={INSTAGRAM_URL}
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
