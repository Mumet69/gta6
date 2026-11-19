// city.js — builds Solmar City procedurally from a seed.
// A sun-soaked coastal grid city: roads every 44 units, blocks of buildings
// with canvas-painted facades, palms and streetlights, a beach and ocean on
// the east edge, and landmarks (bank, safehouse, hospital, police station,
// marina docks) that missions use as objectives.
import * as THREE from 'three';
import { makeRng, pick, randRange, randInt } from './utils.js';

export const CITY_HALF = 198; // city spans -198..198 on x and z
export const ROAD_STEP = 44;

const BUILDING_COLORS = [0xd8c9a8, 0xc9b18c, 0xb7a6c9, 0x9fb8c8, 0xd9a441, 0xe8dcc8, 0x8fb8a8, 0xc98f7a, 0xa8b8d8];
const ROOF_COLORS = [0x5a4a3a, 0x6b5a4a, 0x4a4a55, 0x7a6a55];

// Paint a building facade on a canvas: lit windows on a tinted wall.
// Returns a THREE.CanvasTexture; three variants keep the skyline varied.
function facadeTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 5, rows = 12;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffe9a8' : (rng() < 0.5 ? '#2a3542' : '#3a4a5c');
      g.fillRect(8 + x * 24, 10 + y * 20, 15, 12);
    }
  }
  // ground-floor awning strip
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 228, 128, 28);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'solmar-city';
  scene.add(group);

  const facadeMats = [
    new THREE.MeshLambertMaterial({ map: facadeTexture(rng, '#d8c9a8') }),
    new THREE.MeshLambertMaterial({ map: facadeTexture(rng, '#b7a6c9') }),
    new THREE.MeshLambertMaterial({ map: facadeTexture(rng, '#9fb8c8') }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a55 });

  // --- ground: sidewalk base, roads, beach, ocean ---
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 120, CITY_HALF * 2 + 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2f36 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  const roadLines = [];
  for (let i = -4; i <= 4; i++) {
    const p = i * ROAD_STEP;
    roadLines.push(p);
    for (const horiz of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, 12), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horiz ? 0 : Math.PI / 2;
      road.position.set(horiz ? 0 : p, 0.02, horiz ? p : 0);
      road.receiveShadow = true;
      group.add(road);
      // center dashes
      for (let d = -CITY_HALF; d < CITY_HALF; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horiz ? 0 : Math.PI / 2;
        dash.position.set(horiz ? d : p, 0.04, horiz ? p : d);
        group.add(dash);
      }
    }
  }

  // beach + ocean on the east edge (x > CITY_HALF)
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe8d9a0 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, CITY_HALF * 2 + 120), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY_HALF + 30, 0.01, 0);
  group.add(sand);
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2a7ab8 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, CITY_HALF * 2 + 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY_HALF + 260, -0.4, 0);
  group.add(water);

  // --- buildings: 1-3 per block, varied height and color ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const landmarks = {};
  const blockCenters = [];
  for (let bx = -4; bx < 4; bx++) {
    for (let bz = -4; bz < 4; bz++) {
      const cx = bx * ROAD_STEP + ROAD_STEP / 2;
      const cz = bz * ROAD_STEP + ROAD_STEP / 2;
      blockCenters.push({ x: cx, z: cz });
      const n = randInt(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = randRange(rng, 10, 16);
        const d = randRange(rng, 10, 16);
        const h = randRange(rng, 8, 42);
        const ox = (k % 2 === 0 ? -8 : 8) + randRange(rng, -2, 2);
        const oz = (k === 2 ? -8 : (k === 1 ? 8 : 0)) + randRange(rng, -2, 2);
        const x = cx + ox, z = cz + oz;
        const mat = rng() < 0.6 ? pick(rng, facadeMats) : new THREE.MeshLambertMaterial({ color: pick(rng, BUILDING_COLORS) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        b.castShadow = true; b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- landmarks (taller, distinct, placed on named blocks) ---
  function landmark(x, z, w, h, d, color, name) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    m.name = name;
    group.add(m);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 1, 1, d + 1);
    roof.position.set(x, h + 0.5, z);
    group.add(roof);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return { x, z, name };
  }
  landmarks.bank = landmark(-22, -22, 26, 34, 22, 0xe8c860, 'Solmar First Bank');
  landmarks.station = landmark(110, -66, 24, 22, 20, 0x4a6ab8, 'Solmar PD HQ');
  landmarks.hospital = landmark(-110, 110, 28, 26, 22, 0xf0f0e8, 'Solmar General');
  landmarks.safehouse = landmark(22, 66, 16, 14, 14, 0xc96a4a, "Rio's Safehouse");
  landmarks.marina = { x: -176, z: 154, name: 'Marina Docks' };

  // --- marina: pier + boats on the west edge ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), pierMat);
  pier.position.set(-186, 0.5, 154);
  group.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0xd84a4a });
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), i % 2 ? boatMat : boatMat2);
    boat.position.set(-196 - (i % 2) * 8, 1, 132 + i * 16);
    boat.castShadow = true;
    group.add(boat);
  }

  // --- street props: palms along roads, lamps at intersections ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a9a4a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      const x = i * ROAD_STEP, z = j * ROAD_STEP;
      if (rng() < 0.55) {
        const px = x + 9, pz = z + 9;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
        trunk.position.set(px, 3.5, pz);
        trunk.castShadow = true;
        group.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.5, 7), leafMat);
        crown.position.set(px, 8.2, pz);
        crown.castShadow = true;
        group.add(crown);
      }
      if ((i + j) % 2 === 0) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), lampMat);
        pole.position.set(x - 8, 3, z - 8);
        group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
        bulb.position.set(x - 8, 6.2, z - 8);
        group.add(bulb);
      }
    }
  }

  return {
    group, colliders, roadLines, blockCenters, landmarks,
    spawn: { x: 22, z: 88, heading: Math.PI },
  };
}
