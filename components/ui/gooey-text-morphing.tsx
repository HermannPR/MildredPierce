"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  loop?: boolean;
  className?: string;
  textClassName?: string;
  style?: React.CSSProperties;
  color?: string;
  fontSize?: string;
}

export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  loop = true,
  className,
  textClassName,
  style,
  color,
  fontSize,
}: GooeyTextProps) {
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);
  const textsRef = React.useRef(texts);
  const morphTimeRef = React.useRef(morphTime);
  const cooldownTimeRef = React.useRef(cooldownTime);
  const loopRef = React.useRef(loop);

  React.useEffect(() => { textsRef.current = texts; }, [texts]);
  React.useEffect(() => { morphTimeRef.current = morphTime; }, [morphTime]);
  React.useEffect(() => { cooldownTimeRef.current = cooldownTime; }, [cooldownTime]);
  React.useEffect(() => { loopRef.current = loop; }, [loop]);

  React.useEffect(() => {
    let textIndex = textsRef.current.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTimeRef.current;
    let animId: number;
    let cyclesCompleted = 0;

    const showText2 = () => {
      if (text1Ref.current) { text1Ref.current.style.filter = ""; text1Ref.current.style.opacity = "0%"; }
      if (text2Ref.current) { text2Ref.current.style.filter = ""; text2Ref.current.style.opacity = "100%"; }
    };

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
        const inv = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / inv - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => { morph = 0; showText2(); };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTimeRef.current;
      if (fraction > 1) { cooldown = cooldownTimeRef.current; fraction = 1; }
      setMorph(fraction);
    };

    function animate() {
      animId = requestAnimationFrame(animate);
      const newTime = new Date();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;
      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          if (!loopRef.current) {
            cyclesCompleted++;
            if (cyclesCompleted >= textsRef.current.length) {
              cancelAnimationFrame(animId);
              showText2();
              return;
            }
          }
          textIndex = (textIndex + 1) % textsRef.current.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = textsRef.current[textIndex % textsRef.current.length];
            text2Ref.current.textContent = textsRef.current[(textIndex + 1) % textsRef.current.length];
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    if (text1Ref.current && text2Ref.current) {
      text1Ref.current.textContent = textsRef.current[textIndex % textsRef.current.length];
      text2Ref.current.textContent = textsRef.current[(textIndex + 1) % textsRef.current.length];
    }

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  const spanStyle: React.CSSProperties = {};
  if (color) spanStyle.color = color;
  if (fontSize) spanStyle.fontSize = fontSize;

  return (
    <div className={cn("relative", className)} style={style}>
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="threshold">
            <feColorMatrix in="SourceGraphic" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
          </filter>
        </defs>
      </svg>
      <div className="flex h-full items-center justify-start" style={{ filter: "url(#threshold)" }}>
        <span ref={text1Ref}
          className={cn("absolute inline-block select-none", textClassName)}
          style={spanStyle}
        />
        <span ref={text2Ref}
          className={cn("absolute inline-block select-none", textClassName)}
          style={spanStyle}
        />
      </div>
    </div>
  );
}
