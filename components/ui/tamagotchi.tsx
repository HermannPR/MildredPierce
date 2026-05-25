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
  bezel:    "#18202e",
  bezelHi:  "#252e40",
  bezelSh:  "#090c14",
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
  stand:    "#0e1420",
  standBase:"#0c1018",
  led:      "#00a030",
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

function drawGrain(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 0.028;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(4*PX + Math.random()*24*PX, 3*PX + Math.random()*20*PX, PX, PX);
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

// ── Platformer escape (channel 2) ────────────────────────────
const SAND_PX = 4, SAND_X0 = 24, SAND_Y0 = 18, SAND_CW = 36, SAND_CH = 30; // kept for signal catcher
const PF_X=24, PF_Y=18, PF_W=144, PF_H=120;
const PF_GRAVITY=0.35, PF_SPD=1.8, PF_JUMP_VEL=-5.8, PF_BOUNCE=-8.5;
const PF_PW=10, PF_PH=10;

interface PfLevel {
  platforms: {x:number;y:number;w:number}[];
  mushrooms: {x:number;y:number}[];
  goalX:number; goalY:number;
  eyeSpeed:number; eyeX:number; eyeY:number;
  reward:number;
}

const PF_LEVELS: PfLevel[] = [
  { reward:10, eyeSpeed:0.45, eyeX:110, eyeY:100, goalX:72, goalY:14,
    platforms:[{x:0,y:112,w:144},{x:22,y:88,w:40},{x:85,y:70,w:38},{x:42,y:52,w:52}],
    mushrooms:[] },
  { reward:20, eyeSpeed:0.7, eyeX:72, eyeY:104, goalX:72, goalY:12,
    platforms:[{x:0,y:112,w:58},{x:86,y:112,w:58},{x:58,y:92,w:28},{x:8,y:74,w:35},{x:100,y:74,w:36},{x:45,y:54,w:48}],
    mushrooms:[{x:72,y:87}] },
  { reward:30, eyeSpeed:1.05, eyeX:20, eyeY:106, goalX:122, goalY:10,
    platforms:[{x:0,y:112,w:38},{x:50,y:112,w:38},{x:100,y:112,w:44},{x:18,y:94,w:28},
      {x:72,y:88,w:32},{x:118,y:76,w:26},{x:8,y:62,w:30},{x:55,y:56,w:36},{x:105,y:46,w:38},{x:30,y:36,w:24}],
    mushrooms:[{x:95,y:57},{x:52,y:41}] },
  { reward:50, eyeSpeed:1.45, eyeX:72, eyeY:108, goalX:14, goalY:8,
    platforms:[{x:0,y:112,w:28},{x:36,y:112,w:22},{x:68,y:112,w:22},{x:100,y:112,w:22},{x:130,y:112,w:14},
      {x:118,y:96,w:20},{x:88,y:82,w:22},{x:60,y:70,w:20},{x:30,y:60,w:22},{x:6,y:48,w:22},
      {x:40,y:38,w:20},{x:72,y:28,w:20},{x:100,y:18,w:20},{x:120,y:8,w:24},{x:0,y:8,w:20}],
    mushrooms:[{x:44,y:27},{x:76,y:103},{x:106,y:7}] },
];

type PfResult = "ok" | "win" | "die";

function pfUpdate(
  player: {x:number;y:number;vx:number;vy:number;onGround:boolean},
  eye: {x:number;y:number;vx:number;vy:number},
  keys: {left:boolean;right:boolean;jump:boolean},
  jumpConsumed: {current:boolean},
  level: PfLevel
): PfResult {
  player.vx = keys.left ? -PF_SPD : keys.right ? PF_SPD : 0;
  if (keys.jump && player.onGround && !jumpConsumed.current) {
    player.vy = PF_JUMP_VEL; player.onGround = false; jumpConsumed.current = true;
  }
  if (!keys.jump) jumpConsumed.current = false;
  player.vy += PF_GRAVITY;
  player.x += player.vx; player.y += player.vy;
  if (player.x < 0) player.x = 0;
  if (player.x + PF_PW > PF_W) player.x = PF_W - PF_PW;
  player.onGround = false;
  for (const p of level.platforms) {
    if (player.x + PF_PW > p.x && player.x < p.x + p.w) {
      const prevBottom = player.y + PF_PH - player.vy;
      if (prevBottom <= p.y + 1 && player.y + PF_PH >= p.y) {
        player.y = p.y - PF_PH; player.vy = 0; player.onGround = true;
      }
    }
  }
  for (const m of level.mushrooms) {
    if (player.x+PF_PW>m.x && player.x<m.x+8 && player.y+PF_PH>=m.y && player.y+PF_PH<=m.y+10 && player.vy>0) {
      player.vy = PF_BOUNCE; player.y = m.y - PF_PH; player.onGround = false;
    }
  }
  if (player.y > PF_H + 20) return "die";
  if (Math.abs((player.x+PF_PW/2) - (level.goalX+4)) < 12 && Math.abs((player.y+PF_PH/2) - (level.goalY+4)) < 12) return "win";
  eye.x += eye.vx;
  if (eye.x < 0 || eye.x > PF_W-10) { eye.vx *= -1; eye.x = Math.max(0, Math.min(PF_W-10, eye.x)); }
  const eyeTargetY = player.y + Math.sin(Date.now()*0.0008)*18;
  eye.vy += (eyeTargetY - eye.y) * 0.018; eye.vy *= 0.88;
  eye.y += eye.vy;
  if (eye.y < 0) { eye.y=0; eye.vy=Math.abs(eye.vy)*0.5; }
  if (eye.y > PF_H-10) { eye.y=PF_H-10; eye.vy=-Math.abs(eye.vy)*0.5; }
  const ex=eye.x+5, ey=eye.y+4, px2=player.x+PF_PW/2, py2=player.y+PF_PH/2;
  if (Math.abs(ex-px2)<8 && Math.abs(ey-py2)<8) return "die";
  return "ok";
}

function pfDraw(
  ctx: CanvasRenderingContext2D,
  player: {x:number;y:number},
  eye: {x:number;y:number;vx:number},
  level: PfLevel,
  phase: "playing"|"dead"|"win",
  levelIdx: number,
  f: number
) {
  const ox=PF_X, oy=PF_Y;
  // Sky gradient — dark navy, clearly different from TV bezel
  ctx.fillStyle="#001428"; ctx.fillRect(ox,oy,PF_W,PF_H);
  // Stars
  ctx.fillStyle="#2a4870";
  for(let i=0;i<24;i++) ctx.fillRect(ox+((i*47)%PF_W), oy+((i*29)%60), 1, 1);
  ctx.fillStyle="#3a6090";
  for(let i=0;i<10;i++) ctx.fillRect(ox+((i*83+11)%PF_W), oy+((i*41+7)%55), 2, 2);

  // Platforms — bright teal, impossible to miss
  for (const p of level.platforms) {
    ctx.fillStyle="#104858"; ctx.fillRect(ox+p.x, oy+p.y, p.w, 7);
    ctx.fillStyle="#00d4f0"; ctx.fillRect(ox+p.x, oy+p.y, p.w, 3);
    ctx.fillStyle="#007090"; ctx.fillRect(ox+p.x, oy+p.y+3, p.w, 2);
    ctx.fillStyle="#003848"; ctx.fillRect(ox+p.x, oy+p.y+5, p.w, 2);
  }

  // Mushrooms — bright red cap
  for (const m of level.mushrooms) {
    const pulse=0.7+Math.sin(f*0.12)*0.3;
    ctx.globalAlpha=pulse;
    ctx.fillStyle="#cc0020"; ctx.fillRect(ox+m.x, oy+m.y, 10, 6);
    ctx.fillStyle="#ff4060"; ctx.fillRect(ox+m.x+1, oy+m.y, 8, 3);
    ctx.fillStyle="#ffffff"; ctx.fillRect(ox+m.x+2, oy+m.y+1, 2, 2);
    ctx.fillStyle="#ffffff"; ctx.fillRect(ox+m.x+6, oy+m.y, 2, 2);
    ctx.fillStyle="#6a1010"; ctx.fillRect(ox+m.x+2, oy+m.y+5, 6, 4);
    ctx.globalAlpha=1;
  }

  // Goal — pulsing bright green portal
  const gp=0.5+Math.sin(f*0.14)*0.5;
  ctx.globalAlpha=gp*0.35; ctx.fillStyle="#00ff88";
  ctx.fillRect(ox+level.goalX-4, oy+level.goalY-4, 16, 16);
  ctx.globalAlpha=1;
  ctx.fillStyle="#00aa55"; ctx.fillRect(ox+level.goalX, oy+level.goalY, 8, 8);
  ctx.fillStyle="#00ff88"; ctx.fillRect(ox+level.goalX+1, oy+level.goalY+1, 6, 6);
  ctx.fillStyle="#ccffdd"; ctx.fillRect(ox+level.goalX+2, oy+level.goalY+2, 4, 4);
  ctx.fillStyle="#ffffff"; ctx.fillRect(ox+level.goalX+3, oy+level.goalY+3, 2, 2);
  ctx.globalAlpha=gp;
  ctx.fillStyle="#00ff88"; ctx.font="5px monospace"; ctx.textAlign="center";
  ctx.fillText("▲",ox+level.goalX+4, oy+level.goalY-2);
  ctx.globalAlpha=1;

  // Eye enemy — big bright red
  const ex=Math.round(eye.x), ey2=Math.round(eye.y);
  const ep=0.7+Math.sin(f*0.1)*0.3;
  ctx.globalAlpha=ep*0.4; ctx.fillStyle="#ff0020";
  ctx.fillRect(ox+ex-3, oy+ey2-3, 16, 14);
  ctx.globalAlpha=1;
  ctx.fillStyle="#cc0010"; ctx.fillRect(ox+ex, oy+ey2, 10, 10);
  ctx.fillStyle="#ff2030"; ctx.fillRect(ox+ex+1, oy+ey2+1, 8, 8);
  ctx.fillStyle="#ff8090"; ctx.fillRect(ox+ex+2, oy+ey2+2, 4, 4);
  const pd=eye.vx>0?1:0;
  ctx.fillStyle="#110008"; ctx.fillRect(ox+ex+3+pd, oy+ey2+3, 3, 4);
  ctx.fillStyle="#ffffff"; ctx.fillRect(ox+ex+3+pd, oy+ey2+3, 1, 1);

  // Player — bright yellow, 10×10
  const pa=Math.round(player.x), pb=Math.round(player.y);
  if (phase==="dead")      { ctx.fillStyle="#ff3030"; }
  else if (phase==="win")  { ctx.fillStyle="#00ffcc"; }
  else                     { ctx.fillStyle="#ffe050"; }
  ctx.fillRect(ox+pa, oy+pb, 10, 10);
  ctx.fillStyle="#fff8c0"; ctx.fillRect(ox+pa+1, oy+pb+1, 8, 4);
  ctx.fillStyle="#221800"; ctx.fillRect(ox+pa+2, oy+pb+2, 2, 2);
  ctx.fillStyle="#221800"; ctx.fillRect(ox+pa+6, oy+pb+2, 2, 2);
  ctx.fillStyle="#aa7000"; ctx.fillRect(ox+pa, oy+pb+8, 10, 2);

  // Level label
  ctx.globalAlpha=1;
  ctx.fillStyle="#00d4f0"; ctx.font="bold 7px monospace"; ctx.textAlign="left";
  ctx.fillText(`LV${levelIdx+1}`, ox+3, oy+9);

  // Overlay for dead / win
  if (phase==="dead") {
    ctx.globalAlpha=0.85; ctx.fillStyle="#100008"; ctx.fillRect(ox+16,oy+40,112,36); ctx.globalAlpha=1;
    ctx.fillStyle="#ff4444"; ctx.font="bold 8px monospace"; ctx.textAlign="center";
    ctx.fillText("CAUGHT!",ox+72,oy+56);
    ctx.fillStyle="#aaaaaa"; ctx.font="6px monospace"; ctx.fillText("TAP TO RETRY",ox+72,oy+70);
  } else if (phase==="win") {
    ctx.globalAlpha=0.85; ctx.fillStyle="#001810"; ctx.fillRect(ox+12,oy+40,120,36); ctx.globalAlpha=1;
    ctx.fillStyle="#00ff88"; ctx.font="bold 8px monospace"; ctx.textAlign="center";
    ctx.fillText(`+${PF_LEVELS[levelIdx].reward} HYPE`,ox+72,oy+56);
    ctx.fillStyle="#aaffcc"; ctx.font="6px monospace";
    ctx.fillText(levelIdx<3?"TAP FOR NEXT":"ALL CLEAR",ox+72,oy+70);
  }
}


// ── Signal catcher (channel 3) ────────────────────────────────
interface CatchDot { x:number; y:number; vy:number; }

function updateCatcher(
  dots: CatchDot[], paddleX: {current:number}, targetX: {current:number|null},
  W: number, H: number, f: number, onCatch: ()=>void
) {
  if (f%22===0) dots.push({x:1+Math.floor(Math.random()*(W-2)), y:0, vy:0.22+Math.random()*0.28});
  if (targetX.current!==null) {
    const t=Math.max(0,Math.min(W-4,targetX.current));
    paddleX.current += (t-paddleX.current)*0.22;
  }
  for (let i=dots.length-1;i>=0;i--) {
    const d=dots[i]; d.y+=d.vy;
    const PY=H-3, px=Math.round(paddleX.current);
    if (d.y>=PY-0.5&&d.y<PY+1.5&&Math.round(d.x)>=px&&Math.round(d.x)<=px+3) {
      dots.splice(i,1); onCatch(); continue;
    }
    if (d.y>=H) dots.splice(i,1);
  }
}

function drawCatcher(ctx: CanvasRenderingContext2D, dots: CatchDot[], paddleX: number, score: number, W: number, H: number, f: number) {
  ctx.fillStyle="#010508"; ctx.fillRect(SAND_X0,SAND_Y0,W*SAND_PX,H*SAND_PX);
  for (const d of dots) {
    const px=SAND_X0+Math.round(d.x)*SAND_PX, py=SAND_Y0+Math.round(d.y)*SAND_PX;
    const col=Math.sin(f*0.1+d.x*0.5)>0?"#4aa0d8":"#6ac8f0";
    ctx.globalAlpha=0.15; ctx.fillStyle=col; ctx.fillRect(px-SAND_PX,py,SAND_PX*3,SAND_PX);
    ctx.globalAlpha=1; ctx.fillStyle=col; ctx.fillRect(px,py,SAND_PX,SAND_PX);
  }
  const ppx=SAND_X0+Math.round(paddleX)*SAND_PX, ppy=SAND_Y0+(H-3)*SAND_PX;
  ctx.fillStyle="#1a4870"; ctx.fillRect(ppx,ppy,4*SAND_PX,2*SAND_PX);
  ctx.fillStyle="#5ab0e0"; ctx.fillRect(ppx,ppy,4*SAND_PX,2);
  ctx.fillStyle="#1a4a60"; ctx.font="5px monospace"; ctx.textAlign="left";
  ctx.fillText(`${score}`,SAND_X0+2,SAND_Y0+7);
}

// ── Signal map ───────────────────────────────────────────────
// [lat, lon] center of each country (equirectangular projection)
const COUNTRY_POS: Record<string, [number, number]> = {
  US:[-97,38], CA:[-96,60], MX:[-102,24], BR:[-53,-10], AR:[-64,-34],
  CL:[-71,-35], CO:[-74,4],  PE:[-76,-10], VE:[-66,8],
  GB:[-2,54],  FR:[2,46],   DE:[10,51],  ES:[-4,40],  IT:[12,43],
  PT:[-8,39],  NL:[5,52],   BE:[4,51],   SE:[15,62],  NO:[10,64],
  DK:[10,56],  FI:[26,64],  PL:[20,52],  CZ:[15,50],  AT:[14,47],
  CH:[8,47],   GR:[22,39],  RO:[25,46],  HU:[19,47],
  RU:[100,60], UA:[32,49],  TR:[35,39],
  SA:[45,24],  AE:[54,24],  IL:[35,31],  IR:[53,32],
  CN:[105,35], JP:[138,36], KR:[128,37], IN:[77,20],  PK:[70,30],
  BD:[90,24],  ID:[118,-5], PH:[122,12], TH:[101,15], VN:[108,16],
  MY:[110,3],  SG:[104,1],  TW:[121,24],
  ZA:[25,-30], NG:[8,9],    EG:[30,27],  KE:[37,-1],  MA:[-7,32],
  GH:[-2,8],   ET:[40,9],   TZ:[35,-6],
  AU:[134,-25],NZ:[172,-41],
};

function latLonToXY(lat: number, lon: number, W: number, H: number): [number, number] {
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
}

// Simplified continent polygons [lon, lat][]
const LAND_SILHOUETTE: [number, number][][] = [
  // North America
  [[-168,72],[-130,72],[-55,72],[-55,46],[-76,44],[-82,28],[-88,16],[-93,15],
   [-100,20],[-110,22],[-120,32],[-125,48],[-140,60],[-168,62]],
  // Greenland
  [[-55,83],[-15,83],[-18,70],[-43,62],[-55,71]],
  // South America
  [[-78,11],[-60,12],[-48,3],[-35,-8],[-40,-23],[-65,-55],[-72,-50],[-78,-32],[-80,-2],[-75,10]],
  // Europe + Scandinavia
  [[-10,72],[30,72],[42,50],[35,38],[28,35],[10,37],[0,38],[-9,39],[-10,44],
   [-2,45],[5,48],[10,55],[-5,58],[5,57],[15,70],[30,70],[28,72]],
  // Africa + Arabia
  [[-18,37],[42,38],[55,24],[58,12],[50,12],[42,2],[40,-10],[35,-30],[18,-35],[-18,15]],
  // Asia (Turkey → Pacific coast, merged blob)
  [[28,72],[35,72],[135,72],[145,40],[140,35],[120,18],[100,-5],[78,8],[65,22],[45,12],[28,38],[28,72]],
  // Japan
  [[130,33],[132,40],[141,42],[142,35],[132,31]],
  // Australia
  [[114,-22],[130,-12],[136,-12],[152,-22],[154,-28],[148,-38],[136,-40],[124,-34],[114,-28]],
  // New Zealand
  [[166,-46],[172,-34],[178,-38],[172,-44],[166,-46]],
  // Antarctica
  [[-180,-65],[180,-65],[180,-90],[-180,-90]],
];

function drawWorldSilhouette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "#07131e";
  ctx.strokeStyle = "#0e2030";
  ctx.lineWidth = 0.5;
  for (const poly of LAND_SILHOUETTE) {
    ctx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const [lon, lat] = poly[i];
      const [x, y] = latLonToXY(lat, lon, W, H);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function SignalMap({ data }: { data: Record<string, number> }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const rafR = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const entries = Object.entries(data);
    const maxCount = entries.length ? Math.max(1, ...entries.map(([, v]) => v)) : 1;
    let frame = 0;

    function draw() {
      frame++;
      ctx.fillStyle = "#020408";
      ctx.fillRect(0, 0, W, H);
      drawWorldSilhouette(ctx, W, H);

      // Graticule
      ctx.strokeStyle = "#060e18";
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx <= W; gx += W / 6) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += H / 3) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // Dim dots — all tracked country positions
      Object.entries(COUNTRY_POS).forEach(([code, [lon, lat]]) => {
        if (data[code]) return;
        const [x, y] = latLonToXY(lat, lon, W, H);
        ctx.fillStyle = "#162840";
        ctx.beginPath(); ctx.arc(x, y, 1.0, 0, Math.PI * 2); ctx.fill();
      });

      // Active dots — pulse
      entries.forEach(([code, count]) => {
        const pos = COUNTRY_POS[code];
        if (!pos) return;
        const [lon, lat] = pos;
        const [x, y] = latLonToXY(lat, lon, W, H);
        const ratio = count / maxCount;
        const pulse = 0.72 + Math.sin(frame * 0.055 + x * 0.08) * 0.28;
        const size  = 1.5 + ratio * 3.5;
        const alpha = (0.45 + ratio * 0.55) * pulse;

        const g = ctx.createRadialGradient(x, y, 0, x, y, size * 4.5);
        g.addColorStop(0, `rgba(42,144,200,${(alpha * 0.55).toFixed(3)})`);
        g.addColorStop(1, "rgba(42,144,200,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, size * 4.5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(100,200,240,${alpha.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      });

      rafR.current = requestAnimationFrame(draw);
    }

    rafR.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafR.current);
  }, [data]);

  return (
    <canvas ref={ref} width={280} height={140}
      style={{ width: "100%", height: "auto", display: "block" }} />
  );
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if      (e.key === "ArrowLeft")  setCursor(c => Math.max(0, c - 1));
      else if (e.key === "ArrowRight") setCursor(c => Math.min(3, c + 1));
      else if (e.key === "ArrowUp")   { e.preventDefault(); cycle(cursor, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); cycle(cursor,  1); }
      else if (e.key === "Enter")      onConfirm(chars.join(""));
      else if (e.key === "Backspace") {
        setCursor(c => {
          const prev = Math.max(0, c - 1);
          setChars(ch => { const n = [...ch]; n[prev] = "A"; return n; });
          return prev;
        });
      } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const letter = e.key.toUpperCase();
        setChars(prev => { const n = [...prev]; n[cursor] = letter; return n; });
        setCursor(c => Math.min(3, c + 1));
      }
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
      background: "#0a0f1a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 18,
      border: "1px solid #1a3050",
      boxShadow: "0 0 40px rgba(20,80,180,0.5), inset 0 0 30px rgba(0,20,60,0.4)",
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

  // Multi-channel system
  const activeChRef   = useRef(1);
  const catchDots     = useRef<CatchDot[]>([]);
  const catchPaddleX  = useRef(16.0);
  const catchScoreRef = useRef(0);
  const catchTargetX  = useRef<number|null>(null);

  // Platformer state
  const keysRef       = useRef({ left: false, right: false, jump: false });
  const jumpConsumed  = useRef(false);
  const platLevelRef  = useRef(0);
  const platPhaseRef  = useRef<"playing"|"dead"|"win">("playing");
  const platDeadTimer = useRef(0);
  const platWinTimer  = useRef(0);
  const playerPlatRef = useRef({ x: 20.0, y: 100.0, vx: 0.0, vy: 0.0, onGround: false });
  const eyeEnemyRef   = useRef({ x: 110.0, y: 100.0, vx: 0.4, vy: 0.1 });

  const [phase, setPhase] = useState<"pick" | "play">("pick");
  const [hype, setHype] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ alias: string; clicks: number }[]>([]);
  const [signalMap, setSignalMap] = useState<Record<string, number>>({});
  const [activeCh, setActiveCh]   = useState(1);

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

  const fetchSignalMap = useCallback(async () => {
    try {
      const r = await fetch("/api/signalmap");
      const d = await r.json();
      if (d.countries && typeof d.countries === "object") setSignalMap(d.countries);
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

  const initPlatLevel = useCallback((idx: number) => {
    const lv = PF_LEVELS[idx];
    platLevelRef.current = idx;
    platPhaseRef.current = "playing";
    platDeadTimer.current = 0;
    platWinTimer.current = 0;
    // Start player on first platform
    const floor = lv.platforms.find(p => p.y >= 100) ?? lv.platforms[0];
    playerPlatRef.current = { x: floor.x + 4, y: floor.y - PF_PH - 1, vx: 0, vy: 0, onGround: true };
    eyeEnemyRef.current = { x: lv.eyeX, y: lv.eyeY, vx: lv.eyeSpeed, vy: 0.1 };
    keysRef.current = { left: false, right: false, jump: false };
    jumpConsumed.current = false;
  }, []);

  // Keyboard controls for platformer
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") keysRef.current.left  = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = true;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
        e.preventDefault(); keysRef.current.jump = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") keysRef.current.left  = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") keysRef.current.jump = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Init platformer when switching to CH.2
  useEffect(() => {
    if (activeCh === 2) initPlatLevel(platLevelRef.current);
  }, [activeCh, initPlatLevel]);

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

      ctx.clearRect(0, 0, W, H);
      drawMonitor(ctx);

      const ch = activeChRef.current;

      // DEBUG — top-left dots: green=loop alive, yellow=ch2 active
      ctx.fillStyle = "#00ff00"; ctx.fillRect(0, 0, 5, 5);
      if (ch === 2) { ctx.fillStyle = "#ffff00"; ctx.fillRect(6, 0, 5, 5); }
      // DEBUG — log to console every 120 frames
      if (f % 120 === 0) console.log("[EyeTV debug]", { ch, frame: f, platPhase: platPhaseRef.current, playerY: Math.round(playerPlatRef.current.y) });

      if (ch === 2) {
        // ── Platformer Escape ─────────────────────────────
        const platPh = platPhaseRef.current;
        if (platPh === "playing") {
          const res = pfUpdate(playerPlatRef.current, eyeEnemyRef.current, keysRef.current, jumpConsumed, PF_LEVELS[platLevelRef.current]);
          if (res === "die") { platPhaseRef.current = "dead"; platDeadTimer.current = 90; }
          else if (res === "win") {
            platPhaseRef.current = "win"; platWinTimer.current = 90;
            const reward = PF_LEVELS[platLevelRef.current].reward;
            pendingRef.current += reward; hypeRef.current += reward;
            setHype(h => h + reward); setMyScore(s => s + reward);
            MILESTONES.forEach((m, mi) => { if (hypeRef.current >= m) passedRef.current.add(mi); });
          }
        } else if (platPh === "dead") {
          platDeadTimer.current--;
          if (platDeadTimer.current <= 0) initPlatLevel(platLevelRef.current);
        } else if (platPh === "win") {
          platWinTimer.current--;
          if (platWinTimer.current <= 0) {
            const next = Math.min(platLevelRef.current + 1, PF_LEVELS.length - 1);
            initPlatLevel(next);
          }
        }
        pfDraw(ctx, playerPlatRef.current, eyeEnemyRef.current, PF_LEVELS[platLevelRef.current], platPh, platLevelRef.current, f);

      } else if (ch === 3) {
        // ── Signal Catcher ────────────────────────────────
        updateCatcher(catchDots.current, catchPaddleX, catchTargetX, SAND_CW, SAND_CH, f, () => {
          catchScoreRef.current++;
          pendingRef.current++;
          hypeRef.current++;
          setHype(h => h + 1);
          setMyScore(s => s + 1);
        });
        drawCatcher(ctx, catchDots.current, catchPaddleX.current, catchScoreRef.current, SAND_CW, SAND_CH, f);

      } else {
        // ── Channel 1 — Eye TV ───────────────────────────
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
      } // end ch===1

      drawGrain(ctx);
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

  // Multi-channel pointer handling
  const toCanvasCoords = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { cx: ((e.clientX-r.left)/r.width)*192, cy: ((e.clientY-r.top)/r.height)*192 };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const ch = activeChRef.current;
    if (ch === 2) {
      // Canvas thirds: left third = left, right third = right, center = jump
      const c = toCanvasCoords(e);
      if (c) {
        const third = PF_W / 3;
        if (c.cx - PF_X < third) { keysRef.current.left = true; keysRef.current.right = false; }
        else if (c.cx - PF_X > PF_W - third) { keysRef.current.right = true; keysRef.current.left = false; }
        else keysRef.current.jump = true;
      }
    } else if (ch === 3) {
      const c = toCanvasCoords(e);
      if (c) catchTargetX.current = (c.cx - SAND_X0) / SAND_PX - 2;
    } else {
      handleClick();
    }
  }, [handleClick, toCanvasCoords]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ch = activeChRef.current;
    if (ch === 3) { const c = toCanvasCoords(e); if (c) catchTargetX.current = (c.cx-SAND_X0)/SAND_PX-2; }
  }, [toCanvasCoords]);

  const handlePointerUp = useCallback(() => {
    keysRef.current = { left: false, right: false, jump: false };
    catchTargetX.current = null;
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

  const W = "clamp(280px, 88vw, 420px)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, userSelect: "none" }}>

      {/* Canvas — always in DOM so animation loop can start immediately */}
      <div style={{ position: "relative", width: W, height: W, flexShrink: 0 }}
        onPointerDown={phase === "play" ? handlePointerDown : undefined}
        onPointerMove={phase === "play" ? handlePointerMove : undefined}
        onPointerUp={phase === "play" ? handlePointerUp : undefined}
        onPointerLeave={phase === "play" ? handlePointerUp : undefined}>
        <canvas
          ref={canvasRef}
          width={192} height={192}
          style={{ imageRendering: "pixelated", display: "block", touchAction: "none", width: "100%", height: "100%" }}
        />
        {/* NamePicker overlay — sits on top of canvas, removed once name confirmed */}
        {phase === "pick" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(2,4,8,0.92)",
            zIndex: 10,
          }}>
            <NamePicker onConfirm={handleConfirm} />
          </div>
        )}
      </div>

      {/* Channel selector — standalone row, reliable tap targets */}
      <div style={{ display:"flex", gap:8, width:W }}>
        {([{ch:1,label:"CH.1 EYE"},{ch:2,label:"CH.2 RUN"},{ch:3,label:"CH.3 CATCH"}] as {ch:number,label:string}[]).map(({ch,label})=>(
          <button key={ch}
            onPointerDown={()=>{ setActiveCh(ch); activeChRef.current=ch; }}
            style={{
              flex:1, fontFamily:"'Press Start 2P', monospace", fontSize:"clamp(6px,2vw,9px)",
              background: activeCh===ch ? "#0a1e34" : "#050a10",
              border:`2px solid ${activeCh===ch?"#3a8aaa":"#0e1c28"}`,
              color: activeCh===ch ? "#6ab8d8" : "#1e3a4a",
              padding:"10px 0", cursor:"pointer", touchAction:"none",
              boxShadow: activeCh===ch ? "0 0 14px rgba(58,138,170,0.7)" : "none",
              textShadow: activeCh===ch ? "0 0 10px rgba(106,184,216,0.9)" : "none",
              letterSpacing:"0.08em",
            }}>{label}</button>
        ))}
      </div>

      {/* Fixed L / R side buttons — platformer only */}
      {activeCh===2 && (<>
        <button
          onPointerDown={()=>{keysRef.current.left=true;}} onPointerUp={()=>{keysRef.current.left=false;}}
          onPointerLeave={()=>{keysRef.current.left=false;}} onPointerCancel={()=>{keysRef.current.left=false;}}
          style={{ position:"fixed", left:0, top:"50%", transform:"translateY(-50%)",
            width:52, height:130, zIndex:9000,
            fontFamily:"'Press Start 2P', monospace", fontSize:22,
            background:"rgba(3,10,22,0.9)", border:"1px solid #1a4060", borderLeft:"none",
            color:"#3a7898", cursor:"pointer", touchAction:"none", userSelect:"none",
            boxShadow:"4px 0 20px rgba(0,50,110,0.45)", borderRadius:"0 8px 8px 0",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>◀</button>
        <button
          onPointerDown={()=>{keysRef.current.right=true;}} onPointerUp={()=>{keysRef.current.right=false;}}
          onPointerLeave={()=>{keysRef.current.right=false;}} onPointerCancel={()=>{keysRef.current.right=false;}}
          style={{ position:"fixed", right:0, top:"50%", transform:"translateY(-50%)",
            width:52, height:130, zIndex:9000,
            fontFamily:"'Press Start 2P', monospace", fontSize:22,
            background:"rgba(3,10,22,0.9)", border:"1px solid #1a4060", borderRight:"none",
            color:"#3a7898", cursor:"pointer", touchAction:"none", userSelect:"none",
            boxShadow:"-4px 0 20px rgba(0,50,110,0.45)", borderRadius:"8px 0 0 8px",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>▶</button>
      </>)}

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
          fontFamily: "'Press Start 2P', monospace", fontSize: 15,
          color: "#3a6888", letterSpacing: "0.08em",
          textAlign: "center", margin: 0,
          textShadow: "0 0 14px rgba(42,112,144,0.6)",
        }}>
          {hype.toLocaleString()}
          <span style={{ color: "#1e3a4a", fontSize: 9 }}> / {HYPE_GOAL.toLocaleString()}</span>
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
              fontFamily: "'Press Start 2P', monospace", fontSize: 11,
              color: "#2a6888", letterSpacing: "0.1em",
              textShadow: "0 0 8px rgba(42,104,136,0.4)",
            }}>▶ {nickRef.current}</span>
            <span style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 9,
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
                fontFamily: "'Press Start 2P', monospace", fontSize: 10,
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
