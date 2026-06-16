import { useEffect, useState, useMemo } from 'react';
import { getMarketListings, createListingsBulk, buyListing, cancelListing } from '../api/marketApi';
import { getMyPokedex } from '../api/pokemonApi';
import { useUserCtx } from '../context/UserContext';
import type { MarketListing, UserPokemonInstance } from '../api/types';
import { getSellPrice } from '../api/types';
import RarityBadge from '../components/RarityBadge';
import Toast from '../components/Toast';
import { Coins, Clock } from '../components/icons';
import { RARITIES, RARITY_FR, TYPE_FR, TYPE_COLORS } from '../utils/pokemon';
import './Market.css';
import './Pokedex.css';

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expiré';
  const totalMin = Math.floor(diff / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days} j ${hours}h`;
  return `${hours}h ${mins}min`;
}

type Tab = 'buy' | 'sell' | 'mine';

type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'number';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent',     label: 'Plus récentes' },
  { value: 'price_asc',  label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'number',     label: 'N° de Pokémon' },
];

export default function Market() {
  const { coins, setCoins, profile } = useUserCtx();

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myPokemons, setMyPokemons] = useState<UserPokemonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('buy');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Filter state (buy + mine tabs)
  const [search, setSearch] = useState('');
  const [filterGen, setFilterGen] = useState<number | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterShiny, setFilterShiny] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  // Sell tab multi-select (bulk listing at a single shared price)
  const [sellSelectedIds, setSellSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkListing, setBulkListing] = useState(false);

  const userId = profile?.id ?? null;

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function refresh() {
    const [listData, pokedexData] = await Promise.all([
      getMarketListings(),
      getMyPokedex(),
    ]);
    setListings(listData);
    setMyPokemons(pokedexData.pokemons);
  }

  useEffect(() => {
    Promise.all([getMarketListings(), getMyPokedex()])
      .then(([listData, pokedexData]) => {
        setListings(listData);
        setMyPokemons(pokedexData.pokemons);
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleBuy(listingId: string) {
    setActionLoading(listingId);
    try {
      const result = await buyListing(listingId);
      setCoins(result.coins_remaining);
      await refresh();
      showToast('Achat effectué !', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur lors de l\'achat', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(listingId: string) {
    setActionLoading(listingId);
    try {
      await cancelListing(listingId);
      await refresh();
      showToast('Annonce annulée.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur lors de l\'annulation', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function toggleSellSelect(instanceId: string) {
    setSellSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }

  async function handleBulkList() {
    const ids = [...sellSelectedIds];
    const priceNum = Number(bulkPrice);
    if (ids.length === 0 || !priceNum || priceNum <= 0 || bulkListing) return;
    if (ids.length > 5 &&
        !window.confirm(`Mettre en vente ${ids.length} Pokémon à ${priceNum.toLocaleString()} coins chacun ?`)) {
      return;
    }
    setBulkListing(true);
    try {
      const res = await createListingsBulk(ids, priceNum);
      await refresh();
      setSellSelectedIds(new Set());
      setBulkPrice('');
      setTab('mine');
      showToast(`${res.listed} Pokémon mis en vente !`, 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur lors de la mise en vente', 'error');
    } finally {
      setBulkListing(false);
    }
  }

  const activeListings = listings.filter(l => l.status === 'active');
  const myListings = listings.filter(l => l.seller_id === userId);

  function applyFilters(list: MarketListing[]) {
    return list.filter(l => {
      const poke = l.userPokemon?.pokemon;
      if (!poke) return true;
      if (search && !poke.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGen !== null && poke.generation !== filterGen) return false;
      if (filterRarity !== null && poke.rarity !== filterRarity) return false;
      if (filterType !== null && !poke.types.includes(filterType)) return false;
      if (filterShiny && !l.userPokemon?.is_shiny) return false;
      return true;
    });
  }

  function applySort(list: MarketListing[]) {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':  return a.price_coins - b.price_coins;
        case 'price_desc': return b.price_coins - a.price_coins;
        case 'number':     return (a.userPokemon?.pokemon.id ?? 0) - (b.userPokemon?.pokemon.id ?? 0);
        case 'recent':     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:           return 0;
      }
    });
  }

  // Derived/memoized values must run on every render (before the early returns
  // below) to keep the hook order stable - see React error #310.
  const filteredActiveListings = useMemo(() => applySort(applyFilters(activeListings)),
    [activeListings, search, filterGen, filterRarity, filterType, filterShiny, sortBy]);
  const filteredMyListings = useMemo(() => applySort(applyFilters(myListings)),
    [myListings, search, filterGen, filterRarity, filterType, filterShiny, sortBy]);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    activeListings.forEach(l => l.userPokemon?.pokemon.types.forEach(t => types.add(t)));
    return [...types].sort();
  }, [activeListings]);

  // Pokemon available for sale: exclude those already listed and those still
  // locked (tradeable_at in the future) - the backend rejects listing a locked
  // Pokémon anyway (400), so don't even offer them here.
  const sellablePokemons = useMemo(() => {
    const listedInstanceIds = new Set(
      listings
        .filter(l => l.status === 'active' && l.seller_id === userId)
        .map(l => l.userPokemon?.instanceId)
        .filter(Boolean)
    );
    const now = Date.now();
    return myPokemons.filter(p =>
      !listedInstanceIds.has(p.instanceId) &&
      !(p.tradeable_at && new Date(p.tradeable_at).getTime() > now)
    );
  }, [myPokemons, listings, userId]);

  // Type chips for the sell tab reflect the user's own Pokémon, not the market.
  const sellableTypes = useMemo(() => {
    const types = new Set<string>();
    sellablePokemons.forEach(p => p.types.forEach(t => types.add(t)));
    return [...types].sort();
  }, [sellablePokemons]);

  // Same filters/sort as the buy & mine tabs, applied to the user's own Pokémon.
  const filteredSellable = useMemo(() => {
    const filtered = sellablePokemons.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGen !== null && p.generation !== filterGen) return false;
      if (filterRarity !== null && p.rarity !== filterRarity) return false;
      if (filterType !== null && !p.types.includes(filterType)) return false;
      if (filterShiny && !p.is_shiny) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':  return getSellPrice(a) - getSellPrice(b);
        case 'price_desc': return getSellPrice(b) - getSellPrice(a);
        case 'number':     return a.id - b.id;
        case 'recent':     return new Date(b.obtainedAt).getTime() - new Date(a.obtainedAt).getTime();
        default:           return 0;
      }
    });
  }, [sellablePokemons, search, filterGen, filterRarity, filterType, filterShiny, sortBy]);

  // Selectable for "select all": filtered sellable minus the favorite (never sold).
  const selectableSellIds = useMemo(
    () => filteredSellable.filter(p => p.instanceId !== profile?.favorite_pokemon_id).map(p => p.instanceId),
    [filteredSellable, profile?.favorite_pokemon_id]
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        Chargement du marché…
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">Erreur : {error}</div>;
  }

  return (
    <div className="market-page">
      {/* Header */}
      <div className="market-header">
        <h1 className="market-title">Marché Pokémon</h1>
        <p className="market-subtitle">Achetez et vendez des Pokémon contre des coins</p>
      </div>

      {/* Tabs */}
      <div className="market-tabs">
        <button
          className={`market-tab${tab === 'buy' ? ' active' : ''}`}
          onClick={() => setTab('buy')}
        >
          Acheter
          {activeListings.length > 0 && (
            <span className="market-tab-count">{activeListings.length}</span>
          )}
        </button>
        <button
          className={`market-tab${tab === 'mine' ? ' active' : ''}`}
          onClick={() => setTab('mine')}
        >
          Mes annonces
          {myListings.length > 0 && (
            <span className="market-tab-count">{myListings.length}</span>
          )}
        </button>
        <button
          className={`market-tab${tab === 'sell' ? ' active' : ''}`}
          onClick={() => setTab('sell')}
        >
          Mettre en vente
        </button>
      </div>

      {/* ── Filters (all tabs) ── */}
      {/* Wrapped in .pokedex-page so the larger Pokédex filter styling
          (.pokedex-page .filter-chip etc.) applies here too. */}
      {(
        <div className="pokedex-page">
        <div className="pokedex-filters">
          <div className="market-filters-top">
            <input
              className="filter-search"
              type="text"
              placeholder="Rechercher un Pokémon…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="market-sort">
              <span className="market-sort-label">Trier</span>
              <select
                className="market-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-row">
            <div className="filter-label">Génération</div>
            <div className="filter-group">
              {[1,2,3,4,5,6,7].map(g => (
                <button
                  key={g}
                  className={`filter-chip${filterGen === g ? ' active' : ''}`}
                  onClick={() => setFilterGen(filterGen === g ? null : g)}
                >Gen {g}</button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-label">Rareté</div>
            <div className="filter-group">
              {RARITIES.map(r => (
                <button
                  key={r}
                  className={`filter-chip rarity-chip rarity-${r.toLowerCase()}${filterRarity === r ? ' active' : ''}`}
                  onClick={() => setFilterRarity(filterRarity === r ? null : r)}
                >{RARITY_FR[r]}</button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-label">Type</div>
            <div className="filter-group filter-types">
              {(tab === 'sell' ? sellableTypes : allTypes).map(t => (
                <button
                  key={t}
                  className={`filter-chip type-chip${filterType === t ? ' active' : ''}`}
                  style={{ '--type-color': TYPE_COLORS[t] ?? '#9CA3AF' } as React.CSSProperties}
                  onClick={() => setFilterType(filterType === t ? null : t)}
                >{TYPE_FR[t] ?? t}</button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-label">Autres</div>
            <div className="filter-group">
              <button
                className={`filter-chip${filterShiny ? ' active' : ''}`}
                onClick={() => setFilterShiny(v => !v)}
              >✨ Shiny</button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── Buy tab ── */}
      {tab === 'buy' && (
        <div className="market-section">
          <div className="market-balance">
            <Coins size={16} /> <span className="market-balance-num">{coins.toLocaleString()}</span> coins
          </div>

          {filteredActiveListings.length === 0 ? (
            <div className="market-empty">Aucune annonce active pour le moment.</div>
          ) : (
            <div className="market-listings">
              {filteredActiveListings.map(listing => {
                const poke = listing.userPokemon?.pokemon;
                const isMine = listing.seller_id === userId;
                const cantAfford = coins < listing.price_coins;
                const isLoading = actionLoading === listing.id;

                return (
                  <div key={listing.id} className="market-card">
                    {poke && (
                      <img
                        className="market-card-sprite"
                        src={poke.sprite_url}
                        alt={poke.name}
                      />
                    )}

                    <span className="market-card-name">{poke?.name ?? '???'}</span>
                    {poke && <RarityBadge rarity={poke.rarity} size="sm" />}

                    <div className="market-card-meta">
                      <span className="market-card-price">
                        <Coins size={14} /> {listing.price_coins.toLocaleString()}
                      </span>
                      <span className="market-card-seller" title={listing.seller.display_name}>
                        {listing.seller.display_name}
                      </span>
                      <span className="market-card-time">
                        <Clock size={12} /> {timeRemaining(listing.expires_at)}
                      </span>
                    </div>

                    {isMine ? (
                      <button className="btn btn-ghost market-card-btn" disabled>Ma vente</button>
                    ) : (
                      <button
                        className="btn btn-primary market-card-btn"
                        onClick={() => handleBuy(listing.id)}
                        disabled={cantAfford || isLoading}
                        title={cantAfford ? 'Coins insuffisants' : undefined}
                      >
                        {isLoading ? (
                          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        ) : cantAfford ? (
                          'Trop cher'
                        ) : (
                          'Acheter'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── My listings tab ── */}
      {tab === 'mine' && (
        <div className="market-section">
          {filteredMyListings.length === 0 ? (
            <div className="market-empty">Vous n'avez aucune annonce active.</div>
          ) : (
            <div className="market-listings">
              {filteredMyListings.map(listing => {
                const poke = listing.userPokemon?.pokemon;
                const isLoading = actionLoading === listing.id;

                return (
                  <div key={listing.id} className="market-card">
                    {poke && (
                      <img
                        className="market-card-sprite"
                        src={poke.sprite_url}
                        alt={poke.name}
                      />
                    )}

                    <span className="market-card-name">{poke?.name ?? '???'}</span>
                    {poke && <RarityBadge rarity={poke.rarity} size="sm" />}

                    <div className="market-card-meta">
                      <span className="market-card-price">
                        <Coins size={14} /> {listing.price_coins.toLocaleString()}
                      </span>
                      <span className="market-card-time">
                        <Clock size={12} /> {timeRemaining(listing.expires_at)}
                      </span>
                      <span className={`market-card-status market-card-status--${listing.status}`}>
                        {listing.status === 'active' ? 'Active' : listing.status === 'sold' ? 'Vendue' : 'Annulée'}
                      </span>
                    </div>

                    {listing.status === 'active' && (
                      <button
                        className="btn btn-danger market-card-btn"
                        onClick={() => handleCancel(listing.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        ) : (
                          'Annuler'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sell tab ── */}
      {tab === 'sell' && (
        <div className="market-section market-sell-section">
          <div className="market-sell-header">
            <span className="market-sell-label">Sélectionnez les Pokémon à vendre</span>
            <div className="market-sell-tools">
              <span className="market-sell-count">{filteredSellable.length} affichés</span>
              <button
                type="button"
                className="filter-chip"
                onClick={() => setSellSelectedIds(new Set(selectableSellIds))}
                disabled={selectableSellIds.length === 0}
              >
                Tout sélectionner ({selectableSellIds.length})
              </button>
              {sellSelectedIds.size > 0 && (
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setSellSelectedIds(new Set())}
                >
                  Désélectionner
                </button>
              )}
            </div>
          </div>

          {filteredSellable.length === 0 ? (
            <div className="market-empty">Aucun Pokémon ne correspond à ces filtres.</div>
          ) : (
            <div className="market-sell-grid">
              {filteredSellable.map(p => {
                const isSelected = sellSelectedIds.has(p.instanceId);
                const isFavorite = p.instanceId === profile?.favorite_pokemon_id;
                const marketPrice = getSellPrice(p);
                const toggle = () => {
                  if (isFavorite) return;
                  toggleSellSelect(p.instanceId);
                };
                return (
                  <div
                    key={p.instanceId}
                    className={`market-sell-card${isSelected ? ' selected' : ''}`}
                    style={isFavorite ? { opacity: 0.55, cursor: 'not-allowed', position: 'relative' } : undefined}
                    role="button"
                    tabIndex={isFavorite ? -1 : 0}
                    aria-pressed={isSelected}
                    aria-disabled={isFavorite || undefined}
                    aria-label={isFavorite ? `${p.name} - Pokémon favori, non vendable` : `Sélectionner ${p.name} à vendre`}
                    title={isFavorite ? 'Pokémon favori' : undefined}
                    onClick={toggle}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                  >
                    {isFavorite && (
                      <span style={{ position: 'absolute', top: 4, right: 6, zIndex: 1 }}>⭐</span>
                    )}
                    <img
                      src={p.sprite_url}
                      alt={p.name}
                      className="market-sell-card-sprite"
                    />
                    <span className="market-sell-card-name">{p.name}</span>
                    <RarityBadge rarity={p.rarity} size="sm" />
                    <span className="market-sell-card-hint">
                      {isFavorite ? 'Pokémon favori' : `${marketPrice} coins market ~`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {sellSelectedIds.size > 0 && (
            <div className="market-sell-bulk-bar">
              <span className="market-sell-bulk-count">
                {sellSelectedIds.size} sélectionné{sellSelectedIds.size > 1 ? 's' : ''}
              </span>
              <input
                type="number"
                min={1}
                value={bulkPrice}
                onChange={e => setBulkPrice(e.target.value)}
                className="market-price-input"
                placeholder="Prix unique (coins)"
                aria-label="Prix unique pour tous les Pokémon sélectionnés"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkList}
                disabled={!bulkPrice || Number(bulkPrice) <= 0 || bulkListing}
              >
                {bulkListing ? (
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  `Mettre en vente (${sellSelectedIds.size})`
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
