import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pokemons = await prisma.pokemon.findMany({ select: { id: true, name: true } });
  console.log(`Mise à jour de ${pokemons.length} Pokémon...`);

  let updated = 0;
  let failed = 0;

  for (const pokemon of pokemons) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}`);
      const data = await res.json() as { names: { language: { name: string }; name: string }[] };

      const frName = data.names.find((n) => n.language.name === 'fr')?.name;

      if (frName) {
        await prisma.pokemon.update({
          where: { id: pokemon.id },
          data: { name: frName }
        });
        if (pokemon.id % 50 === 0) console.log(`Progress: ${pokemon.id}/809 — ${frName}`);
        updated++;
      } else {
        console.log(`⚠️  ${pokemon.id}: ${pokemon.name} — pas de nom FR`);
        failed++;
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`❌ ${pokemon.id}: ${pokemon.name} — erreur:`, e);
      failed++;
    }
  }

  console.log(`\nTerminé: ${updated} mis à jour, ${failed} échoués`);
  await prisma.$disconnect();
}

main();
