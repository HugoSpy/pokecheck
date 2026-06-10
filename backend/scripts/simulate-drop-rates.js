#!/usr/bin/env node
// simulate-drop-rates.js - Simulation pure, zéro HTTP / DB / JWT.
// Réplique exactement la logique de tirage des routes draw.ts et event.ts.
// Usage : node scripts/simulate-drop-rates.js

'use strict';

const N    = 100_000;
const THEO = { COMMON: 79.5, RARE: 15.0, EPIC: 5.0, LEGENDARY: 0.5 };

// ── Logique tirage normal (draw.ts : seuils cumulatifs) ───────────────────────
// COMMON < 0.795 | RARE < 0.945 | EPIC < 0.995 | LEGENDARY sinon
function pickNormal() {
  const r = Math.random();
  if (r < 0.795) return 'COMMON';
  if (r < 0.945) return 'RARE';
  if (r < 0.995) return 'EPIC';
  return 'LEGENDARY';
}

// ── Logique tirage event (event.ts : taux pondérés × multipliers) ─────────────
// Avec rarity_multiplier tous à 1.0 → taux identiques au tirage normal
function makePicker(multipliers) {
  const base = { COMMON: 79.5, RARE: 15, EPIC: 5, LEGENDARY: 0.5 };
  const rates = {};
  for (const [r, b] of Object.entries(base)) rates[r] = b * (multipliers[r] ?? 1.0);
  const total = Object.values(rates).reduce((s, w) => s + w, 0);
  return function pick() {
    let roll = Math.random() * total;
    for (const [r, w] of Object.entries(rates)) { roll -= w; if (roll < 0) return r; }
    return 'COMMON';
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function simulate(fn, n) {
  const c = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
  for (let i = 0; i < n; i++) c[fn()]++;
  return c;
}

function printStats(label, counts) {
  const n = Object.values(counts).reduce((s, v) => s + v, 0);
  console.log(`\n=== ${label} (n=${n.toLocaleString()}) ===\n`);
  console.log('  Rareté        Obtenu    %       Théorique   Δ');
  console.log('  ' + '─'.repeat(52));
  for (const r of ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
    const pct   = counts[r] / n * 100;
    const delta = pct - THEO[r];
    console.log(
      `  ${r.padEnd(14)}` +
      `${String(counts[r]).padStart(7)}   ` +
      `${pct.toFixed(2).padStart(6)}%   ` +
      `${String(THEO[r]).padStart(5)}%    ` +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`
    );
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
const pickEvent   = makePicker({ COMMON: 1.0, RARE: 1.0, EPIC: 1.0, LEGENDARY: 1.0 });
const pickEventX2 = makePicker({ COMMON: 1.0, RARE: 1.5, EPIC: 2.0, LEGENDARY: 3.0 });

printStats('Tirage normal - /draw',                         simulate(pickNormal,   N));
printStats('Tirage event - multipliers ×1.0 (neutre)',      simulate(pickEvent,    N));
printStats('Tirage event - ×1.5 RARE / ×2 EPIC / ×3 LEGY', simulate(pickEventX2, N));

console.log();
