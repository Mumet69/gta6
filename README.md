# VELVET BAY v3 — an open-world crime game

> v3 — the Empire update. Mara stops working for Cash and starts owning the
> bay: buyable fronts with passive income, five turf districts to take from
> the Vipers, a garage, three weapons, roadblocks and a detective at high
> heat, witnesses who phone the cops, bribes, delivery runs, VIP night fares,
> rain squalls and a new Heights quarter — on top of the v2 city, eight
> story jobs and the Velvet Vault heist finale.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Mumet69/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Mumet69/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sun-soaked Velvet Bay. Mara Voss — ex-street racer, getaway driver — owes fixer
Cassius “Cash” Rowe **$10,000**. Steal cars, outrun the cops, run eight jobs and pay
the debt — then buy fronts, take turf from the Vipers and pull the Velvet Vault
heist — or the bay keeps you.

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
  a beach, a pier with a turning ferris wheel, a marina, the Bay Arena stadium,
  the neon Velvet Strip and the Docks 7 container yard, all procedural — plus
  the v3 Heights quarter: hillside villas, a lookout deck and the Vipers' turf.
- **On foot and by car** — walk, sprint and jump, or steal any traffic car and
  drive it with arcade physics, nitro and handbrake drifts. Seven car models
  with their own speed and handling: sedan, sportscar, taxi, truck, muscle car,
  delivery van and limo. At Cash's Garage (G, in the car) buy engine tunes,
  armour, a nitro tank and fresh paint.
- **Traffic and pedestrians** — commuters follow the road grid, peds stroll the
  sidewalks and flee gunfire and speeding cars. Honk (H) and they step aside.
  Peds have roles now: a street vendor, a rival racer at the race gate, Vipers
  gang patrols guarding turf flags, and witnesses who phone the cops after
  seeing a crime — get out of sight before the call goes through.
- **Wanted level and police** — crimes raise up to 5 stars; police cars pursue,
  foot officers chase and grab, and at 3 stars a helicopter circles overhead
  with a spotlight; at 4 stars roadblocks park across the road ahead, and at
  5 a detective interceptor joins the chase. Get cornered and you are BUSTED.
  Pay a $300 bribe (B) to drop a star, or lay low at the safehouse — heat
  falls twice as fast within 40 m of it.
- **Missions and a story** — eight jobs for Cash: steal a car, a dockside pickup,
  a timed heat run, collecting three debts, a gold sportscar heist on the Strip,
  the Meridian Bank score, an empire job (buy a front, take two districts from
  the Vipers) and the Velvet Vault heist finale — case the bank, steal a
  getaway car, recruit a crew, then hold the vault floor for 45 seconds.
  Paying off the $10,000 debt wins the game; free roam continues after.
- **Side jobs** — taxi fares with a countdown and payout by distance (VIP double
  after 21:00), delivery runs from the Docks warehouse (three drops, $120 each
  plus a $150 bonus), twelve hidden Sunset Coins worth $150 each, and a
  five-checkpoint downtown street race for $500. Side work earns street respect
  (Rookie → Hustler → Wheelman → Bay Legend), shown in the HUD.
- **Combat** — pistol with raycast shots, tracers and muzzle flash, plus a punch;
  gang muscle shoots back. Blue weapon crates unlock a shotgun (five pellets,
  huge up close) and an SMG (fast, 30-round mag) — switch with 1 / 2 / 3.
  Health and ammo crates restock around the city.
- **A living sky** — a full day/night cycle: dawn, midday, golden hour, dusk
  and night, with the sun arcing across the sky and clouds drifting over the bay.
  Rain squalls roll in off the water with lightning, dimming the sun.
- **Empire** — buy three fronts (Sunset Motel $1,200, Docks Warehouse $2,500,
  Neon Palms Club $4,000) that pay passive income every 45 seconds, and take
  five turf districts from the Vipers in turf wars (press E at a flag, beat
  the muscle). Fronts and flags show on the minimap; the HUD tracks fronts,
  turf, deliveries and heist prep.
- **HUD with minimap** — money, debt, respect and side-job progress, health,
  wanted stars, mission objective with distance and timer, speed, ammo, a live
  minimap (roads, cars, police, helicopter, coins, fare customers, race gate,
  fronts, turf flags) and a mission beacon.
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
| E | Steal / enter / exit car, interact, buy fronts, turf wars, heist prep |
| 1 / 2 / 3 | Pistol / shotgun / SMG |
| F | Punch |
| R | Reload |
| H | Horn (peds step aside) |
| B | Bribe $300 (drop one wanted star) |
| G | Garage upgrades (in a car at Cash's Garage) |
| T | Turf / empire check |
| Space | Jump / handbrake |
| Shift | Sprint / nitro |
| P / Esc | Pause & save |

## Files

- `game/index.html` — the page and HUD
- `game/src/main.js` — bootstrap, loop, camera, player controller
- `game/src/city.js` — procedural Velvet Bay + the Heights quarter
- `game/src/empire.js` — fronts, turf wars, heist prep, passive income
- `game/src/vehicles.js` — cars, driving physics, traffic AI, garage upgrades
- `game/src/people.js` — pedestrians (vendors, rivals, patrols, witnesses) and foot police
- `game/src/combat.js` — pistol, shotgun, SMG, punch, gang enemies
- `game/src/missions.js` — the eight-job story
- `game/src/activities.js` — taxi fares, deliveries, Sunset Coins, street race
- `game/src/weather.js` — day/night cycle, drifting clouds, rain squalls
- `game/src/wanted.js` — wanted stars, police, roadblocks, detective, bribes, busted
- `game/src/hud.js` — HUD, empire line and minimap
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/state.js` — game state
- `game/src/save.js` — localStorage save / load (v2)
- `game/src/utils.js` — math and random helpers
