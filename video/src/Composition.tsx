import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SceneFlash } from './components/SceneFlash';
import { CTA } from './scenes/CTA';
import { Collection } from './scenes/Collection';
import { Hook } from './scenes/Hook';
import { Leaderboard } from './scenes/Leaderboard';
import { Promise } from './scenes/Promise';
import { Trade } from './scenes/Trade';
import { COLORS } from './lib/colors';

const SCENE_DUR = 90; // 3s at 30fps
const TRANSITION_INDICES = [1, 2, 3, 4, 5];

export const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.BG_VOID }}>
      <Sequence from={0 * SCENE_DUR} durationInFrames={SCENE_DUR}><Hook /></Sequence>
      <Sequence from={1 * SCENE_DUR} durationInFrames={SCENE_DUR}><Promise /></Sequence>
      <Sequence from={2 * SCENE_DUR} durationInFrames={SCENE_DUR}><Collection /></Sequence>
      <Sequence from={3 * SCENE_DUR} durationInFrames={SCENE_DUR}><Trade /></Sequence>
      <Sequence from={4 * SCENE_DUR} durationInFrames={SCENE_DUR}><Leaderboard /></Sequence>
      <Sequence from={5 * SCENE_DUR} durationInFrames={SCENE_DUR}><CTA /></Sequence>

      {/* White flash transitions (3 frames centered on each scene boundary) */}
      {TRANSITION_INDICES.map((i) => (
        <Sequence key={i} from={i * SCENE_DUR - 2} durationInFrames={5}>
          <SceneFlash />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
