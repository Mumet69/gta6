// city.js — procedural Velvet Bay: a sun-soaked coastal grid city.
// Builds the ground (one canvas-painted texture: roads, sidewalks, dashes,
// crosswalks), buildings with lit-window textures, beach, docks, marina,
// street props and landmark signs. Exports collision + road queries used by
// traffic, pedestrians, police and missions.

import * as THREE from 'three';
import { mulberry32, clamp } from './utils.js';

export const CITY = {
  pitch: 58, // distance between road centrelines
  roadWidth: 14,
  lines: [-232, -174, -116, -58, 0, 58, 116, 174, 232],
  half: 245, // playable ground half-size
  beachZ: 252,
  waterZ: 278,
  docksX: 252,
};

// v3 turf districts: name, centre and radius. districtAt() is what the
// empire, the wanted system and the HUD ask to know where Mara stands.
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x: 0, z: 0, r: 85 },
  { id: 'strip', name: 'The Strip', x: 64, z: 122, r: 70 },
  { id: 'docks', name: 'Docks 7', x: 262, z: 60, r: 70 },
  { id: 'beach', name: 'Beachfront', x: 0, z: 232, r: 80 },
  { id: 'heights', name: 'The Heights', x: -203, z: -203, r: 80 },
];

export function districtAt(x, z) {
  let best = null, bestD = 1e9;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(x - d.x, z - d.z);
    if (dd < d.r && dd < bestD) { best = d; bestD = dd; }
  }
  return best;
}

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#cfd4d8';
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 248; y += 24) {
    for (let x = 10; x < 120; x += 22) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffd98a' : '#2e4256';
      g.fillRect(x, y, 14, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeGroundTexture() {
  const S = 1024; // covers -300..300 m
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + 300) / 600) * S;
  // Asphalt base.
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, S, S);
  // Sidewalk blocks (light) between roads.
  g.fillStyle = '#8f8d84';
  for (let i = 0; i < CITY.lines.length - 1; i++) {
    for (let j = 0; j < CITY.lines.length - 1; j++) {
      const x0 = CITY.lines[i] + CITY.roadWidth / 2;
      const z0 = CITY.lines[j] + CITY.roadWidth / 2;
      const w = CITY.pitch - CITY.roadWidth;
      g.fillRect(toPx(x0), toPx(z0), (w / 600) * S, (w / 600) * S);
    }
  }
  // Centre dashes: yellow on avenues (x = 0 and z = 0), white elsewhere.
  for (const line of CITY.lines) {
    const main = line === 0;
    g.fillStyle = main ? '#d8b13a' : '#cfcfc8';
    for (let v = -290; v < 290; v += 16) {
      g.fillRect(toPx(line) - 1, toPx(v), 2, 8);
      g.fillRect(toPx(v), toPx(line) - 1, 8, 2);
    }
  }
  // Crosswalk stripes at every intersection.
  g.fillStyle = '#d9d9d2';
  for (const lx of CITY.lines) {
    for (const lz of CITY.lines) {
      for (let k = -5; k <= 5; k += 2.5) {
        g.fillRect(toPx(lx + k) - 1.5, toPx(lz - 9), 3, 4);
        g.fillRect(toPx(lx + k) - 1.5, toPx(lz + 5), 3, 4);
        g.fillRect(toPx(lx - 9), toPx(lz + k) - 1.5, 4, 3);
        g.fillRect(toPx(lx + 5), toPx(lz + k) - 1.5, 4, 3);
      }
    }
  }
  // Beach sand (south) and docks concrete (east).
  g.fillStyle = '#e6cf9a';
  g.fillRect(0, toPx(CITY.beachZ), S, S - toPx(CITY.beachZ));
  g.fillStyle = '#7d7a72';
  g.fillRect(toPx(CITY.docksX), 0, S - toPx(CITY.docksX), toPx(CITY.beachZ));
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function makeTextTexture(text, opts = {}) {
  const { w = 512, h = 128, bg = '#101418', fg = '#ffd34d', font = 'bold 64px Arial' } = opts;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(c);
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, ...(opts.mat || {}) }),
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const group = new THREE.Group();
  scene.add(group);

  // Sky + fog + lights.
  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0x9fc6e2, 260, 620);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.5);
  sun.position.set(180, 260, 120);
  scene.add(sun);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Water (south) with gentle bob.
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2b7ea6, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 130), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, CITY.waterZ + 65);
  group.add(water);

  const windowTex = makeWindowTexture();
  const palette = [0xd8c9a8, 0xc9b8a3, 0xa8b8c9, 0xd8a8a0, 0xb8c9a8, 0x9aa5ad, 0xe0d4c0, 0xc4a882, 0x8fa8b8, 0xd9c06a];
  const colliders = [];

  // Buildings, parks and lots, block by block.
  for (let i = 0; i < CITY.lines.length - 1; i++) {
    for (let j = 0; j < CITY.lines.length - 1; j++) {
      const cx = (CITY.lines[i] + CITY.lines[i + 1]) / 2;
      const cz = (CITY.lines[j] + CITY.lines[j + 1]) / 2;
      const distC = Math.sqrt(cx * cx + cz * cz);
      const roll = rng();
      if (roll < 0.14) {
        // Park: grass + palms.
        const grass = box(44, 0.3, 44, 0x5d8a4a, cx, 0.15, cz);
        group.add(grass);
        for (let k = 0; k < 5; k++) {
          group.add(makePalm(cx + (rng() - 0.5) * 34, cz + (rng() - 0.5) * 34, rng));
        }
        continue;
      }
      if (roll < 0.22) {
        // Parking lot: flat + a couple of parked car shells.
        const lot = box(44, 0.2, 44, 0x55585e, cx, 0.1, cz);
        group.add(lot);
        continue;
      }
      const tall = distC < 110 ? 26 + rng() * 38 : distC < 190 ? 12 + rng() * 16 : 6 + rng() * 9;
      const w = 16 + rng() * 16;
      const d = 16 + rng() * 16;
      const color = palette[Math.floor(rng() * palette.length)];
      const tex = windowTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(tall / 14)));
      const mat = new THREE.MeshLambertMaterial({ color, map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, tall, d), mat);
      b.position.set(cx + (rng() - 0.5) * 6, tall / 2, cz + (rng() - 0.5) * 6);
      group.add(b);
      colliders.push({
        minX: b.position.x - w / 2, maxX: b.position.x + w / 2,
        minZ: b.position.z - d / 2, maxZ: b.position.z + d / 2,
      });
      // Roof box.
      group.add(box(w * 0.5, 1.2, d * 0.5, 0x6a6a66, b.position.x, tall + 0.6, b.position.z));
      // A second smaller tower on some downtown blocks.
      if (distC < 110 && rng() < 0.4) {
        const h2 = 10 + rng() * 14;
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(12, h2, 12), mat);
        b2.position.set(cx + 12, h2 / 2, cz - 10);
        group.add(b2);
        colliders.push({
          minX: b2.position.x - 6, maxX: b2.position.x + 6,
          minZ: b2.position.z - 6, maxZ: b2.position.z + 6,
        });
      }
    }
  }

  // Streetlights along the two main avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833 });
  for (const line of [-58, 0, 58]) {
    for (let v = -220; v <= 220; v += 58) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), lampMat);
      pole.position.set(line + 6.4, 3.5, v);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(line + 6.4, 7.1, v);
      group.add(bulb);
    }
  }

  // Palm trees along the beachfront road.
  for (let x = -230; x <= 230; x += 23) {
    group.add(makePalm(x, CITY.beachZ - 10, rng));
  }

  // Traffic lights at four central intersections (animated in update).
  const trafficLights = [];
  for (const [ix, iz] of [[-58, -58], [58, -58], [-58, 58], [58, 58]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6, 6), lampMat);
    pole.position.set(ix + 7.5, 3, iz + 7.5);
    group.add(pole);
    const head = box(0.9, 2.2, 0.9, 0x1a1a1a, ix + 7.5, 6.4, iz + 7.5);
    group.add(head);
    const mk = (color, y) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.9 }));
      s.position.set(ix + 7.5, y, iz + 8.0);
      group.add(s);
      return s;
    };
    trafficLights.push({ red: mk(0xff2a22, 7.1), yellow: mk(0xffc21a, 6.4), green: mk(0x2aff5a, 5.7) });
  }

  // Landmark signs.
  function addSign(text, w, h, x, y, z, ry, opts) {
    const tex = makeTextTexture(text, opts);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  }
  addSign('VELVET BAY', 26, 6.5, 0, 9, CITY.beachZ - 16, 0, { fg: '#ffd34d' });
  addSign('MERIDIAN BANK', 20, 5, -29, 14, -29, Math.PI / 4, { fg: '#9fd8ff' });
  addSign("CASH'S GARAGE", 18, 4.5, 87, 7, -87, -Math.PI / 4, { fg: '#ff9d5c' });
  addSign('SUNSET MOTEL', 16, 4, -145, 8, 232, 0, { fg: '#ff8fb0' });
  addSign('DOCKS 7', 14, 3.5, 258, 8, 60, -Math.PI / 2, { fg: '#bfe8ff' });
  addSign('PIER 9', 12, 3, -203, 6, 258, 0, { fg: '#ffe9a8' });

  // Docks: containers + cranes.
  const contColors = [0xb8502e, 0x2e6db8, 0x3a9a4a, 0xc9a13a, 0x7a4a9a];
  for (let k = 0; k < 14; k++) {
    const cx = 262 + (rng() - 0.5) * 40;
    const cz = -160 + k * 26;
    const c = box(12, 3, 3, contColors[k % contColors.length], cx, 1.5 + (k % 3) * 3, cz, { ry: rng() < 0.5 ? 0 : Math.PI / 2 });
    group.add(c);
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 2, maxZ: cz + 2 });
  }
  for (const cz of [-80, 80]) {
    group.add(box(3, 26, 3, 0xd8b13a, 258, 13, cz));
    group.add(box(30, 2.5, 2.5, 0xd8b13a, 244, 25, cz));
  }

  // Marina boats near the pier.
  for (let k = 0; k < 5; k++) {
    const bx = -190 + k * 22;
    const hull = box(4, 1.6, 10, [0xe8e8e8, 0xd86a5a, 0x5a8ad8][k % 3], bx, 0.6, 292);
    group.add(hull);
    group.add(box(2.4, 1.4, 4, 0x2a2f33, bx, 2, 291));
  }

  // The Velvet Strip: neon signs along the avenue at (58, 116).
  addSign('VELVET STRIP', 22, 5.5, 58, 11, 116, Math.PI / 2, { fg: '#ff5ce1' });
  addSign('NEON PALMS', 16, 4, 116, 8, 58, -Math.PI / 2, { fg: '#7dff9a' });
  addSign('BAY ARENA', 20, 5, 203, 12, 203, -Math.PI / 4, { fg: '#ffd34d' });

  // Bay Arena stadium on the south-east block: green pitch, stands, floodlights.
  const stadium = new THREE.Group();
  const pitch = box(46, 0.4, 30, 0x4a8a3a, 203, 0.2, 203);
  stadium.add(pitch);
  for (const [sx, sz, w, d] of [[203, 184, 50, 6], [203, 222, 50, 6], [176, 203, 6, 44], [230, 203, 6, 44]]) {
    stadium.add(box(w, 9, d, 0xd8d4c8, sx, 4.5, sz));
  }
  for (const [fx, fz] of [[178, 178], [228, 178], [178, 228], [228, 228]]) {
    stadium.add(box(1, 22, 1, 0x3a3f45, fx, 11, fz));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833 }));
    lamp.position.set(fx, 22.5, fz);
    stadium.add(lamp);
  }
  group.add(stadium);
  colliders.push(
    { minX: 178, maxX: 228, minZ: 181, maxZ: 187 },
    { minX: 178, maxX: 228, minZ: 219, maxZ: 225 },
    { minX: 173, maxX: 179, minZ: 181, maxZ: 225 },
    { minX: 227, maxX: 233, minZ: 181, maxZ: 225 },
  );

  // Ferris wheel on the pier: two legs, a turning rim with cabins.
  const wheelGroup = new THREE.Group();
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xd8b13a });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 8, 28), rimMat);
  rim.position.y = 18;
  wheelGroup.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 10), rimMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.y = 18;
  wheelGroup.add(hub);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0xff5ce1 });
  const cabins = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), cabinMat);
    cabin.position.set(Math.cos(a) * 14, 18 + Math.sin(a) * 14, 0);
    wheelGroup.add(cabin);
    cabins.push({ mesh: cabin, angle: a });
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 19, 6), lampMat);
    leg.position.set(0, 9, s * 3);
    leg.rotation.x = s * 0.28;
    wheelGroup.add(leg);
  }
  wheelGroup.position.set(-160, 0, 264);
  group.add(wheelGroup);

  // Beach umbrellas along the sand.
  for (let k = 0; k < 8; k++) {
    const ux = -200 + k * 55;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), lampMat);
    pole.position.set(ux, 1.3, 258);
    group.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: [0xff5c5c, 0x5c9dff, 0xffd34d, 0x7dff9a][k % 4] }));
    shade.position.set(ux, 3.0, 258);
    group.add(shade);
  }

  // ---- queries ----
  function isRoad(x, z) {
    for (const line of CITY.lines) {
      if (Math.abs(x - line) <= CITY.roadWidth / 2 + 0.5) return true;
      if (Math.abs(z - line) <= CITY.roadWidth / 2 + 0.5) return true;
    }
    return false;
  }
  function isWater(x, z) {
    return z > CITY.waterZ;
  }
  function isOffGround(x, z) {
    return z > CITY.beachZ + 4 || x > CITY.docksX + 40;
  }
  function nearestRoadPoint(x, z) {
    let bestX = CITY.lines[0], bestZ = CITY.lines[0], best = 1e9;
    for (const line of CITY.lines) {
      const d1 = Math.abs(x - line);
      if (d1 < best) { best = d1; bestX = line; bestZ = z; }
      const d2 = Math.abs(z - line);
      if (d2 < best) { best = d2; bestX = x; bestZ = line; }
    }
    return { x: bestX, z: bestZ };
  }
  function randomRoadPoint(rngFn) {
    const line = CITY.lines[Math.floor(rngFn() * CITY.lines.length)];
    const along = (rngFn() - 0.5) * 440;
    return rngFn() < 0.5 ? { x: line, z: along } : { x: along, z: line };
  }
  // Push a circle out of building colliders. Returns {x, z, hit}.
  function collideCircle(x, z, r) {
    let hit = false;
    for (const c of colliders) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Inside the box: push out along the smallest penetration axis.
          const pl = x - (c.minX - r), pr = (c.maxX + r) - x;
          const pt = z - (c.minZ - r), pb = (c.maxZ + r) - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r;
          else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    return { x, z, hit };
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    water.position.y = 0.1 + Math.sin(elapsed * 0.7) * 0.08;
    // The ferris wheel turns slowly, cabins staying upright. Cabin positions
    // are relative to wheelGroup (which sits at -160, 0, 264).
    const wSpeed = dt * 0.12;
    rim.rotation.z += wSpeed;
    for (const c of cabins) {
      c.angle += wSpeed;
      c.mesh.position.set(Math.cos(c.angle) * 14, 18 + Math.sin(c.angle) * 14, 0);
      c.mesh.rotation.z = 0;
    }
    const phase = Math.floor(elapsed / 6) % 3; // 0 green, 1 yellow, 2 red
    for (const tl of trafficLights) {
      tl.green.material.emissiveIntensity = phase === 0 ? 1.2 : 0.08;
      tl.yellow.material.emissiveIntensity = phase === 1 ? 1.2 : 0.08;
      tl.red.material.emissiveIntensity = phase === 2 ? 1.2 : 0.08;
    }
  }

  return {
    group, colliders, update, sun, hemi, water,
    isRoad, isWater, isOffGround, nearestRoadPoint, randomRoadPoint, collideCircle,
  };
}

