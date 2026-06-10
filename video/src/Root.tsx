import React from 'react';
import { Composition } from 'remotion';
import { MainComposition } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainComposition"
      component={MainComposition}
      durationInFrames={540}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
