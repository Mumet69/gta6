// buildCity: the whole of Velvet Bay — grid streets, downtown towers, the
// Ocean Drive beachfront, the pier, the harbor, palms, neon and lamps.
// Returns colliders (AABB list), road graph nodes, spawn points and landmarks.
import { clamp, facadeTexture, glowTexture, mulberry32, pick, rand, roadTexture } from './util.js';

export const CITY = { half: 168, block: 42, road: 12 };
export const BEACH_X = 150; // east of this: sand + ocean
export const PIER = { x0: 175, z0: 79, x1: 265, z1: 89, top: 1.95 };
export function groundHeight(x, z) {
  return (x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1) ? PIER.top : 0;
}

export function buildCity(scene) {
  const r = mulberry32(20261124);
  const colliders = [];   // {x0,z0,x1,z1}
  const lamps = [];
  const glowTex = glowTexture();
  const roadTex = roadTexture();

  // --- sky, sun, fog (golden hour by default; setTimeOfDay retunes) ---
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(120, 140, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x3a2a1e, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xffc98a, 260, 620);
  scene.background = new THREE.Color(0xff9e5e);

  // --- ground: city slab, sand, ocean ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 520),
    new THREE.MeshStandardMaterial({ color: 0xe8cf9a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(BEACH_X + 32, 0.06, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 520),
    new THREE.MeshStandardMaterial({ color: 0x1a6f8e, roughness: 0.25, metalness: 0.35 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(BEACH_X + 190, 0.02, 0);
  scene.add(ocean);
  // gentle animated swell lines on the water
  for (let i = 0; i < 14; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 300),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.25 }));
    w.position.set(BEACH_X + 80 + i * 9, 0.12, 0);
    w.userData.wave = i;
    scene.add(w);
  }

  // --- roads: grid avenues + streets, with sidewalk strips ---
  const lines = [];
  for (let i = -3; i <= 3; i++) lines.push(i * CITY.block);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
  for (const c of lines) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, 380), roadMat.clone());
    v.material.map = roadTex.clone(); v.material.map.repeat.set(1, 12);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.08, 0); v.receiveShadow = true;
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(380, CITY.road), roadMat.clone());
    h.material.map = roadTex.clone(); h.material.map.repeat.set(12, 1);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.08, c); h.receiveShadow = true;
    scene.add(h);
  }
  // road graph: intersections, used by traffic AI and mission routing
  const nodes = [];
  for (const x of lines) for (const z of lines) nodes.push({ x, z });

  // --- buildings: one or two per block, taller toward downtown ---
  const palettes = [
    ['#3d5a80', '#ffd166'], ['#6d597a', '#ffb4d9'], ['#2a6f6f', '#a8e6cf'],
    ['#8d5a3b', '#ffd166'], ['#4a4e69', '#c8b6ff'], ['#355070', '#ff8fa3'],
    ['#5c677d', '#ffe9a8'], ['#7b2d26', '#ffb703'],
  ];
  const downtown = (x, z) => Math.hypot(x + 20, z - 40);
  let seed = 7;
  for (let bx = -3; bx < 3; bx++) for (let bz = -3; bz < 3; bz++) {
    if (bx === 3) continue;
    const cx = bx * CITY.block + CITY.block / 2;
    const cz = bz * CITY.block + CITY.block / 2;
    const near = downtown(cx, cz);
    const tall = near < 90 ? rand(28, 68) : rand(10, 30);
    const [base, lit] = pick(palettes);
    const w = rand(20, 30), d = rand(20, 30);
    const h = tall;
    const tex = facadeTexture(base, lit, seed++);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    b.position.set(cx, h / 2, cz);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1),
      new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 1 }));
    roof.position.set(cx, h + 0.6, cz);
    scene.add(roof);
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
    // rooftop beacon on the tallest towers
    if (h > 45) {
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3355 }));
      bc.position.set(cx, h + 2.4, cz); scene.add(bc);
    }
    // second smaller block building on large plots
    if (r() < 0.5) {
      const w2 = rand(10, 14), d2 = rand(10, 14), h2 = rand(6, 12);
      const ox = cx + (r() < 0.5 ? -1 : 1) * (w / 2 + 8);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2),
        new THREE.MeshStandardMaterial({ color: pick(['#7a6a53', '#5a6b7a', '#8a5a6b']), roughness: 0.9 }));
      b2.position.set(ox, h2 / 2, cz + rand(-6, 6));
      b2.castShadow = true; scene.add(b2);
      colliders.push({ x0: ox - w2 / 2, z0: b2.position.z - d2 / 2, x1: ox + w2 / 2, z1: b2.position.z + d2 / 2 });
    }
  }

  // --- Ocean Drive beachfront: low art-deco hotels with neon ---
  const neonCols = [0xff5da2, 0x35f1ff, 0xffd23f, 0xb45cff, 0x7dff9a];
  for (let i = 0; i < 7; i++) {
    const z = -130 + i * 42;
    const col = neonCols[i % neonCols.length];
    const h = rand(12, 20);
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(16, h, 22),
      new THREE.MeshStandardMaterial({ color: pick(['#f7ede2', '#ffd6e8', '#d6f7ff', '#fff3c4']), roughness: 0.8 }));
    hotel.position.set(141, h / 2, z); hotel.castShadow = true;
    scene.add(hotel);
    colliders.push({ x0: 134, z0: z - 11, x1: 148, z1: z + 11 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 14),
      new THREE.MeshStandardMaterial({ color: 0x111122, emissive: col, emissiveIntensity: 1.6 }));
    sign.position.set(132.5, h - 2, z); scene.add(sign);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.55, depthWrite: false }));
    glow.scale.set(22, 10, 1); glow.position.set(131.5, h - 2, z); scene.add(glow);
  }

  // --- pier stretching into the ocean ---
  const pier = new THREE.Mesh(new THREE.BoxGeometry(90, 1.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }));
  pier.position.set(BEACH_X + 70, 1.2, 84); pier.castShadow = true; scene.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3220 }));
    post.position.set(BEACH_X + 32 + i * 11, 0.5, 80); scene.add(post);
    const post2 = post.clone(); post2.position.z = 88; scene.add(post2);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(9, 1.1, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xff5da2, emissive: 0xff5da2, emissiveIntensity: 0.9 }));
  wheel.position.set(BEACH_X + 108, 13, 84); wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);
  wheel.userData.ferris = true;

  // --- harbor (south-west): containers + cranes ---
  const contCols = [0xd95d39, 0x2a9d8f, 0xe9c46a, 0x264653, 0x9b2226];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: pick(contCols), roughness: 0.7, metalness: 0.3 }));
    c.position.set(-150 + (i % 5) * 14, 1.3 + Math.floor(i / 5) * 2.7, 150 - (i % 2) * 6);
    c.castShadow = true; scene.add(c);
    colliders.push({ x0: c.position.x - 6, z0: c.position.z - 1.4, x1: c.position.x + 6, z1: c.position.z + 1.4 });
  }
  for (let i = 0; i < 2; i++) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2),
      new THREE.MeshStandardMaterial({ color: 0xe9c46a }));
    leg.position.y = 13; crane.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xe9c46a }));
    arm.position.set(8, 25, 0); crane.add(arm);
    crane.position.set(-120 + i * 46, 0, 168);
    scene.add(crane);
    colliders.push({ x0: crane.position.x - 2, z0: crane.position.z - 2, x1: crane.position.x + 2, z1: crane.position.z + 2 });
  }

  // --- palms along the beach and avenues ---
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fae5f, roughness: 0.9, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 6), palmMat);
    trunk.position.y = 3.5; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
      leaf.position.y = 7; leaf.rotation.z = 0.5 + i * 0.15;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.translateY(1.6);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let z = -150; z <= 150; z += 18) palm(146, z);
  for (let z = -140; z <= 140; z += 36) { palm(-122, z); palm(122, z); }

  // --- street lamps ---
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.6, metalness: 0.5 });
  for (const n of nodes) {
    if (Math.abs(n.x) > 130 || Math.abs(n.z) > 150) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), lampMat);
    pole.position.set(n.x + 7, 3.5, n.z + 7); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffe9a8, emissiveIntensity: 1.4 }));
    bulb.position.set(n.x + 7, 7.1, n.z + 7); scene.add(bulb);
    lamps.push(bulb);
  }

  // --- traffic-light poles at main intersections ---
  for (const [x, z] of [[0, 0], [-42, 0], [42, -42], [0, 42]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6, 6), lampMat);
    pole.position.set(x + 6.5, 3, z + 6.5); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x33ff66, emissiveIntensity: 0.8 }));
    head.position.set(x + 6.5, 6.2, z + 6.5); scene.add(head);
  }

  // --- distant skyline silhouettes for depth ---
  for (let i = 0; i < 16; i++) {
    const h = rand(50, 110);
    const s = new THREE.Mesh(new THREE.BoxGeometry(rand(18, 30), h, rand(18, 30)),
      new THREE.MeshStandardMaterial({ color: 0x6b4a7a, roughness: 1 }));
    const a = (i / 16) * Math.PI * 2;
    s.position.set(Math.cos(a) * 260, h / 2 - 2, Math.sin(a) * 260);
    scene.add(s);
  }

  return {
    colliders, nodes, lamps, sun, hemi,
    spawns: {
      start: { x: 0, z: 30 },
      beach: { x: 158, z: -20 },
      harbor: { x: -138, z: 132 },
      downtown: { x: -20, z: -40 },
      drive: { x: 0, z: 84 },
    },
  };
}

