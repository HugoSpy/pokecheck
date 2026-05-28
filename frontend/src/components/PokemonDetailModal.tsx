import { useState, useEffect, useCallback } from 'react';
import type { UserPokemonInstance } from '../api';
import RarityBadge from './RarityBadge';
import './PokemonDetailModal.css';

const RARITY_COLOR: Record<string, string> = {
  COMMON:    '#9ca3af',
  RARE:      '#3b82f6',
  EPIC:      '#a855f7',
  LEGENDARY: '#f5a623',
};
const SHINY_GOLD = '#d4af37';

function getSlugFromSpriteUrl(spriteUrl: string): string {
  return spriteUrl.split('/').pop()?.replace('.png', '') ?? '';
}

interface Props {
  pokemon: UserPokemonInstance;
  onClose: () => void;
}

export default function PokemonDetailModal({ pokemon, onClose }: Props) {
  const isShiny    = pokemon.is_shiny ?? false;
  const isLegendary = pokemon.rarity === 'LEGENDARY';
  const accentColor = RARITY_COLOR[pokemon.rarity] ?? '#9ca3af';

  const slug   = getSlugFromSpriteUrl(pokemon.sprite_url);
  const gifUrl = isShiny
    ? `https://projectpokemon.org/images/shiny-sprite/${slug}.gif`
    : `https://projectpokemon.org/images/normal-sprite/${slug}.gif`;

  const [imgSrc, setImgSrc] = useState(gifUrl);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const panelStyle = isLegendary
    ? undefined
    : { border: `2px solid ${isShiny ? SHINY_GOLD + '88' : accentColor + '44'}` };

  return (
    <div className="pdm-backdrop" onClick={onClose}>
      <div
        className={[
          'pdm-panel',
          isLegendary ? 'pdm-panel--legendary' : '',
          isShiny ? 'pdm-panel--shiny' : '',
        ].filter(Boolean).join(' ')}
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        <button className="pdm-close" onClick={onClose}>✕</button>

        <div className="pdm-sprite-wrap">
          {isShiny && <div className="pdm-shiny-shimmer" />}
          <img
            src={imgSrc}
            onError={() => setImgSrc(pokemon.sprite_url)}
            alt={pokemon.name}
            className="pdm-sprite"
            style={{
              filter: isShiny
                ? `drop-shadow(0 0 18px ${SHINY_GOLD}cc) drop-shadow(0 0 6px ${SHINY_GOLD}88)`
                : isLegendary
                  ? `drop-shadow(0 0 12px ${accentColor}88)`
                  : `drop-shadow(0 4px 8px rgba(0,0,0,0.6))`,
            }}
          />
          {isShiny && <span className="pdm-shiny-badge">✨ SHINY</span>}
        </div>

        <h2 className="pdm-name">{pokemon.name}</h2>

        <div className="pdm-rarity-row">
          <RarityBadge rarity={pokemon.rarity} size="md" />
          <span className="pdm-points" style={{ color: isShiny ? SHINY_GOLD : accentColor }}>
            +{pokemon.points} pts
          </span>
        </div>

        {pokemon.types?.length > 0 && (
          <div className="pdm-types">
            {pokemon.types.map(t => (
              <span key={t} className="pdm-type-chip">{t}</span>
            ))}
          </div>
        )}

        <div className="pdm-stats">
          <div className="pdm-stat">
            <span className="pdm-stat-label">Génération</span>
            <span className="pdm-stat-value">{pokemon.generation}</span>
          </div>
          <div className="pdm-stat">
            <span className="pdm-stat-label">Obtenu</span>
            <span className="pdm-stat-value">
              {new Date(pokemon.obtainedAt).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
