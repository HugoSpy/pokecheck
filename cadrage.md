# PokéCheck — Document de cadrage projet

## Vue d'ensemble

Site web scolaire où chaque présence en cours donne droit à un tirage de Pokémon (Gen 1–7).
Animation style "pack opening" CSGO. Collection personnelle, échanges entre élèves, leaderboard, packs événement, système de monnaie et badges.

---

## Stack technique

Identique au projet SIGambling existant :

| Couche | Technologie |
|---|---|
| Frontend | React + Vite, hébergé sur Vercel (free tier) |
| Backend | Express.js, géré par PM2 |
| Base de données | PostgreSQL 15, accès local uniquement (127.0.0.1:5432) |
| ORM | Prisma |
| Exposition réseau | Cloudflare Tunnel → `api.pokecheck.fr` |
| DNS / Proxy | Cloudflare |
| Infra | VM Ubuntu 24 dans Proxmox (NAS perso) |

Deploy frontend = `git push main` sur Vercel. Backend = `pm2 restart pokecheck`.

---

## Authentification — lien one-shot

### Fonctionnement

1. L'intranet de l'école génère un lien unique à chaque check de présence
2. Le lien contient un **token JWT signé** avec : `ms_id` de l'élève, `timestamp`, `session_id`
3. Le frontend consomme ce token via `GET /auth/one-shot?token=...`
4. Le backend valide, marque le token `used = true`, retourne une session JWT courte durée (1h)
5. Le frontend bloque le bouton en UI dès que le token est consommé

### Sécurité

- Token expiré après 15 minutes s'il n'est pas utilisé
- Rejet immédiat si `used = true` en base
- La session retournée est distincte du token one-shot (JWT séparé)

### Route backend

```
GET /auth/one-shot?token=<jwt>
→ 200 { sessionToken, user } si valide et non utilisé
→ 410 Gone si déjà utilisé
→ 401 si expiré ou signature invalide
```

---

## Système de tirage

### Rareté et points

| Tier | Probabilité | Points |
|---|---|---|
| Commun | 60% | 1 – 200 |
| Rare | 25% | 201 – 500 |
| Épique | 12% | 501 – 800 |
| Légendaire | 3% | 801 – 1000 |

Le tier d'un Pokémon est calculé automatiquement depuis son **BST (Base Stat Total)** récupéré via PokeAPI au moment du seed :
- BST < 300 → Commun
- BST 300–450 → Rare
- BST 450–580 → Épique
- BST > 580 → Légendaire

Les points sont calculés par interpolation linéaire dans la plage du tier.

### Route backend

```
POST /draw
Headers: Authorization: Bearer <sessionToken>
→ 200 { pokemon: { id, name, sprite_url, rarity, points } }
→ 403 si l'élève a déjà tiré aujourd'hui (lien déjà consommé)
```

### Sprites

URL pattern : `https://img.pokemondb.net/sprites/home/normal/{name}.png`

Exemple : `https://img.pokemondb.net/sprites/home/normal/bulbasaur.png`

Stocker `sprite_url` en DB au moment du seed (pas de fetch runtime).

---

## Système de monnaie — PokéCoins

### Sources de gains

| Source | Gain |
|---|---|
| Connexion journalière (streak) | `100 + (streak_days × 10)` coins |
| Vendre un Pokémon | Voir formule ci-dessous |
| Badge débloqué | Variable selon le badge |
| Compléter un échange Pok vs Pok | 25 coins |

### Prix de vente d'un Pokémon

Le prix reflète la **difficulté d'obtention** (rareté inversée), pas juste les points.

**Formule :** `sell_price = round(points × (1 / drop_rate) / 20)`

| Tier | Drop | Coefficient | Prix (range) |
|---|---|---|---|
| Commun | 60% | 0.08 | 1 – 16 coins |
| Rare | 25% | 0.20 | 40 – 100 coins |
| Épique | 12% | 0.42 | 210 – 336 coins |
| Légendaire | 3% | 1.67 | 1 337 – 1 670 coins |

```ts
const DROP_RATE = { COMMON: 0.60, RARE: 0.25, EPIC: 0.12, LEGENDARY: 0.03 }
const NORM = 20

function getSellPrice(pokemon: Pokemon): number {
  const coeff = (1 / DROP_RATE[pokemon.rarity]) / NORM
  return Math.round(pokemon.points * coeff)
}
```

Un élève peut vendre **n'importe quel Pokémon** qu'il possède (pas uniquement les doublons).
Le score (`total_score`) est recalculé dynamiquement depuis le Pokédex → il baisse à la vente.

### Expiration des coins