// v3: The Heights, a new quarter in the north-west corner around the
// safehouse — hillside villas, a lookout over the bay, the Vipers' home
// turf and Mara's turf-war flag. Called once by main.js after buildCity;
// its buildings push into the same colliders array, so cars and peds
// collide with them exactly like the downtown blocks.
export function buildHeightsQuarter(scene, city) {
  const rng = mulberry32(20261121);
  const group = new THREE.Group();
  scene.add(group);
  const addVilla = (x, z, w, h, d, color) => {
    const villa = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    villa.position.set(x, h / 2, z);
    group.add(villa);
    city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a4a2a }),
    );
    roof.position.set(x, h + 1.7, z);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    return villa;
  };
  const palette = [0xe8d8b8, 0xd8c9a8, 0xc9b8a3, 0xe0d4c0];
  // Villas sit on a grid kept clear of the safehouse itself (-203, -203):
  // the nearest villa stands ~18 m off, so the safehouse marker stays
  // reachable on foot for the escape steps that end there.
  for (let i = 0; i < 6; i++) {
    const x = -240 + (i % 3) * 24 + (rng() - 0.5) * 8;
    const z = -240 + Math.floor(i / 3) * 24 + (rng() - 0.5) * 8;
    addVilla(x, z, 15 + rng() * 6, 8 + rng() * 7, 14 + rng() * 5, palette[i % palette.length]);
  }
  // Lookout platform over the bay, with a railing of low boxes.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(24, 1, 12),
    new THREE.MeshLambertMaterial({ color: 0x8f8d84 }),
  );
  deck.position.set(-203, 0.5, -232);
  group.add(deck);
  for (let i = 0; i < 5; i++) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.2, 1),
      new THREE.MeshLambertMaterial({ color: 0x6a6a66 }),
    );
    rail.position.set(-213 + i * 5, 1.6, -237);
    group.add(rail);
  }
  // Hillside palms and a neon sign for the quarter.
  for (let i = 0; i < 8; i++) {
    group.add(makePalm(-240 + rng() * 70, -240 + rng() * 60, rng));
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 4),
    new THREE.MeshBasicMaterial({ map: makeTextTexture('THE HEIGHTS', { fg: '#ffd34d', font: 'bold 44px Arial' }), transparent: true }),
  );
  sign.position.set(-203, 9, -226);
  group.add(sign);
  return group;
}

function makePalm(x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 6 + rng() * 2, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  trunk.position.y = 3;
  trunk.rotation.z = (rng() - 0.5) * 0.25;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, 6.4, Math.sin(a) * 1.2);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}
