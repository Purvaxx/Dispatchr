const MAP_SIZE = 1000;
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const scale = canvas.width / MAP_SIZE;

const socket = io();

let drivers = [];
let riderMarker = null;   // { x, y }
let matchLine = null;     // { riderX, riderY, driverId }
let matchLineTimeout = null;

const totalEl = document.getElementById("total");
const availableEl = document.getElementById("available");
const busyEl = document.getElementById("busy");
const logEl = document.getElementById("log");

function logEvent(text) {
  const row = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  row.textContent = `[${time}] ${text}`;
  logEl.prepend(row);
  while (logEl.children.length > 30) logEl.removeChild(logEl.lastChild);
}

function toCanvas(x, y) {
  return [x * scale, y * scale];
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // grid
  ctx.strokeStyle = "#1c2836";
  ctx.lineWidth = 1;
  for (let i = 0; i <= MAP_SIZE; i += 100) {
    const [gx] = toCanvas(i, 0);
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    const [, gy] = toCanvas(0, i);
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
  }

  // match line
  if (matchLine) {
    const driver = drivers.find((d) => d.id === matchLine.driverId);
    if (driver) {
      const [rx, ry] = toCanvas(matchLine.riderX, matchLine.riderY);
      const [dx, dy] = toCanvas(driver.x, driver.y);
      ctx.strokeStyle = "#38bdf8";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // drivers
  for (const d of drivers) {
    const [cx, cy] = toCanvas(d.x, d.y);
    ctx.beginPath();
    ctx.arc(cx, cy, d.status === "busy" ? 7 : 6, 0, Math.PI * 2);
    ctx.fillStyle = d.status === "busy" ? "#f97316" : "#22c55e";
    ctx.fill();
    if (matchLine && d.id === matchLine.driverId) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#38bdf8";
      ctx.stroke();
    }
  }

  // rider marker
  if (riderMarker) {
    const [rx, ry] = toCanvas(riderMarker.x, riderMarker.y);
    ctx.beginPath();
    ctx.arc(rx, ry, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#eab308";
    ctx.fill();
  }

  requestAnimationFrame(draw);
}
draw();

socket.on("drivers:update", (data) => {
  drivers = data;
  totalEl.textContent = drivers.length;
  availableEl.textContent = drivers.filter((d) => d.status === "available").length;
  busyEl.textContent = drivers.filter((d) => d.status === "busy").length;
});

socket.on("ride:matched", ({ riderX, riderY, driverId, distance, etaSeconds }) => {
  matchLine = { riderX, riderY, driverId };
  logEvent(`Matched ${driverId} — ${distance} units away, ETA ~${etaSeconds}s`);

  clearTimeout(matchLineTimeout);
  matchLineTimeout = setTimeout(() => {
    matchLine = null;
  }, 4000);
});

socket.on("ride:no-drivers", () => {
  logEvent("No available drivers right now — try again shortly.");
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
  const y = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;

  riderMarker = { x, y };
  socket.emit("ride:request", { x, y });
  logEvent(`Ride requested at (${Math.round(x)}, ${Math.round(y)})`);
});
