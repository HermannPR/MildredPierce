"use client";
import { useEffect, useRef, useState } from "react";
import { Application } from "@splinetool/runtime";

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef    = useRef<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new Application(canvas);
    appRef.current = app;

    app.load(scene).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (app as any)._renderer ?? (app as any).renderer;
      if (r?.setClearColor) r.setClearColor(0x000000, 0);
      setLoading(false);
    });

    // Forward global pointer/mouse to canvas so Spline tracks cursor anywhere
    let forwarding = false;
    const forward = (e: MouseEvent) => {
      if (forwarding) return;
      forwarding = true;
      const opts = {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        movementX: e.movementX,
        movementY: e.movementY,
      };
      canvas.dispatchEvent(new MouseEvent("mousemove", opts));
      canvas.dispatchEvent(
        new PointerEvent("pointermove", { ...opts, pointerId: 1, isPrimary: true })
      );
      forwarding = false;
    };
    window.addEventListener("mousemove", forward);

    return () => {
      window.removeEventListener("mousemove", forward);
      app.dispose();
      appRef.current = null;
    };
  }, [scene]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: "#C8B090", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/*
        mix-blend-mode: multiply blends the Spline canvas output with the parent's
        background colour.  canvas_pixel × parent_bg = visually unified with silk.
        Spline's white/grey background × dark red ≈ dark red (matches silk).
        3D model lighter areas × dark red ≈ darker/reddish model (matches aesthetic).
      */}
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          display: loading ? "none" : "block",
        }}
      />
    </div>
  );
}
