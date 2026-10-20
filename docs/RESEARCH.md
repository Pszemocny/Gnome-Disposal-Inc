# Research: tech stack

## Technology research: how browser games are built in 2026

| Option | What it is | Fit for this game |
|---|---|---|
| Phaser 4 | Full 2D framework (scenes, physics, audio) | Great for 2D. This game is 3D first-person, so we would lose the core feel. |
| Kaplay | Easy 2D framework | Prototypes and jams; performance limits on big projects. |
| PixiJS | 2D renderer only | Would need our own engine. |
| Babylon.js + Havok | Full 3D engine with first-party physics | Strong, but heavier bundle and its own ecosystem. |
| **Three.js + Rapier** | Most used WebGL 3D renderer + Rust/WASM physics | Light, huge community, Rapier handles ~1000-2000 dynamic bodies from JS, has a kinematic character controller and fast ray casts. |
| Unity/Godot WebGL export | Native engine exported to WASM | Large downloads, slow start, players often report such web builds as laggy. |

**Choice: Three.js + Rapier (`@dimforge/rapier3d-compat`) + Vite + TypeScript.**
Reasons: the game needs 3D physics with hundreds of bodies, first-person controls and instant start in a browser tab. We draw gnomes with InstancedMesh (one draw call per gnome type), generate all models and sounds in code (no asset downloads), so the game starts in about a second.
