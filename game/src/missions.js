// missions.js — the Velvet Bay story: Mara Voss owes fixer Cassius "Cash"
// Rowe $8,000. Five jobs pay it off. Each mission is a list of steps; a step
// is a drive-to, an interact (press E), a car steal, a timed run, or a
// collection with muscle to deal with.

export const DEBT_TOTAL = 8000;

export const LANDMARKS = {
  garage: { x: 87, z: -87, name: "Cash's Garage" },
  paintShop: { x: -145, z: 29, name: 'Spray & Go paint shop' },
  docks: { x: 262, z: 60, name: 'Docks 7 pickup' },
  safehouse: { x: -203, z: -203, name: 'Safehouse' },
  bank: { x: -29, z: -29, name: 'Meridian Bank' },
  motel: { x: -145, z: 232, name: 'Sunset Motel' },
  debtor1: { x: 145, z: 145, name: 'Debtor: Lou the bookie' },
  debtor2: { x: -87, z: 203, name: 'Debtor: Faye the dealer' },
  debtor3: { x: 203, z: -145, name: 'Debtor: Rex the promoter' },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'HOT WHEELS',
    briefing: 'Cash needs a clean car. Steal one and bring it to the paint shop.',
    reward: 1200,
    steps: [
      { type: 'stealCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', text: 'Bring the car to the Spray & Go paint shop', marker: LANDMARKS.paintShop, radius: 9 },
    ],
  },
  {
    id: 2,
    title: 'DOCKSIDE PICKUP',
    briefing: 'A package is waiting at Docks 7. Pick it up and deliver it to Cash.',
    reward: 1500,
    steps: [
      { type: 'goto', text: 'Drive to the Docks 7 pickup point', marker: LANDMARKS.docks, radius: 10 },
      { type: 'interact', text: 'Grab the package — press E at the crate', marker: LANDMARKS.docks, radius: 6, prompt: 'Press E to grab the package' },
      { type: 'goto', text: "Deliver the package to Cash's Garage", marker: LANDMARKS.garage, radius: 9 },
    ],
  },
  {
    id: 3,
    title: 'HEAT RUN',
    briefing: 'The cops are onto the drop. Lose them at the safehouse — fast.',
    reward: 1800,
    setupWanted: 2,
    steps: [
      { type: 'timed', text: 'Reach the safehouse in 90 seconds — do not get busted', marker: LANDMARKS.safehouse, radius: 10, timeLimit: 90 },
    ],
  },
  {
    id: 4,
    title: 'COLLECT THE DEBTS',
    briefing: 'Three deadbeats owe Cash. Visit each one and collect — their muscle will object.',
    reward: 2000,
    steps: [
      { type: 'collect', text: 'Collect from Lou the bookie — press E at the marker', marker: LANDMARKS.debtor1, radius: 7 },
      { type: 'collect', text: 'Collect from Faye the dealer — press E at the marker', marker: LANDMARKS.debtor2, radius: 7 },
      { type: 'collect', text: 'Collect from Rex the promoter — press E at the marker', marker: LANDMARKS.debtor3, radius: 7 },
    ],
  },
  {
    id: 5,
    title: 'THE BIG SCORE',
    briefing: 'Hit the Meridian Bank vault, then lose the heat at the safehouse. This clears the debt.',
    reward: 3000,
    steps: [
      { type: 'goto', text: 'Drive to Meridian Bank', marker: LANDMARKS.bank, radius: 10 },
      { type: 'interact', text: 'Grab the vault cash — press E at the vault', marker: LANDMARKS.bank, radius: 6, prompt: 'Press E to grab the vault cash', onInteractWanted: 3 },
      { type: 'goto', text: 'Escape to the safehouse — lose the cops', marker: LANDMARKS.safehouse, radius: 10 },
    ],
  },
];

export class MissionManager {
  constructor(state, world) {
    this.state = state;
    this.world = world; // { banner, addMoney, setWanted, spawnGang, playSound }
    this.current = null;
    this.stepIndex = 0;
    this.timeLeft = 0;
    this.collectSpawned = false;
    this.allDone = false;
  }

  get mission() {
    return this.current;
  }

  get step() {
    return this.current ? this.current.steps[this.stepIndex] : null;
  }

