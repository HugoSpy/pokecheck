// Maps each trainer badge ID to its avatar GIF in public/trainers/. Owning (and
// claiming) the badge unlocks the matching avatar - see the "Avatar Dresseur"
// section in Profile.tsx and the display override in UserPokedex.tsx.
// Placeholder 1×1 GIFs ship today; real sprites get dropped in by filename later.
export const TRAINER_AVATAR_MAP: Record<string, string> = {
  trainer_red:      '/trainers/trainer_red.gif',
  trainer_cynthia:  '/trainers/trainer_cynthia.gif',
  trainer_misty:    '/trainers/trainer_misty.gif',
  trainer_n:        '/trainers/trainer_n.gif',
  trainer_brock:    '/trainers/trainer_brock.gif',
  trainer_giovanni: '/trainers/trainer_giovanni.gif',
};

// Display order of the trainer avatar cards (matches the badge IDs above).
export const TRAINER_AVATAR_IDS = [
  'trainer_red',
  'trainer_cynthia',
  'trainer_misty',
  'trainer_n',
  'trainer_brock',
  'trainer_giovanni',
] as const;
