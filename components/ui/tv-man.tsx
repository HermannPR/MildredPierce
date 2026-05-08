"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── State machine ─────────────────────────────────────────────────────────────
type Phase =
  | "idle"
  | "zooming"
  | "detuned"
  | "locking"
  | "synced"
  | "jitter"
  | "shutoff"
  | "booting";

// ── Constants ─────────────────────────────────────────────────────────────────
const SYNC_ZONE     = 28;
const KNOB_MAX      = 270;
const MUSIC_MS      = 20000;
const JITTER_MS     = 1400;
const SHUTOFF_MS    = 900;
const BOOT_MS       = 2400;
const ZONE_WAIT_MS  = 3000;
const LOCK_CLEAR_MS = 4000;

const FRAME_HOLDS = [500, 200, 200, 200, 200, 300, 400, 200, 200, 300, 400, 500];

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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  const songBufRef   = useRef<AudioBuffer | null>(null);
  const songSrcRef   = useRef<AudioBufferSourceNode | null>(null);
  const distortRef   = useRef<WaveShaperNode | null>(null);
  const songFiltRef  = useRef<BiquadFilterNode | null>(null);
  const songGainRef  = useRef<GainNode | null>(null);

  // ── Swipe ──────────────────────────────────────────────────────────────────
  const swipeRef = useRef({ active: false, lastX: 0 });

  // ── Unified CRT canvas ────────────────────────────────────────────────────
  const crtCanvasRef      = useRef<HTMLCanvasElement>(null);
  const crtRafRef         = useRef(0);
  const phaseRef          = useRef<Phase>("idle");
  const proximityRef      = useRef(0);
  const lockPhaseStartRef = useRef(0);
  const bootStartRef      = useRef(0);
  const shutoffStartRef   = useRef(0);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIvRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── startSong ─────────────────────────────────────────────────────────────
  const startSong = useCallback((decoded: AudioBuffer) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }

    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.loop   = true;

    const distort = ctx.createWaveShaper();
    distort.curve      = makeDistortCurve(400);
    distort.oversample = "4x";

    const filt = ctx.createBiquadFilter();
    filt.type            = "bandpass";
    filt.frequency.value = 1800;
    filt.Q.value         = 4.0;

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

  // ── initAudio ─────────────────────────────────────────────────────────────
  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    const { gain } = buildNoise(ctx);
    noiseGainRef.current = gain;
  }, []);

  // ── open ──────────────────────────────────────────────────────────────────
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

  // ── close ─────────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    clearT();
    if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
    if (clearIvRef.current)   { clearInterval(clearIvRef.current);  clearIvRef.current = null; }
    cancelAnimationFrame(crtRafRef.current);

    const c = ctxRef.current;
    if (noiseGainRef.current && c) noiseGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.1);
    if (songGainRef.current   && c) songGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.2);
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }

    setPhase("idle");
  }, [clearT]);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "shutoff") shutoffStartRef.current = performance.now();
    if (phase === "booting") bootStartRef.current    = performance.now();
  }, [phase]);

  useEffect(() => { proximityRef.current = proximity; }, [proximity]);

  // ── Unified CRT canvas RAF ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = crtCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Small offscreen canvas — scaled up for chunky analog pixel look
    const nc = document.createElement("canvas");
    nc.width = 32; nc.height = 24;
    const nCtx = nc.getContext("2d")!;

    const draw = () => {
      crtRafRef.current = requestAnimationFrame(draw);
      const phase = phaseRef.current;
      const { width: W, height: H } = canvas;

      ctx.clearRect(0, 0, W, H);
      if (phase === "idle" || phase === "zooming") return;

      // Clip all drawing to CRT rounded shape
      ctx.save();
      roundRectPath(ctx, 0, 0, W, H, 5);
      ctx.clip();

      // ── Compute noise alpha ─────────────────────────────────────────────
      let noiseAlpha = 0;
      if (phase === "detuned") {
        noiseAlpha = 0.5 * (1 - 0.42 * proximityRef.current);
      } else if (phase === "locking") {
        const elapsed = performance.now() - lockPhaseStartRef.current;
        noiseAlpha = 0.5 * Math.max(0, 1 - elapsed / LOCK_CLEAR_MS);
      } else if (phase === "jitter") {
        noiseAlpha = 0.72;
      } else if (phase === "booting") {
        noiseAlpha = 0.48;
      }

      // ── Draw chunky analog noise ────────────────────────────────────────
      if (noiseAlpha > 0.01) {
        const nId = nCtx.createImageData(32, 24);
        const d = nId.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
        }
        nCtx.putImageData(nId, 0, 0);
        ctx.globalAlpha = noiseAlpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(nc, 0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
      }

      // ── Phosphor scanlines (always part of CRT surface) ─────────────────
      ctx.fillStyle = "rgba(0,0,0,0.13)";
      for (let y = 2; y < H; y += 4) ctx.fillRect(0, y, W, 2);

      // ── Vignette / phosphor bloom ───────────────────────────────────────
      const vg = ctx.createRadialGradient(
        W * 0.5, H * 0.42, W * 0.06,
        W * 0.5, H * 0.52, W * 0.84
      );
      vg.addColorStop(0,    "rgba(0,0,0,0)");
      vg.addColorStop(0.45, "rgba(0,0,0,0.05)");
      vg.addColorStop(1,    "rgba(0,0,0,0.72)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // ── Screen state overlays ───────────────────────────────────────────
      if (phase === "shutoff") {
        const p = Math.min((performance.now() - shutoffStartRef.current) / SHUTOFF_MS, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.97 * p})`;
        ctx.fillRect(0, 0, W, H);
      } else if (phase === "booting") {
        ctx.fillStyle = "rgba(0,0,0,0.64)";
        ctx.fillRect(0, 0, W, H);
        const elapsed = performance.now() - bootStartRef.current;
        const scanT = Math.min(elapsed / 900, 1);
        const scanY = scanT * H;
        const scanA = 0.5 * (1 - scanT);
        if (scanA > 0.01) {
          ctx.fillStyle = `rgba(255,255,255,${scanA})`;
          ctx.fillRect(0, scanY - 2, W, 3);
        }
      }

      ctx.restore();
    };

    draw();
    return () => cancelAnimationFrame(crtRafRef.current);
  }, []); // mount once — reads all mutable state via refs

  // ── Noise volume by phase ─────────────────────────────────────────────────
  useEffect(() => {
    const g = noiseGainRef.current, c = ctxRef.current;
    if (!g || !c) return;
    const vol =
      phase === "detuned" ? (1 - proximity) * 0.5 :
      phase === "locking" ? 0.35 :
      phase === "jitter"  ? 0.6  :
      phase === "booting" ? 0.45 :
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
    if (zoneTimerRef.current) return;

    zoneTimerRef.current = setTimeout(() => {
      zoneTimerRef.current = null;
      setPhase("locking");
      lockPhaseStartRef.current = performance.now();

      const clearStart = performance.now();
      clearIvRef.current = setInterval(() => {
        const p = Math.min((performance.now() - clearStart) / LOCK_CLEAR_MS, 1);
        if (distortRef.current)  distortRef.current.curve = makeDistortCurve(400 * (1 - p));
        if (songFiltRef.current) {
          songFiltRef.current.Q.value         = 4.0 - 3.7 * p;
          songFiltRef.current.frequency.value = 1800 + 2200 * p;
        }
        if (songGainRef.current && ctxRef.current)
          songGainRef.current.gain.setTargetAtTime(0.05 + 0.7 * p, ctxRef.current.currentTime, 0.05);
        if (p >= 1) { if (clearIvRef.current) { clearInterval(clearIvRef.current); clearIvRef.current = null; } }
      }, 50);

      clearT();
      timerRef.current = setTimeout(() => {
        setPhase("synced");

        timerRef.current = setTimeout(() => {
          if (songGainRef.current && ctxRef.current)
            songGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.4);
          setPhase("jitter");

          timerRef.current = setTimeout(() => {
            setPhase("shutoff");

            timerRef.current = setTimeout(() => {
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

  // ── Preload eye frames ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "zooming") return;
    for (let i = 1; i <= 12; i++) {
      const img = new window.Image();
      img.src = `/tv/eye/frame${String(i).padStart(2, "0")}.png`;
    }
  }, [phase]);

  // ── Eye frame cycle ───────────────────────────────────────────────────────
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

  // ── Swipe ─────────────────────────────────────────────────────────────────
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
  const showSmoke   = phase === "locking" || phase === "shutoff";
  const visualKnob  = knobAngle - 135;

  return (
    <>
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
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

      {/* ── Overlay ───────────────────────────────────────────────────────── */}
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
          {/* Paper grain */}
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

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative pointer-events-none"
              style={{ width: "min(82vw, 82vh)", aspectRatio: "1" }}
            >
              {/* TV head — fades during synced, ambient bloom */}
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
                  filter:     "drop-shadow(0 0 40px rgba(12,3,3,0.55))",
                }}
              />

              {/* Eye frames — CRT-filtered full replacement during synced */}
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
                    filter:     "grayscale(1) contrast(0.78) brightness(0.82) blur(0.5px)",
                  }}
                />
              )}

              {/* Unified CRT canvas — noise + scanlines + vignette as one surface */}
              <div
                className="absolute pointer-events-none overflow-hidden"
                style={{
                  left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                  borderRadius: "4px",
                  zIndex: 4,
                }}
              >
                <canvas
                  ref={crtCanvasRef}
                  width={128}
                  height={96}
                  className="w-full h-full"
                  style={{ display: "block", imageRendering: "pixelated" }}
                />
              </div>

              {/* Smoke */}
              {showSmoke && (
                <>
                  <SmokePuff left="47%" top="20%" delay="0s"    />
                  <SmokePuff left="28%" top="42%" delay="0.35s" />
                  <SmokePuff left="66%" top="38%" delay="0.7s"  />
                </>
              )}

              {/* Knob — grounded with contact shadow */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: "24%", top: "62%", width: "11%", aspectRatio: "1",
                  filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.8))",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobbackpart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobtopart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none"
                  style={{ transform: `rotate(${visualKnob}deg)`, transformOrigin: "50% 50%" }} />
              </div>

              {/* Close — nearly invisible */}
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
