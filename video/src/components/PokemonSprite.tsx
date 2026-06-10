import React from 'react';
import { Img, staticFile } from 'remotion';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const GLOW: Record<Rarity, string> = {
  common: 'rgba(156,163,175,0.35)',
  rare: 'rgba(59,130,246,0.5)',
  epic: 'rgba(168,85,247,0.6)',
  legendary: 'rgba(245,166,35,0.7)',
};

interface PokemonSpriteProps {
  name: string;
  size?: number;
  rarity?: Rarity;
  glowOpacity?: number;
  scale?: number;
}

export const PokemonSprite: React.FC<PokemonSpriteProps> = ({
  name,
  size = 160,
  rarity = 'common',
  glowOpacity = 0,
  scale = 1,
}) => {
  const glowColor = GLOW[rarity];

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `scale(${scale})`,
    }}>
      {glowOpacity > 0 && (
        <div style={{
          position: 'absolute',
          inset: -size * 0.4,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 65%)`,
          opacity: glowOpacity,
          pointerEvents: 'none',
        }} />
      )}
      <Img
        src={staticFile(`sprites/${name}.png`)}
        style={{
          width: size * 0.88,
          height: size * 0.88,
          objectFit: 'contain',
          position: 'relative',
          zIndex: 1,
          imageRendering: 'auto',
        }}
      />
    </div>
  );
};
