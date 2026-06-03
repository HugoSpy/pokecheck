import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'oui');
    });
  });
}

async function main(): Promise<void> {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    console.error('Usage: npx ts-node --transpile-only src/prisma/wipe-users.ts "Nom Prénom" ...');
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { display_name: { in: names } },
    select: {
      id: true,
      display_name: true,
      coins: true,
      total_score: true,
      streak_days: true,
      trade_count: true,
      _count: {
        select: {
          pokemons: true,
          badges: true,
          coin_transactions: true,
          trades_sent: true,
          trades_recv: true,
          market_listings: true,
          market_purchases: true,
        },
      },
    },
  });

  const foundNames = users.map(u => u.display_name);
  const notFound = names.filter(n => !foundNames.includes(n));
  if (notFound.length > 0) {
    console.error(`\nUtilisateurs introuvables : ${notFound.join(', ')}`);
    process.exit(1);
  }

  console.log('\n=== Aperçu du wipe ===\n');
  for (const u of users) {
    const attendanceCount = await prisma.attendanceOpening.count({ where: { user_id: u.id } });
    console.log(`${u.display_name} (${u.id})`);
    console.log(`  Pokémons        : ${u._count.pokemons}`);
    console.log(`  Coins           : ${u.coins}`);
    console.log(`  Score total     : ${u.total_score}`);
    console.log(`  Streak          : ${u.streak_days} jours`);
    console.log(`  Trades          : ${u._count.trades_sent} envoyés + ${u._count.trades_recv} reçus`);
    console.log(`  Badges          : ${u._count.badges}`);
    console.log(`  Transactions    : ${u._count.coin_transactions}`);
    console.log(`  Listings marché : ${u._count.market_listings} vendeur + ${u._count.market_purchases} acheteur`);
    console.log(`  Attendances     : ${attendanceCount}`);
    console.log();
  }

  const ok = await confirm('Confirmer le wipe ? [oui/non] ');
  if (!ok) {
    console.log('Annulé.');
    return;
  }

  console.log('\nWipe en cours...\n');

  for (const u of users) {
    await prisma.$transaction(async tx => {
      // Null out AttendanceOpening.user_pokemon_id references before deleting pokemons
      await tx.attendanceOpening.updateMany({
        where: { user_id: u.id },
        data: { user_pokemon_id: null },
      });

      // Delete records that reference UserPokemon (no Prisma FK but safer first)
      await tx.marketListing.deleteMany({
        where: { OR: [{ seller_id: u.id }, { buyer_id: u.id }] },
      });
      await tx.trade.deleteMany({
        where: { OR: [{ from_user_id: u.id }, { to_user_id: u.id }] },
      });
      await tx.attendanceOpening.deleteMany({ where: { user_id: u.id } });

      await tx.userBadge.deleteMany({ where: { user_id: u.id } });
      await tx.coinTransaction.deleteMany({ where: { user_id: u.id } });
      await tx.userPokemon.deleteMany({ where: { user_id: u.id } });

      await tx.user.update({
        where: { id: u.id },
        data: {
          coins: 0,
          coins_earned_total: 0,
          streak_days: 0,
          last_login: null,
          trade_count: 0,
          total_score: 0,
          featured_badges: [],
        },
      });
    });

    console.log(`✓ ${u.display_name} — wipe terminé`);
  }

  console.log('\n=== Vérification finale ===\n');
  for (const u of users) {
    const fresh = await prisma.user.findUnique({
      where: { id: u.id },
      select: {
        display_name: true,
        coins: true,
        coins_earned_total: true,
        total_score: true,
        streak_days: true,
        trade_count: true,
        last_login: true,
        featured_badges: true,
        _count: { select: { pokemons: true, badges: true, coin_transactions: true } },
      },
    });
    if (!fresh) continue;
    console.log(`${fresh.display_name}:`);
    console.log(`  coins=${fresh.coins}, coins_total=${fresh.coins_earned_total}, score=${fresh.total_score}`);
    console.log(`  streak=${fresh.streak_days}, trades=${fresh.trade_count}, last_login=${fresh.last_login}`);
    console.log(`  pokémons=${fresh._count.pokemons}, badges=${fresh._count.badges}, transactions=${fresh._count.coin_transactions}`);
    console.log(`  featured_badges=[${fresh.featured_badges.join(', ')}]`);
    console.log();
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
