"""Verify a rigged GLB: skins, joint hierarchy, per-vertex weights, textures."""
import json, struct, sys
import numpy as np

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load(path):
    b = open(path, "rb").read()
    magic, ver, ln = struct.unpack("<III", b[:12])
    assert magic == 0x46546C67, "not a GLB"
    jl, jt = struct.unpack("<II", b[12:20])
    js = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl, bt = struct.unpack("<II", b[o:o + 8])
    return js, b[o + 8:o + 8 + bl]


def acc(js, binb, i):
    a = js["accessors"][i]; v = js["bufferViews"][a["bufferView"]]
    dt = CT[a["componentType"]]; n = NC[a["type"]]
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(binb, np.uint8, count=stride * a["count"], offset=start).reshape(a["count"], stride)[:, :isz]
        arr = raw.copy().view(dt).reshape(a["count"], n)
    else:
        arr = np.frombuffer(binb, dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    if a.get("normalized"):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr


def main(path):
    js, binb = load(path)
    skins = js.get("skins", [])
    print(f"file: {path}")
    print(f"skins: {len(skins)}  nodes: {len(js['nodes'])}  meshes: {len(js.get('meshes', []))}  "
          f"materials: {len(js.get('materials', []))}  textures: {len(js.get('textures', []))}  images: {len(js.get('images', []))}")
    assert skins, "no skin"
    ok = True
    for si, s in enumerate(skins):
        joints = s["joints"]
        jset = set(joints)
        roots = [j for j in joints if not any(j in js["nodes"][p].get("children", []) for p in joints)]
        print(f"skin {si}: {len(joints)} joints, roots in skin: {len(roots)}, names e.g. {[js['nodes'][j].get('name') for j in joints[:4]]}")
        ibm = acc(js, binb, s["inverseBindMatrices"]) if "inverseBindMatrices" in s else None
        if ibm is not None:
            print(f"  inverseBindMatrices: {ibm.shape}, finite={np.isfinite(ibm).all()}")
            ok &= bool(np.isfinite(ibm).all())
    used = np.zeros(max(len(s["joints"]) for s in skins), bool)
    for mi, n in enumerate(js["nodes"]):
        if "mesh" not in n:
            continue
        m = js["meshes"][n["mesh"]]
        for p in m["primitives"]:
            at = p["attributes"]
            if "JOINTS_0" not in at:
                print(f"  mesh node {n.get('name')}: NOT skinned"); ok = False; continue
            J = acc(js, binb, at["JOINTS_0"]).astype(int); W = acc(js, binb, at["WEIGHTS_0"]).astype(np.float64)
            ws = W.sum(1)
            used[np.unique(J[W > 1e-4])] = True
            print(f"  mesh node '{n.get('name')}' skin={n.get('skin')} verts={len(W)}  weight sum min/max={ws.min():.4f}/{ws.max():.4f}  "
                  f"zero-weight verts={(ws < 1e-6).sum()}  nan={np.isnan(W).any()}  textured={'TEXCOORD_0' in at}")
            ok &= bool(abs(ws - 1).max() < 1e-2 and not np.isnan(W).any())
    print(f"joints actually influencing vertices: {used.sum()}/{len(used)}")
    print("RESULT:", "OK" if ok else "PROBLEM")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
