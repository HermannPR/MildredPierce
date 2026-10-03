"""Arma el loop web sin costura (crossfade final->inicio) y lo codifica en WebM VP9 + MP4 H.264 + poster.
python make_loop.py <dir_cuadros> <salida_base> [ancho]   ej: ... ../public/video/fractal-teaser 960
"""
import sys, os, glob, subprocess

frames, base = sys.argv[1], sys.argv[2]
width = sys.argv[3] if len(sys.argv) > 3 else "960"
fs = sorted(glob.glob(os.path.join(frames, "f_*.jpg")))
first = int(os.path.basename(fs[0])[2:6])
fps = 24
T = len(fs) / fps
d = 0.75
fc = (f"[0]scale={width}:-2:flags=lanczos:out_range=tv,format=yuv420p,split[a][b];"
      f"[a]trim=0:{d},setpts=PTS-STARTPTS[head];"
      f"[b]trim={d}:{T},setpts=PTS-STARTPTS[body];"
      f"[body][head]xfade=transition=fade:duration={d}:offset={T - 2 * d:.3f},"
      f"noise=alls=6:allf=t,vignette=angle=PI/5,format=yuv420p[v]")
inp = ["-framerate", str(fps), "-start_number", str(first), "-i", os.path.join(frames, "f_%04d.jpg")]
os.makedirs(os.path.dirname(base), exist_ok=True)
run = lambda c: subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"] + c, check=True)
run(inp + ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38",
           "-row-mt", "1", "-pix_fmt", "yuv420p", "-deadline", "good", "-cpu-used", "2", base + ".webm"])
run(inp + ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
           "-profile:v", "high", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", base + ".mp4"])
run(["-ss", "2.5", "-i", base + ".mp4", "-frames:v", "1", "-q:v", "4", base + "-poster.jpg"])
for ext in (".webm", ".mp4", "-poster.jpg"):
    print(base + ext, os.path.getsize(base + ext) // 1024, "KB")
