# Modern Age: 2026 — V0.4

## Run
Serve this directory over HTTP (ES modules cannot reliably be loaded from file://):
```sh
python -m http.server 8080
```
Open http://localhost:8080. Three.js r170 is vendored under vendor/ with its MIT license; no CDN is needed. Canvas is a fallback only. The original V0.3 gameplay and save schema are preserved.

## Design
Six nations with shared rules and country-specific presentation; fixed isometric camera; detailed miniature 2.5D/3D models; natural colors; procedural maps; landmarks grant cultural prestige and bonuses. Türkiye's landmark is Trabzon Atatürk Köşkü.

## V0.4 renderer
- Three.js WebGLRenderer, orthographic camera matching selection coordinates, MeshStandardMaterial, ACES tone mapping, directional/hemisphere illumination, procedural PMREM environment and PBR surface normal maps.
- Instanced static/dynamic geometry, viewport culling, zoom-aware character LOD, throttled shadow updates and adaptive internal resolution.
- Existing vertex-colored landmark geometry imported into BufferGeometry; still an approximate architectural prototype.
- The current physics system is unchanged. Rapier, calibrated architectural measurements, licensed photographic textures and skeletal models remain future tasks.

## Verification
```sh
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
node smoke.mjs
```
The default test uses a software GPU, verifies actual Three.js initialization and rendering, constructs HQ and landmark, and samples normal / 100 / 500 / 1500-unit scenarios. Outputs modern-age-report.json and modern-age-preview.png.
On a hardware-accelerated desktop with Node and Chromium:
```sh
GPU_HARDWARE=1 HEADED=1 REQUIRE_60FPS=1 node smoke.mjs
```
On Windows PowerShell, use $env:GPU_HARDWARE='1'; $env:HEADED='1'; $env:REQUIRE_60FPS='1'; node smoke.mjs.
This test target is mean >=59 FPS and P95 <=17.5 ms in every scenario, not a universal fixed-FPS guarantee. Record actual GPU, resolution, scale and frame time results. Software rasterization is not accepted as evidence of hardware performance. Current CPU projection math was verified against actual Three.js r170; GPU render and performance results are pending verification. Photorealism is an art target, not a verified claim.

Do not merge or publish until functional and visual quality gates are reviewed.
