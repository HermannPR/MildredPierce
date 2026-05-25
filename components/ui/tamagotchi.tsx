"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const PX          = 6;
const HYPE_GOAL   = 20_000;
const MILESTONES  = [5_000, 10_000, 15_000, 20_000];
// Total frames per milestone channel (including intro static burst)
const CH_DURATION = [240, 260, 280, 320] as const;
const CH_INTRO    = 50; // frames of static burst before channel content
const RAND_CH_COUNT = 7;
const RAND_CH_PROB  = 0.15;

const C = {
  bg:       "#050708",
  bezel:    "#0b0b10",
  bezelHi:  "#111118",
  bezelSh:  "#030306",
  screen:   "#040810",
  scanLine: "#020408",
  eyeWhite: "#6a8ea8",
  iris:     "#0e2030",
  irisHi:   "#163040",
  pupil:    "#010306",
  shine:    "#6a98c0",
  noise:    "#0a1828",
  noiseHi:  "#090912",
  zzz:      "#081018",
  stand:    "#07070e",
  standBase:"#090912",
  led:      "#003820",
} as const;

type State   = "idle" | "active" | "glitch" | "sleep";
type LookDir = "c" | "r" | "l" | "u" | "d" | "ur" | "ul" | "dl";

interface Noise { x: number; y: number; c: string; }
interface Zzz   { x: number; y: number; life: number; maxLife: number; }

function px(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, PX, PX);
}
function rect(ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, gw * PX, gh * PX);
}

function makeNoise(): Noise[] {
  return Array.from({ length: 65 }, () => ({
    x: 5 + Math.floor(Math.random() * 22),
    y: 4 + Math.floor(Math.random() * 18),
    c: Math.random() > 0.35 ? C.noise : C.noiseHi,
  }));
}

const LOOK_OFFSET: Record<LookDir, [number, number]> = {
  c:  [ 0,  0], r:  [ 2,  0], l:  [-2,  0], u:  [ 0, -1],
  d:  [ 0,  1], ur: [ 2, -1], ul: [-2, -1], dl: [-2,  1],
};

const LOOK_SEQ: [LookDir, number][] = [
  ["c", 120], ["r", 38], ["c", 55], ["l", 32], ["c", 90],
  ["u", 28],  ["ur", 22], ["c", 100], ["dl", 24], ["c", 75],
  ["u", 22],  ["c", 110],
];

// ── Draw helpers ─────────────────────────────────────────────

function drawMonitor(ctx: CanvasRenderingContext2D) {
  rect(ctx, 2, 1, 28, 26, C.bezel);
  for (let x = 2; x < 30; x++) px(ctx, x, 1, C.bezelHi);
  for (let y = 2; y < 27; y++) px(ctx, 2, y, C.bezelHi);
  for (let x = 2; x < 30; x++) px(ctx, x, 26, C.bezelSh);
  for (let y = 1; y < 27; y++) px(ctx, 29, y, C.bezelSh);
  rect(ctx, 4, 3, 24, 20, C.screen);
  for (let row = 3; row < 23; row += 2) rect(ctx, 4, row, 24, 1, C.scanLine);
  rect(ctx, 14, 27, 4, 2, C.stand);
  rect(ctx, 9,  29, 14, 2, C.standBase);
  px(ctx, 27, 25, C.led);
}

function drawEye(ctx: CanvasRenderingContext2D, blink: boolean, look: LookDir, wide: boolean) {
  const ex = 16, ey = 13;
  const [lx, ly] = LOOK_OFFSET[look];
  const topRow = wide ? ey - 4 : ey - 3;
  const height  = wide ? 9     : 7;

  ctx.globalAlpha = 0.07;
  rect(ctx, 9, topRow - 1, 14, height + 2, C.eyeWhite);
  ctx.globalAlpha = 1;

  if (blink) { rect(ctx, 10, ey, 12, 1, C.eyeWhite); return; }

  rect(ctx, 10, topRow, 12, height, C.eyeWhite);
  px(ctx, 10, topRow,          C.screen); px(ctx, 21, topRow,          C.screen);
  px(ctx, 10, topRow+1,        C.screen); px(ctx, 21, topRow+1,        C.screen);
  px(ctx, 10, topRow+height-1, C.screen); px(ctx, 21, topRow+height-1, C.screen);
  px(ctx, 10, topRow+height-2, C.screen); px(ctx, 21, topRow+height-2, C.screen);

  rect(ctx, ex-2+lx, ey-2+ly, 5, 5, C.iris);
  for (let i = 0; i < 5; i++) px(ctx, ex-2+lx+i, ey-2+ly, C.irisHi);
  px(ctx, ex-2+lx, ey-1+ly, C.irisHi);
  rect(ctx, ex-1+lx, ey-1+ly, 3, 3, C.pupil);
  px(ctx, ex-1+lx, ey-1+ly, C.shine);
}

