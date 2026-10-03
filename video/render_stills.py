"""Renderiza cuadros sueltos (por segundos) para revision.
blender -b fractal_agreement.blend -P render_stills.py -- <outdir> <pct> <seg1,seg2,...>
"""
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
out, pct, secs = argv[0], int(argv[1]), [float(s) for s in argv[2].split(",")]
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.render.resolution_percentage = pct
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 90
fps = sc.render.fps
for s in secs:
    f = int(round(s * fps)) + 1
    sc.frame_set(f)
    # camara segun marcadores
    mk = [m for m in sc.timeline_markers if m.frame <= f and m.camera]
    if mk:
        sc.camera = max(mk, key=lambda m: m.frame).camera
    sc.render.filepath = os.path.join(out, f"t{s:06.1f}.jpg")
    bpy.ops.render.render(write_still=True)
    print("STILL", s, sc.camera.name)
