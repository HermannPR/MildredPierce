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

const SignalDropout = dynamic(
  () => import("@/components/ui/signal-dropout").then((m) => m.SignalDropout),
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

// ── Animated easter egg TV — static → eye (looking) → color bars ──
function EasterEggTV({ glitchRef }: { glitchRef: React.RefObject<boolean> }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const W = 48, H = 40;
    // Phase cycle: 0-59 static | 60-479 eye | 480-539 colors (~9s @30fps)
    const PHASE_CYCLE = 540;
    // Look: [dx, dy, hold_frames] — eerie deliberate movement
    const LOOK_SEQ: [number,number,number][] = [
      [ 0,  0, 90], [ 4,  0, 38], [ 0,  0, 50],
      [-4,  0, 32], [ 0,  0, 45], [ 0, -2, 28],
      [ 4, -2, 35], [ 0,  0,110], [-4,  2, 28],
      [ 0,  0, 65], [ 3,  0, 30], [ 0,  0, 80],
    ];
    let phase = 0, rafId = 0, lastT = 0;
    let lookStep = 0, lookCount = LOOK_SEQ[0][2], blinkTimer = 0;

    const bezel = () => {
      ctx.fillStyle = "#0b0b10"; ctx.fillRect(0, 0, W, 32);
      ctx.fillStyle = "#111118";
      ctx.fillRect(0, 0, W, 1); ctx.fillRect(0, 0, 1, 32);
      ctx.fillStyle = "#030306";
      ctx.fillRect(0, 31, W, 1); ctx.fillRect(W-1, 0, 1, 32);
      ctx.fillStyle = "#040810"; ctx.fillRect(3, 3, 42, 25);
      ctx.fillStyle = "#07070e"; ctx.fillRect(18, 32, 12, 4);
      ctx.fillStyle = "#050508"; ctx.fillRect(14, 36, 20, 4);
      ctx.fillStyle = "#003820"; ctx.fillRect(43, 29, 2, 1);
    };
    const scanlines = () => {
      ctx.globalAlpha = 0.22; ctx.fillStyle = "#000";
      for (let y = 3; y < 28; y += 2) ctx.fillRect(3, y, 42, 1);
      ctx.globalAlpha = 1;
    };
    const drawStatic = () => {
      for (let y = 3; y < 28; y++)
        for (let x = 3; x < 45; x++) {
          ctx.fillStyle = Math.random() > 0.5 ? "#3a5060" : "#010306";
          ctx.fillRect(x, y, 1, 1);
        }
    };
    const drawEye = (lx: number, ly: number, blink: boolean) => {
      // Eye white 38×19 at (5,5), corners cut 3×3
      ctx.fillStyle = "#6a8ea8"; ctx.fillRect(5, 5, 38, 19);
      ctx.fillStyle = "#040810";
      ctx.fillRect(5,5,3,3); ctx.fillRect(40,5,3,3);
      ctx.fillRect(5,21,3,3); ctx.fillRect(40,21,3,3);
      // Phosphor bloom
      ctx.globalAlpha = 0.06; ctx.fillStyle = "#6a8ea8";
      ctx.fillRect(4, 4, 40, 21); ctx.globalAlpha = 1;
      const cx = 24, cy = 14;
      if (blink) {
        ctx.fillStyle = "#6a8ea8"; ctx.fillRect(8, cy, 32, 2);
        ctx.fillStyle = "#040810";
        ctx.fillRect(8, 8, 32, cy-8); ctx.fillRect(8, cy+2, 32, 12);
      } else {
        // Iris 10×10
        ctx.fillStyle = "#0e2030"; ctx.fillRect(cx-5+lx, cy-5+ly, 10, 10);
        ctx.fillStyle = "#163040"; ctx.fillRect(cx-5+lx, cy-5+ly, 10, 1);
        ctx.fillStyle = "#1a3848"; ctx.fillRect(cx-5+lx, cy-4+ly,  1, 1);
        // Pupil 6×6
        ctx.fillStyle = "#010306"; ctx.fillRect(cx-3+lx, cy-3+ly, 6, 6);
        // Shine 2×2
        ctx.fillStyle = "#6a98c0"; ctx.fillRect(cx-3+lx, cy-3+ly, 2, 2);
      }
    };
    const drawColors = () => {
      const bars = ["#6a4800","#6a6a00","#006a6a","#006a10","#00106a","#6a006a","#6a1000"];
      const bw = Math.floor(42 / bars.length);
      bars.forEach((c,i) => { ctx.fillStyle=c; ctx.fillRect(3+i*bw,3,bw,25); });
    };

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (now - lastT < 34) return; // 30fps
      lastT = now;
      phase = (phase + 1) % PHASE_CYCLE;
      lookCount--; if (lookCount <= 0) { lookStep=(lookStep+1)%LOOK_SEQ.length; lookCount=LOOK_SEQ[lookStep][2]; }
      blinkTimer = (blinkTimer + 1) % 200;

      ctx.clearRect(0,0,W,H); bezel();
      if (glitchRef.current || phase < 60) drawStatic();
      else if (phase < 480) drawEye(LOOK_SEQ[lookStep][0], LOOK_SEQ[lookStep][1], blinkTimer >= 196);
      else drawColors();
      scanlines();
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [glitchRef]);

  // 48×40 canvas at 2× = 96×80 CSS px
  return <canvas ref={cvRef} width={48} height={40}
    style={{ display:"block", width:96, height:80, imageRendering:"pixelated", cursor:"crosshair" }} />;
}

