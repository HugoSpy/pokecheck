import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { drawEventPack } from '../api/eventApi';
import { sellPokemon } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { RollCardData, PokemonInfo } from '../api/types';
import Toast from '../components/Toast';
import './OpenPack.css'; // reuse exact same animation CSS

type Phase = 'idle' | 'loading' | 'rolling' | 'reveal' | 'done';

const CARD_WIDTH = 155;
const CARD_GAP = 12;
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;
const TARGET_INDEX = 22;
const ROLL_DURATION = 4000;

const RARITY_BORDER: Record<string, string> = {
  COMMON: '#4b5563',
  RARE: '#2563eb',
  EPIC: '#9333ea',
  LEGENDARY: '#d97706',
};

const RARITY_GLOW: Record<string, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f5a623',
};

const RARITY_FLASH: Record<string, string> = {
  COMMON: 'rgba(255,255,255,0.25)',
  RARE: 'rgba(59,130,246,0.55)',
  EPIC: 'rgba(168,85,247,0.55)',
  LEGENDARY: 'rgba(245,166,35,0.6)',
};

const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commun',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

async function preloadImages(urls: string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const total = urls.length;
  let loaded = 0;
  await Promise.all(
    urls.map(url => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { loaded++; onProgress?.(loaded, total); resolve(); };
      img.onerror = () => { loaded++; onProgress?.(loaded, total); resolve(); };
      img.src = url;
    }))
  );
}

