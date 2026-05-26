import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { consumeOneShotToken, draw, type PokemonInfo } from '../api';
import './OpenPack.css';

type Phase = 'idle' | 'opening' | 'reveal' | 'done';

const RARITY_THEME: Record<string, { primary: string; secondary: string; particles: string }> = {
  COMMON:    { primary: '#9ca3af', secondary: '#6b7280', particles: '#d1d5db' },
  RARE:      { primary: '#3b82f6', secondary: '#1d4ed8', particles: '#93c5fd' },
  EPIC:      { primary: '#a855f7', secondary: '#7c3aed', particles: '#d8b4fe' },
  LEGENDARY: { primary: '#f5a623', secondary: '#d97706', particles: '#fde68a' },
};

export default function OpenPack() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [phase, setPhase] = useState<Phase>('idle');
  const [pokemon, setPokemon] = useState<PokemonInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayedName, setDisplayedName] = useState('');
  const [showBadge, setShowBadge] = useState(false);

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const theme = pokemon ? (RARITY_THEME[pokemon.rarity] ?? RARITY_THEME.COMMON) : null;

  async function handleOpen() {
    if (!token) { setError('Token manquant.'); return; }

    setPhase('opening');
    setError(null);

    try {
      await consumeOneShotToken(token);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 410) { setError('Token déjà utilisé.'); setPhase('idle'); return; }
      setError(e.message); setPhase('idle'); return;
    }

    try {
      const result = await draw('draw');
      setPokemon(result.pokemon);
      await new Promise(r => setTimeout(r, 1200));
      setPhase('reveal');

      await new Promise(r => setTimeout(r, 600));
      startTypewriter(result.pokemon.name);

      await new Promise(r => setTimeout(r, result.pokemon.name.length * 60 + 500));
      setShowBadge(true);

      await new Promise(r => setTimeout(r, 800));
      setPhase('done');
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 403) {
        setError('Tu as déjà tiré aujourd\'hui !');
      } else {
        setError(e.message);
      }
      setPhase('idle');
    }
  }

  function startTypewriter(name: string) {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    let i = 0;
    setDisplayedName('');
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedName(name.slice(0, i));
      if (i >= name.length && typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    }, 55);
  }

  useEffect(() => () => { if (typewriterRef.current) clearInterval(typewriterRef.current); }, []);

  const isLegendary = pokemon?.rarity === 'LEGENDARY';

  return (
    <div
      className={`pack-page ${phase} ${pokemon?.rarity?.toLowerCase() ?? ''}`}
      style={theme ? { '--rarity-primary': theme.primary, '--rarity-secondary': theme.secondary, '--rarity-particles': theme.particles } as React.CSSProperties : undefined}
    >
      {/* Ambient scanlines */}
      <div className="scanlines" />

      {/* Particle field */}
      {phase === 'reveal' || phase === 'done' ? (
        <div className="particles" aria-hidden>
          {Array.from({ length: isLegendary ? 24 : 12 }).map((_, i) => (
            <div key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
      ) : null}

      {/* Flash overlay */}
      <div className={`flash-overlay ${phase === 'opening' ? 'flash-active' : ''}`} />

      {/* Main stage */}
      <div className="pack-stage">

        {/* IDLE & OPENING: Pokéball */}
        {(phase === 'idle' || phase === 'opening') && (
          <div className={`pokeball-wrap ${phase === 'opening' ? 'spinning' : 'pulsing'}`}>
            <div className="pokeball">
              <div className="pokeball-top" />
              <div className="pokeball-band" />
              <div className="pokeball-bottom" />
              <div className="pokeball-center">
                <div className="pokeball-button" />
              </div>
            </div>
            <div className="pokeball-glow" />
          </div>
        )}

        {/* REVEAL & DONE: Pokémon */}
        {(phase === 'reveal' || phase === 'done') && pokemon && (
          <div className={`reveal-container ${phase === 'reveal' ? 'reveal-enter' : ''}`}>

            {/* Radial glow behind sprite */}
            <div className="reveal-glow" />

            {/* Sprite */}
            <div className="reveal-sprite-wrap">
              <img
                src={pokemon.sprite_url}
                alt={pokemon.name}
                className={`reveal-sprite ${isLegendary ? 'legendary-float' : ''}`}
              />
            </div>

            {/* Name typewriter */}
            <div className="reveal-name">
              {displayedName}
              <span className="cursor">|</span>
            </div>

            {/* Badge + points */}
            <div className={`reveal-info ${showBadge ? 'info-visible' : ''}`}>
              <RarityBadgeLarge rarity={pokemon.rarity} />
              <div className="reveal-points">
                <span className="points-value">+{pokemon.points}</span>
                <span className="points-label">pts</span>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="pack-error">
            <div className="pack-error-icon">⚠</div>
            <div className="pack-error-msg">{error}</div>
          </div>
        )}

        {/* CTA */}
        <div className="pack-cta">
          {phase === 'idle' && !error && (
            <button
              className="open-btn"
              onClick={handleOpen}
              disabled={!token}
            >
              <span className="open-btn-shine" />
              Ouvrir mon pack
            </button>
          )}

          {phase === 'done' && (
            <button
              className="open-btn open-btn-secondary"
              onClick={() => navigate('/pokedex')}
            >
              Voir mon Pokédex →
            </button>
          )}
        </div>
      </div>

      {/* Corner logo */}
      <div className="pack-logo">
        <span style={{ color: 'var(--accent)' }}>Poké</span>School
      </div>
    </div>
  );
}

function RarityBadgeLarge({ rarity }: { rarity: PokemonInfo['rarity'] }) {
  const CONFIG = {
    COMMON:    { label: 'Commun',     color: '#9ca3af' },
    RARE:      { label: 'Rare',       color: '#3b82f6' },
    EPIC:      { label: 'Épique',     color: '#a855f7' },
    LEGENDARY: { label: 'Légendaire', color: '#f5a623' },
  };
  const { label, color } = CONFIG[rarity];

  return (
    <span style={{
      fontFamily: 'var(--font-condensed)',
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color,
      textShadow: `0 0 20px ${color}88`,
    }}>
      {rarity === 'LEGENDARY' && '★ '}{label}
    </span>
  );
}
