"use client";
import { useEffect, useRef, useState } from "react";

// ── Fast timeline (ms) ───────────
const T_STATIC   = 380;   // pure static noise
const T_SWITCH   = 160;   // sweeping bars
const T_FLASH    = 110;   // white flash
const T_FADE     = 680;   // smooth canvas fade-out
const T_TOTAL    = T_STATIC + T_SWITCH + T_FLASH + T_FADE + 80;

export function CRTIntro({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRef   = useRef<HTMLDivElement>(null);
  const vigRef    = useRef<HTMLDivElement>(null);
  const flashRef  = useRef<HTMLDivElement>(null);
  const cbRef     = useRef(onComplete);
  const [visible, setVisible] = useState(true);

  useEffect(() => { cbRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true })!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    let rafId: number;
    let lastPaint = 0;
    const NOISE_INT = 1000 / 30;
    const start = performance.now();

    const dissolveStart = T_STATIC + T_SWITCH + T_FLASH;

    const setFlash = (on: boolean) => {
      if (!flashRef.current) return;
      flashRef.current.style.transition = on ? "opacity 0.04s linear" : "opacity 0.07s linear";
      flashRef.current.style.opacity    = on ? "1" : "0";
    };

    const timeouts = [
      setTimeout(() => setFlash(true),   T_STATIC + T_SWITCH),
      setTimeout(() => setFlash(false),  T_STATIC + T_SWITCH + T_FLASH),
      setTimeout(() => { setVisible(false); cbRef.current(); }, T_TOTAL),
    ];

    function drawNoise(W: number, H: number) {
      const id = ctx.createImageData(W, H);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v  = (Math.random() * 255) | 0;
        d[i]   = (v * 0.88) | 0;   // R  (phosphor warmth)
        d[i+1] = (v * 0.96) | 0;   // G
        d[i+2] = (v * 0.74) | 0;   // B
        d[i+3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    }

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      if (!canvas) return;
      const el      = now - start;
      const W       = canvas.width;
      const H       = canvas.height;
      const doNoise = (now - lastPaint) >= NOISE_INT;

      ctx.clearRect(0, 0, W, H);

      if (el < dissolveStart) {
        // ── STATIC + SWITCHING ───────────────────────
        if (doNoise) {
          lastPaint = now;
          drawNoise(W, H);

          // Sweeping white bars during channel switch
          if (el >= T_STATIC) {
            const t = (el - T_STATIC) / T_SWITCH;
            ctx.save();
            for (let b = 0; b < 4; b++) {
              const barY = ((t * 2.2 + b * 0.25) % 1) * H;
              const barH = H * 0.04;
              const g    = ctx.createLinearGradient(0, barY, 0, barY + barH);
              g.addColorStop(0,    "rgba(255,255,255,0)");
              g.addColorStop(0.35, `rgba(255,255,255,${0.75 + Math.random() * 0.25})`);
              g.addColorStop(0.65, `rgba(255,255,255,${0.75 + Math.random() * 0.25})`);
              g.addColorStop(1,    "rgba(255,255,255,0)");
              ctx.fillStyle = g;
              ctx.fillRect(0, barY, W, barH);
            }
            ctx.restore();
          }
        }
      } else {
        // ── SMOOTH FADE-OUT (no blocks) ──────────────
        const fadeProgress = Math.min(1, (el - dissolveStart) / T_FADE);

        // Still draw noise so it doesn't freeze during fade
        if (doNoise) {
          lastPaint = now;
          drawNoise(W, H);
        }

        // Apply fade by reducing canvas globalAlpha overlay
        // Use destination-out with increasing alpha to erase noise
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        // Ease-in: slow start, accelerate
        const ease = fadeProgress * fadeProgress * (3 - 2 * fadeProgress); // smoothstep
        ctx.globalAlpha = ease;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Fade overlay elements
        const scanAlpha = Math.max(0, 1 - fadeProgress * 2).toFixed(3);
        if (scanRef.current) scanRef.current.style.opacity = scanAlpha;
        if (vigRef.current)  vigRef.current.style.opacity  = scanAlpha;
      }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      timeouts.forEach(clearTimeout);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9990 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div
        ref={scanRef}
        className="absolute inset-0"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)",
          mixBlendMode: "multiply",
        }}
      />
      <div
        ref={vigRef}
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.85) 100%)" }}
      />
      <div
        ref={flashRef}
        className="absolute inset-0 bg-white"
        style={{ opacity: 0, willChange: "opacity" }}
      />
    </div>
  );
}
