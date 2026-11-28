# 🏎 Velocity Rush — 3D Racing Game Engine

**A high-octane, browser-based 3D car racing game built with Three.js (WebGL), Vanilla JavaScript (ES6+), and Web Audio API.**

Experience real-time dynamic physics, procedural Web Audio engine sounds, AI opponents with spline pathfinding, dynamic weather systems, and a full vehicle upgrade garage — all in the browser with zero external engine frameworks.

🔗 **Live Demo:** https://prashant371.github.io/velocity-rush/  
💻 **GitHub:** https://github.com/prashant371/velocity-rush

---

## 🌟 Overview

**Velocity Rush** is a full-featured 3D browser racing game designed to showcase advanced WebGL rendering, custom vehicle physics, custom audio synthesis, and intelligent AI steering without relying on monolithic game engines like Unity or Unreal.

Built purely using **Three.js** for 3D rendering and vanilla JavaScript ES6 modular architecture, it delivers smooth 60 FPS gameplay, responsive drift mechanics, multiple race environments, power-up systems, and vehicle progression.

---

## 🚀 Key Features

- **🏎 20 Unique Unlockable Cars**: 7 performance classes ranging from Hatchbacks and Sedans to Muscle Cars, Supercars, Hypercars, and Electric vehicles.
- **🏁 9 Detailed Environments & Tracks**: Metro Circuit (City), Desert Run, Forest Rally, Alpine Pass (Snow), Coastal Highway, Neon Night City, Volcanic Drift, Industrial Zone, and Countryside.
- **🧠 Intelligent AI Opponents**: Multi-vehicle AI featuring Catmull-Rom spline pathfinding, overtaking, obstacle avoidance, drifting, blocking, and dynamic nitro usage based on race position.
- **⚙️ Custom Physics Engine**: Realistic acceleration curves, braking, weight transfer simulation, dynamic drift friction, barrier collision resolution, and airborne gravity dynamics.
- **🌧 5 Dynamic Weather & Lighting Modes**: Sunny, Rain (wet road reflections & splash particles), Fog (atmospheric density), Night (headlight spotlights & neon underglow), and Snow.
- **⚡️ 8 Collectible Power-ups**: Nitro Boost, Coin Magnet, Repair Kit, Energy Shield, Double Coins, Slow Motion, Turbo Engine, and Instant Repair.
- **🛠 Garage & Vehicle Customization**: Upgrade 6 performance components (Engine, Turbo, Tires, Brakes, Transmission, Weight Reduction) and customize paint colors & neon underglow lighting.
- **🔊 Procedural Web Audio API Synth**: Real-time multi-oscillator engine synthesis pitched to vehicle RPM, procedural tire screeches, wind noise, collision impacts, and dynamic sound effects (zero audio assets required).
- **🎨 Visual & Camera FX**: Motion vignette, damage camera shake, FOV camera zoom during nitro boost, particle tire smoke, skid marks, spark effects, and weather particle systems.
- **🎮 Multiple Input Methods**: Keyboard (`W/A/S/D` or Arrow keys), Touch/Mobile virtual joystick & pedals, and Gamepad API support.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Rendering Engine** | Three.js (r128 WebGL Renderer, Scene Graphs, Mesh Geometry, Custom Shaders) |
| **Physics & Math** | Custom Vanilla JS Physics Vector Mathematics (Raycasting, AABB, Splines) |
| **Audio Engine** | Web Audio API (OscillatorNodes, BiquadFilterNodes, GainNodes, Procedural Audio) |
| **Language & Logic** | Vanilla JavaScript ES6+ (Modular File Architecture) |
| **UI & Styling** | HTML5 Semantic Layout + CSS3 Flexbox/Grid (Orbitron & Rajdhani Typography) |
| **Storage** | LocalStorage API (Career progress, unlocked cars, coin balance, high scores) |
| **Deployment** | GitHub Pages (Static WebGL Application) |

---

## 🧠 Technical Implementation & Architecture

