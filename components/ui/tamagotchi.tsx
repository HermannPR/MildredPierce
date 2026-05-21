"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const API = "/api";
const PX  = 6;

const C = {
  bg:       "#0a0a0f",
  body:     "#1e1a2e",
  bodyDark: "#12101e",
  tv:       "#2a2040",
  tvBorder: "#7b5ea7",
  screen:   "#0f1a2e",
  screenOn: "#1a3a6e",
  eye:      "#e0c0ff",
  pupil:    "#1a0a2e",
  lash:     "#c4b0ff",
  antenna:  "#7b5ea7",
  static:   "#c4b0ff",
  star:     "#ffd700",
  zzz:      "#7b5ea7",
  shine:    "#ffffff",
  scanLine: "#1a2a4e",
} as const;

type State = "idle" | "happy" | "glitch" | "sleep";

interface Star  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; }
interface Zzz   { x: number; y: number; life: number; maxLife: number; }
interface Static { x: number; y: number; c: string; }

function px(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, PX, PX);
}
function rect(ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, gw * PX, gh * PX);
}

function makeStatic(): Static[] {
  return Array.from({ length: 30 }, () => ({
    x: 6 + Math.floor(Math.random() * 12),
    y: 7 + Math.floor(Math.random() * 7),
    c: Math.random() > 0.5 ? C.static : C.tvBorder,
  }));
}

function drawBody(ctx: CanvasRenderingContext2D, dy: number) {
  rect(ctx, 8,  18 + dy, 16, 10, C.body);
  rect(ctx, 9,  19 + dy, 14,  8, C.bodyDark);
  rect(ctx, 5,  19 + dy,  3,  7, C.body);
  rect(ctx, 4,  24 + dy,  3,  2, C.bodyDark);
  rect(ctx, 24, 19 + dy,  3,  7, C.body);
  rect(ctx, 25, 24 + dy,  3,  2, C.bodyDark);
  rect(ctx, 10, 28 + dy,  5,  6, C.body);
  rect(ctx, 17, 28 + dy,  5,  6, C.body);
  rect(ctx, 10, 33 + dy,  5,  2, C.bodyDark);
  rect(ctx, 17, 33 + dy,  5,  2, C.bodyDark);
}

function drawEye(ctx: CanvasRenderingContext2D, dy: number, blink: boolean) {
  rect(ctx, 14, 8 + dy, 8, 5, C.eye);
  [14,15,17,18,19,20,21].forEach(x => px(ctx, x, 7 + dy, C.lash));
  px(ctx, 16, 6 + dy, C.lash);
  if (!blink) {
    rect(ctx, 17, 9 + dy, 3, 3, C.pupil);
    px(ctx, 17, 9 + dy, C.shine);
  } else {
    rect(ctx, 14, 10 + dy, 8, 1, C.lash);
  }
  [15, 18, 21].forEach(x => px(ctx, x, 13 + dy, C.lash));
  for (let row = 7; row <= 14; row += 2)
    [8,9,10,11,12].forEach(x => px(ctx, x, row + dy, C.scanLine));
}

function drawTV(ctx: CanvasRenderingContext2D, dy: number, blink: boolean, isGlitch: boolean, isSleep: boolean, noise: Static[]) {
  rect(ctx, 5, 4 + dy, 22, 15, C.tvBorder);
  rect(ctx, 6, 5 + dy, 20, 13, C.tv);
  const screenColor = isGlitch ? C.screenOn : (isSleep ? C.screen : C.screenOn);
  rect(ctx, 7, 6 + dy, 18, 10, screenColor);
  px(ctx, 14, 2 + dy, C.antenna);
  px(ctx, 15, 3 + dy, C.antenna);
  px(ctx, 16, 2 + dy, C.antenna);
  px(ctx, 15, 4 + dy, C.antenna);
  if (isGlitch) {
    noise.forEach(s => px(ctx, s.x, s.y + dy, s.c));
  } else if (!isSleep) {
    drawEye(ctx, dy, blink);
  }
}

