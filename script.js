import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
import world from "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json/+esm";

// A pool of moderately recognizable but not ultra-obvious countries.
// A target is chosen ONCE when a round starts and does not change when the map rotates.
const TARGET_POOL = [
  { id: "858", name: "Uruguay" },
  { id: "218", name: "Ecuador" },
  { id: "068", name: "Bolivia" },
  { id: "600", name: "Paraguay" },
  { id: "788", name: "Tunisia" },
  { id: "400", name: "Jordan" },
  { id: "418", name: "Laos" },
  { id: "524", name: "Nepal" }
];

const svg = d3.select("#worldMap");
const loadingEl = document.getElementById("loading");
const timerEl = document.getElementById("timer");
const rotationsEl = document.getElementById("rotations");
const mistakesEl = document.getElementById("mistakes");
const messageEl = document.getElementById("message");
const orientationEl = document.getElementById("orientation");
const targetNameEl = document.getElementById("targetName");
const targetInlineEl = document.getElementById("targetInline");
const resetBtn = document.getElementById("resetBtn");
const mapWrap = document.getElementById("mapWrap");

let target = null;
let previousTargetId = null;
let startedAt = null;
let timerFrame = null;
let finished = false;
let mistakes = 0;
let rotations = 0;
let angle = 0;
let rotationTimeout = null;

const countries = topojson.feature(world, world.objects.countries).features;

const projection = d3.geoNaturalEarth1()
  .fitExtent([[18, 18], [982, 522]], {
    type: "FeatureCollection",
    features: countries
  });

const path = d3.geoPath(projection);
const layer = svg.append("g").attr("class", "map-layer");

layer.selectAll("path")
  .data(countries)
  .join("path")
  .attr("class", "country")
  .attr("d", path)
  .attr("data-id", d => String(d.id).padStart(3, "0"))
  .attr("tabindex", "0")
  .attr("aria-label", "Unlabeled country")
  .on("pointerenter", function () {
    startTimerIfNeeded();
    d3.select(this).classed("hovered", true);
  })
  .on("pointerleave", function () {
    d3.select(this).classed("hovered", false);
  })
  .on("focus", startTimerIfNeeded)
  .on("click", function (event, d) {
    chooseCountry(this, d);
  })
  .on("keydown", function (event, d) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseCountry(this, d);
    }
  });

loadingEl.classList.add("hidden");
startNewRound();

function chooseTarget() {
  const options = TARGET_POOL.filter(item => item.id !== previousTargetId);
  target = options[Math.floor(Math.random() * options.length)];
  previousTargetId = target.id;

  targetNameEl.textContent = target.name;
  targetInlineEl.textContent = target.name;
}

function startTimerIfNeeded() {
  if (startedAt !== null || finished) return;
  startedAt = performance.now();
  timerFrame = requestAnimationFrame(updateTimer);
  messageEl.textContent = "No labels. No stable orientation. Good luck.";
}

function updateTimer(now) {
  if (finished || startedAt === null) return;
  timerEl.textContent = `${((now - startedAt) / 1000).toFixed(3)} s`;
  timerFrame = requestAnimationFrame(updateTimer);
}

function stopTimer() {
  if (startedAt === null) return;
  finished = true;
  cancelAnimationFrame(timerFrame);
  timerEl.textContent = `${((performance.now() - startedAt) / 1000).toFixed(3)} s`;
  clearTimeout(rotationTimeout);
}

function chooseCountry(node, country) {
  if (finished) return;
  startTimerIfNeeded();

  layer.selectAll(".country")
    .classed("selected-wrong", false)
    .classed("selected-correct", false);

  const selectedId = String(country.id).padStart(3, "0");

  if (selectedId === target.id) {
    d3.select(node).classed("selected-correct", true);
    stopTimer();
    messageEl.className = "message success";
    messageEl.textContent =
      `${target.name} selected in ${timerEl.textContent} after ${rotations} rotations and ${mistakes} wrong countries.`;
    return;
  }

  mistakes += 1;
  mistakesEl.textContent = mistakes;
  d3.select(node).classed("selected-wrong", true);
  messageEl.className = "message error";
  messageEl.textContent = `That was definitely a country. It was not ${target.name}.`;
}

function rotateMap() {
  if (finished) return;

  const turns = [1, -1, 2];
  angle += turns[Math.floor(Math.random() * turns.length)] * 90;
  rotations += 1;

  layer.style("transform", `rotate(${angle}deg)`);
  rotationsEl.textContent = rotations;

  const normalized = ((angle % 360) + 360) % 360;
  const labels = {
    0: "Orientation: north is probably up",
    90: "Orientation: north has moved right",
    180: "Orientation: north is now down",
    270: "Orientation: north has moved left"
  };
  orientationEl.textContent = labels[normalized] || "Orientation: unclear";

  scheduleRotation();
}

function scheduleRotation() {
  clearTimeout(rotationTimeout);
  const delay = 1000 + Math.random() * 1000;
  rotationTimeout = setTimeout(rotateMap, delay);
}

function startNewRound() {
  finished = false;
  startedAt = null;
  cancelAnimationFrame(timerFrame);
  clearTimeout(rotationTimeout);

  mistakes = 0;
  rotations = 0;
  angle = 0;

  chooseTarget();

  timerEl.textContent = "0.000 s";
  mistakesEl.textContent = "0";
  rotationsEl.textContent = "0";
  orientationEl.textContent = "Orientation: probably north-ish";
  messageEl.className = "message";
  messageEl.textContent = "The timer starts when you move over the map.";

  layer.style("transform", "rotate(0deg)");
  layer.selectAll(".country")
    .classed("selected-wrong", false)
    .classed("selected-correct", false);

  scheduleRotation();
}

mapWrap.addEventListener("pointerenter", startTimerIfNeeded);
resetBtn.addEventListener("click", startNewRound);
