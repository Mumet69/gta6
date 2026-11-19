# VELVET BAY — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumet69/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumet69/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sun-soaked Velvet Bay. Mara Voss — ex-street racer, getaway driver — owes fixer
Cassius “Cash” Rowe **$8,000**. Steal cars, outrun the cops, run five jobs and pay
the debt — or the bay keeps you.

Built by an AI agent for make.fun's [“Make GTA 6” bounty](https://make.fun/bounty/gta6-01)
($1,666 in USDC). Everything is original: the city, characters, vehicles, names,
story, art and sound. Nothing from Rockstar Games.

## Play it

Open `game/index.html` in desktop Chrome, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

The game runs fully offline from static files — no network requests, no build step.
Three.js is vendored under `game/vendor/`.

## The game

- **A city to explore** — a 9×9-block coastal grid with downtown towers, parks,
  a beach, a pier, a marina and the Docks 7 container yard, all procedural.
- **On foot and by car** — walk, sprint and jump, or steal any traffic car and
  drive it with arcade physics, nitro and handbrake drifts.
- **Traffic and pedestrians** — commuters follow the road grid, peds stroll the
  sidewalks and flee gunfire and speeding cars.
- **Wanted level and police** — crimes raise up to 5 stars; police cars pursue,
  foot officers chase and grab; get cornered and you are BUSTED.
- **Missions and a story** — five jobs for Cash: steal a car, a dockside pickup,
  a timed heat run, collecting three debts, and the Meridian Bank score.
  Paying off the $8,000 debt wins the game; free roam continues after.
- **Combat** — pistol with raycast shots, tracers and muzzle flash, plus a punch;
  gang muscle shoots back.
- **HUD with minimap** — money, debt, health, wanted stars, mission objective
  with distance and timer, speed, ammo, a live minimap and a mission beacon.
- **Start screen and save** — start or continue from a localStorage save;
  autosaves on every finished job.
- **Sound, all synthesised** — engine hum, sirens, gunshots, jingles and a
  bassline loop, built live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse | Aim (click to lock) |
| Left click | Shoot |
| E | Steal / enter / exit car, interact |
| F | Punch |
| R | Reload |
| Space | Jump / handbrake |
| Shift | Sprint / nitro |
| P / Esc | Pause & save |

## Files

- `game/index.html` — the page and HUD
- `game/src/main.js` — bootstrap, loop, camera, player controller
- `game/src/city.js` — procedural Velvet Bay
- `game/src/vehicles.js` — cars, driving physics, traffic AI
- `game/src/people.js` — pedestrians and foot police
- `game/src/combat.js` — pistol, punch, gang enemies
- `game/src/missions.js` — the five-job story
- `game/src/wanted.js` — wanted stars, police, busted
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/state.js` — game state
- `game/src/save.js` — localStorage save / load
- `game/src/utils.js` — math and random helpers
