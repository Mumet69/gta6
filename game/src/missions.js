// missions.js — DUSTLINE: the story. Four jobs for Rook Calloway, a getaway
// driver who owes the fixer Vera Kaine $5,000. Each mission has a briefing, a
// live objective, a glowing marker in the world, and a payday. Finish all
// four and the debt is cleared.

import * as THREE from '../vendor/three.module.min.js';
import { S, showMessage, setObjective } from './state.js';
import { makeRng, clamp, angleLerp } from './utils.js';
import { City } from './city.js';
import { nearestStealable, enterCar } from './vehicles.js';
import { makePersonMesh, panicNear } from './people.js';
import { addHeat, clearPolice } from './wanted.js';
import { givePistol } from './combat.js';
import { playMission, playPickup } from './audio.js';

export const MISSIONS = [
  {
    name: 'FIRST GEAR',
    brief: 'Vera Kaine owns your debt. First job: steal a car and bring it to the safehouse motel.',
    reward: 500,
  },
  {
    name: 'DESERT RUN',
    brief: 'A package waits at the Route 66 Diner. Deliver it to the Dustline Tower in 120 seconds — the client pays for speed.',
    reward: 800,
    timed: 120,
  },
  {
    name: 'DUST BRAWL',
    brief: 'Rivals jumped your crew at the motel. Put all four of them down. Fists work. A pistol works better.',
    reward: 1000,
  },
  {
    name: 'THE BIG SCORE',
    brief: 'The Dustline Bank. Grab the cash, then lose the heat and reach the safehouse with no wanted stars.',
    reward: 3000,
  },
];

let sceneRef = null;
let marker = null;
let markerLight = null;
let rivals = [];
let stage = 0;        // sub-stage inside the current mission
let stageTimer = 0;
let rng = makeRng(5);

export function initMissions(scene) {
  sceneRef = scene;
  // Glowing objective marker: a translucent beacon cylinder + a ring.
  marker = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 13;
  marker.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  marker.add(ring);
  markerLight = new THREE.PointLight(0xffd23a, 12, 30);
  markerLight.position.y = 3;
  marker.add(markerLight);
  marker.visible = false;
  scene.add(marker);
}

function placeMarker(x, z) {
  marker.position.set(x, 0, z);
  marker.visible = true;
}

function hideMarker() {
  marker.visible = false;
}

function distTo(x, z) {
  return Math.hypot(S.px - x, S.pz - z);
}

export function startMission(i) {
  const m = MISSIONS[i];
  if (!m) return;
  S.mission = i;
  S.missionState = 'active';
  stage = 0;
  stageTimer = 0;
  S.missionTimer = m.timed || 0;
  playMission();
  showMessage(m.name + ' — ' + m.brief, 5);
  // Mission-specific setup.
  if (i === 0) {
    setObjective('Steal a car (E near a car), then drive to the safehouse');
    placeMarker(City.landmarks.safehouse.x, City.landmarks.safehouse.z);
  } else if (i === 1) {
    setObjective('Pick up the package at the diner');
    placeMarker(City.landmarks.diner.x, City.landmarks.diner.z);
  } else if (i === 2) {
    setObjective('Go to the motel and deal with the rivals');
    placeMarker(City.landmarks.motel.x, City.landmarks.motel.z);
    givePistol(24);
  } else if (i === 3) {
    setObjective('Go to the Dustline Bank');
    placeMarker(City.landmarks.bank.x, City.landmarks.bank.z);
  }
}

function completeMission() {
  const m = MISSIONS[S.mission];
  S.cash += m.reward;
  S.stats.missionsDone++;
  showMessage(m.name + ' complete! +' + '$' + m.reward.toLocaleString('en-US'), 4);
  playPickup();
  hideMarker();
  S.missionState = 'done';
  S.missionTimer = 0;
  if (S.mission + 1 < MISSIONS.length) {
    startMission(S.mission + 1);
  } else {
    setObjective('Debt cleared. Dustline is yours — free roam!');
    showMessage('DEBT CLEARED! You own Dustline now.', 6);
  }
}

function failMission(reason) {
  showMessage('Mission failed: ' + reason + '. Try again.', 4);
  S.missionState = 'failed';
  S.missionTimer = 0;
  hideMarker();
  // Restart the same mission after a beat.
  stage = -1;
  stageTimer = 2.5;
}

function spawnRivals() {
  rivals = [];
  const base = City.landmarks.motel;
  for (let k = 0; k < 4; k++) {
    const mesh = makePersonMesh('ped');
    const x = base.x + (k - 1.5) * 4;
    const z = base.z + 14 + (k % 2) * 4;
    mesh.position.set(x, 0, z);
    sceneRef.add(mesh);
    rivals.push({ mesh, x, z, heading: 0, hp: 2, down: false, punchCd: 0 });
  }
}

