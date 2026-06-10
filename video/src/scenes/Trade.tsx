import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PokemonSprite } from '../components/PokemonSprite';
import { TextReveal } from '../components/TextReveal';
import { COLORS } from '../lib/colors';
import { EASE_SPRING_SNAPPY } from '../lib/easings';
import { FONT_CONDENSED, FONT_DISPLAY } from '../lib/fonts';

export const Trade: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftX = spring({ frame: Math.max(0, frame - 5), fps, from: -300, to: 0, config: EASE_SPRING_SNAPPY });
  const rightX = spring({ frame: Math.max(0, frame - 5), fps, from: 300, to: 0, config: EASE_SPRING_SNAPPY });

  const arrowProgress = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 10, stiffness: 160 } });

  // Arrow pulse after appearing
  const arrowPulse = frame > 30
    ? 1 + interpolate(Math.sin((frame - 30) * 0.22), [-1, 1], [-0.12, 0.12])
    : 1;

  const arrowScale = arrowProgress * arrowPulse;

  const arrowGlow = frame > 30
    ? 0.5 + interpolate(Math.sin((frame - 30) * 0.22), [-1, 1], [-0.2, 0.2])
    : interpolate(arrowProgress, [0, 1], [0, 0.5]);

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
        background: `radial-gradient(ellipse 70% 40% at 50% 48%, ${COLORS.ACCENT_DIM} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Sprites row */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        width: 900,
        marginBottom: 48,
      }}>
        {/* Charizard */}
        <div style={{ transform: `translateX(${leftX}px)` }}>
          <PokemonSprite name="charizard" size={280} rarity="epic" glowOpacity={0.5} />
        </div>

        {/* Arrow ⇄ */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          transform: `scale(${arrowScale})`,
          opacity: arrowProgress,
          width: 120,
          flexShrink: 0,
        }}>
          {/* Glow behind arrow */}
          <div style={{
            position: 'absolute',
            width: 120, height: 60,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.ACCENT_GLOW} 0%, transparent 70%)`,
            opacity: arrowGlow,
          }} />
          <div style={{
            fontFamily: 'monospace',
            fontSize: 72,
            color: COLORS.ACCENT,
            lineHeight: 1,
            position: 'relative',
            textShadow: `0 0 24px ${COLORS.ACCENT_GLOW}`,
          }}>
            ⇄
          </div>
        </div>

        {/* Gengar */}
        <div style={{ transform: `translateX(${rightX}px)` }}>
          <PokemonSprite name="gengar" size={280} rarity="rare" glowOpacity={0.5} />
        </div>
      </div>

      {/* Main text */}
      <TextReveal delay={18} style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.TEXT_PRIMARY,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          textAlign: 'center',
        }}>
          Échangez avec la promo
        </div>
      </TextReveal>

      <TextReveal delay={32} style={{ textAlign: 'center', marginTop: 16 }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 30,
          fontWeight: 600,
          color: COLORS.TEXT_SECONDARY,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          Marché · ventes · échanges 1v1
        </div>
      </TextReveal>
    </AbsoluteFill>
  );
};