  start(index) {
    const m = MISSIONS[index];
    if (!m) return false;
    this.current = m;
    this.stepIndex = 0;
    this.timeLeft = 0;
    this.collectSpawned = false;
    this.state.missionIndex = index;
    this.state.missionActive = true;
    if (m.setupWanted) this.world.setWanted(m.setupWanted);
    this.world.banner(m.title, m.briefing);
    return true;
  }

  startNext() {
    const next = this.state.missionsDone;
    if (next >= MISSIONS.length) {
      this.allDone = true;
      this.current = null;
      this.state.missionActive = false;
      return false;
    }
    return this.start(next);
  }

  // The player pressed E near a marker.
  tryInteract(playerPos) {
    const s = this.step;
    if (!s || (s.type !== 'interact' && s.type !== 'collect')) return false;
    const d = Math.hypot(playerPos.x - s.marker.x, playerPos.z - s.marker.z);
    if (d > s.radius + 2) return false;
    if (s.onInteractWanted) this.world.setWanted(s.onInteractWanted);
    if (s.type === 'collect') {
      this.world.addMoney(150);
      this.world.banner('Collected $150', s.marker.name + ' paid up.');
    }
    this.completeStep();
    return true;
  }

  completeStep() {
    this.stepIndex++;
    this.collectSpawned = false;
    this.timeLeft = 0;
    if (this.stepIndex >= this.current.steps.length) {
      this.completeMission();
    } else {
      const s = this.step;
      if (s.type === 'timed') this.timeLeft = s.timeLimit;
    }
  }

  completeMission() {
    const m = this.current;
    this.world.addMoney(m.reward);
    this.state.missionsDone++;
    this.state.stats.missionsDone++;
    this.world.playSound('missionDone');
    this.state.debt = Math.max(0, this.state.debt - m.reward);
    this.world.banner('JOB DONE — ' + m.title, '+' + m.reward + '  •  Debt left: $' + this.state.debt);
    if (this.state.debt <= 0) {
      this.allDone = true;
      this.current = null;
      this.state.missionActive = false;
      this.world.onDebtPaid();
      return;
    }
    this.current = null;
    this.state.missionActive = false;
    // Next job unlocks after a beat (main.js polls startNext).
    this.world.nextMissionIn(2.5);
  }

  failMission(reason) {
    const m = this.current;
    this.world.banner('JOB FAILED', reason);
    this.current = null;
    this.state.missionActive = false;
    this.world.nextMissionIn(3);
  }

  update(dt, ctx) {
    const s = this.step;
    if (!s || !this.current) return;
    const p = ctx.playerPos;
    const dist = (marker) => Math.hypot(p.x - marker.x, p.z - marker.z);
    if (s.type === 'stealCar') {
      if (ctx.inCar && ctx.car && ctx.car.stolen) this.completeStep();
    } else if (s.type === 'goto' || s.type === 'interact') {
      if (s.type === 'goto' && dist(s.marker) <= s.radius) this.completeStep();
    } else if (s.type === 'timed') {
      this.timeLeft -= dt;
      if (dist(s.marker) <= s.radius) {
        this.completeStep();
      } else if (this.timeLeft <= 0) {
        this.failMission('Too slow — the trail went cold. Try again.');
        // The job restarts via nextMissionIn (missionsDone still points at it).
      }
    } else if (s.type === 'collect') {
      if (!this.collectSpawned && dist(s.marker) <= s.radius + 6) {
        this.collectSpawned = true;
        this.world.spawnGang(s.marker.x, s.marker.z, 1);
        this.world.banner('Muscle!', 'Deal with the goon, then press E to collect.');
      }
    }
  }

  objective() {
    if (!this.current || !this.step) {
      if (this.allDone) return { text: 'Debt paid — Velvet Bay is yours. Free roam!', marker: null, dist: 0, timeLeft: 0 };
      return { text: 'Head to the next job…', marker: null, dist: 0, timeLeft: 0 };
    }
    const s = this.step;
    const marker = s.marker || null;
    const dist = marker ? Math.round(Math.hypot(this._px - marker.x, this._pz - marker.z)) : 0;
    return { text: s.text, marker, dist, timeLeft: this.timeLeft, prompt: s.prompt || null };
  }

  // Called by main.js every frame so objective() can report distance.
  setPlayerPos(x, z) {
    this._px = x; this._pz = z;
  }
}
