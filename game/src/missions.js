// missions.js — the SOLMAR HEAT story campaign: four jobs for the crew.
// Each mission is a chain of stages with a target point in the city; reaching
// it advances the stage. The manager owns the objective beacon, the rival
// gang members for the combat mission, and the hold-to-grab timer at the bank.
import * as THREE from 'three';
import { dist2D, clamp } from './utils.js';
import { makePersonMesh, animateWalk } from './people.js';

// Mission data — all original: Rio Vega, the Solmar crew, the Vipers gang.
export const MISSIONS = [
  {
    id: 'first-gear', title: 'FIRST GEAR', reward: 500,
    intro: 'Mara: "Rio, you are back. We need wheels. Steal any car and bring it to the Marina."',
    stages: [
      { title: 'FIRST GEAR', desc: 'Steal a car — walk up to one and press E.', target: null, needCar: true },
      { title: 'FIRST GEAR', desc: 'Drive to the Marina Docks.', target: 'marina', radius: 10 },
    ],
  },
  {
    id: 'package-run', title: 'PACKAGE RUN', reward: 800,
    intro: 'Mara: "Package at the safehouse. Hospital needs it in 100 seconds. No excuses."',
    stages: [
      { title: 'PACKAGE RUN', desc: 'Pick up the package at the safehouse.', target: 'safehouse', radius: 8 },
      { title: 'PACKAGE RUN', desc: 'Deliver the package to Solmar General — fast!', target: 'hospital', radius: 10, timer: 100 },
    ],
  },
  {
    id: 'street-sweep', title: 'STREET SWEEP', reward: 1200,
    intro: 'Dante: "The Vipers took our corner at the docks. Take it back. All four of them."',
    stages: [
      { title: 'STREET SWEEP', desc: 'Go to the Marina Docks.', target: 'marina', radius: 14 },
      { title: 'STREET SWEEP', desc: 'Take out all 4 Vipers. 0 / 4 down.', target: 'marina', radius: 30, kills: 4 },
    ],
  },
  {
    id: 'solmar-job', title: 'THE SOLMAR JOB', reward: 5000,
    intro: 'Mara: "The big one. Solmar First Bank. Grab the cash, then lose the cops at the safehouse."',
    stages: [
      { title: 'THE SOLMAR JOB', desc: 'Get to Solmar First Bank.', target: 'bank', radius: 12 },
      { title: 'THE SOLMAR JOB', desc: 'Hold position inside the bank to grab the cash.', target: 'bank', radius: 8, hold: 5 },
      { title: 'THE SOLMAR JOB', desc: 'Escape to the safehouse — the whole PD is coming.', target: 'safehouse', radius: 10 },
    ],
  },
];

export class MissionManager {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.active = null; // { def, stage, timer, holdProgress, kills }
    this.gang = []; // rival gang members for STREET SWEEP
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(4, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  start(index, ctx) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.active = { def, stage: 0, timer: 0, holdProgress: 0, kills: 0 };
    ctx.onToast(def.intro);
    ctx.onMissionStart(def);
    return true;
  }

  currentStage() { return this.active ? this.active.def.stages[this.active.stage] : null; }

  targetPos() {
    const s = this.currentStage();
    if (!s || !s.target) return null;
    const lm = this.landmarks[s.target];
    return lm ? { x: lm.x, z: lm.z } : null;
  }

  // called when a gang member is killed by the player
  onGangKill(ctx) {
    if (!this.active || this.active.def.id !== 'street-sweep') return;
    const stage = this.currentStage();
    if (!stage || !stage.kills) return;
    this.active.kills++;
    ctx.onToast(`Viper down — ${this.active.kills} / ${stage.kills}`);
    if (this.active.kills >= stage.kills) this.advance(ctx);
  }

