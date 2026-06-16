import { useState } from 'react';
import RarityBadge from './RarityBadge';
import PokemonDetailModal from './PokemonDetailModal';
import type { UserPokemonInstance } from '../api/types';
import { Lock } from './icons';
import './PokemonCard.css';

interface Props {
  pokemon: UserPokemonInstance;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (pokemon: UserPokemonInstance) => void;
  onSell?: (instanceId: string) => Promise<void>;
  /** When this card stands for a group of identical copies, the group size
   *  (renders a ×N badge). Used by the Pokédex "doublons" filter and the
   *  "stacker les doublons" toggle. */
  duplicateCount?: number;
  /** When set (and not in select mode), clicking the card calls this instead of
   *  opening the built-in detail modal. Used to open the stacked-copies modal. */
  onCardClick?: (pokemon: UserPokemonInstance) => void;
}

const RARITY_COLOR: Record<string, string> = {
  COMMON:    '#9ca3af',
  RARE:      '#3b82f6',
  EPIC:      '#a855f7',
  LEGENDARY: '#f5a623',
};

const SHINY_GOLD = '#d4af37';

export default function PokemonCard({ pokemon, selected = false, selectable = false, onSelect, onSell, duplicateCount, onCardClick }: Props) {
  const [imgError,    setImgError]    = useState(false);
  const [showDetail,  setShowDetail]  = useState(false);

  // Click priority: select mode (bulk-sell) > custom handler (stacked group) >
  // built-in detail modal.
  const handleActivate = () => {
    if (selectable) onSelect?.(pokemon);
    else if (onCardClick) onCardClick(pokemon);
    else setShowDetail(true);
  };
  const accentColor = RARITY_COLOR[pokemon.rarity] ?? '#9ca3af';
  const isLocked = pokemon.tradeable_at && new Date(pokemon.tradeable_at) > new Date();
  const isShiny = pokemon.is_shiny ?? false;

  const borderColor = isShiny
    ? SHINY_GOLD + (selected ? 'cc' : '66')
    : selected ? accentColor + '55' : 'var(--border)';

  const shadowStyle = isShiny
    ? `0 0 12px ${SHINY_GOLD}55, 0 0 24px ${SHINY_GOLD}22`
    : selected ? `0 0 16px ${accentColor}33` : 'var(--shadow-card)';

  return (
    <>
    {showDetail && (
      <PokemonDetailModal pokemon={pokemon} onClose={() => setShowDetail(false)} onSell={onSell} />
    )}
    <div
      onClick={handleActivate}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selectable ? selected : undefined}
      aria-label={selectable
        ? `Sélectionner ${pokemon.name}`
        : `Voir les détails de ${pokemon.name}`}
      className={isShiny ? 'pokemon-card-shiny' : undefined}
      style={{
        position: 'relative',
        background: isShiny
          ? `linear-gradient(145deg, ${SHINY_GOLD}18, var(--bg-card))`
          : selected
            ? `linear-gradient(145deg, ${accentColor}22, var(--bg-card))`
            : 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
        boxShadow: shadowStyle,
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        if (isShiny) {
          el.style.borderColor = SHINY_GOLD + 'aa';
          el.style.boxShadow = `0 8px 24px ${SHINY_GOLD}44`;
        } else {
          el.style.borderColor = accentColor + (selected ? '77' : '33');
          el.style.boxShadow = `0 8px 24px ${accentColor}22`;
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = '';
        el.style.borderColor = borderColor;
        el.style.boxShadow = shadowStyle;
      }}
    >
      {/* Rarity accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isShiny
          ? `linear-gradient(90deg, transparent, ${SHINY_GOLD}, transparent)`
          : `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        opacity: isShiny ? 0.9 : (selected ? 1 : 0.4),
      }} />

      {/* Shiny badge */}
      {isShiny && (
        <div className="shiny-card-badge">✨</div>
      )}

      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          background: isShiny ? SHINY_GOLD : accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#000', fontWeight: 700,
        }}>✓</div>
      )}

      {/* Duplicate-group count (e.g. ×3 when this card stands for 3 copies) */}
      {duplicateCount !== undefined && duplicateCount > 1 && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          padding: '1px 7px', borderRadius: 8,
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid ${(isShiny ? SHINY_GOLD : accentColor)}66`,
          color: 'var(--text-primary)', fontSize: 11, fontWeight: 700,
          fontFamily: 'var(--font-condensed)', lineHeight: 1.5,
        }}>×{duplicateCount}</div>
      )}

      {/* Lock indicator */}
      {isLocked && (
        <div style={{
          position: 'absolute', top: 8, left: isShiny ? 26 : 8,
          color: 'var(--text-muted)', display: 'flex',
        }}><Lock size={11} /></div>
      )}

      {/* Sprite */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 80, marginBottom: 8,
      }}>
        {!imgError ? (
          <img
            src={pokemon.sprite_url}
            alt={pokemon.name}
            style={{
              minWidth: 0, maxHeight: 80, maxWidth: '100%', objectFit: 'contain',
              imageRendering: 'pixelated',
              filter: isShiny
                ? `drop-shadow(0 0 10px ${SHINY_GOLD}cc) drop-shadow(0 0 4px ${SHINY_GOLD}88)`
                : pokemon.rarity === 'LEGENDARY'
                  ? `drop-shadow(0 0 8px ${accentColor}88)`
                  : `drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: isShiny ? `${SHINY_GOLD}22` : `${accentColor}22`,
            border: `2px solid ${isShiny ? SHINY_GOLD + '44' : accentColor + '33'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>?</div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontFamily: 'var(--font-condensed)',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        color: 'var(--text-primary)',
        textAlign: 'center',
        marginBottom: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {pokemon.name}
      </div>

      {/* Rarity + Points row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <RarityBadge rarity={pokemon.rarity} size="sm" />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: isShiny ? SHINY_GOLD : accentColor,
          fontWeight: 600,
        }}>
          +{pokemon.points}
        </span>
      </div>
    </div>
    </>
  );
}
