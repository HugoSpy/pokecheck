import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyShop } from '../api/shopApi';
import { useUserCtx } from '../context/UserContext';
import { Coins } from '../components/icons';
import type { DailyShop, ShopPack } from '../api/types';
import './Shop.css';

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
  const { coins } = useUserCtx();
  const canAfford = coins >= pack.price;
  const disabled = pack.bought || !canAfford;
  // Some gen textures may not be shipped yet - fall back to a labelled placeholder
  // instead of a broken image.
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`shop-card${pack.bought ? ' shop-card-bought' : ''}`}>
      <div className="shop-pack-art">
        {imgError ? (
          <div className="shop-pack-fallback">{pack.name}</div>
        ) : (
          <img
            src={pack.texture_url}
            alt={`Pack ${pack.name}`}
            draggable={false}
            onError={() => setImgError(true)}
          />
        )}
        {pack.bought && <div className="shop-bought-overlay">Déjà acheté</div>}
      </div>

      <div className="shop-card-name">{pack.name}</div>

      <div className="shop-card-price">
        <Coins size={15} /> {pack.price.toLocaleString()}
      </div>

      <button
        className={`btn ${disabled ? 'btn-ghost' : 'btn-primary'} shop-buy-btn`}
        disabled={disabled}
        title={!canAfford && !pack.bought ? 'Coins insuffisants' : undefined}
        onClick={() => navigate(`/shop/pack?gen=${pack.generation}`)}
      >
        {pack.bought ? 'Déjà acheté' : 'Acheter'}
      </button>
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
        3 packs tirés au sort chaque jour. Un achat par pack et par jour.
      </p>

      <div className="shop-grid">
        {shop?.packs.map(pack => <PackCard key={pack.generation} pack={pack} />)}
      </div>
    </div>
  );
}
