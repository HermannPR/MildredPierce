"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── State machine ─────────────────────────────────────────────────────────────
type Phase =
  | "idle"
  | "zooming"
  | "detuned"   // searching — knob interactive
  | "locking"   // found zone — 5-8s static transition, knob locked
  | "synced"    // music plays — 5s
  | "jitter"
  | "shutoff"
  | "booting";

// ── Constants ─────────────────────────────────────────────────────────────────
const SYNC_ZONE  = 28;   // ±° from target = in zone
const KNOB_MAX   = 270;  // 270° sweep
const MUSIC_MS   = 5000;
const JITTER_MS  = 1400;
const SHUTOFF_MS = 900;
const BOOT_MS    = 2400;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clampKnob = (a: number) => Math.max(0, Math.min(KNOB_MAX, a));

function randTarget() {
  // Keep target fully inside range so sync zone is never cut off
  return SYNC_ZONE + Math.floor(Math.random() * (KNOB_MAX + 1 - 2 * SYNC_ZONE));
}
function shiftTarget(prev: number) {
  let next: number;
  do { next = randTarget(); } while (Math.abs(next - prev) < 60);
  return next;
}

// ── WebAudio noise ─────────────────────────────────────────────────────────────
function buildNoise(ctx: AudioContext) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src       = ctx.createBufferSource();
  src.buffer      = buf;
  src.loop        = true;

  const filt      = ctx.createBiquadFilter();
  filt.type       = "bandpass";
  filt.frequency.value = 2100;
  filt.Q.value    = 0.45;

  const gain      = ctx.createGain();
  gain.gain.value = 0;

  src.connect(filt);
  filt.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  return { gain, stop: () => { try { src.stop(); } catch (_) {} } };
}

