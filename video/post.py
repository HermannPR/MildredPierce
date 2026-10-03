"""Une los cuadros renderizados con la cancion y aplica el acabado (grano + vinieta).
python post.py <dir_cuadros> <audio.wav> <salida.mp4> [crf]
Los cuadros se llaman f_0001.jpg|png ... (salida de render_anim.py).
"""
import sys, os, glob, subprocess

frames, audio, out = sys.argv[1], sys.argv[2], sys.argv[3]
crf = sys.argv[4] if len(sys.argv) > 4 else "18"
ext = "png" if glob.glob(os.path.join(frames, "f_*.png")) else "jpg"
# cuadros contiguos y completos desde el 1 (ignora placeholders vacios de un render en curso)
n = 0
while os.path.exists(p := os.path.join(frames, f"f_{n + 1:04d}.{ext}")) and os.path.getsize(p) > 0:
    n += 1
fps = 24
dur = n / fps
vf = ",".join([
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "eq=contrast=1.04:saturation=1.06",
    "noise=alls=9:allf=t+u",
    "vignette=angle=PI/5",
    "format=yuv420p",
])
cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(fps), "-start_number", "1",
       "-i", os.path.join(frames, f"f_%04d.{ext}"), "-i", audio,
       "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "320k", "-t", f"{dur:.3f}", "-movflags", "+faststart", out]
print(" ".join(cmd))
subprocess.run(cmd, check=True)
print("OK", out, n, "cuadros", round(dur, 1), "s")
