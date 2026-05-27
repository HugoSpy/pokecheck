import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pokemons = await prisma.pokemon.findMany();
  let fixed = 0;

  for (const p of pokemons) {
    const res = await fetch(p.sprite_url);
    if (res.status !== 404) continue;

    console.log(`❌ 404: #${p.id} ${p.name} → ${p.sprite_url.split('/').pop()}`);

    // Derive candidates from the existing URL (English name already in URL)
    const url = p.sprite_url;
    const variants = [
      url.replace('-male.png', '-m.png').replace('-female.png', '-f.png'),
      url.replace('-male.png', '-f.png').replace('-female.png', '-m.png'),
      url.replace(/-male\.png$/, '.png').replace(/-female\.png$/, '.png'),
    ];

    let found = false;
    for (const v of variants) {
      if (v === url) continue;
      const vRes = await fetch(v);
      if (vRes.status === 200) {
        await prisma.pokemon.update({ where: { id: p.id }, data: { sprite_url: v } });
        console.log(`  ✅ → ${v.split('/').pop()}`);
        fixed++;
        found = true;
        break;
      }
    }
    if (!found) console.log(`  ⚠️  aucun fix trouvé`);

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nTerminé : ${fixed} sprite(s) corrigé(s)`);
  await prisma.$disconnect();
}
main();
