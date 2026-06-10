import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Pokeball } from '../components/Pokeball';
import { TextReveal } from '../components/TextReveal';
import { COLORS } from '../lib/colors';
import { FONT_CONDENSED, FONT_DISPLAY } from '../lib/fonts';

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ballY = spring({
    frame,
    fps,
    from: -600,
    to: 0,
    config: { damping: 9, stiffness: 65, mass: 1.2 },
  });

  const glowOpacity = interpolate(frame, [20, 50], [0, 0.8], {
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
      {/* Background radial gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 70% 40% at 50% 45%, ${COLORS.ACCENT_DIM} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Pokéball with physics drop */}
      <div style={{ transform: `translateY(${ballY}px)`, marginBottom: 60 }}>
        <Pokeball size={180} glowOpacity={glowOpacity} />
      </div>

      {/* Main text */}
      <TextReveal delay={30} style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.TEXT_PRIMARY,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          textAlign: 'center',
        }}>
          À chaque cours...
        </div>
      </TextReveal>

      {/* Sub text */}
      <TextReveal delay={50} style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 32,
          fontWeight: 600,
          color: COLORS.ACCENT,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          check de présence en cours
        </div>
      </TextReveal>
    </AbsoluteFill>
  );
};
