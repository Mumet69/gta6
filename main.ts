// VELVET BAY v3 — original open-world crime game for gta6-01.
// v3 adds the empire layer on top of v2: eight story jobs (an empire job
// and the Velvet Vault heist finale), buyable fronts with passive income,
// five turf districts, a garage, three weapons, roadblocks, a detective,
// witnesses, bribes, delivery runs, VIP taxi fares, rain squalls and the
// Heights quarter — all in game/src/empire.js and the v3 edits around it.
// The program itself is unchanged in behaviour: it still copies game/ and
// screenshots/ beside this file to /output and writes /output/dossier.json
// with the vendored make.fun library, writing nothing into the repository,
// so a read-only run produces the same bytes as a normal one.
// A working gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/, no network request), and the program hands it in. It copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The game: sun-soaked Velvet Bay, a 9x9-block coastal city. Mara Voss owes
// fixer Cash Rowe $10,000 across six story jobs (car theft, a dockside
// pickup, a timed heat run, debt collection, a sportscar heist on the Velvet
// Strip, and the Meridian Bank score), plus side work — taxi fares, twelve
// hidden Sunset Coins and a downtown street race — with traffic (sedans,
// taxis, trucks, sportscars), pedestrians, a 5-star wanted system with
// police cars, foot officers and a helicopter, combat, health/ammo pickups,
// a day/night cycle, a HUD with minimap, and a localStorage save.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate allows 3 or 4 screenshots; refuse loudly here instead of handing
// in an entry the scorer would reject.
const shotDir = join(here, 'screenshots');
const shotCount = existsSync(shotDir)
  ? readdirSync(shotDir).filter((f) => !f.startsWith('.')).length
  : 0;
if (shotCount < 3 || shotCount > 4) {
  throw new Error(`VELVET BAY: expected 3 or 4 screenshots, found ${shotCount}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
