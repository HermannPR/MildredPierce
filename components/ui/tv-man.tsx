"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Phase =
  | "idle" | "zooming" | "booting" | "detuned"
  | "locking" | "synced" | "shutoff" | "powered_off";
type LightState = "off" | "red" | "green" | "amber";

const KNOB_MAX      = 270;
const MUSIC_MS      = 9000;   // 9-second sneak peek
const SHUTOFF_MS    = 1100;   // quiet fade to black
const BOOT_MS       = 1800;   // scan-sweep boot duration
const LOCK_CLEAR_MS = 2200;   // static clearing time

// Virtual channel positions (normalised 0–1 of KNOB_MAX) and crossfade radius
const CH_NORMS  = [0.09, 0.33, 0.59, 0.85];
const CH_RADIUS = 0.14;

// Screen rect in SVG viewBox 0 0 100 100 — centered with equal margins
const SCR_LEFT   = "7%";
const SCR_TOP    = "7%";
const SCR_WIDTH  = "86%";
const SCR_HEIGHT = "58%";

const clampKnob = (a: number) => Math.max(0, Math.min(KNOB_MAX, a));
// Targets in [90, 220] so auto-tune always has meaningful travel from start=0
function randTarget() { return 90 + Math.floor(Math.random() * 131); }
function shiftTarget(prev: number) { let n: number; do { n = randTarget(); } while (Math.abs(n - prev) < 70); return n; }

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
  const eyeW = W * 0.82, eyeH = H * 0.46;
  ctx.beginPath();
  ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
  const eyeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(eyeW, eyeH) / 2);
  eyeGrad.addColorStop(0,    "#3a3732");
  eyeGrad.addColorStop(0.75, "#252220");
  eyeGrad.addColorStop(1,    "#141210");
  ctx.fillStyle = eyeGrad; ctx.fill();
  const irisR = eyeH * 0.47;
  ctx.beginPath(); ctx.arc(0, 0, irisR, 0, Math.PI * 2);
  const irisGrad = ctx.createRadialGradient(-irisR * 0.15, -irisR * 0.15, 0, 0, 0, irisR);
  irisGrad.addColorStop(0,    "#4a4640");
  irisGrad.addColorStop(0.45, "#2e2c28");
  irisGrad.addColorStop(1,    "#121010");
  ctx.fillStyle = irisGrad; ctx.fill();
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * irisR * 0.42, Math.sin(angle) * irisR * 0.42);
    ctx.lineTo(Math.cos(angle) * irisR * 0.97, Math.sin(angle) * irisR * 0.97);
    ctx.strokeStyle = "rgba(0,0,0,0.32)"; ctx.lineWidth = 0.35; ctx.stroke();
  }
  const pupilR = irisR * 0.47;
  ctx.beginPath(); ctx.arc(0, 0, pupilR, 0, Math.PI * 2);
  ctx.fillStyle = "#040302"; ctx.fill();
  ctx.beginPath(); ctx.arc(-pupilR * 0.38, -pupilR * 0.38, pupilR * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2); ctx.clip();
  const topSh = ctx.createLinearGradient(0, -eyeH / 2, 0, -eyeH * 0.08);
  topSh.addColorStop(0, "rgba(0,0,0,0.78)"); topSh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topSh; ctx.fillRect(-eyeW / 2, -eyeH / 2, eyeW, eyeH * 0.5);
  const botSh = ctx.createLinearGradient(0, eyeH * 0.08, 0, eyeH / 2);
  botSh.addColorStop(0, "rgba(0,0,0,0)"); botSh.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = botSh; ctx.fillRect(-eyeW / 2, 0, eyeW, eyeH / 2);
  ctx.restore(); ctx.restore();
}

function makeDistortCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 512, curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ── Multi-channel audio ────────────────────────────────────────────────────────

interface AudioChain {
  interSrc:  AudioBufferSourceNode;
  interFilt: BiquadFilterNode;
  interGain: GainNode;
  ch:        Array<{ out: GainNode }>;
  oscs:      OscillatorNode[];
  voiceSrc:  AudioBufferSourceNode;
  ch2Osc:    OscillatorNode;
  fmCarrier: OscillatorNode;
}

