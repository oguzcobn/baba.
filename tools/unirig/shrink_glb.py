"""Shrink embedded textures of a GLB for the web (resize + JPEG/WebP-free re-encode).
Geometry, skin, joints and weights are copied byte-for-byte; only image bufferViews change.
Also drops unused secondary attributes (TEXCOORD_1, COLOR_1) that three.js materials here don't use.
usage: python shrink_glb.py in.glb out.glb [max_px]"""
import io, json, struct, sys
from PIL import Image


def read(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    js = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack("<I", b[o:o + 4])[0]
    return js, b[o + 8:o + 8 + bl]


def main(src, dst, max_px=1024):
    js, binb = read(src)
    img_views = {im["bufferView"]: i for i, im in enumerate(js.get("images", [])) if "bufferView" in im}
    # Drop unused attributes (their accessors stay but are not referenced -> pruned below).
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            for k in ("TEXCOORD_1", "COLOR_1"):
                p["attributes"].pop(k, None)
    used_acc = set()
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            used_acc.update(p["attributes"].values())
            if "indices" in p: used_acc.add(p["indices"])
            for t in p.get("targets", []): used_acc.update(t.values())
    for s in js.get("skins", []):
        if "inverseBindMatrices" in s: used_acc.add(s["inverseBindMatrices"])
    for a in js.get("animations", []):
        for smp in a["samplers"]: used_acc.update([smp["input"], smp["output"]])
    # Remap accessors.
    acc_map, new_acc = {}, []
    for i, a in enumerate(js.get("accessors", [])):
        if i in used_acc:
            acc_map[i] = len(new_acc); new_acc.append(a)
    js["accessors"] = new_acc
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            p["attributes"] = {k: acc_map[v] for k, v in p["attributes"].items()}
            if "indices" in p: p["indices"] = acc_map[p["indices"]]
            for t in p.get("targets", []):
                for k in t: t[k] = acc_map[t[k]]
    for s in js.get("skins", []):
        if "inverseBindMatrices" in s: s["inverseBindMatrices"] = acc_map[s["inverseBindMatrices"]]
    for a in js.get("animations", []):
        for smp in a["samplers"]: smp["input"], smp["output"] = acc_map[smp["input"]], acc_map[smp["output"]]
    used_views = {a["bufferView"] for a in new_acc if "bufferView" in a} | set(img_views)
    # Rebuild binary buffer.
    out, view_map, new_views = bytearray(), {}, []
    for vi, v in enumerate(js["bufferViews"]):
        if vi not in used_views:
            continue
        data = binb[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        if vi in img_views:
            im_meta = js["images"][img_views[vi]]
            img = Image.open(io.BytesIO(data)); img.load()
            if max(img.size) > max_px:
                s = max_px / max(img.size)
                img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
            has_alpha = img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 250
            buf = io.BytesIO()
            if has_alpha:
                img.save(buf, "PNG", optimize=True); im_meta["mimeType"] = "image/png"
            else:
                img.convert("RGB").save(buf, "JPEG", quality=86, optimize=True); im_meta["mimeType"] = "image/jpeg"
            data = buf.getvalue()
        while len(out) % 4: out.append(0)
        nv = {k: val for k, val in v.items() if k not in ("byteOffset", "byteLength")}
        nv.update(buffer=0, byteOffset=len(out), byteLength=len(data))
        view_map[vi] = len(new_views); new_views.append(nv); out += data
    js["bufferViews"] = new_views
    for a in new_acc:
        if "bufferView" in a: a["bufferView"] = view_map[a["bufferView"]]
    for im in js.get("images", []):
        if "bufferView" in im: im["bufferView"] = view_map[im["bufferView"]]
    while len(out) % 4: out.append(0)
    js["buffers"] = [{"byteLength": len(out)}]
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * ((4 - len(jb) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack("<II", len(out), 0x004E4942)); f.write(out)
    print(f"{src} -> {dst}: {len(binb)/1e6:.1f} MB -> {len(out)/1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
