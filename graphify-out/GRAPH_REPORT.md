# Graph Report - .  (2026-06-02)

## Corpus Check
- 54 files · ~21,243 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 133 nodes · 124 edges · 42 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]

## God Nodes (most connected - your core abstractions)
1. `Express App Entry Point` - 11 edges
2. `Auth Middleware (JWT)` - 9 edges
3. `Trade Route` - 7 edges
4. `Sell Route` - 7 edges
5. `Market Route` - 7 edges
6. `Event Route (Event Draw)` - 6 edges
7. `checkBadges` - 6 edges
8. `Coin Service (addCoins, spendCoins, getSellPrice)` - 5 edges
9. `Pokedex Value Service (recalculateUserPokedexValue)` - 5 edges
10. `Badge Service (checkBadges)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `MicrosoftLoginButton Component` --conceptually_related_to--> `One-Shot Token Authentication`  [INFERRED]
  frontend/src/components/MicrosoftLoginButton.tsx → cadrage.md
- `TradeAnimation3D Component` --conceptually_related_to--> `Trade System Design`  [INFERRED]
  frontend/src/components/TradeAnimation3D.tsx → cadrage.md
- `Cadrage Document` --conceptually_related_to--> `CLAUDE.md Project Instructions`  [INFERRED]
  cadrage.md → CLAUDE.md
- `Coin Expiry Cron Job` --conceptually_related_to--> `Coin Service (addCoins, spendCoins, getSellPrice)`  [INFERRED]
  backend/src/jobs/coinExpiry.ts → backend/src/services/coinService.ts
- `MicrosoftLoginButton Component` --semantically_similar_to--> `Login Page`  [INFERRED] [semantically similar]
  frontend/src/components/MicrosoftLoginButton.tsx → frontend/src/pages/Login.tsx

## Hyperedges (group relationships)
- **Routes Protected by Auth Middleware** — routes_pokedex, routes_draw, routes_trade, routes_sell, routes_admin, routes_event, routes_dailylogin, routes_users, routes_market [EXTRACTED 1.00]
- **Routes that Trigger Badge Checks** — routes_trade, routes_sell, routes_event, routes_dailylogin, routes_market [EXTRACTED 1.00]
- **Routes that Recalculate Pokedex Value** — routes_draw, routes_trade, routes_sell, routes_event, routes_market [EXTRACTED 1.00]
- **Routes that Use Coin Service** — routes_trade, routes_sell, routes_event, routes_market [EXTRACTED 1.00]
- **PM2 Managed Processes** — ecosystem_pm2config, index_expressapp, jobs_coinexpiry [EXTRACTED 1.00]
- **Coin Economy Layer** — coinservice_addcoins, coinservice_spendcoins, coinservice_getsellprice, streakservice_claimdailylogin, badgeservice_unlockbadge [INFERRED 0.85]
- **Badge Unlock Pipeline** — badgeservice_checkbadges, badgeservice_unlockbadge, coinservice_addcoins, badgeservice_streak_badges, badgeservice_trade_badges, badgeservice_pokedex_badges [INFERRED 0.85]
- **PokeAPI Data Seeding Pipeline** — prisma_seed, prisma_seed_fetchpokemon, prisma_seed_computerarityandpoints, prisma_fixsprites, prisma_updatenames [INFERRED 0.80]
- **Frontend App Routing** — frontend_main, frontend_app, frontend_approutes [EXTRACTED 1.00]
- **Daily Login Streak Reward Flow** — streakservice_claimdailylogin, coinservice_addcoins, badgeservice_checkbadges [INFERRED 0.70]
- **Frontend Pages API Consumption Pattern** — pokedex_page, trades_page, leaderboard_page, userpokedex_page, openpack_page, api_index [INFERRED 0.90]
- **Pokemon Display Component Chain** — pokemoncard_component, pokemondetailmodal_component, api_type_userpokemoninstance [EXTRACTED 1.00]
- **Authentication Flow Components** — authguard_component, microsoftloginbutton_component, api_token_management, login_page [INFERRED 0.85]
- **Trade Animation Ecosystem** — trades_page, devtradeanim_page, tradeanimation3d_component, tradeanimation3d_phase_statemachine, tradeanimation3d_threejs_scene [EXTRACTED 1.00]
- **Cadrage Core Game Concepts** — cadrage_concept_oneshot_auth, cadrage_concept_rarity_system, cadrage_concept_pokecoin_system, cadrage_concept_streak, cadrage_concept_event_packs, cadrage_concept_trade_system, cadrage_concept_badge_system [EXTRACTED 1.00]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (19): Auth Middleware (JWT), AuthPayload Interface, PM2 Ecosystem Config, Express App Entry Point, Coin Expiry Cron Job, Admin Route (Generate Pack), Auth Route (Microsoft OAuth + One-Shot), Daily Login Route (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (11): checkBadges, POKEDEX_BADGES Thresholds, STARTERS Pokemon IDs Map, STREAK_BADGES Thresholds, TRADE_BADGES Thresholds, unlockBadge (internal), addCoins, spendCoins (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.29
Nodes (2): handleSelectUser(), loadTargetUser()

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (0): 

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (7): DROP_RATE Rarity Map, getSellPrice, fix-sprites Script, Prisma Seed Script, computeRarityAndPoints, fetchPokemon (PokeAPI), update-names-fr Script

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): Trade System Design, Rationale: 24h Cooldown After Trade, DevTradeAnim Page, TradeAnimation3D Component, TradeAnimation3D Phase State Machine, TradeAnimation3D Three.js Scene Setup

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (0): 

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (2): apiFetch(), getToken()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): calculateUserPokedexValue, recalculateUserPokedexValue, recalculate-pokedex-values Script

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): isTokenValid(), parseJwt()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (3): One-Shot Token Authentication, Login Page, MicrosoftLoginButton Component

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): handleOpen(), preloadImages()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (2): Cadrage Document, CLAUDE.md Project Instructions

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (2): Sell Price Formula (rarity-inverse), Rationale: Sell Price Reflects Rarity Difficulty

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (2): PokéCoins Currency System, Rationale: Score Decreases on Sell

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): passport-microsoft Type Declaration

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): Vite Config

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): Frontend Entry Point (main.tsx)

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): Vite Env Type Declarations

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Rarity & Points System

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): Connexion Streak System

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Event Packs System

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): Badge System Design

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): Prisma DB Schema

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): Tech Stack

## Knowledge Gaps
- **32 isolated node(s):** `AuthPayload Interface`, `Leaderboard Route`, `DailyLoginResult Interface`, `spendCoins`, `getSellPrice` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 17`** (2 nodes): `AuthGuard()`, `AuthGuard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `PokemonDetailModal.tsx`, `getSlugFromSpriteUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `generateAdminPack()`, `adminApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `leaderboardApi.ts`, `getLeaderboard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `Cadrage Document`, `CLAUDE.md Project Instructions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `Sell Price Formula (rarity-inverse)`, `Rationale: Sell Price Reflects Rarity Difficulty`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `PokéCoins Currency System`, `Rationale: Score Decreases on Sell`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `users.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `passport-microsoft Type Declaration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `Vite Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `Frontend Entry Point (main.tsx)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `Vite Env Type Declarations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `RarityBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `PokemonCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Pokedex.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Leaderboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `UserPokedex.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Rarity & Points System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Connexion Streak System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Event Packs System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Badge System Design`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Prisma DB Schema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `Tech Stack`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `Trade Route` (e.g. with `Sell Route` and `Market Route`) actually correct?**
  _`Trade Route` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Sell Route` (e.g. with `Market Route` and `Trade Route`) actually correct?**
  _`Sell Route` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Market Route` (e.g. with `Sell Route` and `Trade Route`) actually correct?**
  _`Market Route` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AuthPayload Interface`, `Leaderboard Route`, `DailyLoginResult Interface` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._