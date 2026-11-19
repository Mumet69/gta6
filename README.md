# NEON HARBOR — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumet69/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumet69/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**NEON HARBOR** is an original open-world crime game built for make.fun's
gta6-01 bounty ("Make GTA 6"). You are **Jax Moreno**, getaway driver in
**Neon Harbor**, a sun-soaked port city. You owe Vera Kaine's crew $5,000.
Steal cars, run jobs, dodge the Harbor PD — and pull off the big score.

## Play

Serve `game/` with any static server and open `index.html` in desktop Chrome
(or run `node serve.ts` and open http://localhost:8080). No network requests,
no build step. Keyboard + mouse.

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Sprint |
| E | Steal / enter / exit car |
| Mouse | Look (click the game to lock the pointer) |
| Click | Shoot pistol (press 2 to draw it) |
| F | Punch |
| R | Reload |
| Space | Jump |
| P | Pause (save from the pause menu) |
| M | Next job / mute |
| C | Switch camera |

## Systems

- **Open city** — a procedural seeded grid city: roads, windowed buildings,
  palms, streetlights, a beach and ocean, and landmarks (Harbor Bank, Police
  HQ, Hospital, Safehouse, Marina, Port with cranes).
- **On foot + driving** — arcade car physics, traffic AI that follows the
  road grid, parked cars to steal.
- **Pedestrians** — they stroll the sidewalks and flee from gunfire and
  speeding cars.
- **Wanted 0–5 stars** — crimes add heat; the Harbor PD sends pursuit cars
  and foot cops; heat decays when you lay low. Get caught and you're busted.
- **Combat** — fists and pistol, reload, bullet tracers, damage, health
  pickups.
- **Missions + story** — 4 jobs for Vera's crew: FIRST GEAR (steal and
  deliver a car), HARBOUR RUN (100-second delivery), DOCK BRAWL (knock out
  4 rivals), THE BIG SCORE (rob the bank, lose the heat, reach the safehouse).
- **HUD** — health, cash, wanted stars, clock, objectives, speed, weapon and
  ammo, and a live circular minimap with the mission marker.
- **Start screen + pause + saves** — localStorage saves and autosaves when a
  mission completes.
- **Pickups, particles, screen effects** — health, ammo and cash pickups
  scattered around the city.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots,
  punches, cash chimes, and a bass music loop. No audio files.

## Tech

Three.js r160 (vendored under `game/vendor/`), plain ES modules, no build
step. Every file the game loads lives under `game/`. The city is seeded, so
the same seed always builds the same Neon Harbor.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
