"use client"

import { useEffect, useRef } from "react"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const dotRef    = useRef<HTMLDivElement>(null)
  const posRef    = useRef({ x: -100, y: -100 })
  const rafRef    = useRef(0)
  const hoverRef  = useRef(false)

  useEffect(() => {
    document.body.style.cursor = "none"

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY }
      const t = e.target as Element
      hoverRef.current = !!(
        t.closest("button") || t.closest("a") ||
        t.closest("input") || t.closest("[role='button']")
      )
    }

    const render = () => {
      rafRef.current = requestAnimationFrame(render)
      const el  = cursorRef.current
      const dot = dotRef.current
      if (!el || !dot) return

      const { x, y } = posRef.current
      const hovering  = hoverRef.current
      const size      = hovering ? 44 : 28
      const half      = size / 2
      const dotSize   = hovering ? 8 : 5

      el.style.transform  = `translate(${x - half}px, ${y - half}px)`
      el.style.width      = `${size}px`
      el.style.height     = `${size}px`

      dot.style.transform = `translate(${x - dotSize / 2}px, ${y - dotSize / 2}px)`
      dot.style.width     = `${dotSize}px`
      dot.style.height    = `${dotSize}px`

      const lineColor = hovering ? "rgba(245,237,213,1)" : "rgba(245,237,213,0.9)"
      const hLine = el.children[0] as HTMLElement
      const vLine = el.children[1] as HTMLElement
      if (hLine) hLine.style.background = lineColor
      if (vLine) vLine.style.background = lineColor
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    rafRef.current = requestAnimationFrame(render)

    return () => {
      document.body.style.cursor = ""
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <>
      {/* Crosshair */}
      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 28,
          height: 28,
          pointerEvents: "none",
          zIndex: 99999,
          willChange: "transform",
        }}
      >
        {/* Horizontal */}
        <div style={{
          position: "absolute",
          top: "50%", left: 0, right: 0,
          height: 1.5,
          transform: "translateY(-50%)",
          background: "rgba(245,237,213,0.9)",
          boxShadow: "0 0 6px rgba(0,200,255,0.7)",
        }} />
        {/* Vertical */}
        <div style={{
          position: "absolute",
          left: "50%", top: 0, bottom: 0,
          width: 1.5,
          transform: "translateX(-50%)",
          background: "rgba(245,237,213,0.9)",
          boxShadow: "0 0 6px rgba(0,200,255,0.7)",
        }} />
      </div>

      {/* Center dot — positioned independently for precision */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#00c8ff",
          boxShadow: "0 0 8px 2px rgba(0,200,255,0.9)",
          pointerEvents: "none",
          zIndex: 99999,
          willChange: "transform",
          transform: "translate(-100px, -100px)",
          transition: "width 0.12s ease, height 0.12s ease",
        }}
      />
    </>
  )
}
