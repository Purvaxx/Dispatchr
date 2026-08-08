const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { QuadTree, Rectangle } = require("./quadtree");

const MAP_SIZE = 1000;          // simulated world is MAP_SIZE x MAP_SIZE units
const DRIVER_COUNT = 40;
const TICK_MS = 200;            // how often drivers move / positions broadcast
const TRIP_DURATION_MS = 4000;  // how long a matched driver stays "busy"
const DRIVER_SPEED = 6;         // units per tick

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const io = new Server(server);

// ---- Driver simulation state -------------------------------------------

function randomCoord() {
  return Math.random() * MAP_SIZE;
}

function randomVelocity() {
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * DRIVER_SPEED, vy: Math.sin(angle) * DRIVER_SPEED };
}

const drivers = Array.from({ length: DRIVER_COUNT }, (_, i) => ({
  id: `D${i + 1}`,
  x: randomCoord(),
  y: randomCoord(),
  ...randomVelocity(),
  status: "available", // "available" | "busy"
}));

function tickDrivers() {
  for (const d of drivers) {
    if (d.status === "busy") continue; // busy drivers pause (mid-trip)

    d.x += d.vx;
    d.y += d.vy;

    // bounce off the edges of the map
    if (d.x < 0 || d.x > MAP_SIZE) d.vx *= -1;
    if (d.y < 0 || d.y > MAP_SIZE) d.vy *= -1;
    d.x = Math.max(0, Math.min(MAP_SIZE, d.x));
    d.y = Math.max(0, Math.min(MAP_SIZE, d.y));
  }
}

// Rebuild the quadtree every tick from only the *available* drivers.
// Rebuilding is O(n log n), which is fine at this scale (tens to low
// thousands of drivers); a production system would instead update the
// tree incrementally, but a full rebuild keeps this project's core
// nearest-neighbor logic easy to read and reason about.
function buildQuadTree() {
  const boundary = new Rectangle(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2);
  const tree = new QuadTree(boundary, 4);
  for (const d of drivers) {
    if (d.status === "available") tree.insert(d);
  }
  return tree;
}

let quadTree = buildQuadTree();

setInterval(() => {
  tickDrivers();
  quadTree = buildQuadTree();
  io.emit("drivers:update", drivers.map(({ id, x, y, status }) => ({ id, x, y, status })));
}, TICK_MS);

// ---- Socket handling -----------------------------------------------------

io.on("connection", (socket) => {
  socket.emit("drivers:update", drivers.map(({ id, x, y, status }) => ({ id, x, y, status })));

  socket.on("ride:request", ({ x, y }) => {
    const result = quadTree.nearest(x, y);

    if (!result) {
      socket.emit("ride:no-drivers");
      return;
    }

    const driver = drivers.find((d) => d.id === result.driver.id);
    driver.status = "busy";
    quadTree = buildQuadTree(); // remove the now-busy driver from future matches

    const etaSeconds = Math.round(result.distance / DRIVER_SPEED * (TICK_MS / 1000));

    io.emit("ride:matched", {
      riderX: x,
      riderY: y,
      driverId: driver.id,
      distance: Math.round(result.distance),
      etaSeconds,
    });

    setTimeout(() => {
      driver.status = "available";
      // give the freed driver a fresh random heading so it doesn't look stuck
      Object.assign(driver, randomVelocity());
    }, TRIP_DURATION_MS);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Nearest-driver server running at http://localhost:${PORT}`);
});
