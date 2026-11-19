// city.js — DUSTLINE: the procedural sun-baked desert city. Builds the Three.js
// world from a seed: ground, roads, sidewalks, buildings with lit windows,
// palms, cacti, lamps and the landmarks the missions use. Also owns the road
// graph traffic drives on and the building colliders everything bumps into.

import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp } from './utils.js';

export const BLOCK = 36;        // building block side
export const ROAD = 10;         // road width
export const GRID = 7;          // blocks per side
export const PITCH = BLOCK + ROAD; // 46
export const HALF = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 166

// Road centre lines, one per grid line (GRID+1 = 8 lines each way).
export function roadCentres() {
  const out = [];
  for (let i = 0; i <= GRID; i++) out.push(-HALF + ROAD / 2 + i * PITCH);
  return out;
}

export const City = {
  built: false,
  colliders: [],       // {minX,maxX,minZ,maxZ}
  nodes: [],           // road-graph intersections {x,z}
  edges: new Map(),    // node index -> [neighbour indices]
  landmarks: {},       // bank, safehouse, diner, gas, tower, motel
  spawn: { x: 0, z: 0 },
  group: null,
};

function windowTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.next() < 0.5 ? '#ffd98a' : '#9fd8ff') : '#20242c';
      g.fillRect(8 + col * 20, 10 + r * 17, 12, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  scene.add(group);
  City.group = group;
  City.colliders = [];
  City.nodes = [];
  City.edges = new Map();
  City.landmarks = {};

  const centres = roadCentres();

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0xcfd8dc, 220, 700);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffe8c8, 0.55));
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0xc2a06a, 0.5));

  // --- desert ground + city slab ------------------------------------------
  const desert = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({ color: 0xd9b380, roughness: 1 })
  );
  desert.rotation.x = -Math.PI / 2;
  desert.receiveShadow = true;
  group.add(desert);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 24, HALF * 2 + 24),
    new THREE.MeshStandardMaterial({ color: 0x8a7f70, roughness: 1 })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0.02;
  slab.receiveShadow = true;
  group.add(slab);

  // --- roads + sidewalks ---------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9a98c, roughness: 1 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8d44d });
  for (const c of centres) {
    // vertical road
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, HALF * 2 + 24), roadMat);
    rv.rotation.x = -Math.PI / 2; rv.position.set(c, 0.04, 0); rv.receiveShadow = true;
    group.add(rv);
    const rh = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 24, ROAD), roadMat);
    rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.04, c); rh.receiveShadow = true;
    group.add(rh);
    // sidewalks (two strips flanking each road)
    for (const off of [-ROAD / 2 - 1.5, ROAD / 2 + 1.5]) {
      const sv = new THREE.Mesh(new THREE.PlaneGeometry(3, HALF * 2 + 24), walkMat);
      sv.rotation.x = -Math.PI / 2; sv.position.set(c + off, 0.03, 0); sv.receiveShadow = true;
      group.add(sv);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 24, 3), walkMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.03, c + off); sh.receiveShadow = true;
      group.add(sh);
    }
    // centre dashes along each road
    for (let d = -HALF + 12; d < HALF - 8; d += 16) {
      const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dv.rotation.x = -Math.PI / 2; dv.position.set(c, 0.05, d);
      group.add(dv);
      const dh = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      dh.rotation.x = -Math.PI / 2; dh.position.set(d, 0.05, c);
      group.add(dh);
    }
  }

  // --- road graph ----------------------------------------------------------
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      City.nodes.push({ x: centres[i], z: centres[j] });
    }
  }
  const idx = (i, j) => i * (GRID + 1) + j;
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const n = [];
      if (i > 0) n.push(idx(i - 1, j));
      if (i < GRID) n.push(idx(i + 1, j));
      if (j > 0) n.push(idx(i, j - 1));
      if (j < GRID) n.push(idx(i, j + 1));
      City.edges.set(idx(i, j), n);
    }
  }

  // --- buildings -----------------------------------------------------------
  const palette = ['#c96f4a', '#d9a05b', '#7d8ca3', '#a3b18a', '#b08968', '#8e6f8e', '#6a8caf', '#c2b280'];
  const texCache = {};
  function facade(base) {
    if (!texCache[base]) texCache[base] = windowTexture(rng, base, 0.22);
    return new THREE.MeshStandardMaterial({ map: texCache[base], roughness: 0.85 });
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 1 });

  // Landmark blocks: bank (3,3) centre, motel/safehouse (0,6) south-west,
  // diner (6,1) north-east, gas station (6,5) south-east, tower (3,0) north.
  const landmarkBlocks = {
    '3,3': 'bank', '0,6': 'motel', '6,1': 'diner', '6,5': 'gas', '3,0': 'tower',
  };

  for (let bi = 0; bi < GRID; bi++) {
    for (let bj = 0; bj < GRID; bj++) {
      const x0 = centres[bi] + ROAD / 2;
      const z0 = centres[bj] + ROAD / 2;
      const key = bi + ',' + bj;
      const kind = landmarkBlocks[key];
      if (kind === 'bank') {
        // Dustline Bank: wide low building with columns + sign.
        const b = box(30, 12, 20, facade('#d9c9a3'));
        b.position.set(x0 + 18, 6, z0 + 18);
        group.add(b);
        const roof = box(32, 1, 22, roofMat); roof.position.set(x0 + 18, 12.5, z0 + 18); group.add(roof);
        for (let k = 0; k < 4; k++) {
          const col = box(1.2, 10, 1.2, new THREE.MeshStandardMaterial({ color: 0xf2e8d5 }));
          col.position.set(x0 + 6 + k * 8, 5, z0 + 8.5);
          group.add(col);
        }
        City.colliders.push({ minX: x0 + 3, maxX: x0 + 33, minZ: z0 + 8, maxZ: z0 + 28 });
        City.landmarks.bank = { x: x0 + 18, z: z0 + 6, name: 'Dustline Bank' };
        continue;
      }
      if (kind === 'motel') {
        // Safehouse motel: long two-storey block with a pool.
        const b = box(32, 9, 12, facade('#c96f4a'));
        b.position.set(x0 + 18, 4.5, z0 + 22);
        group.add(b);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshStandardMaterial({ color: 0x3aa7c9, roughness: 0.2 }));
        pool.rotation.x = -Math.PI / 2; pool.position.set(x0 + 18, 0.06, z0 + 8);
        group.add(pool);
        City.colliders.push({ minX: x0 + 2, maxX: x0 + 34, minZ: z0 + 16, maxZ: z0 + 28 });
        City.landmarks.safehouse = { x: x0 + 18, z: z0 + 8, name: 'Safehouse Motel' };
        City.landmarks.motel = City.landmarks.safehouse;
        City.spawn = { x: x0 + 18, z: z0 + 4 };
        continue;
      }
      if (kind === 'diner') {
        const b = box(20, 7, 14, facade('#d9a05b'));
        b.position.set(x0 + 18, 3.5, z0 + 18);
        group.add(b);
        City.colliders.push({ minX: x0 + 8, maxX: x0 + 28, minZ: z0 + 11, maxZ: z0 + 25 });
        City.landmarks.diner = { x: x0 + 18, z: z0 + 8, name: 'Route 66 Diner' };
        continue;
      }
      if (kind === 'gas') {
        // Gas station: canopy on pillars + small kiosk.
        const canopy = box(22, 1, 14, new THREE.MeshStandardMaterial({ color: 0xd94f30 }));
        canopy.position.set(x0 + 18, 6, z0 + 16);
        group.add(canopy);
        for (const [px, pz] of [[x0 + 9, z0 + 11], [x0 + 27, z0 + 11], [x0 + 9, z0 + 21], [x0 + 27, z0 + 21]]) {
          const p = box(0.8, 6, 0.8, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
          p.position.set(px, 3, pz); group.add(p);
        }
        const kiosk = box(8, 5, 6, facade('#8e6f8e'));
        kiosk.position.set(x0 + 26, 2.5, z0 + 30);
        group.add(kiosk);
        City.colliders.push({ minX: x0 + 22, maxX: x0 + 30, minZ: z0 + 27, maxZ: z0 + 33 });
        City.landmarks.gas = { x: x0 + 18, z: z0 + 16, name: 'Gas Station' };
        continue;
      }
      if (kind === 'tower') {
        // Dustline Tower: the tallest building in town.
        const b = box(24, 64, 24, facade('#7d8ca3'));
        b.position.set(x0 + 18, 32, z0 + 18);
        group.add(b);
        const spire = box(4, 10, 4, new THREE.MeshStandardMaterial({ color: 0xe8d44d, emissive: 0x554400 }));
        spire.position.set(x0 + 18, 69, z0 + 18);
        group.add(spire);
        City.colliders.push({ minX: x0 + 6, maxX: x0 + 30, minZ: z0 + 6, maxZ: z0 + 30 });
        City.landmarks.tower = { x: x0 + 18, z: z0 + 4, name: 'Dustline Tower' };
        continue;
      }
      // Regular block: 1-3 buildings, or a park.
      if (rng.chance(0.14)) {
        // Park: palms + benches, no collider.
        for (let k = 0; k < 4; k++) {
          const px = x0 + 6 + rng.range(0, 24), pz = z0 + 6 + rng.range(0, 24);
          group.add(makePalm(px, pz, rng));
        }
        continue;
      }
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(10, 16), d = rng.range(10, 16);
        const h = rng.range(8, 34);
        const bx = x0 + 6 + rng.range(0, BLOCK - 12 - w);
        const bz = z0 + 6 + rng.range(0, BLOCK - 12 - d);
        const base = palette[Math.floor(rng.next() * palette.length)];
        const b = box(w, h, d, facade(base));
        b.position.set(bx + w / 2, h / 2, bz + d / 2);
        group.add(b);
        const roof = box(w + 0.6, 0.8, d + 0.6, roofMat);
        roof.position.set(bx + w / 2, h + 0.4, bz + d / 2);
        group.add(roof);
        City.colliders.push({ minX: bx, maxX: bx + w, minZ: bz, maxZ: bz + d });
      }
    }
  }

  // --- palms along the main roads ------------------------------------------
  for (const c of centres) {
    for (let d = -HALF + 20; d < HALF - 10; d += 46) {
      if (rng.chance(0.6)) group.add(makePalm(c + ROAD / 2 + 3.5, d, rng));
      if (rng.chance(0.6)) group.add(makePalm(d, c - ROAD / 2 - 3.5, rng));
    }
  }

  // --- desert props: cacti + rocks outside the city ------------------------
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9c8a76, roughness: 1 });
  for (let k = 0; k < 90; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(HALF + 30, 520);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (rng.chance(0.6)) {
      const cactus = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, rng.range(3, 6), 8), cactusMat);
      trunk.position.y = 2; trunk.castShadow = true;
      cactus.add(trunk);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2, 8), cactusMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(0.9, 2.2, 0);
      cactus.add(arm);
      cactus.position.set(x, 0, z);
      group.add(cactus);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(1, 3), 0), rockMat);
      rock.position.set(x, 1, z);
      rock.castShadow = true;
      group.add(rock);
    }
  }

  // --- street lamps ---------------------------------------------------------
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xcc9900, emissiveIntensity: 0.6 });
  for (const c of centres) {
    for (let d = -HALF + 30; d < HALF; d += 92) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), lampMat);
      pole.position.set(c + ROAD / 2 + 2, 3.5, d);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), bulbMat);
      bulb.position.set(c + ROAD / 2 + 2, 7.1, d);
      group.add(bulb);
    }
  }

  City.built = true;
  return City;
}