export default function EventPackOpen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const eventId = params.get('event_id') ?? '';

  const { setCoins, refreshProfile } = useUserCtx();

  const [phase, setPhase] = useState<Phase>('idle');
  const [cards, setCards] = useState<RollCardData[]>([]);
  const [pokemon, setPokemon] = useState<PokemonInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [progress, setProgress] = useState(0);
  // Quick-resell of a freshly drawn duplicate (post-animation).
  const [drawInstanceId, setDrawInstanceId] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [sellPrice, setSellPrice] = useState(0);
  const [sold, setSold] = useState(false);
  const [selling, setSelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);

  async function handleOpen() {
    if (!eventId) { setError('Paramètres manquants.'); return; }
    setPhase('loading');
    setError(null);
    try {
      const drawResult = await drawEventPack(eventId);
      setCoins(drawResult.coins_remaining);
      setDrawInstanceId(drawResult.user_pokemon_id);
      setIsDuplicate(drawResult.is_duplicate);
      setSellPrice(drawResult.sell_price);

      const strip: RollCardData[] = [
        ...drawResult.strip.slice(0, TARGET_INDEX),
        drawResult.pokemon as RollCardData,
        ...drawResult.strip.slice(TARGET_INDEX),
      ];

      const allSprites = strip.map(p => p.sprite_url);
      setProgress(0);
      await Promise.race([
        preloadImages(allSprites, (loaded, total) => setProgress(loaded / total)),
        new Promise<void>(resolve => setTimeout(resolve, 8000)),
      ]);

      setCards(strip);
      setPokemon(drawResult.pokemon);
      setShowBadge(false);
      setPhase('rolling');
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(e.status === 402 ? 'Coins insuffisants.' : (err as Error).message);
      setPhase('idle');
    }
  }

  // Set strip to start position before paint (avoids flash)
  useLayoutEffect(() => {
    if (phase !== 'rolling' || !stripRef.current) return;
    const strip = stripRef.current;
    const vpW = (strip.parentElement as HTMLElement).offsetWidth;
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${vpW + 300}px)`;
  }, [phase]);

  // Trigger roll animation after layout
  useEffect(() => {
    if (phase !== 'rolling' || !stripRef.current) return;
    const strip = stripRef.current;
    const vpW = (strip.parentElement as HTMLElement).offsetWidth;
    const endX = vpW / 2 - TARGET_INDEX * CARD_STRIDE - CARD_WIDTH / 2;

    const raf = requestAnimationFrame(() => {
      strip.style.transition = `transform ${ROLL_DURATION}ms cubic-bezier(0.05, 0, 0.12, 1)`;
      strip.style.transform = `translateX(${endX}px)`;
    });

    const timer = setTimeout(() => {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 300);
      setPhase('reveal');
      setTimeout(() => setShowBadge(true), 500);
      setTimeout(() => setPhase('done'), 1800);
    }, ROLL_DURATION);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [phase]);

  const rarityGlow = pokemon ? (RARITY_GLOW[pokemon.rarity] ?? '#9ca3af') : '#9ca3af';

  async function handleSellDuplicate(): Promise<void> {
    if (!drawInstanceId || selling || sold) return;
    setSelling(true);
    try {
      const result = await sellPokemon(drawInstanceId);
      setSold(true);
      await refreshProfile();
      setToast({ msg: `Doublon revendu — +${result.coins_earned} coins`, type: 'success' });
    } catch {
      setToast({ msg: 'Échec de la revente, réessaie.', type: 'error' });
    } finally {
      setSelling(false);
    }
  }

  return (
    <div className={`pack-page ${phase} ${pokemon?.rarity?.toLowerCase() ?? ''}`}>
      <div className="scanlines" />

      {showFlash && pokemon && (
        <div
          className={`rarity-flash${pokemon.is_shiny ? ' shiny-flash' : ''}`}
          style={{ background: pokemon.is_shiny ? 'rgba(255,255,255,0.98)' : (RARITY_FLASH[pokemon.rarity] ?? 'rgba(255,255,255,0.3)') }}
        />
      )}

      <div className="pack-logo">
        <span style={{ color: 'var(--accent)' }}>Poké</span>Check
      </div>

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <div className="pack-stage">
          <div className="pokeball-wrap pulsing">
            <div className="pokeball">
              <div className="pokeball-top" />
              <div className="pokeball-band" />
              <div className="pokeball-bottom" />
              <div className="pokeball-center"><div className="pokeball-button" /></div>
            </div>
            <div className="pokeball-glow" />
          </div>

          {error && (
            <div className="pack-error">
              <div className="pack-error-icon">⚠</div>
              <div className="pack-error-msg">{error}</div>
            </div>
          )}

          <button className="open-btn" onClick={handleOpen}>
            <span className="open-btn-shine" />
            Ouvrir mon pack
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {phase === 'loading' && (
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
          <div className="loading-label">Chargement…</div>
          <div className="preload-bar-wrap">
            <div className="preload-bar" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Roll / Reveal / Done ── */}
      {(phase === 'rolling' || phase === 'reveal' || phase === 'done') && (
        <div className="roll-frame">

          <div className="roll-container">
            {/* Center indicator */}
            <div className="roll-indicator" aria-hidden>
              <div className="indicator-tri indicator-top" />
              <div className="indicator-line" />
              <div className="indicator-tri indicator-bottom" />
            </div>

            {/* Scrolling strip */}
            <div className="roll-viewport">
              <div className="roll-strip" ref={stripRef}>
                {cards.map((card, i) => {
                  const isWinner = i === TARGET_INDEX && (phase === 'reveal' || phase === 'done');
                  const winnerShiny = isWinner && !!pokemon?.is_shiny;
                  const borderColor = winnerShiny ? '#d4af37' : (RARITY_BORDER[card.rarity] ?? '#4b5563');
                  const glowColor  = winnerShiny ? '#FFD700' : rarityGlow;
                  return (
                    <div
                      key={`${i}-${card.id}`}
                      className={`roll-card${isWinner ? ' roll-card-winner' : ''}${card.is_shiny && !isWinner ? ' roll-card-shiny' : ''}`}
                      style={{
                        '--card-border': borderColor,
                        ...(isWinner ? { '--card-glow': glowColor } : {}),
                      } as React.CSSProperties}
                    >
                      {card.is_shiny && <span className="roll-shiny-icon">✨</span>}
                      <img
                        src={card.sprite_url}
                        alt={card.name}
                        className="roll-card-img"
                      />
                      <div className="roll-card-name">{card.name}</div>
                      <div
                        className="roll-card-rarity"
                        style={{ color: card.is_shiny ? '#d4af37' : (RARITY_BORDER[card.rarity] ?? '#4b5563') }}
                      >
                        {card.rarity === 'LEGENDARY' ? '★ ' : ''}
                        {RARITY_LABELS[card.rarity] ?? card.rarity}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reveal info */}
          {(phase === 'reveal' || phase === 'done') && pokemon && (
            <div className={`reveal-block${showBadge ? ' reveal-block-visible' : ''}${pokemon.is_shiny ? ' reveal-block-shiny' : ''}`}>
              {pokemon.is_shiny && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="sparkle" style={{ '--i': i } as React.CSSProperties} />
                  ))}
                  <div className="shiny-badge">✨ SHINY</div>
                </>
              )}
              <div className="reveal-rarity" style={{ color: pokemon.is_shiny ? '#FFD700' : rarityGlow }}>
                {pokemon.rarity === 'LEGENDARY' ? '★ ' : ''}
                {RARITY_LABELS[pokemon.rarity]}
              </div>
              <div className="reveal-poke-name">{pokemon.name}</div>
              <div className="reveal-pts" style={{ color: pokemon.is_shiny ? '#FFD700' : rarityGlow }}>
                +{pokemon.points} pts
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="pack-done-actions">
              <button
                className="open-btn"
                style={{ '--btn-color': rarityGlow } as React.CSSProperties}
                onClick={() => navigate('/events')}
              >
                Retour aux événements →
              </button>
              {isDuplicate && !sold && (
                <button
                  className="open-btn open-btn-secondary"
                  style={{ '--btn-color': rarityGlow } as React.CSSProperties}
                  onClick={handleSellDuplicate}
                  disabled={selling}
                >
                  {selling ? 'Revente…' : `Revendre doublon (${sellPrice} coins)`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