  advance(ctx) {
    this.active.stage++;
    if (this.active.stage >= this.active.def.stages.length) {
      const def = this.active.def;
      ctx.onCash(def.reward);
      ctx.onMissionComplete(def);
      this.active = null;
      this.clearGang();
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    const s = this.currentStage();
    if (s.timer) this.active.timer = s.timer;
    if (s.kills) this.spawnGang(ctx);
  }

  spawnGang(ctx) {
    this.clearGang();
    const m = this.landmarks.marina;
    // Vipers hold the pier / open waterfront west of the marina block, never
    // inside a building: x in [-184,-178], z in [138,168].
    for (let i = 0; i < 4; i++) {
      const mesh = makePersonMesh(0x8a1a2a, 0xe8b88a, false);
      const x = m.x - 8 + (i % 2) * 6;
      const z = m.z - 16 + i * 10;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.gang.push({ mesh, pos: mesh.position, heading: 0, speed: 3.2, health: 2, walkPhase: i, attackCd: 0 });
    }
    ctx.onToast('The Vipers are here. Take them out!');
  }

  clearGang() {
    for (const g of this.gang) this.scene.remove(g.mesh);
    this.gang = [];
  }

  update(dt, ctx) {
    // beacon + ring follow the current objective
    const tp = this.targetPos();
    if (tp && this.active) {
      this.beacon.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(tp.x, 30, tp.z);
      this.ring.position.set(tp.x, 0.15, tp.z);
      this.beacon.rotation.y += dt * 0.8;
      const pulse = 0.22 + Math.sin(ctx.time * 3) * 0.08;
      this.beacon.material.opacity = pulse;
    } else {
      this.beacon.visible = false;
      this.ring.visible = false;
    }
    if (!this.active) return;
    const s = this.currentStage();
    const p = ctx.playerPos;
    // stage timer (PACKAGE RUN delivery)
    if (s.timer) {
      this.active.timer -= dt;
      if (this.active.timer <= 0) {
        ctx.onToast('Too slow — the package run failed. Try again from the safehouse.');
        ctx.onMissionFailed(this.active.def);
        this.active = null;
        this.clearGang();
        return;
      }
    }
    // need a car stage: complete once the player has a car or has stolen one
    if (s.needCar) {
      if (ctx.inCar || (ctx.carsStolen || 0) > 0) this.advance(ctx);
      return;
    }
    if (!tp) return;
    const d = dist2D(p.x, p.z, tp.x, tp.z);
    // hold-to-grab stage (bank vault)
    if (s.hold) {
      if (d < s.radius) {
        this.active.holdProgress += dt;
        if (this.active.holdProgress >= s.hold) {
          ctx.onToast('Cash grabbed! The alarms are screaming — RUN!');
          ctx.onWanted(55); // jump to 3 stars
          this.advance(ctx);
        }
      } else {
        this.active.holdProgress = Math.max(0, this.active.holdProgress - dt);
      }
      return;
    }
    if (s.kills) return; // kills stage advances via onGangKill
    if (d < (s.radius || 10)) this.advance(ctx);
  }

  // gang members chase and punch the player
  updateGang(dt, ctx) {
    for (const g of this.gang) {
      const p = ctx.playerPos;
      const d = dist2D(g.pos.x, g.pos.z, p.x, p.z);
      const want = Math.atan2(p.x - g.pos.x, p.z - g.pos.z);
      g.heading += (want - g.heading) * Math.min(1, dt * 4);
      if (d > 2) {
        g.pos.x += Math.sin(g.heading) * g.speed * dt;
        g.pos.z += Math.cos(g.heading) * g.speed * dt;
        g.walkPhase += dt * g.speed * 2;
      } else {
        g.attackCd -= dt;
        if (g.attackCd <= 0) {
          g.attackCd = 1.1;
          ctx.onDamage(8, 'Viper');
        }
      }
      g.mesh.rotation.y = g.heading;
      animateWalk(g.mesh, g.walkPhase, 0.6);
    }
  }

  // damage a gang member (bullet or punch); returns true if killed
  hitGang(g, dmg, ctx) {
    g.health -= dmg;
    if (g.health <= 0) {
      this.scene.remove(g.mesh);
      this.gang.splice(this.gang.indexOf(g), 1);
      this.onGangKill(ctx);
      return true;
    }
    return false;
  }
}
