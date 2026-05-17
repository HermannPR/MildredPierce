"use client"

import { useEffect, useRef } from "react"

const VERT = `attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

// Warm crimson/amber concentric rings — biased away from green+blue
const FRAG = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    float t = time * 0.038;
    float lw = 0.007;
    vec3 color = vec3(0.0);
    for(int j = 0; j < 3; j++){
      for(int i = 0; i < 8; i++){
        float v = lw * float(i * i) / abs(
          fract(t - 0.014 * float(j) + float(i) * 0.016) * 5.0
          - length(uv)
          + mod(uv.x + uv.y, 0.22)
        );
        color[j] += v;
      }
    }
    // Suppress green and blue heavily for warm red/amber output
    color[1] *= 0.32;
    color[2] *= 0.08;
    gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
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
