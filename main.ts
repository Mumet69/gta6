// VELVET BAY — make.fun gta6-01 entry program.
// Hands in game/ and screenshots/ and writes dossier.json with the kit's
// vendor library. Output goes only to MAKEFUN_OUTPUT_DIR (or /output);
// it never writes into the repository at grading time.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const dest = join(outDir, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoRoot, name), dest, { recursive: true });
}
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`velvet-bay: wrote ${outDir} (dossier ${dossier.length} bytes)`);