function makeBuf(ctx: AudioContext, seconds = 2): AudioBufferSourceNode {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  return src;
}

function buildAudioChain(ctx: AudioContext): AudioChain {
  const oscs: OscillatorNode[] = [];

  // Inter-channel broadband noise
  const interSrc  = makeBuf(ctx);
  const interFilt = ctx.createBiquadFilter();
  interFilt.type = "bandpass"; interFilt.frequency.value = 2200; interFilt.Q.value = 0.4;
  const interDist = ctx.createWaveShaper(); interDist.curve = makeDistortCurve(220); interDist.oversample = "4x";
  const interGain = ctx.createGain(); interGain.gain.value = 0;
  interSrc.connect(interFilt); interFilt.connect(interDist); interDist.connect(interGain); interGain.connect(ctx.destination);
  interSrc.start();

  // Ch 0: Damaged broadcast — twin detuned sawtooths beating at ~0.9 Hz
  const saw0 = ctx.createOscillator(); saw0.type = "sawtooth"; saw0.frequency.value = 110;
  const saw1 = ctx.createOscillator(); saw1.type = "sawtooth"; saw1.frequency.value = 110.9;
  oscs.push(saw0, saw1);
  const ch0Sum = ctx.createGain(); ch0Sum.gain.value = 0.55;
  const ch0Dist = ctx.createWaveShaper(); ch0Dist.curve = makeDistortCurve(620); ch0Dist.oversample = "4x";
  const ch0Filt = ctx.createBiquadFilter(); ch0Filt.type = "bandpass"; ch0Filt.frequency.value = 200; ch0Filt.Q.value = 3.2;
  const ch0Out  = ctx.createGain(); ch0Out.gain.value = 0;
  saw0.connect(ch0Sum); saw1.connect(ch0Sum);
  ch0Sum.connect(ch0Dist); ch0Dist.connect(ch0Filt); ch0Filt.connect(ch0Out); ch0Out.connect(ctx.destination);
  saw0.start(); saw1.start();

  // Ch 1: Ghost announcer — formant-filtered noise + AM modulation at 3.5 Hz
  const voiceSrc = makeBuf(ctx);
  const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 500;  f1.Q.value = 18;
  const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1350; f2.Q.value = 11;
  const f3 = ctx.createBiquadFilter(); f3.type = "bandpass"; f3.frequency.value = 2600; f3.Q.value = 8;
  voiceSrc.connect(f1); voiceSrc.connect(f2); voiceSrc.connect(f3);
  const ch1Mix = ctx.createGain(); ch1Mix.gain.value = 0.45;
  f1.connect(ch1Mix); f2.connect(ch1Mix); f3.connect(ch1Mix);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 3.5;
  const lfoScale = ctx.createGain(); lfoScale.gain.value = 0.42;
  oscs.push(lfo);
  const amGain = ctx.createGain(); amGain.gain.value = 0.55;
  lfo.connect(lfoScale); lfoScale.connect(amGain.gain);
  ch1Mix.connect(amGain);
  const ch1Dist = ctx.createWaveShaper(); ch1Dist.curve = makeDistortCurve(190); ch1Dist.oversample = "4x";
  const ch1Out  = ctx.createGain(); ch1Out.gain.value = 0;
  amGain.connect(ch1Dist); ch1Dist.connect(ch1Out); ch1Out.connect(ctx.destination);
  voiceSrc.start(); lfo.start();

  // Ch 2: Broken music — LFO-swept sawtooth lowpass
  const ch2Osc = ctx.createOscillator(); ch2Osc.type = "sawtooth"; ch2Osc.frequency.value = 220;
  oscs.push(ch2Osc);
  const musLFO = ctx.createOscillator(); musLFO.frequency.value = 0.28;
  const musLFOGain = ctx.createGain(); musLFOGain.gain.value = 780;
  oscs.push(musLFO);
  const ch2Filt = ctx.createBiquadFilter(); ch2Filt.type = "lowpass"; ch2Filt.frequency.value = 950; ch2Filt.Q.value = 3.5;
  musLFO.connect(musLFOGain); musLFOGain.connect(ch2Filt.frequency);
  const ch2Dist = ctx.createWaveShaper(); ch2Dist.curve = makeDistortCurve(270); ch2Dist.oversample = "4x";
  const ch2Out  = ctx.createGain(); ch2Out.gain.value = 0;
  ch2Osc.connect(ch2Filt); ch2Filt.connect(ch2Dist); ch2Dist.connect(ch2Out); ch2Out.connect(ctx.destination);
  ch2Osc.start(); musLFO.start();

  // Ch 3: Alien interference — FM synthesis (carrier 440, mod 311, depth 1800)
  const fmCarrier = ctx.createOscillator(); fmCarrier.type = "sine"; fmCarrier.frequency.value = 440;
  const fmMod     = ctx.createOscillator(); fmMod.type = "sine";     fmMod.frequency.value = 311;
  oscs.push(fmCarrier, fmMod);
  const fmDepth = ctx.createGain(); fmDepth.gain.value = 1800;
  fmMod.connect(fmDepth); fmDepth.connect(fmCarrier.frequency);
  const ch3Dist = ctx.createWaveShaper(); ch3Dist.curve = makeDistortCurve(460); ch3Dist.oversample = "4x";
  const ch3Filt = ctx.createBiquadFilter(); ch3Filt.type = "highpass"; ch3Filt.frequency.value = 700;
  const ch3Out  = ctx.createGain(); ch3Out.gain.value = 0;
  fmCarrier.connect(ch3Dist); ch3Dist.connect(ch3Filt); ch3Filt.connect(ch3Out); ch3Out.connect(ctx.destination);
  fmCarrier.start(); fmMod.start();

  return {
    interSrc, interFilt, interGain,
    ch: [{ out: ch0Out }, { out: ch1Out }, { out: ch2Out }, { out: ch3Out }],
    oscs, voiceSrc, ch2Osc, fmCarrier,
  };
}

