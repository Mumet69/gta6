// missions.js — the story: four jobs for Vera Kaine's crew.
// Jax Moreno owes the crew $5,000. Each job pays cash and moves the story
// forward; the last one is the big score — rob the Harbor Bank, then lose a
// 3-star wanted level by reaching the safehouse. A mission has a target
// marker in the world and on the minimap; standing in the marker completes a
// step. Some missions have a timer.
import { G } from './state.js';
import { dist2d, moneyString } from './utils.js';

export const MISSIONS = [
  {
    id: 'first-gear',
    title: 'FIRST GEAR',
    brief: 'Vera needs a car. Steal any car and bring it to the garage at the safehouse.',
    reward: 500,
    steps: [
      { text: 'Steal a car (press E near one)', check: (g) => g.player.inCar, onDone: 'Nice wheels. Now bring it to the safehouse garage.' },
      { text: 'Deliver the car to the safehouse', marker: 'safehouse', radius: 10, onDone: 'First job done. Vera is impressed.' },
    ],
  },
  {
    id: 'harbour-run',
    title: 'HARBOUR RUN',
    brief: 'A package for the port, and the clock is ticking. Get it to the docks in 100 seconds.',
    reward: 800,
    timer: 100,
    steps: [
      { text: 'Get in a car', check: (g) => g.player.inCar, onDone: 'Drive! The port is east, by the beach.' },
      { text: 'Deliver the package to the port', marker: 'port', radius: 12, onDone: 'Delivered with time to spare. Vera pays up.' },
    ],
  },
  {
    id: 'dock-brawl',
    title: 'DOCK BRAWL',
    brief: 'A rival crew is shaking down the marina. Go there and knock out 4 of them. Fists or pistol — your call.',
    reward: 1200,
    steps: [
      { text: 'Go to the marina', marker: 'marina', radius: 12, onDone: 'They are here. Take down 4 rivals!', spawnRivals: true },
      { text: 'Knock out 4 rivals (0/4)', check: (g) => (g.mission.rivalsDown || 0) >= 4, onDone: 'The marina is ours again.' },
    ],
  },
  {
    id: 'big-score',
    title: 'THE BIG SCORE',
    brief: 'The Harbor Bank. Grab the cash, then lose the heat — reach the safehouse with no wanted stars.',
    reward: 2500,
    steps: [
      { text: 'Go to the Harbor Bank', marker: 'bank', radius: 10, onDone: 'Grab the cash! (alarms going off)', giveCash: 2500, setWanted: 3 },
      { text: 'Lose the heat: reach the safehouse with 0 stars', marker: 'safehouse', radius: 10, needWanted: 0, onDone: 'Clean getaway. The debt is paid — you are free.' },
    ],
  },
];

export function startMission(index) {
  const def = MISSIONS[index];
  if (!def) return false;
  G.mission = {
    def,
    index,
    step: 0,
    timer: def.timer || 0,
    rivalsDown: 0,
    rivals: [],
    failed: false,
  };
  G.missionTimer = def.timer || 0;
  if (G.onMissionStart) G.onMissionStart(def);
  return true;
}

export function currentStep() {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function missionMarkerPos() {
  const step = currentStep();
  if (!step || !step.marker) return null;
  const lm = G.city.landmarks[step.marker];
  return lm ? { x: lm.pos.x, z: lm.pos.z, name: lm.name } : null;
}

export function updateMissions(dt) {
  if (!G.mission || G.mode !== 'playing') return;
  const m = G.mission;
  const step = currentStep();
  if (!step) {
    completeMission();
    return;
  }
  // Timer missions.
  if (m.def.timer) {
    m.timer -= dt;
    G.missionTimer = m.timer;
    if (m.timer <= 0) {
      failMission('Out of time.');
      return;
    }
  }
  // Step completion.
  let done = false;
  if (step.check) {
    done = step.check(G);
  } else if (step.marker) {
    const lm = G.city.landmarks[step.marker];
    if (lm) {
      const d = dist2d(G.player.pos.x, G.player.pos.z, lm.pos.x, lm.pos.z);
      const needWanted = step.needWanted;
      done = d < step.radius && (needWanted === undefined || G.wanted === needWanted);
    }
  }
  if (!done) return;
  // Step effects.
  if (step.giveCash) {
    G.cash += step.giveCash;
    if (G.onCash) G.onCash(step.giveCash, 'bank loot');
  }
  if (step.setWanted !== undefined && G.setWantedExternal) {
    G.setWantedExternal(step.setWanted);
  }
  if (step.spawnRivals && G.spawnRivalsExternal) {
    G.spawnRivalsExternal(4);
  }
  if (step.onDone && G.onMissionStep) G.onMissionStep(step.onDone);
  m.step += 1;
  if (m.step >= m.def.steps.length) completeMission();
}

function completeMission() {
  const m = G.mission;
  G.cash += m.def.reward;
  G.missionsDone += 1;
  G.missionIndex += 1;
  if (G.onMissionComplete) G.onMissionComplete(m.def, m.def.reward);
  G.mission = null;
  G.missionTimer = 0;
  // Chain the next mission after a short breather (main.js starts it).
  if (G.missionIndex < MISSIONS.length && G.onMissionChain) {
    G.onMissionChain(G.missionIndex);
  }
}

function failMission(why) {
  const m = G.mission;
  G.mission = null;
  G.missionTimer = 0;
  if (G.onMissionFail) G.onMissionFail(m.def, why);
}

export function missionProgressText() {
  const m = G.mission;
  if (!m) return '';
  const step = currentStep();
  if (!step) return '';
  let text = step.text;
  if (m.def.id === 'dock-brawl' && m.step === 1) {
    text = `Knock out 4 rivals (${m.rivalsDown || 0}/4)`;
  }
  return text;
}
