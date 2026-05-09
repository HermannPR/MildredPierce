"use client";
import { useEffect, useState } from "react";

interface PreSaveCountdownProps {
  targetDate: Date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getRemaining(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { d, h, m, s, done: diff <= 0 };
}

const RED       = "#e8102a";
const RED_DIM   = "rgba(232,16,42,0.65)";

export function PreSaveCountdown({ targetDate }: PreSaveCountdownProps) {
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining> | null>(null);

  useEffect(() => {
    setRemaining(getRemaining(targetDate));
    const id = setInterval(() => setRemaining(getRemaining(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const PRESAVE_URL = "https://share.amuse.io/track/mildred-pierce-fractal-agreement";

  if (remaining?.done) {
    return (
      <a
        href={PRESAVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-display uppercase tracking-[0.3em] transition-opacity hover:opacity-70"
        style={{ color: RED, fontSize: "clamp(1.1rem, 2.2vw, 1.8rem)" }}
      >
        LISTEN NOW
      </a>
    );
  }

  const d = remaining ? String(remaining.d) : "--";
  const h = remaining ? pad(remaining.h) : "--";
  const m = remaining ? pad(remaining.m) : "--";
  const s = remaining ? pad(remaining.s) : "--";

  const sep = <span style={{ color: RED_DIM, margin: "0 0.08em" }}>:</span>;

  return (
    <a
      href={PRESAVE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="font-display tracking-widest select-none tabular-nums transition-opacity hover:opacity-70"
      style={{
        color: RED,
        fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
        lineHeight: 1,
        letterSpacing: "0.06em",
        textShadow: `
          0 0 6px ${RED},
          0 0 20px ${RED_DIM},
          0 0 50px rgba(220,10,20,0.35)
        `,
      }}
    >
      {d}{sep}{h}{sep}{m}{sep}{s}
    </a>
  );
}
