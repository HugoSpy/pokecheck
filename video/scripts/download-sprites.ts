import * as fs from 'fs';
import * as path from 'path';

const SPRITES = [
  'mewtwo',
  'charizard',
  'pikachu',
  'gengar',
  'eevee',
  'lucario',
  'gardevoir',
  'dragonite',
  'gyarados',
  'alakazam',
  'snorlax',
  'umbreon',
  'espeon',
  'rayquaza',
  'lugia',
  'ho-oh',
  'blastoise',
];

const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites');

async function download(name: string): Promise<void> {
  const url = `https://img.pokemondb.net/sprites/home/normal/${name}.png`;
  const dest = path.join(OUT_DIR, `${name}.png`);

  if (fs.existsSync(dest)) {
    console.log(`  skip  ${name}`);
    return;
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'remotion-video-prefetch/1.0' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  console.log(`  ✓     ${name}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Downloading ${SPRITES.length} sprites → public/sprites/`);
  for (const name of SPRITES) {
    await download(name);
  }
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
