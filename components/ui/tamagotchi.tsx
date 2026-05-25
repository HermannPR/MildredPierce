"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const PX          = 6;
const HYPE_GOAL   = 20_000;
const COOLDOWN_MS = 800;
const MILESTONES  = [5_000, 10_000, 15_000, 20_000];
const RAND_CH_COUNT = 7;   // number of random channel types
const RAND_CH_PROB  = 0.18; // chance per click

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

// ── Milestone channels (long, triggered at hype thresholds) ──

function drawChannelCard(ctx: CanvasRenderingContext2D, chIdx: number, timer: number) {
  switch (chIdx) {
    case 0: {
      const bars = ["#c89000","#c8c800","#00c8c8","#00c820","#0020c8","#c800c8","#c80020"];
      for (let y = 3; y < 23; y++) {
        const b = bars[Math.floor((y - 3) * bars.length / 20) % bars.length];
        for (let x = 4; x < 28; x++) px(ctx, x, y, b);
      }
      break;
    }
    case 1: {
      const bars = ["#c80020","#c87000","#c8c800","#00b820","#0028c8","#6000c8"];
      for (let x = 4; x < 28; x++) {
        const b = bars[Math.floor((x - 4) * bars.length / 24) % bars.length];
        for (let y = 3; y < 23; y++) px(ctx, x, y, b);
      }
      break;
    }
    case 2: {
      for (let y = 3; y < 23; y++) {
        for (let x = 4; x < 28; x++) {
          const even = ((x - 4) + (y - 3)) % 2 === 0;
          px(ctx, x, y, even ? "#0e1c28" : "#040810");
        }
      }
      const cx = 16, cy = 13;
      ([[8,"#1a3040"],[5,"#2a4858"],[2,"#6a8ea8"]] as [number,string][]).forEach(([r, rc]) => {
        for (let y = 3; y < 23; y++) for (let x = 4; x < 28; x++)
          if (Math.round(Math.sqrt((x-cx)**2+(y-cy)**2)) === r) px(ctx, x, y, rc);
      });
      break;
    }
    case 3: {
      const pulse = Math.sin((150 - timer) * 0.12) * 0.5 + 0.5;
      const b = Math.round(40 + pulse * 120);
      const g = Math.round(pulse * 45);
      ctx.fillStyle = `rgb(0,${g},${b})`;
      ctx.fillRect(4 * PX, 3 * PX, 24 * PX, 20 * PX);
      if (pulse > 0.65) {
        px(ctx, 13, 13, "#6a98c0");
        px(ctx, 16, 13, "#6a98c0");
        px(ctx, 19, 13, "#6a98c0");
      }
      break;
    }
  }
}

// ── Random channels (short, triggered ~18% chance on click) ──

