import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Pokeball } from '../components/Pokeball';
import { COLORS } from '../lib/colors';
import { EASE_SPRING_SNAPPY } from '../lib/easings';
import { FONT_CONDENSED, FONT_DISPLAY } from '../lib/fonts';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo spring zoom in
  const logoProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: EASE_SPRING_SNAPPY,
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.6, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 0.5, 1], [0, 0.7, 1]);

  // URL appears slightly after
  const urlProgress = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: EASE_SPRING_SNAPPY,
  });

  // Sub-text
  const subProgress = spring({
    frame: Math.max(0, frame - 44),
    fps,
    config: EASE_SPRING_SNAPPY,
  });

  // Background Pokéball slow rotation
  const ballRotation = frame * 1.2;
  const ballOpacity = interpolate(frame, [0, 20], [0, 0.07], {
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
      gap: 0,
    }}>
      {/* Background gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${COLORS.ACCENT_DIM} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Background Pokéball (slow spin, very faint) */}
      <div style={{
        position: 'absolute',
        opacity: ballOpacity,
      }}>
        <Pokeball size={680} rotation={ballRotation} />
      </div>

      {/* Logo PokéCheck */}
      <div style={{
        transform: `scale(${logoScale})`,
        opacity: logoOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        marginBottom: 28,
      }}>
        {/* Pokéball icon above text */}
        <Pokeball size={88} glowOpacity={0.5} />

        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 108,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          textAlign: 'center',
        }}>
          <span style={{ color: COLORS.ACCENT }}>Poké</span>
          <span style={{ color: COLORS.TEXT_PRIMARY }}>Check</span>
        </div>
      </div>

      {/* URL */}
      <div style={{
        opacity: interpolate(urlProgress, [0, 0.5, 1], [0, 0.7, 1]),
        transform: `translateY(${interpolate(urlProgress, [0, 1], [20, 0])}px)`,
        marginBottom: 20,
      }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 52,
          fontWeight: 700,
          color: COLORS.ACCENT,
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}>
          pokecheck.fr
        </div>
      </div>

      {/* Sub-text */}
      <div style={{
        opacity: interpolate(subProgress, [0, 0.5, 1], [0, 0.6, 1]),
        transform: `translateY(${interpolate(subProgress, [0, 1], [12, 0])}px)`,
      }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 26,
          fontWeight: 500,
          color: COLORS.TEXT_MUTED,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Connexion Microsoft EPITA
        </div>
      </div>
    </AbsoluteFill>
  );
};
