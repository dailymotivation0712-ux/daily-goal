// The real-time 3D shuttlecock on the home page (three.js, loaded as an ES module).
//
// The model is built here in code, feather by feather, so there is no model file
// to download. It lives on one canvas that stays pinned to the screen for the
// whole "stage" (hero + scroll story). Scrolling moves it between the poses in
// KEYS; the mouse tilts it; dragging it in the hero spins it.
//
// If WebGL isn't available the canvas stays empty and the page works without it.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------- The model (1 unit = 10 cm; the shuttle's axis is +Y, cork at the bottom) ----------

const FEATHERS = 16;
const CORK_RADIUS = 0.13;
const QUILL_RING = 0.098;   // radius of the circle the quills are planted on
const TOP_RADIUS = 0.33;    // radius of the feather tips
const SKIRT_HEIGHT = 0.63;  // cork top to feather tips, measured along the axis

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

// A feather vane: warm white, with fine barbs running up and out from the quill.
function featherColour() {
  const texture = canvasTexture(256, 1024, (g, w, h) => {
    const shade = g.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(0.55, "#f8f4ec");
    shade.addColorStop(1, "#d8d0c0");
    g.fillStyle = shade;
    g.fillRect(0, 0, w, h);
    // Slightly darker towards the quill, where the vane is thicker.
    const core = g.createLinearGradient(0, 0, w, 0);
    core.addColorStop(0, "rgba(120,105,85,0)");
    core.addColorStop(0.5, "rgba(120,105,85,0.16)");
    core.addColorStop(1, "rgba(120,105,85,0)");
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);
    g.lineWidth = 1;
    for (let y = h + 140; y > -20; y -= 4) {
      g.strokeStyle = `rgba(110,98,82,${0.07 + Math.random() * 0.13})`;
      g.beginPath();
      g.moveTo(0, y - 130);
      g.lineTo(w / 2, y);
      g.lineTo(w, y - 130);
      g.stroke();
    }
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Height map of the same barbs, so they catch the light.
function featherBump() {
  return canvasTexture(256, 1024, (g, w, h) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, w, h);
    g.lineWidth = 1.5;
    for (let y = h + 140; y > -20; y -= 4) {
      g.strokeStyle = Math.random() > 0.5 ? "#9a9a9a" : "#666666";
      g.beginPath();
      g.moveTo(0, y - 130);
      g.lineTo(w / 2, y);
      g.lineTo(w, y - 130);
      g.stroke();
    }
  });
}

// The edge of a real feather isn't a clean line: the barbs part here and there.
// White = feather, black = gap. Most gaps are shallow nicks; a few run deep.
function featherEdge() {
  return canvasTexture(256, 1024, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    const nick = (side, y, depth, gap) => {
      const edge = side ? w : 0;
      const inner = side ? w - depth : depth;
      const rise = depth * (130 / (w / 2)); // gaps follow the barbs, up and out
      g.beginPath();
      g.moveTo(edge, y - rise);
      g.lineTo(edge, y - rise - gap);
      g.lineTo(inner, y);
      g.fill();
    };
    for (let side = 0; side < 2; side++) {
      for (let y = 140; y < h; y += 14 + Math.random() * 26) nick(side, y, 8 + Math.random() * 20, 3 + Math.random() * 5);
      for (let i = 0; i < 3; i++) nick(side, 250 + Math.random() * 650, 45 + Math.random() * 45, 6 + Math.random() * 7);
    }
  });
}

