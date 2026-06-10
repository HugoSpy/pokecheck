import { loadFont as loadChakraPetch } from '@remotion/google-fonts/ChakraPetch';
import { loadFont as loadBarlowCondensed } from '@remotion/google-fonts/BarlowCondensed';
import { loadFont as loadIBMPlexMono } from '@remotion/google-fonts/IBMPlexMono';

export const { fontFamily: FONT_DISPLAY } = loadChakraPetch();
export const { fontFamily: FONT_CONDENSED } = loadBarlowCondensed();
export const { fontFamily: FONT_MONO } = loadIBMPlexMono();
