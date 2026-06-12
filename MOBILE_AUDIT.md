# Audit responsive mobile — PokéCheck

> Audit réalisé le 12/06/2026 sur viewport **375×667** (iPhone SE) via Playwright headless
> (Chromium, `isMobile: true`, touch), branche `dev`, dev server Vite + backend staging.
> Chaque page a été capturée et analysée automatiquement : débordement horizontal du document,
> éléments fautifs, cibles tactiles < 36-44px, font-size < 11px.
> Screenshots et scripts : `/tmp/mobile-audit/` (régénérables, non committés).
>
> **État général : bon.** La base mobile existe déjà (bottom-nav 8 onglets qui tient pile à 375px,
> safe-area iPhone, nav-links masqués, modals plein écran, pack opening CSGO impeccable sur mobile).
> L'audit relève 2 vraies casses (Trades, Profile), 1 débordement Shop, et une série
> d'ajustements de confort.

## Méthodologie / reproduction

```bash
cd frontend && npm run dev -- --port 5199
node /tmp/mobile-audit/audit.mjs        # pages principales (+ --admin pour les pages admin)
node /tmp/mobile-audit/audit3.mjs       # interactions (modals, tabs, achat pack…)
```

Pages couvertes : Login, Leaderboard, Pokédex (+ modal détail, modal recherche, filtres),
Trades (+ recherche élève, panneau de proposition), Market (achat / mes annonces / mettre en vente),
Boutique (+ achat + ouverture de pack ShopPackOpen), Battle (lobby + création),
Profile (badges, streak, dresseur), Features/Idées, UserPokedex (`/u/:id`),
AdminPortal, AdminAttendance, AdminFeatures.

---

## ✅ Tier 🟢 — Implémenté (commit `fix/mobile-quick-wins`, 12/06/2026)

Tous les quick wins ont été appliqués et re-validés à 375×667 (Playwright).
Aucune régression à 1280px (overflowX=0 sur toutes les pages modifiées).

| # | Fix | Fichier(s) | Résultat |
|---|-----|------------|---------|
| QW1 | `min-width: 0` sur `.propose-col` + `.trade-grid-filters` → overflow 859px → 0 | `Trades.css` | ✅ |
| QW2 | `flex-wrap: wrap` sur `.profile-claim-row` → overflow 104px → 0 | `Profile.css` | ✅ |
| QW3 | `min-width: 0` sur `.shop-card` + 2 colonnes sous 640px → overflow 136px → 0, qty 30px | `Shop.css` | ✅ |
| QW4 | `.nav-logout { padding: 12px 14px }` + `.ap-portal-btn { min-height/width: 40px }` sous 640px | `Layout.css`, `AdminPortalButton.css` | ✅ nav-logout 40px |
| QW5 | `.pokedex-search-btn { padding: 11px 14px }` sous 640px → ~40px | `Pokedex.css` | ✅ |
| QW6 | `.feat-vote-btn { width: 44px; height: 44px }` sous 640px | `Features.css` | ✅ |
| QW7 | `.pdm-close { 44×44 }` + `.psm-close { min 44×44 }` sous 640px | `PokemonDetailModal.css`, `PokemonSearchModal.css` | ✅ 44×44 confirmé |
| QW8 | `.badge-card-date` 9px → `var(--text-xs)`, `.nav-admin-badge` 9px → `var(--text-xs)`, `.stat-chip-label` 10px → `var(--text-xs)` | `Profile.css`, `Layout.css`, `Pokedex.css` | ✅ |
| QW9 | Back button `← Retour` : `padding: 0` → `padding: 10px 0` → 36px | `UserPokedex.tsx` | ✅ 36px |
| QW10 | `.market-tab` : `padding: 10px`, `font-size: var(--text-sm)`, `white-space: nowrap` sous 640px | `Market.css` | ✅ tabs sur 1 ligne |

---

## 🟢 Quick wins — référence originale (archivé)

### QW1 — Trades : débordement horizontal de 859px ⚠️ LE bug mobile
- **Page** : Échanges (`/trades`), section « Proposer un échange »
- **Problème** : tout le document scrolle horizontalement (scrollWidth 1234px pour 375px de viewport).
  `.propose-col` est un item de `.propose-grid` (grid) **sans `min-width: 0`** : la rangée de
  18 chips de type (`.filter-types`, `flex-wrap: nowrap` sous 640px, large de 1171px) impose sa
  largeur min-content à la track. Le panneau entier (filtres, recherche, grille de Pokémon) rend
  à ~1200px de large → la page est inutilisable pour proposer un échange sur téléphone.
