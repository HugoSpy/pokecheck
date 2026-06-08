import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RollCardData } from '../api/types';

// Phase 2 — the CSGO-style pack-opening animation, extracted verbatim from
// EventPackOpen.tsx so the battle arena is a pixel-for-pixel copy of the solo
// reveal (same constants, same timing, same OpenPack.css classes). The only
// difference: instead of a button kicking off the roll, it begins at a shared
// `startAt` epoch timestamp so every player in a battle animates in lockstep.
//
// Markup/class parity with OpenPack.css is intentional — do not restyle here.

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

// The reveal info the component needs about the winning card (strip[22]).
export interface PackRollWinner {
  name: string;
  rarity: string;
  points: number;
  is_shiny: boolean;
}

type Phase = 'waiting' | 'rolling' | 'reveal' | 'done';

interface PackRollProps {
  strip: RollCardData[];
  winner: PackRollWinner;
  /** Shared epoch-ms timestamp at which the roll should begin. */
  startAt: number;
  /** Render the full-screen-style rarity flash (only the local player). */
  flash?: boolean;
  /** Called once when this roll reaches its 'done' state. */
  onDone?: () => void;
}

export default function PackRoll({ strip: cards, winner, startAt, flash = false, onDone }: PackRollProps) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [showFlash, setShowFlash] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const rarityGlow = RARITY_GLOW[winner.rarity] ?? '#9ca3af';

  // Park the strip off-screen right before first paint (avoids a flash of the
  // unscrolled strip) — identical to the solo useLayoutEffect.
  useLayoutEffect(() => {
    if (!stripRef.current) return;
    const strip = stripRef.current;
    const vpW = (strip.parentElement as HTMLElement).offsetWidth;
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${vpW + 300}px)`;
  }, []);

  // Arm the roll for the shared start time. A negative delay (event arrived late)
  // clamps to 0 so a straggler still starts immediately.
  useEffect(() => {
    const delay = Math.max(0, startAt - Date.now());
    const t = setTimeout(() => setPhase('rolling'), delay);
    return () => clearTimeout(t);
  }, [startAt]);

  // Roll → flash → reveal → done. Timing copied exactly from EventPackOpen.
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
      if (flash) {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 300);
      }
      setPhase('reveal');
      setTimeout(() => setShowBadge(true), 500);
      setTimeout(() => {
        setPhase('done');
        onDoneRef.current?.();
      }, 1800);
    }, ROLL_DURATION);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [phase, flash]);

  return (
    <div className="roll-frame battle-roll-frame">
      {showFlash && (
        <div
          className={`rarity-flash${winner.is_shiny ? ' shiny-flash' : ''}`}
          style={{ background: winner.is_shiny ? 'rgba(255,255,255,0.98)' : (RARITY_FLASH[winner.rarity] ?? 'rgba(255,255,255,0.3)') }}
        />
      )}

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
              const winnerShiny = isWinner && winner.is_shiny;
              const borderColor = winnerShiny ? '#d4af37' : (RARITY_BORDER[card.rarity] ?? '#4b5563');
              const glowColor = winnerShiny ? '#FFD700' : rarityGlow;
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
                  <img src={card.sprite_url} alt={card.name} className="roll-card-img" />
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
      {(phase === 'reveal' || phase === 'done') && (
        <div className={`reveal-block${showBadge ? ' reveal-block-visible' : ''}${winner.is_shiny ? ' reveal-block-shiny' : ''}`}>
          {winner.is_shiny && (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="sparkle" style={{ '--i': i } as React.CSSProperties} />
              ))}
              <div className="shiny-badge">✨ SHINY</div>
            </>
          )}
          <div className="reveal-rarity" style={{ color: winner.is_shiny ? '#FFD700' : rarityGlow }}>
            {winner.rarity === 'LEGENDARY' ? '★ ' : ''}
            {RARITY_LABELS[winner.rarity] ?? winner.rarity}
          </div>
          <div className="reveal-poke-name">{winner.name}</div>
          <div className="reveal-pts" style={{ color: winner.is_shiny ? '#FFD700' : rarityGlow }}>
            +{winner.points} pts
          </div>
        </div>
      )}
    </div>
  );
}
