export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface PokemonInfo {
  id: number;
  name: string;
  sprite_url: string;
  rarity: Rarity;
  points: number;
  types: string[];
  generation: number;
  bst: number;
  is_shiny?: boolean;
  // HIDDEN FEATURE
  is_ditto_disguise?: boolean;
  original_legendary?: { id: number; name: string; sprite_url: string };
  // END HIDDEN FEATURE
}

export interface UserPokemonInstance extends PokemonInfo {
  instanceId: string;
  obtainedAt: string;
  source: string;
  tradeable_at: string | null;
}

export interface UserInfo {
  id: string;
  display_name: string;
  total_score: number;
  trade_count: number;
  featured_badges?: Badge[];
}

export interface RollCardData {
  id: number;
  name: string;
  sprite_url: string;
  rarity: Rarity;
  points: number;
  is_shiny?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_score: number;
  coins: number;
  trade_count: number;
  pokemon_count: number;
  legendary_count: number;
}

export interface TradeOffer {
  id: string;
  from_user: { id: string; display_name: string };
  fromPokemon: { pokemon: PokemonInfo; id: string; tradeable_at: string | null; is_shiny: boolean } | null;
  toPokemon: { pokemon: PokemonInfo; id: string; is_shiny: boolean } | null;
  coins_offered: number;
  coins_requested: number;
  status: string;
  created_at: string;
}

export interface SentTrade {
  id: string;
  to_user: { id: string; display_name: string };
  fromPokemon: TradeOffer['fromPokemon'];
  toPokemon: TradeOffer['toPokemon'];
  coins_offered: number;
  coins_requested: number;
  status: string;
  created_at: string;
}

export interface ProposeTradePayload {
  from_pokemon_id: string;
  to_user_id: string;
  to_pokemon_id: string;
  coins_offered?: number;
  coins_requested?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: string;
  coin_reward: number;
  icon_url: string | null;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  unlocked_at: string;
  notified: boolean;
  badge: Badge;
}

export interface GameEvent {
  id: string;
  name: string;
  pokemon_pool: number[];
  rarity_multiplier: Record<string, number>;
  price: number;
  starts_at: string;
  ends_at: string;
  published: boolean;
  created_at: string;
}

export interface MarketUserPokemon {
  instanceId: string;
  is_shiny: boolean;
  obtained_at: string;
  pokemon: PokemonInfo;
}

export interface MarketListing {
  id: string;
  seller_id: string;
  pokemon_id: string;
  price_coins: number;
  status: string;
  created_at: string;
  expires_at: string;
  sold_at: string | null;
  buyer_id: string | null;
  seller: { id: string; display_name: string };
  userPokemon: MarketUserPokemon | null;
}

/** Fields every draw endpoint returns so the client can offer a quick-resell. */
export interface DrawDuplicateInfo {
  user_pokemon_id: string;
  /** True when the player already owns another instance of this exact variant. */
  is_duplicate: boolean;
  sell_price: number;
}

export interface DrawResult extends DrawDuplicateInfo {
  pokemon: PokemonInfo;
  coins_remaining: number;
  new_badges: string[];
}

export interface EventDrawResult extends DrawResult {
  strip: RollCardData[];
}

export interface DailyLoginResult {
  coins_earned: number;
  streak_days: number;
  total_coins: number;
  already_claimed: boolean;
  new_badges: string[];
}

export interface SellResult {
  coins_earned: number;
  sell_price: number;
  new_badges: string[];
}

export interface BulkSellResult {
  sold: number;
  coins_earned: number;
  new_badges: string[];
}

export interface MyProfile {
  id: string;
  display_name: string;
  coins: number;
  streak_days: number;
  last_login: string | null;
  total_score: number;
  trade_count: number;
  featured_badges: string[];
  is_admin: boolean;
}

export interface AllBadgeEntry extends Badge {
  unlocked: boolean;
  unlocked_at: string | null;
  claimed: boolean;
  claimed_at: string | null;
}

export interface PublicUserInfo {
  id: string;
  display_name: string;
  total_score: number;
  trade_count: number;
  featured_badges: Badge[];
}

const DROP_RATE: Record<string, number> = {
  COMMON: 0.60, RARE: 0.25, EPIC: 0.12, LEGENDARY: 0.012,
};
export function getSellPrice(instance: { id?: number; points: number; rarity: string; is_shiny?: boolean }): number {
  if (instance.id === 132) return instance.is_shiny ? 333 : 111;
  return Math.round(instance.points / (DROP_RATE[instance.rarity] ?? 0.60) / 20);
}
