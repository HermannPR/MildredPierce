"""Configura y renderiza la animacion.
blender -b fractal_agreement.blend -P render_anim.py -- <preview|final> <outdir> [frame_start frame_end]
  preview: 640x360, 16 muestras, JPEG
  final:   1920x1080, 32 muestras, raytracing, volumen fino, PNG 8 bit
  final_hq: igual con 64 muestras
Reanudable: omite cuadros que ya existen (use_overwrite = False, placeholders).
"""
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
mode, out = argv[0], argv[1]
sc = bpy.context.scene
if len(argv) >= 4:
    sc.frame_start, sc.frame_end = int(argv[2]), int(argv[3])
ee = sc.eevee
r = sc.render
if mode in ("final", "final_hq"):
    r.resolution_percentage = 100
    ee.taa_render_samples = 64 if mode == "final_hq" else 32
    ee.use_raytracing = True
    ee.volumetric_tile_size = "8"
    ee.volumetric_samples = 64
    ee.shadow_ray_count = 2
    ee.shadow_step_count = 8
    r.image_settings.file_format = "PNG"
    r.image_settings.color_depth = "8"
    r.image_settings.compression = 15
else:
    r.resolution_percentage = 33
    ee.taa_render_samples = 16
    r.image_settings.file_format = "JPEG"
    r.image_settings.quality = 92
os.makedirs(out, exist_ok=True)
r.filepath = os.path.join(out, "f_")
r.use_file_extension = True
r.use_overwrite = False
r.use_placeholder = True
print("RENDER", mode, sc.frame_start, sc.frame_end, r.resolution_x * r.resolution_percentage // 100)
bpy.ops.render.render(animation=True)
