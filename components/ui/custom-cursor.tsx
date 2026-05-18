"use client"

import { useEffect, useRef } from "react"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: -100, y: -100 })
  const rafRef = useRef(0)
  const isHoveringRef = useRef(false)

  useEffect(() => {
    // Hide default cursor globally
    document.body.style.cursor = "none"

    const onMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY }

      const target = e.target as Element
      isHoveringRef.current = !!(
        target.closest("button") ||
        target.closest("a") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("[role='button']")
      )
    }

    const render = () => {
      rafRef.current = requestAnimationFrame(render)
      const el = cursorRef.current
      if (!el) return

      const { x, y } = posRef.current
      const hovering = isHoveringRef.current
      const size = hovering ? 24 : 16
      const half = size / 2

      el.style.transform = `translate(${x - half}px, ${y - half}px)`
      el.style.width = `${size}px`
      el.style.height = `${size}px`

      const color = hovering
        ? "rgba(245,237,213,1)"
        : "rgba(245,237,213,0.7)"

      // Horizontal line
      const hLine = el.children[0] as HTMLElement
      // Vertical line
      const vLine = el.children[1] as HTMLElement

      if (hLine) hLine.style.background = color
      if (vLine) vLine.style.background = color
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true })
    rafRef.current = requestAnimationFrame(render)

    return () => {
      document.body.style.cursor = ""
      window.removeEventListener("mousemove", onMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 16,
        height: 16,
        pointerEvents: "none",
        zIndex: 99999,
        // GPU-composited layer for smooth movement
        willChange: "transform",
      }}
    >
      {/* Horizontal bar */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          transform: "translateY(-50%)",
          background: "rgba(245,237,213,0.7)",
          transition: "background 0.15s ease",
        }}
      />
      {/* Vertical bar */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          transform: "translateX(-50%)",
          background: "rgba(245,237,213,0.7)",
          transition: "background 0.15s ease",
        }}
      />
    </div>
  )
}
