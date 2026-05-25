"use client";
import { useEffect, useRef } from "react";

export function SignalDropout() {
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    let rafId = 0;
    let timer: ReturnType<typeof setTimeout>;

    const resize = () => {
      cv.width  = window.innerWidth;
      cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const runDropout = () => {
      const totalFrames = 8 + Math.floor(Math.random() * 8);
      let f = 0;

      const tick = () => {
        if (f >= totalFrames) {
          ctx.clearRect(0, 0, cv.width, cv.height);
          scheduleNext();
          return;
        }
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);

        // Brief phosphor flash on first frame
        if (f === 0) {
          ctx.fillStyle = "rgba(160,210,255,0.12)";
          ctx.fillRect(0, 0, W, H);
        }

        // Chromatic horizontal bands — RGB channels offset
        const bands = 6 + Math.floor(Math.random() * 14);
        for (let i = 0; i < bands; i++) {
          const y  = Math.floor(Math.random() * H);
          const bh = 1 + Math.floor(Math.random() * 5);
          const ox = (Math.random() - 0.5) * 60;
          ctx.fillStyle = `rgba(255,20,60,${0.10 + Math.random() * 0.22})`;
          ctx.fillRect(ox - 6, y, W, bh);
          ctx.fillStyle = `rgba(0,90,255,${0.08 + Math.random() * 0.18})`;
          ctx.fillRect(ox + 6, y, W, bh);
          ctx.fillStyle = `rgba(180,240,255,${0.06 + Math.random() * 0.12})`;
          ctx.fillRect(ox, y, W, bh);
        }

        // Static noise slice (1-2 per frame)
        const slices = 1 + Math.floor(Math.random() * 2);
        for (let s = 0; s < slices; s++) {
          const sy  = Math.floor(Math.random() * H * 0.85);
          const sh  = 12 + Math.floor(Math.random() * 50);
          const img = ctx.createImageData(W, sh);
          for (let p = 0; p < img.data.length; p += 4) {
            const v = Math.random() > 0.45 ? 40 + Math.random() * 80 : 0;
            img.data[p]   = v * 1.0;
            img.data[p+1] = v * 0.85;
            img.data[p+2] = v * 1.3;
            img.data[p+3] = Math.random() * 120;
          }
          ctx.putImageData(img, 0, sy);
        }

        f++;
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    };

    const scheduleNext = () => {
      const delay = 18000 + Math.random() * 42000; // 18-60s
      timer = setTimeout(runDropout, delay);
    };

    // First dropout after 8-15s so it's not immediate
    timer = setTimeout(runDropout, 8000 + Math.random() * 7000);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={cvRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9600,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
}
