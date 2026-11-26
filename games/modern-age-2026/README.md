# Modern Age: 2026
V0.3 development baseline. Open index.html in a desktop browser. This is an isolated project; no BABA catalog integration or publication is performed by this branch.

## Design
Six nations with shared rules and original country models; fixed isometric camera; detailed miniature 2.5D/3D models; natural colors; procedural maps; landmarks grant cultural prestige and bonuses. Türkiye's landmark is Trabzon Atatürk Köşkü.

## Current limits
Custom WebGL2 renderer with Canvas fallback; not Three.js/Rapier yet. The prior test environment could not initialize WebGL2. Canvas test averaged about 60 FPS with 18 units; 3D FPS and photorealism remain unverified. Landmark geometry is an approximate architectural prototype, not surveyed.

## Development priorities
1. Separate rendering and simulation modules; pin Three.js, Rapier and build dependencies.
2. Preserve all existing gameplay and saves; integrate GLB, PBR materials, skeletal animation, and optimized collision.
3. Establish GPU-capable reference rendering and physical validation before claiming realism.
4. Benchmark active 100/500/1500-unit scenarios, record hardware, resolution, p50/p95/p99 frame times and renderer. Target 60 FPS at documented settings, never claim universal guaranteed FPS.
5. Compare Trabzon Atatürk Köşkü against licensed architectural references; document estimated dimensions.

Run the browser smoke test in GitHub Actions (or locally with Playwright). A fallback result is not a pass for 3D validation.
