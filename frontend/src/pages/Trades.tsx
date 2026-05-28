import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getTradeOffers, getMyPokedex, getPublicPokedex,
  proposeTrade, acceptTrade, declineTrade,
  type TradeOffer, type UserPokemonInstance,
} from '../api';
import PokemonCard from '../components/PokemonCard';
import TradeAnimation3D from '../components/TradeAnimation3D';
import './Trades.css';

interface LocationState {
  targetUserId?: string;
  targetUserName?: string;
}

export default function Trades() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [offers, setOffers] = useState<TradeOffer[]>([]);
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
  const [userSearchInput, setUserSearchInput] = useState(state?.targetUserId ?? '');

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

    getMyPokedex()
      .then(d => setMyPokemons(d.pokemons))
      .catch(() => null)
      .finally(() => setLoadingMine(false));
  }, []);

  useEffect(() => {
    if (!state?.targetUserId) return;
    loadTargetUser(state.targetUserId);
  }, [state?.targetUserId]);

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
    } catch (e) {
      setError((e as Error).message);
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

      {/* ── Propose a trade ── */}
      <section className="trades-section">
        <h2 className="trades-section-title">Proposer un échange</h2>

        {/* Target user search */}
        <div className="user-search">
          <input
            className="user-search-input"
            type="text"
            placeholder="ID de l'élève (UUID)"
            value={userSearchInput}
            onChange={e => setUserSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadTargetUser(userSearchInput)}
          />
          <button
            className="btn btn-ghost"
            onClick={() => loadTargetUser(userSearchInput)}
            disabled={!userSearchInput.trim()}
          >
            Rechercher
          </button>
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

            <div className="proposal-arrow">⇄</div>

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
          <span>{give?.name ?? '?'}</span>
          <span className="offer-poke-pts">{give?.points ?? 0} pts</span>
        </div>
        <span className="offer-arrow">⇄</span>
        <div className="offer-pokemon">
          {recv && <img src={recv.sprite_url} alt={recv.name} />}
          <span>{recv?.name ?? '?'}</span>
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