export default function Home() {
  const [isFractal, setIsFractal] = useState(false);
  const [crtDone,   setCRTDone]   = useState(false);
  const [smokeHue,  setSmokeHue]  = useState("#001840");

  // Dead pixel easter egg
  const [pixelPos,     setPixelPos]     = useState({ x: 0, y: 0 });
  const [expandPhase,  setExpandPhase]  = useState<"idle" | "start" | "growing">("idle");
  const [expandOrigin, setExpandOrigin] = useState({ x: 0, y: 0 });
  const [teleportPhase, setTeleportPhase] = useState<"visible" | "out" | "in">("visible");
  const glitchRef      = useRef(false);
  const teleportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCRTDone = useCallback(() => setCRTDone(true), []);

  const handlePixelClick = useCallback((e: React.MouseEvent) => {
    if (expandPhase !== "idle") return;
    clearTimeout(teleportTimerRef.current);
    glitchRef.current = false;
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

  // Init: place easter egg slightly off-center on mount
  useEffect(() => {
    setPixelPos({
      x: Math.floor(window.innerWidth  * 0.42),
      y: Math.floor(window.innerHeight * 0.38),
    });
  }, []);

  // Schedule next teleport when visible
  useEffect(() => {
    if (teleportPhase !== "visible" || expandPhase !== "idle") return;
    const hold = 4000 + Math.random() * 5000;
    teleportTimerRef.current = setTimeout(() => {
      glitchRef.current = true;
      setTeleportPhase("out");
    }, hold);
    return () => clearTimeout(teleportTimerRef.current);
  }, [teleportPhase, expandPhase]);

  // Out: wait 300ms, jump to new pos, go to "in"
  useEffect(() => {
    if (teleportPhase !== "out") return;
    teleportTimerRef.current = setTimeout(() => {
      setPixelPos({
        x: Math.floor(window.innerWidth  * (0.20 + Math.random() * 0.55)),
        y: Math.floor(window.innerHeight * (0.18 + Math.random() * 0.54)),
      });
      glitchRef.current = false;
      setTeleportPhase("in");
    }, 300);
    return () => clearTimeout(teleportTimerRef.current);
  }, [teleportPhase]);

  // In: wait 300ms then mark visible again
  useEffect(() => {
    if (teleportPhase !== "in") return;
    teleportTimerRef.current = setTimeout(() => setTeleportPhase("visible"), 300);
    return () => clearTimeout(teleportTimerRef.current);
  }, [teleportPhase]);

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
          <div className="w-full px-4 md:px-6 lg:px-8">
            <div
              className="hidden md:block text-center mb-3"
              style={{ color: PARCHMENT, letterSpacing: "0.28em", fontSize: "0.58rem", fontFamily: "var(--font-display)", textTransform: "uppercase", opacity: 0.7 }}
            >
              Fractal Agreement — Official Video
            </div>
            <div style={{
              width: "100%", aspectRatio: "16/9",
              borderRadius: "3px",
              overflow: "hidden",
              boxShadow: "0 0 0 1px rgba(100,180,255,0.12), 0 0 40px rgba(0,100,200,0.22), 0 0 80px rgba(0,50,120,0.12)",
            }}>
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

        {/* ── Photo-forward hero — full-bleed band photo, content overlay ── */}
        <section className="
          order-1 md:order-1
          flex flex-col justify-end flex-1
          relative z-30
          overflow-hidden
          min-h-[75vw] md:min-h-0 md:h-full
        ">
          {/* Full-bleed band photo */}
          <Image
            src="/BandImage.jpeg"
            alt="Mildred Pierce"
            fill
            priority
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
          />

          {/* Gradient — dark at bottom where content lives, clears in upper half */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(2,10,24,0.18) 0%, rgba(2,10,24,0.08) 30%, rgba(2,10,24,0.72) 65%, rgba(2,10,24,0.97) 100%)",
          }} />

          {/* Right edge fade — blends into the dark video column */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, transparent 55%, rgba(2,10,24,0.88) 100%)",
          }} />

          {/* Content — anchored to bottom */}
          <div className="relative z-10 px-7 md:px-10 lg:px-14 pb-10 md:pb-14 pt-6">

            {/* Rule */}
            <div className="mb-5" style={{ height: 1, background: RULE }} />

            {/* Title */}
            <div className="relative" style={{ height: "clamp(90px, 17vw, 200px)" }}>
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

            {/* Release line */}
            <p
              className="font-display uppercase select-none"
              style={{ color: PARCHMENT, letterSpacing: "0.45em", fontSize: "clamp(0.44rem, 0.9vw, 0.56rem)", marginTop: "0.3rem", opacity: 0.6 }}
            >
              2026 — Debut Single
            </p>

            {/* Rule */}
            <div className="mt-6 mb-4" style={{ height: 1, background: RULE }} />

            {/* Listen label */}
            <p
              className="font-display uppercase select-none"
              style={{ color: STEEL, letterSpacing: "0.4em", fontSize: "0.5rem", marginBottom: "0.9rem", opacity: 0.65 }}
            >
              — Listen Now —
            </p>

            {/* Streaming buttons */}
            <div className="flex flex-col gap-[6px] max-w-sm">
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

            {/* Watch CTA — mobile only */}
            <GlassButton
              className="md:hidden self-start mt-4"
              size="sm"
              onClick={() => document.getElementById("music-video")?.scrollIntoView({ behavior: "smooth" })}
            >
              <span style={{ fontSize: "0.75rem" }}>▶</span>
              <span className="font-display uppercase" style={{ letterSpacing: "0.20em", fontSize: "0.65rem" }}>
                Play Track
              </span>
            </GlassButton>

          </div>
        </section>
      </div>

      {/* ── Dead pixel easter egg — teleport with glitch, click to expand → /game ── */}
      <div
        onClick={handlePixelClick}
        style={{
          position: "fixed",
          left: pixelPos.x,
          top:  pixelPos.y,
          zIndex: 50,
          opacity: expandPhase !== "idle" ? 0 : teleportPhase === "out" ? 0 : 0.28,
          transition: "opacity 0.28s",
        }}
        onMouseEnter={e => { if (expandPhase === "idle" && teleportPhase === "visible") (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
        onMouseLeave={e => { if (expandPhase === "idle") (e.currentTarget as HTMLElement).style.opacity = "0.28"; }}
      >
        <EasterEggTV glitchRef={glitchRef} />
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

      {/* ── Signal dropout — rare TV interference burst ── */}
      {crtDone && <SignalDropout />}

      {/* ── CRT intro ── */}
      {!crtDone && <CRTIntro onComplete={handleCRTDone} />}

      {/* ── Custom cursor ── */}
      <CustomCursor />
    </main>
  );
}
