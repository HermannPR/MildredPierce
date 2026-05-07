"use client";

export function FabricBackground() {
  return (
    <>
      {/* Base fabric layer */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundColor: "#3d0a0f",
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.08) 2px,
              rgba(0,0,0,0.08) 4px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.06) 2px,
              rgba(0,0,0,0.06) 4px
            ),
            repeating-linear-gradient(
              45deg,
              rgba(90,10,20,0.15) 0px,
              rgba(90,10,20,0.15) 1px,
              transparent 1px,
              transparent 8px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(60,5,10,0.12) 0px,
              rgba(60,5,10,0.12) 1px,
              transparent 1px,
              transparent 8px
            )
          `,
        }}
      />

      {/* Depth gradient — darkens edges */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(80,15,25,0.3) 0%, rgba(20,2,5,0.6) 100%)",
        }}
      />
    </>
  );
}
