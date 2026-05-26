import { useState } from 'react';
import RarityBadge from './RarityBadge';
import type { UserPokemonInstance } from '../api';

interface Props {
  pokemon: UserPokemonInstance;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (pokemon: UserPokemonInstance) => void;
}

const RARITY_COLOR: Record<string, string> = {
  COMMON:    '#9ca3af',
  RARE:      '#3b82f6',
  EPIC:      '#a855f7',
  LEGENDARY: '#f5a623',
};

export default function PokemonCard({ pokemon, selected = false, selectable = false, onSelect }: Props) {
  const [imgError, setImgError] = useState(false);
  const accentColor = RARITY_COLOR[pokemon.rarity] ?? '#9ca3af';
  const isLocked = pokemon.tradeable_at && new Date(pokemon.tradeable_at) > new Date();

  return (
    <div
      onClick={() => selectable && onSelect?.(pokemon)}
      style={{
        position: 'relative',
        background: selected
          ? `linear-gradient(145deg, ${accentColor}22, var(--bg-card))`
          : 'var(--bg-card)',
        border: `1px solid ${selected ? accentColor + '55' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '12px',
        cursor: selectable ? 'pointer' : 'default',
        transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
        boxShadow: selected ? `0 0 16px ${accentColor}33` : 'var(--shadow-card)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.borderColor = accentColor + (selected ? '77' : '33');
        el.style.boxShadow = `0 8px 24px ${accentColor}22`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = '';
        el.style.borderColor = selected ? accentColor + '55' : 'var(--border)';
        el.style.boxShadow = selected ? `0 0 16px ${accentColor}33` : 'var(--shadow-card)';
      }}
    >
      {/* Rarity accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        opacity: selected ? 1 : 0.4,
      }} />

      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          background: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#000', fontWeight: 700,
        }}>✓</div>
      )}

      {/* Lock indicator */}
      {isLocked && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 11, color: 'var(--text-muted)',
        }}>🔒</div>
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
              maxHeight: 80, maxWidth: '100%', objectFit: 'contain',
              imageRendering: 'pixelated',
              filter: pokemon.rarity === 'LEGENDARY'
                ? `drop-shadow(0 0 8px ${accentColor}88)`
                : `drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `${accentColor}22`,
            border: `2px solid ${accentColor}33`,
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
          color: accentColor,
          fontWeight: 600,
        }}>
          +{pokemon.points}
        </span>
      </div>
    </div>
  );
}