- **Fix** : `Trades.css` → `.propose-col { min-width: 0; }` (et par sécurité
  `.trade-grid-filters { min-width: 0; }`). 1 à 2 lignes.
- **Fichier** : `frontend/src/pages/Trades.css` (~l. 253)

### QW2 — Profile : boutons coins/pack qui sortent de l'écran (104px)
- **Page** : Profil, carte « coins & streak »
- **Problème** : `.profile-claim-row` est un flex **sans `flex-wrap`** ; « Récupérer mes coins du
  jour » + « Ouvrir le pack » côte à côte = 479px de large, le 2ᵉ bouton sort de l'écran et fait
  scroller toute la page horizontalement.
- **Fix** : `.profile-claim-row { flex-wrap: wrap; }`
- **Fichier** : `frontend/src/pages/Profile.css:71`

### QW3 — Boutique : débordement horizontal de 136px
- **Page** : Boutique (`/shop`)
- **Problème** : la grille « toujours 3 packs sur une rangée » (`repeat(3, 1fr)`) ne peut pas
  descendre sous ~158px/carte : `.shop-buy-btn` est en `white-space: nowrap` (« ACHETER - 50 »)
  et la carte n'a pas `min-width: 0`. À 375px la 3ᵉ carte est coupée et la page scrolle
  horizontalement.
- **Fix CSS minimal** : `.shop-card { min-width: 0; }` + sous 640px retirer le `nowrap` ou
  abréger le label (« ACHETER » seul, le prix étant déjà affiché au-dessus). Le vrai confort
  d'usage est en M2 ci-dessous.
- **Fichier** : `frontend/src/pages/Shop.css` (l. 58-64, 159-163, 173-186)

### QW4 — Touch targets de la top-nav
- **Pages** : toutes
- **Problème** : « Déconnexion » (`.nav-logout`, padding 5px) mesure **26px de haut** ;
  le bouton « Admin » (`.ap-portal-btn`) 34×30.
- **Fix** : sous 640px, padding vertical ≥ 9px pour atteindre ≥ 36-40px de haut (le `.btn` de
  base à 10px 22px est déjà bon — ce sont les overrides qui réduisent).
- **Fichiers** : `frontend/src/components/Layout.css:149-152`, `frontend/src/components/AdminPortalButton.css`

### QW5 — Pokédex : bouton « Rechercher un Pokémon » à 31px de haut
- **Page** : Pokédex
- **Problème** : `.pokedex-search-btn` 153×31 — c'est l'action principale de la page.
- **Fix** : padding vertical pour ≥ 40px sur mobile.
- **Fichier** : `frontend/src/pages/Pokedex.css`

### QW6 — Features : boutons de vote 36×30
- **Page** : Idées (`/features`)
- **Problème** : `.feat-vote-btn` (👍/👎) mesure 36×30 — action principale de la page, ratée
  facilement au pouce.
- **Fix** : min 40×40 (44 idéal) sous 640px.
- **Fichier** : `frontend/src/pages/Features.css` (~l. 91-98)

### QW7 — Boutons de fermeture des modals trop petits
- **Pages** : modal détail Pokémon (`.pdm-close` 28×28), modal recherche (`.psm-close` 33×28)
- **Fix** : zone de tap 44×44 (augmenter le padding sans changer le visuel de l'icône).
- **Fichiers** : `frontend/src/components/PokemonDetailModal.css:52`,
  `frontend/src/components/PokemonSearchModal.css`

### QW8 — Micro-typo sous 11px
- **Pages** : Profil (`.badge-card-date` **9px**), badge « ADMIN » nav (9px), `.stat-chip-label`
  10px, `.notif-badge` 10px.
- **Fix** : remonter à `var(--text-xs)` (11px) là où c'est du contenu à lire (la date de badge
  surtout) ; les pastilles de compteur peuvent rester.
- **Fichiers** : `frontend/src/pages/Profile.css`, `frontend/src/components/Layout.css:173`