// ── Component ──────────────────────────────────────────────────
export function Tamagotchi() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<State>("idle");
  const frameRef   = useRef(0);
  const lastClick  = useRef(Date.now());
  const bounceY    = useRef(0);
  const bounceDir  = useRef(1);
  const bounceFrame = useRef(0);
  const starsRef   = useRef<Star[]>([]);
  const zzzsRef    = useRef<Zzz[]>([]);
  const blinkTimer = useRef(0);
  const noiseRef   = useRef<Static[]>([]);
  const rafRef     = useRef<number>(0);
  const cooldownRef = useRef(false);

  const [score, setScore]   = useState(0);
  const [cooldown, setCooldown] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // leaderboard
  const [board, setBoard]   = useState<{rank:number;nick:string;score:number}[]>([]);
  const [nick, setNick]     = useState(["","","",""]);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scoreRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    try {
      const r = await fetch(`${API}/leaderboard`);
      setBoard(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, 30000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  // animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const elapsed = (Date.now() - lastClick.current) / 1000;

      // state transitions
      let st = stateRef.current;
      if (st === "happy" && bounceFrame.current <= 0) st = "idle";
      if (elapsed > 120) st = "sleep";
      else if (elapsed > 30 && st !== "glitch" && st !== "happy") {
        if (st !== "glitch") noiseRef.current = makeStatic();
        st = "glitch";
      }
      stateRef.current = st;

      // blink
      let eyeOpen = true;
      if (st === "idle" || st === "happy") {
        blinkTimer.current = (blinkTimer.current + 1) % 181;
        eyeOpen = blinkTimer.current < 175;
      }

      // bounce
      let dy = 0;
      if (st === "happy") {
        bounceFrame.current--;
        bounceY.current += bounceDir.current * 0.5;
        if (Math.abs(bounceY.current) > 3) bounceDir.current *= -1;
        dy = Math.round(bounceY.current);
        if (f % 3 === 0)
          starsRef.current.push(...Array.from({length:2}, () => ({
            x: 7 + Math.random() * 18, y: 5 + Math.random() * 10,
            life: 20, maxLife: 20,
            vx: (Math.random()-0.5)*0.3, vy: -0.15 - Math.random()*0.15,
          })));
      } else {
        bounceY.current = 0; bounceDir.current = 1;
      }

      if (st === "glitch" && f % 8 === 0) noiseRef.current = makeStatic();
      if (st === "sleep" && f % 90 === 0)
        zzzsRef.current.push({ x: 20 + Math.random()*4, y: 4, life: 60, maxLife: 60 });

      // draw
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawBody(ctx, dy);
      drawTV(ctx, dy, !eyeOpen, st==="glitch", st==="sleep", noiseRef.current);

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
        [gx,gx+1,gx+2].forEach(x => px(ctx,x,gy,C.zzz));
        px(ctx,gx+2,gy+1,C.zzz); px(ctx,gx+1,gy+2,C.zzz);
        [gx,gx+1,gx+2].forEach(x => px(ctx,x,gy+3,C.zzz));
        z.y -= 0.05; z.life--;
      });
      zzzsRef.current = zzzsRef.current.filter(z => z.life > 0);
      ctx.globalAlpha = 1;

      // status
      const msg = st==="sleep" ? "zzzz..." : st==="glitch" ? "feed me" : st==="happy" ? "♥" : "";
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

  // nick input handlers
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
      {/* Character */}
      <div className="flex flex-col items-center gap-2">
        <canvas
          ref={canvasRef}
          width={192}
          height={224}
          onClick={handleClick}
          className="cursor-pointer"
          style={{
            imageRendering: "pixelated",
            filter: cooldown
              ? "drop-shadow(0 0 4px #3a2a5a)"
              : "drop-shadow(0 0 12px #7b5ea7)",
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

      {/* Leaderboard */}
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

        {/* Nick submit */}
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