// The tape around the cork: tomato, with a fine cream line near each edge.
function bandColour() {
  const texture = canvasTexture(8, 64, (g, w, h) => {
    g.fillStyle = "#ee4a27";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff3df";
    g.fillRect(0, 8, w, 3);
    g.fillRect(0, h - 11, w, 3);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Fine grain for the leather on the cork.
function leatherBump() {
  const texture = canvasTexture(256, 256, (g, w, h) => {
    const image = g.createImageData(w, h);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = 110 + Math.random() * 60;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 3);
  return texture;
}

// The flat part of a feather: narrow where it leaves the quill, widest two
// thirds up, rounded off at the tip, and gently cupped like the real thing.
function vaneGeometry(length, halfWidth) {
  const cols = 10;
  const rows = 28;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const width = v < 0.7
      ? halfWidth * Math.pow(Math.sin((v / 0.7) * Math.PI / 2), 0.75)
      : halfWidth * Math.sqrt(Math.max(0, 1 - ((v - 0.7) / 0.3) ** 2));
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2 - 1;
      positions.push(u * Math.max(width, 0.0015), v * length, -0.024 * u * u * (width / halfWidth) + 0.02 * v * v * v);
      uvs.push(c / cols, v);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildShuttle() {
  const shuttle = new THREE.Group();

  const edge = featherEdge();
  // Feathers are soft: "sheen" gives them the faint glow real down has at glancing angles.
  const featherMaterial = new THREE.MeshPhysicalMaterial({
    map: featherColour(),
    alphaMap: edge,
    alphaTest: 0.5,
    bumpMap: featherBump(),
    bumpScale: 1.4,
    roughness: 0.74,
    sheen: 0.6,
    sheenRoughness: 0.55,
    sheenColor: 0xffffff,
    side: THREE.DoubleSide,
  });
  // So the gaps in the feather edges show up in the shadows too.
  const featherShadow = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, alphaMap: edge, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // Quills are hard and glossy, like fingernails.
  const quillMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const threadMaterial = new THREE.MeshStandardMaterial({ color: 0xfaf5ea, roughness: 0.85 });
  const leatherMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf7f3ea, roughness: 0.56, clearcoat: 0.18, clearcoatRoughness: 0.6, bumpMap: leatherBump(), bumpScale: 0.6,
  });
  const bandMaterial = new THREE.MeshPhysicalMaterial({ map: bandColour(), roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  // No two feathers on a real shuttle are identical. The same "random" numbers
  // every visit, so it always looks the same.
  let seed = 7;
  const vary = (amount) => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 2 * amount;
  };

  // Feathers: each one leans outwards, and is twisted a little so that it
  // overlaps its neighbour like the blades of a turbine.
  const lean = Math.atan((TOP_RADIUS - QUILL_RING) / SKIRT_HEIGHT);
  const quillLength = SKIRT_HEIGHT / Math.cos(lean);
  const quill = new THREE.CylinderGeometry(0.0026, 0.0058, quillLength, 8).translate(0, quillLength / 2, 0);
  const vane = vaneGeometry(quillLength * 0.6, 0.074).translate(0, quillLength * 0.4, 0);
  for (let i = 0; i < FEATHERS; i++) {
    const slot = new THREE.Group();
    slot.rotation.y = -(i / FEATHERS) * Math.PI * 2;
    const feather = new THREE.Group();
    feather.position.set(QUILL_RING, 0, 0);
    feather.rotation.z = -lean + vary(0.012);
    const blade = new THREE.Mesh(vane, featherMaterial);
    blade.customDepthMaterial = featherShadow;
    blade.rotation.y = Math.PI / 2 + 0.42 + vary(0.06);
    blade.scale.set(1 + vary(0.04), 1 + vary(0.015), 1);
    feather.add(new THREE.Mesh(quill, quillMaterial), blade);
    slot.add(feather);
    shuttle.add(slot);
  }

  // Two rings of thread tie the quills together below the vanes.
  // Each is a doubled thread, with a small knot where it wraps a quill.
  const knot = new THREE.SphereGeometry(0.0072, 10, 8).scale(1, 1.25, 1);
  for (const height of [0.13, 0.215]) {
    const radius = QUILL_RING + height * Math.tan(lean);
    for (const offset of [-0.0032, 0.0032]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.004, 0.0026, 8, 96), threadMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = height + offset;
      shuttle.add(ring);
    }
    for (let i = 0; i < FEATHERS; i++) {
      const angle = (i / FEATHERS) * Math.PI * 2;
      const wrap = new THREE.Mesh(knot, threadMaterial);
      wrap.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      shuttle.add(wrap);
    }
  }

  // Cork: a leather-covered dome with a flat top, and a band of tape around it.
  const profile = [];
  for (let i = 0; i <= 18; i++) {
    const angle = -Math.PI / 2 + (i / 18) * (Math.PI / 2);
    profile.push(new THREE.Vector2(CORK_RADIUS * Math.cos(angle), -0.075 + CORK_RADIUS * Math.sin(angle) * 0.95));
  }
  profile.push(new THREE.Vector2(CORK_RADIUS, 0), new THREE.Vector2(CORK_RADIUS - 0.01, 0.01), new THREE.Vector2(0, 0.01));
  shuttle.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), leatherMaterial));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(CORK_RADIUS + 0.0018, CORK_RADIUS + 0.0018, 0.05, 64, 1, true), bandMaterial);
  band.position.y = -0.032;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(CORK_RADIUS - 0.004, 0.006, 10, 64), leatherMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.004;
  shuttle.add(band, rim);

  shuttle.traverse((part) => {
    if (part.isMesh) part.castShadow = part.receiveShadow = true;
  });
  shuttle.position.y = -0.24; // so it turns about its middle, not about the cork
  return shuttle;
}