- Les coins expirent après **14 jours d'inactivité** (aucune connexion)
- Un `cron job` quotidien check `last_login` et reset `coins = 0` si `> 14j`
- Affiché dans l'UI : bannière type *"Tes coins expirent dans X jours si tu ne te connectes pas"*

---

## Streak de connexion

La streak récompense la connexion quotidienne, même les jours sans cours.

| Situation | Coins gagnés |
|---|---|
| Jour N de streak | `100 + (N-1) × 10` coins |
| Jour raté | Streak reset → retour à 100 coins/jour |

Exemples :
- Jour 1 → 100 coins
- Jour 2 → 110 coins
- Jour 10 → 190 coins
- Jour 30 → 390 coins

Pas de cap — récompense l'assiduité sur le long terme.

### Route backend

```
POST /daily-login
Headers: Authorization: Bearer <sessionToken>
→ 200 { coins_earned, streak_days, total_coins }
→ 400 si déjà claim aujourd'hui
```

---

## Packs Événement

Des packs thématiques créés manuellement toutes les ~3 semaines via l'interface admin.
1 Pokémon par ouverture (même animation que le tirage présence). Illimité par élève (limité par ses coins).

### Types de packs

| Pack | Coût |
|---|---|
| Standard | 500 coins |
| Premium | 1 500 coins |

### Mécanique

