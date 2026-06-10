import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PackRoll from '../components/PackRoll';
import Toast from '../components/Toast';
import { sellPokemon } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { MultiEventDrawResult } from '../api/types';
import './OpenPack.css'; // roll-card / reveal classes used by PackRoll
import './EventPackOpenMulti.css'; // reuse the exact multi-roll layout (do not modify)

// Mirrors PackRoll's internal timing so we know when every roll has finished.
const ROLL_DURATION = 4000;
const REVEAL_TAIL = 1800;
const START_DELAY = 500;

const RARITY_GLOW: Record<string, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f5a623',
};

const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commun',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

interface NavState {
  draw: MultiEventDrawResult;
  packName?: string;
}

// Down-scale each roll so N packs fit on screen.
function scaleForCount(n: number): number {
  if (n <= 2) return 0.62;
  if (n <= 5) return 0.42;
  return 0.34;
}

async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(url => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    })),
  );
}

export default function ShopPackOpenMulti() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setCoins, refreshProfile } = useUserCtx();

  const state = location.state as NavState | null;
  const results = state?.draw.results ?? [];

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const startAtRef = useRef<number>(0);

  const [sold, setSold] = useState<boolean[]>(() => results.map(() => false));
  const [sellingIdx, setSellingIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Direct navigation / refresh has no draw payload → bounce back to the shop.
  useEffect(() => {
    if (!state || results.length === 0) navigate('/shop', { replace: true });
  }, [state, results.length, navigate]);

  // Reflect the post-draw balance immediately.
  useEffect(() => {
    if (state?.draw) setCoins(state.draw.coins_remaining);
  }, [state, setCoins]);

  // Preload every sprite, then arm the shared start time so all rolls animate
  // in lockstep.
  useEffect(() => {
    if (results.length === 0) return;
    let cancelled = false;
    const urls = results.flatMap(r => r.strip.map(c => c.sprite_url));
    Promise.race([
      preloadImages(urls),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]).then(() => {
      if (cancelled) return;
      startAtRef.current = Date.now() + START_DELAY;
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [results]);

  // Reveal the result grid once all rolls have finished.
  useEffect(() => {
    if (!ready) return;
    const doneIn = Math.max(0, startAtRef.current - Date.now()) + ROLL_DURATION + REVEAL_TAIL + 250;
    const t = setTimeout(() => setDone(true), doneIn);
    return () => clearTimeout(t);
  }, [ready]);

  async function handleSell(idx: number): Promise<void> {
    const r = results[idx];
    if (!r || sold[idx] || sellingIdx !== null) return;
    setSellingIdx(idx);
    try {
      const res = await sellPokemon(r.user_pokemon_id);
      setSold(prev => prev.map((v, i) => (i === idx ? true : v)));
      await refreshProfile();
      setToast({ msg: `Doublon revendu - +${res.coins_earned} coins`, type: 'success' });
    } catch {
      setToast({ msg: 'Échec de la revente, réessaie.', type: 'error' });
    } finally {
      setSellingIdx(null);
    }
  }

  if (!state || results.length === 0) return null;

  const scale = scaleForCount(results.length);

  return (
    <div className="pack-page multi-pack-page">
      <div className="scanlines" />
      <div className="pack-logo">
        <span style={{ color: 'var(--accent)' }}>Poké</span>Check
      </div>

      {/* ── Loading ── */}
      {!ready && (
        <div className="pack-stage">
          <div className="pokeball-wrap spinning">
            <div className="pokeball">
              <div className="pokeball-top" />
              <div className="pokeball-band" />
              <div className="pokeball-bottom" />
              <div className="pokeball-center"><div className="pokeball-button" /></div>
            </div>
            <div className="pokeball-glow" />
          </div>
          <div className="loading-label">Ouverture de {results.length} packs…</div>
        </div>
      )}

      {/* ── Parallel rolls ── */}
      {ready && !done && (
        <div className="multi-rolls" style={{ '--s': scale } as React.CSSProperties}>
          {results.map((r, i) => (
            <div key={i} className="multi-roll-cell">
              <PackRoll
                strip={r.strip}
                winner={{
                  name: r.pokemon.name,
                  rarity: r.pokemon.rarity,
                  points: r.pokemon.points,
                  is_shiny: r.pokemon.is_shiny ?? false,
                }}
                startAt={startAtRef.current}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Result grid ── */}
      {done && (
        <div className="multi-results">
          <h2 className="multi-results-title">Tes {results.length} Pokémon</h2>
          <div className="multi-results-grid">
            {results.map((r, i) => {
              const glow = RARITY_GLOW[r.pokemon.rarity] ?? '#9ca3af';
              const color = r.pokemon.is_shiny ? '#FFD700' : glow;
              return (
                <div
                  key={i}
                  className={`multi-result-card${r.pokemon.is_shiny ? ' shiny' : ''}`}
                  style={{ '--rcolor': color } as React.CSSProperties}
                >
                  {r.pokemon.is_shiny && <span className="multi-result-shiny">✨</span>}
                  <img src={r.pokemon.sprite_url} alt={r.pokemon.name} className="multi-result-img" />
                  <div className="multi-result-name">{r.pokemon.name}</div>
                  <div className="multi-result-rarity" style={{ color }}>
                    {r.pokemon.rarity === 'LEGENDARY' ? '★ ' : ''}
                    {RARITY_LABELS[r.pokemon.rarity] ?? r.pokemon.rarity}
                  </div>
                  <div className="multi-result-pts" style={{ color }}>+{r.pokemon.points} pts</div>
                  {r.is_duplicate && !sold[i] && (
                    <button
                      className="multi-result-sell"
                      onClick={() => handleSell(i)}
                      disabled={sellingIdx !== null}
                    >
                      {sellingIdx === i ? 'Revente…' : `Revendre (${r.sell_price} coins)`}
                    </button>
                  )}
                  {sold[i] && <div className="multi-result-sold">Revendu ✓</div>}
                </div>
              );
            })}
          </div>

          <button className="open-btn" onClick={() => navigate('/shop')}>
            Retour à la boutique →
          </button>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
