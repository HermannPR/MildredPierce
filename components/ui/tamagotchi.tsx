"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const PX         = 6;
const HYPE_GOAL  = 20_000;
const COOLDOWN_MS = 800;

// ── Palette — muted, eerie, cinematic ───────────────────────
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

// Pupil offset [dx, dy] from eye center
const LOOK_OFFSET: Record<LookDir, [number, number]> = {
  c:  [ 0,  0],
  r:  [ 2,  0],
  l:  [-2,  0],
  u:  [ 0, -1],
  d:  [ 0,  1],
  ur: [ 2, -1],
  ul: [-2, -1],
  dl: [-2,  1],
};

// Slow, deliberate — eerie watching quality
const LOOK_SEQ: [LookDir, number][] = [
  ["c", 120], ["r", 38], ["c", 55], ["l", 32], ["c", 90],
  ["u", 28],  ["ur", 22], ["c", 100], ["dl", 24], ["c", 75],
  ["u", 22],  ["c", 110],
];

// ── Monitor ──────────────────────────────────────────────────
function drawMonitor(ctx: CanvasRenderingContext2D) {
  rect(ctx, 2, 1, 28, 26, C.bezel);
  for (let x = 2; x < 30; x++) px(ctx, x, 1, C.bezelHi);
  for (let y = 2; y < 27; y++) px(ctx, 2, y, C.bezelHi);
  for (let x = 2; x < 30; x++) px(ctx, x, 26, C.bezelSh);
  for (let y = 1; y < 27; y++) px(ctx, 29, y, C.bezelSh);

  rect(ctx, 4, 3, 24, 20, C.screen);
  for (let row = 3; row < 23; row += 2)
    rect(ctx, 4, row, 24, 1, C.scanLine);

  rect(ctx, 14, 27, 4, 2, C.stand);
  rect(ctx, 9,  29, 14, 2, C.standBase);
  px(ctx, 27, 25, C.led);
}

// ── Eye ──────────────────────────────────────────────────────
function drawEye(ctx: CanvasRenderingContext2D, blink: boolean, look: LookDir, wide: boolean) {
  const ex = 16, ey = 13;
  const [lx, ly] = LOOK_OFFSET[look];
  const topRow = wide ? ey - 4 : ey - 3;
  const height  = wide ? 9     : 7;

  // Phosphor bloom — faint halo
  ctx.globalAlpha = 0.07;
  rect(ctx, 9, topRow - 1, 14, height + 2, C.eyeWhite);
  ctx.globalAlpha = 1;

  if (blink) {
    rect(ctx, 10, ey, 12, 1, C.eyeWhite);
    return;
  }

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

  // zzz droop
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

  const [hype, setHype] = useState(0);

  const fetchHype = useCallback(async () => {
    try {
      const r = await fetch("/api/hype");
      const d = await r.json();
      setHype(Number(d.total ?? 0));
    } catch {}
  }, []);

  useEffect(() => {
    fetchHype();
    const id = setInterval(fetchHype, 15_000);
    return () => clearInterval(id);
  }, [fetchHype]);

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

      // Blink — rare
      let eyeOpen = true;
      if (st === "idle" || st === "active") {
        blinkTimer.current = (blinkTimer.current + 1) % 240;
        eyeOpen = blinkTimer.current < 233;
      }

      // Look sequence
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

      if (st === "glitch") {
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

    setHype(h => h + 1);
    try {
      const r = await fetch("/api/hype", { method: "POST" });
      const d = await r.json();
      if (d.total != null) setHype(Number(d.total));
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

      <div style={{ width: 192, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ width: "100%", height: 2, background: "#08080e", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: "#163040",
            transition: "width 0.4s ease",
          }} />
        </div>
        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: "#142030",
          letterSpacing: "0.12em",
          textAlign: "center",
          margin: 0,
        }}>
          HYPE {hype.toLocaleString()} / {HYPE_GOAL.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
