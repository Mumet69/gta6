// city.js — procedural Neon Harbor: a seeded grid city on the coast.
// Roads form a grid; blocks hold windowed buildings; the east edge is a beach
// and ocean; landmarks (bank, police HQ, hospital, safehouse, marina, port)
// are fixed so missions always know where to go. Traffic drives on the road
// graph this module builds.
import * as THREE from 'three';
import { G } from './state.js';
import { makeRng, clamp } from './utils.js';

export const BLOCK = 44; // block size in metres (road centre to road centre)
export const ROAD_W = 12;
export const HALF = 5; // grid runs -5..5 blocks, so the city is ~480m across
export const BEACH_X = 250; // sand starts here; ocean beyond

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 128);
  const cols = 4, rows = 8;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      x.fillStyle = rng.rand() < lit ? '#ffd98a' : '#1c2733';
      x.fillRect(4 + i * 15, 6 + j * 15, 10, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const city = { buildings: [], roads: [], landmarks: {}, bounds: { min: -260, max: 260 } };

  // Ground: big grass/concrete slab, then asphalt road strips on top.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x5d7a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  scene.add(ground);

  // Beach sand + ocean to the east.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 900),
    new THREE.MeshLambertMaterial({ color: 0xe0c98f }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X + 40, 0, 0);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 900),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(BEACH_X + 280, -0.2, 0);
  scene.add(ocean);

  // Roads: asphalt strips along every grid line. (Centre dashes are painted
  // into the road texture instead of individual meshes, to keep draw calls low.)
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  for (let i = -HALF; i <= HALF; i++) {
    const c = i * BLOCK;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, HALF * 2 * BLOCK + ROAD_W), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 * BLOCK + ROAD_W, ROAD_W), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.005, c);
    scene.add(h);
    city.roads.push({ axis: 'v', at: c }, { axis: 'h', at: c });
  }

  // Buildings: one or two per block, windowed, with a seeded palette.
  const palette = ['#8a7f72', '#6e7f8a', '#9a8a6a', '#7a6a7a', '#5f6e5a', '#8a6a5a', '#4a5a6a', '#a08a7a'];
  const texCache = {};
  function texFor(color) {
    if (!texCache[color]) texCache[color] = windowTexture(rng, color, 0.35);
    return texCache[color];
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  for (let gx = -HALF; gx < HALF; gx++) {
    for (let gz = -HALF; gz < HALF; gz++) {
      // Leave the landmark blocks and the central plaza empty.
      const key = `${gx},${gz}`;
      if (LANDMARK_BLOCKS[key]) continue;
      if (gx === 0 && gz === 0) continue; // central plaza
      const cx = gx * BLOCK + BLOCK / 2;
      const cz = gz * BLOCK + BLOCK / 2;
      const n = rng.rand() < 0.55 ? 1 : 2;
      for (let b = 0; b < n; b++) {
        const w = rng.range(14, 22), d = rng.range(14, 22), h = rng.range(10, 46);
        const ox = n === 1 ? 0 : (b === 0 ? -9 : 9);
        const oz = n === 1 ? 0 : (b === 0 ? 9 : -9);
        const color = rng.pick(palette);
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ map: texFor(color) }),
        );
        m.position.set(cx + ox, h / 2, cz + oz);
        scene.add(m);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), roofMat);
        roof.position.set(cx + ox, h + 0.5, cz + oz);
        scene.add(roof);
        city.buildings.push(m);
      }
    }
  }

  // Central plaza: fountain + palms.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 12, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x9a8a6a }),
  );
  plaza.position.set(BLOCK / 2, 0.6, BLOCK / 2);
  scene.add(plaza);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8 }),
  );
  water.position.set(BLOCK / 2, 1.3, BLOCK / 2);
  scene.add(water);

  // Landmarks: bank, police HQ, hospital, safehouse, marina, port.
  city.landmarks.bank = addLandmark(scene, rng, 'Harbor Bank', 0, -2, 0x8a7a5a, 30, 34, 22);
  city.landmarks.police = addLandmark(scene, rng, 'Police HQ', -2, 0, 0x3a5a7a, 26, 22, 20);
  city.landmarks.hospital = addLandmark(scene, rng, 'Harbor Hospital', 2, 2, 0xe8e8e8, 28, 26, 20);
  city.landmarks.safehouse = addLandmark(scene, rng, 'Safehouse', -3, -3, 0x7a5a3a, 18, 10, 16);
  city.landmarks.marina = addLandmark(scene, rng, 'Marina', 5, 3, 0x5a7a8a, 20, 8, 30);
  city.landmarks.port = addLandmark(scene, rng, 'Port', 4, -4, 0x6a6a5a, 34, 14, 24);

  // Port cranes (simple frames) near the beach.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xc8a03a });
  for (const [cx, cz] of [[BEACH_X - 30, -160], [BEACH_X - 30, -120], [BEACH_X - 30, 120]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat);
    leg.position.set(cx, 17, cz); scene.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), craneMat);
    arm.position.set(cx + 10, 32, cz); scene.add(arm);
  }

  // Palms along the beach and streetlights on the roads.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
  for (let z = -220; z <= 220; z += 28) {
    const tx = BEACH_X - 12 + rng.range(-4, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 6), trunkMat);
    trunk.position.set(tx, 3.5, z); scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3, 7), leafMat);
    leaves.position.set(tx, 8, z); scene.add(leaves);
  }
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = -HALF; i <= HALF; i += 2) {
    for (let j = -HALF; j <= HALF; j += 3) {
      const px = i * BLOCK + ROAD_W / 2 + 1, pz = j * BLOCK;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(px, 3.5, pz); scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(px, 7, pz); scene.add(lamp);
    }
  }

  // Sun + sky + fog.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd4e6, 0.75));
  scene.background = new THREE.Color(0x87b5d8);
  scene.fog = new THREE.Fog(0x87b5d8, 260, 620);

  G.city = city;
  G.nav = buildRoadGraph();
  return city;
}

// Blocks reserved for landmarks, keyed "gx,gz" (block coords).
const LANDMARK_BLOCKS = {
  '0,-2': 1, '-2,0': 1, '2,2': 1, '-3,-3': 1, '5,3': 1, '4,-4': 1,
};

function addLandmark(scene, rng, name, gx, gz, color, w, h, d) {
  const cx = gx * 44 + 22, cz = gz * 44 + 22;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(cx, h / 2, cz);
  m.userData.landmark = name;
  scene.add(m);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, 2.4, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  sign.position.set(cx, h + 1.6, cz + d / 2 + 0.4);
  scene.add(sign);
  return { name, pos: new THREE.Vector3(cx, 0, cz), mesh: m };
}

// Road graph: intersections at every grid crossing; traffic picks a random
// neighbouring intersection to drive toward.
function buildRoadGraph() {
  const nodes = [];
  for (let i = -HALF; i <= HALF; i++) {
    for (let j = -HALF; j <= HALF; j++) {
      nodes.push({ x: i * BLOCK, z: j * BLOCK });
    }
  }
  return { nodes, size: HALF * 2 + 1 };
}

export function nearestRoadPoint(x, z) {
  const rx = clamp(Math.round(x / BLOCK) * BLOCK, -HALF * BLOCK, HALF * BLOCK);
  const rz = clamp(Math.round(z / BLOCK) * BLOCK, -HALF * BLOCK, HALF * BLOCK);
  // Snap to whichever axis road is closer.
  if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx, z };
  return { x, z: rz };
}

export function randomRoadPoint(rng) {
  const n = G.nav.nodes[Math.floor(rng.rand() * G.nav.nodes.length)];
  return { x: n.x, z: n.z };
}