function updateChannelSound(knob: number, chain: AudioChain, ctx: AudioContext) {
  const t = ctx.currentTime, norm = knob / KNOB_MAX;
  let maxNear = 0;
  for (let i = 0; i < CH_NORMS.length; i++) {
    const near = Math.max(0, 1 - Math.abs(norm - CH_NORMS[i]) / CH_RADIUS);
    chain.ch[i].out.gain.setTargetAtTime(near * near * 0.52, t, 0.05);
    if (near > maxNear) maxNear = near;
  }
  chain.interGain.gain.setTargetAtTime((1 - maxNear * 0.82) * 0.50, t, 0.05);
  chain.interFilt.frequency.setTargetAtTime(160 * Math.pow(28, norm), t, 0.04);

  // Pitch bend — simulate tuning sweep on all pitch-bendable sources
  const pitchMult = 1 + (norm - 0.5) * 0.12;
  chain.interSrc.playbackRate.setTargetAtTime(Math.max(0.4, Math.min(2.2, pitchMult)), t, 0.06);
  chain.voiceSrc.playbackRate.setTargetAtTime(Math.max(0.4, Math.min(2.2, pitchMult)), t, 0.07);
  chain.ch2Osc.frequency.setTargetAtTime(220 * Math.max(0.5, Math.min(2, pitchMult)), t, 0.07);
  chain.fmCarrier.frequency.setTargetAtTime(440 * Math.max(0.5, Math.min(2, pitchMult)), t, 0.07);
}

