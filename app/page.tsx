"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { Instagram, Youtube } from "lucide-react";
import { HoverMorphText } from "@/components/ui/hover-morph-text";
import { CRTIntro } from "@/components/ui/crt-intro";
import { GlassButton } from "@/components/ui/apple-tahoe-liquid-glass-button";

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

const CustomCursor = dynamic(
  () => import("@/components/ui/custom-cursor").then((m) => m.CustomCursor),
  { ssr: false }
);

const WaveformVisualizer = dynamic(
  () => import("@/components/ui/waveform-visualizer").then((m) => m.WaveformVisualizer),
  { ssr: false }
);

const YOUTUBE_ID      = "wGk5GWPWHzo";
const SPOTIFY_URL     = "https://open.spotify.com/intl-es/album/52QhMekZYeTTFNOx14Kkla?si=S4ldMHDxSMe-BuIdbfa0lg";
const YOUTUBE_URL     = "https://youtu.be/wGk5GWPWHzo?si=x5V0kTD6Rg8MN_Qp";
const APPLE_MUSIC_URL = "https://music.apple.com/mx/album/fractal-agreement-single/1896399020?l=en-GB";
const INSTAGRAM_URL   = "https://www.instagram.com/mildredpierce.__?igsh=MWRnOXZwZTZydzZteQ==";

const IVORY     = "#F5EDD5";
const PARCHMENT = "#C8B090";
const STEEL     = "rgba(180,196,208,0.80)";
const RULE      = "rgba(160,185,200,0.18)";

const TITLE_SIZE   = "clamp(2.1rem, 6.8vw, 6.2rem)";
const HOLD_MILDRED = 3000;
const HOLD_FRACTAL = 5000;
const MORPH_MS     = 1300;

function openLink(url: string) {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as Document & { startViewTransition: (cb: () => void) => void })
      .startViewTransition(() => { window.open(url, "_blank", "noopener,noreferrer"); });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ── Brand icons ───────────────────────────────────
function AppleMusicIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 3v10.46A4.5 4.5 0 1 0 12 18V7h6V3H8z"/>
    </svg>
  );
}

function SpotifyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
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
  return (
    <GlassButton
      className="w-full rounded-xl px-4 py-0"
      size="sm"
      disabled={disabled}
      glassColor={disabled ? "rgba(245,237,213,0.03)" : `${iconColor}18`}
      onClick={() => { if (href && !disabled) openLink(href); }}
    >
      <div className="flex items-center justify-between w-full min-h-[44px]">
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
          style={{ color: STEEL, letterSpacing: "0.18em", fontSize: "0.65rem" }}
        >
          {disabled ? "Soon" : "↗"}
        </span>
      </div>
    </GlassButton>
  );
}

