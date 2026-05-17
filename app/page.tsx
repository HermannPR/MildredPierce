"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { Instagram, Youtube } from "lucide-react";
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

const VHSBackground = dynamic(
  () => import("@/components/ui/vhs-background").then((m) => m.VHSBackground),
  { ssr: false }
);

const YOUTUBE_ID    = "wGk5GWPWHzo";
const SPOTIFY_URL   = "https://open.spotify.com/intl-es/album/52QhMekZYeTTFNOx14Kkla?si=S4ldMHDxSMe-BuIdbfa0lg";
const YOUTUBE_URL   = "https://youtu.be/wGk5GWPWHzo?si=x5V0kTD6Rg8MN_Qp";
const INSTAGRAM_URL = "https://www.instagram.com/mildredpierce.__?igsh=MWRnOXZwZTZydzZteQ==";

const IVORY     = "#F5EDD5";
const PARCHMENT = "#C8B090";
const RULE      = "rgba(245,237,213,0.22)";

const TITLE_SIZE   = "clamp(2.6rem, 6.8vw, 6.2rem)";
const HOLD_MILDRED = 3000;
const HOLD_FRACTAL = 5000;
const MORPH_MS     = 1300;

// ── Brand icons ───────────────────────────────────
function SpotifyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function AppleMusicIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 3v10.46A4.5 4.5 0 1 0 12 18V7h6V3H8z"/>
    </svg>
  );
}

// ── Platform link row ────────────────────────────
function PlatformLink({
  href,
  icon,
  label,
  iconColor,
  disabled,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  iconColor: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className="flex items-center justify-between py-[0.65rem]"
      style={{ opacity: disabled ? 0.28 : 1 }}
    >
      <div className="flex items-center gap-3" style={{ color: iconColor }}>
        {icon}
        <span
          className="font-display uppercase"
          style={{ color: IVORY, letterSpacing: "0.22em", fontSize: "0.72rem" }}
        >
          {label}
        </span>
      </div>
      <span
        className="font-display uppercase"
        style={{ color: PARCHMENT, letterSpacing: "0.18em", fontSize: "0.55rem" }}
      >
        {disabled ? "Soon" : "↗"}
      </span>
    </div>
  );

  if (disabled || !href) return <div className="select-none cursor-default">{inner}</div>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-opacity hover:opacity-70"
    >
      {inner}
    </a>
  );
}

export default function Home() {
  const [isFractal, setIsFractal] = useState(false);
  const [crtDone,   setCRTDone]   = useState(false);

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
        await delay(HOLD_FRACTAL);
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
      <div className="fixed inset-0 z-0" style={{ backgroundColor: "#0d0002" }}>
        <SmokeBackground smokeColor="#dd0000" />
      </div>

      {/* VHS static */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{ mixBlendMode: "screen", opacity: 0.28 }}
      >
        <VHSBackground className="w-full h-full" />
      </div>

      {/* Fractal rings — vivid crimson ambient layer */}
      <div
        className="fixed inset-0 z-[4] pointer-events-none"
        style={{ mixBlendMode: "screen", opacity: 0.42 }}
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
          relative z-10 md:z-auto
        ">

          {/* Top rule */}
          <div className="mb-5 md:mb-8" style={{ height: 1, background: RULE }} />

          {/* Title */}
          <div className="relative" style={{ height: "clamp(105px, 15vw, 210px)" }}>
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
          <div className="mt-5 md:mt-8" style={{ height: 1, background: RULE }} />

          {/* ── Streaming platforms ── */}
          <div className="flex flex-col">

            {/* Band photo + descriptor */}
            <div className="pt-3 pb-1 flex items-center gap-3">
              <div style={{
                position: "relative",
                width: 48, height: 48,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid rgba(245,237,213,0.28)",
                boxShadow: "0 0 12px rgba(200,16,42,0.22)",
              }}>
                <Image src="/BandImage.jpeg" alt="Mildred Pierce" fill style={{ objectFit: "cover" }} />
              </div>
              <span
                className="font-display uppercase select-none"
                style={{ color: PARCHMENT, letterSpacing: "0.22em", fontSize: "0.6rem", opacity: 0.7 }}
              >
                Debut Single
              </span>
            </div>

            <PlatformLink
              href={SPOTIFY_URL}
              icon={<SpotifyIcon />}
              label="Spotify"
              iconColor="#1DB954"
            />
            <div style={{ height: 1, background: RULE }} />

            <PlatformLink
              href={YOUTUBE_URL}
              icon={<Youtube size={13} strokeWidth={0} fill="currentColor" />}
              label="YouTube"
              iconColor="#FF0000"
            />
            <div style={{ height: 1, background: RULE }} />

            <PlatformLink
              icon={<AppleMusicIcon />}
              label="Apple Music"
              iconColor="#FC3C44"
              disabled
            />
            <div style={{ height: 1, background: RULE }} />
          </div>

          {/* Instagram */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-fit font-display uppercase transition-opacity hover:opacity-70 mt-4"
            style={{ color: "#E1306C", letterSpacing: "0.22em", fontSize: "0.72rem" }}
          >
            <Instagram size={13} strokeWidth={1.5} />
            Instagram
          </a>
        </section>
      </div>

      {/* ── CRT intro ── */}
      {!crtDone && <CRTIntro onComplete={handleCRTDone} />}
    </main>
  );
}
