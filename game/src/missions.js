// missions.js — the Velvet Bay story: Mara Voss owes fixer Cassius "Cash"
// Rowe $10,000. Six jobs pay it off. Each mission is a list of steps; a step
// is a drive-to, an interact (press E), a car steal, a timed run, or a
// collection with muscle to deal with.

export const DEBT_TOTAL = 10000;

export const LANDMARKS = {
  garage: { x: 87, z: -87, name: "Cash's Garage" },
  paintShop: { x: -145, z: 29, name: 'Spray & Go paint shop' },
  docks: { x: 262, z: 60, name: 'Docks 7 pickup' },
  safehouse: { x: -203, z: -203, name: 'Safehouse' },
  bank: { x: -29, z: -29, name: 'Meridian Bank' },
  motel: { x: -145, z: 232, name: 'Sunset Motel' },
  strip: { x: 64, z: 122, name: 'The Velvet Strip — gold sportscar' },
  raceGate: { x: 58, z: -58, name: 'Street race gate' },
  debtor1: { x: 145, z: 145, name: 'Debtor: Lou the bookie' },
  debtor2: { x: -87, z: 203, name: 'Debtor: Faye the dealer' },
  debtor3: { x: 203, z: -145, name: 'Debtor: Rex the promoter' },
  motel: { x: -145, z: 232, name: 'Sunset Motel — a front for sale' },
  warehouse: { x: 203, z: 87, name: 'Docks Warehouse — a front for sale' },
  palms: { x: 116, z: 174, name: 'Neon Palms Club — a front for sale' },
  heights: { x: -203, z: -203, name: 'The Heights — Vipers turf' },
  downtownTurf: { x: 0, z: 0, name: 'Downtown turf flag' },
  stripTurf: { x: 64, z: 122, name: 'The Strip turf flag' },
  vault: { x: -29, z: -29, name: 'Meridian Bank vault' },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'HOT WHEELS',
    briefing: 'Cash needs a clean car. Steal one and bring it to the paint shop.',
    reward: 1000,
    steps: [
      { type: 'stealCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', text: 'Bring the car to the Spray & Go paint shop', marker: LANDMARKS.paintShop, radius: 9, requireCar: true },
    ],
  },
  {
    id: 2,
    title: 'DOCKSIDE PICKUP',
    briefing: 'A package is waiting at Docks 7. Pick it up and deliver it to Cash.',
    reward: 1300,
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
    reward: 1500,
    setupWanted: 2,
    steps: [
      { type: 'timed', text: 'Reach the safehouse in 90 seconds — do not get busted', marker: LANDMARKS.safehouse, radius: 10, timeLimit: 90 },
    ],
  },
  {
    id: 4,
    title: 'COLLECT THE DEBTS',
    briefing: 'Three deadbeats owe Cash. Visit each one and collect — their muscle will object.',
    reward: 1700,
    steps: [
      { type: 'collect', text: 'Collect from Lou the bookie — press E at the marker', marker: LANDMARKS.debtor1, radius: 7 },
      { type: 'collect', text: 'Collect from Faye the dealer — press E at the marker', marker: LANDMARKS.debtor2, radius: 7 },
      { type: 'collect', text: 'Collect from Rex the promoter — press E at the marker', marker: LANDMARKS.debtor3, radius: 7 },
    ],
  },
  {
    id: 5,
    title: 'THE STRIP HEIST',
    briefing: 'A gold sportscar is parked on the Velvet Strip. Take it — its owner will send muscle — and deliver it to Cash.',
    reward: 1500,
    steps: [
      { type: 'goto', text: 'Get to the gold sportscar on the Velvet Strip', marker: LANDMARKS.strip, radius: 10 },
      { type: 'stealSport', text: 'Steal the gold sportscar — press E at the car', marker: LANDMARKS.strip, radius: 6 },
      { type: 'goto', text: "Deliver the sportscar to Cash's Garage", marker: LANDMARKS.garage, radius: 9, requireCar: true },
    ],
  },
  {
    id: 6,
    title: 'THE BIG SCORE',
    briefing: 'Hit the Meridian Bank vault, then lose the heat at the safehouse. This clears most of the debt.',
    reward: 2000,
    steps: [
      { type: 'goto', text: 'Drive to Meridian Bank', marker: LANDMARKS.bank, radius: 10 },
      { type: 'interact', text: 'Grab the vault cash — press E at the vault', marker: LANDMARKS.bank, radius: 6, prompt: 'Press E to grab the vault cash', onInteractWanted: 3 },
      { type: 'goto', text: 'Escape to the safehouse — lose the cops', marker: LANDMARKS.safehouse, radius: 10 },
    ],
  },
  {
    id: 7,
    title: 'EMPIRE RISING',
    briefing: 'Cash is almost paid. Now buy a front, take two districts from the Vipers and prove the bay is yours.',
    reward: 500,
    steps: [
      { type: 'buyBusiness', text: 'Buy a front — press E at a For Sale marker', marker: LANDMARKS.motel, radius: 7, prompt: 'Press E to buy this front' },
      { type: 'turf', text: 'Take 2 districts — press E at a turf flag, beat the muscle', marker: LANDMARKS.downtownTurf, radius: 7, prompt: 'Press E to start a turf war' },
      { type: 'goto', text: "Report back to Cash's Garage", marker: LANDMARKS.garage, radius: 9 },
    ],
  },
  {
    id: 8,
    title: 'THE VELVET VAULT',
    briefing: 'One last job: case the bank, steal a getaway car, recruit a crew — then hold the vault floor until the crew cracks it.',
    reward: 500,
    setupWanted: 0,
    steps: [
      { type: 'prep', text: 'Heist prep 1/3: scout Meridian Bank — press E', marker: LANDMARKS.bank, radius: 7, prompt: 'Press E to scout the bank', prepId: 'scout' },
      { type: 'prep', text: 'Heist prep 2/3: steal a getaway sportscar', marker: LANDMARKS.garage, radius: 7, prompt: 'Press E to ready the getaway car', prepId: 'getaway' },
      { type: 'prep', text: 'Heist prep 3/3: recruit a crew at the Sunset Motel', marker: LANDMARKS.motel, radius: 7, prompt: 'Press E to recruit the crew', prepId: 'crew' },
      // The holdout only starts once Mara is standing on the vault floor:
      // the step before it drives her there, so the timer never runs
      // while she is still across the city.
      { type: 'goto', text: 'Get to the Meridian Bank vault', marker: LANDMARKS.vault, radius: 12 },
      { type: 'holdout', text: 'Hold the vault floor for 45 seconds — the crew is cracking it', marker: LANDMARKS.vault, radius: 12, timeLimit: 45 },
      { type: 'goto', text: 'Escape to the safehouse — the debt is done', marker: LANDMARKS.safehouse, radius: 10 },
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
    this._sportTaken = false;
    this.state.missionIndex = index;
    this.state.missionActive = true;
    if (m.setupWanted) this.world.setWanted(m.setupWanted);
    // The Strip Heist parks its prize: a gold sportscar waiting on the Strip.
    if (m.id === 5 && this.world.spawnSportscar) this.world.spawnSportscar(LANDMARKS.strip.x, LANDMARKS.strip.z);
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
    if (!s || (s.type !== 'interact' && s.type !== 'collect' && s.type !== 'prep')) return false;
    const d = Math.hypot(playerPos.x - s.marker.x, playerPos.z - s.marker.z);
    // Markers sit at block centres, where a building may stand: the player
    // is pushed to the building's edge, up to ~16 m out, so the press
    // reaches 10 m past the step's radius instead of just 2.
    if (d > s.radius + 10) return false;
    if (s.type === 'prep') {
      // The story step finishes its own prep id directly: the motel marker
      // is also a business for sale, so routing through the empire first
      // would sell Mara a front when she only meant to recruit a crew.
      if (!this.state.empire.prep[s.prepId]) {
        this.state.empire.prep[s.prepId] = true;
        this.state.stats.prepDone = (this.state.stats.prepDone || 0) + 1;
        this.world.addRespect(1);
      }
      this.completeStep();
      return true;
    }
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
      if (s.type === 'timed' || s.type === 'holdout') this.timeLeft = s.timeLimit;
      if (s.type === 'holdout') {
        // The vault floor: muscle pours in while the crew cracks the safe.
        this.world.spawnGang(s.marker.x, s.marker.z, 3);
        this.world.banner('HOLD THE FLOOR', '45 seconds — the crew is cracking the vault!');
      }
    }
  }

  completeMission() {
    const m = this.current;
    this.world.addMoney(m.reward);
    this.world.addRespect(2);
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
    } else if (s.type === 'stealSport') {
      // The Strip Heist: only the gold sportscar counts, and taking it brings muscle.
      if (ctx.inCar && ctx.car && ctx.car.stolen && ctx.car.model === 'sport') {
        if (!this._sportTaken) {
          this._sportTaken = true;
          this.world.spawnGang(s.marker.x, s.marker.z, 2);
          this.world.banner('THE OWNER NOTICED', 'His muscle is coming — drive!');
        }
        this.completeStep();
      }
    } else if (s.type === 'goto' || s.type === 'interact') {
      // A delivery step only counts in the car: walking to the drop-off with
      // no car is not delivering it.
      if (s.type === 'goto' && s.requireCar && !ctx.inCar) {
        // wait for the player to get back in a car
      } else if (s.type === 'goto' && dist(s.marker) <= s.radius) this.completeStep();
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
    } else if (s.type === 'buyBusiness') {
      // A front counts the moment Mara owns any of them.
      const owned = this.world.empire ? this.world.empire.ownedCount : 0;
      if (owned >= 1) this.completeStep();
    } else if (s.type === 'turf') {
      // Two districts under Mara's flag finishes the step.
      const held = this.world.empire ? this.world.empire.maraTurf : 0;
      if (held >= 2) this.completeStep();
    } else if (s.type === 'prep') {
      // Done via tryInteract (E at the marker) or the empire marker itself.
      if (this.state.empire.prep[s.prepId]) this.completeStep();
    } else if (s.type === 'holdout') {
      this.timeLeft -= dt;
      if (dist(s.marker) > s.radius + 8) {
        this.failMission('You left the vault floor — the crew scattered. Try again.');
      } else if (this.timeLeft <= 0) {
        this.world.addMoney(400);
        this.world.setWanted(3);
        this.world.banner('VAULT CRACKED', '+$400 in the bag — now run!');
        this.completeStep();
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
