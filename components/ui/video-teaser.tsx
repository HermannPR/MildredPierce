"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Teaser 3D en loop (muted) como fachada del video de YouTube.
 * - El iframe de YouTube solo se carga al hacer clic (ahorra ~1 MB de JS al inicio).
 * - El loop se reproduce solo cuando esta en pantalla y si el usuario no pidio menos movimiento.
 * - Carga perezosa: preload="none" y las fuentes se asignan al entrar en el viewport.
 */
export function VideoTeaser({
  youtubeId,
  title,
  poster,
  webm,
  mp4,
}: {
  youtubeId: string;
  title: string;
  poster: string;
  webm: string;
  mp4: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || playing) return;
    if (inView && !reduced) {
      if (!src) {
        setSrc(v.canPlayType('video/webm; codecs="vp9"') ? webm : mp4);
        return;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [inView, reduced, playing, src, webm, mp4]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: "3px",
        overflow: "hidden",
        background: "#0a0604",
        boxShadow: "0 0 0 1px rgba(255,120,60,0.14), 0 0 40px rgba(200,60,20,0.18), 0 0 80px rgba(120,30,10,0.12)",
      }}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&color=white`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={title}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Reproducir ${title} en YouTube`}
          className="group"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }}
        >
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster={poster}
            src={src}
            onError={() => { if (src === webm) setSrc(mp4); }}
            onCanPlay={(e) => { if (inView && !reduced) e.currentTarget.play().catch(() => {}); }}
            aria-hidden="true"
            tabIndex={-1}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(4,2,1,0.55) 100%)",
            }}
          />
          <span
            className="font-display uppercase transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
            style={{
              position: "absolute",
              left: "50%",
              bottom: "8%",
              transform: "translateX(-50%)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.7rem 1.1rem",
              minHeight: 44,
              borderRadius: 999,
              background: "rgba(10,4,2,0.62)",
              border: "1px solid rgba(245,237,213,0.28)",
              color: "#F5EDD5",
              letterSpacing: "0.22em",
              fontSize: "0.72rem",
              whiteSpace: "nowrap",
              backdropFilter: "blur(6px)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff3b2f" aria-hidden="true">
              <path d="M6 4l14 8-14 8z" />
            </svg>
            Ver video
          </span>
        </button>
      )}
    </div>
  );
}
