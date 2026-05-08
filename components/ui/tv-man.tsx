"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Phase =
  | "idle" | "zooming" | "detuned" | "locking"
  | "synced" | "jitter" | "shutoff" | "booting";

const SYNC_ZONE     = 28;
const KNOB_MAX      = 270;
const MUSIC_MS      = 20000;
const JITTER_MS     = 1400;
const SHUTOFF_MS    = 900;
const BOOT_MS       = 2400;
const ZONE_WAIT_MS  = 3000;
const LOCK_CLEAR_MS = 4000;

// Screen rect in SVG viewBox 0 0 100 100 → x=10,y=12,w=57,h=50
const SCR_LEFT   = "10%";
const SCR_TOP    = "12%";
const SCR_WIDTH  = "57%";
const SCR_HEIGHT = "50%";

const clampKnob = (a: number) => Math.max(0, Math.min(KNOB_MAX, a));
function randTarget() { return SYNC_ZONE + Math.floor(Math.random() * (KNOB_MAX + 1 - 2 * SYNC_ZONE)); }
function shiftTarget(prev: number) { let n: number; do { n = randTarget(); } while (Math.abs(n - prev) < 60); return n; }

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawEye(ctx: CanvasRenderingContext2D, W: number, H: number, j: { x: number; y: number; r: number }) {
  ctx.save();
  ctx.translate(W / 2 + j.x * 0.4, H / 2 + j.y * 0.4);
  ctx.rotate((j.r * Math.PI) / 180 * 0.3);

  const eyeW = W * 0.82;
  const eyeH = H * 0.46;

  // Eye whites
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
  const eyeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(eyeW, eyeH) / 2);
  eyeGrad.addColorStop(0,    "#3a3732");
  eyeGrad.addColorStop(0.75, "#252220");
  eyeGrad.addColorStop(1,    "#141210");
  ctx.fillStyle = eyeGrad;
  ctx.fill();

  // Iris
  const irisR = eyeH * 0.47;
  ctx.beginPath();
  ctx.arc(0, 0, irisR, 0, Math.PI * 2);
  const irisGrad = ctx.createRadialGradient(-irisR * 0.15, -irisR * 0.15, 0, 0, 0, irisR);
  irisGrad.addColorStop(0,    "#4a4640");
  irisGrad.addColorStop(0.45, "#2e2c28");
  irisGrad.addColorStop(1,    "#121010");
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Iris texture lines
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * irisR * 0.42, Math.sin(angle) * irisR * 0.42);
    ctx.lineTo(Math.cos(angle) * irisR * 0.97, Math.sin(angle) * irisR * 0.97);
    ctx.strokeStyle = "rgba(0,0,0,0.32)";
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }

  // Pupil
  const pupilR = irisR * 0.47;
  ctx.beginPath();
  ctx.arc(0, 0, pupilR, 0, Math.PI * 2);
  ctx.fillStyle = "#040302";
  ctx.fill();

  // Catch light
  ctx.beginPath();
  ctx.arc(-pupilR * 0.38, -pupilR * 0.38, pupilR * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();

  // Eyelid shadows
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  const topSh = ctx.createLinearGradient(0, -eyeH / 2, 0, -eyeH * 0.08);
  topSh.addColorStop(0, "rgba(0,0,0,0.78)"); topSh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topSh;
  ctx.fillRect(-eyeW / 2, -eyeH / 2, eyeW, eyeH * 0.5);
  const botSh = ctx.createLinearGradient(0, eyeH * 0.08, 0, eyeH / 2);
  botSh.addColorStop(0, "rgba(0,0,0,0)"); botSh.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = botSh;
  ctx.fillRect(-eyeW / 2, 0, eyeW, eyeH / 2);
  ctx.restore();

  ctx.restore();
}

function buildNoise(ctx: AudioContext) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 2100; filt.Q.value = 0.45;
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

