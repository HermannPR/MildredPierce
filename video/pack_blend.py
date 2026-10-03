"""Empaca imagenes y fuentes dentro del .blend para renderizar en otra maquina.
blender -b fractal_agreement.blend -P pack_blend.py -- <salida.blend>
"""
import bpy, sys
out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.file.pack_all()
for f in bpy.data.fonts:
    if f.filepath and f.filepath != '<builtin>' and not f.packed_file:
        f.pack()
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True, copy=True)
print("PACKED", out)
