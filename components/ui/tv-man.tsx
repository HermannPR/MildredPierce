"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── State machine ─────────────────────────────────────────────────────────────
type Phase =
  | "idle"
  | "zooming"
  | "detuned"
  | "locking"   // 3s full static → 4s gradual clear
  | "synced"    // clean audio, 20s
  | "jitter"
  | "shutoff"
  | "booting";

// ── Constants ─────────────────────────────────────────────────────────────────
const SYNC_ZONE     = 28;    // ±° from target = in zone
const KNOB_MAX      = 270;
const MUSIC_MS      = 20000; // 20s clean music
const JITTER_MS     = 1400;
const SHUTOFF_MS    = 900;
const BOOT_MS       = 2400;
const ZONE_WAIT_MS  = 3000;  // hold in zone before clearing starts
const LOCK_CLEAR_MS = 4000;  // static clearing duration

// Eye frame hold times (ms) per spec
const FRAME_HOLDS = [500, 200, 200, 200, 200, 300, 400, 200, 200, 300, 400, 500];

// Screen area within tvheadonly.png — inset from bezel edges
const SCR_LEFT   = "25%";
const SCR_TOP    = "21%";
const SCR_WIDTH  = "50%";
const SCR_HEIGHT = "30%";

// ── Helpers ───────────────────────────────────────────────────────────────────
const clampKnob = (a: number) => Math.max(0, Math.min(KNOB_MAX, a));

function randTarget() {
  return SYNC_ZONE + Math.floor(Math.random() * (KNOB_MAX + 1 - 2 * SYNC_ZONE));
}
function shiftTarget(prev: number) {
  let next: number;
  do { next = randTarget(); } while (Math.abs(next - prev) < 60);
  return next;
}

// ── WebAudio ──────────────────────────────────────────────────────────────────
function buildNoise(ctx: AudioContext) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const filt = ctx.createBiquadFilter();
  filt.type  = "bandpass";
  filt.frequency.value = 2100;
  filt.Q.value = 0.45;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
  src.start();
  return { gain };
}

function makeDistortCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 512, curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ── Smoke puff ────────────────────────────────────────────────────────────────
function SmokePuff({ left, top, delay }: { left: string; top: string; delay: string }) {
  return (
    <div
      className="absolute pointer-events-none rounded-full"
      style={{
        left, top,
        width: "5%", aspectRatio: "1",
        backgroundColor: "rgba(160,160,160,0.65)",
        animation: `smokeLoop 1.1s ease-out ${delay} infinite`,
      }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TVMan() {
  const [phase,       setPhase]       = useState<Phase>("idle");
  const [knobAngle,   setKnobAngle]   = useState(135);
  const [target,      setTarget]      = useState(randTarget);
  const [syncedFrame, setSyncedFrame] = useState(0);
  const [jitter,      setJitter]      = useState({ x: 0, y: 0, r: 0 });

  const dist      = Math.abs(knobAngle - target);
  const proximity = Math.max(0, 1 - dist / SYNC_ZONE);
  const inZone    = dist <= SYNC_ZONE;

  // ── Audio refs ─────────────────────────────────────────────────────────────
  const ctxRef       = useRef<AudioContext | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  // Song chain: src → waveshaper → bandpass → gain → destination
  const songBufRef   = useRef<AudioBuffer | null>(null);
  const songSrcRef   = useRef<AudioBufferSourceNode | null>(null);
  const distortRef   = useRef<WaveShaperNode | null>(null);
  const songFiltRef  = useRef<BiquadFilterNode | null>(null);
  const songGainRef  = useRef<GainNode | null>(null);

  // ── Swipe ──────────────────────────────────────────────────────────────────
  const swipeRef = useRef({ active: false, lastX: 0 });

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const eyeCanvasRef  = useRef<HTMLCanvasElement>(null);
  const lockCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef(0);
  const lockRafRef    = useRef(0);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIvRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── Start distorted song ──────────────────────────────────────────────────
  const startSong = useCallback((decoded: AudioBuffer) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }

    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.loop   = true;

    const distort = ctx.createWaveShaper();
    distort.curve       = makeDistortCurve(400);
    distort.oversample  = "4x";

    const filt = ctx.createBiquadFilter();
    filt.type  = "bandpass";
    filt.frequency.value = 1800;
    filt.Q.value = 4.0;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    src.connect(distort); distort.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    const slack = Math.max(0, decoded.duration - 25);
    src.start(0, Math.random() * slack);

    songSrcRef.current  = src;
    distortRef.current  = distort;
    songFiltRef.current = filt;
    songGainRef.current = gain;
  }, []);

  // ── Audio init ────────────────────────────────────────────────────────────
  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    const { gain } = buildNoise(ctx);
    noiseGainRef.current = gain;
  }, []);

  // ── Open ──────────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    initAudio();
    setPhase("zooming");

    const ctx = ctxRef.current;
    if (ctx) {
      const canOpus = document.createElement("audio").canPlayType("audio/webm; codecs=opus") !== "";
      fetch("/api/audio", { headers: { Accept: canOpus ? "audio/webm" : "audio/mpeg" } })
        .then(r => r.arrayBuffer())
        .then(buf => ctx.decodeAudioData(buf))
        .then(decoded => { songBufRef.current = decoded; startSong(decoded); })
        .catch(() => {});
    }

    setTimeout(() => setPhase("detuned"), 560);
  }, [initAudio, startSong]);

  // ── Close ─────────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    clearT();
    if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
    if (clearIvRef.current)   { clearInterval(clearIvRef.current);  clearIvRef.current = null; }
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(lockRafRef.current);

    const c = ctxRef.current;
    if (noiseGainRef.current && c) noiseGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.1);
    if (songGainRef.current   && c) songGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.2);
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }

    setPhase("idle");
  }, [clearT]);

  // ── Noise volume by phase ─────────────────────────────────────────────────
  useEffect(() => {
    const g = noiseGainRef.current, c = ctxRef.current;
    if (!g || !c) return;
    const vol =
      phase === "detuned"  ? (1 - proximity) * 0.5 :
      phase === "locking"  ? 0.35 :
      phase === "jitter"   ? 0.6  :
      phase === "booting"  ? 0.45 :
      0;
    g.gain.setTargetAtTime(vol, c.currentTime, 0.07);
  }, [proximity, phase]);

  // ── Zone detection: hold 3s → locking ────────────────────────────────────
  useEffect(() => {
    if (phase !== "detuned") {
      if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
      return;
    }
    if (!inZone) {
      if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
      return;
    }
    if (zoneTimerRef.current) return; // already waiting

    zoneTimerRef.current = setTimeout(() => {
      zoneTimerRef.current = null;
      setPhase("locking");

      // Progressive audio clearing over LOCK_CLEAR_MS
      const clearStart = performance.now();
      clearIvRef.current = setInterval(() => {
        const p = Math.min((performance.now() - clearStart) / LOCK_CLEAR_MS, 1);
        if (distortRef.current)  distortRef.current.curve = makeDistortCurve(400 * (1 - p));
        if (songFiltRef.current) {
          songFiltRef.current.Q.value          = 4.0 - 3.7 * p;        // narrow → wide
          songFiltRef.current.frequency.value  = 1800 + 2200 * p;      // boost toward full range
        }
        if (songGainRef.current && ctxRef.current)
          songGainRef.current.gain.setTargetAtTime(0.05 + 0.7 * p, ctxRef.current.currentTime, 0.05);
        if (p >= 1) { if (clearIvRef.current) { clearInterval(clearIvRef.current); clearIvRef.current = null; } }
      }, 50);

      clearT();
      timerRef.current = setTimeout(() => {
        setPhase("synced");

        timerRef.current = setTimeout(() => {
          // Fade song out before jitter
          if (songGainRef.current && ctxRef.current)
            songGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.4);
          setPhase("jitter");

          timerRef.current = setTimeout(() => {
            setPhase("shutoff");

            timerRef.current = setTimeout(() => {
              // Reset song to distorted for next round
              if (songBufRef.current) startSong(songBufRef.current);
              setPhase("booting");
              setTarget(prev => shiftTarget(prev));

              timerRef.current = setTimeout(() => setPhase("detuned"), BOOT_MS);
            }, SHUTOFF_MS);
          }, JITTER_MS);
        }, MUSIC_MS);
      }, LOCK_CLEAR_MS);
    }, ZONE_WAIT_MS);

    return () => {
      if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inZone, phase]);

  // ── Eye canvas: detuned / jitter / booting ────────────────────────────────
  useEffect(() => {
    const canvas = eyeCanvasRef.current;
    if (!canvas) return;
    const active = phase === "detuned" || phase === "jitter" || phase === "booting";
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) return;
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const { width: W, height: H } = canvas;
      const id = ctx2.createImageData(W, H);
      const d  = id.data;
      // Subtle — eye always visible through static
      const a =
        phase === "booting" ? 100 :
        phase === "jitter"  ? 110 :
        Math.round(85 * (1 - 0.5 * proximity));
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v; d[i+3] = a;
      }
      ctx2.putImageData(id, 0, 0);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, proximity]);

  // ── Lock canvas: locking — 3s full → 4s gradual clear ────────────────────
  useEffect(() => {
    const canvas = lockCanvasRef.current;
    if (!canvas || phase !== "locking") {
      cancelAnimationFrame(lockRafRef.current);
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) return;
    const lockStart = performance.now();
    const draw = () => {
      lockRafRef.current = requestAnimationFrame(draw);
      const { width: W, height: H } = canvas;
      const id = ctx2.createImageData(W, H);
      const d  = id.data;
      const elapsed = performance.now() - lockStart;
      let alpha: number;
      if (elapsed < ZONE_WAIT_MS) {
        alpha = 110;
      } else {
        const p = Math.min((elapsed - ZONE_WAIT_MS) / LOCK_CLEAR_MS, 1);
        alpha = Math.round(110 - 98 * p); // 110 → 12
      }
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v; d[i+3] = alpha;
      }
      ctx2.putImageData(id, 0, 0);
    };
    draw();
    return () => cancelAnimationFrame(lockRafRef.current);
  }, [phase]);

  // ── Preload eye frames on zoom ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "zooming") return;
    for (let i = 1; i <= 12; i++) {
      const img = new window.Image();
      img.src = `/tv/eye/frame${String(i).padStart(2, "0")}.png`;
    }
  }, [phase]);

  // ── Eye frame cycle during synced ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "synced") {
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      setSyncedFrame(0);
      return;
    }
    let idx = 0;
    const step = () => {
      idx = (idx + 1) % FRAME_HOLDS.length;
      setSyncedFrame(idx);
      setJitter({
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4,
        r: (Math.random() - 0.5) * 0.7,
      });
      syncTimerRef.current = setTimeout(step, FRAME_HOLDS[idx]);
    };
    syncTimerRef.current = setTimeout(step, FRAME_HOLDS[0]);
    return () => { if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; } };
  }, [phase]);

  // ── ESC to close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "idle") return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, close]);

  // ── Swipe-anywhere drag ───────────────────────────────────────────────────
  const onSwipeDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (phase !== "detuned") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeRef.current = { active: true, lastX: e.clientX };
  }, [phase]);

  const onSwipeMove = useCallback((e: React.PointerEvent) => {
    if (!swipeRef.current.active) return;
    const dx = e.clientX - swipeRef.current.lastX;
    setKnobAngle(p => clampKnob(p + dx * 0.7));
    swipeRef.current.lastX = e.clientX;
  }, []);

  const onSwipeUp = useCallback(() => { swipeRef.current.active = false; }, []);

  // ── Visual state ──────────────────────────────────────────────────────────
  const showOverlay = phase !== "idle" && phase !== "zooming";
  const darkScreen  = phase === "shutoff" || phase === "booting";
  const showSmoke   = phase === "locking" || phase === "shutoff";
  const visualKnob  = knobAngle - 135;

  return (
    <>
      {/* ── Easter egg trigger ────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-1/2 z-30 select-none"
        style={{
          width:           "9vh",
          transform:       phase === "zooming" ? "translateX(-50%) scale(18)" : "translateX(-50%) scale(1)",
          transformOrigin: "50% 12%",
          opacity:         phase === "idle" ? 1 : 0,
          transition:      "transform 0.52s ease-in, opacity 0.3s ease-in",
          pointerEvents:   phase === "idle" ? "auto" : "none",
          cursor:          "pointer",
        }}
        onClick={open}
        title="..."
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tv/tvmannfullbody.png"
          alt=""
          draggable={false}
          style={{
            width:        "100%",
            height:       "auto",
            filter:       "invert(1) drop-shadow(0 0 8px rgba(180,50,50,0.6))",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* ── Full-screen overlay ───────────────────────────────────────────── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: "#050505",
            animation:       "tvFadeIn 0.4s ease-out",
            touchAction:     "none",
            cursor:          phase === "detuned" ? "ew-resize" : "default",
          }}
          onPointerDown={onSwipeDown}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeUp}
          onPointerCancel={onSwipeUp}
        >
          {/* Grain texture */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity:         0.04,
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
              backgroundSize:  "256px 256px",
              mixBlendMode:    "overlay",
              zIndex:          60,
            }}
          />

          {/* TV centered — fills 82% of shortest viewport dimension */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative pointer-events-none"
              style={{ width: "min(82vw, 82vh)", aspectRatio: "1" }}
            >
              {/* TV head — fades during synced */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tv/tvheadonly.png"
                alt="TV"
                draggable={false}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{
                  animation:  phase === "jitter" ? "tvJitter 0.09s infinite" : undefined,
                  opacity:    phase === "synced" ? 0 : 1,
                  transition: "opacity 0.4s ease",
                }}
              />

              {/* Eye frame animation — synced */}
              {phase === "synced" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/tv/eye/frame${String(syncedFrame + 1).padStart(2, "0")}.png`}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  style={{
                    transform:  `translate(${jitter.x}px, ${jitter.y}px) rotate(${jitter.r}deg)`,
                    transition: "transform 0.06s ease-out",
                    clipPath:   "inset(8% 0 0 0)",
                  }}
                />
              )}

              {/* ── CRT screen area ──────────────────────────────────────── */}

              {/* Static — detuned / jitter / booting */}
              <canvas
                ref={eyeCanvasRef}
                width={128}
                height={96}
                className="absolute pointer-events-none"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  imageRendering: "pixelated",
                  borderRadius:   "3px",
                  opacity:    phase === "synced" || phase === "locking" ? 0 : 1,
                  transition: "opacity 0.55s ease",
                }}
              />

              {/* Static — locking (gradual clear) */}
              <canvas
                ref={lockCanvasRef}
                width={64}
                height={64}
                className="absolute pointer-events-none"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  imageRendering: "pixelated",
                  borderRadius:   "3px",
                  opacity:    phase === "locking" ? 1 : 0,
                  transition: "opacity 0.35s ease",
                }}
              />

              {/* CRT scanlines */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  borderRadius: "3px",
                  background:   "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
                  zIndex:       2,
                }}
              />

              {/* CRT vignette + edge darkening */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  borderRadius: "4px",
                  boxShadow:    "inset 0 0 22px rgba(0,0,0,0.75), 0 0 22px rgba(160,200,160,0.07), 0 0 55px rgba(120,170,120,0.04)",
                  zIndex:       3,
                }}
              />

              {/* Boot scan line */}
              {phase === "booting" && (
                <div
                  className="absolute pointer-events-none overflow-hidden"
                  style={{ left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT, borderRadius: "3px", zIndex: 4 }}
                >
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: "3px",
                    backgroundColor: "rgba(255,255,255,0.45)",
                    animation: "scanSweep 0.9s ease-in forwards",
                  }} />
                </div>
              )}

              {/* Dark screen — shutoff / boot */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  borderRadius:    "3px",
                  backgroundColor: "#000",
                  zIndex:          5,
                  opacity:    darkScreen ? (phase === "booting" ? 0.6 : 1) : 0,
                  transition: phase === "shutoff" ? "opacity 0.35s ease-in" : "opacity 0.7s ease-out",
                }}
              />

              {/* Smoke */}
              {showSmoke && (
                <>
                  <SmokePuff left="47%" top="20%" delay="0s"    />
                  <SmokePuff left="28%" top="42%" delay="0.35s" />
                  <SmokePuff left="66%" top="38%" delay="0.7s"  />
                </>
              )}

              {/* Knob */}
              <div
                className="absolute pointer-events-none"
                style={{ left: "24%", top: "62%", width: "11%", aspectRatio: "1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobbackpart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobtopart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none"
                  style={{ transform: `rotate(${visualKnob}deg)`, transformOrigin: "50% 50%" }} />
              </div>

              {/* Light — dim dark crimson, barely visible */}
              <div
                className="absolute pointer-events-none rounded-full"
                style={{
                  left:            "35%", top: "63%",
                  width:           "1.4%", aspectRatio: "1",
                  backgroundColor: phase === "synced" ? "#0a2a0a" : "#1a0404",
                  boxShadow:       phase === "synced" ? "0 0 4px 1px #0a2a0a88" : "0 0 3px 1px #1a040488",
                  transition:      "background-color 1s ease, box-shadow 1s ease",
                  animation:       phase === "locking" ? "lightPulse 0.55s ease-in-out infinite" : undefined,
                }}
              />

              {/* X — nearly invisible, ESC also works */}
              <button
                onClick={close}
                className="absolute pointer-events-auto top-[4%] right-[4%]
                           flex items-center justify-center w-7 h-7
                           text-3xl font-thin transition-opacity"
                style={{ color: "rgba(255,255,255,0.08)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.08)")}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