function drawSleepEye(ctx: CanvasRenderingContext2D) {
  const ex = 16, ey = 13;
  rect(ctx, ex-4, ey+2, 9, 1, C.eyeWhite);
  px(ctx, ex-3, ey+1, C.eyeWhite);
  px(ctx, ex+4, ey+1, C.eyeWhite);
  ctx.globalAlpha = 0.4;
  rect(ctx, ex-1, ey-2, 3, 1, C.zzz);
  ctx.globalAlpha = 1;
}

function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.globalAlpha = 0.028;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * W, Math.random() * H, PX, PX);
  }
  ctx.globalAlpha = 1;
}

function drawStaticBurst(ctx: CanvasRenderingContext2D) {
  for (let y = 3; y < 23; y++) {
    for (let x = 4; x < 28; x++) {
      const v = Math.random();
      px(ctx, x, y, v > 0.55 ? "#a0aab4" : v > 0.28 ? "#060a0e" : "#1a2830");
    }
  }
}

// ── Milestone channels ────────────────────────────────────────
// elapsed: frames since content started (0 = first content frame)
// total:   total content frames for this channel

function drawChannelCard(ctx: CanvasRenderingContext2D, chIdx: number, elapsed: number, total: number) {
  const fade = Math.min(1, elapsed / 20);
  const fadeOut = elapsed > total - 30 ? Math.max(0, 1 - (elapsed - (total - 30)) / 30) : 1;
  const alpha = fade * fadeOut;

  switch (chIdx) {

    case 0: {
      // 5K — Classic SMPTE color bars
      const bars = ["#c89000","#c8c800","#00c8c8","#00c820","#0020c8","#c800c8","#c80020"];
      const bh = Math.floor(20 / bars.length);
      for (let i = 0; i < bars.length; i++) {
        const color = bars[i];
        for (let y = 3 + i * bh; y < 3 + (i + 1) * bh && y < 23; y++)
          for (let x = 4; x < 28; x++)
            px(ctx, x, y, color);
      }
      ctx.save();
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
      ctx.fillText("5K", 96, 92);
      ctx.restore();
      break;
    }

    case 1: {
      // 10K — VU meter equalizer
      rect(ctx, 4, 3, 24, 20, "#020408");
      const phases = [0, 0.9, 1.7, 2.5, 3.3, 4.1, 4.9, 5.7];
      const barGX  = [5, 7, 9, 12, 15, 17, 20, 22];
      for (let b = 0; b < 8; b++) {
        const amp = 0.5 + Math.sin(elapsed * 0.09 + phases[b]) * 0.5;
        const h = Math.round(2 + amp * 14);
        const top = 22 - h;
        const color = amp > 0.75 ? "#c84040" : amp > 0.42 ? "#30b840" : "#1a5c28";
        rect(ctx, barGX[b], top, 2, h, color);
      }
      ctx.save();
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(42,112,144,${alpha})`;
      ctx.fillText("10K SIGNAL", 96, 28);
      ctx.restore();
      break;
    }

    case 2: {
      // 15K — Radar sweep
      rect(ctx, 4, 3, 24, 20, "#020408");
      const CX = 96, CY = 78;
      const sweepAngle = (elapsed * 0.065) % (Math.PI * 2);
      // Rings
      for (const [r, c] of [[42,"#080e18"],[30,"#0a1620"],[20,"#0d1e2c"],[10,"#111828"]] as [number,string][]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.strokeStyle = `rgba(26,104,136,${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(sweepAngle) * 44, CY + Math.sin(sweepAngle) * 44);
      ctx.stroke();
      ctx.restore();
      // Blips
      if (Math.sin(sweepAngle + 1.2) > 0.85) {
        ctx.fillStyle = `rgba(42,136,136,${alpha})`;
        ctx.fillRect(76, 58, 4, 4);
      }
      if (Math.cos(sweepAngle - 0.8) > 0.85) {
        ctx.fillStyle = `rgba(42,100,120,${alpha})`;
        ctx.fillRect(108, 90, 3, 3);
      }
      // Label
      ctx.save();
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(42,136,136,${alpha})`;
      ctx.fillText("15K", 96, 130);
      ctx.restore();
      break;
    }

    case 3: {
      // 20K — MILDRED PIERCE title card, the final milestone
      rect(ctx, 4, 3, 24, 20, "#020308");
      rect(ctx, 4, 4, 24, 1, "#0a1c28");
      rect(ctx, 4, 21, 24, 1, "#0a1c28");
      // Flickering glow behind text
      const glow = 0.08 + Math.sin(elapsed * 0.25) * 0.04;
      ctx.save();
      ctx.globalAlpha = glow * alpha;
      ctx.fillStyle = "#1a4060";
      ctx.fillRect(4 * PX, 3 * PX, 24 * PX, 20 * PX);
      ctx.globalAlpha = 1;
      ctx.restore();
      // Text: MILDRED
      const flicker = Math.sin(elapsed * 0.28) > 0.6 ? 1 : 0.78;
      ctx.save();
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(90,148,172,${alpha * flicker})`;
      ctx.fillText("MILDRED", 96, 68);
      ctx.fillStyle = `rgba(58,108,140,${alpha * flicker})`;
      ctx.fillText("PIERCE", 96, 84);
      ctx.font = "5px monospace";
      ctx.fillStyle = `rgba(38,80,104,${alpha * Math.min(1, elapsed / 60)})`;
      ctx.fillText("FRACTAL AGREEMENT", 96, 102);
      // Corners
      ctx.restore();
      px(ctx, 4, 3, "#0e2030"); px(ctx, 27, 3, "#0e2030");
      px(ctx, 4, 22, "#0e2030"); px(ctx, 27, 22, "#0e2030");
      break;
    }
  }
}

// ── Random channels ───────────────────────────────────────────

function drawRandomChannel(ctx: CanvasRenderingContext2D, idx: number, frame: number) {
  const ch = idx % RAND_CH_COUNT;
  switch (ch) {
    case 0: {
      for (let y = 3; y < 23; y++)
        for (let x = 4; x < 28; x++)
          px(ctx, x, y, Math.random() > 0.5 ? "#c8d0d8" : "#010306");
      break;
    }
    case 1: {
      ctx.fillStyle = "#080e18";
      ctx.fillRect(4*PX, 3*PX, 24*PX, 20*PX);
      px(ctx, 15, 12, "#6a98c0"); px(ctx, 16, 12, "#6a98c0"); px(ctx, 17, 12, "#6a98c0");
      px(ctx, 15, 13, "#6a98c0"); px(ctx, 16, 13, "#8ab8d0"); px(ctx, 17, 13, "#6a98c0");
      px(ctx, 15, 14, "#6a98c0"); px(ctx, 16, 14, "#6a98c0"); px(ctx, 17, 14, "#6a98c0");
      break;
    }
    case 2: {
      const divY = 3 + Math.floor((frame * 0.35) % 20);
      for (let y = 3; y < 23; y++)
        for (let x = 4; x < 28; x++)
          px(ctx, x, y, y < divY ? "#020408" : Math.random() > 0.45 ? "#98a0a8" : "#040810");
      break;
    }
    case 3: {
      for (let y = 3; y < 23; y++) {
        const band = Math.floor((frame * 0.6 + (y - 3) * 1.5) % 16);
        const inBand = band < 3;
        for (let x = 4; x < 28; x++)
          px(ctx, x, y, inBand ? "#050c14" : (Math.random() > 0.75 ? "#182028" : "#040810"));
      }
      break;
    }
    case 4: {
      rect(ctx, 4, 3, 24, 20, "#020508");
      rect(ctx, 4, 3, 24, 2, "#0a1820");
      rect(ctx, 4, 21, 24, 2, "#0a1820");
      rect(ctx, 5, 8, 22, 1, "#0e1c28");
      rect(ctx, 5, 18, 22, 1, "#0e1c28");
      ctx.save();
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#5a8098";
      ctx.fillText("MILDRED", 96, 72);
      ctx.fillStyle = "#3a5870";
      ctx.fillText("PIERCE", 96, 84);
      ctx.restore();
      break;
    }
    case 5: {
      for (let x = 4; x < 28; x++) {
        const phase = ((x - 4) * 3 + Math.floor(frame * 0.8)) % 8;
        const bright = phase < 2;
        for (let y = 3; y < 23; y++)
          px(ctx, x, y, bright ? "#0e1c28" : "#020408");
      }
      break;
    }
    case 6: {
      rect(ctx, 4, 3, 24, 20, "#020406");
      ctx.save();
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#142030";
      ctx.fillText("NO SIGNAL", 96, 76);
      ctx.restore();
      px(ctx, 4, 3, "#0a1420");  px(ctx, 27, 3, "#0a1420");
      px(ctx, 4, 22, "#0a1420"); px(ctx, 27, 22, "#0a1420");
      break;
    }
  }
}

// ── Name picker ──────────────────────────────────────────────

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function NamePicker({ onConfirm }: { onConfirm: (nick: string) => void }) {
  const [chars, setChars] = useState(["A","A","A","A"]);
  const [cursor, setCursor] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(id);
  }, []);

  const cycle = (slot: number, dir: 1 | -1) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(5);
    setCursor(slot);
    setChars(prev => {
      const next = [...prev];
      const idx = (CHARSET.indexOf(prev[slot]) + dir + CHARSET.length) % CHARSET.length;
      next[slot] = CHARSET[idx];
      return next;
    });
  };

  // Arrow keys navigate slots / cycle letters — no typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if      (e.key === "ArrowLeft")  setCursor(c => Math.max(0, c - 1));
      else if (e.key === "ArrowRight") setCursor(c => Math.min(3, c + 1));
      else if (e.key === "ArrowUp")   { e.preventDefault(); cycle(cursor, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); cycle(cursor,  1); }
      else if (e.key === "Enter")      onConfirm(chars.join(""));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, chars, onConfirm]);

  const confirm = () => onConfirm(chars.join(""));

  const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 16, color: "#2a6080", padding: "10px 14px", lineHeight: 1,
    touchAction: "none", minWidth: 56, minHeight: 52,
  };

  return (
    <div style={{
      width: "clamp(280px, 90vw, 340px)", minHeight: "clamp(260px, 72vw, 320px)",
      background: "#050708",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 18,
      border: "1px solid #0e1c28",
      boxShadow: "0 0 30px rgba(0,60,140,0.35)",
    }}>
      <p style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 10, color: "#3a6888", letterSpacing: "0.2em",
        margin: 0, textShadow: "0 0 10px rgba(42,112,144,0.5)",
      }}>CALL SIGN</p>

      <div style={{ display: "flex", gap: 10 }}>
        {[0,1,2,3].map(slot => {
          const active = slot === cursor;
          return (
            <div key={slot} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <button onPointerDown={() => cycle(slot, -1)} style={btnStyle}>▲</button>
              <div
                onPointerDown={() => setCursor(slot)}
                style={{
                  width: 58, height: 72, background: active ? "#0d1820" : "#080d14",
                  border: `2px solid ${active ? "#2a5a80" : "#1a3a50"}`,
                  boxShadow: active ? "0 0 14px rgba(42,90,128,0.65)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Press Start 2P', monospace", fontSize: 30,
                  color: active ? "#7ab8d8" : "#5a9ab8",
                  textShadow: active ? "0 0 16px rgba(122,184,216,0.85)" : "0 0 8px rgba(90,154,184,0.4)",
                  cursor: "pointer", position: "relative",
                }}>
                {chars[slot]}
                {active && (
                  <span style={{
                    position: "absolute", bottom: 7, left: "50%",
                    transform: "translateX(-50%)",
                    width: 20, height: 2,
                    background: blink ? "#5a9ab8" : "transparent",
                  }} />
                )}
              </div>
              <button onPointerDown={() => cycle(slot, 1)} style={btnStyle}>▼</button>
            </div>
          );
        })}
      </div>

      <button
        onPointerDown={confirm}
        style={{
          marginTop: 4, background: "#0a1820",
          border: "1px solid #1a4060", cursor: "pointer",
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 11, color: "#3a8090", letterSpacing: "0.2em",
          padding: "13px 28px", textShadow: "0 0 8px rgba(42,128,144,0.5)",
          boxShadow: "0 0 14px rgba(0,60,140,0.3)", touchAction: "none",
        }}
      >
        START ▶
      </button>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────