// ---------- Poses along the scroll ----------
// at:   how far through the stage you've scrolled (0 = hero, 1 = last story step)
// x, y: where the shuttle sits, as a fraction of the screen measured from its centre
// size: its height as a fraction of the screen's height
// rx, ry, rz: which way it points; spin: how fast it turns about its own axis

const KEYS_WIDE = [
  { at: 0.00, x: 0.25, y: 0.0, size: 0.58, rx: -0.3, ry: 0.0, rz: -0.62, spin: 0.35 },
  { at: 0.32, x: -0.24, y: 0.0, size: 0.66, rx: 0.95, ry: 0.0, rz: 0.35, spin: 0.9 },
  { at: 0.64, x: 0.25, y: 0.02, size: 0.7, rx: -1.15, ry: 0.0, rz: -0.25, spin: 2.6 },
  { at: 0.94, x: -0.24, y: 0.0, size: 0.62, rx: -0.15, ry: 0.0, rz: 1.25, spin: -0.7 },
];

const KEYS_NARROW = [
  { at: 0.00, x: 0.3, y: 0.3, size: 0.2, rx: -0.3, ry: 0.0, rz: -0.62, spin: 0.35 },
  { at: 0.32, x: 0.0, y: 0.2, size: 0.36, rx: 0.95, ry: 0.0, rz: 0.35, spin: 0.9 },
  { at: 0.64, x: 0.0, y: 0.2, size: 0.38, rx: -1.15, ry: 0.0, rz: -0.25, spin: 2.6 },
  { at: 0.94, x: 0.0, y: 0.2, size: 0.34, rx: -0.15, ry: 0.0, rz: 1.25, spin: -0.7 },
];

const CHANNELS = ["x", "y", "size", "rx", "ry", "rz", "spin"];
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10); // settles gently into each pose

function poseAt(keys, progress) {
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const from = keys[i];
  const to = keys[i + 1];
  const t = ease(Math.min(1, Math.max(0, (p - from.at) / (to.at - from.at))));
  const pose = {};
  for (const key of CHANNELS) pose[key] = from[key] + (to[key] - from[key]) * t;
  return pose;
}

// ---------- The stage ----------