// ── TV Body SVG — centered screen, controls on bottom strip ───────────────────
// viewBox 0 0 100 100 | screen surface x=7,y=7,w=86,h=58 (equal 7-unit margins each side)
function TVBodySVG({
  visualKnob,
  lightState,
  onPowerClick,
}: {
  visualKnob: number;
  lightState: LightState;
  onPowerClick?: () => void;
}) {
  const KX = 18, KY = 80, KR = 5.5, KRO = 6.8;
  const ticks = [-40, 0, 40];

  const lightColor =
    lightState === "green" ? "#22cc55" :
    lightState === "red"   ? "#dd2200" :
    lightState === "amber" ? "#c87820" : "#0a0806";
  const lightGlow =
    lightState === "green" ? "rgba(34,204,85,0.7)"  :
    lightState === "red"   ? "rgba(220,34,0,0.7)"   :
    lightState === "amber" ? "rgba(200,120,32,0.6)" : "none";
  const lightAnim   = lightState !== "off" ? "lightPulse 1.4s ease-in-out infinite" : undefined;
  const pwrActive   = !!onPowerClick;
  const pwrColor    = pwrActive ? "#5a5248" : "#1e1c18";

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id="tvbg" x1="0.1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#302d24" />
          <stop offset="60%"  stopColor="#1e1c15" />
          <stop offset="100%" stopColor="#131109" />
        </linearGradient>
        <radialGradient id="tvkg" cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor="#504c44" />
          <stop offset="55%"  stopColor="#2c2a26" />
          <stop offset="100%" stopColor="#141210" />
        </radialGradient>
        {lightState !== "off" && (
          <radialGradient id="lglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={lightColor} stopOpacity="1" />
            <stop offset="100%" stopColor={lightColor} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      {/* Drop shadow */}
      <rect x="4" y="4" width="95" height="93" rx="5" fill="rgba(0,0,0,0.4)" />

      {/* Chassis */}
      <rect x="2" y="2" width="96" height="91" rx="4" fill="url(#tvbg)" />
      <rect x="2" y="2" width="96" height="91" rx="4" fill="none" stroke="#38342a" strokeWidth="0.9" />

      {/* Bevel */}
      <rect x="3"    y="2.5" width="94" height="1.4" rx="0.7" fill="#3e3a30" opacity="0.7" />
      <rect x="3"    y="2.5" width="1.4" height="88" rx="0.7" fill="#383428" opacity="0.65" />
      <rect x="3"    y="91"  width="94" height="1.4" rx="0.7" fill="#000" opacity="0.55" />
      <rect x="95.6" y="2.5" width="1.4" height="88" rx="0.7" fill="#000" opacity="0.45" />

      {/* Screen bezel — equal left/right margins from chassis edges */}
      <rect x="4" y="4" width="92" height="63" rx="3" fill="#141210" />
      <rect x="5"  y="5" width="90" height="1.2" fill="#000" opacity="0.95" />
      <rect x="5"  y="5" width="1.2" height="60" fill="#000" opacity="0.85" />
      <rect x="94" y="5" width="1.2" height="60" fill="#282420" opacity="0.5" />
      <rect x="5"  y="66" width="90" height="1.2" fill="#282420" opacity="0.4" />

      {/* Screen surface (canvas lives here) */}
      <rect x="7" y="7" width="86" height="58" rx="2" fill="#050302" />

      {/* Bottom strip */}
      <rect x="2" y="69" width="96" height="22" rx="2" fill="#111009" />
      <rect x="2" y="69" width="96" height="1.2" fill="#000" opacity="0.9" />
      {/* Vent slots left */}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={35 + i * 7} y="87" width="4" height="1.1" rx="0.5" fill="#0a0806" />
      ))}

      {/* Tuning knob */}
      <circle cx={KX} cy={KY} r={KRO} fill="#060402" />
      <circle cx={KX} cy={KY} r={KR}  fill="url(#tvkg)" />
      {ticks.map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return (
          <line key={deg}
            x1={KX + Math.cos(rad) * (KR + 0.5)} y1={KY + Math.sin(rad) * (KR + 0.5)}
            x2={KX + Math.cos(rad) * (KRO - 0.2)} y2={KY + Math.sin(rad) * (KRO - 0.2)}
            stroke="#2a2824" strokeWidth="0.7" />
        );
      })}
      <g transform={`rotate(${visualKnob} ${KX} ${KY})`}>
        <line x1={KX} y1={KY - KR + 0.5} x2={KX} y2={KY - KR + 3.2}
          stroke="#b0aea8" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Nameplate centre */}
      <rect x="36" y="85" width="28" height="4" rx="1" fill="#0c0a07" />

      {/* Power button */}
      <g style={{ cursor: pwrActive ? "pointer" : "default", pointerEvents: pwrActive ? "auto" : "none" }}
         onClick={onPowerClick}>
        <circle cx="82" cy="79" r="5.2" fill="#0a0806" stroke="#222018" strokeWidth="0.8" />
        <circle cx="82" cy="79" r="3.8" fill="#131110" />
        <path d="M80.3 77.5 A2.5 2.5 0 1 1 83.7 77.5"
          stroke={pwrColor} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <line x1="82" y1="76" x2="82" y2="78.2"
          stroke={pwrColor} strokeWidth="0.9" strokeLinecap="round" />
      </g>

      {/* Indicator light (beside power button) */}
      {lightState !== "off" && (
        <circle cx="90" cy="75" r="3" fill="url(#lglow)" opacity="0.4" />
      )}
      <circle cx="90" cy="75" r="1.5"
        fill={lightColor}
        style={{ animation: lightAnim }}
        filter={lightState !== "off" ? `drop-shadow(0 0 2px ${lightGlow})` : undefined}
      />

      {/* Feet */}
      <rect x="8"  y="91" width="14" height="7" rx="2" fill="#0c0a08" />
      <rect x="78" y="91" width="14" height="7" rx="2" fill="#0c0a08" />
    </svg>
  );
}

