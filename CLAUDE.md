## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

# PokéCheck - Contexte projet

## Vue d'ensemble
Site scolaire EPITA où chaque check de présence donne un tirage de Pokémon (Gen 1–7). Collection, échanges, marché, événements, badges, économie de coins.

## Stack technique
- **Frontend** : React + Vite + TypeScript, déployé sur Vercel. Pas de Tailwind - CSS vanilla avec design tokens dans `frontend/src/globals.css`
- **Backend** : Express 5 + Prisma + PostgreSQL 15, hébergé sur NAS (`ssh sigambling`), géré par PM2
- **Auth** : Microsoft OAuth2 (tenant EPITA UUID - single-tenant, pas `common`) + one-shot tokens
- **Exposition** : Cloudflare Tunnel `cf66bd64` → `api.pokecheck.fr` (prod) + `api-dev.pokecheck.fr` (staging)

## Architecture prod / staging

### Production
| Composant | Valeur |
|---|---|
| Frontend | `https://pokecheck.fr` (branche `main` sur Vercel) |
| Backend | `~/pokecheck/backend` - PM2 `pokecheck` - port **3002** |
| DB | `pokeschool` (PostgreSQL local) |
| API URL | `https://api.pokecheck.fr` |
| CORS | `FRONTEND_URL=https://pokecheck.fr,https://pokecheck-tau.vercel.app` |
| Redirect OAuth | `FRONTEND_REDIRECT_URL=https://pokecheck.fr` |

### Staging
| Composant | Valeur |
|---|---|
| Frontend | Preview Vercel sur push branche `dev` |
| Backend | `~/pokecheck-dev/backend` - PM2 `pokecheck-dev` - port **3004** |
| DB | `pokeschool_dev` (clone snapshot de prod) |
| API URL | `https://api-dev.pokecheck.fr` |
| CORS | `FRONTEND_URL=https://pokecheck-tau.vercel.app,http://localhost:5173` + regex previews Vercel (`ALLOW_VERCEL_PREVIEWS=true`) |
| Redirect OAuth | `FRONTEND_REDIRECT_URL=https://pokecheck-tau.vercel.app` |

> **FRONTEND_URL ≠ FRONTEND_REDIRECT_URL** : `FRONTEND_URL` est une liste séparée par virgules pour le CORS. `FRONTEND_REDIRECT_URL` est une URL unique pour les redirections OAuth et one-shot - confondre les deux casse le login.

### Process PM2 (sur le NAS `sigambling`)
| Nom | Rôle | Cron |
|---|---|---|
| `pokecheck` | Backend prod (port 3002) | - |
| `pokecheck-dev` | Backend staging (port 3004) | - |
| `pokecheck-tunnel` | Cloudflare Tunnel (config `~/.cloudflared/config-pokecheck.yml`) | - |
| `coin-expiry` | Reset coins après 14j inactivité | `0 0 * * *` |
| `market-expiry` | Expire listings marché après 7j | `0 * * * *` |

Le frontend est servi par **Vercel uniquement** - aucun process local ne sert le frontend.

## Workflow de développement

```bash
# Nouvelle feature
git checkout dev  # worktree dans ~/pokecheck-dev
# ... code dans ~/pokecheck-dev ...
git commit -m "feat: ..."
git push                          # → Vercel preview + api-dev.pokecheck.fr

# Déployer le backend staging
ssh sigambling
cd ~/pokecheck-dev/backend
git pull && npm run build && pm2 restart pokecheck-dev --update-env

# Une fois validé, merger en prod
git checkout main                 # dans ~/pokecheck
git merge dev && git push         # → Vercel prod (pokecheck.fr)

# Déployer le backend prod
ssh sigambling
cd ~/pokecheck/backend
git pull && npm run build && pm2 restart pokecheck --update-env

# Reset DB dev si trop sale
pm2 stop pokecheck-dev
psql -U sigambling -h 127.0.0.1 -d postgres \
  -c "DROP DATABASE pokeschool_dev; CREATE DATABASE pokeschool_dev WITH TEMPLATE pokeschool OWNER sigambling;"
pm2 start pokecheck-dev
```

