"use client"

import { useEffect, useRef } from "react"

const VERT = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

// VHS TV-static via fbm domain warping + glitch lines + scanlines + grain
// Warm-biased (suppress green/blue) to match the site palette
const FRAG = `
  precision highp float;
  uniform vec2  resolution;
  uniform float time;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 st) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      v += amp * noise(st);
      st  *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main(void) {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float t  = time * 0.28;

    vec2 st = uv * 7.5;

    // Domain warping — creates complex shifting static pattern
    vec2 q = vec2(fbm(st),
                  fbm(st + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm(st + 4.0 * q + vec2(1.7 - t * 0.15, 9.2)),
                  fbm(st + 4.0 * q + vec2(8.3 - t * 0.126, 2.8)));
    float f = fbm(st + r);

    // Occasional glitch horizontal bars
    float glitch = step(0.985, random(vec2(floor(time * 12.0), floor(uv.y * 60.0))));
    f += glitch * 0.35;

    // Warm color mapping: full red, suppress green/blue
    float r_ch = f * f * f + 0.55 * f * f + 0.45 * f;
    float g_ch = r_ch * 0.30;
    float b_ch = r_ch * 0.07;

    // Film grain
    float grain = random(uv + time * 0.07) * 0.09;
    r_ch += grain;
    g_ch += grain * 0.25;
    b_ch += grain * 0.04;

    // Horizontal scanlines
    float scan = sin(uv.y * 520.0) * 0.025;
    r_ch += scan;

    // Vignette — stronger edges fade to black
    float vig = 1.0 - length(uv - 0.5) * 1.4;
    vig = clamp(vig, 0.0, 1.0);
    r_ch *= vig;
    g_ch *= vig;
    b_ch *= vig;

    gl_FragColor = vec4(r_ch, g_ch, b_ch, 1.0);
  }
`

interface VHSBackgroundProps {
  className?: string
}

export function VHSBackground({ className }: VHSBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl")
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (gl.deleteShader(s), null)
    }

    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl.deleteProgram(prog); return }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    gl.useProgram(prog)
    const posLoc = gl.getAttribLocation(prog, "a_pos")
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, "time")
    const uRes  = gl.getUniformLocation(prog, "resolution")

    const resize = () => {
      // Half resolution — VHS static doesn't need pixel-perfect rendering
      canvas.width  = Math.floor((canvas.clientWidth  || 1) * 0.5)
      canvas.height = Math.floor((canvas.clientHeight || 1) * 0.5)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener("resize", resize)

    let t = 0
    const loop = () => {
      animIdRef.current = requestAnimationFrame(loop)
      t += 0.04
      gl.uniform1f(uTime, t)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    loop()

    return () => {
      cancelAnimationFrame(animIdRef.current)
      window.removeEventListener("resize", resize)
      if (buf) gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteProgram(prog)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }}
    />
  )
}