```
[ HTML5 Canvas / WebGL Layer ]
           ▲
           │ Render Loop (requestAnimationFrame)
           │
┌──────────┴──────────┐      ┌─────────────────────┐
│    Game Loop       ├─────►│ Physics Engine      │
│   (game.js)         │      │ (physics.js)        │
└──────────┬──────────┘      └──────────┬──────────┘
           │                            │
           ├────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ Three.js Scene      │      │ AI Spline System    │      │ Web Audio Synth     │
│ (car.js / track.js) │      │ (ai.js)             │      │ (audio.js)          │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

### 1. Procedural Vehicle & World Generation (Three.js)
Cars and tracks are constructed dynamically using Three.js geometric primitives (`BoxGeometry`, `CylinderGeometry`, `ExtrudeGeometry`) with physical PBR materials (`MeshStandardMaterial`, `MeshPhysicalMaterial`). This removes the overhead of loading heavy external 3D asset bundles while ensuring high performance across devices.

### 2. Custom Raycast & Rigid Body Physics (`physics.js`)
Vehicle movement relies on custom vector forces calculated each frame:
- **Tire Grip Vectoring**: Lateral vs. longitudinal velocity vectors dictate tire slip angles for realistic drifting.
- **Weight Transfer**: Front/rear suspension pitch during braking/acceleration affects turn-in responsiveness.
- **Collision Resolution**: Ray-sphere and AABB bounding box collision checks against track barriers with spring-damped bounce response.

### 3. Spline-Following AI Pathfinding (`ai.js`)
AI opponents trace a 3D Catmull-Rom curve defining the race line. The AI calculates steering vectors based on target look-ahead points on the spline, dynamically adjusting speed for upcoming curve angles and applying steering offsets to overtake or avoid other vehicles.

### 4. Synthesized Audio System (`audio.js`)
Engine sound is synthesized in real-time using Web Audio API `OscillatorNode` instances routed through `BiquadFilterNode` low-pass filters. As the vehicle accelerates, the oscillator frequencies scale dynamically with RPM:
\[ f_{\text{engine}} = f_{\text{base}} + (\text{speed} \times \text{rpmFactor}) \]
Tire squeals generate filtered white noise burst buffers whenever tire slip angle exceeds drift thresholds.

---

## 📁 Project Structure

```
velocity-rush/
├── index.html            # Main HTML document, UI overlays, screens & HUD
├── css/
│   └── style.css         # Styling, glassmorphism UI, buttons & responsiveness
├── js/
│   ├── main.js           # App entry point, DOM initializers, view routing
│   ├── config.js         # Game constants, car catalog, track definitions
│   ├── game.js           # Main render loop & state machine controller
│   ├── physics.js        # Vehicle physics, collision detection & resolution
│   ├── track.js          # Track mesh procedural generator & environment lighting
│   ├── car.js            # 3D Vehicle model builder & handling mechanics
│   ├── ai.js             # Opponent AI pathfinding & behavior logic
│   ├── garage.js         # Upgrade system, car selection & customization
│   ├── ui.js             # HUD update loop, speedometer, minimap & popups
│   ├── audio.js          # Procedural Web Audio engine & sound effects synth
│   ├── weather.js        # Weather particle engine (Rain, Snow, Fog, Night)
│   ├── particles.js      # FX particles (Smoke, Sparks, Nitro glow, Skid marks)
│   ├── input.js          # Keyboard, touch & gamepad controller listener
│   ├── menu.js           # Menu background scene & navigation screens
│   └── save.js           # LocalStorage save/load state wrapper
└── README.md
```

---

## 🎮 Game Controls

| Control | Keyboard | Touch / Gamepad |
|---|---|---|
| **Accelerate** | `W` or `Up Arrow` | Virtual Pedal / Right Trigger (`RT`) |
| **Brake / Reverse** | `S` or `Down Arrow` | Virtual Brake / Left Trigger (`LT`) |
| **Steer Left / Right** | `A` / `D` or `Left` / `Right` | Virtual Joystick / Steering Stick |
| **Nitro Boost** | `Shift` or `Space` | Nitro Button / Action Button |
| **Drift** | `Space` + Steer | Drift Button / Handbrake |
| **Change Camera** | `C` | Cam Button |
| **Pause Game** | `Esc` or `P` | Pause Button |

---

## 💻 Running Locally

Since Velocity Rush is a client-side WebGL application, no build steps or Node.js compilers are required!

### Option 1: Live Server (Recommended)
1. Clone the repository:
   ```bash
   git clone https://github.com/prashant371/velocity-rush.git
   cd velocity-rush
   ```
2. Serve using any static HTTP server:
   - VS Code extension: **Live Server**
   - Python: `python -m http.server 8000`
   - Node npx: `npx serve .`
3. Open `http://localhost:8000` in your web browser.

---

## 🚀 Future Enhancements

- [ ] Multiplayer WebSockets implementation for real-time Head-to-Head racing.
- [ ] Support for custom 3D `.gltf` / `.glb` vehicle models import.
- [ ] Track Editor tool allowing players to design and share custom race tracks.
- [ ] Global Leaderboard integration with server-side high score verification.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
