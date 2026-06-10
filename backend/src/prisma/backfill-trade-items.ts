// One-shot backfill: populate TradeItem from the legacy scalar columns on Trade.
// For each existing Trade -> 1 item owner='from' (from_pokemon_id, always set)
// and 1 item owner='to' (to_pokemon_id, only when non-null).
// Idempotent: trades that already have items are skipped, so it's safe to re-run.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany({
    select: { id: true, from_pokemon_id: true, to_pokemon_id: true, items: { select: { id: true } } },
  });

  // Some legacy trades reference UserPokemon that have since been deleted
  // (orphans). A TradeItem FK to a missing UserPokemon would fail, so only
  // backfill ids that still exist.
  const referenced = new Set<string>();
  for (const t of trades) {
    if (t.from_pokemon_id) referenced.add(t.from_pokemon_id);
    if (t.to_pokemon_id) referenced.add(t.to_pokemon_id);
  }
  const existing = await prisma.userPokemon.findMany({
    where: { id: { in: [...referenced] } },
    select: { id: true },
  });
  const valid = new Set(existing.map(p => p.id));

  let created = 0;
  let skipped = 0;
  let danglingSkipped = 0;

  for (const t of trades) {
    if (t.items.length > 0) { skipped++; continue; }

    const data: { trade_id: string; owner: string; pokemon_id: string }[] = [];
    if (t.from_pokemon_id && valid.has(t.from_pokemon_id)) data.push({ trade_id: t.id, owner: 'from', pokemon_id: t.from_pokemon_id });
    else if (t.from_pokemon_id) danglingSkipped++;
    if (t.to_pokemon_id && valid.has(t.to_pokemon_id)) data.push({ trade_id: t.id, owner: 'to', pokemon_id: t.to_pokemon_id });
    else if (t.to_pokemon_id) danglingSkipped++;

    if (data.length > 0) {
      await prisma.tradeItem.createMany({ data });
      created += data.length;
    }
  }

  console.log(`Backfill done: ${trades.length} trades, ${created} TradeItem rows created, ${skipped} already had items, ${danglingSkipped} dangling refs skipped.`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
