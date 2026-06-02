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
  fromPokemon: { pokemon: PokemonInfo; id: string; tradeable_at: string | null } | null;
  toPokemon: { pokemon: PokemonInfo; id: string } | null;
  status: string;
  created_at: string;
}

export interface ProposeTradePayload {
  from_pokemon_id: string;
  to_user_id: string;
  to_pokemon_id: string;
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
  price_standard: number;
  price_premium: number;
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

export interface DrawResult {
  pokemon: PokemonInfo;
  coins_remaining: number;
  new_badges: string[];
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
