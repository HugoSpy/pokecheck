import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const SceneFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 2, 4], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: 'white', opacity, pointerEvents: 'none', zIndex: 100 }} />
  );
};
