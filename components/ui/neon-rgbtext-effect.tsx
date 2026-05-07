"use client";
import { useEffect, useRef } from "react";

interface NeonRGBTextEffectProps {
  text?: string;
  lines?: string[];       // multi-line mode — each entry is one line
  fontFamily?: string;
  fontSize?: number;      // size in the texture canvas (not screen pixels)
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_aspectRatio;
  varying vec2 v_texCoord;
  void main() {
    float speed = u_time * 0.8;
    float shift = 0.006 + sin(speed) * 0.003;
    vec2 uvR = v_texCoord + vec2(shift, 0.0);
    vec2 uvG = v_texCoord;
    vec2 uvB = v_texCoord - vec2(shift, 0.0);
    float r = texture2D(u_texture, uvR).r;
    float g = texture2D(u_texture, uvG).g;
    float b = texture2D(u_texture, uvB).b;
    float a = texture2D(u_texture, v_texCoord).a;
    float pulse = 0.85 + sin(speed * 1.3) * 0.15;
    vec3 color = vec3(r, g, b) * pulse;
    float scanline = sin(v_texCoord.y * 200.0 + u_time * 5.0) * 0.03;
    color += scanline;
    gl_FragColor = vec4(color, a * 0.92);
  }
`;

function mkShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (gl.deleteShader(s), null);
}

function mkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : (gl.deleteProgram(p), null);
}

export function NeonRGBTextEffect({
  text = "MILDRED PIERCE",
  lines,
  fontFamily = "var(--font-display), sans-serif",
  fontSize = 110,
}: NeonRGBTextEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // stable key for lines array so useEffect dep array stays valid
  const linesKey = lines?.join("\x00") ?? "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;

    const vs = mkShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = mkShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;
    const program = mkProgram(gl, vs, fs);
    if (!program) return;

    const positions = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    const texLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    // Build 2D texture — two-line mode uses 512-tall canvas, single uses 256
    const renderLines = (lines && lines.length > 0) ? lines : [text];
    const W = 2048;
    const H = renderLines.length > 1 ? 512 : 256;
    const tc = document.createElement("canvas");
    tc.width = W; tc.height = H;
    const ctx = tc.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    renderLines.forEach((line, i) => {
      const y = H * (i + 0.5) / renderLines.length;
      // glow pass first, then sharp pass
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 28;
      ctx.fillText(line, W / 2, y);
      ctx.shadowBlur = 0;
      ctx.fillText(line, W / 2, y);
    });

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.useProgram(program);
    const uTime    = gl.getUniformLocation(program, "u_time");
    const uTexture = gl.getUniformLocation(program, "u_texture");
    const uAspect  = gl.getUniformLocation(program, "u_aspectRatio");
    gl.uniform1i(uTexture, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let animId = 0;
    let firstFrameId = 0;
    const start = performance.now();

    const resize = () => {
      if (!canvas) return;
      canvas.width  = canvas.clientWidth  || 1;
      canvas.height = canvas.clientHeight || 1;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uAspect, canvas.width / canvas.height);
    };

    const render = () => {
      animId = requestAnimationFrame(render);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // defer first resize so DOM has painted dimensions
    firstFrameId = requestAnimationFrame(() => {
      resize();
      window.addEventListener("resize", resize);
      render();
    });

    return () => {
      cancelAnimationFrame(firstFrameId);
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [text, linesKey, fontFamily, fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
