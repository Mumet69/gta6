# VELVET BAY 🌴

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff5da2)](https://make.fun/c/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r160-000000)](game/three.min.js)
[![Plays offline](https://img.shields.io/badge/plays-offline-brightgreen)](game/index.html)

**An original open-world crime game in the spirit of GTA 6 — sun, sand, sirens, and one city to own.**

> Referral code: **`x8txzvb2`**

## Play it

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network, no build step, no install — everything is vendored
under `game/`, including three.js r160.

## The game

Welcome to **Velvet Bay**, a sun-soaked fictional city: Ocean Drive beachfront,
a downtown skyline, a working pier with a ferris wheel, and a container
harbor. You play a newcomer driver working for **Lucia Vega** and
**Marcus "Reef" Doyle**.

| System | What it does |
|---|---|
| **On foot & by car** | Third-person walking (WASD, Shift sprint, Space jump) and arcade driving with a chase camera |
| **Steal cars** | Walk up to any traffic car and press **E** — jacking a car earns a wanted star |
| **Traffic & pedestrians** | 16 AI cars cruise the grid; 26 pedestrians stroll, flee, and react to danger |
| **Wanted & police** | 0–5 stars; VBPD cruisers chase, ram, and bust you; wanted decays when you lay low |
| **Missions & story** | 5 story missions — getaway driving, a cash pickup, a pier shootout, harbor crates, a 3-star escape finale |
| **Combat** | Pistol (click), punch (F), mission enemies who shoot back |
| **HUD & minimap** | Health/armor, cash, clock, wanted stars, speedometer, live minimap with traffic, police and mission marker |
| **Save** | Progress auto-saves after every mission (localStorage); continue from the menu |
| **Sound** | Fully synthesized WebAudio: engine, sirens, gunshots, and 3 radio stations (R to switch) |

## Controls

| Key | Action |
|---|---|
| W A S D / arrows | Move / drive |
| Mouse drag | Look around |
| Shift | Sprint |
| Space | Jump |
| E | Enter / steal / exit car |
| Click | Shoot |
| F | Punch |
| R | Next radio station |
| M | Mute |
| P | Pause |

## Screenshots

`1-cover.jpg` — golden-hour drive down Ocean Drive ·
`2-beach.jpg` — on foot at the beach ·
`3-chase.jpg` — 3-star night chase ·
`4-mission.jpg` — the pier shootout at dusk.

## Structure

```
main.ts            entry program — copies game/ + screenshots/ to /output, writes dossier.json
game/index.html    page + HUD
game/three.min.js  vendored three.js r160
game/src/main.js   bootstrap, player, driving, camera, wanted/police, combat, loop
game/src/city.js   Velvet Bay: streets, towers, beach, pier, harbor, palms, neon
game/src/vehicles.js  car factory, traffic AI, police cruisers
game/src/people.js pedestrians + mission enemies
game/src/missions.js  5-mission story chain
game/src/hud.js    HUD, minimap, toasts, cards
game/src/audio.js  synthesized sound + radio
game/src/save.js   localStorage save
game/src/shots.js  screenshot staging (?shot=1..4)
game/src/util.js   math + procedural textures
game/src/style.css HUD + menu styling
```

## License

MIT — see [LICENSE](LICENSE). All city, characters, vehicles, names, story,
art, sound and music are original creations for this entry.
