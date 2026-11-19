# DUSTLINE — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumet69/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumet69/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sun-baked Dustline, a desert city on the edge of nowhere. You are **Rook Calloway**,
a getaway driver who owes the fixer Vera Kaine $5,000. Steal cars, outrun the law,
settle scores and pull the big score — or the desert keeps you.

## Play it

Open `game/index.html` in desktop Chrome, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

No network requests, no build step — the game is plain static files under `game/`,
with Three.js vendored at `game/vendor/three.module.min.js`.

## What's in the world

- **A procedural desert city** — grid streets, a bank, a motel safehouse, a diner,
  a gas station, the Dustline Tower, parks, palms, cacti and a wide open desert.
- **On foot and by car** — walk the sidewalks or steal any parked or traffic car
  (E), with arcade driving physics, handbrake turns and building collisions.
- **Traffic and pedestrians** — cars follow the road graph, pedestrians stroll the
  sidewalks and panic when shots ring out.
- **Wanted system** — crimes add heat, heat becomes 0–5 stars, police cars chase
  and ram you, foot cops join from 2 stars, and the heat cools off if you stay
  clean. Get caught on foot and you're busted.
- **Four story missions** — steal a car for the safehouse, a timed desert delivery,
  a motel brawl against four rivals, and the bank job: grab the cash, lose the
  heat, reach the safehouse with no stars.
- **Combat** — fists and a pistol with tracers, reloads and ammo pickups.
- **HUD with a live minimap** — health, cash, wanted stars, clock, mission
  objective, speed, weapon, and a circular minimap tracking you, police,
  traffic and the mission marker.
- **Title screen, pause and save** — progress (cash, missions) persists in
  localStorage; synthesized WebAudio sound (engine, sirens, gunshots, music),
  no audio files.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Drive / walk |
| E | Steal / enter car |
| F | Exit car |
| Space | Punch (on foot) / handbrake (in car) |
| Click | Shoot pistol |
| 1 / 2 | Fists / pistol |
| P | Pause |
| M | Mute |
| Drag mouse | Orbit camera |

## Files

```
game/index.html          the page + HUD
game/src/utils.js        seeded RNG + math
game/src/state.js        shared game state
game/src/city.js         procedural city, road graph, colliders
game/src/vehicles.js     cars, traffic AI, stealing
game/src/people.js       pedestrians, foot police
game/src/wanted.js       wanted stars + police chases
game/src/combat.js       fists, pistol, tracers
game/src/missions.js     the four story missions
game/src/hud.js          HUD + live minimap
game/src/audio.js        synthesized WebAudio sound
game/src/input.js        keyboard + mouse
game/src/save.js         localStorage save
game/src/main.js         game loop, camera, pickups, shots
game/vendor/three.module.min.js   Three.js r160 (MIT)
```

## License

MIT — see [LICENSE](LICENSE). All city, characters, vehicles, names, story, art
and sound are original; nothing from Rockstar Games.
