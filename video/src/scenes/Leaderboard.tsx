import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TextReveal } from '../components/TextReveal';
import { COLORS } from '../lib/colors';
import { EASE_OUT_CUBIC, EASE_SPRING_SNAPPY } from '../lib/easings';
import { FONT_CONDENSED, FONT_DISPLAY, FONT_MONO } from '../lib/fonts';

const PLAYERS = [
  { medal: '🥇', name: 'Ash_Ketchum', maxCoins: 4250, delay: 8,  color: COLORS.GOLD, bg: 'rgba(245,166,35,0.1)' },
  { medal: '🥈', name: 'MistyWater',  maxCoins: 3890, delay: 20, color: '#c0c0c0',   bg: 'rgba(192,192,192,0.08)' },
  { medal: '🥉', name: 'Brock_Rock',  maxCoins: 3450, delay: 32, color: '#cd7f32',   bg: 'rgba(205,127,50,0.08)' },
];

interface RowProps {
  medal: string;
  name: string;
  maxCoins: number;
  delay: number;
  rowColor: string;
  bg: string;
  frame: number;
  fps: number;
}

const LeaderboardRow: React.FC<RowProps> = ({ medal, name, maxCoins, delay, rowColor, bg, frame, fps }) => {
  const rowSpring = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 180,
    to: 0,
    config: EASE_SPRING_SNAPPY,
  });
  const rowOpacity = interpolate(Math.max(0, frame - delay), [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const coins = Math.floor(interpolate(Math.max(0, frame - delay - 5), [0, 55], [0, maxCoins], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_CUBIC,
  }));

  return (
    <div style={{
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      padding: '20px 36px',
      borderRadius: 16,
      background: bg,
      border: `1.5px solid ${rowColor}33`,
      transform: `translateX(${rowSpring}px)`,
      opacity: rowOpacity,
      width: 820,
      gap: 24,
    }}>
      <div style={{ fontSize: 52, lineHeight: 1, width: 60, textAlign: 'center' }}>{medal}</div>
      <div style={{
        fontFamily: FONT_CONDENSED,
        fontSize: 38,
        fontWeight: 700,
        color: COLORS.TEXT_PRIMARY,
        letterSpacing: '0.02em',
        flex: 1,
      }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 40,
          fontWeight: 600,
          color: rowColor,
          letterSpacing: '-0.02em',
          minWidth: 100,
          textAlign: 'right',
        }}>
          {coins.toLocaleString()}
        </div>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.GOLD,
        }}>
          🪙
        </div>
      </div>
    </div>
  );
};

export const Leaderboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        background: `radial-gradient(ellipse 70% 40% at 50% 50%, ${COLORS.GOLD_DIM} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Title */}
      <TextReveal delay={4} style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.TEXT_PRIMARY,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          Grimpe au leaderboard
        </div>
      </TextReveal>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PLAYERS.map((p) => (
          <LeaderboardRow
            key={p.name}
            medal={p.medal}
            name={p.name}
            maxCoins={p.maxCoins}
            delay={p.delay}
            rowColor={p.color}
            bg={p.bg}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>

      <TextReveal delay={40} style={{ textAlign: 'center', marginTop: 32 }}>
        <div style={{
          fontFamily: FONT_CONDENSED,
          fontSize: 26,
          fontWeight: 600,
          color: COLORS.TEXT_MUTED,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Classement en temps réel
        </div>
      </TextReveal>
    </AbsoluteFill>
  );
};