// ── Code-generated TV body (SVG, viewBox 0 0 100 100) ──────────────────────
// Layout:  screen x=10,y=12,w=57,h=50  |  right panel x=72,y=9,w=22,h=56
//          bottom strip x=7,y=68,w=87,h=14  |  feet y=86
function TVBodySVG({ visualKnob }: { visualKnob: number }) {
  const ticks = [-50, -25, 0, 25, 50];
  // knob center & radii
  const KX = 83, KY = 27, KR = 8, KRO = 9.5;
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id="tvbg" x1="0.1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#302d24" />
          <stop offset="60%"  stopColor="#1e1c15" />
          <stop offset="100%" stopColor="#131109" />
        </linearGradient>
        <linearGradient id="tvpanel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1a1814" />
          <stop offset="100%" stopColor="#0e0d0b" />
        </linearGradient>
        <radialGradient id="tvkg" cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor="#504c44" />
          <stop offset="55%"  stopColor="#2c2a26" />
          <stop offset="100%" stopColor="#141210" />
        </radialGradient>
        <radialGradient id="tvkg2" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#3a3834" />
          <stop offset="100%" stopColor="#111009" />
        </radialGradient>
      </defs>

      {/* Drop shadow */}
      <rect x="7" y="8" width="92" height="86" rx="5" fill="rgba(0,0,0,0.45)" />

      {/* Chassis */}
      <rect x="4" y="5" width="92" height="84" rx="4" fill="url(#tvbg)" />
      {/* Outer edge — makes chassis visible against black bg */}
      <rect x="4" y="5" width="92" height="84" rx="4"
        fill="none" stroke="#38342a" strokeWidth="0.9" />

      {/* Top + left bevel highlights */}
      <rect x="5"   y="5.5" width="90" height="1.4" rx="0.7" fill="#3e3a30" opacity="0.7" />
      <rect x="5"   y="5.5" width="1.4" height="82" rx="0.7" fill="#383428" opacity="0.65" />
      {/* Bottom + right shadow edges */}
      <rect x="5"   y="87"  width="90" height="1.4" rx="0.7" fill="#000" opacity="0.55" />
      <rect x="93.6" y="5.5" width="1.4" height="82" rx="0.7" fill="#000" opacity="0.45" />

      {/* ── Screen bezel ── */}
      <rect x="7" y="9" width="63" height="57" rx="3" fill="#141210" />
      {/* Bezel inset shadow (recessed depth) */}
      <rect x="8"  y="10" width="61" height="1.2" fill="#000" opacity="0.95" />
      <rect x="8"  y="10" width="1.2" height="54" fill="#000" opacity="0.85" />
      <rect x="68" y="10" width="1.2" height="54" fill="#282420" opacity="0.5" />
      <rect x="8"  y="65" width="61" height="1.2" fill="#282420" opacity="0.4" />
      {/* Screen surface (canvas positioned here) */}
      <rect x="10" y="12" width="57" height="50" rx="2" fill="#070504" />

      {/* ── Right control panel ── */}
      <rect x="72" y="9" width="22" height="57" rx="2" fill="url(#tvpanel)" />
      {/* Panel inset shadow */}
      <rect x="72" y="9"  width="22" height="1.2" fill="#000" opacity="0.8" />
      <rect x="72" y="9"  width="1.2" height="57" fill="#000" opacity="0.6" />
      <rect x="93" y="9"  width="1.2" height="57" fill="#282420" opacity="0.4" />

      {/* Main tuning knob */}
      <circle cx={KX} cy={KY} r={KRO} fill="#060402" />
      <circle cx={KX} cy={KY} r={KR}  fill="url(#tvkg)" />
      {/* Rim ticks */}
      {ticks.map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return (
          <line key={deg}
            x1={KX + Math.cos(rad) * (KR + 0.6)} y1={KY + Math.sin(rad) * (KR + 0.6)}
            x2={KX + Math.cos(rad) * (KRO - 0.2)} y2={KY + Math.sin(rad) * (KRO - 0.2)}
            stroke="#2a2824" strokeWidth="0.7" />
        );
      })}
      {/* Rotating indicator */}
      <g transform={`rotate(${visualKnob} ${KX} ${KY})`}>
        <line x1={KX} y1={KY - KR + 0.5} x2={KX} y2={KY - KR + 4}
          stroke="#b0aea8" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Secondary knob */}
      <circle cx={KX} cy="47" r="6.5" fill="#050301" />
      <circle cx={KX} cy="47" r="5.5" fill="url(#tvkg2)" />
      <circle cx={KX} cy="41.8" r="1.1" fill="#484440" />

      {/* Speaker dot grid */}
      {[0, 1, 2, 3].map(row => [0, 1, 2, 3].map(col => (
        <circle key={`${row}-${col}`}
          cx={75 + col * 4.2} cy={57 + row * 3.6}
          r="0.9" fill="#0e0c0a" />
      )))}

      {/* ── Bottom strip ── */}
      <rect x="7" y="68" width="87" height="14" rx="2" fill="#111009" />
      {/* Vent slots */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={10 + i * 8} y="71" width="4.5" height="1.2" rx="0.6" fill="#0a0806" />
      ))}
      {/* Nameplate */}
      <rect x="36" y="75" width="24" height="4" rx="1" fill="#0c0a07" />

      {/* Feet */}
      <rect x="10" y="86" width="13" height="8" rx="2.5" fill="#0c0a08" />
      <rect x="77" y="86" width="13" height="8" rx="2.5" fill="#0c0a08" />
    </svg>
  );
}

