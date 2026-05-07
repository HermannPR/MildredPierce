"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface HoverMorphTextProps {
  from: string;
  to: string;
  isActive: boolean;
  color?: string;
  fontSize?: string;
  className?: string;
  textClassName?: string;
}

export function HoverMorphText({
  from,
  to,
  isActive,
  color,
  fontSize,
  className,
  textClassName,
}: HoverMorphTextProps) {
  const fromRef      = useRef<HTMLSpanElement>(null);
  const toRef        = useRef<HTMLSpanElement>(null);
  const filterDivRef = useRef<HTMLDivElement>(null);
  const everActive   = useRef(false); // tracks if we've ever gone active

  useEffect(() => {
    const f = fromRef.current;
    const t = toRef.current;
    const c = filterDivRef.current;
    if (!f || !t || !c) return;

    if (isActive) {
      everActive.current = true;
      c.style.filter = "url(#morph-threshold)";
      f.style.transition = "opacity 1.25s ease-in-out, filter 1.25s ease-in-out";
      t.style.transition = "opacity 1.25s ease-in-out, filter 1.25s ease-in-out";
      f.style.opacity    = "0%";
      f.style.filter     = "blur(80px)";
      t.style.opacity    = "100%";
      t.style.filter     = "";
    } else if (everActive.current) {
      // Animate gooey back — keep filter on, reverse transitions
      c.style.filter = "url(#morph-threshold)";
      f.style.transition = "opacity 1.25s ease-in-out, filter 1.25s ease-in-out";
      t.style.transition = "opacity 1.25s ease-in-out, filter 1.25s ease-in-out";
      f.style.opacity = "100%";
      f.style.filter  = "";
      t.style.opacity = "0%";
      t.style.filter  = "blur(80px)";
    } else {
      // Initial mount — instant reset, no animation flash
      c.style.filter = "none";
      void c.offsetHeight;
      f.style.transition = "none";
      t.style.transition = "none";
      f.style.opacity = "100%";
      f.style.filter  = "";
      t.style.opacity = "0%";
      t.style.filter  = "blur(80px)";
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (c) c.style.filter = "url(#morph-threshold)";
        });
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [isActive]);

  const spanStyle: React.CSSProperties = {};
  if (color)    spanStyle.color    = color;
  if (fontSize) spanStyle.fontSize = fontSize;

  return (
    <div className={cn("relative", className)}>
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id="morph-threshold">
            <feColorMatrix in="SourceGraphic" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
          </filter>
        </defs>
      </svg>

      {/* filterDivRef — this is the element whose filter we toggle */}
      <div
        ref={filterDivRef}
        className="flex h-full items-center justify-start"
        style={{ filter: "url(#morph-threshold)" }}
      >
        <span
          ref={fromRef}
          className={cn("absolute inline-block select-none", textClassName)}
          style={{ ...spanStyle, opacity: "100%", filter: "" }}
        >
          {from}
        </span>

        <span
          ref={toRef}
          className={cn("absolute inline-block select-none", textClassName)}
          style={{ ...spanStyle, opacity: "0%", filter: "blur(80px)" }}
        >
          {to}
        </span>
      </div>
    </div>
  );
}