### QW9 — UserPokedex : « ← Retour » 49×16
- **Page** : `/u/:id` (pokédex d'un autre joueur)
- **Problème** : le lien retour est un bouton texte nu de 16px de haut.
- **Fix** : en faire un `.btn btn-ghost` ou padding ≥ 12px.
- **Fichier** : `frontend/src/pages/UserPokedex.tsx` (style inline)

### QW10 — Market : onglet « Mes annonces » wrappe sur 2 lignes
- **Page** : Marché — les 3 tabs (« Acheter 12 », « Mes annonces », « Mettre en vente »)
  se compriment, « Mes annonces » passe sur 2 lignes et les hauteurs divergent.
- **Fix** : sous 640px réduire padding/letter-spacing des tabs ou `white-space: nowrap` +
  font condensée plus petite.
- **Fichier** : `frontend/src/pages/Market.css`

**Estimation tier 🟢 : ~2h30 – 3h au total** (QW1 et QW2 = 10 min à eux deux et règlent les
deux seules vraies casses).

---

## 🟡 Moyen (refactor de layout localisé, media queries structurelles)

### M1 — Leaderboard : la moitié droite du tableau est invisible
- **Page** : Classement
- **Problème** : `.lb-table` a `min-width: 560px` dans un wrapper `overflow-x: auto`. Ça scrolle,
  mais à 375px on ne voit que Rang + Joueur + début de Score — les colonnes Pokémon/Shiny/Coins
  sont cachées et **rien n'indique qu'on peut scroller**. C'est la page d'accueil de l'app.
- **Fix proposé** : media query < 640px : réduire les paddings de cellules (16px → 8px),
  masquer les colonnes secondaires (l'onglet Score n'a pas besoin de la colonne Coins et
  inversement — les tabs existent déjà), éventuellement geler la colonne Joueur
  (`position: sticky; left: 0`). Pas de refonte : le tableau reste un tableau.
- **Fichiers** : `frontend/src/pages/Leaderboard.css` (l. 47-99), `Leaderboard.tsx`
  (classes conditionnelles de colonnes)

### M2 — Boutique : 3 packs par rangée = cartes de 110px
- **Page** : Boutique
- **Problème** : même une fois QW3 appliqué, 3 cartes par rangée à 375px donnent des packs
  minuscules, des boutons ×1/×2/×5/×10 de ~24px et des prix serrés. Le commentaire CSS dit
  « always 3 packs on one row » : c'est un choix desktop qui ne tient pas à 375px.
- **Fix proposé** : sous 640px, passer en **1 colonne** avec carte horizontale (art du pack à
  gauche ~40%, nom/prix/qty/acheter à droite) — ou carrousel scroll-snap 1,2 carte visible.
  Décision design à valider.
- **Fichiers** : `frontend/src/pages/Shop.css`, éventuellement `Shop.tsx` (structure DOM)

### M3 — Trades : compacter le panneau de proposition
- **Page** : Échanges
- **Problème** : après QW1 le panneau rentre dans l'écran, mais il reste très long : recherche
  élève → bloc filtres complet (génération 8 chips + rareté 5 + types 18 + shiny/doublons) →
  grille « à offrir » → grille « demandés » → résumé. Sur mobile on scrolle ~4 écrans avant de
  valider, et les chips de filtre font 25px de haut.
- **Fix proposé** : filtres repliés par défaut sous 640px (bouton « Filtres » qui toggle, la
  recherche texte reste visible), chips ≥ 36px de haut, et `position: sticky` en bas pour le
  résumé/bouton « Proposer » quand des Pokémon sont sélectionnés.
- **Fichiers** : `frontend/src/pages/Trades.css`, `Trades.tsx`,
  `frontend/src/components/PokemonFilters.tsx` (prop `collapsible`)

### M4 — Market : ~600px de filtres avant le premier listing
- **Page** : Marché, onglet Acheter
- **Problème** : recherche + tri + 7 boutons GEN en grille 3 colonnes + rareté = le premier
  Pokémon en vente n'apparaît qu'après un écran entier de scroll.
- **Fix proposé** : réutiliser le pattern déjà présent dans le Pokédex (`.filter-types` :
  chips horizontales scrollables en une ligne) pour GEN et rareté, ou filtres repliables
  (même composant que M3).
- **Fichier** : `frontend/src/pages/Market.css`, `Market.tsx`

### M5 — Profile : grille de badges tronquée
- **Page** : Profil, section badges (169 badges)
- **Problème** : 3 colonnes de ~94px → tous les noms sont coupés (« Première conn… »,
  « Légendaire de … »), la date est en 9px. Difficile d'identifier un badge sans l'ouvrir.
- **Fix proposé** : sous 480px passer à 2 colonnes plus larges (minmax(140px, 1fr)) avec nom
  sur 2 lignes (`-webkit-line-clamp: 2`), date en 11px ; ou liste verticale icône + texte.
- **Fichier** : `frontend/src/pages/Profile.css` (l. 187, 414-421)

### M6 — PokemonCard : hover JS collant sur tactile
- **Pages** : toutes les grilles de Pokémon
- **Problème** : les effets hover sont faits en JS inline (`onMouseEnter`/`onMouseLeave` qui
  écrivent `style.transform`/`boxShadow`). Sur tactile, le tap déclenche `mouseenter` et l'état
  hover **reste collé** après fermeture du modal (carte surélevée + glow permanent).
- **Fix proposé** : migrer vers CSS `@media (hover: hover)` — c'est le refactor PokemonCard déjà
  listé dans les TODOs de CLAUDE.md ; ce point en est la motivation mobile concrète.
- **Fichiers** : `frontend/src/components/PokemonCard.tsx`, `PokemonCard.css`

---

## 🔴 Gros chantiers

### G1 — Battle de caisse en partie réelle (à valider avant de classer)
- **Page** : `/battle` pendant une partie (BattleArena)
- **Constat** : lobby et écran de création **parfaitement OK** à 375px (vérifiés). En revanche
  l'arène en cours de partie n'a pas pu être testée (nécessite 2 joueurs connectés simultanément
  + une partie lancée). `Battle.css` ne contient **aucune media query** ; les rangées joueur sont
  en `grid-template-columns: 100px 1fr` et le conteneur en `max-width: 640px` — probablement
  passable, mais les reveals simultanés de plusieurs joueurs + l'historique des tirages sont à
  vérifier en réel.
- **Action** : session de test à 2 (les boutons « Connect as Test 1/2 » du backdoor dev servent
  exactement à ça) → soit on déclasse en 🟡/🟢, soit on planifie une passe dédiée.
- **Fichiers** : `frontend/src/pages/Battle.css`, `BattleArena.tsx`

### G2 — Pack opening multi (Event/Shop ×2/×5/×10) en conditions réelles
- **Pages** : `/shop/pack-multi`, `/events/pack-multi`
- **Constat** : l'ouverture **simple** (animation CSGO) a été testée en vrai achat : impeccable
  sur mobile (roll, reveal, vente). Le mode multi (grille `auto-fit minmax(130px, 1fr)`, statique
  OK) n'a pas été déclenché en live, et le flow événement nécessite un event actif en base.
- **Action** : test manuel d'un achat ×5 sur staging ; à déclasser si RAS.
  ⚠️ Rappel contrainte : l'animation pack opening elle-même est **intouchable**.
- **Fichiers** : `frontend/src/pages/EventPackOpenMulti.css`, `ShopPackOpenMulti.tsx`

### (Pas de vraie refonte de page nécessaire)
Aucune page n'exige une refonte complète : la dette mobile est concentrée dans Trades (QW1+M3)
et Boutique (QW3+M2). Si M2 vire au redesign de carte (DOM + 3D BoosterPack en layout
horizontal), il pourra être reclassé 🔴 à la mise en œuvre.

---

## Points vérifiés sans problème (pour mémoire)

- **Login** : centré, lisible (boutons dev test 34px mais dev-only).
- **Bottom-nav** : 8 onglets = exactement 375px (47px chacun, min-height 56px), safe-area OK.
- **Pokédex** : grille, stat-chips, filtres (qui wrappent correctement ici), progression — RAS.
- **Modals** : détail Pokémon, recherche, vente — bien dimensionnés (`max-width` + media queries déjà en place).
- **Market** : grille des listings, mettre en vente, achat — RAS hors M4/QW10.
- **Features/Idées, AdminPortal, AdminAttendance, AdminFeatures** : RAS (admin utilisable sur téléphone).
- **Ouverture de pack (ShopPackOpen, achat réel ×1)** : roll + reveal + boutons — RAS.
- **Notifications** : popover `min(440px, 100vw - 2rem)` — déjà responsive. Le FAB peut recouvrir
  ponctuellement une carte en bas de grille (cosmétique, pas d'action bloquée).

## Note d'audit

Compte de test utilisé : `test-account-1` (backdoor dev). Effets de bord sur la DB staging :
+5000 coins crédités puis un pack Hoenn acheté (-50) pour tester le flow → il reste ~4950 coins
et un Skitty sur ce compte ; `is_admin` a été activé puis **remis à `false`**.