// Retune light + sky for a time of day: 'day' | 'sunset' | 'dusk' | 'night'.
export function setTimeOfDay(city, mode) {
  const presets = {
    day:    { sun: 0xfff2d0, sunI: 2.6, hemiI: 1.0, sky: 0x7ec8f7, fog: 0xa8d8f0, sunPos: [80, 180, 40] },
    sunset: { sun: 0xffd9a0, sunI: 2.4, hemiI: 0.9, sky: 0xff9e5e, fog: 0xffc98a, sunPos: [120, 140, -60] },
    dusk:   { sun: 0xff7a5c, sunI: 1.5, hemiI: 0.55, sky: 0x5a3a7a, fog: 0x8a5a7a, sunPos: [-140, 60, -40] },
    night:  { sun: 0x8aa8ff, sunI: 0.7, hemiI: 0.35, sky: 0x0b1030, fog: 0x141a38, sunPos: [-60, 160, 80] },
  };
  const p = presets[mode] || presets.sunset;
  city.sun.color.setHex(p.sun); city.sun.intensity = p.sunI;
  city.sun.position.set(...p.sunPos);
  city.hemi.intensity = p.hemiI;
  const scene = city.sun.parent;
  scene.background.setHex(p.sky);
  scene.fog.color.setHex(p.fog);
  return mode;
}
export function clampToCity(x, z, m = 4) {
  return { x: clamp(x, -CITY.half, CITY.half + 30), z: clamp(z, -CITY.half, CITY.half) };
}
