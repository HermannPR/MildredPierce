"""Renderiza el teaser en loop para la web (16:9 o 9:16).
blender -b fractal_agreement.blend -P render_teaser.py -- <out> <f0> <f1> <w> <h> [samples]
"""
import bpy, sys, os
a = sys.argv[sys.argv.index("--") + 1:]
out, f0, f1, w, h = a[0], int(a[1]), int(a[2]), int(a[3]), int(a[4])
samples = int(a[5]) if len(a) > 5 else 16
sc = bpy.context.scene
sc.frame_start, sc.frame_end = f0, f1
r = sc.render
r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
sc.eevee.taa_render_samples = samples
r.image_settings.file_format = "JPEG"
r.image_settings.quality = 94
os.makedirs(out, exist_ok=True)
r.filepath = os.path.join(out, "f_")
r.use_overwrite = False
r.use_placeholder = True
bpy.ops.render.render(animation=True)
