# Gnome Disposal Inc.

A browser game: a first-person physics sandbox where you feed garden gnomes to a hungry hole for money, then automate it with machines. Built with Three.js + Rapier, no downloaded assets.

## Run

```bash
npm install
npm run dev        # open the printed URL (http://localhost:5173)
npm run build      # static build in dist/, host anywhere
npm run typecheck
```

Desktop browser with mouse and keyboard. Click "Start hustling" to lock the mouse.

## Controls

WASD move · Shift sprint · Space jump · LMB (hold) grab · RMB (hold) throw · F kick · E use (PC desk, repair) · 1-0 place tools (R rotate, T tilt, wheel height, RMB/Q cancel) · X pick up a placed tool · B shop (Laptop upgrade) · Esc menu

## Docs

- `docs/RESEARCH.md`: why this tech stack.
- `docs/PLAN.md`: game design (hole levels, gnome types, shop, events, secrets) and code layout.