export function updateMissions(dt) {
  if (!S.started || S.over) return;
  if (S.missionState === 'failed' && stage === -1) {
    stageTimer -= dt;
    if (stageTimer <= 0) startMission(S.mission);
    return;
  }
  if (S.missionState !== 'active') return;

  // Timed missions tick down.
  if (S.missionTimer > 0) {
    S.missionTimer -= dt;
    if (S.missionTimer <= 0) {
      failMission('Out of time');
      return;
    }
  }

  const m = S.mission;
  if (m === 0) {
    // Stage 0: steal a car. Stage 1: drive to the safehouse.
    if (stage === 0) {
      if (!S.onFoot) {
        stage = 1;
        setObjective('Drive to the safehouse motel');
        placeMarker(City.landmarks.safehouse.x, City.landmarks.safehouse.z);
      }
    } else if (distTo(City.landmarks.safehouse.x, City.landmarks.safehouse.z) < 9) {
      completeMission();
    }
  } else if (m === 1) {
    if (stage === 0) {
      if (distTo(City.landmarks.diner.x, City.landmarks.diner.z) < 7) {
        stage = 1;
        playPickup();
        showMessage('Package picked up. Deliver it to the Dustline Tower!', 3);
        setObjective('Deliver the package to the Dustline Tower');
        placeMarker(City.landmarks.tower.x, City.landmarks.tower.z);
      }
    } else if (distTo(City.landmarks.tower.x, City.landmarks.tower.z) < 9) {
      completeMission();
    }
  } else if (m === 2) {
    if (stage === 0) {
      if (distTo(City.landmarks.motel.x, City.landmarks.motel.z) < 12) {
        stage = 1;
        spawnRivals();
        setObjective('Put all 4 rivals down');
        showMessage('They jumped you! Fight!', 2.5);
      }
    } else {
      // Rivals chase and swing at the player.
      let alive = 0;
      for (const r of rivals) {
        if (r.down) continue;
        alive++;
        r.punchCd -= dt;
        const dx = S.px - r.x, dz = S.pz - r.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        r.heading = angleLerp(r.heading, want, clamp(5 * dt, 0, 1));
        if (d > 1.6) {
          r.x += Math.sin(r.heading) * 3.1 * dt;
          r.z += Math.cos(r.heading) * 3.1 * dt;
        } else if (r.punchCd <= 0) {
          r.punchCd = 0.9;
          S.health = Math.max(0, S.health - 8);
          if (S.health <= 0) { S.wasted = true; return; }
        }
        r.mesh.position.set(r.x, 0, r.z);
        r.mesh.rotation.y = r.heading;
      }
      if (alive === 0) completeMission();
    }
  } else if (m === 3) {
    if (stage === 0) {
      if (distTo(City.landmarks.bank.x, City.landmarks.bank.z) < 8) {
        stage = 1;
        stageTimer = 5;
        setObjective('Grabbing the cash… stay at the bank');
        showMessage('Cracking the vault…', 2);
      }
    } else if (stage === 1) {
      stageTimer -= dt;
      if (distTo(City.landmarks.bank.x, City.landmarks.bank.z) > 12) {
        stage = 0;
        setObjective('Go to the Dustline Bank');
        return;
      }
      if (stageTimer <= 0) {
        stage = 2;
        addHeat(55, 'Bank robbery');
        panicNear(S.px, S.pz, 50);
        setObjective('Lose the heat, then reach the safehouse');
        placeMarker(City.landmarks.safehouse.x, City.landmarks.safehouse.z);
        showMessage('Cash grabbed! Lose the cops, then get to the safehouse.', 4);
      }
    } else if (stage === 2) {
      if (S.wanted === 0 && distTo(City.landmarks.safehouse.x, City.landmarks.safehouse.z) < 9) {
        completeMission();
      }
    }
  }

  // Marker pulse.
  if (marker.visible) {
    const s = 1 + Math.sin(S.time * 4) * 0.12;
    marker.scale.set(s, 1, s);
  }
}

// A rival takes a hit (punch or bullet). Returns true if it went down.
export function hitRivalAt(px, pz, heading, maxDist, damage) {
  let best = null, bestD = maxDist;
  for (const r of rivals) {
    if (r.down) continue;
    const dx = r.x - px, dz = r.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(ang - heading);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 0.6) continue;
    bestD = d; best = r;
  }
  if (!best) return false;
  best.hp -= damage;
  if (best.hp <= 0) {
    best.down = true;
    best.mesh.rotation.x = -Math.PI / 2;
    best.mesh.position.y = 0.3;
    S.stats.pedsDown++;
  }
  return true;
}

export function rivalsAlive() {
  return rivals.filter(r => !r.down).length;
}