> **PM2 + .env** : `pm2 restart <name>` seul ignore les nouvelles variables. Toujours `--update-env`. Et pour les nouvelles vars, un `pm2 stop` + `pm2 start` est parfois nécessaire (dotenv lit le fichier au démarrage, pas au restart).

> **Worktree git** : la branche `dev` est checkoutée dans `~/pokecheck-dev`. `~/pokecheck` est toujours sur `main`. Ne pas `git checkout dev` depuis `~/pokecheck` - utiliser `~/pokecheck-dev` directement.

## Règles backend critiques

### Jamais accepté du client (server-side only)
- `rarity` du Pokémon
- `is_shiny` (tiré backend à 1/4096)
- `source` d'un UserPokemon (forcé à `'draw'` dans `POST /draw`, `'attendance'` dans `attendance/open`, etc.)
- Calcul des coins (sell price, streak reward, badge reward)

### Services centralisés - utiliser impérativement
- `coinService.addCoins(tx, userId, amount, reason)` - toute création de coins
- `coinService.spendCoins(tx, userId, amount, reason)` - toute dépense (atomique via `updateMany`)
- `drawService.drawAndCreate(tx, userId, opts)` - tout tirage Pokémon

### Prisma - après changement de schéma
```bash
npx prisma generate
npm run build
pm2 restart <name> --update-env
# En dev : npx prisma migrate dev --name "ma_feature"
# En prod : npx prisma migrate deploy  (jamais migrate dev)
```

## Économie & game design

### Tirages (`POST /draw`)
- Limite : 100 tirages/jour (source `'draw'` uniquement - ignoré du body client)
- Probabilités réelles dans `drawService.ts` :
  - COMMON 79.8%, RARE 15%, EPIC 5%, **LEGENDARY 0.2%**
- Shiny : 1/4096 par tirage, `points × 3`
- `forceShiny` : uniquement si `isAdmin === true` dans le JWT

### Streak quotidienne
- Formule : `Math.min(20 + (streak_days - 1) * 5, 150)` coins
- Jour 1 → 20 coins, cap 150 atteint au jour 27
- Déclenché automatiquement au one-shot login + attendance open + bouton `/daily-login`
- Race condition protégée par `updateMany` conditionnel (compare-and-swap)

### Prix de vente
```
sell_price = round(effectivePoints × (1 / DROP_RATE[rarity]) / 20)
```
`DROP_RATE` dans `coinService.ts` : COMMON 0.60, RARE 0.25, EPIC 0.12, LEGENDARY **0.012**
(Ce taux est distinct du taux de tirage - il calibre le prix de vente indépendamment)

### Packs événement
- Standard : 500 coins - Premium : 1 500 coins
- Créés **manuellement** en base (pas de route admin pour créer des events dans le code)
- Multiplicateurs de rareté configurables par event dans `rarity_multiplier` (JSON)

### Marché
- Cap prix : 1 000 000 coins max
- Anti-self-buy vérifié
- Race condition buy protégée par `updateMany` compare-and-swap

### Trades
- Self-trade bloqué (`from_user_id !== to_user_id`)
- Cooldown tradeable 24h après échange
- Race condition accept protégée par `updateMany` compare-and-swap
- Bonus : tous les 10 trades Pokémon → `bonusDraws: string[]` retourné par `/trade/accept`
  - ⚠️ **TODO** : le frontend reçoit `bonusDraws` dans `tradeApi.ts` mais ne déclenche pas encore le pack opening

### Badges (claim manuel)
- Streak : 1j, 7j, 14j, 30j, 50j, 100j
- Trades : 1, 5, 15, 30, 100
- Starters : 1 badge par gen (7)
- Légendaires : 1 par gen + "chasseur" (1 légendaire par gen)
- Pokédex : 10, 50, 150, 300, 500, 809 Pokémons distincts
- Génération complète : 1 par gen (7)
- Types : badge "collectionneur" (18 types)
- Coins récupérés manuellement via `POST /users/badges/:id/claim`

## Sécurité (audit appliqué - juin 2026)

