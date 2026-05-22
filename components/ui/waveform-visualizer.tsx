"use client"

// Pre-computed amplitude data: 120 bars of realistic music dynamics.
// Sections: intro quiet → build-up → first peak → quiet → build → peak → outro
const AMPLITUDES: number[] = [
  // Intro quiet (bars 0-14)
  0.12, 0.15, 0.11, 0.18, 0.14, 0.20, 0.13, 0.16, 0.22, 0.17,
  0.14, 0.19, 0.12, 0.21, 0.15,
  // Build-up (bars 15-29)
  0.28, 0.32, 0.38, 0.35, 0.42, 0.45, 0.40, 0.50, 0.48, 0.55,
  0.52, 0.58, 0.54, 0.62, 0.60,
  // First peak (bars 30-44)
  0.78, 0.85, 0.82, 0.90, 0.88, 0.95, 0.92, 1.00, 0.97, 0.93,
  0.88, 0.84, 0.79, 0.75, 0.70,
  // Drop to quiet (bars 45-59)
  0.55, 0.42, 0.35, 0.28, 0.22, 0.18, 0.14, 0.16, 0.12, 0.20,
  0.15, 0.18, 0.13, 0.17, 0.21,
  // Second build (bars 60-74)
  0.26, 0.33, 0.40, 0.45, 0.50, 0.47, 0.55, 0.58, 0.53, 0.62,
  0.65, 0.60, 0.68, 0.64, 0.72,
  // Second peak — louder (bars 75-89)
  0.80, 0.87, 0.84, 0.92, 0.89, 0.96, 0.94, 1.00, 0.98, 0.95,
  0.91, 0.86, 0.82, 0.77, 0.72,
  // Breakdown (bars 90-104)
  0.60, 0.50, 0.40, 0.32, 0.25, 0.20, 0.24, 0.30, 0.28, 0.35,
  0.40, 0.38, 0.45, 0.42, 0.50,
  // Outro fade (bars 105-119)
  0.48, 0.42, 0.38, 0.32, 0.28, 0.24, 0.20, 0.17, 0.14, 0.18,
  0.15, 0.12, 0.10, 0.11, 0.13,
]

const SVG_HEIGHT = 60
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_COUNT = 120

export function WaveformVisualizer({ opacity = 0.6 }: { opacity?: number }) {
  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP

  return (
    <div style={{ opacity, mixBlendMode: "screen" }}>
      <style>{`
        @keyframes waveform-pulse-0  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-1  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-2  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-3  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-4  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-5  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-6  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-7  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-8  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-9  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-10 { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
        @keyframes waveform-pulse-11 { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.6)} }
      `}</style>
      <svg
        width="100%"
        height={SVG_HEIGHT}
        viewBox={`0 0 ${totalWidth} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {AMPLITUDES.map((amp, i) => {
          // Each bar extends symmetrically from centre
          const maxBarHalf = (SVG_HEIGHT / 2) * 0.95
          const barHalf = Math.max(2, amp * maxBarHalf)
          const barHeight = barHalf * 2
          const x = i * (BAR_WIDTH + BAR_GAP)
          const y = SVG_HEIGHT / 2 - barHalf

          // Stagger: 12 animation variants cycled, duration varies 2–4 s
          const variant = i % 12
          const duration = 2 + (i % 7) * (2 / 6) // 2.0 → 4.0 s in 7 steps
          const delay = (i * 0.043) % duration    // offset each bar

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={barHeight}
              fill="rgba(0,200,255,0.5)"
              style={{
                transformOrigin: `${x + BAR_WIDTH / 2}px ${SVG_HEIGHT / 2}px`,
                animation: `waveform-pulse-${variant} ${duration.toFixed(2)}s ${delay.toFixed(2)}s ease-in-out infinite`,
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
