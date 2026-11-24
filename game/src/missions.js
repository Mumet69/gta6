// missions.js — the 5-mission story of Lucia Vega and Marcus "Reef" Doyle.
// Each mission is a small state machine: goto / drive / collect / eliminate / escape.
import { dist2d, pick } from './util.js';

export const MISSIONS = [
  {
    id: 1, title: 'VELVET SUNRISE', giver: 'LUCIA VEGA',
    brief: 'Lucia needs a driver she can trust. Get to the pink marker on Ocean Drive before the sun is fully up.',
    type: 'goto', target: { x: 132, z: -88 }, radius: 6,
    reward: 400, complete: 'Lucia: "You drive like the bay is yours. It will be."',
  },
  {
    id: 2, title: 'NEON PICKUP', giver: 'REEF DOYLE',
    brief: 'Reef left a duffel of cash in a taxi at the downtown cab rank. Steal any car, get there, grab it.',
    type: 'collect', target: { x: -42, z: -42 }, radius: 5, count: 1,
    reward: 650, complete: 'Reef: "Clean. The crew is watching you now, kid."',
  },
  {
    id: 3, title: 'PIER PRESSURE', giver: 'LUCIA VEGA',
    brief: 'Rival crew is holding the pier. Clear them out — all four — then the pier is ours.',
    type: 'eliminate', target: { x: 216, z: 84 }, radius: 30, count: 4,
    reward: 900, complete: 'Lucia: "The pier flies our flag tonight."',
  },
  {
    id: 4, title: 'HARBOR LIGHTS', giver: 'REEF DOYLE',
    brief: 'A shipment is waiting in the harbor containers. Collect 3 crates — and the harbor rats will not like it.',
    type: 'collect', target: { x: -138, z: 138 }, radius: 8, count: 3,
    reward: 1200, complete: 'Reef: "Three crates, zero witnesses. Beautiful."',
  },
  {
    id: 5, title: 'BAY FINALE', giver: 'LUCIA VEGA',
    brief: 'The whole VBPD is coming. Lose them — get to the downtown rooftop marker with 3 stars and survive.',
    type: 'escape', target: { x: -20, z: -40 }, radius: 8,
    reward: 2500, complete: 'Lucia: "Velvet Bay is yours now. All of it."',
  },
];

export function createMissionManager(scene, onEvent) {
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5da2, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 16, 1, true), beaconMat);
  beacon.position.y = 30; beacon.visible = false; scene.add(beacon);
  const markerGeo = new THREE.OctahedronGeometry(1.4);
  const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff5da2 }));
  marker.visible = false; scene.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; ring.visible = false; scene.add(ring);

  const mgr = {
    index: 0, active: null, done: false, progress: 0, enemies: [], crates: [],
    start(i) {
      const m = MISSIONS[i];
      if (!m) { this.done = true; return null; }
      this.index = i; this.active = m; this.progress = 0;
      beacon.visible = true; marker.visible = true; ring.visible = true;
      beacon.position.x = m.target.x; beacon.position.z = m.target.z;
      marker.position.set(m.target.x, 8, m.target.z);
      ring.position.set(m.target.x, 0.15, m.target.z);
      onEvent('mission-start', m);
      return m;
    },
    update(dt, playerPos, inCar, wanted) {
      if (!this.active) return;
      marker.rotation.y += dt * 2;
      marker.position.y = 8 + Math.sin(performance.now() / 400) * 0.8;
      beacon.material.opacity = 0.35 + Math.sin(performance.now() / 300) * 0.15;
      const m = this.active;
      const d = dist2d(playerPos.x, playerPos.z, m.target.x, m.target.z);
      if (m.type === 'goto' || m.type === 'drive') {
        if (d < m.radius) this.complete();
      } else if (m.type === 'collect') {
        if (d < m.radius && this.progress < m.count) {
          this.progress++;
          onEvent('collect', { mission: m, progress: this.progress, count: m.count });
          if (this.progress >= m.count) this.complete();
        }
      } else if (m.type === 'eliminate') {
        const alive = this.enemies.filter((e) => e.alive).length;
        if (this.enemies.length > 0 && alive === 0) this.complete();
      } else if (m.type === 'escape') {
        if (d < m.radius && wanted >= 3) this.complete();
      }
    },
    complete() {
      const m = this.active;
      this.active = null;
      beacon.visible = false; marker.visible = false; ring.visible = false;
      onEvent('mission-complete', m);
    },
    fail(reason) { onEvent('mission-fail', { mission: this.active, reason }); },
    target() { return this.active ? this.active.target : null; },
    distanceTo(playerPos) {
      if (!this.active) return 0;
      return Math.round(dist2d(playerPos.x, playerPos.z, this.active.target.x, this.active.target.z));
    },
    setEnemies(list) { this.enemies = list; },
  };
  return mgr;
}
export function missionIntroText(m) {
  return `${m.giver}: ${m.brief}`;
}
