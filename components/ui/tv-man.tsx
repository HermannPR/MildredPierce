"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── State machine ─────────────────────────────────────────────────────────────
type Phase = "idle" | "zooming" | "detuned" | "synced" | "jitter" | "shutoff" | "booting";

// ── Constants ─────────────────────────────────────────────────────────────────
const SYNC_ZONE  = 28;   // ±° casual difficulty
const MUSIC_MS   = 5000; // 5 s of music before shutoff
const JITTER_MS  = 1400;
const SHUTOFF_MS = 900;
const BOOT_MS    = 2400;

// ── Helpers ───────────────────────────────────────────────────────────────────
function randTarget() { return Math.floor(Math.random() * 360); }
function shiftTarget(prev: number) { return (prev + 90 + Math.floor(Math.random() * 180)) % 360; }
function angleDist(a: number, b: number) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// ── WebAudio noise factory ────────────────────────────────────────────────────
function buildNoise(ctx: AudioContext) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const filt       = ctx.createBiquadFilter();
  filt.type        = "bandpass";
  filt.frequency.value = 2100;
  filt.Q.value     = 0.45;

  const gain       = ctx.createGain();
  gain.gain.value  = 0;

  src.connect(filt);
  filt.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  return { gain, stop: () => { try { src.stop(); } catch (_) {} } };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TVMan() {
  const [phase,      setPhase]      = useState<Phase>("idle");
  const [knobAngle,  setKnobAngle]  = useState(0);
  const [target,     setTarget]     = useState(randTarget);

  // Derived
  const normAngle = ((knobAngle % 360) + 360) % 360;
  const dist      = angleDist(normAngle, target);
  const proximity = Math.max(0, 1 - dist / SYNC_ZONE); // 0 = far, 1 = dead-on
  const synced    = dist <= SYNC_ZONE;

  // Audio
  const ctxRef       = useRef<AudioContext | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const noiseStopRef = useRef<(() => void) | null>(null);
  const musicRef     = useRef<HTMLAudioElement | null>(null);

  // Knob circular drag
  const knobRef  = useRef<HTMLDivElement>(null);
  const dragRef  = useRef({ active: false, lastAngle: 0, cx: 0, cy: 0 });

  // Swipe-zone drag (horizontal = rotation, for mobile)
  const swipeRef  = useRef({ active: false, lastX: 0 });

  // Static canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);

  // Phase timer chain
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearT    = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── Init WebAudio on first open (requires user gesture) ──────────────────
  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    const { gain, stop } = buildNoise(ctx);
    noiseGainRef.current = gain;
    noiseStopRef.current = stop;
  }, []);

  // ── Open ────────────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    initAudio();
    setPhase("zooming");
    setTimeout(() => setPhase("detuned"), 560);
  }, [initAudio]);

  // ── Close ───────────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    clearT();
    cancelAnimationFrame(rafRef.current);
    if (noiseGainRef.current && ctxRef.current) {
      noiseGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.1);
    }
    if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
    setPhase("idle");
  }, [clearT]);

  // ── Noise volume: follows proximity when detuned ──────────────────────────
  useEffect(() => {
    const g = noiseGainRef.current;
    const c = ctxRef.current;
    if (!g || !c) return;
    const vol = phase === "detuned" ? (1 - proximity) * 0.55 : 0;
    g.gain.setTargetAtTime(vol, c.currentTime, 0.07);
  }, [proximity, phase]);

  // ── Sync / desync transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "detuned" && phase !== "synced") return;

    if (synced && phase === "detuned") {
      setPhase("synced");

      // Start music — place song.mp3 in public/tv/ to enable
      const audio = new Audio("/tv/song.mp3");
      audio.volume = 0.75;
      audio.addEventListener("loadedmetadata", () => {
        const slack = Math.max(0, audio.duration - 6);
        audio.currentTime = Math.random() * slack;
      });
      audio.play().catch(() => {});
      musicRef.current = audio;

      // Timer chain: music → jitter → shutoff → boot → detuned
      clearT();
      timerRef.current = setTimeout(() => {
        if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
        setPhase("jitter");

        timerRef.current = setTimeout(() => {
          setPhase("shutoff");

          timerRef.current = setTimeout(() => {
            setPhase("booting");
            setTarget(prev => shiftTarget(prev));

            timerRef.current = setTimeout(() => {
              setPhase("detuned");
            }, BOOT_MS);
          }, SHUTOFF_MS);
        }, JITTER_MS);
      }, MUSIC_MS);
    }

    if (!synced && phase === "synced") {
      clearT();
      if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
      setPhase("detuned");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced, phase]);

  // ── Static canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawingPhases: Phase[] = ["detuned", "jitter", "booting"];
    if (!drawingPhases.includes(phase)) {
      cancelAnimationFrame(rafRef.current);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      const id   = ctx.createImageData(W, H);
      const data = id.data;
      const alpha = phase === "booting"
        ? 210
        : Math.round((1 - proximity * 0.75) * 230);
      for (let i = 0; i < data.length; i += 4) {
        const v     = (Math.random() * 255) | 0;
        data[i]     = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = alpha;
      }
      ctx.putImageData(id, 0, 0);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, proximity]);

  // ── Knob: circular pointer drag ──────────────────────────────────────────
  const onKnobDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r  = knobRef.current!.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    dragRef.current = {
      active: true,
      lastAngle: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI,
      cx, cy,
    };
  }, []);

  const onKnobMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const { cx, cy, lastAngle } = dragRef.current;
    const newA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    let delta  = newA - lastAngle;
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;
    setKnobAngle(p => p + delta);
    dragRef.current.lastAngle = newA;
  }, []);

  const onKnobUp = useCallback(() => { dragRef.current.active = false; }, []);

  // ── Swipe zone: horizontal drag → rotation (mobile-friendly) ────────────
  const onSwipeDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeRef.current = { active: true, lastX: e.clientX };
  }, []);

  const onSwipeMove = useCallback((e: React.PointerEvent) => {
    if (!swipeRef.current.active) return;
    const dx = e.clientX - swipeRef.current.lastX;
    setKnobAngle(p => p + dx * 0.7);
    swipeRef.current.lastX = e.clientX;
  }, []);

  const onSwipeUp = useCallback(() => { swipeRef.current.active = false; }, []);

  // ── Derived visual state ──────────────────────────────────────────────────
  const isInteractive = phase === "detuned" || phase === "synced";
  const showOverlay   = phase !== "idle" && phase !== "zooming";
  const darkOverlay   = phase === "shutoff" || phase === "booting";

  const lightColor =
    phase === "synced" ? "#00ff55" :
    proximity > 0.5   ? "#ff8800" :
    "#ff2222";

  return (
    <>
      {/* ── Easter egg: small TV man body, bottom-center ─────────────────── */}
      <div
        className="fixed bottom-0 left-1/2 z-30 select-none"
        style={{
          width:          "9vh",
          transform:      phase === "zooming"
            ? "translateX(-50%) scale(18)"
            : "translateX(-50%) scale(1)",
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

      {/* ── Full-screen TV overlay ────────────────────────────────────────── */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: "#050505",
            animation: "tvFadeIn 0.4s ease-out",
          }}
        >
          {/* Centering wrapper — leaves 56 px for swipe zone */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ paddingBottom: "56px" }}
          >
            {/* Square TV container — matches 2048×2048 asset */}
            <div
              className="relative"
              style={{
                width:  "min(100vw, calc(100vh - 56px))",
                aspectRatio: "1",
              }}
            >
              {/* TV head */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tv/tvheadonly.png"
                alt="TV"
                draggable={false}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{
                  animation: phase === "jitter"
                    ? "tvJitter 0.09s infinite"
                    : undefined,
                }}
              />

              {/* Static canvas — overlays the eye screen area */}
              <canvas
                ref={canvasRef}
                width={128}
                height={96}
                className="absolute pointer-events-none"
                style={{
                  left:  "27%",
                  top:   "23%",
                  width: "46%",
                  height:"27%",
                  imageRendering: "pixelated",
                  opacity:    phase === "synced" ? 0 : 1,
                  transition: "opacity 0.55s ease",
                }}
              />

              {/* Look frames — wire here when assets ready */}
              {/* e.g. <img src="/tv/look-center.png" ... /> */}

              {/* Boot scan-line sweep */}
              {phase === "booting" && (
                <div
                  className="absolute pointer-events-none overflow-hidden"
                  style={{ left: "27%", top: "23%", width: "46%", height: "27%" }}
                >
                  <div
                    style={{
                      position:        "absolute",
                      left: 0, right: 0,
                      height:          "3px",
                      backgroundColor: "rgba(255,255,255,0.55)",
                      animation:       "scanSweep 0.9s ease-in forwards",
                    }}
                  />
                </div>
              )}

              {/* Dark screen overlay — shutoff / boot */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: "27%", top: "23%", width: "46%", height: "27%",
                  backgroundColor: "#000",
                  opacity:    darkOverlay ? (phase === "booting" ? 0.55 : 1) : 0,
                  transition: phase === "shutoff"
                    ? "opacity 0.35s ease-in"
                    : "opacity 0.7s ease-out",
                }}
              />

              {/* Smoke puff on shutoff */}
              {phase === "shutoff" && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left:      "47%",
                    top:       "47%",
                    width:     "6%",
                    aspectRatio: "1",
                    borderRadius: "50%",
                    backgroundColor: "rgba(180,180,180,0.7)",
                    filter:    "blur(4px)",
                    animation: "smokeRise 0.9s ease-out forwards",
                  }}
                />
              )}

              {/* Knob assembly */}
              {isInteractive && (
                <div
                  ref={knobRef}
                  className="absolute"
                  style={{
                    left:        "41%",
                    top:         "58%",
                    width:       "18%",
                    aspectRatio: "1",
                    touchAction: "none",
                    cursor:      "grab",
                    userSelect:  "none",
                  }}
                  onPointerDown={onKnobDown}
                  onPointerMove={onKnobMove}
                  onPointerUp={onKnobUp}
                  onPointerCancel={onKnobUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/tv/knobbackpart.png"
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none pointer-events-none"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/tv/knobtopart.png"
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none pointer-events-none"
                    style={{
                      transform:       `rotate(${knobAngle}deg)`,
                      transformOrigin: "50% 50%",
                    }}
                  />
                </div>
              )}

              {/* CSS light indicator */}
              {isInteractive && (
                <div
                  className="absolute rounded-full"
                  style={{
                    left:            "34%",
                    top:             "62%",
                    width:           "2.8%",
                    aspectRatio:     "1",
                    backgroundColor: lightColor,
                    boxShadow:       `0 0 8px 3px ${lightColor}99`,
                    transition:      "background-color 0.25s ease, box-shadow 0.25s ease",
                  }}
                />
              )}

              {/* Close (×) */}
              <button
                onClick={close}
                className="absolute top-[5%] right-[5%] flex items-center justify-center
                           w-9 h-9 text-white/40 hover:text-white/80 text-3xl font-thin
                           transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* ── Mobile swipe zone — pinned bottom ──────────────────────── */}
          {isInteractive && (
            <div
              className="absolute bottom-0 left-0 right-0 flex flex-col
                         items-center justify-center gap-2"
              style={{
                height:      "56px",
                touchAction: "none",
                cursor:      "ew-resize",
              }}
              onPointerDown={onSwipeDown}
              onPointerMove={onSwipeMove}
              onPointerUp={onSwipeUp}
              onPointerCancel={onSwipeUp}
            >
              {/* Label */}
              <p className="text-white/30 text-[10px] tracking-[0.35em] font-display uppercase
                            select-none pointer-events-none">
                ◀ &nbsp; TUNE &nbsp; ▶
              </p>
              {/* Track + position dot */}
              <div className="relative w-48 h-[3px] bg-white/10 rounded-full">
                <div
                  className="absolute top-1/2 w-3 h-3 rounded-full"
                  style={{
                    left:        `${(normAngle / 360) * 100}%`,
                    transform:   "translate(-50%, -50%)",
                    backgroundColor: lightColor,
                    boxShadow:   `0 0 5px ${lightColor}`,
                    transition:  "background-color 0.25s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
