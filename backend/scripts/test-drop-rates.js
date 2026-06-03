#!/usr/bin/env node
// test-drop-rates.js — Simule N tirages HTTP réels et compare avec les taux théoriques.
// Usage : depuis ~/pokecheck-dev/backend/  →  node scripts/test-drop-rates.js
//
// Ce script modifie temporairement les coins du premier user trouvé en DB,
// puis nettoie les UserPokemon créés. À n'utiliser que sur pokeschool_dev.

'use strict';

const path  = require('path');
const http  = require('http');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const jwt     = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE    = `http://localhost:${process.env.PORT ?? 3004}`;
const N           = 1000;
const CONCURRENCY = 20;
const THEO        = { COMMON: 79.5, RARE: 15.0, EPIC: 5.0, LEGENDARY: 0.5 };

// ── HTTP helper (no external deps) ───────────────────────────────────────────
function post(url, body, token) {
  return new Promise((resolve) => {
    const data  = JSON.stringify(body);
    const u     = new URL(url);
    const opts  = {
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization':  `Bearer ${token}`,
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end',  () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ ok: false, status: res.statusCode, body: null }); }
      });
    });
    req.on('error', () => resolve({ ok: false, status: 0, body: null }));
    req.write(data);
    req.end();
  });
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function makeStats() { return { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0, errors: 0, total: 0 }; }

function printStats(label, stats) {
  const n = stats.total;
  console.log(`\n=== ${label} (n=${n}, erreurs=${stats.errors}) ===\n`);
  if (n === 0) { console.log('  Aucun tirage réussi.'); return; }
  console.log('  Rareté        Obtenu   %       Théorique  Δ');
  console.log('  ' + '─'.repeat(50));
  for (const r of ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
    const pct   = stats[r] / n * 100;
    const delta = pct - THEO[r];
    console.log(
      `  ${r.padEnd(14)}` +
      `${String(stats[r]).padStart(5)}   ` +
      `${pct.toFixed(2).padStart(6)}%   ` +
      `${String(THEO[r]).padStart(5)}%    ` +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`
    );
  }
}

// ── Batch runner ──────────────────────────────────────────────────────────────
async function runBatch(fn, stats, n) {
  for (let i = 0; i < n; i += CONCURRENCY) {
    const size  = Math.min(CONCURRENCY, n - i);
    const tasks = Array.from({ length: size }, () => fn(stats));
    await Promise.all(tasks);
    process.stdout.write(`\r  Progression : ${stats.total + stats.errors}/${n}   `);
  }
  process.stdout.write('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();

  // 1. Récupérer un user et l'event
  const user = await prisma.user.findFirst({ orderBy: { created_at: 'asc' } });
  if (!user) { console.error('Aucun user en DB.'); process.exit(1); }

  const event = await prisma.event.findFirst({ where: { name: 'Édition Sinnoh' } });
  if (!event) { console.error('Event "Édition Sinnoh" introuvable.'); process.exit(1); }
  if (!event.published) { console.error('Event non publié.'); process.exit(1); }

  console.log(`\nUser     : ${user.display_name} (${user.id})`);
  console.log(`Event    : ${event.name} — ${event.price} coins/tirage`);
  console.log(`API      : ${API_BASE}`);
  console.log(`Tirages  : ${N} par endpoint, concurrence ${CONCURRENCY}`);

  // 2. Boost coins (N tirages event × price + marge)
  const coinsNeeded = N * event.price + 10000;
  await prisma.user.update({ where: { id: user.id }, data: { coins: coinsNeeded } });
  console.log(`\nCoins mis à ${coinsNeeded} pour couvrir ${N} tirages event.`);

  // 3. Signer un JWT
  const token = jwt.sign(
    { userId: user.id, ms_id: user.ms_id, display_name: user.display_name, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const testStart = new Date();

  // ── Tirage normal (POST /draw) — limite 100/jour ──────────────────────────
  // On tourne par tranches de 100 en remettant le compteur à zéro entre chaque.
  console.log(`\n── Tirage normal (POST /draw) ──`);
  console.log(`  Limite 100/jour — ${N} tentatives en ${Math.ceil(N / 100)} tranches de 100.`);

  const statsNormal = makeStats();

  for (let batch = 0; batch < Math.ceil(N / 100); batch++) {
    if (batch > 0) {
      // Reset compteur : supprimer les UserPokemon créés pendant ce test
      await prisma.userPokemon.deleteMany({
        where: { user_id: user.id, source: 'draw', obtained_at: { gte: testStart } },
      });
    }

    const batchSize = Math.min(100, N - statsNormal.total - statsNormal.errors);
    if (batchSize <= 0) break;

    await runBatch(async (stats) => {
      const r = await post(`${API_BASE}/draw`, {}, token);
      if (!r.ok) { stats.errors++; return; }
      const rarity = r.body?.pokemon?.rarity;
      if (rarity && rarity in stats) { stats[rarity]++; }
      stats.total++;
    }, statsNormal, batchSize);
  }

  printStats('POST /draw — tirage normal', statsNormal);

  // ── Tirage event (POST /event/draw) ──────────────────────────────────────
  console.log(`\n── Tirage event (POST /event/draw, ${event.name}) ──`);

  const statsEvent = makeStats();

  await runBatch(async (stats) => {
    const r = await post(`${API_BASE}/event/draw`, { event_id: event.id }, token);
    if (!r.ok) { stats.errors++; return; }
    const rarity = r.body?.pokemon?.rarity;
    if (rarity && rarity in stats) { stats[rarity]++; }
    stats.total++;
  }, statsEvent, N);

  printStats(`POST /event/draw — ${event.name}`, statsEvent);

  // ── Nettoyage ────────────────────────────────────────────────────────────
  console.log('\nNettoyage...');
  const deleted = await prisma.userPokemon.deleteMany({
    where: { user_id: user.id, obtained_at: { gte: testStart }, source: { in: ['draw', 'event'] } },
  });
  await prisma.user.update({ where: { id: user.id }, data: { coins: 1000 } });
  console.log(`  ${deleted.count} UserPokemon supprimés. Coins remis à 1000.`);

  await prisma.$disconnect();
  console.log('\nTerminé.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
