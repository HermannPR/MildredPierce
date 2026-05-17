"use client"

import { useEffect, useRef } from "react"

const VERT = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

// Julia-set fractal — vivid crimson, always-on
const FRAG = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;

  vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    float t = time * 0.022;

    // Slowly orbiting Julia constant
    vec2 c = vec2(
      -0.7 + 0.18 * cos(t * 0.7),
       0.27 + 0.12 * sin(t * 0.53)
    );

    vec2 z = uv * 1.4;
    float escaped = 0.0;
    float smooth_i = 0.0;
    for (int i = 0; i < 80; i++) {
      z = cmul(z, z) + c;
      if (dot(z, z) > 16.0) {
        escaped = 1.0;
        // smooth colouring
        smooth_i = float(i) - log2(log2(dot(z,z))) + 4.0;
        break;
      }
    }

    if (escaped < 0.5) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float n = smooth_i / 80.0;

    // Vivid crimson palette — pulse with time
    float pulse = 0.5 + 0.5 * sin(t * 2.1 + n * 12.0);
    float r = 0.9 + 0.1 * pulse;
    float g = 0.04 + 0.08 * n * pulse;
    float b = 0.02 + 0.04 * n;

    // Brightness ramp
    float bright = pow(n, 0.45) * 1.6;
    gl_FragColor = vec4(r * bright, g * bright, b * bright, 1.0);
  }
`

interface ShaderAnimationProps {
  className?: string
}

export function ShaderAnimation({ className }: ShaderAnimationProps) {
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
      canvas.width  = canvas.clientWidth  || 1
      canvas.height = canvas.clientHeight || 1
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener("resize", resize)

    let t = 0
    const loop = () => {
      animIdRef.current = requestAnimationFrame(loop)
      t += 0.05
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

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />
}