### Sprint 1 - fixes critiques
- `source` dans `POST /draw` toujours forcé à `'draw'` (ignoré du body)
- Self-trade bloqué dans `POST /trade/propose`
- Race conditions corrigées par compare-and-swap (`updateMany` conditionnel) sur : market buy, trade accept, daily-login streak
- Rate limiting : 10 req/min/IP sur routes monétaires (`/draw`, `/sell`, `/market/buy`, `/trade/accept`, `/daily-login`), 30/min sur `/auth/one-shot`
- Chaque route a sa propre instance `rateLimit()` (buckets indépendants)

### Sprint 2 - fixes modérés
- CORS strict allowlist depuis `FRONTEND_URL` (plus de wildcard `*.vercel.app`)
- `ALLOW_VERCEL_PREVIEWS=true` uniquement en staging pour accepter les preview URLs Vercel
- JWT 1h max (lu depuis `SESSION_DURATION`, défaut `1h`)
- Cap prix marché 1 000 000 coins
- Helmet headers sur toutes les réponses
- `spendCoins` atomique via `updateMany({ coins: { gte: amount } })`
- Tenant Microsoft UUID EPITA (pas `common`)

## Routes

### Public (sans auth)
- `GET /health`
- `GET /leaderboard?sort=total_score|coins`
- `GET /market`
- `GET /pokedex/:userId`, `GET /pokedex/random-weighted?count=30`, `GET /pokedex/random?count=30`
- `GET /event`
- `GET /auth/microsoft`, `GET /auth/microsoft/callback`, `GET /auth/one-shot?code=`

### Authenticated
- `POST /draw`
- `POST /sell/:userPokemonId`
- `POST /daily-login`
- `GET /trade/offers`, `POST /trade/propose`, `POST /trade/accept/:id`, `POST /trade/decline/:id`
- `POST /market/list`, `POST /market/buy/:id`, `POST /market/cancel/:id`
- `POST /event/draw`
- `GET /attendance/available`, `POST /attendance/open`
- `GET /users/me`, `GET /users/search?q=`, `GET /users/badges/me`, `GET /users/all-badges`, `GET /users/badges/unnotified`, `POST /users/badges/notified`, `POST /users/badges/:id/claim`, `PATCH /users/featured-badges`

### Admin (`isAdmin === true` dans JWT)
- `POST /admin/generate-pack`
- `POST /admin/attendance/start`, `GET /admin/attendance/active`, `POST /admin/attendance/:id/cancel`

### School API (`x-api-key: SCHOOL_API_KEY`)
- `POST /auth/generate-token` - intégration intranet EPITA

## Système Attendance
- Admin clique "Check présence" → fenêtre de 15 min pour ouvrir 1 pack par élève
- Rollback transactionnel si l'admin annule :
  - Pokémon encore détenu → supprimé + recalcul score
  - Pokémon vendu → retire les coins de vente (balance peut devenir négative)
  - Pokémon en listing/trade → annule listing/trade + supprime
  - Coins chaîne secondaire (ex: l'acheteur marché a revendu) → non rattrapés

## Style & UI
- Dark theme, design tokens dans `frontend/src/globals.css`
- **Animation pack opening style CSGO** : **ne jamais modifier** - intouchable
- Bottom-nav mobile ≤640px avec `safe-area-inset-bottom`
- Icônes SVG dans `frontend/src/components/icons.tsx` (subset Lucide)
- Notifications badges : poll 30s, slide-in bottom-left, auto-close 4s avec barre de progression

## Assets Pokémon
- Sprites normaux : `https://img.pokemondb.net/sprites/home/normal/{slug}.png`
- Sprites shiny : `https://img.pokemondb.net/sprites/home/shiny/{slug}.png`
- Sprites animés GIF : `https://projectpokemon.org/images/normal-sprite/{slug}.gif`
- 5 Pokémons avec variants genrés (`-m` / `-f`)

## TODOs connus
- **bonusDraws** : `POST /trade/accept` retourne `bonusDraws: string[]` mais le frontend ne déclenche pas encore le pack opening bonus
- Refactor `PokemonCard` (styles inline + hover JS → CSS pur) - en attente
- Unification `market-sell-card` ↔ `PokemonCard`
