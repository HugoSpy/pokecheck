import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PokemonSprite } from '../components/PokemonSprite';
import { TextReveal } from '../components/TextReveal';
import { COLORS } from '../lib/colors';
import { EASE_OUT_CUBIC } from '../lib/easings';
import { FONT_CONDENSED, FONT_MONO } from '../lib/fonts';

const GRID_SPRITES: Array<{ name: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }> = [
  { name: 'rayquaza', rarity: 'legendary' },
  { name: 'charizard', rarity: 'epic' },
  { name: 'mewtwo', rarity: 'legendary' },
  { name: 'lugia', rarity: 'legendary' },
  { name: 'gengar', rarity: 'rare' },
  { name: 'lucario', rarity: 'rare' },
  { name: 'gardevoir', rarity: 'rare' },
  { name: 'dragonite', rarity: 'rare' },
  { name: 'gyarados', rarity: 'rare' },
  { name: 'umbreon', rarity: 'rare' },
  { name: 'espeon', rarity: 'rare' },
  { name: 'alakazam', rarity: 'common' },
  { name: 'pikachu', rarity: 'common' },
  { name: 'eevee', rarity: 'common' },
  { name: 'snorlax', rarity: 'common' },
  { name: 'blastoise', rarity: 'common' },
];

const COLS = 4;
const ROWS = 4;
const CELL = 224;

export const Collection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.floor(interpolate(frame, [15, 82], [0, 809], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_CUBIC,
  }));

  const titleProgress = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14, stiffness: 180 } });

  return (
    <AbsoluteFill style={{
      background: COLORS.BG_VOID,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 50% at 50% 40%, ${COLORS.ACCENT_DIM} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Grid title */}
      <div style={{
        opacity: titleProgress,
        transform: `translateY(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
        marginBottom: 32,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.TEXT_MUTED,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Ta collection
        </div>
      </div>

      {/* Sprite grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
        gap: 0,
      }}>
        {GRID_SPRITES.map((sprite, i) => {
          const delay = i * 3;
          const itemSpring = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 12, stiffness: 160 },
          });
          const itemOpacity = interpolate(itemSpring, [0, 0.4, 1], [0, 0.6, 1]);
          const itemScale = interpolate(itemSpring, [0, 1], [0.4, 1]);
          const glowOpacity = interpolate(itemSpring, [0.7, 1], [0, 0.45], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          return (
            <div key={sprite.name} style={{
              width: CELL, height: CELL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: itemOpacity,
              transform: `scale(${itemScale})`,
            }}>
              <PokemonSprite
                name={sprite.name}
                size={CELL * 0.78}
                rarity={sprite.rarity}
                glowOpacity={glowOpacity}
              />
            </div>
          );
        })}
      </div>

      {/* Counter + label */}
      <TextReveal delay={12} style={{ textAlign: 'center', marginTop: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 80,
            fontWeight: 600,
            color: COLORS.ACCENT,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            {count.toString().padStart(3, '0')}
          </div>
          <div style={{
            fontFamily: FONT_CONDENSED,
            fontSize: 26,
            fontWeight: 600,
            color: COLORS.TEXT_SECONDARY,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Pokémons à collectionner
          </div>
        </div>
      </TextReveal>
    </AbsoluteFill>
  );
};