// ── Trigger silhouette (small TV man) ─────────────────────────────────────
function TriggerTVSVG() {
  return (
    <svg viewBox="0 -14 50 106" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto" }}>
      {/* Antennas */}
      <line x1="20" y1="1"  x2="13" y2="-11" stroke="#131110" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="30" y1="1"  x2="37" y2="-11" stroke="#131110" strokeWidth="1.6" strokeLinecap="round" />
      {/* Head */}
      <rect x="1" y="1" width="48" height="40" rx="4" fill="#1a1714" />
      {/* Screen */}
      <rect x="5" y="5" width="32" height="26" rx="2" fill="#060404" />
      {/* Knob */}
      <circle cx="43" cy="32" r="5"   fill="#0e0c0a" />
      <circle cx="43" cy="32" r="3.5" fill="#1a1816" />
      {/* Torso */}
      <rect x="18" y="41" width="14" height="18" rx="2" fill="#100f0d" />
      {/* Legs */}
      <rect x="13" y="59" width="9"  height="30" rx="3" fill="#0d0c0a" />
      <rect x="28" y="59" width="9"  height="30" rx="3" fill="#0d0c0a" />
    </svg>
  );
}

function SmokePuff({ left, top, delay }: { left: string; top: string; delay: string }) {
  return (
    <div className="absolute pointer-events-none rounded-full"
      style={{
        left, top, width: "5%", aspectRatio: "1",
        backgroundColor: "rgba(160,160,160,0.65)",
        animation: `smokeLoop 1.1s ease-out ${delay} infinite`,
      }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TVMan() {
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [knobAngle, setKnobAngle] = useState(135);
  const [target,    setTarget]    = useState(randTarget);

  const dist      = Math.abs(knobAngle - target);
  const proximity = Math.max(0, 1 - dist / SYNC_ZONE);
  const inZone    = dist <= SYNC_ZONE;

  // Audio
  const ctxRef       = useRef<AudioContext | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const songBufRef   = useRef<AudioBuffer | null>(null);
  const songSrcRef   = useRef<AudioBufferSourceNode | null>(null);
  const distortRef   = useRef<WaveShaperNode | null>(null);
  const songFiltRef  = useRef<BiquadFilterNode | null>(null);
  const songGainRef  = useRef<GainNode | null>(null);

  const swipeRef = useRef({ active: false, lastX: 0 });

  // CRT canvas
  const crtCanvasRef      = useRef<HTMLCanvasElement>(null);
  const crtRafRef         = useRef(0);
  const phaseRef          = useRef<Phase>("idle");
  const proximityRef      = useRef(0);
  const lockPhaseStartRef = useRef(0);
  const bootStartRef      = useRef(0);
  const shutoffStartRef   = useRef(0);
  const jitterRef         = useRef({ x: 0, y: 0, r: 0 });

  // Timers
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIvRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const startSong = useCallback((decoded: AudioBuffer) => {
    const ctx = ctxRef.current; if (!ctx) return;
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }
    const src = ctx.createBufferSource(); src.buffer = decoded; src.loop = true;
    const distort = ctx.createWaveShaper(); distort.curve = makeDistortCurve(400); distort.oversample = "4x";
    const filt = ctx.createBiquadFilter(); filt.type = "bandpass"; filt.frequency.value = 1800; filt.Q.value = 4.0;
    const gain = ctx.createGain(); gain.gain.value = 0.05;
    src.connect(distort); distort.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start(0, Math.random() * Math.max(0, decoded.duration - 25));
    songSrcRef.current = src; distortRef.current = distort; songFiltRef.current = filt; songGainRef.current = gain;
  }, []);

  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    noiseGainRef.current = buildNoise(ctx).gain;
  }, []);

  const open = useCallback(() => {
    initAudio(); setPhase("zooming");
    const ctx = ctxRef.current;
    if (ctx) {
      const canOpus = document.createElement("audio").canPlayType("audio/webm; codecs=opus") !== "";
      fetch("/api/audio", { headers: { Accept: canOpus ? "audio/webm" : "audio/mpeg" } })
        .then(r => r.arrayBuffer()).then(buf => ctx.decodeAudioData(buf))
        .then(decoded => { songBufRef.current = decoded; startSong(decoded); }).catch(() => {});
    }
    setTimeout(() => setPhase("detuned"), 560);
  }, [initAudio, startSong]);

  const close = useCallback(() => {
    clearT();
    if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; }
    if (clearIvRef.current)   { clearInterval(clearIvRef.current);  clearIvRef.current = null; }
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    cancelAnimationFrame(crtRafRef.current);
    const c = ctxRef.current;
    if (noiseGainRef.current && c) noiseGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.1);
    if (songGainRef.current   && c) songGainRef.current.gain.setTargetAtTime(0, c.currentTime, 0.2);
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }
    setPhase("idle");
  }, [clearT]);

  // Sync phase/proximity refs
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "shutoff") shutoffStartRef.current = performance.now();
    if (phase === "booting") bootStartRef.current    = performance.now();
  }, [phase]);
  useEffect(() => { proximityRef.current = proximity; }, [proximity]);

  // ── Unified CRT canvas RAF ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = crtCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const nc = document.createElement("canvas"); nc.width = 32; nc.height = 28;
    const nCtx = nc.getContext("2d")!;

    const draw = () => {
      crtRafRef.current = requestAnimationFrame(draw);
      const ph = phaseRef.current;
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);
      if (ph === "idle" || ph === "zooming") return;

      ctx.save();
      roundRectPath(ctx, 0, 0, W, H, 5);
      ctx.clip();

      // Dark base
      ctx.fillStyle = "#060504";
      ctx.fillRect(0, 0, W, H);

      // Procedural eye (synced only)
      if (ph === "synced") drawEye(ctx, W, H, jitterRef.current);

      // Noise alpha
      let na = 0;
      if      (ph === "detuned") na = 0.5 * (1 - 0.42 * proximityRef.current);
      else if (ph === "locking") na = 0.5 * Math.max(0, 1 - (performance.now() - lockPhaseStartRef.current) / LOCK_CLEAR_MS);
      else if (ph === "jitter")  na = 0.72;
      else if (ph === "booting") na = 0.48;

      if (na > 0.01) {
        const nId = nCtx.createImageData(32, 28); const d = nId.data;
        for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255; }
        nCtx.putImageData(nId, 0, 0);
        ctx.globalAlpha = na; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(nc, 0, 0, W, H);
        ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
      }

      // Phosphor scanlines
      ctx.fillStyle = "rgba(0,0,0,0.13)";
      for (let y = 2; y < H; y += 4) ctx.fillRect(0, y, W, 2);

      // Vignette
      const vg = ctx.createRadialGradient(W*.5, H*.42, W*.06, W*.5, H*.52, W*.84);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(.45, "rgba(0,0,0,0.05)"); vg.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // Screen state overlays
      if (ph === "shutoff") {
        const p = Math.min((performance.now() - shutoffStartRef.current) / SHUTOFF_MS, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.97 * p})`; ctx.fillRect(0, 0, W, H);
      } else if (ph === "booting") {
        ctx.fillStyle = "rgba(0,0,0,0.64)"; ctx.fillRect(0, 0, W, H);
        const elapsed = performance.now() - bootStartRef.current;
        const scanT = Math.min(elapsed / 900, 1), scanY = scanT * H, scanA = 0.5 * (1 - scanT);
        if (scanA > 0.01) { ctx.fillStyle = `rgba(255,255,255,${scanA})`; ctx.fillRect(0, scanY - 2, W, 3); }
      }

      ctx.restore();
    };

    draw();
    return () => cancelAnimationFrame(crtRafRef.current);
  }, []);

  // Noise volume
  useEffect(() => {
    const g = noiseGainRef.current, c = ctxRef.current; if (!g || !c) return;
    const vol = phase==="detuned" ? (1-proximity)*0.5 : phase==="locking" ? 0.35 : phase==="jitter" ? 0.6 : phase==="booting" ? 0.45 : 0;
    g.gain.setTargetAtTime(vol, c.currentTime, 0.07);
  }, [proximity, phase]);

  // Zone detection → locking
  useEffect(() => {
    if (phase !== "detuned") { if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; } return; }
    if (!inZone)             { if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; } return; }
    if (zoneTimerRef.current) return;

    zoneTimerRef.current = setTimeout(() => {
      zoneTimerRef.current = null;
      setPhase("locking");
      lockPhaseStartRef.current = performance.now();

      const clearStart = performance.now();
      clearIvRef.current = setInterval(() => {
        const p = Math.min((performance.now() - clearStart) / LOCK_CLEAR_MS, 1);
        if (distortRef.current)  distortRef.current.curve = makeDistortCurve(400 * (1 - p));
        if (songFiltRef.current) { songFiltRef.current.Q.value = 4 - 3.7*p; songFiltRef.current.frequency.value = 1800 + 2200*p; }
        if (songGainRef.current && ctxRef.current) songGainRef.current.gain.setTargetAtTime(0.05 + 0.7*p, ctxRef.current.currentTime, 0.05);
        if (p >= 1) { if (clearIvRef.current) { clearInterval(clearIvRef.current); clearIvRef.current = null; } }
      }, 50);

      clearT();
      timerRef.current = setTimeout(() => {
        setPhase("synced");
        timerRef.current = setTimeout(() => {
          if (songGainRef.current && ctxRef.current) songGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.4);
          setPhase("jitter");
          timerRef.current = setTimeout(() => {
            setPhase("shutoff");
            timerRef.current = setTimeout(() => {
              if (songBufRef.current) startSong(songBufRef.current);
              setPhase("booting"); setTarget(prev => shiftTarget(prev));
              timerRef.current = setTimeout(() => setPhase("detuned"), BOOT_MS);
            }, SHUTOFF_MS);
          }, JITTER_MS);
        }, MUSIC_MS);
      }, LOCK_CLEAR_MS);
    }, ZONE_WAIT_MS);

    return () => { if (zoneTimerRef.current) { clearTimeout(zoneTimerRef.current); zoneTimerRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inZone, phase]);

  // Jitter timer during synced
  useEffect(() => {
    if (phase !== "synced") {
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      jitterRef.current = { x: 0, y: 0, r: 0 };
      return;
    }
    const step = () => {
      jitterRef.current = { x: (Math.random()-.5)*4, y: (Math.random()-.5)*4, r: (Math.random()-.5)*0.7 };
      syncTimerRef.current = setTimeout(step, 150 + Math.random() * 350);
    };
    syncTimerRef.current = setTimeout(step, 200);
    return () => { if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; } };
  }, [phase]);

  // ESC
  useEffect(() => {
    if (phase === "idle") return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, close]);

  // Swipe
  const onSwipeDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (phase !== "detuned") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeRef.current = { active: true, lastX: e.clientX };
  }, [phase]);
  const onSwipeMove = useCallback((e: React.PointerEvent) => {
    if (!swipeRef.current.active) return;
    setKnobAngle(p => clampKnob(p + (e.clientX - swipeRef.current.lastX) * 0.7));
    swipeRef.current.lastX = e.clientX;
  }, []);
  const onSwipeUp = useCallback(() => { swipeRef.current.active = false; }, []);

  const showOverlay = phase !== "idle" && phase !== "zooming";
  const showSmoke   = phase === "locking" || phase === "shutoff";
  const visualKnob  = knobAngle - 135;

  return (
    <>
      {/* Trigger */}
      <div
        className="fixed bottom-0 left-1/2 z-30 select-none"
        style={{
          width: "9vh",
          transform: phase === "zooming" ? "translateX(-50%) scale(18)" : "translateX(-50%) scale(1)",
          transformOrigin: "50% 12%",
          opacity: phase === "idle" ? 1 : 0,
          transition: "transform 0.52s ease-in, opacity 0.3s ease-in",
          pointerEvents: phase === "idle" ? "auto" : "none",
          cursor: "pointer",
        }}
        onClick={open}
        title="..."
      >
        <div style={{ filter: "invert(1) drop-shadow(0 0 8px rgba(180,50,50,0.6))", mixBlendMode: "screen" as const }}>
          <TriggerTVSVG />
        </div>
      </div>

      {/* Overlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: "#050505",
            animation: "tvFadeIn 0.4s ease-out",
            touchAction: "none",
            cursor: phase === "detuned" ? "ew-resize" : "default",
          }}
          onPointerDown={onSwipeDown}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeUp}
          onPointerCancel={onSwipeUp}
        >
          {/* Paper grain */}
          <div className="absolute inset-0 pointer-events-none" style={{
            opacity: 0.04,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
            backgroundSize: "256px 256px", mixBlendMode: "overlay", zIndex: 60,
          }} />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative pointer-events-none"
              style={{ width: "min(82vw, 82vh)", aspectRatio: "1" }}>

              {/* TV body SVG */}
              <div className="absolute inset-0" style={{
                animation: phase === "jitter" ? "tvJitter 0.09s infinite" : undefined,
                filter: "drop-shadow(0 0 45px rgba(10,4,4,0.7))",
              }}>
                <TVBodySVG visualKnob={visualKnob} />
              </div>

              {/* CRT canvas */}
              <div className="absolute pointer-events-none overflow-hidden" style={{
                left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                borderRadius: "3px", zIndex: 4,
              }}>
                <canvas ref={crtCanvasRef} width={128} height={112}
                  className="w-full h-full"
                  style={{ display: "block", imageRendering: "pixelated" }} />
              </div>

              {/* Smoke from top vents */}
              {showSmoke && (
                <>
                  <SmokePuff left="38%" top="3%" delay="0s"    />
                  <SmokePuff left="52%" top="2.5%" delay="0.35s" />
                  <SmokePuff left="66%" top="3%" delay="0.7s"  />
                </>
              )}

              {/* Close */}
              <button onClick={close}
                className="absolute pointer-events-auto top-[4%] right-[4%] flex items-center justify-center w-7 h-7 text-3xl font-thin"
                style={{ color: "rgba(255,255,255,0.08)", zIndex: 10 }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.08)")}
              >×</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