function initStage(stage, canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return; // no WebGL: the page simply has no 3D shuttle
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.62;

  // The shuttle stays at the centre of the 3D world, where the lights and
  // shadows are set up for it. Moving it around the screen is done with the
  // camera (zoom + view offset), so it never looks stretched near the edges.
  const DISTANCE = 7;
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
  camera.position.set(0, 0, DISTANCE);
  const unitHeight = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(10)); // world units top to bottom
  const SHUTTLE_HEIGHT = 0.86;

  const key = new THREE.DirectionalLight(0xfff4e0, 3.1);
  key.position.set(1.6, 2.4, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -0.7;
  key.shadow.camera.right = key.shadow.camera.top = 0.7;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 6;
  key.shadow.bias = -0.0015;
  key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0x9fe8ff, 1.5);
  rim.position.set(-2.2, 0.6, -1.8);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xd9c7a0, 0.35));

  const attitude = new THREE.Group(); // which way the shuttle points
  const spinner = new THREE.Group();  // turns it about its own axis
  spinner.add(buildShuttle());
  attitude.add(spinner);
  scene.add(attitude);

  const narrow = matchMedia("(max-width: 900px)");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { scroll } = window.Motion || {};

  let progress = 0;
  if (scroll) {
    // Motion reports how far the stage has scrolled past the top of the screen.
    scroll((value) => (progress = value), { target: stage, offset: ["start start", "end end"] });
  }

  // It starts below the screen, turned away, and swoops up into its first pose.
  const pose = poseAt(narrow.matches ? KEYS_NARROW : KEYS_WIDE, 0);
  if (!still) Object.assign(pose, { y: pose.y - 0.75, rz: pose.rz + 2.2, size: pose.size * 0.7 });
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }; // -1..1 across the screen; s = smoothed
  let dragSpin = 0;
  let width = 0;
  let height = 0;

  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = (event.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Drag sideways on the hero's shuttle to spin it; it coasts when you let go.
  const grip = document.querySelector(".hero-grip");
  if (grip) {
    let last = null;
    grip.addEventListener("pointerdown", (event) => {
      last = event.clientX;
      grip.setPointerCapture(event.pointerId);
      grip.classList.add("is-dragging");
    });
    grip.addEventListener("pointermove", (event) => {
      if (last === null) return;
      dragSpin += (event.clientX - last) * 0.05;
      last = event.clientX;
    });
    const release = () => {
      last = null;
      grip.classList.remove("is-dragging");
    };
    grip.addEventListener("pointerup", release);
    grip.addEventListener("pointercancel", release);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }

  let previous = performance.now();
  function frame(now) {
    const elapsed = Math.min(1, (now - previous) / 1000);
    const dt = Math.min(0.05, elapsed); // for spinning: never jump after a pause
    previous = now;
    resize();

    // Ease towards the pose for this scroll position. Using the real time that
    // passed keeps it just as quick on a slow phone as on a fast laptop.
    const target = poseAt(narrow.matches ? KEYS_NARROW : KEYS_WIDE, progress);
    const follow = still ? 1 : 1 - Math.exp(-elapsed * 5);
    for (const channel of CHANNELS) pose[channel] += (target[channel] - pose[channel]) * follow;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-elapsed * 4));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-elapsed * 4));

    const bob = still ? 0 : Math.sin(now / 1400) * 0.012;
    attitude.rotation.set(pose.rx + pointer.sy * 0.16, pose.ry + pointer.sx * 0.3, pose.rz + pointer.sx * -0.05);
    if (!still) spinner.rotation.y += (pose.spin + dragSpin) * dt;
    dragSpin *= Math.exp(-dt * 1.6);

    camera.zoom = (unitHeight / SHUTTLE_HEIGHT) * pose.size;
    camera.setViewOffset(width, height, -pose.x * width, (pose.y + bob) * height, width, height);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  // Only draw while the stage is on screen and the tab is visible.
  let running = false;
  let onScreen = false;
  function loop(now) {
    if (!running) return;
    frame(now);
    requestAnimationFrame(loop);
  }
  function update() {
    const should = onScreen && !document.hidden;
    if (should && !running) {
      running = true;
      previous = performance.now();
      requestAnimationFrame(loop);
    } else if (!should) {
      running = false;
    }
  }
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  }).observe(stage);
  document.addEventListener("visibilitychange", update);

  resize();
  frame(performance.now());
  canvas.style.opacity = 1; // style.css keeps it hidden until the first frame is drawn
}

const stage = document.querySelector(".stage");
const canvas = document.querySelector(".stage-canvas");
if (stage && canvas) initStage(stage, canvas);
