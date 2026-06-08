import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getTradeOffers, getSentTrades, cancelTrade, proposeTrade, acceptTrade, declineTrade } from '../api/tradeApi';
import { getMyPokedex, getPublicPokedex } from '../api/pokemonApi';
import { searchUsers } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { TradeOffer, SentTrade, UserPokemonInstance } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import TradeAnimation3D from '../components/TradeAnimation3D';
import { Swap, Trash } from '../components/icons';
import './Trades.css';

interface LocationState {
  targetUserId?: string;
  targetUserName?: string;
}

export default function Trades() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [sent, setSent] = useState<SentTrade[]>([]);
  const [myPokemons, setMyPokemons] = useState<UserPokemonInstance[]>([]);
  const [theirPokemons, setTheirPokemons] = useState<UserPokemonInstance[]>([]);

  const [targetUserId, setTargetUserId] = useState(state?.targetUserId ?? '');
  const [targetUserName, setTargetUserName] = useState(state?.targetUserName ?? '');
  const [selectedMine, setSelectedMine] = useState<UserPokemonInstance | null>(null);
  const [selectedTheirs, setSelectedTheirs] = useState<UserPokemonInstance | null>(null);

  const [loadingOffers, setLoadingOffers] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingTheirs, setLoadingTheirs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nameQuery, setNameQuery] = useState(state?.targetUserName ?? '');
  const [suggestions, setSuggestions] = useState<{ id: string; display_name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { refreshProfile } = useUserCtx();

  const [animation, setAnimation] = useState<{
    given:      { sprite_url: string; name: string };
    received:   { sprite_url: string; name: string };
    shinyProc:  boolean;
    shinyName?: string;
  } | null>(null);

  useEffect(() => {
    getTradeOffers()
      .then(setOffers)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingOffers(false));

    getSentTrades()
      .then(setSent)
      .catch(() => null);

    getMyPokedex()
      .then(d => setMyPokemons(d.pokemons))
      .catch(() => null)
      .finally(() => setLoadingMine(false));
  }, []);

  async function handleCancel(id: string) {
    try {
      await cancelTrade(id);
      setSent(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!state?.targetUserId) return;
    loadTargetUser(state.targetUserId);
  }, [state?.targetUserId]);

  function handleNameChange(q: string) {
    setNameQuery(q);
    setShowSuggestions(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); return; }
    searchDebounceRef.current = setTimeout(() => {
      searchUsers(q.trim())
        .then(r => setSuggestions(r.users))
        .catch(() => setSuggestions([]));
    }, 280);
  }

  function handleSelectUser(user: { id: string; display_name: string }) {
    setSuggestions([]);
    setShowSuggestions(false);
    setNameQuery(user.display_name);
    loadTargetUser(user.id);
  }

  async function loadTargetUser(userId: string) {
    if (!userId.trim()) return;
    setLoadingTheirs(true);
    setError(null);
    try {
      const data = await getPublicPokedex(userId);
      setTheirPokemons(data.pokemons);
      setTargetUserId(userId);
      setTargetUserName(data.user.display_name);
      setSelectedTheirs(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingTheirs(false);
    }
  }

  async function handleAccept(offer: TradeOffer) {
    try {
      const res = await acceptTrade(offer.id);
      setOffers(prev => prev.filter(o => o.id !== offer.id));
      refreshProfile();

      const given    = offer.toPokemon?.pokemon;
      const received = offer.fromPokemon?.pokemon;

      if (given && received) {
        setAnimation({
          given,
          received,
          shinyProc: res.shiny_proc ?? false,
          shinyName: res.shiny_pokemon_name,
        });
      } else {
        setSuccess('Échange accepté !');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDecline(id: string) {
    try {
      await declineTrade(id);
      setOffers(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handlePropose() {
    if (!selectedMine || !selectedTheirs || !targetUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposeTrade({
        from_pokemon_id: selectedMine.instanceId,
        to_user_id: targetUserId,
        to_pokemon_id: selectedTheirs.instanceId,
      });
      setSuccess('Offre envoyée !');
      setSelectedMine(null);
      setSelectedTheirs(null);
      getSentTrades().then(setSent).catch(() => null);
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg === 'POKEMON_ALREADY_IN_TRADE'
          ? 'Un de ces Pokémon est déjà engagé dans un échange en attente.'
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const tradeableMine = myPokemons.filter(
    p => !p.tradeable_at || new Date(p.tradeable_at) <= new Date()
  );

  function handleAnimationComplete() {
    setAnimation(null);
    getTradeOffers().then(setOffers).catch(() => null);
  }

  return (
    <div className="trades-page">
      {animation && (
        <TradeAnimation3D
          givenPokemon={animation.given}
          receivedPokemon={animation.received}
          shinyProc={animation.shinyProc}
          shinyPokemonName={animation.shinyName}
          onComplete={handleAnimationComplete}
        />
      )}

      <h1 className="trades-title">Échanges</h1>

      {error && (
        <div className="error-banner" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
          {error} — cliquer pour fermer
        </div>
      )}
      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)}>
          {success} ✓
        </div>
      )}

      {/* ── Pending offers ── */}
      <section className="trades-section">
        <h2 className="trades-section-title">
          Offres reçues
          {offers.length > 0 && <span className="badge-count">{offers.length}</span>}
        </h2>

        {loadingOffers ? (
          <div className="loading-screen" style={{ minHeight: 'auto', padding: '32px 0' }}>
            <div className="spinner" />
          </div>
        ) : offers.length === 0 ? (
          <div className="trades-empty">Aucune offre en attente.</div>
        ) : (
          <div className="offers-list">
            {offers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onAccept={() => handleAccept(offer)}
                onDecline={() => handleDecline(offer.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Sent (pending) offers ── */}
      {sent.length > 0 && (
        <section className="trades-section">
          <h2 className="trades-section-title">
            Offres envoyées
            <span className="badge-count">{sent.length}</span>
          </h2>
          <div className="offers-list">
            {sent.map(trade => (
              <SentCard key={trade.id} trade={trade} onCancel={() => handleCancel(trade.id)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Propose a trade ── */}
      <section className="trades-section">
        <h2 className="trades-section-title">Proposer un échange</h2>

        {/* Target user search */}
        <div className="user-search" style={{ position: 'relative' }}>
          <input
            className="user-search-input"
            type="text"
            placeholder="Rechercher un élève par nom…"
            value={nameQuery}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="user-search-listbox"
            aria-autocomplete="list"
            onChange={e => handleNameChange(e.target.value)}
            onFocus={() => nameQuery.trim().length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions.length > 0) {
                e.preventDefault();
                handleSelectUser(suggestions[0]);
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="user-search-suggestions" id="user-search-listbox" role="listbox">
              {suggestions.map(u => (
                <li
                  key={u.id}
                  className="user-search-suggestion-item"
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => handleSelectUser(u)}
                >
                  {u.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="propose-grid">
          {/* My tradeable Pokémon */}
          <div className="propose-col">
            <div className="propose-col-header">
              Mes Pokémon échangeables
              <span className="propose-col-count">{tradeableMine.length}</span>
            </div>
            {loadingMine ? (
              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : tradeableMine.length === 0 ? (
              <div className="trades-empty">Aucun Pokémon échangeable.</div>
            ) : (
              <div className="mini-grid">
                {tradeableMine.map(p => (
                  <PokemonCard
                    key={p.instanceId}
                    pokemon={p}
                    selectable
                    selected={selectedMine?.instanceId === p.instanceId}
                    onSelect={setSelectedMine}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Their Pokémon */}
          <div className="propose-col">
            <div className="propose-col-header">
              Collection de {targetUserName || '…'}
              {theirPokemons.length > 0 && (
                <span className="propose-col-count">{theirPokemons.length}</span>
              )}
            </div>
            {!targetUserId ? (
              <div className="trades-empty">Saisir un ID élève pour voir sa collection.</div>
            ) : loadingTheirs ? (
              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : theirPokemons.length === 0 ? (
              <div className="trades-empty">Cet élève n'a aucun Pokémon.</div>
            ) : (
              <div className="mini-grid">
                {theirPokemons.map(p => (
                  <PokemonCard
                    key={p.instanceId}
                    pokemon={p}
                    selectable
                    selected={selectedTheirs?.instanceId === p.instanceId}
                    onSelect={setSelectedTheirs}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Proposal summary */}
        {(selectedMine || selectedTheirs) && (
          <div className="proposal-summary">
            <div className="proposal-side">
              {selectedMine ? (
                <div className="proposal-poke">
                  <img src={selectedMine.sprite_url} alt={selectedMine.name} />
                  <span>{selectedMine.name}</span>
                </div>
              ) : (
                <div className="proposal-placeholder">Sélectionne ton Pokémon</div>
              )}
            </div>

            <div className="proposal-arrow"><Swap size={20} /></div>

            <div className="proposal-side">
              {selectedTheirs ? (
                <div className="proposal-poke">
                  <img src={selectedTheirs.sprite_url} alt={selectedTheirs.name} />
                  <span>{selectedTheirs.name}</span>
                </div>
              ) : (
                <div className="proposal-placeholder">Sélectionne leur Pokémon</div>
              )}
            </div>

            <button
              className="btn btn-primary"
              disabled={!selectedMine || !selectedTheirs || submitting}
              onClick={handlePropose}
            >
              {submitting ? '…' : 'Proposer'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function OfferCard({ offer, onAccept, onDecline }: {
  offer: TradeOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const give = offer.fromPokemon?.pokemon;
  const recv = offer.toPokemon?.pokemon;

  return (
    <div className="offer-card">
      <div className="offer-from">De {offer.from_user.display_name}</div>
      <div className="offer-exchange">
        <div className="offer-pokemon">
          {give && <img src={give.sprite_url} alt={give.name} />}
          <span>{give?.name ?? '?'}{give?.is_shiny ? ' ✨' : ''}</span>
          <span className="offer-poke-pts">{give?.points ?? 0} pts</span>
        </div>
        <span className="offer-arrow"><Swap size={16} /></span>
        <div className="offer-pokemon">
          {recv && <img src={recv.sprite_url} alt={recv.name} />}
          <span>{recv?.name ?? '?'}{recv?.is_shiny ? ' ✨' : ''}</span>
          <span className="offer-poke-pts">{recv?.points ?? 0} pts</span>
        </div>
      </div>
      <div className="offer-actions">
        <button className="btn btn-primary" onClick={onAccept}>Accepter</button>
        <button className="btn btn-danger" onClick={onDecline}>Refuser</button>
      </div>
    </div>
  );
}

function SentCard({ trade, onCancel }: { trade: SentTrade; onCancel: () => void }) {
  const give = trade.fromPokemon?.pokemon;
  const recv = trade.toPokemon?.pokemon;

  return (
    <div className="offer-card">
      <button className="offer-cancel-btn" onClick={onCancel} title="Annuler l'offre" aria-label="Annuler l'offre">
        <Trash size={16} />
      </button>
      <div className="offer-from">À {trade.to_user.display_name}</div>
      <div className="offer-exchange">
        <div className="offer-pokemon">
          {give && <img src={give.sprite_url} alt={give.name} />}
          <span>{give?.name ?? '?'}{give?.is_shiny ? ' ✨' : ''}</span>
          <span className="offer-poke-pts">{give?.points ?? 0} pts</span>
        </div>
        <span className="offer-arrow"><Swap size={16} /></span>
        <div className="offer-pokemon">
          {recv && <img src={recv.sprite_url} alt={recv.name} />}
          <span>{recv?.name ?? '?'}{recv?.is_shiny ? ' ✨' : ''}</span>
          <span className="offer-poke-pts">{recv?.points ?? 0} pts</span>
        </div>
      </div>
      <div className="offer-actions">
        <button className="btn btn-danger" onClick={onCancel}>Annuler l'offre</button>
      </div>
    </div>
  );
}