- **Pool restreinte** : liste d'IDs Pokémon définie manuellement ou par filtre (type, génération)
- **Taux de rareté modifiables** : multiplicateurs par tier (ex: Légendaire ×2 pour un event)
- **Durée limitée** : countdown visible sur le site
- **Un seul event actif à la fois** (ou plusieurs en parallèle, à la discrétion de l'admin)

### Interface admin (`/admin`)

- Protégée par rôle admin
- Formulaire de création : nom, dates de début/fin, pool de Pokémons, multiplicateurs de rareté, prix Standard / Premium
- **Prévisualisation** avant publication : taux affichés, liste des Pokémons dans la pool
- Bouton publier / dépublier

### Route backend

```
POST /event/draw
Headers: Authorization: Bearer <sessionToken>
Body: { event_id, pack_type: 'standard' | 'premium' }
→ 200 { pokemon: { id, name, sprite_url, rarity, points }, coins_remaining }
→ 402 si coins insuffisants
→ 404 si event inexistant ou expiré
```

---

## Système d'échanges

### 3 types d'échanges

| Type | Description | Compte pour bonus x10 |
|---|---|---|
| **Pok vs Pok** | 1 Pokémon contre 1 Pokémon, ciblé | ✅ |
| **Pok + Coins vs Pok** | Pokémon + coins contre un Pokémon, ciblé | ✅ |
| **Marché ouvert** | Annonce publique : Pokémon contre X coins, achetable par tous | ❌ |

### Règles communes

- Le cooldown 24h (`tradeable_at`) s'applique sur tous les types
- `tradeable_at = NULL` si obtenu par tirage → échangeable immédiatement
- `tradeable_at = obtained_at + 24h` si obtenu par échange → bloqué 24h
- Check : `WHERE id = $id AND (tradeable_at IS NULL OR tradeable_at < NOW())`

### Bonus x10 échanges

- Compteur `trade_count` sur chaque `user`
- Tous les 10 échanges **complétés** (Pok vs Pok uniquement), l'élève reçoit un tirage bonus
- Le bonus est un tirage normal via `/draw` avec `source = 'bonus'`
- Pas de restriction de doublon

### Marché ouvert (`/market`)

- Un élève poste une annonce : Pokémon + prix en coins souhaité
- N'importe qui peut acheter → transfert automatique coins/Pokémon
- Annonce expire après **7 jours** si pas vendue
- L'élève peut annuler son annonce avant vente

### Routes backend

```
# Échanges ciblés
GET  /trade/offers               → liste des offres reçues en attente
POST /trade/propose              → { from_pokemon_id, to_user_id, to_pokemon_id, coins_offered? }
POST /trade/accept/:id           → accepte une offre
POST /trade/decline/:id          → refuse une offre

# Marché ouvert
GET  /market                     → liste des annonces actives
POST /market/list                → { pokemon_id, price_coins }
POST /market/buy/:listing_id     → achète une annonce
POST /market/cancel/:listing_id  → annule son annonce
```

---

## Système de badges

Les badges rapportent des coins **une seule fois** au débogage.
Notification in-app au déblocage.
Chaque élève choisit **3 badges** à afficher sur sa carte publique.

### Détection automatique

Un service `checkBadges(userId)` est appelé après chaque action susceptible de débloquer un badge (tirage, échange, connexion, vente). Il vérifie les conditions et insert dans `UserBadge` si non déjà obtenu, avec `notified = false`.

---

### Catégorie — Streak de connexion

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Premier pas | `streak_7` | Streak 7 jours | 200 |
| Habitué | `streak_14` | Streak 14 jours | 350 |
| Régulier | `streak_30` | Streak 30 jours | 700 |
| Hardcore | `streak_50` | Streak 50 jours | 1 200 |
| Légendaire de l'assiduité | `streak_100` | Streak 100 jours | 3 000 |

---

### Catégorie — Échanges

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Commerçant débutant | `trade_1` | 1 échange complété | 25 |
| Négociateur | `trade_5` | 5 échanges | 100 |
| Trader | `trade_15` | 15 échanges | 250 |
| Broker | `trade_30` | 30 échanges | 500 |
| Magnat | `trade_100` | 100 échanges | 2 000 |

---

### Catégorie — Starters (7 badges)

Un badge par génération, il faut posséder les 3 starters simultanément.

| Badge | ID | Pokémons requis | Coins |
|---|---|---|---|
| Trio Kanto | `starters_gen1` | Bulbizarre + Carapuce + Salamèche | 500 |
| Trio Johto | `starters_gen2` | Germignon + Héricendre + Totodile | 500 |
| Trio Hoenn | `starters_gen3` | Arcko + Poussifeu + Gobou | 500 |
| Trio Sinnoh | `starters_gen4` | Tortipouss + Ouisticram + Tiplouf | 500 |
| Trio Unova | `starters_gen5` | Vipélierre + Gruikui + Moustillon | 500 |
| Trio Kalos | `starters_gen6` | Marisson + Feunnec + Grenousse | 500 |
| Trio Alola | `starters_gen7` | Brindibou + Flamiaou + Otaquin | 500 |

---

### Catégorie — Types

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Collectionneur de types | `all_types` | 1 Pokémon de chacun des 18 types | 1 500 |

---

### Catégorie — Légendaires

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Chasseur de légendes | `legendary_hunter` | 1 légendaire de chaque gen (×7) | 800 |
| Maître Kanto | `legendary_gen1` | Tous les légendaires Gen 1 | 2 000 |
| Maître Johto | `legendary_gen2` | Tous les légendaires Gen 2 | 2 000 |
| Maître Hoenn | `legendary_gen3` | Tous les légendaires Gen 3 | 2 000 |
| Maître Sinnoh | `legendary_gen4` | Tous les légendaires Gen 4 | 2 000 |
| Maître Unova | `legendary_gen5` | Tous les légendaires Gen 5 | 2 000 |
| Maître Kalos | `legendary_gen6` | Tous les légendaires Gen 6 | 2 000 |
| Maître Alola | `legendary_gen7` | Tous les légendaires Gen 7 | 2 000 |

---

### Catégorie — Pokédex (taille)

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Débutant | `pokedex_10` | 10 Pokémon | 100 |
| Explorateur | `pokedex_50` | 50 Pokémon | 300 |
| Collectionneur | `pokedex_150` | 150 Pokémon | 700 |
| Expert | `pokedex_300` | 300 Pokémon | 1 500 |
| Maître Pokémon | `pokedex_500` | 500 Pokémon | 3 000 |
| Pokédex Complet | `pokedex_809` | 809 Pokémon | 10 000 |

---

### Catégorie — Générations complètes

| Badge | ID | Condition | Coins |
|---|---|---|---|
| Complétion Kanto | `gen1_complete` | Tous les 151 Pokémon Gen 1 | 5 000 |
| Complétion Johto | `gen2_complete` | Tous les 100 Pokémon Gen 2 | 5 000 |
| Complétion Hoenn | `gen3_complete` | Tous les 135 Pokémon Gen 3 | 5 000 |
| Complétion Sinnoh | `gen4_complete` | Tous les 107 Pokémon Gen 4 | 5 000 |
| Complétion Unova | `gen5_complete` | Tous les 156 Pokémon Gen 5 | 5 000 |
| Complétion Kalos | `gen6_complete` | Tous les 72 Pokémon Gen 6 | 5 000 |
| Complétion Alola | `gen7_complete` | Tous les 88 Pokémon Gen 7 | 5 000 |

---

## Score & Leaderboards

- **Score** = somme des `points` des Pokémons **actuellement** dans le Pokédex → recalculé dynamiquement, baisse si on vend
- **Leaderboard score** : classement par score total DESC
- **Leaderboard coins** : classement par richesse actuelle (coins en poche)

---

## Schéma base de données (Prisma)

```prisma
model User {
  id                String    @id @default(uuid())
  ms_id             String    @unique
  display_name      String
  total_score       Int       @default(0)
  trade_count       Int       @default(0)
  coins             Int       @default(0)
  coins_earned_total Int      @default(0)   // historique cumulé, utile pour stats
  streak_days       Int       @default(0)
  last_login        DateTime?
  featured_badges   String[]                // 3 badge IDs choisis pour le profil public
  created_at        DateTime  @default(now())

  pokemons          UserPokemon[]
  trades_sent       Trade[]          @relation("TradeSent")
  trades_recv       Trade[]          @relation("TradeReceived")
  one_shot_tokens   OneshotToken[]
  badges            UserBadge[]
  coin_transactions CoinTransaction[]
  market_listings   MarketListing[]  @relation("MarketSeller")
  market_purchases  MarketListing[]  @relation("MarketBuyer")
}

model Pokemon {
  id         Int      @id   // Numéro national Pokédex
  name       String   @unique
  generation Int
  rarity     String         // COMMON | RARE | EPIC | LEGENDARY
  points     Int
  bst        Int
  sprite_url String
  types      String[]

  owned_by   UserPokemon[]
}

model UserPokemon {
  id           String    @id @default(uuid())
  user_id      String
  pokemon_id   Int
  source       String          // 'draw' | 'trade' | 'bonus' | 'event'
  obtained_at  DateTime  @default(now())
  tradeable_at DateTime?       // NULL si tiré, obtained_at + 24h si reçu par échange

  user    User    @relation(fields: [user_id], references: [id])
  pokemon Pokemon @relation(fields: [pokemon_id], references: [id])
}

model Trade {
  id              String    @id @default(uuid())
  from_user_id    String
  to_user_id      String
  from_pokemon_id String          // UserPokemon.id
  to_pokemon_id   String?         // UserPokemon.id — NULL si échange coins seuls
  coins_offered   Int       @default(0)   // coins envoyés par from_user
  coins_requested Int       @default(0)   // coins demandés à to_user
  status          String          // 'pending' | 'accepted' | 'declined'
  created_at      DateTime  @default(now())
  resolved_at     DateTime?

  from_user User @relation("TradeSent",     fields: [from_user_id], references: [id])
  to_user   User @relation("TradeReceived", fields: [to_user_id],   references: [id])
}

model OneshotToken {
  id         String   @id @default(uuid())
  user_id    String
  token_hash String   @unique
  used       Boolean  @default(false)
  expires_at DateTime
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])
}

model Event {
  id                String   @id @default(uuid())
  name              String
  pokemon_pool      Int[]              // IDs Pokédex dans la pool
  rarity_multiplier Json               // { COMMON: 1.0, RARE: 1.0, EPIC: 1.5, LEGENDARY: 2.0 }
  price_standard    Int      @default(500)
  price_premium     Int      @default(1500)
  starts_at         DateTime
  ends_at           DateTime
  published         Boolean  @default(false)
  created_at        DateTime @default(now())
}

model Badge {
  id          String @id         // ex: 'streak_7', 'starters_gen1', 'pokedex_50'
  name        String
  description String
  category    String             // 'streak' | 'trade' | 'starters' | 'types' | 'legendary' | 'pokedex' | 'generation'
  coin_reward Int
  icon_url    String?

  unlocked_by UserBadge[]
}

model UserBadge {
  id          String   @id @default(uuid())
  user_id     String
  badge_id    String
  unlocked_at DateTime @default(now())
  notified    Boolean  @default(false)   // pour la notif in-app

  user  User  @relation(fields: [user_id], references: [id])
  badge Badge @relation(fields: [badge_id], references: [id])

  @@unique([user_id, badge_id])
}

model MarketListing {
  id          String    @id @default(uuid())
  seller_id   String
  pokemon_id  String          // UserPokemon.id
  price_coins Int
  status      String          // 'active' | 'sold' | 'expired' | 'cancelled'
  created_at  DateTime  @default(now())
  expires_at  DateTime        // created_at + 7 jours
  sold_at     DateTime?
  buyer_id    String?

  seller User  @relation("MarketSeller", fields: [seller_id], references: [id])
  buyer  User? @relation("MarketBuyer",  fields: [buyer_id],  references: [id])
}

model CoinTransaction {
  id         String   @id @default(uuid())
  user_id    String
  amount     Int      // positif = gain, négatif = dépense
  reason     String   // 'streak' | 'sell' | 'event_pack' | 'badge' | 'trade' | 'market'
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])
}
```

---

## Seed base de données Pokémon

Script à lancer une seule fois pour remplir la table `Pokemon` (Gen 1–7, IDs 1–809).

### Logique du script

```ts
// seed.ts
const LIMIT = 809 // Gen 1 à 7

for (let id = 1; id <= LIMIT; id++) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
  const data = await res.json()

  const bst = data.stats.reduce((sum, s) => sum + s.base_stat, 0)
  const { rarity, points } = computeRarityAndPoints(bst)
  const generation = getGenFromId(id)
  const sprite_url = `https://img.pokemondb.net/sprites/home/normal/${data.name}.png`

  await prisma.pokemon.upsert({ where: { id }, update: {}, create: {
    id, name: data.name, generation, rarity, points, bst, sprite_url,
    types: data.types.map(t => t.type.name)
  }})

  await new Promise(r => setTimeout(r, 300)) // respect rate limit PokeAPI
}
```

---

## Features frontend

### Pages

| Route | Description |
|---|---|
| `/open?token=xxx` | Page de tirage — animation pack opening, consomme le token |
| `/pokedex` | Pokédex personnel de l'élève connecté |
| `/trades` | Offres d'échanges reçues et envoyées |
| `/market` | Marché ouvert — annonces publiques Pokémon contre coins |
| `/events` | Packs événement disponibles |
| `/leaderboard` | Classement global (score + coins) |
| `/u/:id` | Profil public d'un élève — Pokédex + 3 badges affichés |
| `/profile` | Profil perso — gestion des 3 badges vitrine, historique coins |
| `/admin` | Interface admin — gestion des events (accès restreint) |

### Animation tirage

1. Écran noir avec Pokéball animée (CSS keyframes)
2. Révélation progressive du sprite (scale + opacity)
3. Affichage du nom, tier (badge coloré), points
4. Bouton "Voir mon Pokédex" → `/pokedex`

Même animation réutilisée pour les packs événement.

### Leaderboard

- Deux onglets : **Score** et **Coins**
- Cliquer sur un élève → `/u/:id`
- Stats affichées : score total, nombre de Pokémon, nombre de légendaires, coins actuels

### Profil public `/u/:id`

- 3 badges choisis par l'élève (sa "vitrine")
- Accès à la liste complète de tous ses badges débloqués
- Pokédex complet visible

### Notification in-app badges

- Bannière ou toast au déblocage d'un badge
- Marque `notified = true` en DB après affichage

---

## Variables d'environnement

```env
# Backend (.env)
DATABASE_URL="postgresql://user:password@127.0.0.1:5432/pokecheck"
JWT_SECRET="..."
JWT_ONE_SHOT_SECRET="..."  # secret partagé avec l'intranet pour valider les tokens entrants
SESSION_DURATION="1h"
ONE_SHOT_TTL_MINUTES=15
COIN_EXPIRY_DAYS=14
PORT=3001

