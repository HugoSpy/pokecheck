import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { EASE_SPRING_SNAPPY } from '../lib/easings';

interface TextRevealProps {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  translateY?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  children,
  delay = 0,
  style,
  translateY = 24,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: EASE_SPRING_SNAPPY,
  });

  const opacity = interpolate(progress, [0, 0.5, 1], [0, 0.8, 1]);
  const y = interpolate(progress, [0, 1], [translateY, 0]);

  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
};
