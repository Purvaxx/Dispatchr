# 🚕 Dispatchr — Real-Time Dispatch Engine

A real-time driver-matching system built from scratch — simulates a live fleet of drivers on a map and instantly matches riders to the **nearest available driver** using a custom-built **quadtree spatial index**, streamed over WebSockets.

**[Live Demo](#)** &nbsp;·&nbsp; **[Run Locally](#running-locally)** &nbsp;·&nbsp; **[Architecture](#architecture)**

---

## Demo

https://github.com/user-attachments/assets/950fd64d-f296-4e3b-811b-5ef2ced647ea

---

## What it does

Click anywhere on the map. The server finds the nearest available driver out of dozens of simulated, continuously moving drivers, marks it busy, and broadcasts the match to every connected client — all in real time, with no page refresh.

## Why this project exists

Most portfolio projects are either CRUD apps or an isolated LeetCode-style data structure. This wraps a real data structure — a **quadtree** — inside an actual live, concurrent, networked system, mirroring the same core problem real dispatch systems solve (Uber, Ola, DoorDash-style nearest-courier matching).

## Features

- **Live simulated fleet** — 40 drivers moving continuously on a 1000×1000 grid, broadcast to all clients every 200ms
- **Instant nearest-match** — quadtree-backed nearest-neighbor search instead of brute-force O(n) scans
- **Real-time updates** — WebSocket-based (Socket.io), no polling
- **Correctness-tested** — quadtree results verified against brute-force search across 500 random points / 50 queries, zero mismatches
- **Zero-build frontend** — plain Canvas + JS, no framework or bundler required

## Architecture

```
┌─────────────┐   WebSocket    ┌───────────────────────────┐
│   Browser    │◄──────────────►│   Node.js + Socket.io      │
│  (Canvas UI) │  driver pos /  │                             │
│              │  ride request  │  ┌───────────────────────┐  │
└─────────────┘                │  │  QuadTree (rebuilt      │  │
                                │  │  every tick from        │  │
                                │  │  available drivers)     │  │
                                │  └───────────────────────┘  │
                                │  40 simulated drivers,        │
                                │  moving every 200ms            │
                                └───────────────────────────┘
```

| File | Responsibility |
|---|---|
| `server/quadtree.js` | Core data structure — `insert()` and an expanding-radius `nearest(x, y)` search |
| `server/index.js` | Driver simulation loop, quadtree rebuild per tick, ride-matching logic |
| `public/app.js` | Canvas rendering, WebSocket client, click-to-request-ride handling |
| `public/index.html` | UI shell and styling |

## Correctness

The quadtree's `nearest()` was validated against a brute-force linear scan across 500 random points and 50 random queries — **0 mismatches**. This matters because a "faster" algorithm is worthless if it's wrong; proving equivalence to the naive version first is what makes trusting it at scale reasonable.

## Running locally

```bash
git clone <your-repo-url>
cd nearest-driver
npm install
npm start
# open http://localhost:3000
```

## Deployment

Plain Node/Express app, no database — deploys cleanly to free tiers of **Render**, **Railway**, or **Fly.io**:

1. Push to a public GitHub repo
2. Connect the repo on Render/Railway, set start command to `npm start`
3. `PORT` env var is already wired in `server/index.js`

## Possible extensions

- Incremental quadtree insert/remove instead of a full rebuild each tick
- Priority queue to return top-3 nearest drivers ranked by ETA
- Min-heap for time-based driver availability instead of `setTimeout`
- Real WebSocket-driven "driver app" client instead of simulated movement

## Tech stack

**Backend:** Node.js, Express, Socket.io
**Frontend:** Vanilla JavaScript, HTML5 Canvas (no framework, no build step)
**Core algorithm:** Custom quadtree spatial index for O(log n) average-case nearest-neighbor lookups

---

<sub>Built as a learning project to explore spatial data structures in a real-time, concurrent system.</sub>