// ── Trigger silhouette ─────────────────────────────────────────────────────────
function TriggerTVSVG() {
  return (
    <svg viewBox="0 -14 50 106" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto" }}>
      <line x1="20" y1="1"  x2="13" y2="-11" stroke="#131110" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="30" y1="1"  x2="37" y2="-11" stroke="#131110" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="1" y="1" width="48" height="40" rx="4" fill="#1a1714" />
      <rect x="5" y="5" width="32" height="26" rx="2" fill="#060404" />
      <circle cx="43" cy="32" r="5"   fill="#0e0c0a" />
      <circle cx="43" cy="32" r="3.5" fill="#1a1816" />
      <rect x="18" y="41" width="14" height="18" rx="2" fill="#100f0d" />
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

// ── Main component ─────────────────────────────────────────────────────────────
export function TVMan() {
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [knobAngle, setKnobAngle] = useState(0);
  const [target,    setTarget]    = useState(randTarget);

  const lightState: LightState =
    phase === "synced"  ? "green"  :
    phase === "locking" ? "amber"  :
    phase === "booting" ? "red"    : "off";

  // Audio refs
  const ctxRef      = useRef<AudioContext | null>(null);
  const chainRef    = useRef<AudioChain | null>(null);
  const songBufRef  = useRef<AudioBuffer | null>(null);
  const songSrcRef  = useRef<AudioBufferSourceNode | null>(null);
  const distortRef  = useRef<WaveShaperNode | null>(null);
  const songFiltRef = useRef<BiquadFilterNode | null>(null);
  const songGainRef = useRef<GainNode | null>(null);

  const knobRef = useRef(0); // mirrors knobAngle for use inside intervals

  // CRT canvas
  const crtCanvasRef      = useRef<HTMLCanvasElement>(null);
  const crtRafRef         = useRef(0);
  const phaseRef          = useRef<Phase>("idle");
  const proximityRef      = useRef(0); // unused now but kept for locking noise decay
  const lockPhaseStartRef = useRef(0);
  const bootStartRef      = useRef(0);
  const shutoffStartRef   = useRef(0);
  const jitterRef         = useRef({ x: 0, y: 0, r: 0 });

  // Timers
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTuneRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearIvRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glitchTRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const clearAutoTune = useCallback(() => {
    if (autoTuneRef.current) { clearInterval(autoTuneRef.current); autoTuneRef.current = null; }
  }, []);

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

  // startLocking — extracted so auto-tune effect can call it
  const startLocking = useCallback(() => {
    setPhase("locking");
    lockPhaseStartRef.current = performance.now();

    const chain = chainRef.current, ctx = ctxRef.current;
    if (chain && ctx) {
      chain.ch.forEach(c => c.out.gain.setTargetAtTime(0, ctx.currentTime, 0.2));
      chain.interGain.gain.setTargetAtTime(0.38, ctx.currentTime, 0.1);
    }

    const clearStart = performance.now();
    clearIvRef.current = setInterval(() => {
      const p = Math.min((performance.now() - clearStart) / LOCK_CLEAR_MS, 1);
      if (distortRef.current)  distortRef.current.curve  = makeDistortCurve(400 * (1 - p));
      if (songFiltRef.current) { songFiltRef.current.Q.value = 4 - 3.7*p; songFiltRef.current.frequency.value = 1800 + 2200*p; }
      if (songGainRef.current && ctxRef.current) songGainRef.current.gain.setTargetAtTime(0.05 + 0.7*p, ctxRef.current.currentTime, 0.05);
      if (p >= 1) { if (clearIvRef.current) { clearInterval(clearIvRef.current); clearIvRef.current = null; } }
    }, 50);

    clearT();
    timerRef.current = setTimeout(() => {
      // Lock complete → synced (light residual distortion + glitch)
      if (distortRef.current) distortRef.current.curve = makeDistortCurve(22);
      if (chain && ctxRef.current) chain.interGain.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.3);
      setPhase("synced");

      // After sneak peek → quiet shutoff → powered_off
      timerRef.current = setTimeout(() => {
        if (songGainRef.current && ctxRef.current) songGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.5);
        setPhase("shutoff");
        timerRef.current = setTimeout(() => {
          if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }
          setPhase("powered_off");
        }, SHUTOFF_MS);
      }, MUSIC_MS);
    }, LOCK_CLEAR_MS);
  }, [clearT]);

  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    chainRef.current = buildAudioChain(ctx);
  }, []);

  const startTV = useCallback((newTarget?: number) => {
    bootStartRef.current = performance.now();
    knobRef.current = 0;
    setKnobAngle(0);
    setPhase("booting");
    clearT();
    timerRef.current = setTimeout(() => setPhase("detuned"), BOOT_MS);
    if (newTarget !== undefined) setTarget(newTarget);
  }, [clearT]);

  const open = useCallback(() => {
    initAudio();
    setPhase("zooming");
    const ctx = ctxRef.current;
    if (ctx) {
      const canOpus = document.createElement("audio").canPlayType("audio/webm; codecs=opus") !== "";
      fetch("/api/audio", { headers: { Accept: canOpus ? "audio/webm" : "audio/mpeg" } })
        .then(r => r.arrayBuffer()).then(buf => ctx.decodeAudioData(buf))
        .then(decoded => { songBufRef.current = decoded; startSong(decoded); }).catch(() => {});
    }
    setTimeout(() => startTV(), 560);
  }, [initAudio, startSong, startTV]);

  const close = useCallback(() => {
    clearT(); clearAutoTune();
    if (clearIvRef.current)   { clearInterval(clearIvRef.current);  clearIvRef.current = null; }
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    if (glitchTRef.current)   { clearTimeout(glitchTRef.current);   glitchTRef.current = null; }
    cancelAnimationFrame(crtRafRef.current);
    const ctx = ctxRef.current, chain = chainRef.current;
    if (chain && ctx) {
      chain.interGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      chain.ch.forEach(c => c.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08));
    }
    if (songGainRef.current && ctx) songGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    if (songSrcRef.current) { try { songSrcRef.current.stop(); } catch (_) {} songSrcRef.current = null; }
    setPhase("idle");
  }, [clearT, clearAutoTune]);

  const powerOn = useCallback(() => {
    if (phase !== "powered_off") return;
    if (songBufRef.current) startSong(songBufRef.current);
    startTV(shiftTarget(target));
  }, [phase, target, startSong, startTV]);

  // Sync phase ref
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "shutoff")  shutoffStartRef.current = performance.now();
    if (phase === "booting")  bootStartRef.current    = performance.now();
  }, [phase]);

  // ── Unified CRT canvas RAF ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = crtCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const nc = document.createElement("canvas"); nc.width = 32; nc.height = 22;
    const nCtx = nc.getContext("2d")!;

    const draw = () => {
      crtRafRef.current = requestAnimationFrame(draw);
      const ph = phaseRef.current;
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);
      if (ph === "idle" || ph === "zooming") return;

      ctx.save();
      roundRectPath(ctx, 0, 0, W, H, 4); ctx.clip();

      // Dark amber base (warmer than pure black)
      ctx.fillStyle = "#070503"; ctx.fillRect(0, 0, W, H);

      // Eye (synced only)
      if (ph === "synced") drawEye(ctx, W, H, jitterRef.current);

      // Noise
      let na = 0;
      if      (ph === "booting")  na = 0.55;
      else if (ph === "detuned")  na = 0.52;
      else if (ph === "locking")  na = 0.52 * Math.max(0, 1 - (performance.now() - lockPhaseStartRef.current) / LOCK_CLEAR_MS);

      if (na > 0.01) {
        const nId = nCtx.createImageData(32, 22); const nd = nId.data;
        for (let i = 0; i < nd.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          // Amber-tinted noise: warm CRT phosphor feel
          nd[i]   = v;
          nd[i+1] = (v * 0.82) | 0;
          nd[i+2] = (v * 0.48) | 0;
          nd[i+3] = 255;
        }
        nCtx.putImageData(nId, 0, 0);
        ctx.globalAlpha = na; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(nc, 0, 0, W, H);
        ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
      }

      // Phosphor scanlines
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let y = 2; y < H; y += 4) ctx.fillRect(0, y, W, 2);

      // Vignette
      const vg = ctx.createRadialGradient(W*.5, H*.42, W*.06, W*.5, H*.52, W*.78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(.45, "rgba(0,0,0,0.05)"); vg.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // Boot scan sweep
      if (ph === "booting") {
        const elapsed = performance.now() - bootStartRef.current;
        const scanT = Math.min(elapsed / BOOT_MS, 1), scanY = scanT * H, scanA = 0.55 * (1 - scanT);
        if (scanA > 0.01) {
          ctx.fillStyle = `rgba(220,180,80,${scanA})`; // amber scan line
          ctx.fillRect(0, scanY - 2, W, 3);
        }
      }

      // Shutoff fade
      if (ph === "shutoff") {
        const p = Math.min((performance.now() - shutoffStartRef.current) / SHUTOFF_MS, 1);
        ctx.fillStyle = `rgba(0,0,0,${p})`; ctx.fillRect(0, 0, W, H);
      }

      // Powered off — solid black
      if (ph === "powered_off") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); }

      ctx.restore();
    };

    draw();
    return () => cancelAnimationFrame(crtRafRef.current);
  }, []);

  // Channel audio gating by phase
  useEffect(() => {
    const chain = chainRef.current, ctx = ctxRef.current; if (!chain || !ctx) return;
    if (phase === "detuned") {
      updateChannelSound(knobRef.current, chain, ctx); return;
    }
    chain.ch.forEach(c => c.out.gain.setTargetAtTime(0, ctx.currentTime, 0.09));
    const interVol = phase === "locking" ? 0.38 : phase === "booting" ? 0.45 : 0;
    chain.interGain.gain.setTargetAtTime(interVol, ctx.currentTime, 0.07);
  }, [phase]);

  // Auto-tune: knob animates toward target with humanlike wobble
  useEffect(() => {
    if (phase !== "detuned") { clearAutoTune(); return; }
    let locked = false;

    autoTuneRef.current = setInterval(() => {
      if (locked) return;
      const current = knobRef.current;
      const diff = target - current;

      // Wobble only when far from target; zero out near it so convergence is guaranteed
      const wobble = Math.abs(diff) > 18 ? Math.sin(Date.now() * 0.005) * 1.6 : 0;
      const next = clampKnob(current + diff * 0.028 + wobble);

      if (Math.abs(diff) < 1.5) {
        locked = true;
        clearAutoTune();
        knobRef.current = target;
        setKnobAngle(target);
        setTimeout(() => startLocking(), 420);
        return;
      }
      knobRef.current = next;
      setKnobAngle(next);

      const chain = chainRef.current, ctx = ctxRef.current;
      if (chain && ctx) updateChannelSound(next, chain, ctx);
    }, 16);

    return clearAutoTune;
  }, [phase, target, startLocking, clearAutoTune]);

  // Synced: visual jitter + audio glitch bursts
  useEffect(() => {
    if (phase !== "synced") {
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      if (glitchTRef.current)   { clearTimeout(glitchTRef.current);   glitchTRef.current = null; }
      jitterRef.current = { x: 0, y: 0, r: 0 };
      return;
    }
    const step = () => {
      jitterRef.current = { x: (Math.random()-.5)*4, y: (Math.random()-.5)*4, r: (Math.random()-.5)*0.7 };
      syncTimerRef.current = setTimeout(step, 150 + Math.random() * 350);
    };
    syncTimerRef.current = setTimeout(step, 200);

    const glitchStep = () => {
      const ctx = ctxRef.current;
      if (distortRef.current) distortRef.current.curve = makeDistortCurve(160 + Math.random() * 240);
      if (songSrcRef.current && ctx) {
        const rate = 0.88 + Math.random() * 0.28;
        songSrcRef.current.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.02);
        songSrcRef.current.playbackRate.setTargetAtTime(1.0,  ctx.currentTime + 0.18, 0.05);
      }
      const resetId = setTimeout(() => { if (distortRef.current) distortRef.current.curve = makeDistortCurve(22); }, 260);
      glitchTRef.current = setTimeout(() => { clearTimeout(resetId); glitchStep(); }, 2400 + Math.random() * 4800);
    };
    glitchTRef.current = setTimeout(glitchStep, 1000 + Math.random() * 2000);

    return () => {
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      if (glitchTRef.current)   { clearTimeout(glitchTRef.current);   glitchTRef.current = null; }
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "idle") return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [phase, close]);

  const showOverlay = phase !== "idle" && phase !== "zooming";
  const showSmoke   = phase === "locking";
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
        onClick={open} title="..."
      >
        <div style={{ filter: "invert(1) drop-shadow(0 0 8px rgba(180,50,50,0.6))", mixBlendMode: "screen" as const }}>
          <TriggerTVSVG />
        </div>
      </div>

      {/* Overlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "#050505", animation: "tvFadeIn 0.4s ease-out", touchAction: "none" }}
        >
          {/* Film grain */}
          <div className="absolute inset-0 pointer-events-none" style={{
            opacity: 0.04,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
            backgroundSize: "256px 256px", mixBlendMode: "overlay", zIndex: 60,
          }} />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative pointer-events-none" style={{ width: "min(82vw, 82vh)", aspectRatio: "1" }}>

              {/* TV body */}
              <div className="absolute inset-0" style={{ filter: "drop-shadow(0 0 45px rgba(10,4,4,0.7))" }}>
                <TVBodySVG
                  visualKnob={visualKnob}
                  lightState={lightState}
                  onPowerClick={phase === "powered_off" ? powerOn : undefined}
                />
              </div>

              {/* CRT canvas */}
              <div className="absolute pointer-events-none overflow-hidden" style={{
                left: SCR_LEFT, top: SCR_TOP, width: SCR_WIDTH, height: SCR_HEIGHT,
                borderRadius: "2px", zIndex: 4,
              }}>
                <canvas ref={crtCanvasRef} width={172} height={116}
                  className="w-full h-full"
                  style={{ display: "block", imageRendering: "pixelated" }} />
              </div>

              {/* Smoke — only during signal lock acquisition */}
              {showSmoke && (
                <>
                  <SmokePuff left="38%" top="2%"   delay="0s"    />
                  <SmokePuff left="52%" top="1.5%" delay="0.35s" />
                  <SmokePuff left="66%" top="2%"   delay="0.7s"  />
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