# Frontend (.env.local)
VITE_API_URL="https://api.pokecheck.fr"
```

---

## Structure du projet

```
pokecheck/
├── frontend/               # Vite + React
│   ├── src/
│   │   ├── pages/          # OpenPack, Pokedex, Trades, Market, Events, Leaderboard, UserProfile, Admin
│   │   ├── components/     # PokemonCard, RarityBadge, PackAnimation, BadgeCard, CoinBalance
│   │   └── api/            # fetch wrappers
│   └── vercel.json         # rewrite SPA → index.html
│
├── backend/                # Express + Prisma
│   ├── src/
│   │   ├── routes/         # auth.ts, draw.ts, trade.ts, market.ts, event.ts, leaderboard.ts, admin.ts
│   │   ├── services/       # badgeService.ts, coinService.ts, streakService.ts
│   │   ├── jobs/           # coinExpiry.ts (cron job 14j)
│   │   ├── middleware/     # authMiddleware.ts, adminMiddleware.ts
│   │   └── prisma/         # schema.prisma, seed.ts
│   └── ecosystem.config.js # config PM2
│
└── README.md
```

---

## Ordre de setup recommandé

1. Init repo, setup Prisma + PostgreSQL, écrire le schéma complet
2. Lancer le script de seed (Pokémon Gen 1–7)
3. Backend : auth → draw → streak/coins → badges
4. Backend : trade (Pok vs Pok) → trade avec coins → marché ouvert
5. Backend : events + interface admin
6. Backend : cron job expiration coins
7. Frontend : page `/open` avec animation (cœur du projet)
8. Frontend : Pokédex perso + vente
9. Frontend : `/trades` et `/market`
10. Frontend : `/events` + animation pack event
11. Frontend : leaderboard (score + coins), profil public, badges
12. Frontend : `/admin`
13. Déployer frontend sur Vercel, backend via PM2 + Cloudflare Tunnel
