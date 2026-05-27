import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { consumeOneShotToken, draw, getRandomPokemons, type RollCardData, type PokemonInfo } from '../api';
import './OpenPack.css';

type Phase = 'idle' | 'loading' | 'rolling' | 'reveal' | 'done';

const CARD_WIDTH = 155;
const CARD_GAP = 12;
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;
const TOTAL_CARDS = 30;
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

export default function OpenPack() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [phase, setPhase] = useState<Phase>('idle');
  const [cards, setCards] = useState<RollCardData[]>([]);
  const [pokemon, setPokemon] = useState<PokemonInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);

  async function handleOpen() {
    if (!token) { setError('Token manquant.'); return; }
    setPhase('loading');
    setError(null);

    try {
      await consumeOneShotToken(token);
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(e.status === 410 ? 'Token déjà utilisé.' : e.message);
      setPhase('idle');
      return;
    }

    try {
      const [randResult, drawResult] = await Promise.all([
        getRandomPokemons(TOTAL_CARDS),
        draw('draw'),
      ]);

      const strip = [...randResult.pokemons] as RollCardData[];
      strip[TARGET_INDEX] = drawResult.pokemon as RollCardData;

      setCards(strip);
      setPokemon(drawResult.pokemon);
      setShowBadge(false);
      setPhase('rolling');
    } catch (err) {
      const e = err as Error & { status?: number };
      setError(e.status === 403 ? "Tu as déjà tiré aujourd'hui !" : (err as Error).message);
      setPhase('idle');
    }
  }

  // Set strip to start position before paint (avoids flash)
  useLayoutEffect(() => {
    if (phase !== 'rolling' || !stripRef.current) return;
    const strip = stripRef.current;
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${window.innerWidth + 300}px)`;
  }, [phase]);

  // Trigger roll animation after layout
  useEffect(() => {
    if (phase !== 'rolling' || !stripRef.current) return;
    const strip = stripRef.current;
    const vw = window.innerWidth;
    const endX = vw / 2 - TARGET_INDEX * CARD_STRIDE - CARD_WIDTH / 2;

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

  return (
    <div className={`pack-page ${phase} ${pokemon?.rarity?.toLowerCase() ?? ''}`}>
      <div className="scanlines" />

      {showFlash && pokemon && (
        <div
          className="rarity-flash"
          style={{ background: RARITY_FLASH[pokemon.rarity] ?? 'rgba(255,255,255,0.3)' }}
        />
      )}

      <div className="pack-logo">
        <span style={{ color: 'var(--accent)' }}>Poké</span>School
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

          <button className="open-btn" onClick={handleOpen} disabled={!token}>
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
                  return (
                    <div
                      key={`${i}-${card.id}`}
                      className={`roll-card${isWinner ? ' roll-card-winner' : ''}`}
                      style={{
                        '--card-border': RARITY_BORDER[card.rarity] ?? '#4b5563',
                        ...(isWinner ? { '--card-glow': rarityGlow } : {}),
                      } as React.CSSProperties}
                    >
                      <img
                        src={card.sprite_url}
                        alt={card.name}
                        className="roll-card-img"
                        loading="lazy"
                      />
                      <div className="roll-card-name">{card.name}</div>
                      <div
                        className="roll-card-rarity"
                        style={{ color: RARITY_BORDER[card.rarity] ?? '#4b5563' }}
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
            <div className={`reveal-block${showBadge ? ' reveal-block-visible' : ''}`}>
              <div className="reveal-rarity" style={{ color: rarityGlow }}>
                {pokemon.rarity === 'LEGENDARY' ? '★ ' : ''}
                {RARITY_LABELS[pokemon.rarity]}
              </div>
              <div className="reveal-poke-name">{pokemon.name}</div>
              <div className="reveal-pts" style={{ color: rarityGlow }}>
                +{pokemon.points} pts
              </div>
            </div>
          )}

          {phase === 'done' && (
            <button
              className="open-btn open-btn-secondary"
              style={{ '--btn-color': rarityGlow } as React.CSSProperties}
              onClick={() => navigate('/pokedex')}
            >
              Voir mon Pokédex →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