// ── Smoke puff element ────────────────────────────────────────────────────────
function SmokePuff({ left, top, delay }: { left: string; top: string; delay: string }) {
  return (
    <div
      className="absolute pointer-events-none rounded-full"
      style={{
        left, top,
        width:           "5%",
        aspectRatio:     "1",
        backgroundColor: "rgba(160,160,160,0.65)",
        animation:       `smokeLoop 1.1s ease-out ${delay} infinite`,
      }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TVMan() {
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [knobAngle, setKnobAngle] = useState(135); // start at midpoint
  const [target,    setTarget]    = useState(randTarget);

  // Derived (linear range, no wrap)
  const dist      = Math.abs(knobAngle - target);
  const proximity = Math.max(0, 1 - dist / SYNC_ZONE);
  const inZone    = dist <= SYNC_ZONE;

  // Audio
  const ctxRef       = useRef<AudioContext | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const musicRef     = useRef<HTMLAudioElement | null>(null);

  // Swipe-anywhere drag state
  const swipeRef = useRef({ active: false, lastX: 0 });

  // Canvas
  const eyeCanvasRef  = useRef<HTMLCanvasElement>(null);
  const lockCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef(0);

  // Timer chain
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockMsRef = useRef(6000); // randomized per lock

  const clearT = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // ── Audio init (requires user gesture) ───────────────────────────────────
  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    const { gain } = buildNoise(ctx);
    noiseGainRef.current = gain;
  }, []);

  // ── Open ─────────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    initAudio();
    setPhase("zooming");
    setTimeout(() => setPhase("detuned"), 560);
  }, [initAudio]);

  // ── Close ────────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    clearT();
    cancelAnimationFrame(rafRef.current);
    const g = noiseGainRef.current, c = ctxRef.current;
    if (g && c) g.gain.setTargetAtTime(0, c.currentTime, 0.1);
    if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
    setPhase("idle");
  }, [clearT]);

  // ── Noise volume by phase ────────────────────────────────────────────────
  useEffect(() => {
    const g = noiseGainRef.current, c = ctxRef.current;
    if (!g || !c) return;
    const now = c.currentTime;
    const vol =
      phase === "detuned"  ? (1 - proximity) * 0.55 :
      phase === "locking"  ? 0.72 :
      phase === "jitter"   ? 0.6  :
      phase === "booting"  ? 0.45 :
      0;
    g.gain.setTargetAtTime(vol, now, 0.07);
  }, [proximity, phase]);

  // ── Zone detection → locking transition ──────────────────────────────────
  useEffect(() => {
    if (phase !== "detuned") return;
    if (!inZone) return;

    // Randomize lock duration 5–8 s
    lockMsRef.current = 5000 + Math.floor(Math.random() * 3000);
    setPhase("locking");

    clearT();
    timerRef.current = setTimeout(() => {
      // Locking done → synced
      setPhase("synced");

      const canOpus = document.createElement("audio").canPlayType("audio/webm; codecs=opus") !== "";
      const audio = new Audio(canOpus ? "/tv/song.webm" : "/tv/song.mp3");
      audio.volume = 0.75;
      audio.addEventListener("loadedmetadata", () => {
        const slack = Math.max(0, audio.duration - 6);
        audio.currentTime = Math.random() * slack;
      });
      audio.play().catch(() => {});
      musicRef.current = audio;

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
    }, lockMsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inZone, phase]);

  // ── Eye canvas (detuned / jitter / booting) ───────────────────────────────
  useEffect(() => {
    const canvas = eyeCanvasRef.current;
    if (!canvas) return;
    const active = phase === "detuned" || phase === "jitter" || phase === "booting";
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const { width: W, height: H } = canvas;
      const id = ctx.createImageData(W, H);
      const d  = id.data;
      const a  =
        phase === "booting" ? 215 :
        phase === "jitter"  ? 200 :
        Math.round((1 - proximity * 0.75) * 230);
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = a;
      }
      ctx.putImageData(id, 0, 0);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, proximity]);

  // ── Lock canvas (locking — full-face heavy static) ────────────────────────
  const lockRafRef = useRef(0);
  useEffect(() => {
    const canvas = lockCanvasRef.current;
    if (!canvas || phase !== "locking") {
      cancelAnimationFrame(lockRafRef.current);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      lockRafRef.current = requestAnimationFrame(draw);
      const { width: W, height: H } = canvas;
      const id = ctx.createImageData(W, H);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = 200;
      }
      ctx.putImageData(id, 0, 0);
    };
    draw();
    return () => cancelAnimationFrame(lockRafRef.current);
  }, [phase]);

  // ── Swipe-anywhere drag (horizontal → knob rotation) ─────────────────────
  const onSwipeDown = useCallback((e: React.PointerEvent) => {
    // Skip if touch lands on a button
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
  const visualKnob  = knobAngle - 135; // -135° to +135°

  const lightColor =
    phase === "synced"   ? "#00ff55"  :
    phase === "locking"  ? "#ffaa00"  :
    proximity > 0.5      ? "#ff8800"  :
    "#ff2222";

  const lightStyle: React.CSSProperties =
    phase === "locking"
      ? { animation: "lightPulse 0.55s ease-in-out infinite" }
      : {};

  const posPercent = (knobAngle / KNOB_MAX) * 100;

  return (
    <>
      {/* ── Easter egg: TV man body, bottom-center ───────────────────────── */}
      <div
        className="fixed bottom-0 left-1/2 z-30 select-none"
        style={{
          width:           "9vh",
          transform:       phase === "zooming"
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
          {/* TV container centered, leaves 56px for tune indicator */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ paddingBottom: "56px" }}
          >
            <div
              className="relative pointer-events-none"
              style={{ width: "min(100vw, calc(100vh - 56px))", aspectRatio: "1" }}
            >
              {/* TV head */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tv/tvheadonly.png"
                alt="TV"
                draggable={false}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{
                  animation: phase === "jitter" ? "tvJitter 0.09s infinite" : undefined,
                }}
              />

              {/* Eye-area canvas: detuned / jitter / booting */}
              <canvas
                ref={eyeCanvasRef}
                width={128}
                height={96}
                className="absolute pointer-events-none"
                style={{
                  left:           "27%", top: "23%",
                  width:          "46%", height: "27%",
                  imageRendering: "pixelated",
                  opacity:        (phase === "synced" || phase === "locking") ? 0 : 1,
                  transition:     "opacity 0.55s ease",
                }}
              />

              {/* Locking canvas: full-face heavy static */}
              <canvas
                ref={lockCanvasRef}
                width={64}
                height={64}
                className="absolute pointer-events-none"
                style={{
                  left:           "22%", top: "18%",
                  width:          "56%", height: "56%",
                  imageRendering: "pixelated",
                  opacity:        phase === "locking" ? 1 : 0,
                  transition:     "opacity 0.4s ease",
                }}
              />

              {/* Smoke puffs: locking + shutoff */}
              {showSmoke && (
                <>
                  <SmokePuff left="47%" top="20%" delay="0s"   />
                  <SmokePuff left="28%" top="42%" delay="0.35s" />
                  <SmokePuff left="66%" top="38%" delay="0.7s"  />
                </>
              )}

              {/* Boot scan-line sweep */}
              {phase === "booting" && (
                <div
                  className="absolute pointer-events-none overflow-hidden"
                  style={{ left: "27%", top: "23%", width: "46%", height: "27%" }}
                >
                  <div style={{
                    position:        "absolute",
                    left: 0, right: 0,
                    height:          "3px",
                    backgroundColor: "rgba(255,255,255,0.55)",
                    animation:       "scanSweep 0.9s ease-in forwards",
                  }} />
                </div>
              )}

              {/* Dark screen: shutoff / boot */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: "27%", top: "23%", width: "46%", height: "27%",
                  backgroundColor: "#000",
                  opacity:    darkScreen ? (phase === "booting" ? 0.55 : 1) : 0,
                  transition: phase === "shutoff" ? "opacity 0.35s ease-in" : "opacity 0.7s ease-out",
                }}
              />

              {/* Knob (visual only — drag is swipe-anywhere) */}
              <div
                className="absolute pointer-events-none"
                style={{ left: "41%", top: "58%", width: "18%", aspectRatio: "1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobbackpart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tv/knobtopart.png" alt="" draggable={false}
                  className="absolute inset-0 w-full h-full select-none"
                  style={{ transform: `rotate(${visualKnob}deg)`, transformOrigin: "50% 50%" }} />
              </div>

              {/* Light indicator */}
              <div
                className="absolute pointer-events-none rounded-full"
                style={{
                  left:            "34%", top: "62%",
                  width:           "2.8%", aspectRatio: "1",
                  backgroundColor: lightColor,
                  boxShadow:       `0 0 8px 3px ${lightColor}99`,
                  transition:      "background-color 0.25s ease, box-shadow 0.25s ease",
                  ...lightStyle,
                }}
              />

              {/* ── X button — pointer-events: auto so it works above swipe layer */}
              <button
                onClick={close}
                className="absolute pointer-events-auto
                           top-[5%] right-[5%]
                           flex items-center justify-center
                           w-9 h-9 text-white/40 hover:text-white/80
                           text-3xl font-thin transition-colors"
              >
                ×
              </button>

              {/* Look frames — wire here when assets are ready */}
            </div>
          </div>

          {/* ── Tune indicator bar — pinned bottom ───────────────────────── */}
          {phase === "detuned" && (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none
                         flex flex-col items-center justify-center gap-2"
              style={{ height: "56px" }}
            >
              <p className="text-white/30 text-[10px] tracking-[0.35em] font-display uppercase select-none">
                ◀ &nbsp; TUNE &nbsp; ▶
              </p>
              <div className="relative w-52 h-[3px] bg-white/10 rounded-full">
                <div
                  className="absolute top-1/2 w-3 h-3 rounded-full"
                  style={{
                    left:            `${posPercent}%`,
                    transform:       "translate(-50%, -50%)",
                    backgroundColor: lightColor,
                    boxShadow:       `0 0 5px ${lightColor}`,
                    transition:      "background-color 0.25s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Locking / synced status hint */}
          {(phase === "locking" || phase === "synced") && (
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none
                         flex items-center justify-center"
              style={{ height: "56px" }}
            >
              <p className="text-white/30 text-[10px] tracking-[0.4em] font-display uppercase select-none"
                style={{ animation: phase === "locking" ? "lightPulse 0.55s ease-in-out infinite" : undefined }}>
                {phase === "locking" ? "SYNTONIZING…" : "SIGNAL LOCKED"}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
