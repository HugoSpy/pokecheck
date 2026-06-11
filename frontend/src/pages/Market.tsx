import { useEffect, useState, useMemo } from 'react';
import { getMarketListings, createListing, buyListing, cancelListing } from '../api/marketApi';
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

  // Sell form state
  const [selectedPokemon, setSelectedPokemon] = useState<UserPokemonInstance | null>(null);
  const [price, setPrice] = useState('');

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

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPokemon || !price) return;
    setActionLoading('create');
    try {
      await createListing(selectedPokemon.instanceId, Number(price));
      await refresh();
      setSelectedPokemon(null);
      setPrice('');
      setTab('mine');
      showToast('Annonce créée !', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Erreur lors de la création', 'error');
    } finally {
      setActionLoading(null);
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

  // Pokemon available for sale: exclude those already listed and those still
  // locked (tradeable_at in the future) - the backend rejects listing a locked
  // Pokémon anyway (400), so don't even offer them here.
  const listedInstanceIds = new Set(
    listings
      .filter(l => l.status === 'active' && l.seller_id === userId)
      .map(l => l.userPokemon?.instanceId)
      .filter(Boolean)
  );
  const now = Date.now();
  const sellablePokemons = myPokemons.filter(p =>
    !listedInstanceIds.has(p.instanceId) &&
    !(p.tradeable_at && new Date(p.tradeable_at).getTime() > now)
  );

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

      {/* ── Filters (buy + mine tabs) ── */}
      {/* Wrapped in .pokedex-page so the larger Pokédex filter styling
          (.pokedex-page .filter-chip etc.) applies here too. */}
      {(tab === 'buy' || tab === 'mine') && (
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
              {allTypes.map(t => (
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
            <span className="market-sell-label">Sélectionnez un Pokémon à vendre</span>
            <span className="market-sell-count">{sellablePokemons.length} disponibles</span>
          </div>

          {sellablePokemons.length === 0 ? (
            <div className="market-empty">Aucun Pokémon disponible à la vente.</div>
          ) : (
            <div className="market-sell-grid">
              {sellablePokemons.map(p => {
                const isSelected = selectedPokemon?.instanceId === p.instanceId;
                const marketPrice = getSellPrice(p);
                return (
                  <div
                    key={p.instanceId}
                    className={`market-sell-card${isSelected ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Sélectionner ${p.name} à vendre`}
                    onClick={() => {
                      setSelectedPokemon(isSelected ? null : p);
                      setPrice(String(marketPrice));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedPokemon(isSelected ? null : p);
                        setPrice(String(marketPrice));
                      }
                    }}
                  >
                    <img
                      src={p.sprite_url}
                      alt={p.name}
                      className="market-sell-card-sprite"
                    />
                    <span className="market-sell-card-name">{p.name}</span>
                    <RarityBadge rarity={p.rarity} size="sm" />
                    <span className="market-sell-card-hint">
                      {marketPrice} coins market ~
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedPokemon && (
            <form className="market-sell-form" onSubmit={handleCreateListing}>
              <div className="market-sell-form-selected">
                <img
                  src={selectedPokemon.sprite_url}
                  alt={selectedPokemon.name}
                  className="market-sell-form-sprite"
                />
                <div className="market-sell-form-info">
                  <span className="market-sell-form-name">{selectedPokemon.name}</span>
                  <RarityBadge rarity={selectedPokemon.rarity} size="sm" />
                </div>
              </div>

              <div className="market-sell-form-row">
                <label className="market-sell-form-label" htmlFor="sell-price">
                  Prix (coins)
                </label>
                <input
                  id="sell-price"
                  type="number"
                  min={1}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="market-price-input"
                  placeholder="Ex: 150"
                  required
                />
              </div>

              <div className="market-sell-form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setSelectedPokemon(null); setPrice(''); }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!price || Number(price) <= 0 || actionLoading === 'create'}
                >
                  {actionLoading === 'create' ? (
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  ) : (
                    'Mettre en vente'
                  )}
                </button>
              </div>
            </form>
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