// ── Tiny animated TV — static → eye → color bars ─────────────
function EasterEggTV() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const W = 32, H = 26;
    // Cycle: 90fr static | 180fr eye | 90fr colors = 360fr (~6s @ 60fps)
    const CYCLE = 360;
    const LOOK: [number,number][] = [[0,0],[2,0],[0,-1],[2,-1],[-2,0],[0,0],[-1,1],[0,0]];
    let f = 0, rafId = 0;

    const bezel = () => {
      ctx.fillStyle = "#0b0b10"; ctx.fillRect(0, 0, W, 20);
      ctx.fillStyle = "#040810"; ctx.fillRect(2, 2, 28, 15);
      ctx.fillStyle = "#07070e"; ctx.fillRect(13,20, 6, 3);
      ctx.fillStyle = "#050508"; ctx.fillRect(10,23,12, 3);
      ctx.fillStyle = "#003820"; ctx.fillRect(28,18, 2, 1);
    };
    const scanlines = () => {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      for (let y = 2; y < 17; y += 2) ctx.fillRect(2, y, 28, 1);
      ctx.globalAlpha = 1;
    };
    const drawStatic = () => {
      for (let y = 2; y < 17; y++)
        for (let x = 2; x < 30; x++) {
          ctx.fillStyle = Math.random() > 0.5 ? "#4a6070" : "#020408";
          ctx.fillRect(x, y, 1, 1);
        }
    };
    const drawEye = (ef: number) => {
      const blink = ef % 100 > 95;
      const [lx, ly] = LOOK[Math.floor(ef / 22) % LOOK.length];
      ctx.fillStyle = "#6a8ea8"; ctx.fillRect(5, 3, 20, 10);
      // cut corners
      ctx.fillStyle = "#040810";
      ctx.fillRect(5,3,2,2); ctx.fillRect(23,3,2,2);
      ctx.fillRect(5,11,2,2); ctx.fillRect(23,11,2,2);
      if (blink) {
        ctx.fillStyle = "#6a8ea8"; ctx.fillRect(5, 7, 20, 2);
        ctx.fillStyle = "#040810"; ctx.fillRect(5,3,20,4); ctx.fillRect(5,9,20,4);
      } else {
        const cx = 14, cy = 7;
        ctx.fillStyle = "#0e2030"; ctx.fillRect(cx+lx-1,cy+ly-1,5,5);
        ctx.fillStyle = "#163040"; ctx.fillRect(cx+lx-1,cy+ly-1,5,1);
        ctx.fillStyle = "#010306"; ctx.fillRect(cx+lx,  cy+ly,  3,3);
        ctx.fillStyle = "#6a98c0"; ctx.fillRect(cx+lx,  cy+ly,  1,1);
      }
    };
    const drawColors = () => {
      const bars = ["#7a5000","#7a7a00","#007a7a","#007a10","#00107a","#7a007a","#7a1000"];
      const bw = Math.floor(28 / bars.length);
      bars.forEach((c,i) => { ctx.fillStyle=c; ctx.fillRect(2+i*bw,2,bw,15); });
    };

    const loop = () => {
      f = (f + 1) % CYCLE;
      ctx.clearRect(0,0,W,H);
      bezel();
      if      (f < 90)  drawStatic();
      else if (f < 270) drawEye(f - 90);
      else              drawColors();
      scanlines();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return <canvas ref={cvRef} width={32} height={26}
    style={{ display:"block", width:64, height:52, imageRendering:"pixelated", cursor:"crosshair" }} />;
}

