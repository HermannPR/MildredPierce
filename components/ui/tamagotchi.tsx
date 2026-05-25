"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const API = "/api";
const PX  = 6;

const C = {
  bg:       "#0a0a0f",
  bezel:    "#111118",
  bezelHi:  "#1c1c2e",
  bezelSh:  "#08080e",
  screenOn: "#08101a",
  scanLine: "#0b1422",
  eyeWhite: "#b4ccde",
  iris:     "#1c3c5e",
  irisHi:   "#2a5278",
  pupil:    "#050810",
  shine:    "#cce4fa",
  noise:    "#1e3458",
  noiseHi:  "#18182c",
  zzz:      "#162030",
  star:     "#3898cc",
  stand:    "#0d0d1a",
  standBase:"#111128",
  ledDim:   "#002014",
  ledOn:    "#00b848",
} as const;

type State   = "idle" | "happy" | "glitch" | "sleep";
type LookDir = "c" | "r" | "l" | "u" | "d" | "ur" | "ul";

interface Star  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; }
interface Zzz   { x: number; y: number; life: number; maxLife: number; }
interface Noise { x: number; y: number; c: string; }

function px(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, PX, PX);
}
function rect(ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, gw * PX, gh * PX);
}

function makeNoise(): Noise[] {
  return Array.from({ length: 50 }, () => ({
    x: 5 + Math.floor(Math.random() * 22),
    y: 4 + Math.floor(Math.random() * 18),
    c: Math.random() > 0.4 ? C.noise : C.noiseHi,
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
};

// [direction, frames to hold]
const LOOK_SEQ: [LookDir, number][] = [
  ["c", 60], ["r", 22], ["c", 15], ["l", 22], ["c", 40],
  ["u", 18], ["ur", 14], ["c", 28], ["d", 18], ["c", 50],
  ["ul", 14], ["u", 14], ["c", 35],
];

// ── Monitor ──────────────────────────────────────────────────
// Canvas 192×192, grid 32×32 (PX=6)
// Bezel: (2,1)→(30,27) = 28w×26h
// Screen: (4,3)→(28,23) = 24w×20h
// Stand neck: (14,27) 4w×2h  Stand base: (9,29) 14w×2h

function drawMonitor(ctx: CanvasRenderingContext2D, dy: number) {
  rect(ctx, 2, 1+dy, 28, 26, C.bezel);
  for (let x = 2; x < 30; x++) px(ctx, x, 1+dy, C.bezelHi);
  for (let y = 2; y < 27; y++) px(ctx, 2, y+dy, C.bezelHi);
  for (let x = 2; x < 30; x++) px(ctx, x, 26+dy, C.bezelSh);
  for (let y = 1; y < 27; y++) px(ctx, 29, y+dy, C.bezelSh);

  rect(ctx, 4, 3+dy, 24, 20, C.screenOn);
  for (let row = 3; row < 23; row += 2)
    rect(ctx, 4, row+dy, 24, 1, C.scanLine);

  rect(ctx, 14, 27+dy, 4, 2, C.stand);
  rect(ctx, 9,  29+dy, 14, 2, C.standBase);

  px(ctx, 27, 25+dy, C.ledOn);
}

// ── Eye: idle look-around ────────────────────────────────────
// Eye center: gx=16, gy=13  Eye white: (10,10)→(22,16) = 12w×7h
function drawEye(ctx: CanvasRenderingContext2D, dy: number, blink: boolean, look: LookDir) {
  const ex = 16, ey = 13;
  const [lx, ly] = LOOK_OFFSET[look];

  if (blink) {
    rect(ctx, 10, ey+dy, 12, 1, C.eyeWhite);
    return;
  }

  // Eye white oval with trimmed corners
  rect(ctx, 10, ey-3+dy, 12, 7, C.eyeWhite);
  [0, 1].forEach(d => {
    px(ctx, 10, ey-3+d+dy, C.screenOn);
    px(ctx, 21, ey-3+d+dy, C.screenOn);
    px(ctx, 10, ey+3-d+dy, C.screenOn);
    px(ctx, 21, ey+3-d+dy, C.screenOn);
  });

  // Iris 5×5
  rect(ctx, ex-2+lx, ey-2+ly+dy, 5, 5, C.iris);
  for (let i = 0; i < 5; i++) px(ctx, ex-2+lx+i, ey-2+ly+dy, C.irisHi);
  px(ctx, ex-2+lx, ey-1+ly+dy, C.irisHi);

  // Pupil 3×3
  rect(ctx, ex-1+lx, ey-1+ly+dy, 3, 3, C.pupil);
  // Shine
  px(ctx, ex-1+lx, ey-1+ly+dy, C.shine);
}

// ── Eye: happy (arc) ─────────────────────────────────────────
function drawHappyEye(ctx: CanvasRenderingContext2D, dy: number) {
  const ex = 16, ey = 13;
  // Upper arc
  px(ctx, ex-3, ey+1+dy, C.eyeWhite);
  px(ctx, ex-2, ey+dy,   C.eyeWhite);
  px(ctx, ex-1, ey-1+dy, C.eyeWhite);
  px(ctx, ex,   ey-1+dy, C.eyeWhite);
  px(ctx, ex+1, ey-1+dy, C.eyeWhite);
  px(ctx, ex+2, ey+dy,   C.eyeWhite);
  px(ctx, ex+3, ey+1+dy, C.eyeWhite);
  // Fill solid bottom
  rect(ctx, ex-3, ey+2+dy, 7, 2, C.eyeWhite);
  // Sparkle
  px(ctx, ex-5, ey-1+dy, C.shine);
  px(ctx, ex+5, ey-1+dy, C.shine);
}

// ── Eye: sleep ───────────────────────────────────────────────
function drawSleepEye(ctx: CanvasRenderingContext2D, dy: number) {
  const ex = 16, ey = 13;
  rect(ctx, ex-4, ey+2+dy, 9, 1, C.eyeWhite);
  px(ctx, ex-3, ey+1+dy, C.eyeWhite);
  px(ctx, ex+4, ey+1+dy, C.eyeWhite);
}

// ── Component ────────────────────────────────────────────────
export function EyeTV() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef<State>("idle");
  const frameRef    = useRef(0);
  const lastClick   = useRef(Date.now());
  const bounceY     = useRef(0);
  const bounceDir   = useRef(1);
  const bounceFrame = useRef(0);
  const starsRef    = useRef<Star[]>([]);
  const zzzsRef     = useRef<Zzz[]>([]);
  const blinkTimer  = useRef(0);
  const noiseRef    = useRef<Noise[]>([]);
  const rafRef      = useRef<number>(0);
  const cooldownRef = useRef(false);
  const lookStep    = useRef(0);
  const lookCount   = useRef(LOOK_SEQ[0][1]);

  const [score, setScore]         = useState(0);
  const [cooldown, setCooldown]   = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [board, setBoard]         = useState<{rank:number;nick:string;score:number}[]>([]);
  const [nick, setNick]           = useState(["","","",""]);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scoreRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    try {
      const r = await fetch(`${API}/leaderboard`);
      const data = await r.json();
      // handle both legacy array and new {users, pet} format
      const rows = Array.isArray(data)
        ? data
        : (data.users ?? []).map((u: { rank: number; alias: string; clicks: number }) => ({
            rank: u.rank, nick: u.alias, score: u.clicks,
          }));
      setBoard(rows);
    } catch {}
  }, []);

  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, 30000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const elapsed = (Date.now() - lastClick.current) / 1000;

      let st = stateRef.current;
      if (st === "happy" && bounceFrame.current <= 0) st = "idle";
      if (elapsed > 120) st = "sleep";
      else if (elapsed > 30 && st !== "glitch" && st !== "happy") {
        if (st !== "glitch") noiseRef.current = makeNoise();
        st = "glitch";
      }
      stateRef.current = st;

      // blink
      let eyeOpen = true;
      if (st === "idle") {
        blinkTimer.current = (blinkTimer.current + 1) % 181;
        eyeOpen = blinkTimer.current < 175;
      }

      // look sequence (idle only)
      let look: LookDir = "c";
      if (st === "idle") {
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

      // bounce
      let dy = 0;
      if (st === "happy") {
        bounceFrame.current--;
        bounceY.current += bounceDir.current * 0.5;
        if (Math.abs(bounceY.current) > 3) bounceDir.current *= -1;
        dy = Math.round(bounceY.current);
        if (f % 3 === 0)
          starsRef.current.push(...Array.from({ length: 2 }, () => ({
            x: 5 + Math.random() * 22, y: 4 + Math.random() * 18,
            life: 22, maxLife: 22,
            vx: (Math.random() - 0.5) * 0.3, vy: -0.15 - Math.random() * 0.15,
          })));
      } else {
        bounceY.current = 0; bounceDir.current = 1;
      }

      if (st === "glitch" && f % 8 === 0) noiseRef.current = makeNoise();
      if (st === "sleep" && f % 90 === 0)
        zzzsRef.current.push({ x: 19 + Math.random() * 3, y: 8, life: 65, maxLife: 65 });

      // draw
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawMonitor(ctx, dy);

      if (st === "glitch") {
        noiseRef.current.forEach(n => px(ctx, n.x, n.y + dy, n.c));
      } else if (st === "sleep") {
        drawSleepEye(ctx, dy);
      } else if (st === "happy") {
        drawHappyEye(ctx, dy);
      } else {
        drawEye(ctx, dy, !eyeOpen, look);
      }

      // stars
      starsRef.current.forEach(s => {
        ctx.globalAlpha = s.life / s.maxLife;
        px(ctx, Math.round(s.x), Math.round(s.y) + dy, C.star);
        s.x += s.vx; s.y += s.vy; s.life--;
      });
      starsRef.current = starsRef.current.filter(s => s.life > 0);
      ctx.globalAlpha = 1;

      // zzz
      zzzsRef.current.forEach(z => {
        ctx.globalAlpha = z.life / z.maxLife;
        const gx = Math.round(z.x), gy = Math.round(z.y) + dy;
        [gx, gx+1, gx+2].forEach(x => px(ctx, x, gy, C.zzz));
        px(ctx, gx+2, gy+1, C.zzz); px(ctx, gx+1, gy+2, C.zzz);
        [gx, gx+1, gx+2].forEach(x => px(ctx, x, gy+3, C.zzz));
        z.y -= 0.05; z.life--;
      });
      zzzsRef.current = zzzsRef.current.filter(z => z.life > 0);
      ctx.globalAlpha = 1;

      const msg = st === "sleep" ? "zzzz..." : st === "glitch" ? "signal lost" : st === "happy" ? "♥" : "";
      setStatusMsg(msg);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = useCallback(() => {
    if (cooldownRef.current) return;
    const next = scoreRef.current + 1;
    scoreRef.current = next;
    setScore(next);
    stateRef.current = "happy";
    bounceFrame.current = 40;
    lastClick.current = Date.now();
    cooldownRef.current = true;
    setCooldown(true);
    setTimeout(() => { cooldownRef.current = false; setCooldown(false); }, 3000);
  }, []);

  const nickRefs = useRef<(HTMLInputElement|null)[]>([null,null,null,null]);

  const handleNickKey = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && nick[i] === "" && i > 0) nickRefs.current[i-1]?.focus();
  };
  const handleNickInput = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9]/,"").toUpperCase().slice(-1);
    const next = [...nick]; next[i] = val; setNick(next);
    if (val && i < 3) nickRefs.current[i+1]?.focus();
  };

  const handleSubmit = useCallback(async () => {
    const n = nick.join("").trim();
    if (!n) return;
    if (scoreRef.current < 1) { setSubmitMsg("click first!"); return; }
    setSubmitting(true);
    try {
      await fetch(`${API}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: n, score: scoreRef.current }),
      });
      setSubmitMsg("saved!");
      setNick(["","","",""]);
      await fetchBoard();
    } catch { setSubmitMsg("error"); }
    finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(""), 3000);
    }
  }, [nick, fetchBoard]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto select-none">
      <div className="flex flex-col items-center gap-2">
        <canvas
          ref={canvasRef}
          width={192}
          height={192}
          onClick={handleClick}
          className="cursor-pointer"
          style={{
            imageRendering: "pixelated",
            filter: cooldown
              ? "drop-shadow(0 0 4px #1a1a3a)"
              : "drop-shadow(0 0 10px #3a5a7a)",
            opacity: cooldown ? 0.55 : 1,
            transition: "opacity 0.2s, filter 0.2s",
          }}
        />
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:10, color:"#c4b0ff", letterSpacing:2 }}>
          SCORE: {score}
        </p>
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:"#7b5ea7", height:12, letterSpacing:1 }}>
          {statusMsg}
        </p>
      </div>

      <div className="w-full">
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:"#7b5ea7", textAlign:"center", marginBottom:12, letterSpacing:2 }}>
          — TOP 10 —
        </p>
        <table className="w-full border-collapse">
          <tbody>
            {board.length === 0 ? (
              <tr><td colSpan={3} style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:"#3a2a5a", textAlign:"center", padding:8 }}>NO SCORES YET</td></tr>
            ) : board.map((r) => (
              <tr key={r.rank} style={{ borderBottom:"1px solid #1e1a2e" }}>
                <td style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:"#4a3a6a", padding:"6px 4px", width:28 }}>#{r.rank}</td>
                <td style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color: r.rank===1?"#ffd700":"#e0d6ff", padding:"6px 4px" }}>{r.nick}</td>
                <td style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:"#c4b0ff", padding:"6px 4px", textAlign:"right" }}>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-center gap-3 mt-4">
          <div className="flex gap-2">
            {[0,1,2,3].map(i => (
              <input
                key={i}
                ref={el => { nickRefs.current[i] = el; }}
                value={nick[i]}
                maxLength={1}
                onKeyDown={handleNickKey(i)}
                onChange={handleNickInput(i)}
                className="w-10 h-11 text-center text-lg bg-[#0f0d1a] border-2 border-[#3a2a5a] text-[#e0d6ff] outline-none focus:border-[#7b5ea7] uppercase"
                style={{ fontFamily:"'Press Start 2P',monospace", caretColor:"#7b5ea7" }}
              />
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#7b5ea7] disabled:bg-[#3a2a5a] text-[#0a0a0f] px-5 py-2.5 hover:bg-[#c4b0ff] transition-colors"
            style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, letterSpacing:1 }}
          >
            SUBMIT
          </button>
          <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:"#7b5ea7", height:12 }}>{submitMsg}</p>
        </div>
      </div>
    </div>
  );
}