function makePalm(x, z, rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b46, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 6, 7), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  trunk.castShadow = true;
  palm.add(trunk);
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), leafMat);
    leaf.position.y = 6.1;
    leaf.rotation.y = (k / 6) * Math.PI * 2;
    leaf.rotation.x = -0.7;
    leaf.translateZ(1.4);
    leaf.castShadow = true;
    palm.add(leaf);
  }
  palm.position.set(x, 0, z);
  return palm;
}

// Snap a point to the nearest road centre line.
export function nearestRoadPoint(x, z) {
  const centres = roadCentres();
  let bestX = centres[0], bestZ = centres[0], best = Infinity;
  for (const c of centres) {
    const dx = Math.abs(x - c);
    if (dx < best) { best = dx; bestX = c; bestZ = z; }
  }
  best = Infinity;
  for (const c of centres) {
    const dz = Math.abs(z - c);
    if (dz < best) { best = dz; bestZ = c; bestX = x; }
  }
  // Prefer the closer of the two axes.
  const dx = Math.abs(x - bestX), dz = Math.abs(z - bestZ);
  return dx <= dz ? { x: bestX, z } : { x, z: bestZ };
}

export function randomNode(rng) {
  return City.nodes[Math.floor(rng.next() * City.nodes.length)];
}

export function clampToWorld(x, z, margin) {
  const m = HALF + 260 - (margin || 0);
  return { x: clamp(x, -m, m), z: clamp(z, -m, m) };
}
