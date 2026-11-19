// combat.js — fists and the pistol in SOLMAR HEAT.
// Shooting is hitscan: a ray from the camera through the crosshair, tested
// against pedestrians, cops, cars and buildings. Melee is a short-range arc.
// Kills and hits feed the wanted system through callbacks in main.js.
import * as THREE from 'three';
import { dist2D } from './utils.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.tracer = null; // line mesh shown briefly after a shot
    this.tracerTimer = 0;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.tracer.visible = false;
    scene.add(this.tracer);
  }

  // fire the pistol from the player toward the camera aim point.
  // Returns { hit, kind, target, point }.
  shoot(origin, dir, targets) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = 120;
    const meshes = [];
    for (const t of targets) {
      if (t.mesh) meshes.push(t.mesh);
      if (t.group) meshes.push(t.group);
    }
    const hits = this.raycaster.intersectObjects(meshes, true);
    let point = origin.clone().add(dir.clone().multiplyScalar(120));
    let hitTarget = null, kind = null;
    if (hits.length > 0) {
      point = hits[0].point.clone();
      let obj = hits[0].object;
      while (obj && !obj.userData.combatKind) obj = obj.parent;
      if (obj) { hitTarget = obj.userData.combatRef; kind = obj.userData.combatKind; }
    }
    // tracer line from the muzzle to the hit point
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, point.x, point.y, point.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerTimer = 0.07;
    return { hit: !!hitTarget, kind, target: hitTarget, point };
  }

  update(dt) {
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.visible = false;
    }
  }

  // melee punch: everything hostile/neutral within 2.2m in front of the player
  punch(playerPos, heading, peds, cops) {
    const hit = [];
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const test = (list, kind) => {
      for (const t of list) {
        const dx = t.pos.x - playerPos.x, dz = t.pos.z - playerPos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && (dx * fx + dz * fz) > 0) hit.push({ kind, target: t });
      }
    };
    test(peds, 'ped');
    test(cops, 'cop');
    return hit;
  }
}

// tag a THREE object tree so the raycaster can identify what was hit
export function tagCombat(obj, kind, ref) {
  obj.traverse((o) => { o.userData.combatKind = kind; o.userData.combatRef = ref; });
}