export default function Home() {
  const [isFractal, setIsFractal] = useState(false);
  const [crtDone,   setCRTDone]   = useState(false);
  const [smokeHue,  setSmokeHue]  = useState("#001840");

  // Dead pixel easter egg
  const [pixelPos,     setPixelPos]     = useState({ x: 0, y: 0 });
  const [expandPhase,  setExpandPhase]  = useState<"idle" | "start" | "growing">("idle");
  const [expandOrigin, setExpandOrigin] = useState({ x: 0, y: 0 });
  const dirRef      = useRef({ dx: 1, dy: 1 });
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCRTDone = useCallback(() => setCRTDone(true), []);

  const handlePixelClick = useCallback((e: React.MouseEvent) => {
    if (expandPhase !== "idle") return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setExpandOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setExpandPhase("start");
  }, [expandPhase]);

  // Smoke hue shift — breathes between crimson and dark burgundy every 12s
  useEffect(() => {
    const hues = ["#001840", "#000d28", "#002060", "#001030"];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % hues.length;
      setSmokeHue(hues[i]);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  // Pixel-grid walk — steps one cell at a time, bounces off edges
  useEffect(() => {
    if (expandPhase !== "idle") return;
    const GRID = 32;
    const STEP = 380;

    // Start slightly off-center — curious but not dead-center
    setPixelPos({
      x: Math.floor((window.innerWidth  * 0.42) / GRID) * GRID,
      y: Math.floor((window.innerHeight * 0.36) / GRID) * GRID,
    });

    const step = () => {
      setPixelPos(prev => {
        let { dx, dy } = dirRef.current;
        if (Math.random() < 0.20) {
          if (Math.random() < 0.5) dx = -dx;
          else                     dy = -dy;
        }
        let x = prev.x + dx * GRID;
        let y = prev.y + dy * GRID;
        // Constrain to center band: 20–75% width, 18–72% height
        const minX = Math.floor((window.innerWidth  * 0.20) / GRID) * GRID;
        const minY = Math.floor((window.innerHeight * 0.18) / GRID) * GRID;
        const maxX = Math.floor((window.innerWidth  * 0.75) / GRID) * GRID;
        const maxY = Math.floor((window.innerHeight * 0.72) / GRID) * GRID;
        if (x < minX) { x = minX; dx =  1; }
        if (y < minY) { y = minY; dy =  1; }
        if (x > maxX) { x = maxX; dx = -1; }
        if (y > maxY) { y = maxY; dy = -1; }
        dirRef.current = { dx, dy };
        return { x, y };
      });
      jumpTimerRef.current = setTimeout(step, STEP);
    };
    jumpTimerRef.current = setTimeout(step, STEP);
    return () => clearTimeout(jumpTimerRef.current);
  }, [expandPhase]);

  // Expand phase 1→2: one double-rAF so the start circle renders before transition kicks in
  useEffect(() => {
    if (expandPhase !== "start") return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setExpandPhase("growing"))
    );
    return () => cancelAnimationFrame(id);
  }, [expandPhase]);

  // Navigate after expand fills screen
  useEffect(() => {
    if (expandPhase !== "growing") return;
    const id = setTimeout(() => { window.location.href = "/game"; }, 720);
    return () => clearTimeout(id);
  }, [expandPhase]);

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
    <main className="relative w-full min-h-screen overflow-x-hidden md:h-screen md:overflow-hidden">

      {/* ── Background ─────────────────────────────────── */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: "#020a18" }}>
        <SmokeBackground smokeColor={smokeHue} />
      </div>

      {/* VHS static */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{ mixBlendMode: "screen", opacity: 0.28 }}
      >
        <VHSBackground className="w-full h-full" />
      </div>

      {/* Waveform — decorative background layer synced with fractal depth */}
      <div
        className="fixed inset-x-0 bottom-0 z-[3] pointer-events-none"
        style={{ mixBlendMode: "screen", opacity: 0.35, height: "80px" }}
      >
        <WaveformVisualizer opacity={1} />
      </div>

      {/* Fractal rings — electric blue ambient layer, breathing */}
      <div
        className="fixed inset-0 z-[4] pointer-events-none"
        style={{ mixBlendMode: "screen", animation: "bg-breathe 8s ease-in-out infinite" }}
      >
        <ShaderAnimation className="w-full h-full" />
      </div>

      {/* Edge blue bleed + vignette */}
      <div
        className="fixed inset-0 z-[6] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%,
            transparent 28%,
            rgba(0,80,160,0.28) 65%,
            rgba(1,4,18,0.88) 100%)`,
        }}
      />

      {/* ── Content ────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col md:flex-row w-full md:h-full">

        {/* ── Video — bottom on mobile, right on desktop ── */}
        <section id="music-video" className="
          order-2 md:order-2
          w-full md:w-[42%] lg:w-[46%]
          flex-shrink-0 relative
          flex items-center justify-center
          overflow-hidden
          h-[56vw] md:h-full
        ">
          <div className="w-full">
            <div
              className="hidden md:block text-center mb-2"
              style={{ color: PARCHMENT, letterSpacing: "0.22em", fontSize: "0.65rem", fontFamily: "var(--font-display)", textTransform: "uppercase" }}
            >
              Fractal Agreement
            </div>
            <div style={{ width: "100%", aspectRatio: "16/9" }}>
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?rel=0&modestbranding=1&color=white`}
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title="Fractal Agreement — Mildred Pierce"
              />
            </div>
          </div>
        </section>

        {/* ── Editorial content — top on mobile, left on desktop ── */}
        <section className="
          order-1 md:order-1
          flex flex-col justify-center flex-1
          px-6 md:px-10 lg:px-16
          pt-6 pb-4 md:py-0
          gap-0
          relative z-30
        ">

          {/* Top rule */}
          <div className="mb-3 md:mb-8" style={{ height: 1, background: RULE }} />

          {/* Title */}
          <div className="relative" style={{ height: "clamp(100px, 18vw, 210px)" }}>
            <HoverMorphText
              from="MILDRED PIERCE"
              to="FRACTAL AGREEMENT"
              isActive={isFractal}
              color={IVORY}
              fontSize={TITLE_SIZE}
              className="absolute inset-0"
              textClassName="font-display leading-tight tracking-[0.14em] w-full"
            />
          </div>

          {/* Release date */}
          <p
            className="font-display uppercase select-none"
            style={{
              color: STEEL,
              letterSpacing: "0.45em",
              fontSize: "clamp(0.48rem, 1vw, 0.62rem)",
              marginTop: "0.6rem",
            }}
          >
            2026 — Debut Single
          </p>

          {/* Bottom rule */}
          <div className="mt-3 md:mt-8" style={{ height: 1, background: RULE }} />

          {/* ── Streaming platforms — two-column ── */}
          <div className="flex items-start gap-4 pt-4 pb-1">

            {/* Band photo */}
            <div
              style={{
                position: "relative",
                width: 160, height: 160,
                borderRadius: "4px",
                overflow: "hidden",
                flexShrink: 0,
                border: "1px solid rgba(245,237,213,0.18)",
                boxShadow: "0 0 32px rgba(0,200,255,0.25)",
              }}
            >
              <Image src="/BandImage.jpeg" alt="Mildred Pierce" fill style={{ objectFit: "cover" }} />
            </div>

            {/* Descriptor + buttons */}
            <div className="flex flex-col flex-1 gap-2">
              <div className="flex flex-col gap-[3px]">
                <span
                  className="font-display uppercase select-none"
                  style={{ color: IVORY, letterSpacing: "0.18em", fontSize: "0.72rem" }}
                >
                  Mildred Pierce
                </span>
                <span
                  className="font-display uppercase select-none"
                  style={{ color: PARCHMENT, letterSpacing: "0.16em", fontSize: "0.65rem" }}
                >
                  Debut Single: Fractal Agreement
                </span>
                <span
                  className="font-display uppercase select-none"
                  style={{ color: PARCHMENT, letterSpacing: "0.22em", fontSize: "0.65rem", opacity: 0.7 }}
                >
                  Enter the signal.
                </span>
              </div>

              <PlatformLink
                href={SPOTIFY_URL}
                icon={<SpotifyIcon />}
                label="Spotify"
                iconColor="#1DB954"
              />
              <PlatformLink
                href={YOUTUBE_URL}
                icon={<Youtube size={13} strokeWidth={0} fill="currentColor" />}
                label="YouTube"
                iconColor="#00c8ff"
              />
              <PlatformLink
                href={APPLE_MUSIC_URL}
                icon={<AppleMusicIcon />}
                label="Apple Music"
                iconColor="#00c8ff"
              />
              <PlatformLink
                href={INSTAGRAM_URL}
                icon={<Instagram size={13} strokeWidth={1.5} />}
                label="Instagram"
                iconColor="#E1306C"
              />
            </div>
          </div>

          {/* Watch CTA — mobile only */}
          <GlassButton
            className="md:hidden self-start mt-3"
            size="sm"
            onClick={() => document.getElementById("music-video")?.scrollIntoView({ behavior: "smooth" })}
          >
            <span style={{ fontSize: "0.75rem" }}>▶</span>
            <span className="font-display uppercase" style={{ letterSpacing: "0.20em", fontSize: "0.65rem" }}>
              Play Track
            </span>
          </GlassButton>


        </section>
      </div>

      {/* ── Dead pixel easter egg — pixel-grid walk, click to expand → /game ── */}
      <div
        onClick={handlePixelClick}
        style={{
          position: "fixed",
          left: pixelPos.x,
          top:  pixelPos.y,
          zIndex: 50,
          opacity: expandPhase !== "idle" ? 0 : 0.28,
          transition: "opacity 0.3s",
        }}
        onMouseEnter={e => { if (expandPhase === "idle") (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
        onMouseLeave={e => { if (expandPhase === "idle") (e.currentTarget as HTMLElement).style.opacity = "0.28"; }}
      >
        <EasterEggTV />
      </div>

      {/* Expand overlay — dark circle floods screen on click */}
      {expandPhase !== "idle" && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9990,
          background: "#020a18",
          clipPath: expandPhase === "growing"
            ? `circle(200vmax at ${expandOrigin.x}px ${expandOrigin.y}px)`
            : `circle(8px at ${expandOrigin.x}px ${expandOrigin.y}px)`,
          transition: expandPhase === "growing" ? "clip-path 0.65s ease-in" : "none",
        }} />
      )}

      {/* ── CRT intro ── */}
      {!crtDone && <CRTIntro onComplete={handleCRTDone} />}

      {/* ── Custom cursor ── */}
      <CustomCursor />
    </main>
  );
}
