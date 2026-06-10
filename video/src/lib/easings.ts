import { Easing } from 'remotion';

export const EASE_OUT_CUBIC = Easing.bezier(0.4, 0, 0.2, 1);
export const EASE_SPRING_BOUNCY = { damping: 8, stiffness: 70, mass: 1 };
export const EASE_SPRING_SNAPPY = { damping: 14, stiffness: 200, mass: 1 };
export const EASE_SPRING_GENTLE = { damping: 20, stiffness: 150, mass: 1 };
