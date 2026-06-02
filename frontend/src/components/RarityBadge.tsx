import type { PokemonInfo } from '../api/types';

interface Props {
  rarity: PokemonInfo['rarity'];
  size?: 'sm' | 'md';
}

const CONFIG = {
  COMMON:    { label: 'Commun',     color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  RARE:      { label: 'Rare',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  EPIC:      { label: 'Épique',     color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
  LEGENDARY: { label: 'Légendaire', color: '#f5a623', bg: 'rgba(245,166,35,0.12)'  },
};

export default function RarityBadge({ rarity, size = 'md' }: Props) {
  const { label, color, bg } = CONFIG[rarity] ?? CONFIG.COMMON;
  const isLegendary = rarity === 'LEGENDARY';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 4,
        fontSize: size === 'sm' ? 10 : 11,
        fontFamily: 'var(--font-condensed)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color,
        background: bg,
        border: `1px solid ${color}33`,
        boxShadow: isLegendary ? `0 0 10px ${color}55, 0 0 20px ${color}22` : undefined,
        animation: isLegendary ? 'legendaryPulse 2s ease-in-out infinite' : undefined,
      }}
    >
      {isLegendary && <span style={{ fontSize: size === 'sm' ? 9 : 10 }}>★</span>}
      {label}
    </span>
  );
}
