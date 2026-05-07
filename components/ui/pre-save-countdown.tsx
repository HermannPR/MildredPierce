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
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s, done: diff <= 0 };
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

  if (remaining?.done) {
    return (
      <button
        className="font-display uppercase tracking-[0.3em] transition-opacity hover:opacity-70"
        style={{ color: RED, fontSize: "clamp(1.1rem, 2.2vw, 1.8rem)" }}
      >
        LISTEN NOW
      </button>
    );
  }

  const h = remaining ? pad(remaining.h) : "--";
  const m = remaining ? pad(remaining.m) : "--";
  const s = remaining ? pad(remaining.s) : "--";

  return (
    <div
      className="font-display tracking-widest select-none tabular-nums"
      style={{
        color: RED,
        fontSize: "clamp(2.4rem, 5.2vw, 5rem)",
        lineHeight: 1,
        letterSpacing: "0.06em",
        textShadow: `
          0 0 6px ${RED},
          0 0 20px ${RED_DIM},
          0 0 50px rgba(220,10,20,0.35)
        `,
      }}
    >
      {h}
      <span style={{ color: RED_DIM, margin: "0 0.12em" }}>:</span>
      {m}
      <span style={{ color: RED_DIM, margin: "0 0.12em" }}>:</span>
      {s}
    </div>
  );
}
