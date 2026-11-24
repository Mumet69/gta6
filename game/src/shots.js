// shots.js — deterministic staging for the 4 screenshots (?shot=1..4).
// Each preset places the player, the light and the action, then the page
// screenshots itself after the scene settles. Real renders, no compositing.
import { setTimeOfDay } from './city.js';
import { spawnPoliceCar, CAR_MODELS } from './vehicles.js';
import { spawnEnemy } from './people.js';

export function applyShot(G, n) {
  const scene = G.scene;
  const putCarOnRoad = (x, z, rotY) => {
    // reuse the parked starter car as the hero car
    const hero = G.traffic.find((t) => t.kind === 'parked');
    if (!hero) return null;
    G.traffic = G.traffic.filter((t) => t !== hero);
    G.inCar = true; G.car = hero.mesh; G.carSpeed = 14;
    G.car.position.set(x, 0, z); G.car.rotation.y = rotY;
    G.player.visible = false;
    G.camYaw = rotY;
    G.hud.setSpeed(58, hero.model.name);
    return hero;
  };
  const scatterTraffic = (cx, cz, count) => {
    let placed = 0;
    for (const t of G.traffic) {
      if (placed >= count) break;
      if (t.kind === 'parked') continue;
      t.mesh.position.set(cx + (Math.random() - 0.5) * 40, 0, cz + (Math.random() - 0.5) * 60);
      t.mesh.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
      t.userData.v = 8;
      placed++;
    }
  };

  if (n === 1) {
    // COVER: golden-hour drive down Ocean Drive, mission live, traffic, HUD.
    setTimeOfDay(G.city, 'sunset');
    putCarOnRoad(126, 60, Math.PI);
    G.carSpeed = 20;
    scatterTraffic(126, 20, 8);
    G.clockMin = 18 * 60 + 42;
    G.hud.toast('MISSION 1 · VELVET SUNRISE — get to the pink marker');
    G.snapCamera();
  } else if (n === 2) {
    // BEACH: on foot at the sand, palms, pier wheel, daytime, pedestrians.
    setTimeOfDay(G.city, 'day');
    G.player.position.set(162, 0, -64);
    G.player.rotation.y = Math.PI / 2;
    G.camYaw = Math.PI / 2; G.camPitch = 0.2;
    G.clockMin = 11 * 60 + 15;
    for (let i = 0; i < 6; i++) {
      const p = G.peds[i];
      p.mesh.position.set(152 + Math.random() * 14, 0, -82 + i * 9);
    }
    G.hud.toast('OCEAN DRIVE BEACH — Velvet Bay');
    G.snapCamera();
  } else if (n === 3) {
    // CHASE: 3 stars, night neon, VBPD cruisers right behind the player.
    setTimeOfDay(G.city, 'night');
    putCarOnRoad(0, 20, 0);
    G.carSpeed = 22;
    G.addWanted(3, 'Police chase!');
    G.clockMin = 22 * 60 + 10;
    for (let i = 0; i < 3; i++) {
      const c = spawnPoliceCar(scene, (i - 1) * 5, 34 + i * 7);
      c.mesh.rotation.y = 0;
      G.police.push(c);
    }
    scatterTraffic(0, -30, 5);
    G.hud.toast('WANTED ★★★ — lose the VBPD!');
    G.snapCamera();
  } else if (n === 4) {
    // MISSION: dusk on the pier, hostiles ahead, objective beacon burning.
    setTimeOfDay(G.city, 'dusk');
    G.missions.start(2);
    G.player.position.set(200, 2.0, 84); // pier deck top is y≈1.95
    G.player.rotation.y = Math.PI / 2;
    G.camYaw = Math.PI / 2; G.camPitch = 0.15;
    G.clockMin = 19 * 60 + 5;
    const spots = [[212, 76], [218, 90], [214, 94], [222, 80]];
    for (const [x, z] of spots) {
      const e = spawnEnemy(scene, x, z);
      e.mesh.position.y = 2.0; // stand on the pier deck, not under it
      G.enemies.push(e);
    }
    G.missions.setEnemies(G.enemies);
    G.hud.toast('MISSION 3 · PIER PRESSURE — clear the pier!');
    G.snapCamera();
  }
}