function drawRandomChannel(ctx: CanvasRenderingContext2D, idx: number, frame: number) {
  const ch = idx % RAND_CH_COUNT;
  switch (ch) {
    case 0: {
      // Pure white/dark noise — sharp static
      for (let y = 3; y < 23; y++)
        for (let x = 4; x < 28; x++)
          px(ctx, x, y, Math.random() > 0.5 ? "#c8d0d8" : "#010306");
      break;
    }
    case 1: {
      // Blue test tone — flat solid with center pip
      ctx.fillStyle = "#080e18";
      ctx.fillRect(4*PX, 3*PX, 24*PX, 20*PX);
      px(ctx, 15, 12, "#6a98c0"); px(ctx, 16, 12, "#6a98c0"); px(ctx, 17, 12, "#6a98c0");
      px(ctx, 15, 13, "#6a98c0"); px(ctx, 16, 13, "#8ab8d0"); px(ctx, 17, 13, "#6a98c0");
      px(ctx, 15, 14, "#6a98c0"); px(ctx, 16, 14, "#6a98c0"); px(ctx, 17, 14, "#6a98c0");
      break;
    }
    case 2: {
      // Snowstorm — rolling divider between dark top and static bottom
      const divY = 3 + Math.floor((frame * 0.35) % 20);
      for (let y = 3; y < 23; y++) {
        for (let x = 4; x < 28; x++) {
          if (y < divY) px(ctx, x, y, "#020408");
          else px(ctx, x, y, Math.random() > 0.45 ? "#98a0a8" : "#040810");
        }
      }
      break;
    }
    case 3: {
      // Rolling horizontal interference bars
      for (let y = 3; y < 23; y++) {
        const band = Math.floor((frame * 0.6 + (y - 3) * 1.5) % 16);
        const inBand = band < 3;
        for (let x = 4; x < 28; x++)
          px(ctx, x, y, inBand ? "#050c14" : (Math.random() > 0.75 ? "#182028" : "#040810"));
      }
      break;
    }
    case 4: {
      // MILDRED PIERCE title card — the rare one
      rect(ctx, 4, 3, 24, 20, "#020508");
      rect(ctx, 4, 3, 24, 2, "#0a1820");   // top bar
      rect(ctx, 4, 21, 24, 2, "#0a1820");  // bottom bar
      // horizontal rule lines
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
      // Vertical scan lines shifting left
      for (let x = 4; x < 28; x++) {
        const phase = ((x - 4) * 3 + Math.floor(frame * 0.8)) % 8;
        const bright = phase < 2;
        for (let y = 3; y < 23; y++)
          px(ctx, x, y, bright ? "#0e1c28" : "#020408");
      }
      break;
    }
    case 6: {
      // NO SIGNAL card
      rect(ctx, 4, 3, 24, 20, "#020406");
      ctx.save();
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#142030";
      ctx.fillText("NO SIGNAL", 96, 76);
      ctx.restore();
      // corner marks
      px(ctx, 4, 3, "#0a1420");  px(ctx, 27, 3, "#0a1420");
      px(ctx, 4, 22, "#0a1420"); px(ctx, 27, 22, "#0a1420");
      break;
    }
  }
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
  const cooldownRef = useRef(false);
  const lookStep    = useRef(0);
  const lookCount   = useRef(LOOK_SEQ[0][1]);

  // Milestone channels (long, at hype thresholds)
  const channelTimerRef = useRef(0);
  const channelIdxRef   = useRef(0);
  const passedRef       = useRef<Set<number>>(new Set());
  const hypeRef         = useRef(0);

  // Random channels (short, ~18% per click)
  const randChTimerRef = useRef(0);
  const randChIdxRef   = useRef(0);

  const [hype, setHype] = useState(0);
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

  useEffect(() => {
    fetchHype();
    fetchLeaderboard();
    const hypeId = setInterval(fetchHype, 15_000);
    const lbId   = setInterval(fetchLeaderboard, 30_000);
    return () => { clearInterval(hypeId); clearInterval(lbId); };
  }, [fetchHype, fetchLeaderboard]);

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

      if (st === "active") activeFrame.current--;
      if (st === "glitch" && f % 10 === 0) noiseRef.current = makeNoise();
      if (st === "sleep"  && f % 100 === 0)
        zzzsRef.current.push({ x: 20 + Math.random() * 3, y: 7, life: 70, maxLife: 70 });

      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      drawMonitor(ctx);

      // Priority: milestone channel > random channel > normal states
      if (channelTimerRef.current > 0) {
        if (channelTimerRef.current > 120) drawStaticBurst(ctx);
        else drawChannelCard(ctx, channelIdxRef.current, channelTimerRef.current);
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
        drawEye(ctx, !eyeOpen, look, st === "active");
      }

      drawGrain(ctx, W, H);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = useCallback(async () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    stateRef.current = "active";
    activeFrame.current = 30;
    lastClick.current = Date.now();
    setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);

    // Milestone check
    const prev = hypeRef.current;
    const next = prev + 1;
    hypeRef.current = next;
    let milestoneTriggered = false;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (prev < MILESTONES[i] && next >= MILESTONES[i] && !passedRef.current.has(i)) {
        passedRef.current.add(i);
        channelTimerRef.current = 150;
        channelIdxRef.current = i;
        milestoneTriggered = true;
        break;
      }
    }

    // Random channel flip — ~18% chance, skips if milestone just triggered
    if (!milestoneTriggered && channelTimerRef.current <= 0 && Math.random() < RAND_CH_PROB) {
      randChTimerRef.current = 30 + Math.floor(Math.random() * 28); // 30–57 frames
      randChIdxRef.current = Math.floor(Math.random() * RAND_CH_COUNT);
    }

    setHype(h => h + 1);
    try {
      const r = await fetch("/api/hype", { method: "POST" });
      const d = await r.json();
      if (d.total != null) {
        setHype(Number(d.total));
        hypeRef.current = Number(d.total);
      }
    } catch {}
  }, []);

  const pct = Math.min((hype / HYPE_GOAL) * 100, 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, userSelect: "none" }}>
      <canvas
        ref={canvasRef}
        width={192}
        height={192}
        onClick={handleClick}
        style={{ cursor: "crosshair", imageRendering: "pixelated", display: "block" }}
      />

      <div style={{ width: 192, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Hype progress bar */}
        <div style={{ width: "100%", height: 4, background: "#0a0e14", borderRadius: 2, position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: "linear-gradient(90deg, #1a4060, #2a7090)",
            boxShadow: "0 0 8px rgba(42,112,144,0.7)",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Hype count */}
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "#3a6888",
          letterSpacing: "0.12em",
          textAlign: "center",
          margin: 0,
          textShadow: "0 0 10px rgba(42,112,144,0.5)",
        }}>
          HYPE {hype.toLocaleString()} / {HYPE_GOAL.toLocaleString()}
        </p>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
            {leaderboard.map((entry, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 6,
                color: i === 0 ? "#3a6888" : "#1e3a4a",
                letterSpacing: "0.08em",
                textShadow: i === 0 ? "0 0 8px rgba(42,112,144,0.4)" : "none",
              }}>
                <span>{entry.alias.padEnd(4)}</span>
                <span>{entry.clicks.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
