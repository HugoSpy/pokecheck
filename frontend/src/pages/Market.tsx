import { useEffect, useState } from 'react';
import { getMarketListings, createListing, buyListing, cancelListing } from '../api/marketApi';
import { getMyPokedex } from '../api/pokemonApi';
import { useUserCtx } from '../context/UserContext';
import type { MarketListing, UserPokemonInstance } from '../api/types';
import { getSellPrice } from '../api/types';
import RarityBadge from '../components/RarityBadge';
import Toast from '../components/Toast';
import { Coins, Clock } from '../components/icons';
import './Market.css';

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

export default function Market() {
  const { coins, setCoins, profile } = useUserCtx();

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myPokemons, setMyPokemons] = useState<UserPokemonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('buy');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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

  const activeListings = listings.filter(l => l.status === 'active');
  const myListings = listings.filter(l => l.seller_id === userId);

  // Pokemon available for sale: exclude those already listed
  const listedInstanceIds = new Set(
    listings
      .filter(l => l.status === 'active' && l.seller_id === userId)
      .map(l => l.userPokemon?.instanceId)
      .filter(Boolean)
  );
  const sellablePokemons = myPokemons.filter(p => !listedInstanceIds.has(p.instanceId));

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

      {/* ── Buy tab ── */}
      {tab === 'buy' && (
        <div className="market-section">
          <div className="market-balance">
            <Coins size={16} /> <span className="market-balance-num">{coins.toLocaleString()}</span> coins
          </div>

          {activeListings.length === 0 ? (
            <div className="market-empty">Aucune annonce active pour le moment.</div>
          ) : (
            <div className="market-listings">
              {activeListings.map(listing => {
                const poke = listing.userPokemon?.pokemon;
                const isMine = listing.seller_id === userId;
                const cantAfford = coins < listing.price_coins;
                const isLoading = actionLoading === listing.id;

                return (
                  <div key={listing.id} className="market-listing">
                    {/* Sprite */}
                    {poke && (
                      <img
                        className="market-listing-sprite"
                        src={poke.sprite_url}
                        alt={poke.name}
                      />
                    )}

                    {/* Info */}
                    <div className="market-listing-info">
                      <span className="market-listing-name">{poke?.name ?? '???'}</span>
                      {poke && <RarityBadge rarity={poke.rarity} size="sm" />}
                    </div>

                    {/* Price + seller */}
                    <div className="market-listing-meta">
                      <span className="market-listing-price">
                        <Coins size={14} /> {listing.price_coins.toLocaleString()} coins
                      </span>
                      <span className="market-listing-seller">
                        {listing.seller.display_name}
                      </span>
                      <span className="market-listing-time">
                        <Clock size={12} /> {timeRemaining(listing.expires_at)}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="market-listing-action">
                      {isMine ? (
                        <button className="btn btn-ghost" disabled>Ma vente</button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleBuy(listing.id)}
                          disabled={cantAfford || isLoading}
                          title={cantAfford ? 'Coins insuffisants' : undefined}
                        >
                          {isLoading ? (
                            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          ) : cantAfford ? (
                            'Coins insuffisants'
                          ) : (
                            'Acheter'
                          )}
                        </button>
                      )}
                    </div>
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
          {myListings.length === 0 ? (
            <div className="market-empty">Vous n'avez aucune annonce active.</div>
          ) : (
            <div className="market-listings">
              {myListings.map(listing => {
                const poke = listing.userPokemon?.pokemon;
                const isLoading = actionLoading === listing.id;

                return (
                  <div key={listing.id} className="market-listing">
                    {poke && (
                      <img
                        className="market-listing-sprite"
                        src={poke.sprite_url}
                        alt={poke.name}
                      />
                    )}

                    <div className="market-listing-info">
                      <span className="market-listing-name">{poke?.name ?? '???'}</span>
                      {poke && <RarityBadge rarity={poke.rarity} size="sm" />}
                    </div>

                    <div className="market-listing-meta">
                      <span className="market-listing-price">
                        <Coins size={14} /> {listing.price_coins.toLocaleString()} coins
                      </span>
                      <span className="market-listing-time">
                        <Clock size={12} /> {timeRemaining(listing.expires_at)}
                      </span>
                      <span
                        className={`market-listing-status market-listing-status--${listing.status}`}
                      >
                        {listing.status === 'active' ? 'Active' : listing.status === 'sold' ? 'Vendue' : 'Annulée'}
                      </span>
                    </div>

                    <div className="market-listing-action">
                      {listing.status === 'active' && (
                        <button
                          className="btn btn-danger"
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
