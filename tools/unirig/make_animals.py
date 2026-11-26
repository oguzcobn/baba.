"""Procedurally model original low-poly quadrupeds (lion, deer) in Blender (bpy) and export GLB.
Blender is Z-up; the head points to -Y so glTF output faces +Z.
usage: python make_animals.py <out_dir>"""
import sys, math
import bpy
from mathutils import Vector

OUT = sys.argv[-1]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def skin_object(name, verts, edges, radii, root=0, subdiv=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata([Vector(v) for v in verts], edges, [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sk = ob.modifiers.new("skin", "SKIN")
    sk.use_smooth_shade = True
    for i, r in enumerate(radii):
        rv = ob.data.skin_vertices[0].data[i]
        rv.radius = r if isinstance(r, (tuple, list)) else (r, r)
        rv.use_root = (i == root)
    sd = ob.modifiers.new("sub", "SUBSURF")
    sd.levels = subdiv
    sd.render_levels = subdiv
    bpy.ops.object.modifier_apply(modifier="skin")
    bpy.ops.object.modifier_apply(modifier="sub")
    ob.select_set(False)
    return ob


class G:
    """tiny graph builder: add(point, radius, parent) -> index"""
    def __init__(self):
        self.v, self.e, self.r = [], [], []

    def add(self, p, r, parent=None):
        self.v.append(p); self.r.append(r)
        i = len(self.v) - 1
        if parent is not None:
            self.e.append((parent, i))
        return i

    def chain(self, pts, rs, parent):
        last = parent
        for p, r in zip(pts, rs):
            last = self.add(p, r, last)
        return last


def leg(g, attach, x, y, top_z, joints, radii):
    """joints: list of (dy, z) relative positions down to the hoof/paw."""
    pts = [(x, y + dy, z) for dy, z in joints]
    return g.chain(pts, radii, attach)


def color_faces(ob, rules):
    """rules: list of (material_index, predicate(center, normal)) applied in order (first match wins)."""
    me = ob.data
    for p in me.polygons:
        c = ob.matrix_world @ p.center
        for idx, pred in rules:
            if pred(c, p.normal):
                p.material_index = idx
                break


def finish(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # decimate a little to keep the web model light
    d = ob.modifiers.new("dec", "DECIMATE"); d.ratio = 0.6
    bpy.ops.object.modifier_apply(modifier="dec")
    bpy.ops.object.shade_smooth()
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_apply=True)
    print("wrote", path, len(ob.data.vertices), "verts")


def deer():
    reset()
    g = G()
    hip = g.add((0, 0.42, 1.02), (0.2, 0.22))
    mid = g.add((0, 0.0, 1.06), (0.23, 0.25), hip)
    sh = g.add((0, -0.40, 1.12), (0.2, 0.23), mid)
    n1 = g.add((0, -0.58, 1.32), 0.11, sh)
    n2 = g.add((0, -0.70, 1.56), 0.085, n1)
    hd = g.add((0, -0.80, 1.66), (0.085, 0.1), n2)
    sn = g.add((0, -1.02, 1.56), (0.05, 0.055), hd)
    g.add((0, -1.08, 1.53), 0.035, sn)
    for s in (1, -1):  # ears
        e = g.add((0.08 * s, -0.78, 1.74), 0.035, hd)
        g.add((0.17 * s, -0.76, 1.82), (0.02, 0.045), e)
    t = g.add((0, 0.58, 1.02), 0.06, hip)
    g.add((0, 0.66, 0.92), 0.045, t)
    for s in (1, -1):
        leg(g, sh, 0.13 * s, -0.40, 1.0, [(0, 0.86), (0.02, 0.62), (0.0, 0.42), (-0.02, 0.12), (-0.04, 0.02)], [0.075, 0.055, 0.04, 0.032, 0.035])
        leg(g, hip, 0.13 * s, 0.42, 1.0, [(-0.04, 0.84), (-0.1, 0.62), (0.08, 0.42), (0.04, 0.12), (0.03, 0.02)], [0.09, 0.07, 0.04, 0.032, 0.035])
    body = skin_object("Deer", g.v, g.e, g.r)
    # antlers
    a = G()
    for s in (1, -1):
        b0 = a.add((0.05 * s, -0.80, 1.74), 0.022)
        b1 = a.add((0.13 * s, -0.76, 1.92), 0.018, b0)
        b2 = a.add((0.2 * s, -0.70, 2.1), 0.015, b1)
        a.add((0.27 * s, -0.66, 2.24), 0.011, b2)
        a.add((0.12 * s, -0.88, 2.02), 0.011, b1)
        a.add((0.3 * s, -0.78, 2.12), 0.01, b2)
        a.add((0.17 * s, -0.6, 2.2), 0.01, b2)
    # skin modifier needs a connected graph per root; build each side separately
    ants = []
    for side in (0, 1):
        sl = slice(side * 7, side * 7 + 7)
        vs = a.v[sl]; rs = a.r[sl]
        es = [(p - side * 7, c - side * 7) for p, c in a.e if side * 7 <= c < side * 7 + 7]
        ants.append(skin_object("Antler%d" % side, vs, es, rs, subdiv=1))
    mats = [mat("deer_coat", (0.45, 0.27, 0.14)), mat("deer_belly", (0.86, 0.8, 0.7)), mat("deer_dark", (0.08, 0.06, 0.05), 0.5), mat("antler", (0.78, 0.7, 0.55), 0.6)]
    for o in [body] + ants:
        for m in mats:
            o.data.materials.append(m)
    color_faces(body, [
        (2, lambda c, n: c.z < 0.07 or c.y < -1.05),                       # hooves, nose
        (1, lambda c, n: (c.z < 0.98 and abs(c.y) < 0.45 and n.z < -0.3) or (c.y > 0.6 and c.z < 1.0) or (c.y < -0.85 and c.z < 1.58)),  # belly, rump, chin
        (0, lambda c, n: True)])
    for o in ants:
        for p in o.data.polygons:
            p.material_index = 3
    finish([body] + ants, OUT + "/geyik.glb")


def lion():
    reset()
    g = G()
    hip = g.add((0, 0.55, 0.88), (0.24, 0.26))
    mid = g.add((0, 0.05, 0.92), (0.27, 0.28), hip)
    sh = g.add((0, -0.45, 0.98), (0.27, 0.32), mid)
    n1 = g.add((0, -0.68, 1.08), 0.2, sh)
    hd = g.add((0, -0.86, 1.12), (0.17, 0.19), n1)
    sn = g.add((0, -1.08, 1.04), (0.1, 0.1), hd)
    g.add((0, -1.15, 1.0), 0.06, sn)
    for s in (1, -1):
        g.add((0.13 * s, -0.8, 1.3), 0.05, hd)
    t = g.add((0, 0.75, 0.86), 0.05, hip)
    t = g.add((0, 0.98, 0.7), 0.035, t)
    t = g.add((0, 1.14, 0.55), 0.03, t)
    t = g.add((0, 1.22, 0.45), 0.06, t)  # tuft
    g.add((0, 1.28, 0.4), 0.04, t)
    for s in (1, -1):
        leg(g, sh, 0.16 * s, -0.45, 0.9, [(0.02, 0.72), (0.0, 0.48), (-0.02, 0.24), (-0.06, 0.05)], [0.12, 0.1, 0.075, 0.08])
        leg(g, hip, 0.16 * s, 0.55, 0.9, [(-0.05, 0.68), (0.06, 0.46), (0.1, 0.24), (0.02, 0.05)], [0.14, 0.1, 0.07, 0.08])
    body = skin_object("Lion", g.v, g.e, g.r)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.34, location=(0, -0.72, 1.12))
    mane = bpy.context.active_object
    mane.scale = (1.0, 0.75, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mats = [mat("lion_coat", (0.6, 0.38, 0.16)), mat("lion_light", (0.82, 0.66, 0.42)), mat("lion_dark", (0.25, 0.15, 0.08)), mat("lion_mane", (0.42, 0.24, 0.1), 0.95)]
    for o in (body, mane):
        for m in mats:
            o.data.materials.append(m)
    color_faces(body, [
        (2, lambda c, n: c.y > 1.15 or c.y < -1.13),                       # tail tuft, nose
        (1, lambda c, n: (n.z < -0.6 and c.z > 0.5 and abs(c.y) < 0.6) or c.z < 0.07 or (c.y < -1.0 and c.z < 1.02)),  # belly, paws, muzzle
        (0, lambda c, n: True)])
    for p in mane.data.polygons:
        p.material_index = 3
    finish([body, mane], OUT + "/aslan.glb")


deer()
lion()
