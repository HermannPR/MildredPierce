"""Mildred Pierce · "Fractal Agreement" · video musical procedural.

Construye toda la escena en Blender (bpy) a partir de analysis.json y guarda
fractal_agreement.blend. Uso:
  blender -b --factory-startup -P build_scene.py -- [--out ruta.blend]

Sets (todo procedural, sin assets externos salvo el atlas del ojo de la banda
y la tipografia Bookman del sitio):
  A  Salon (origen): escalera curva, piano de cola, tres figuras con capucha roja,
     TV con ojo, piso de tablero, luz ambar (estetica de la foto de la banda).
  B  Pozo Droste (x=+400): escalera helicoidal recursiva, zoom infinito.
  C  Muro de TVs (x=-400): alfombra de Sierpinski de televisores con el ojo.
  D  Espiral de teclas (y=-400): teclas de piano como escalones en espiral.
  E  Trios recursivos (y=+400): figuras en trios fractales que giran al beat.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix, Euler
from bpy_extras import anim_utils

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.join(HERE, "fractal_agreement.blend")
if "--out" in argv:
    OUT = argv[argv.index("--out") + 1]

A = json.load(open(os.path.join(HERE, "analysis.json")))
FPS = A["fps"]
SONG_END = 266.0
END_S = 271.0
NF = int(END_S * FPS)
C = A["curves"]
NC = len(C["rms"])


def cv(name, f):
    i = min(max(f - 1, 0), NC - 1)
    return C[name][i] if (f - 1) < NC else 0.0


BEATS = A["beats"]
DOWN = A["downbeats"]
STRONG = [t for t, s in A["onsets"] if s >= 11.5]
random.seed(7)


def F(t):
    return int(round(t * FPS)) + 1


def qd(t):
    """cuantiza al downbeat mas cercano"""
    return min(DOWN, key=lambda d: abs(d - t)) if t > 1 else t


# flash: impulsos con decaimiento en onsets fuertes
FLASH = [0.0] * (NF + 2)
for t in STRONG:
    f0 = F(t)
    for k in range(0, 14):
        if f0 + k <= NF:
            FLASH[f0 + k] = max(FLASH[f0 + k], math.exp(-k / 3.0))


def sec_gain(t):
    """ganancia global de luz por seccion (dinamica dramatica)"""
    pts = [(0, 0.35), (18, 0.3), (35, 0.55), (66, 0.7), (88, 1.0), (140, 0.9), (158, 0.7),
           (175, 0.35), (188, 1.0), (231, 1.15), (262, 0.6), (266, 0.0), (END_S, 0.0)]
    for (a, ga), (b, gb) in zip(pts, pts[1:]):
        if a <= t <= b:
            u = (t - a) / max(b - a, 1e-6)
            return ga + (gb - ga) * u
    return 0.0


# ----------------------------------------------------------------- escena base
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "FractalAgreement"
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = NF
scene.render.engine = "BLENDER_EEVEE"
try:
    scene.view_settings.view_transform = "AgX"
    for lk in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Punchy", "Punchy"):
        try:
            scene.view_settings.look = lk
            break
        except Exception:
            pass
except Exception:
    pass


def link(ob, coll=None):
    (coll or scene.collection).objects.link(ob)
    return ob


def new_coll(name, parent=None, hide=False):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    if hide:
        bpy.context.view_layer.layer_collection.children[name].exclude = True
    return c


# ----------------------------------------------------------------- animacion

def _cb(owner):
    ad = owner.animation_data
    if not ad or not ad.action:
        return None
    return anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)


def fcurve(owner, path, index=-1):
    cb = _cb(owner)
    before = set((fc.data_path, fc.array_index) for fc in cb.fcurves) if cb else set()
    owner.keyframe_insert(data_path=path, index=index, frame=1)
    cb = _cb(owner)
    fc = cb.fcurves.find(path, index=max(index, 0))
    if fc is None:
        new = [f for f in cb.fcurves if (f.data_path, f.array_index) not in before]
        fc = new[0] if new else None
    return fc


def bake(owner, path, frames, values, index=-1, interp="LINEAR"):
    """escribe muchas claves de golpe"""
    fc = fcurve(owner, path, index)
    n = len(frames)
    kp = fc.keyframe_points
    if n > 1:
        kp.add(n - 1)
    co = []
    for f, v in zip(frames, values):
        co += [float(f), float(v)]
    kp.foreach_set("co", co)
    code = {"CONSTANT": 0, "LINEAR": 1, "BEZIER": 2}[interp]
    kp.foreach_set("interpolation", [code] * n)
    fc.update()
    return fc


def bake_fn(owner, path, fn, index=-1, step=1, f0=1, f1=None, interp="LINEAR"):
    f1 = f1 or NF
    frames = list(range(f0, f1 + 1, step))
    if frames[-1] != f1:
        frames.append(f1)
    bake(owner, path, frames, [fn(f) for f in frames], index, interp)


# ----------------------------------------------------------------- materiales

def mat(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, coat=0.0, sheen=0.0,
        emit=None, emit_strength=0.0, bump=0.0, bump_scale=40.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Sheen Weight"].default_value = sheen
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = emit_strength
    if bump > 0:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = bump_scale
        tex.inputs["Detail"].default_value = 8
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        nt.links.new(tex.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    return m


AMBER = (1.0, 0.52, 0.22)
WARM = (1.0, 0.68, 0.40)
RED = (1.0, 0.04, 0.03)
TEAL = (0.70, 0.95, 1.0)

M = {
    "plaster": mat("plaster", (0.30, 0.16, 0.065), 0.85, bump=0.15, bump_scale=18),
    "stone": mat("stone", (0.50, 0.40, 0.27), 0.5, bump=0.015, bump_scale=25),
    "rail": mat("rail", (0.05, 0.025, 0.012), 0.35, coat=0.4),
    "platform": mat("platform", (0.008, 0.008, 0.009), 0.12, coat=0.6),
    "lacquer": mat("lacquer", (0.004, 0.004, 0.005), 0.06, coat=1.0),
    "ivory": mat("ivory", (0.80, 0.76, 0.66), 0.3),
    "ebony": mat("ebony", (0.01, 0.01, 0.01), 0.25),
    "shirt": mat("shirt", (0.82, 0.76, 0.72), 0.65, bump=0.03, bump_scale=200),
    "leather": mat("leather", (0.014, 0.012, 0.013), 0.42, coat=0.12, bump=0.06, bump_scale=70),
    "trousers": mat("trousers", (0.014, 0.014, 0.016), 0.75),
    "hood": mat("hood", (0.62, 0.015, 0.02), 0.95, sheen=1.0, emit=RED, emit_strength=0.0, bump=0.25, bump_scale=300),
    "skin": mat("skin", (0.55, 0.36, 0.27), 0.5),
    "bezel": mat("bezel", (0.018, 0.016, 0.015), 0.45, bump=0.05, bump_scale=50),
    "chrome": mat("chrome", (0.8, 0.8, 0.8), 0.2, metal=1.0),
    "mirror": mat("mirror", (0.004, 0.004, 0.005), 0.04, coat=1.0),
    "cove": mat("cove", WARM, 0.5, emit=WARM, emit_strength=1.6),
    "sconce": mat("sconce", WARM, 0.5, emit=WARM, emit_strength=25.0),
    "core": mat("core", RED, 0.5, emit=RED, emit_strength=40.0),
    "redneon": mat("redneon", RED, 0.5, emit=RED, emit_strength=12.0),
    "title": mat("title", (0.96, 0.93, 0.84), 0.4, emit=(1.0, 0.93, 0.80), emit_strength=3.0),
}

# piso de tablero
fm = bpy.data.materials.new("checker")
fm.use_nodes = True
nt = fm.node_tree
p = nt.nodes["Principled BSDF"]
ck = nt.nodes.new("ShaderNodeTexChecker")
ck.inputs["Color1"].default_value = (0.55, 0.47, 0.34, 1)
ck.inputs["Color2"].default_value = (0.015, 0.014, 0.013, 1)
ck.inputs["Scale"].default_value = 30.0
nt.links.new(ck.outputs["Color"], p.inputs["Base Color"])
p.inputs["Roughness"].default_value = 0.18
p.inputs["Coat Weight"].default_value = 0.5
M["checker"] = fm


# pantalla CRT: atlas del ojo (4x3) + estatica + scanlines
def screen_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "Emit"
    uv = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "Tile"
    mp.inputs["Scale"].default_value = (0.25, 1 / 3, 1)
    mp.inputs["Location"].default_value = (0.0, 2 / 3, 0)
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = EYE
    img.extension = "CLIP"
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], img.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.name = "Static"
    noise.inputs["Scale"].default_value = 420.0
    noise.inputs["Detail"].default_value = 0.0
    nt.links.new(uv.outputs["UV"], noise.inputs["Vector"])
    # contraste a la estatica
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[1].position = 0.58
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.name = "StaticMix"
    mix.inputs["Factor"].default_value = 0.0
    nt.links.new(img.outputs["Color"], mix.inputs[6])
    nt.links.new(ramp.outputs["Color"], mix.inputs[7])
    # scanlines
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 90.0
    nt.links.new(uv.outputs["UV"], wave.inputs["Vector"])
    sl = nt.nodes.new("ShaderNodeMapRange")
    sl.inputs["To Min"].default_value = 0.72
    sl.inputs["To Max"].default_value = 1.0
    nt.links.new(wave.outputs["Fac"], sl.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(mix.outputs[2], mul.inputs[6])
    nt.links.new(sl.outputs["Result"], mul.inputs[7])
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (*TEAL, 1)
    nt.links.new(mul.outputs[2], tint.inputs[6])
    nt.links.new(tint.outputs[2], em.inputs["Color"])
    em.inputs["Strength"].default_value = 3.0
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


EYE = bpy.data.images.load(os.path.join(ASSETS, "eye_atlas.png"))
SCREENS = [screen_mat(f"screen_{i}") for i in range(4)]
FONT = bpy.data.fonts.load(os.path.join(HERE, "..", "public", "fonts", "Bookman ITC Std Demi", "Bookman ITC Std Demi.otf"))


# ----------------------------------------------------------------- geometria

def mesh_obj(name, bm, material=None, coll=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    if material:
        me.materials.append(material)
    return link(ob, coll)


def box(name, size, loc=(0, 0, 0), material=None, coll=None, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_obj(name, bm, material, coll)
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        md = ob.modifiers.new("bev", "BEVEL")
        md.width = bevel
        md.segments = 3
        md.limit_method = "ANGLE"
    return ob


def cyl(name, r, h, loc=(0, 0, 0), material=None, coll=None, seg=24, rot=(0, 0, 0), r2=None, caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    ob = mesh_obj(name, bm, material, coll, smooth=True)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def sphere(name, r, loc=(0, 0, 0), material=None, coll=None, scale=(1, 1, 1), seg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    ob = mesh_obj(name, bm, material, coll, smooth=True)
    ob.location = loc
    ob.scale = scale
    return ob


def lathe(name, profile, material=None, coll=None, seg=14):
    """perfil [(r,z),...] girado sobre Z"""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(len(profile) - 1):
            bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    if material:
        me.materials.append(material)
    return me


BALUSTER = lathe("baluster", [(0.0, 0.0), (0.06, 0.0), (0.06, 0.06), (0.035, 0.09), (0.03, 0.16),
                              (0.075, 0.34), (0.08, 0.42), (0.05, 0.56), (0.028, 0.66), (0.045, 0.72),
                              (0.045, 0.78), (0.0, 0.78)], M["stone"])


def join(objs, name):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        for md in o.modifiers:
            pass
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    # hornear la transformacion: origen en el origen del mundo
    ob.data.transform(ob.matrix_world)
    ob.matrix_world = Matrix.Identity(4)
    return ob


def add_light(name, kind, loc, energy, color=WARM, size=1.0, rot=(0, 0, 0), spot=None, coll=None, shadow=True):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    ld.use_shadow = shadow
    if kind == "AREA":
        ld.size = size
    elif kind in ("POINT", "SPOT"):
        ld.shadow_soft_size = size
    if kind == "SPOT" and spot:
        ld.spot_size = math.radians(spot)
        ld.spot_blend = 0.6
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = rot
    if kind == "AREA":
        ld.specular_factor = 0.15
    return link(ob, coll)


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


# ----------------------------------------------------------------- escalera

def staircase(coll, center, r_in, r_out, a0, a1, z0, z1, nsteps, name, balusters=True, outer_rail=True,
              soffit=True, step_mat=None):
    cx, cy, cz = center
    parts = []
    rise = (z1 - z0) / nsteps
    da = (a1 - a0) / nsteps
    for i in range(nsteps):
        a = a0 + da * (i + 0.5)
        rm = (r_in + r_out) / 2
        w = r_out - r_in
        depth = abs(da) * rm * 1.08
        z = z0 + rise * (i + 1)
        st = box(f"{name}_st{i}", (depth, w, rise * 0.9 + 0.05),
                 (cx + rm * math.cos(a), cy + rm * math.sin(a), cz + z - rise * 0.45), step_mat or M["stone"], coll,
                 rot=(0, 0, a + math.pi / 2))
        parts.append(st)
    stair = join(parts, f"{name}_steps")
    md = stair.modifiers.new("bev", "BEVEL")
    md.width = 0.015
    md.segments = 2
    # soffit / estructura inferior (banda curva lisa como en la foto)
    if soffit:
        bm = bmesh.new()
        N = nsteps * 3
        prev = None
        for i in range(N + 1):
            u = i / N
            a = a0 + (a1 - a0) * u
            z = cz + z0 + (z1 - z0) * u
            vs = []
            for r, dz in ((r_in, -0.05), (r_out + 0.08, -0.05), (r_out + 0.08, -0.55), (r_in, -0.55)):
                vs.append(bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z + dz)))
            if prev:
                for k in range(4):
                    bm.faces.new((prev[k], prev[(k + 1) % 4], vs[(k + 1) % 4], vs[k]))
            prev = vs
        so = mesh_obj(f"{name}_soffit", bm, M["stone"], coll, smooth=True)
    # balaustres y pasamanos (borde exterior)
    if balusters:
        rr = r_out - 0.12 if outer_rail else r_in + 0.12
        nb = nsteps * 2
        for i in range(nb):
            u = (i + 0.5) / nb
            a = a0 + (a1 - a0) * u
            z = cz + z0 + (z1 - z0) * (math.floor(u * nsteps) + 1) / nsteps
            b = bpy.data.objects.new(f"{name}_bal{i}", BALUSTER)
            b.location = (cx + rr * math.cos(a), cy + rr * math.sin(a), z)
            link(b, coll)
        cu = bpy.data.curves.new(f"{name}_railc", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.07
        cu.bevel_resolution = 3
        sp = cu.splines.new("POLY")
        N = nsteps * 4
        sp.points.add(N)
        for i in range(N + 1):
            u = i / N
            a = a0 + (a1 - a0) * u
            z = cz + z0 + (z1 - z0) * u + 0.8 + rise * 0.5
            sp.points[i].co = (cx + rr * math.cos(a), cy + rr * math.sin(a), z, 1)
        rail = bpy.data.objects.new(f"{name}_rail", cu)
        cu.materials.append(M["rail"])
        link(rail, coll)
    return stair


# ----------------------------------------------------------------- figura

def skin_obj(name, verts, edges, radii, material, coll, root_idx=0, levels=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], edges, [])
    ob = bpy.data.objects.new(name, me)
    link(ob, coll)
    sk = ob.modifiers.new("skin", "SKIN")
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    for i, r in enumerate(radii):
        sv = me.skin_vertices[0].data[i]
        sv.radius = r if isinstance(r, tuple) else (r, r)
        sv.use_root = (i == root_idx)
    ss = ob.modifiers.new("sub", "SUBSURF")
    ss.levels = 1
    ss.render_levels = levels
    me.materials.append(material)
    return ob


def figure(coll, name, pose="stand"):
    """maniqui organico (modificador Skin): pantalon, camisa blanca, chamarra de piel
    abierta, capucha roja sin rostro. Mira a -Y. Devuelve (root, head_pivot)."""
    root = bpy.data.objects.new(name, None)
    link(root, coll)
    seated = pose == "seated"
    pz = 0.6 if seated else 1.0          # pelvis
    lean_fwd = -0.07 if seated else 0.0  # torso inclinado al teclado
    V = Vector
    pelvis = V((0, 0, pz))
    spine = V((0, lean_fwd * 0.5, pz + 0.2))
    chest = V((0, lean_fwd, pz + 0.38))
    neck0 = V((0, lean_fwd * 1.2, pz + 0.52))
    sh = {s: V((s * 0.2, lean_fwd + 0.01, pz + 0.47)) for s in (-1, 1)}
    # piernas
    if seated:
        legs = {s: [V((s * 0.1, 0, pz - 0.02)), V((s * 0.1, -0.44, pz)), V((s * 0.11, -0.48, 0.1)), V((s * 0.11, -0.62, 0.04))] for s in (-1, 1)}
    else:
        legs = {s: [V((s * 0.1, 0, pz - 0.06)), V((s * 0.1, -0.01, 0.53)), V((s * 0.105, 0.02, 0.09)), V((s * 0.105, -0.13, 0.04))] for s in (-1, 1)}
    # brazos: hombro, codo, muneca, mano
    arms = {}
    for s in (-1, 1):
        if seated:
            arms[s] = [sh[s], V((s * 0.25, -0.17, pz + 0.27)), V((s * 0.17, -0.42, pz + 0.24)), V((s * 0.15, -0.5, pz + 0.22))]
        elif pose == "lean" and s == 1:
            arms[s] = [sh[s], V((0.36, -0.06, pz + 0.24)), V((0.48, -0.18, pz + 0.03)), V((0.52, -0.24, pz - 0.02))]
        else:  # manos en los bolsillos
            arms[s] = [sh[s], V((s * 0.26, 0.04, pz + 0.18)), V((s * 0.19, -0.03, pz - 0.02)), V((s * 0.17, -0.05, pz - 0.06))]
    # pantalon
    vs = [pelvis]
    ed, rd = [], [(0.16, 0.11)]
    for s in (-1, 1):
        base = len(vs)
        vs += legs[s]
        rd += [(0.085, 0.09), (0.062, 0.065), (0.045, 0.05), (0.045, 0.03)]
        ed += [(0, base), (base, base + 1), (base + 1, base + 2), (base + 2, base + 3)]
    o = skin_obj(f"{name}_legs", vs, ed, rd, M["trousers"], coll)
    o.parent = root
    # zapatos
    for s in (-1, 1):
        a, t = legs[s][2], legs[s][3]
        sho = skin_obj(f"{name}_shoe{s}", [a + V((0, 0.03, -0.05)), t + V((0, -0.03, -0.01))], [(0, 1)], [(0.05, 0.045), (0.045, 0.03)], M["leather"], coll)
        sho.parent = root
    # camisa (torso central)
    o = skin_obj(f"{name}_shirt", [pelvis + V((0, 0, 0.04)), spine, chest, neck0 - V((0, 0, 0.02))], [(0, 1), (1, 2), (2, 3)],
                 [(0.14, 0.095), (0.135, 0.095), (0.15, 0.1), (0.07, 0.065)], M["shirt"], coll)
    o.parent = root
    # chamarra: dos columnas laterales abiertas al frente + espalda
    for s in (-1, 1):
        off = V((s * 0.088, 0.012, 0))
        o = skin_obj(f"{name}_jacket{s}", [pelvis + off + V((0, 0, 0.0)), spine + off, chest + off, sh[s] + V((-s * 0.03, 0, 0.02))],
                     [(0, 1), (1, 2), (2, 3)], [(0.095, 0.088), (0.093, 0.088), (0.104, 0.092), (0.072, 0.07)], M["leather"], coll)
        o.parent = root
        # manga
        o = skin_obj(f"{name}_sleeve{s}", arms[s][:3], [(0, 1), (1, 2)], [(0.068, 0.068), (0.058, 0.058), (0.05, 0.05)], M["leather"], coll)
        o.parent = root
        # mano
        hand = arms[s][3]
        o = skin_obj(f"{name}_hand{s}", [arms[s][2], hand], [(0, 1)], [(0.035, 0.03), (0.042, 0.022)], M["skin"], coll, levels=1)
        o.parent = root
    yoke = skin_obj(f"{name}_yoke", [sh[-1] + V((0.01, 0, 0.01)), neck0 + V((0, 0.02, -0.04)), sh[1] + V((-0.01, 0, 0.01))],
                    [(0, 1), (1, 2)], [(0.07, 0.07), (0.085, 0.075), (0.07, 0.07)], M["leather"], coll, root_idx=1)
    yoke.parent = root
    back = skin_obj(f"{name}_jback", [pelvis + V((0, 0.05, 0.02)), spine + V((0, 0.05, 0)), chest + V((0, 0.045, 0)), neck0 + V((0, 0.03, -0.02))],
                    [(0, 1), (1, 2), (2, 3)], [(0.13, 0.07), (0.13, 0.07), (0.16, 0.075), (0.1, 0.05)], M["leather"], coll)
    back.parent = root
    # cuello de camisa (lapel claro)
    col = skin_obj(f"{name}_collar", [neck0 + V((-0.07, -0.02, 0.0)), neck0 + V((0, -0.06, -0.03)), neck0 + V((0.07, -0.02, 0.0))],
                   [(0, 1), (1, 2)], [(0.03, 0.03), (0.035, 0.02), (0.03, 0.03)], M["shirt"], coll, levels=1)
    col.parent = root
    # cabeza: pasamontanas rojo
    head = bpy.data.objects.new(f"{name}_headpivot", None)
    head.location = neck0 + V((0, 0, 0.04))
    head.parent = root
    link(head, coll)
    h = skin_obj(f"{name}_hood", [V((0, 0.005, -0.07)), V((0, 0.0, 0.03)), V((0, -0.005, 0.1)), V((0, 0.0, 0.17)), V((0, 0.005, 0.235))],
                 [(0, 1), (1, 2), (2, 3), (3, 4)], [(0.06, 0.058), (0.058, 0.065), (0.08, 0.092), (0.085, 0.098), (0.066, 0.076)], M["hood"], coll)
    h.parent = head
    return root, head


# =================================================================== SET A: SALON
cA = new_coll("A_Salon")
# piso, plataforma, muros
fl = bpy.data.meshes.new("floor")
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
ob = mesh_obj("floor", bm, M["checker"], cA)
plat = cyl("platform", 5.2, 0.14, (0, -0.5, 0.07), M["platform"], cA, seg=96)
box("wall_back", (30, 0.4, 12), (0, 12, 6), M["plaster"], cA)
box("wall_left", (0.4, 30, 12), (-10, 0, 6), M["plaster"], cA)
box("wall_right", (0.4, 30, 12), (12, 0, 6), M["plaster"], cA)
box("ceiling", (30, 30, 0.4), (0, 0, 11), M["plaster"], cA)
box("wainscot_back", (30, 0.5, 1.1), (0, 11.8, 0.55), M["rail"], cA)
# cornisa de festones (como en la foto)
for i in range(-14, 15):
    s = sphere(f"scallop{i}", 0.5, (i * 1.05, 11.75, 6.4), M["plaster"], cA, (1.0, 0.35, 0.55), seg=16)
box("cornice", (30, 0.6, 0.3), (0, 11.7, 6.95), M["stone"], cA)
for i in range(-9, 10):
    sphere(f"scallopL{i}", 0.5, (-9.75, i * 1.05, 6.4), M["plaster"], cA, (0.35, 1.0, 0.55), seg=16)
box("corniceL", (0.6, 30, 0.3), (-9.7, 0, 6.95), M["stone"], cA)
# moldura iluminada superior (glow ambar)
# apliques de pared
SCONCES = []
for i, (x, y) in enumerate([(-6, 11.6), (2, 11.6), (8, 11.6), (-9.6, -2), (-9.6, 5), (11.6, 4)]):
    sphere(f"sconce{i}", 0.12, (x, y - (0.15 if y > 11 else 0), 3.1), M["sconce"], cA)
    l = add_light(f"sconceL{i}", "POINT", (x, y - 0.6 if y > 11 else y, 3.0), 60, WARM, 0.15, coll=cA)
    if x < -9:
        l.location = (x + 0.6, y, 3.0)
    if x > 11:
        l.location = (x - 0.6, y, 3.0)
    SCONCES.append(l)
# escalera curva principal + rellano
STC = (3.0, 6.8, 0)
staircase(cA, STC, 4.0, 5.8, math.radians(-78), math.radians(-205), 0.0, 5.0, 26, "stair")
box("landing", (6, 3.4, 0.35), (-3.8, 9.6, 4.85), M["stone"], cA, bevel=0.05)
for i in range(10):
    b = bpy.data.objects.new(f"land_bal{i}", BALUSTER)
    b.location = (-6.5 + i * 0.55, 8.0, 5.02)
    link(b, cA)
cu = bpy.data.curves.new("land_railc", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.07
sp = cu.splines.new("POLY")
sp.points.add(1)
sp.points[0].co = (-6.8, 8.0, 5.85, 1)
sp.points[1].co = (-1.2, 8.0, 5.85, 1)
cu.materials.append(M["rail"])
link(bpy.data.objects.new("land_rail", cu), cA)


# piano de cola
def grand_piano(coll, loc, rotz):
    root = bpy.data.objects.new("piano", None)
    root.location = loc
    root.rotation_euler = (0, 0, rotz)
    link(root, coll)
    # contorno (vista superior), teclado en y=0 mirando -Y
    pts = [(-0.75, 0.0), (0.75, 0.0), (0.75, 0.35)]
    for i in range(1, 15):  # curva de la cola
        u = i / 14
        x = 0.75 - 0.95 * (u ** 1.3)
        y = 0.35 + 1.55 * math.sin(u * math.pi / 2)
        pts.append((x * (1 - 0.25 * u) + (-0.1) * u, y))
    pts += [(-0.45, 1.85), (-0.75, 1.55)]

    def slab(name, z0, h, material):
        bm = bmesh.new()
        vs = [bm.verts.new((x, y, z0)) for x, y in pts]
        f = bm.faces.new(vs)
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        top = [v for v in r["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, h), verts=top)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = mesh_obj(name, bm, material, coll)
        o.parent = root
        md = o.modifiers.new("bev", "BEVEL")
        md.width = 0.02
        md.segments = 3
        return o

    slab("piano_case", 0.68, 0.32, M["lacquer"])
    lid = slab("piano_lid", 0.0, 0.025, M["lacquer"])
    lid.location = (-0.75, 0, 1.0)
    lid.rotation_euler = (0, -0.6, 0)
    # el pivote de la tapa: desplazar geometria
    lid.data.transform(Matrix.Translation((0.75, 0, 0)))
    lid.location = (-0.75, 0, 1.0)
    for i, (x, y) in enumerate([(-0.65, 0.1), (0.65, 0.1), (-0.2, 1.6)]):
        lg = cyl(f"piano_leg{i}", 0.06, 0.68, (x, y, 0.34), M["lacquer"], coll, r2=0.045)
        lg.parent = root
    kb = box("piano_keybed", (1.5, 0.3, 0.1), (0, -0.12, 0.74), M["lacquer"], coll)
    kb.parent = root
    keys = []
    for i in range(52):
        k = box(f"wk{i}", (0.026, 0.15, 0.022), (-0.69 + i * 0.0272, -0.19, 0.805), M["ivory"], coll)
        keys.append(k)
    wk = join(keys, "piano_whitekeys")
    wk.parent = root
    keys = []
    for i in range(51):
        if i % 7 in (2, 6):
            continue
        k = box(f"bk{i}", (0.015, 0.09, 0.03), (-0.69 + i * 0.0272 + 0.0136, -0.15, 0.825), M["ebony"], coll)
        keys.append(k)
    bk = join(keys, "piano_blackkeys")
    bk.parent = root
    bench = box("bench", (0.75, 0.38, 0.08), (0, -0.78, 0.5), M["lacquer"], coll, bevel=0.02)
    bench.parent = root
    for s in (-1, 1):
        for t in (-1, 1):
            bl = box(f"benchleg{s}{t}", (0.04, 0.04, 0.48), (s * 0.32, -0.78 + t * 0.15, 0.24), M["lacquer"], coll)
            bl.parent = root
    return root


PIANO = grand_piano(cA, (-2.4, 0.9, 0.14), math.radians(8))


# TV CRT
def crt_mesh():
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(1.0, 0.85, 0.9), verts=bm.verts)
    me = bpy.data.meshes.new("crt_body")
    bm.to_mesh(me)
    bm.free()
    return me


def tv(coll, name, loc, rot, scale, screen):
    root = bpy.data.objects.new(name, None)
    root.location = loc
    root.rotation_euler = rot
    root.scale = (scale, scale, scale)
    link(root, coll)
    body = box(f"{name}_body", (1.0, 0.85, 0.9), (0, 0.05, 0), M["bezel"], coll, bevel=0.07)
    body.parent = root
    # marco interior oscuro
    fr = box(f"{name}_frame", (0.86, 0.04, 0.62), (0, -0.38, 0.08), M["ebony"], coll, bevel=0.04)
    fr.parent = root
    # pantalla ligeramente curva
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=12, y_segments=10, size=0.5)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for lp in f.loops:
            x, y, _ = lp.vert.co
            lp[uv].uv = (x + 0.5, y + 0.5)
    for v in bm.verts:
        x, y, _ = v.co
        v.co.z = 0.06 * (1 - (2 * x) ** 2) * (1 - (2 * y) ** 2)
    bmesh.ops.scale(bm, vec=(0.76, 0.56, 1), verts=bm.verts)
    sc = mesh_obj(f"{name}_screen", bm, screen, coll, smooth=True)
    sc.rotation_euler = (math.pi / 2, 0, 0)
    sc.location = (0, -0.4, 0.08)
    sc.parent = root
    kn = cyl(f"{name}_knob", 0.06, 0.05, (0.36, -0.42, -0.32), M["chrome"], coll, rot=(math.pi / 2, 0, 0))
    kn.parent = root
    return root


HERO_TV = tv(cA, "hero_tv", (0.9, 1.2, 1.18), (0, 0, math.radians(-12)), 0.62, SCREENS[0])
cyl("tv_pedestal", 0.22, 0.88, (0.9, 1.2, 0.58), M["lacquer"], cA, seg=32)

# figuras
FIGS = {}
r, hd = figure(cA, "pianist", "seated")
r.location = (-2.32, 0.08, 0.14)
r.rotation_euler = (0, 0, math.radians(8) + math.pi)
FIGS["pianist"] = (r, hd)
# figura en la escalera: escalon ~ angulo -150
a = math.radians(-150)
step_i = int((a - math.radians(-78)) / ((math.radians(-205) - math.radians(-78)) / 26))
zst = 5.0 * (step_i + 1) / 26
r, hd = figure(cA, "stairfig", "lean")
r.location = (STC[0] + 4.6 * math.cos(a), STC[1] + 4.6 * math.sin(a), zst)
r.rotation_euler = (0, 0, math.radians(-20))
FIGS["stair"] = (r, hd)
r, hd = figure(cA, "standfig", "stand")
r.location = (3.6, 0.2, 0.14)
r.rotation_euler = (0, 0, math.radians(15))
FIGS["stand"] = (r, hd)

# luz del salon
KEY = add_light("hall_key", "AREA", (-6, -4, 8), 900, AMBER, 5.0, coll=cA)
aim(KEY, (1, 4, 1))
FILL = add_light("hall_fill", "AREA", (6, -8, 3), 120, (1.0, 0.75, 0.55), 6.0, coll=cA)
aim(FILL, (0, 2, 1.5))
RIM = add_light("hall_rim", "SPOT", (2, 10, 7), 2500, WARM, 0.3, spot=55, coll=cA)
aim(RIM, (1, 0, 1))
RED_A = add_light("hall_red", "POINT", (0.5, 3.5, 2.5), 0, RED, 0.5, coll=cA)
TVGLOW = add_light("tv_glow", "POINT", (0.75, 0.55, 1.25), 25, TEAL, 0.2, coll=cA)
SHAFT = add_light("hall_shaft", "SPOT", (-7, -2, 10), 6000, AMBER, 0.1, spot=18, coll=cA)
aim(SHAFT, (1, 2, 0))

# titulo flotante del intro
def text(coll, name, body, loc, size, rot=(math.pi / 2, 0, 0), extrude=0.02, material=None):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = FONT
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = 0.004
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.materials.append(material or M["title"])
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc
    ob.rotation_euler = rot
    return link(ob, coll)


TITLE_A = text(cA, "title_intro", "mildred pierce", (0.3, -2.0, 2.7), 0.42)

# polvo en suspension (dupliverts)
def dust(coll, name, center, extent, n, rad=0.008):
    bm = bmesh.new()
    for _ in range(n):
        bm.verts.new((random.uniform(-extent[0], extent[0]), random.uniform(-extent[1], extent[1]),
                      random.uniform(0, extent[2])))
    host = mesh_obj(name, bm, None, coll)
    host.location = center
    host.instance_type = "VERTS"
    m = mat(f"{name}_m", WARM, 0.5, emit=WARM, emit_strength=2.5)
    mote = sphere(f"{name}_mote", rad, (0, 0, 0), m, coll, seg=6)
    mote.parent = host
    return host


DUST_A = dust(cA, "dustA", (0, 2, 0), (9, 9, 8), 260, 0.005)

# =================================================================== SET B: POZO DROSTE
cB = new_coll("B_Droste")
OB = Vector((400, 0, 0))
DROSTE = bpy.data.objects.new("droste_root", None)
DROSTE.location = OB
link(DROSTE, cB)
# un nivel: 1.25 vueltas de escalera helicoidal con pozo abierto, z 12..24, r 2.6..6
lvl = staircase(cB, (0, 0, 0), 2.6, 6.0, 0.0, -2 * math.pi * 1.25, 12.0, 24.0, 44, "dlv", balusters=True,
                outer_rail=False, soffit=True)
# juntar balaustres + pasamanos + soffit en un solo objeto del nivel
parts = [o for o in cB.objects if o.name.startswith("dlv")]
for o in parts:
    if o.type == "CURVE":
        o.select_set(True)
for o in bpy.context.selected_objects:
    o.select_set(False)
curves = [o for o in parts if o.type == "CURVE"]
for o in curves:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o.select_set(False)
parts = [o for o in cB.objects if o.name.startswith("dlv")]
# los balaustres comparten malla: hacerlos reales antes de unir
for o in parts:
    if o.data and o.data.users > 1:
        o.data = o.data.copy()
LEVEL = join(parts, "droste_L0")
# muro exterior del pozo (cilindro de yeso con nichos)
wall = cyl("dwall", 6.4, 12.0, (0, 0, 18.0), M["plaster"], cB, seg=64, caps=False)
wall.data.flip_normals()
wall.select_set(False)
LEVEL.select_set(False)
LEVEL = join([LEVEL, wall], "droste_L0")
M["dcove"] = mat("dcove", WARM, 0.5, emit=WARM, emit_strength=10.0)
ring = cyl("dring", 6.3, 0.1, (0, 0, 23.7), M["dcove"], cB, seg=64, caps=False)
LEVEL = join([LEVEL, ring], "droste_L0")
LEVEL.parent = DROSTE
LEVEL.location = (0, 0, 0)
S_DROSTE = 0.5
for k in range(1, 9):
    o = LEVEL.copy()
    o.name = f"droste_L{k}"
    o.scale = (S_DROSTE ** k,) * 3
    o.rotation_euler = (0, 0, 0)
    link(o, cB)
    o.parent = DROSTE
# nivel "por encima" (k=-1) para que el zoom no deje hueco
o = LEVEL.copy()
o.name = "droste_Lm1"
o.scale = (2.0,) * 3
link(o, cB)
o.parent = DROSTE
CORE = sphere("droste_core", 0.35, OB + Vector((0, 0, 0.2)), M["core"], cB)
CORE_L = add_light("droste_coreL", "POINT", OB + Vector((0, 0, 1.0)), 3000, RED, 0.5, coll=cB)
TOPL = add_light("droste_top", "SPOT", OB + Vector((0, 0, 40)), 9000, AMBER, 1.0, spot=40, coll=cB)
aim(TOPL, OB)
DUST_B = dust(cB, "dustB", OB + Vector((0, 0, 0)), (6, 6, 30), 260, 0.008)

# =================================================================== SET C: MURO DE TVs
cC = new_coll("C_TVWall")
OC = Vector((-400, 0, 0))
floorC = box("floorC", (60, 60, 0.1), OC + Vector((0, 0, -0.05)), M["mirror"], cC)
TVS = []


def carpet(cx, cz, size, depth, idx=[0]):
    cell = size / 3.0
    for i in range(3):
        for j in range(3):
            x = cx + (i - 1) * cell
            z = cz + (j - 1) * cell
            if i == 1 and j == 1:
                idx[0] += 1
                t = tv(cC, f"wtv{idx[0]}", OC + Vector((x, 0, z)), (0, 0, random.uniform(-0.04, 0.04)),
                       cell * 0.92 / 1.0, SCREENS[1 + idx[0] % 3])
                TVS.append(t)
            elif depth > 0:
                carpet(x, z, cell, depth - 1)


carpet(0, 13.5, 27.0, 2)
backC = box("backC", (60, 0.5, 40), OC + Vector((0, 2.0, 15)), M["ebony"], cC)
REDC = add_light("tvwall_red", "AREA", OC + Vector((0, -14, 1)), 0, RED, 30, coll=cC)
aim(REDC, OC + Vector((0, 0, 12)))
KEYC = add_light("tvwall_key", "AREA", OC + Vector((-10, -12, 26)), 2500, AMBER, 10, coll=cC)
aim(KEYC, OC + Vector((0, 0, 10)))
DUST_C = dust(cC, "dustC", OC + Vector((0, -8, 0)), (14, 8, 28), 250, 0.01)

# =================================================================== SET D: ESPIRAL DE TECLAS
cD = new_coll("D_Keys")
OD = Vector((0, -400, 0))
floorD = box("floorD", (80, 80, 0.1), OD + Vector((0, 0, -0.05)), M["mirror"], cD)
KEYGROUPS = []
NKEY = 120
groups = [[] for _ in range(8)]
for i in range(NKEY):
    a = i * math.radians(13.0)
    rr = 3.0 + i * 0.05
    z = i * 0.12
    k = box(f"key{i}", (0.55, 2.2, 0.16), OD + Vector((rr * math.cos(a), rr * math.sin(a), z)), M["ivory"], cD,
            bevel=0.02, rot=(0, 0, a))
    groups[i % 8].append(k)
    if i % 7 not in (2, 6):
        kb2 = box(f"bkey{i}", (0.3, 1.3, 0.2), OD + Vector(((rr + 0.4) * math.cos(a + 0.11),
                                                            (rr + 0.4) * math.sin(a + 0.11), z + 0.15)),
                  M["ebony"], cD, bevel=0.02, rot=(0, 0, a + 0.11))
        groups[i % 8].append(kb2)
for gi, g in enumerate(groups):
    KEYGROUPS.append(join(g, f"keys_g{gi}"))
PIANO_D = grand_piano(cD, OD + Vector((0, 0, 0)), 0)
PIANO_D.scale = (2.2, 2.2, 2.2)
KEYD = add_light("keys_key", "SPOT", OD + Vector((0, -6, 26)), 30000, AMBER, 1.0, spot=50, coll=cD)
aim(KEYD, OD + Vector((0, 0, 6)))
REDD = add_light("keys_red", "POINT", OD + Vector((0, 0, 9)), 0, RED, 1.0, coll=cD)
DUST_D = dust(cD, "dustD", OD, (12, 12, 20), 220, 0.009)

# =================================================================== SET E: TRIOS RECURSIVOS
cE = new_coll("E_Trios")
OE = Vector((0, 400, 0))
cFIG = new_coll("FIG_proto", hide=True)
proto, proto_head = figure(cFIG, "proto", "stand")
floorE = box("floorE", (120, 120, 0.1), OE + Vector((0, 0, -0.05)), M["mirror"], cE)
TRIO_EMPTIES = []


def trio(parent, center, scale, depth, rad=1.1):
    e = bpy.data.objects.new(f"trio_d{depth}", None)
    e.location = center
    link(e, cE)
    if parent:
        e.parent = parent
    TRIO_EMPTIES.append((e, depth))
    for i in range(3):
        a = i * 2 * math.pi / 3
        pos = Vector((rad * scale * math.cos(a), rad * scale * math.sin(a), 0))
        inst = bpy.data.objects.new("fig_inst", None)
        inst.instance_type = "COLLECTION"
        inst.instance_collection = cFIG
        inst.location = pos
        inst.rotation_euler = (0, 0, a + math.pi / 2)
        inst.scale = (scale,) * 3
        inst.parent = e
        link(inst, cE)
        if depth > 0:
            trio(e, pos * 3.2, scale * 0.42, depth - 1, rad)


ROOT_E = bpy.data.objects.new("trios_root", None)
ROOT_E.location = OE
link(ROOT_E, cE)
trio(ROOT_E, Vector((0, 0, 0)), 1.0, 3)
HALO = bpy.data.objects.new("halo", None)
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=128, radius=9.0)
haloo = mesh_obj("halo_ring", bm, M["redneon"], cE)
haloo.location = OE + Vector((0, 0, 7.0))
md = haloo.modifiers.new("skin", "SCREW")
md.angle = 0
md.screw_offset = 0.0
md.steps = 1
haloo.data = haloo.data  # noqa
cu = bpy.data.curves.new("halo_c", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.08
sp = cu.splines.new("NURBS")
sp.points.add(63)
for i in range(64):
    a = i / 64 * 2 * math.pi
    sp.points[i].co = (9 * math.cos(a), 9 * math.sin(a), 0, 1)
sp.use_cyclic_u = True
cu.materials.append(M["redneon"])
bpy.data.objects.remove(haloo)
HALO_O = link(bpy.data.objects.new("halo_ring", cu), cE)
HALO_O.location = OE + Vector((0, 0, 7.5))
KEYE = add_light("trios_key", "SPOT", OE + Vector((0, -2, 22)), 40000, AMBER, 1.0, spot=60, coll=cE)
RIME = add_light("trios_rim", "SPOT", OE + Vector((-8, 8, 6)), 12000, WARM, 0.5, spot=60, coll=cE)
aim(RIME, OE + Vector((0, 0, 1)))
FRONTE = add_light("trios_front", "SPOT", OE + Vector((6, -9, 4)), 5000, (1.0, 0.8, 0.6), 0.5, spot=60, coll=cE)
aim(FRONTE, OE + Vector((0, 0, 1.2)))
aim(KEYE, OE)
REDE = add_light("trios_red", "POINT", OE + Vector((0, 0, 6)), 0, RED, 1.0, coll=cE)
DUST_E = dust(cE, "dustE", OE, (16, 16, 12), 260, 0.009)

# texto final
cT = new_coll("T_Titles")
OT = Vector((0, 0, -400))
END1 = text(cT, "end_title", "FRACTAL AGREEMENT", OT + Vector((0, 0, 0.3)), 0.36)
END2 = text(cT, "end_band", "mildred pierce", OT + Vector((0, 0, -0.32)), 0.2)
ENDL = add_light("end_light", "AREA", OT + Vector((0, -4, 2)), 300, WARM, 4, coll=cT)
aim(ENDL, OT)

# =================================================================== MUNDO
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes["Background"]
bg.inputs["Color"].default_value = (0.004, 0.002, 0.0015, 1)
bg.inputs["Strength"].default_value = 1.0
vol = wn.nodes.new("ShaderNodeVolumePrincipled")
vol.inputs["Density"].default_value = 0.025
vol.inputs["Anisotropy"].default_value = 0.45
vol.inputs["Color"].default_value = (1.0, 0.85, 0.7, 1)
wn.links.new(vol.outputs["Volume"], wn.nodes["World Output"].inputs["Volume"])

# =================================================================== ANIMACION AUDIO-REACTIVA
T = lambda f: (f - 1) / FPS
low = lambda f: cv("low", f)
high = lambda f: cv("high", f)
rms = lambda f: cv("rms", f)
slow = lambda f: cv("energy_slow", f)


def fl(f):
    return FLASH[f] if f < len(FLASH) else 0.0


# luces del salon
bake_fn(KEY.data, "energy", lambda f: 900 * (0.25 + sec_gain(T(f))) * (1 + 0.6 * fl(f)), step=2)
bake_fn(RIM.data, "energy", lambda f: 2500 * (0.3 + sec_gain(T(f))) * (1 + 0.4 * high(f)), step=2)
bake_fn(SHAFT.data, "energy", lambda f: 6000 * (0.4 + 0.8 * sec_gain(T(f))), step=4)
bake_fn(RED_A.data, "energy", lambda f: 1800 * (low(f) ** 1.6) * sec_gain(T(f)) + 3000 * fl(f), step=1)
for i, l in enumerate(SCONCES):
    ph = i * 1.7
    bake_fn(l.data, "energy", lambda f, ph=ph: 55 * (0.75 + 0.25 * math.sin(f * 0.21 + ph) * high(f)) * (0.4 + 0.8 * sec_gain(T(f))), step=3)
# capuchas: brillo rojo con graves en secciones intensas
hood_bsdf = M["hood"].node_tree
bake_fn(hood_bsdf, 'nodes["Principled BSDF"].inputs[27].default_value' if False else 'nodes["Principled BSDF"].inputs["Emission Strength"].default_value',
        lambda f: (0.6 * low(f) ** 2 + 1.5 * fl(f)) * max(0, sec_gain(T(f)) - 0.5) * 2.0, step=1)
# rojos de los otros sets
for L, base in ((CORE_L, 3000), (REDC, 1000), (REDD, 1000), (REDE, 700)):
    bake_fn(L.data, "energy", lambda f, base=base: base * (0.15 + low(f) ** 1.4) * (0.4 + sec_gain(T(f))) + base * 1.5 * fl(f), step=1)
bake_fn(M["redneon"].node_tree, 'nodes["Principled BSDF"].inputs["Emission Strength"].default_value',
        lambda f: 4 + 30 * low(f) ** 2 + 40 * fl(f), step=1)
bake_fn(M["core"].node_tree, 'nodes["Principled BSDF"].inputs["Emission Strength"].default_value',
        lambda f: 20 + 80 * low(f) ** 2 + 80 * fl(f), step=1)
# volumen: densidad sube en picos
bake_fn(world.node_tree, 'nodes["Principled Volume"].inputs["Density"].default_value',
        lambda f: 0.018 + 0.02 * slow(f), step=6)

# pantallas: brillo, estatica y cuadro del ojo
CUT_FRAMES = []  # se llena con los cortes (estatica breve en cada corte)


def eye_schedule(variant):
    """lista (t, tile) -> tile 1..12 del atlas"""
    sch = [(0, 10)]
    if variant == 0:
        sch += [(5.5, 10), (7.2, 9), (9.0, 1)]
        looks = [1, 2, 3, 4, 1, 6, 9, 5, 8, 1, 7, 1]
        t = 36.0
        i = 0
        while t < 172:
            sch.append((qd(t), looks[i % len(looks)]))
            i += 1
            t += 2.186 * (2 if t < 88 else 1)
        sch += [(175.5, 1), (178.0, 8), (180.2, 10), (182.4, 9), (183.5, 7), (184.6, 11), (186.2, 12), (189.0, 1)]
        t = 190
        while t < 262:
            sch.append((qd(t), random.choice([1, 2, 3, 4, 6, 7, 9])))
            t += 2.186
        sch += [(262.4, 1), (264.5, 10)]
    else:
        t = 0.5 + variant * 0.7
        while t < 268:
            sch.append((t, random.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 1, 10, 11, 12])))
            t += 0.5466 * random.choice([2, 4, 4, 8])
    return sorted(sch)


for vi, sm in enumerate(SCREENS):
    nt = sm.node_tree
    sch = eye_schedule(vi)
    frames, xs, ys = [], [], []
    for t, tile in sch:
        idx = tile - 1
        col, row = idx % 4, idx // 4
        frames.append(F(t))
        xs.append(col / 4)
        ys.append((2 - row) / 3)
    # unir claves duplicadas
    dd = {}
    for f, x, y in zip(frames, xs, ys):
        dd[f] = (x, y)
    fr = sorted(dd)
    bake(nt, 'nodes["Tile"].inputs["Location"].default_value', fr, [dd[f][0] for f in fr], index=0, interp="CONSTANT")
    bake(nt, 'nodes["Tile"].inputs["Location"].default_value', fr, [dd[f][1] for f in fr], index=1, interp="CONSTANT")


def static_amt(f, vi):
    t = T(f)
    s = 0.08 + 0.35 * high(f) ** 2 + 0.8 * fl(f)
    if vi == 0:
        if t < 5.5:
            s = 1.0 if t > 1.0 else 0.0
        if 264.6 < t:
            s = 1.0
        if t > 265.6:
            s = 0.0
    for cf in CUT_FRAMES:
        if 0 <= f - cf < 3:
            s = max(s, 0.85)
    return min(s, 1.0)


def screen_power(f, vi):
    t = T(f)
    if vi == 0 and (t < 1.0 or t > 265.6):
        return 0.0
    return (2.2 + 1.6 * rms(f)) * (1 + 1.5 * fl(f))


# =================================================================== CAMARAS / CORTES
cCam = new_coll("Cameras")
SHOTS = []
B = 0.5466
BAR = 4 * B


def shot(t0, t1, kind, **kw):
    SHOTS.append(dict(t0=t0, t1=t1, kind=kind, **kw))


def ease(u):
    return u * u * (3 - 2 * u)


H = Vector  # alias
# --- S1 intro: TV que despierta y el salon en penumbra
shot(0.0, 9.1, "line", p0=H((0.35, -1.2, 1.3)), p1=H((0.6, -0.35, 1.25)), l0=H((0.85, 1.1, 1.2)), l1=H((0.88, 1.15, 1.2)), lens=50)
shot(9.1, 18.1, "line", p0=H((-1.0, -9.5, 2.0)), p1=H((0.4, -6.5, 2.3)), l0=H((0.3, 2, 2.4)), l1=H((0.3, 2, 2.6)), lens=32)
# --- S2: barandal en primer plano, revelacion de la figura en la escalera
shot(18.1, 26.8, "line", p0=H((7.6, 2.0, 1.4)), p1=H((6.2, 4.8, 4.2)), l0=H((3.0, 2.0, 2.0)), l1=H((-0.5, 3.8, 4.0)), lens=28)
shot(26.8, 35.2, "orbit", c=H(FIGS["stair"][0].location) + H((0, 0, 1.3)), r=4.6, a0=-1.25, a1=-0.6, h0=0.5, h1=0.1, lens=40)
# --- S3/S4: entra el beat; homenaje a la foto + retratos
shot(35.2, 43.9, "line", p0=H((0.2, -9.0, 1.5)), p1=H((0.6, -7.8, 1.6)), l0=H((0.8, 3.0, 2.4)), l1=H((0.8, 3.0, 2.4)), lens=30)
shot(43.9, 48.3, "orbit", c=H((-2.35, 0.2, 1.45)), r=2.2, a0=-2.0, a1=-1.6, h0=0.3, h1=0.25, lens=40)
shot(48.3, 52.7, "line", p0=H((2.2, -3.2, 1.35)), p1=H((2.45, -2.6, 1.4)), l0=H((3.6, 0.2, 1.3)), l1=H((3.6, 0.2, 1.35)), lens=40)
shot(52.7, 56.0, "line", p0=H((1.0, -0.3, 1.2)), p1=H((0.95, -0.05, 1.2)), l0=H((0.88, 1.15, 1.18)), l1=H((0.88, 1.15, 1.18)), lens=60)
shot(56.0, 61.4, "orbit", c=H((0.5, 2.0, 2.0)), r=8.0, a0=-1.9, a1=-1.3, h0=1.0, h1=3.0, lens=24)
shot(61.4, 65.8, "line", p0=H((-1.4, -1.0, 0.95)), p1=H((-1.9, -0.6, 0.95)), l0=H((-2.3, 0.75, 0.9)), l1=H((-2.4, 0.9, 0.9)), lens=45)
# --- S5: subir por la escalera -> entrar al pozo
shot(65.8, 76.8, "helix", c=H(STC), r=3.1, a0=math.radians(-80), a1=math.radians(-215), z0=1.5, z1=6.8, look_up=0.0, lens=22)
shot(76.8, 87.9, "droste", speed=0.35, roll0=0.0, roll1=0.6, dirn=1, tilt=0.15)
# --- S6: coro (pico largo)
shot(87.9, 96.6, "droste", speed=0.9, roll0=0.6, roll1=1.8, dirn=1, tilt=0.05)
shot(96.6, 105.4, "droste", speed=1.0, roll0=1.8, roll1=2.6, dirn=1, tilt=0.35)
for i, t in enumerate([105.4, 109.8, 114.1, 118.5]):
    if i % 2 == 0:
        shot(t, t + 2 * BAR, "line", p0=OC + H((-10 + i * 3, -26, 6 + i)), p1=OC + H((-2 + i, -15, 11)), l0=OC + H((0, 0, 13)), l1=OC + H((0, 0, 13.5)), lens=28)
    else:
        shot(t, t + 2 * BAR, "line", p0=OC + H((0.5, -9, 13.6)), p1=OC + H((0.0, -4.5, 13.5)), l0=OC + H((0, 0, 13.5)), l1=OC + H((0, 0, 13.5)), lens=35)
for i, t in enumerate([122.9, 127.3, 131.6, 136.0]):
    shot(t, t + 2 * BAR, "orbit", c=OE + H((0, 0, 1.4)), r=5.5 + 3 * (i % 2), a0=i * 1.3, a1=i * 1.3 + 0.9, h0=0.4 + i, h1=1.4 + i, lens=24 + 6 * (i % 2))
shot(140.4, 144.8, "line", p0=H((-3.7, 0.15, 1.4)), p1=H((-3.45, 0.3, 1.32)), l0=H((-2.1, 0.75, 0.95)), l1=H((-2.0, 0.78, 0.95)), lens=40)
shot(144.8, 149.1, "orbit", c=H((-2.4, 1.3, 1.0)), r=3.0, a0=2.2, a1=2.9, h0=1.9, h1=1.2, lens=30)
shot(149.1, 154.3, "line", p0=H((-2.2, -0.9, 1.25)), p1=H((-2.0, -0.6, 1.15)), l0=H((-2.35, 0.75, 0.85)), l1=H((-2.35, 0.8, 0.85)), lens=60)
# rafaga de cortes en los golpes 154-157.7
burst = [(OE + H((0, -6, 1.6)), OE + H((0, 0, 1.6))), (OC + H((0, -6, 13.5)), OC + H((0, 0, 13.5))),
         (H((3.4, -1.0, 1.9)), H((3.6, 0.2, 1.95))), (OD + H((0, -10, 8)), OD + H((0, 0, 5))),
         (H((1.0, -0.1, 1.2)), H((0.88, 1.15, 1.18))), (OE + H((5, -5, 3)), OE + H((0, 0, 1)))]
tb = 154.3
for i in range(6):
    p, l = burst[i]
    shot(tb + i * B, tb + (i + 1) * B, "line", p0=p, p1=p + (l - p) * 0.08, l0=l, l1=l, lens=40)
# --- S7: descenso, figura sola
shot(157.7, 166.4, "orbit", c=H((3.6, 0.2, 1.4)), r=5.0, a0=-2.4, a1=-1.4, h0=0.8, h1=0.2, lens=35)
shot(166.4, 175.1, "line", p0=H((4.0, -8.5, 6.5)), p1=H((2.5, -7.0, 4.5)), l0=H((0.5, 3.0, 1.5)), l1=H((0.8, 2.0, 1.4)), lens=28)
# --- S8: el ojo cierra y llora
shot(175.1, 188.2, "line", p0=H((1.05, 0.15, 1.2)), p1=H((0.96, 0.52, 1.2)), l0=H((0.87, 1.15, 1.19)), l1=H((0.87, 1.15, 1.19)), lens=55)
# --- S9: regreso
shot(188.2, 196.9, "orbit", c=OE + H((0, 0, 1.0)), r=11, a0=0.0, a1=1.1, h0=6.0, h1=3.0, lens=22)
shot(196.9, 205.7, "line", p0=H((-0.8, -9.5, 1.3)), p1=H((0.2, -7.0, 2.0)), l0=H((0.8, 3.0, 2.2)), l1=H((0.6, 3.0, 2.8)), lens=26)
shot(205.7, 214.4, "droste", speed=-0.8, roll0=0.0, roll1=-1.2, dirn=-1, tilt=0.2)
shot(214.4, 216.5, "line", p0=OC + H((0, -20, 13.5)), p1=OC + H((0, -14, 13.5)), l0=OC + H((0, 0, 13.5)), l1=OC + H((0, 0, 13.5)), lens=30)
for i, t in enumerate([216.5, 217.6, 219.8, 222.0, 224.2]):
    nxt = [217.6, 219.8, 222.0, 224.2, 231.3][i]
    if i % 2 == 0:
        shot(t, nxt, "orbit", c=OE + H((0, 0, 1.4)), r=4 + i, a0=i * 2.0, a1=i * 2.0 + 0.5, h0=0.5, h1=1.0, lens=28)
    else:
        shot(t, nxt, "line", p0=OC + H((-3 + i, -10, 9 + i)), p1=OC + H((-1 + i, -7, 12)), l0=OC + H((0, 0, 13.5)), l1=OC + H((0, 0, 13.5)), lens=32)
# --- S10: climax (cortes de 2 compases ciclando sets)
cyc = ["droste", "hall", "trios", "tvs", "keys", "hall2"]
t = 231.3
i = 0
while t < 260.0:
    t1 = min(t + 2 * BAR, 262.4)
    k = cyc[i % len(cyc)]
    if k == "droste":
        shot(t, t1, "droste", speed=1.6, roll0=i * 0.7, roll1=i * 0.7 + 1.2, dirn=1, tilt=0.1)
    elif k == "hall":
        shot(t, t1, "orbit", c=H((0.5, 2.5, 2.2)), r=7.5, a0=-2.2 + i * 0.1, a1=-1.4, h0=3.5, h1=1.5, lens=22)
    elif k == "trios":
        shot(t, t1, "orbit", c=OE + H((0, 0, 1.5)), r=7, a0=i, a1=i + 1.2, h0=8, h1=2, lens=22)
    elif k == "tvs":
        shot(t, t1, "line", p0=OC + H((0, -30, 13.5)), p1=OC + H((0, -5, 13.5)), l0=OC + H((0, 0, 13.5)), l1=OC + H((0, 0, 13.5)), lens=28)
    elif k == "keys":
        shot(t, t1, "orbit", c=H((-2.4, 1.0, 1.0)), r=2.6, a0=-2.6 + i * 0.2, a1=-1.9 + i * 0.2, h0=0.6, h1=1.4, lens=30)
    else:
        shot(t, t1, "line", p0=H((7.0, -5.0, 6.0)), p1=H((4.0, -3.0, 2.5)), l0=H((0.5, 3.0, 2.0)), l1=H((0.5, 2.0, 1.4)), lens=24)
    t = t1
    i += 1
shot(t, 262.4, "line", p0=H((1.3, -0.6, 1.25)), p1=H((1.1, -0.1, 1.22)), l0=H((0.87, 1.15, 1.19)), l1=H((0.87, 1.15, 1.19)), lens=50)
# --- S11: TV se apaga + tarjeta final
shot(262.4, 266.0, "line", p0=H((1.1, -0.1, 1.22)), p1=H((0.98, 0.4, 1.2)), l0=H((0.87, 1.15, 1.19)), l1=H((0.87, 1.15, 1.19)), lens=50)
shot(266.0, END_S, "line", p0=OT + H((0, -6.0, 0)), p1=OT + H((0, -5.4, 0)), l0=OT, l1=OT, lens=50)


def droste_phase_fn():
    """fase acumulada del zoom Droste (1 = una octava)"""
    ph = [0.0] * (NF + 2)
    sp = [0.0] * (NF + 2)
    for s in SHOTS:
        if s["kind"] == "droste":
            for f in range(F(s["t0"]), F(s["t1"]) + 1):
                sp[min(f, NF + 1)] = s["speed"] * (0.6 + 0.8 * cv("rms", f))
    acc = 0.0
    for f in range(1, NF + 2):
        acc += sp[f] / FPS * 0.5
        ph[f] = acc
    return ph


DPH = droste_phase_fn()
# escala del root Droste: 2^(fase mod 1)  (bucle sin costura)
fr = list(range(1, NF + 1))
vals = []
for f in fr:
    u = DPH[f] % 1.0
    vals.append(2.0 ** u)
for idx in range(3):
    bake(DROSTE, "scale", fr, vals, index=idx)

# camaras
for n, s in enumerate(SHOTS):
    cd = bpy.data.cameras.new(f"cam{n:02d}")
    cd.lens = s.get("lens", 16 if s["kind"] == "droste" else 35)
    cd.clip_start = 0.02
    cd.clip_end = 300
    cd.dof.use_dof = s["kind"] in ("line", "orbit")
    cam = bpy.data.objects.new(f"cam{n:02d}", cd)
    link(cam, cCam)
    f0, f1 = F(s["t0"]), F(s["t1"])
    frames = list(range(f0, f1 + 1))
    locs, rots, focus = [], [], []
    seed = random.random() * 100
    for f in frames:
        u = (f - f0) / max(f1 - f0, 1)
        e = ease(u)
        k = s["kind"]
        if k == "line":
            p = s["p0"].lerp(s["p1"], e)
            l = s["l0"].lerp(s["l1"], e)
        elif k == "orbit":
            a = s["a0"] + (s["a1"] - s["a0"]) * e
            p = s["c"] + Vector((s["r"] * math.cos(a), s["r"] * math.sin(a), s["h0"] + (s["h1"] - s["h0"]) * e))
            l = s["c"]
        elif k == "helix":
            a = s["a0"] + (s["a1"] - s["a0"]) * e
            z = s["z0"] + (s["z1"] - s["z0"]) * e
            c = s["c"]
            p = Vector((c[0] + s["r"] * math.cos(a), c[1] + s["r"] * math.sin(a), c[2] + z))
            if s.get("look_center"):
                l = Vector((c[0], c[1], c[2] + z * 0.6))
            else:
                da = 0.35 * (1 if s["a1"] > s["a0"] else -1)
                l = Vector((c[0] + s["r"] * math.cos(a + da), c[1] + s["r"] * math.sin(a + da), c[2] + z + 0.5 + s["look_up"]))
        else:  # droste: mirando hacia abajo por el pozo
            roll = s["roll0"] + (s["roll1"] - s["roll0"]) * e
            p = OB + Vector((0.7 * math.cos(roll * 2), 0.7 * math.sin(roll * 2), 22.5))
            l = OB + Vector((s["tilt"] * 3 * math.cos(roll), s["tilt"] * 3 * math.sin(roll), 0))
        # temblor de camara con graves/onsets
        sh = 0.004 + 0.03 * fl(f) + 0.006 * cv("low", f)
        p = p + Vector((math.sin(f * 1.7 + seed) * sh, math.cos(f * 2.3 + seed) * sh, math.sin(f * 2.9 + seed) * sh * 0.6))
        d = l - p
        q = d.to_track_quat("-Z", "Y")
        eul = q.to_euler()
        if k == "droste":
            eul = (Matrix.Rotation(roll, 4, "Z") @ q.to_matrix().to_4x4()).to_euler()
        locs.append(p)
        rots.append(eul)
        focus.append(d.length)
    for idx in range(3):
        bake(cam, "location", frames, [v[idx] for v in locs], index=idx)
        bake(cam, "rotation_euler", frames, [v[idx] for v in rots], index=idx)
    if cd.dof.use_dof:
        cd.dof.aperture_fstop = 2.0
        bake(cd, "dof.focus_distance", frames, focus, index=-1)
    m = scene.timeline_markers.new(f"S{n:02d}", frame=f0)
    m.camera = cam
    CUT_FRAMES.append(f0)
    s["cam"] = cam
scene.camera = SHOTS[0]["cam"]

# pantallas (despues de conocer los cortes)
for vi, sm in enumerate(SCREENS):
    nt = sm.node_tree
    bake_fn(nt, 'nodes["StaticMix"].inputs[0].default_value', lambda f, vi=vi: static_amt(f, vi), step=1)
    bake_fn(nt, 'nodes["Emit"].inputs["Strength"].default_value', lambda f, vi=vi: screen_power(f, vi), step=1)
    bake_fn(nt, 'nodes["Static"].inputs["W"].default_value', lambda f: f * 0.37, step=1)
bake_fn(TVGLOW.data, "energy", lambda f: 30 * screen_power(f, 0), step=1)

# titulo intro: aparece 12.5s, se disuelve 17.5s
bake_fn(M["title"].node_tree, 'nodes["Principled BSDF"].inputs["Emission Strength"].default_value',
        lambda f: 3.0 * max(0, min(1, (T(f) - 11.5) / 2.0)) * max(0, min(1, (17.8 - T(f)) / 1.2)) if T(f) < 30 else 3.0 * max(0, min(1, (T(f) - 266.4) / 1.2)), step=1)
bake_fn(TITLE_A, "location", lambda f: -2.0 + 0.05 * (T(f) - 9), index=1, step=4, f1=F(19))
bake_fn(TITLE_A, "hide_render", lambda f: 0 if 9 < T(f) < 18.2 else 1, step=1, interp="CONSTANT")

# figuras: cabezas que voltean a camara en momentos clave (inquietante)
def head_turns(head, times, base=0.0):
    fr, vals = [1], [base]
    for t, ang in times:
        fr += [F(t) - 6, F(t) + 6]
        vals += [vals[-1], ang]
    bake(head, "rotation_euler", fr, vals, index=2, interp="BEZIER")


head_turns(FIGS["stand"][1], [(48.5, 0.0), (60.0, -0.5), (150.0, 0.0), (159.0, -0.6), (188.2, 0.0), (240.0, -0.5)], 0.25)
head_turns(FIGS["stair"][1], [(28.0, 0.5), (32.6, 0.0), (90.0, 0.4), (197.0, 0.0), (233.0, 0.35)], 0.0)
head_turns(FIGS["pianist"][1], [(45.0, 0.0), (61.5, 0.45), (150.0, 0.0), (241.0, 0.5)], 0.0)
# balanceo sutil del pianista con el beat
bake_fn(FIGS["pianist"][0], "rotation_euler", lambda f: 0.02 * math.sin(2 * math.pi * T(f) / (2 * B)) * (0.3 + rms(f)), index=0, step=2)

# trios: giro escalonado en cada compas, alternando direccion por profundidad
bar_steps = [F(d) for d in DOWN]


def stepped_angle(f, depth):
    n = sum(1 for b in bar_steps if b <= f)
    # dentro del compas, easing de 10 frames
    last = max([b for b in bar_steps if b <= f], default=1)
    u = min(1.0, (f - last) / 10.0)
    ang = (n - 1 + ease(u)) * math.radians(30) * (1 if depth % 2 else -1)
    return ang


for e, depth in TRIO_EMPTIES:
    bake_fn(e, "rotation_euler", lambda f, d=depth: stepped_angle(f, d), index=2, step=1, f0=F(110), f1=F(266))
bake_fn(HALO_O, "location", lambda f: OE.z + 7.5 + 0.6 * math.sin(T(f) * 0.8), index=2, step=4)

# teclas de la espiral: se hunden por grupos en cada beat
beat_frames = [F(b) for b in BEATS]
for gi, g in enumerate(KEYGROUPS):
    def kz(f, gi=gi):
        n = sum(1 for b in beat_frames if b <= f)
        last = max([b for b in beat_frames if b <= f], default=1)
        hit = (n % 8) == gi
        d = math.exp(-(f - last) / 4.0) if hit else 0.0
        return -0.12 * d * (0.5 + low(f))
    bake_fn(g, "location", kz, index=2, step=1, f0=F(138), f1=F(262))

# polvo: deriva lenta
for dobj in (DUST_A, DUST_B, DUST_C, DUST_D, DUST_E):
    bake_fn(dobj, "rotation_euler", lambda f: f * 0.0004, index=2, step=24)

# =================================================================== RENDER (vista previa por defecto)
ee = scene.eevee
ee.taa_render_samples = 16
ee.use_volumetric_shadows = True
ee.volumetric_tile_size = "16"
ee.volumetric_samples = 32
ee.volumetric_end = 80
ee.use_shadows = True
ee.use_raytracing = False
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 33
scene.render.film_transparent = False
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.4

# compositor: bloom (glare) + dispersion leve
try:
    ng = bpy.data.node_groups.new("FA_Comp", "CompositorNodeTree")
    scene.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    try:
        gl.inputs["Type"].default_value = "Bloom"
    except Exception:
        try:
            gl.glare_type = "BLOOM"
        except Exception:
            gl.glare_type = "FOG_GLOW"
    for nm, v in (("Threshold", 0.9), ("Strength", 0.35), ("Size", 0.6)):
        try:
            gl.inputs[nm].default_value = v
        except Exception:
            pass
    ld = ng.nodes.new("CompositorNodeLensdist")
    for nm, v in (("Dispersion", 0.012), ("Distortion", -0.01)):
        try:
            ld.inputs[nm].default_value = v
        except Exception:
            pass
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], ld.inputs["Image"])
    ng.links.new(ld.outputs["Image"], out.inputs[0])
    print("COMPOSITOR OK")
except Exception as ex:
    print("COMPOSITOR FAIL", ex)

bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("SAVED", OUT, "frames", NF, "shots", len(SHOTS))
