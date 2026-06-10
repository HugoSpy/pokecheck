import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyShop, buyShopPackMulti } from '../api/shopApi';
import { useUserCtx } from '../context/UserContext';
import { Coins } from '../components/icons';
import BoosterPack3D from '../components/BoosterPack3D';
import type { DailyShop, ShopPack } from '../api/types';
import './Shop.css';

// Quantities offered by the multi-open selector (same as the Événements page).
const QUANTITIES = [1, 2, 5, 10] as const;

// ── Countdown to next rotation (Paris midnight) ───────────────────────────────

function useCountdown(target: string | null): string {
  const [remaining, setRemaining] = useState(() => computeRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setRemaining(computeRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}

function computeRemaining(target: string | null): string {
  if (!target) return '--:--:--';
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({ pack }: { pack: ShopPack }) {
  const navigate = useNavigate();
  const { coins, setCoins } = useUserCtx();

  const [count, setCount] = useState<number>(1);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalPrice = pack.price * count;
  const canAfford = coins >= totalPrice;

  async function handleBuy() {
    // Single open keeps the solo flow (the draw runs during the CSGO animation).
    if (count === 1) {
      navigate(`/shop/pack?gen=${pack.generation}`);
      return;
    }
    // Multi-open: draw N packs server-side, then animate them in parallel.
    if (opening) return;
    setOpening(true);
    setError(null);
    try {
      const draw = await buyShopPackMulti(pack.generation, count);
      setCoins(draw.coins_remaining);
      navigate('/shop/pack-multi', { state: { draw, packName: pack.name } });
    } catch (e) {
      const err = e as Error & { status?: number };
      setError(err.status === 402 ? 'Coins insuffisants.' : (err.message || 'Erreur, réessaie.'));
      setOpening(false);
    }
  }

  return (
    <div className="shop-card">
      <div className="shop-pack-art">
        {/* 3D booster: idle float + tilt that follows the cursor on hover. */}
        <BoosterPack3D textureUrl={pack.texture_url} />
      </div>

      <div className="shop-card-name">{pack.name}</div>

      <div className="shop-card-price">
        <Coins size={15} /> {pack.price.toLocaleString()} / pack
      </div>

      <div className="shop-actions">
        <div className="shop-qty" role="group" aria-label="Quantité de packs">
          {QUANTITIES.map(q => (
            <button
              key={q}
              type="button"
              className={`shop-qty-btn${count === q ? ' active' : ''}`}
              onClick={() => setCount(q)}
              aria-pressed={count === q}
            >
              ×{q}
            </button>
          ))}
        </div>

        <button
          className={`btn ${canAfford ? 'btn-primary' : 'btn-ghost'} shop-buy-btn`}
          disabled={!canAfford || opening}
          title={!canAfford ? 'Coins insuffisants' : undefined}
          onClick={handleBuy}
        >
          {opening ? 'Ouverture…' : `${count === 1 ? 'Acheter' : `Acheter ×${count}`} - ${totalPrice.toLocaleString()}`}
        </button>
        {error && <div className="shop-error">{error}</div>}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Shop() {
  const [shop, setShop] = useState<DailyShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(shop?.rotates_at ?? null);

  useEffect(() => {
    getDailyShop()
      .then(setShop)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        Chargement de la boutique…
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div className="shop-page">
      <div className="shop-header">
        <h1 className="shop-title">Boutique</h1>
        <div className="shop-rotation">
          <span className="shop-rotation-label">Prochaine rotation</span>
          <span className="shop-rotation-timer">{countdown}</span>
        </div>
      </div>

      <p className="shop-subtitle">
        3 packs tirés au sort chaque jour. Achats illimités.
      </p>

      <div className="shop-grid">
        {shop?.packs.map(pack => <PackCard key={pack.generation} pack={pack} />)}
      </div>
    </div>
  );
}
