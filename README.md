# SOLMAR HEAT — an open-world crime game

**SOLMAR HEAT** is an original open-world crime game built for make.fun's
gta6-01 bounty ("Make GTA 6"). You are **Rio Vega**, getaway driver in
**Solmar City**, a sun-soaked coastal town. Steal cars, outrun the Solmar PD,
run jobs for the crew, and build your name from nothing to legend.

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
| M | Mute |
| C | Switch camera |

## Systems

- **Open city** — a procedural grid city (seeded, identical every load): roads,
  buildings with painted facades, palms, streetlights, a beach and ocean,
  and landmarks: Solmar First Bank, Solmar PD HQ, Solmar General hospital,
  Rio's safehouse, Marina Docks.
- **On foot and by car** — third-person walking with jump, plus arcade driving
  with steering, braking, collisions and wheel spin.
- **Traffic and pedestrians** — ambient cars cruise the road grid and turn at
  intersections; pedestrians stroll the sidewalks and flee from danger.
- **Car stealing** — walk up to any parked or traffic car and press E. The
  driver bails out; stealing in view of the police raises your wanted level.
- **Wanted level and police** — 0–5 stars. Crimes add heat; police cars chase
  and ram, on-foot cops try to arrest you. Hide and the heat decays. Get
  caught and you are BUSTED; die and you are WASTED (cash penalty, respawn).
- **Missions and story** — four jobs: FIRST GEAR (steal a car, reach the
  Marina), PACKAGE RUN (deliver against the clock), STREET SWEEP (take out
  the four Vipers at the docks), THE SOLMAR JOB (rob the bank, escape a
  3-star manhunt). Gold beacons mark objectives; a minimap tracks them.
- **Combat** — fists and a hitscan pistol with tracers, ammo and reload.
- **HUD with minimap** — health, cash, wanted stars, in-game clock, mission
  objective with distance, speed, weapon, and a live rotating minimap.
- **Start screen and save** — New Game / Continue from the title; progress
  (cash, missions, health, position) saves to localStorage, auto-saves on job
  completion and every minute.
- **Polish** — synthesized WebAudio sound (engine hum, sirens, gunshots,
  pickups, mission jingles, a bassline music loop), particles, screen shake,
  damage vignette, day clock, and cash/health/ammo pickups scattered around
  the city.

## Tech

- Three.js r160 (vendored as `game/vendor/three.module.min.js`, MIT).
- Everything else is original code in `game/src/`, one job per file:
  `main.js` (loop + wiring), `city.js` (procedural city), `vehicles.js`
  (cars, traffic, police), `people.js` (player, pedestrians),
  `wanted.js` (wanted system), `combat.js` (shooting, melee),
  `missions.js` (story jobs), `hud.js` (HUD + minimap), `audio.js`
  (synthesized sound), `input.js` (keyboard + mouse), `save.js`
  (localStorage saves), `state.js` (shared game state), `utils.js` (math).
- `main.ts` copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the kit's `vendor/makefun-game.ts`.

## Screenshots

`1-title.jpg` title screen over the city · `2-drive.jpg` driving the package
run with a 1-star wanted level · `3-chase.jpg` the bank-job escape, 3 stars,
two PD interceptors closing in · `4-mission.jpg` the Street Sweep gunfight
at the Marina Docks.

## License

MIT — see `LICENSE`. SOLMAR HEAT is an original game: all city, characters,
vehicles, names, story, art and sound are its own. Nothing from Rockstar
Games or any other commercial game.
