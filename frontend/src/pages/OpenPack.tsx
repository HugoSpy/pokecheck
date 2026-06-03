import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { consumeOneShotToken, consumeOneShotCode } from '../api/authApi';
import { draw, getRandomPokemons } from '../api/pokemonApi';
import { getAttendanceAvailable, openAttendance, type AttendanceAvailable } from '../api/attendanceApi';
import { useUserCtx } from '../context/UserContext';
import type { RollCardData, PokemonInfo } from '../api/types';
import './OpenPack.css';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

export default function OpenPack() {
  const [params] = useSearchParams();
  const { authenticated, loading: authLoading, refreshProfile } = useUserCtx();
  const navigate = useNavigate();
  const code = params.get('code');
  const token = params.get('token');

  const [phase, setPhase] = useState<Phase>('idle');
  const [cards, setCards] = useState<RollCardData[]>([]);
  const [pokemon, setPokemon] = useState<PokemonInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [forceShiny, setForceShiny] = useState(false);
  const [progress, setProgress] = useState(0);

  // ── Attendance mode (when no one-shot code/token in the URL) ──
  const isOneShot = !!(code || token);
  const authed = authenticated;
  const [attendance, setAttendance] = useState<AttendanceAvailable | null>(null);
  const [attLoading, setAttLoading] = useState(!isOneShot && (authLoading || authed));
  const [now, setNow] = useState(Date.now());

  const stripRef = useRef<HTMLDivElement>(null);

  // Countdown tick
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const fetchAttendance = useCallback(async (showLoading = false) => {
    if (isOneShot || authLoading || !authed) return;
    if (showLoading) setAttLoading(true);

    try {
      setAttendance(await getAttendanceAvailable());
    } catch {
      setAttendance({ available: false, reason: 'unknown' });
    } finally {
      setAttLoading(false);
    }
  }, [isOneShot, authLoading, authed]);

  // Fetch attendance availability immediately in attendance mode.
  useEffect(() => {
    void fetchAttendance(true);
  }, [fetchAttendance]);

  // Refresh stale availability when the tab/window becomes active again.
  useEffect(() => {
    if (isOneShot || authLoading || !authed) return;

    const refetch = () => {
      if (document.visibilityState === 'visible') void fetchAttendance();
    };

    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', refetch);

    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', refetch);
    };
  }, [isOneShot, authLoading, authed, fetchAttendance]);

  // Poll only on /open attendance mode while the user is waiting to open.
  useEffect(() => {
    if (isOneShot || authLoading || !authed || phase !== 'idle') return;

    const interval = window.setInterval(() => {
      void fetchAttendance();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isOneShot, authLoading, authed, phase, fetchAttendance]);

  const attRemainingMs = attendance?.expires_at
    ? new Date(attendance.expires_at).getTime() - now
    : 0;
  const attAvailable = !!attendance?.available && !!attendance.attendance_id && attRemainingMs > 0;
  const canOpen = isOneShot || attAvailable;

  async function handleOpen() {
    if (!canOpen) { setError('Aucun pack disponible.'); return; }
    setPhase('loading');
    setError(null);

    try {
      let drawnPokemon: PokemonInfo;
      let randResult: { pokemons: RollCardData[] };

      if (isOneShot) {
        let resolvedForceShiny = forceShiny;
        if (code) {
          const result = await consumeOneShotCode(code);
          resolvedForceShiny = result.force_shiny ?? false;
          setForceShiny(resolvedForceShiny);
        } else {
          await consumeOneShotToken(token!);
        }
        await refreshProfile();
        const [rand, drawResult] = await Promise.all([
          getRandomPokemons(TOTAL_CARDS),
          draw(resolvedForceShiny),
        ]);
        randResult = rand;
        drawnPokemon = drawResult.pokemon;
      } else {
        const [rand, openResult] = await Promise.all([
          getRandomPokemons(TOTAL_CARDS),
          openAttendance(attendance!.attendance_id!),
        ]);
        randResult = rand;
        drawnPokemon = openResult.pokemon;
      }

      const strip = randResult.pokemons.map(card => {
        const shiny = Math.random() < 1 / 4096;
        return {
          ...card,
          is_shiny: shiny,
          sprite_url: shiny ? card.sprite_url.replace('/normal/', '/shiny/') : card.sprite_url,
        };
      }) as RollCardData[];
      strip[TARGET_INDEX] = drawnPokemon as RollCardData;

      const allSprites = [drawnPokemon.sprite_url, ...randResult.pokemons.map(p => p.sprite_url)];
      setProgress(0);
      await Promise.race([
        preloadImages(allSprites, (loaded, total) => setProgress(loaded / total)),
        new Promise<void>(resolve => setTimeout(resolve, 8000)),
      ]);

      setCards(strip);
      setPokemon(drawnPokemon);
      setShowBadge(false);
      setPhase('rolling');
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 410) setError('Token déjà utilisé.');
      else if (e.status === 403) setError(isOneShot ? "Tu as déjà tiré aujourd'hui !" : (e.message || 'Pack indisponible.'));
      else setError(e.message);
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

  return (
    <div className={`pack-page ${phase} ${pokemon?.rarity?.toLowerCase() ?? ''}`}>
      {/* /open is rendered outside <Layout> (fullscreen animation) — provide a
          minimal escape hatch so the user isn't stranded without browser back */}
      <Link to="/leaderboard" className="pack-home-btn">← Accueil</Link>

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
          <div className={`pokeball-wrap${canOpen ? ' pulsing' : ''}`} style={canOpen ? {} : { opacity: 0.3 }}>
            <div className="pokeball">
              <div className="pokeball-top" />
              <div className="pokeball-band" />
              <div className="pokeball-bottom" />
              <div className="pokeball-center"><div className="pokeball-button" /></div>
            </div>
            <div className="pokeball-glow" />
          </div>

          {isOneShot ? (
            <>
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
            </>
          ) : authLoading || attLoading ? (
            <div className="loading-label">Vérification…</div>
          ) : !authed ? (
            <p className="pack-intranet-msg">
              Connecte-toi pour ouvrir ton pack lors d'un check présence.
            </p>
          ) : attAvailable ? (
            <>
              <div className="pack-countdown">
                Pack disponible — expire dans <strong>{formatCountdown(attRemainingMs)}</strong>
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
            </>
          ) : (
            <p className="pack-intranet-msg">
              Aucun pack disponible. Attends le prochain check présence.
            </p>
          )}
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
