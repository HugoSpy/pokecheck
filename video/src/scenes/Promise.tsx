import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Pokeball } from '../components/Pokeball';
import { PokemonSprite } from '../components/PokemonSprite';
import { TextReveal } from '../components/TextReveal';
import { COLORS } from '../lib/colors';
import { FONT_CONDENSED, FONT_DISPLAY } from '../lib/fonts';

export const Promise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ball opens in first 20 frames
  const openProgress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ball scale up as it opens
  const ballScale = interpolate(frame, [0, 15, 25], [1, 1.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mewtwo springs out of ball
  const spriteScale = spring({
    frame: Math.max(0, frame - 18),
    fps,
    from: 0,
    to: 1,
    config: { damping: 10, stiffness: 120, mass: 1 },
  });

  // Rotation wobble on sprite
  const spriteRotation = interpolate(
    spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 6, stiffness: 80 } }),
    [0, 1], [-8, 0],
  );

  // Glow pulse after sprite appears
  const glowPulse = frame > 35
    ? 0.6 + interpolate(Math.sin((frame - 35) * 0.18), [-1, 1], [-0.15, 0.15])
    : interpolate(frame, [25, 45], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Flash from ball opening
  const flashOpacity = interpolate(frame, [0, 8, 20], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      background: COLORS.BG_VOID,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Background golden glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 60% 50% at 50% 48%, ${COLORS.GOLD_GLOW} 0%, transparent 65%)`,
        opacity: spriteScale * 0.8,
        pointerEvents: 'none',
      }} />

      {/* Opening ball (fades out as sprite appears) */}
      {ballScale > 0 && (
        <div style={{
          position: 'absolute',
          transform: `scale(${ballScale})`,
          opacity: 1 - spriteScale,
        }}>
          <Pokeball size={200} openProgress={openProgress} glowOpacity={openProgress * 0.6} />
        </div>
      )}

      {/* Mewtwo sprite */}
      <div style={{
        transform: `scale(${spriteScale}) rotate(${spriteRotation}deg)`,
        marginBottom: 48,
      }}>
        <PokemonSprite
          name="mewtwo"
          size={340}
          rarity="legendary"
          glowOpacity={glowPulse}
          scale={1}
        />
      </div>

      {/* Text */}
      <TextReveal delay={30} style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.TEXT_PRIMARY,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          textAlign: 'center',
        }}>
          ... 1 Pokémon offert
        </div>
      </TextReveal>

      <TextReveal delay={44} style={{ textAlign: 'center', marginTop: 16 }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 28,
          fontWeight: 600,
          color: COLORS.GOLD,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          à chaque présence validée
        </div>
      </TextReveal>

      {/* Flash */}
      {flashOpacity > 0 && (
        <AbsoluteFill style={{ background: 'white', opacity: flashOpacity, pointerEvents: 'none' }} />
      )}
    </AbsoluteFill>
  );
};