export function EyeTV() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef<State>("idle");
  const frameRef    = useRef(0);
  const lastClick   = useRef(Date.now());
  const activeFrame = useRef(0);
  const blinkTimer  = useRef(0);
  const noiseRef    = useRef<Noise[]>([]);
  const zzzsRef     = useRef<Zzz[]>([]);
  const rafRef      = useRef<number>(0);
  const lookStep    = useRef(0);
  const lookCount   = useRef(LOOK_SEQ[0][1]);

  // Milestone channels
  const channelTimerRef = useRef(0);
  const channelIdxRef   = useRef(0);
  const passedRef       = useRef<Set<number>>(new Set());
  const hypeRef         = useRef(0);

  // Random channels
  const randChTimerRef = useRef(0);
  const randChIdxRef   = useRef(0);

  // Click batching — no cooldown, flush to API every 250ms
  const pendingRef = useRef(0);
  const nickRef    = useRef("ANON");

  // Phosphor eye effects
  const lookRef       = useRef<LookDir>("c");
  const trailRef      = useRef<{ lx: number; ly: number }[]>([]);
  const clickFlashRef = useRef(0);
  const floatsRef     = useRef<{ y: number; life: number; max: number }[]>([]);
  const tapCountRef   = useRef(0);

  const [phase, setPhase] = useState<"pick" | "play">("pick");
  const [hype, setHype] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ alias: string; clicks: number }[]>([]);

  const fetchHype = useCallback(async () => {
    try {
      const r = await fetch("/api/hype");
      const d = await r.json();
      const n = Number(d.total ?? 0);
      setHype(n);
      hypeRef.current = n;
      MILESTONES.forEach((m, i) => { if (n >= m) passedRef.current.add(i); });
    } catch {}
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await fetch("/api/leaderboard");
      const d = await r.json();
      if (Array.isArray(d.users)) {
        setLeaderboard(d.users.slice(0, 4).map((u: { alias: string; clicks: number }) => ({
          alias: String(u.alias).slice(0, 4).toUpperCase(),
          clicks: Number(u.clicks),
        })));
      }
    } catch {}
  }, []);

  const fetchMyScore = useCallback(async () => {
    const nick = nickRef.current;
    if (!nick || nick === "ANON") return;
    try {
      const r = await fetch(`/api/myscore?nick=${nick}`);
      const d = await r.json();
      setMyScore(Number(d.total ?? 0));
    } catch {}
  }, []);

  // Restore saved nick from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("eyetv_nick");
    if (saved && /^[A-Z]{4}$/.test(saved)) {
      nickRef.current = saved;
      setPhase("play");
      fetch(`/api/myscore?nick=${saved}`)
        .then(r => r.json())
        .then(d => setMyScore(Number(d.total ?? 0)))
        .catch(() => {});
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHype();
    fetchLeaderboard();
    fetchMyScore();
    const hypeId = setInterval(fetchHype, 15_000);
    const lbId   = setInterval(fetchLeaderboard, 30_000);
    const myId   = setInterval(fetchMyScore, 30_000);
    return () => { clearInterval(hypeId); clearInterval(lbId); clearInterval(myId); };
  }, [fetchHype, fetchLeaderboard, fetchMyScore]);

  // Batch flush — sends accumulated clicks to API every 250ms
  useEffect(() => {
    const id = setInterval(async () => {
      const count = pendingRef.current;
      if (count === 0) return;
      pendingRef.current = 0;
      try {
        const r = await fetch("/api/hype", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count, nick: nickRef.current }),
        });
        const d = await r.json();
        if (d.total != null) {
          const n = Number(d.total);
          setHype(n);
          hypeRef.current = n;
          MILESTONES.forEach((m, i) => { if (n >= m) passedRef.current.add(i); });
        }
        setMyScore(s => s + count);
      } catch {}
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const elapsed = (Date.now() - lastClick.current) / 1000;

      let st = stateRef.current;
      if (st === "active" && activeFrame.current <= 0) st = "idle";
      if (elapsed > 120) st = "sleep";
      else if (elapsed > 45 && st !== "glitch" && st !== "active") {
        noiseRef.current = makeNoise();
        st = "glitch";
      }
      stateRef.current = st;

      let eyeOpen = true;
      if (st === "idle" || st === "active") {
        blinkTimer.current = (blinkTimer.current + 1) % 240;
        eyeOpen = blinkTimer.current < 233;
      }

      let look: LookDir = "c";
      if (st === "idle" || st === "active") {
        lookCount.current--;
        if (lookCount.current <= 0) {
          lookStep.current = (lookStep.current + 1) % LOOK_SEQ.length;
          lookCount.current = LOOK_SEQ[lookStep.current][1];
        }
        look = LOOK_SEQ[lookStep.current][0];
      } else {
        lookStep.current = 0;
        lookCount.current = LOOK_SEQ[0][1];
      }
      lookRef.current = look;

      if (st === "active") activeFrame.current--;
      if (st === "glitch" && f % 10 === 0) noiseRef.current = makeNoise();
      if (st === "sleep"  && f % 100 === 0)
        zzzsRef.current.push({ x: 20 + Math.random() * 3, y: 7, life: 70, maxLife: 70 });

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      drawMonitor(ctx);

      // Priority: milestone channel > random channel > normal states
      if (channelTimerRef.current > 0) {
        const chIdx     = channelIdxRef.current;
        const maxT      = CH_DURATION[chIdx] - CH_INTRO;
        const remaining = channelTimerRef.current;
        if (remaining > maxT) drawStaticBurst(ctx);
        else drawChannelCard(ctx, chIdx, maxT - remaining, maxT);
        channelTimerRef.current--;
      } else if (randChTimerRef.current > 0) {
        drawRandomChannel(ctx, randChIdxRef.current, f);
        randChTimerRef.current--;
      } else if (st === "glitch") {
        noiseRef.current.forEach(n => px(ctx, n.x, n.y, n.c));
      } else if (st === "sleep") {
        drawSleepEye(ctx);
        zzzsRef.current.forEach(z => {
          ctx.globalAlpha = (z.life / z.maxLife) * 0.55;
          const gx = Math.round(z.x), gy = Math.round(z.y);
          [gx,gx+1,gx+2].forEach(x => px(ctx,x,gy,C.zzz));
          px(ctx,gx+2,gy+1,C.zzz); px(ctx,gx+1,gy+2,C.zzz);
          [gx,gx+1,gx+2].forEach(x => px(ctx,x,gy+3,C.zzz));
          z.y -= 0.04; z.life--;
        });
        zzzsRef.current = zzzsRef.current.filter(z => z.life > 0);
        ctx.globalAlpha = 1;
      } else {
        // ── Phosphor iris trail ─────────────────────────
        trailRef.current.forEach((t, i) => {
          const a = Math.max(0, 1 - i / trailRef.current.length) * 0.22;
          ctx.globalAlpha = a;
          // iris glow blob at past position
          ctx.fillStyle = "#4a7898";
          ctx.fillRect((14 + t.lx) * PX, (11 + t.ly) * PX, 5 * PX, 5 * PX);
          ctx.fillStyle = "#6a98c0";
          ctx.fillRect((14 + t.lx) * PX, (11 + t.ly) * PX, 5 * PX, PX);
        });
        ctx.globalAlpha = 1;

        // ── Main eye ────────────────────────────────────
        drawEye(ctx, !eyeOpen, look, st === "active");

        // ── Static → Signal overlay (clears with global hype) ──
        if (channelTimerRef.current <= 0 && randChTimerRef.current <= 0) {
          const baseDensity = Math.max(0, 1 - hypeRef.current / HYPE_GOAL);
          const flash = Math.min(1, clickFlashRef.current / 18);
          const density = baseDensity * (1 - flash * 0.78) * 0.80;
          if (density > 0.015) {
            for (let y = 3; y < 23; y++)
              for (let x = 4; x < 28; x++)
                if (Math.random() < density) {
                  const v = Math.random();
                  px(ctx, x, y, v > 0.5 ? "#4a5a64" : "#010306");
                }
          }
          // Click flash: brief blue-white glow on screen
          if (clickFlashRef.current > 0) {
            const glow = (clickFlashRef.current / 18) * 0.12;
            ctx.globalAlpha = glow;
            ctx.fillStyle = "#8ab8d8";
            ctx.fillRect(4 * PX, 3 * PX, 24 * PX, 20 * PX);
            ctx.globalAlpha = 1;
          }
        }
        if (clickFlashRef.current > 0) clickFlashRef.current--;

        // ── Floating +1 texts (drawn on canvas) ─────────
        ctx.textAlign = "center";
        floatsRef.current.forEach(fl => {
          ctx.globalAlpha = (fl.life / fl.max) * 0.95;
          ctx.fillStyle = "#6ab8d0";
          ctx.font = "bold 9px monospace";
          ctx.fillText("+1", 96, fl.y);
          fl.y -= 0.7;
          fl.life--;
        });
        ctx.globalAlpha = 1;
        floatsRef.current = floatsRef.current.filter(fl => fl.life > 0);

        // ── TAP hint — first visit ───────────────────────
        if (tapCountRef.current === 0 && Math.floor(f / 28) % 2 === 0) {
          ctx.fillStyle = "#2a5a70";
          ctx.font = "6px monospace";
          ctx.textAlign = "center";
          ctx.fillText("TAP", 96, 128);
        }
      }

      drawGrain(ctx, W, H);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // No cooldown — register every tap/click instantly
  const handleClick = useCallback(() => {
    stateRef.current = "active";
    activeFrame.current = 30;
    lastClick.current = Date.now();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);

    const prev = hypeRef.current;
    const next = prev + 1;
    hypeRef.current = next;

    // Check milestone crossing
    let milestoneTriggered = false;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (prev < MILESTONES[i] && next >= MILESTONES[i] && !passedRef.current.has(i)) {
        passedRef.current.add(i);
        channelTimerRef.current = CH_DURATION[i];
        channelIdxRef.current = i;
        milestoneTriggered = true;
        break;
      }
    }

    if (!milestoneTriggered && channelTimerRef.current <= 0 && Math.random() < RAND_CH_PROB) {
      randChTimerRef.current = 28 + Math.floor(Math.random() * 26);
      randChIdxRef.current = Math.floor(Math.random() * RAND_CH_COUNT);
    }

    setHype(h => h + 1);
    pendingRef.current++;

    clickFlashRef.current = 18;
    floatsRef.current.push({ y: 72, life: 36, max: 36 });
    const [lx, ly] = LOOK_OFFSET[lookRef.current];
    trailRef.current.unshift({ lx, ly });
    if (trailRef.current.length > 8) trailRef.current.pop();
    tapCountRef.current++;
  }, []);

  const pct = Math.min((hype / HYPE_GOAL) * 100, 100);
  const RANK_COLORS = ["#5a9ab8", "#3a7090", "#2a5068", "#1e3a4a"];
  const RANK_PREFIX = ["#1", "#2", "#3", "#4"];
  const milestoneLabels = ["5K", "10K", "15K", "20K"];

  const nextMilestone = MILESTONES.find(m => hype < m);
  const toNext = nextMilestone ? nextMilestone - hype : null;
  const nextLabel = nextMilestone ? (nextMilestone >= 1000 ? `${nextMilestone / 1000}K` : String(nextMilestone)) : null;

  const handleConfirm = useCallback((nick: string) => {
    nickRef.current = nick;
    localStorage.setItem("eyetv_nick", nick);
    setPhase("play");
    setMyScore(0);
    fetch(`/api/myscore?nick=${nick}`)
      .then(r => r.json())
      .then(d => setMyScore(Number(d.total ?? 0)))
      .catch(() => {});
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([10, 30, 10]);
  }, []);

  if (phase === "pick") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, userSelect: "none" }}>
        <NamePicker onConfirm={handleConfirm} />
        <div style={{ width: 220 }} /> {/* spacer to match play layout height */}
      </div>
    );
  }

  const W = "clamp(192px, 72vw, 280px)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, userSelect: "none" }}>

      {/* Canvas + overlays */}
      <div style={{ position: "relative", width: W, height: W, flexShrink: 0 }}
        onPointerDown={handleClick}>
        <canvas
          ref={canvasRef}
          width={192} height={192}
          style={{ cursor: "crosshair", imageRendering: "pixelated", display: "block", touchAction: "none", width: "100%", height: "100%" }}
        />

      </div>

      <div style={{ width: W, display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Progress bar */}
        <div>
          <div style={{ width: "100%", height: 6, background: "#0a0e14", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${pct}%`,
              background: "linear-gradient(90deg, #1a4060, #2a8090)",
              boxShadow: "0 0 10px rgba(42,128,144,0.7)",
              borderRadius: 3, transition: "width 0.3s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            {milestoneLabels.map((label, i) => (
              <span key={i} style={{
                fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                color: hype >= MILESTONES[i] ? "#2a8090" : "#162030",
              }}>{label}</span>
            ))}
          </div>
        </div>

        {/* Hype count */}
        <p style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: 11,
          color: "#3a6888", letterSpacing: "0.08em",
          textAlign: "center", margin: 0,
          textShadow: "0 0 14px rgba(42,112,144,0.6)",
        }}>
          {hype.toLocaleString()}
          <span style={{ color: "#1e3a4a", fontSize: 7 }}> / {HYPE_GOAL.toLocaleString()}</span>
        </p>

        {/* Next unlock */}
        {toNext !== null && (
          <p style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 6,
            color: "#1e4a5a", letterSpacing: "0.1em",
            textAlign: "center", margin: 0,
          }}>
            unlock ch.{(MILESTONES.indexOf(nextMilestone!) + 1)} in {toNext.toLocaleString()}
          </p>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "#0a1820", margin: "2px 0" }} />

        {/* Nick + personal score + change */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 8,
              color: "#2a6888", letterSpacing: "0.1em",
              textShadow: "0 0 8px rgba(42,104,136,0.4)",
            }}>▶ {nickRef.current}</span>
            <span style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 7,
              color: "#1e5068", letterSpacing: "0.05em",
            }}>{myScore.toLocaleString()} pts</span>
          </div>
          <button
            onPointerDown={() => { localStorage.removeItem("eyetv_nick"); setPhase("pick"); setMyScore(0); }}
            style={{
              background: "none", border: "1px solid #0e2030", cursor: "pointer",
              fontFamily: "'Press Start 2P', monospace", fontSize: 6,
              color: "#1e3a4a", letterSpacing: "0.1em", touchAction: "none",
              padding: "4px 8px", borderRadius: 2,
            }}
          >change</button>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 2 }}>
            <p style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 6,
              color: "#1a3040", letterSpacing: "0.25em",
              textAlign: "center", margin: "0 0 6px",
            }}>— TOP SIGNAL —</p>
            {leaderboard.map((entry, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                color: RANK_COLORS[i], letterSpacing: "0.08em",
                padding: "4px 0",
                borderBottom: i < leaderboard.length - 1 ? "1px solid #0a1820" : "none",
                textShadow: i === 0 ? "0 0 10px rgba(90,154,184,0.4)" : "none",
              }}>
                <span style={{ color: RANK_COLORS[i], opacity: 0.6, fontSize: 6 }}>{RANK_PREFIX[i]}</span>
                <span style={{ flex: 1, paddingLeft: 6 }}>{entry.alias}</span>
                <span>{entry.clicks.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
