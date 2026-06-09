export const TYPE_FR: Record<string, string> = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik',
  grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
  ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
  steel: 'Acier', fairy: 'Fée',
};

export const RARITY_FR: Record<string, string> = {
  COMMON: 'Commun', RARE: 'Rare', EPIC: 'Épique', LEGENDARY: 'Légendaire',
};

export const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

// All 18 type keys (display order), and the chip accent colour per type. Shared
// by the Pokédex filters and the global Pokémon search modal.
export const ALL_TYPES = Object.keys(TYPE_FR);

export const TYPE_COLORS: Record<string, string> = {
  normal: '#9CA3AF', fire: '#F97316', water: '#3B82F6',
  electric: '#EAB308', grass: '#22C55E', ice: '#67E8F9',
  fighting: '#DC2626', poison: '#A855F7', ground: '#D97706',
  flying: '#818CF8', psychic: '#EC4899', bug: '#84CC16',
  rock: '#78716C', ghost: '#6D28D9', dragon: '#7C3AED',
  dark: '#6B7280', steel: '#94A3B8', fairy: '#F472B6',
};
