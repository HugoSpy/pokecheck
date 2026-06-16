import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTradeOffers, getSentTrades, cancelTrade, proposeTrade, acceptTrade, declineTrade } from '../api/tradeApi';
import { getMyPokedex, getPublicPokedex } from '../api/pokemonApi';
import { searchUsers } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { TradeOffer, SentTrade, UserPokemonInstance, TradeItemView } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import RarityBadge from '../components/RarityBadge';
import TradeAnimation3D from '../components/TradeAnimation3D';
import { Swap, Trash } from '../components/icons';
import { RARITIES, RARITY_FR, TYPE_FR, TYPE_COLORS } from '../utils/pokemon';
import './Trades.css';

interface LocationState {
  targetUserId?: string;
  targetUserName?: string;
}

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7];

// Independent display filters for one propose-trade grid. Selection state lives
// separately, so a selected Pokémon stays selected even when filtered out.
interface GridFilter {
  search: string;
  gen: number | null;
  rarity: string | null;
  type: string | null;
  shiny: boolean;
  duplicates: boolean;
}
const EMPTY_FILTER: GridFilter = { search: '', gen: null, rarity: null, type: null, shiny: false, duplicates: false };

// Extra copies in a list: for each variant (species + shiny) the oldest copy is
// kept and every other copy is an "extra". Drives the Doublons filter so a trade
// surfaces the surplus a side could give away while keeping one of each.
function duplicateExtraIds(list: UserPokemonInstance[]): Set<string> {
  const oldest = new Map<string, number>();
  for (const p of list) {
    const key = `${p.id}-${p.is_shiny ? 's' : 'n'}`;
    const t = new Date(p.obtainedAt).getTime();
    const cur = oldest.get(key);
    if (cur === undefined || t < cur) oldest.set(key, t);
  }
  const kept = new Set<string>();
  const extras = new Set<string>();
  for (const p of list) {
    const key = `${p.id}-${p.is_shiny ? 's' : 'n'}`;
    if (new Date(p.obtainedAt).getTime() === oldest.get(key) && !kept.has(key)) kept.add(key);
    else extras.add(p.instanceId);
  }
  return extras;
}

function applyGridFilter(list: UserPokemonInstance[], f: GridFilter): UserPokemonInstance[] {
  const extras = f.duplicates ? duplicateExtraIds(list) : null;
  return list.filter(p => {
    if (extras && !extras.has(p.instanceId)) return false;
    if (f.search && !p.name.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.gen !== null && p.generation !== f.gen) return false;
    if (f.rarity !== null && p.rarity !== f.rarity) return false;
    if (f.type !== null && !p.types.includes(f.type)) return false;
    if (f.shiny && !p.is_shiny) return false;
    return true;
  });
}

// Distinct types present in a list, sorted - drives the per-grid Type chips.
function typesOf(list: UserPokemonInstance[]): string[] {
  const s = new Set<string>();
  list.forEach(p => p.types.forEach(t => s.add(t)));
  return [...s].sort();
}

const MAX_PER_SIDE = 10;

export default function Trades() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [sent, setSent] = useState<SentTrade[]>([]);
  const [myPokemons, setMyPokemons] = useState<UserPokemonInstance[]>([]);
  const [theirPokemons, setTheirPokemons] = useState<UserPokemonInstance[]>([]);

  const [targetUserId, setTargetUserId] = useState(state?.targetUserId ?? '');
  const [targetUserName, setTargetUserName] = useState(state?.targetUserName ?? '');
  const [selectedMineIds, setSelectedMineIds] = useState<string[]>([]);
  const [selectedTheirsIds, setSelectedTheirsIds] = useState<string[]>([]);
  const [mineFilter, setMineFilter] = useState<GridFilter>(EMPTY_FILTER);
  const [theirsFilter, setTheirsFilter] = useState<GridFilter>(EMPTY_FILTER);
  const [coinsOffered, setCoinsOffered] = useState(0);
  const [coinsRequested, setCoinsRequested] = useState(0);

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

  const { coins, refreshProfile, profile } = useUserCtx();
  const favoriteId = profile?.favorite_pokemon_id ?? null;

  const [animation, setAnimation] = useState<{
    given:      { sprite_url: string; name: string };
    received:   { sprite_url: string; name: string };
    shinyProc:  boolean;
    shinyName?: string;
    receivedItems: TradeItemView[];
  } | null>(null);
  // Post-animation results grid: every Pokémon received in the accepted trade.
  const [results, setResults] = useState<TradeItemView[] | null>(null);

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
      const data = await getPublicPokedex(userId, { forTrade: true });
      setTheirPokemons(data.pokemons);
      setTargetUserId(userId);
      setTargetUserName(data.user.display_name);
      setSelectedTheirsIds([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingTheirs(false);
    }
  }

  // Toggle a Pokémon in/out of a side, enforcing the 6-per-side cap.
  function toggleSelection(
    instanceId: string,
    current: string[],
    setter: (next: string[]) => void,
  ) {
    if (current.includes(instanceId)) {
      setter(current.filter(id => id !== instanceId));
      return;
    }
    if (current.length >= MAX_PER_SIDE) {
      setError(`Maximum ${MAX_PER_SIDE} Pokémon par côté.`);
      return;
    }
    setter([...current, instanceId]);
  }

  async function handleAccept(offer: TradeOffer) {
    try {
      const res = await acceptTrade(offer.id);
      setOffers(prev => prev.filter(o => o.id !== offer.id));
      refreshProfile();

      // The recipient receives the proposer's ('from') Pokémon.
      const receivedItems = offer.items.filter(i => i.owner === 'from');
      const given    = offer.toPokemon?.pokemon;
      const received = offer.fromPokemon?.pokemon;

      if (given && received) {
        setAnimation({
          given,
          received,
          shinyProc: res.shiny_proc ?? false,
          shinyName: res.shiny_pokemon_name,
          receivedItems,
        });
      } else if (receivedItems.length > 0) {
        setResults(receivedItems);
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
    if (selectedMineIds.length === 0 || selectedTheirsIds.length === 0 || !targetUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposeTrade({
        from_pokemon_ids: selectedMineIds,
        to_user_id: targetUserId,
        to_pokemon_ids: selectedTheirsIds,
        coins_offered: coinsOffered,
        coins_requested: coinsRequested,
      });
      setSuccess('Offre envoyée !');
      setSelectedMineIds([]);
      setSelectedTheirsIds([]);
      setCoinsOffered(0);
      setCoinsRequested(0);
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

  const displayedMine = applyGridFilter(tradeableMine, mineFilter);
  const displayedTheirs = applyGridFilter(theirPokemons, theirsFilter);
  const mineTypes = typesOf(tradeableMine);
  const theirsTypes = typesOf(theirPokemons);
  const mineDupCount = duplicateExtraIds(tradeableMine).size;
  const theirsDupCount = duplicateExtraIds(theirPokemons).size;

  const mineById = new Map(tradeableMine.map(p => [p.instanceId, p]));
  const theirsById = new Map(theirPokemons.map(p => [p.instanceId, p]));
  const selectedMinePokes = selectedMineIds.map(id => mineById.get(id)).filter((p): p is UserPokemonInstance => !!p);
  const selectedTheirsPokes = selectedTheirsIds.map(id => theirsById.get(id)).filter((p): p is UserPokemonInstance => !!p);

  function handleAnimationComplete() {
    const items = animation?.receivedItems ?? [];
    setAnimation(null);
    if (items.length > 0) setResults(items);
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

      {results && (
        <TradeResults
          items={results}
          onClose={() => setResults(null)}
          onPokedex={() => { setResults(null); navigate('/pokedex'); }}
        />
      )}

      <h1 className="trades-title">Échanges</h1>

      {error && (
        <div className="error-banner" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
          {error} - cliquer pour fermer
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
              Mes Pokémon à offrir
              <span className="propose-col-count">{selectedMineIds.length}/{MAX_PER_SIDE}</span>
            </div>
            {loadingMine ? (
              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : tradeableMine.length === 0 ? (
              <div className="trades-empty">Aucun Pokémon échangeable.</div>
            ) : (
              <>
                <GridFilters filter={mineFilter} onChange={setMineFilter} types={mineTypes} duplicateCount={mineDupCount} />
                <div className="mini-grid">
                  {displayedMine.map(p => (
                    p.instanceId === favoriteId ? (
                      // The favorite Pokémon is untradeable: shown but disabled.
                      <div
                        key={p.instanceId}
                        title="Pokémon favori"
                        style={{ position: 'relative', opacity: 0.55, cursor: 'not-allowed' }}
                      >
                        <span style={{ position: 'absolute', top: 6, right: 8, zIndex: 2 }}>⭐</span>
                        <div style={{ pointerEvents: 'none' }}>
                          <PokemonCard pokemon={p} selectable selected={false} />
                        </div>
                      </div>
                    ) : (
                      <PokemonCard
                        key={p.instanceId}
                        pokemon={p}
                        selectable
                        selected={selectedMineIds.includes(p.instanceId)}
                        onSelect={() => toggleSelection(p.instanceId, selectedMineIds, setSelectedMineIds)}
                      />
                    )
                  ))}
                </div>
                <GridCount selected={selectedMineIds.length} shown={displayedMine.length} total={tradeableMine.length} />
              </>
            )}
          </div>

          {/* Their Pokémon */}
          <div className="propose-col">
            <div className="propose-col-header">
              Pokémon demandés à {targetUserName || '…'}
              <span className="propose-col-count">{selectedTheirsIds.length}/{MAX_PER_SIDE}</span>
            </div>
            {!targetUserId ? (
              <div className="trades-empty">Saisir un élève pour voir sa collection.</div>
            ) : loadingTheirs ? (
              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : theirPokemons.length === 0 ? (
              <div className="trades-empty">Cet élève n'a aucun Pokémon.</div>
            ) : (
              <>
                <GridFilters filter={theirsFilter} onChange={setTheirsFilter} types={theirsTypes} duplicateCount={theirsDupCount} />
                <div className="mini-grid">
                  {displayedTheirs.map(p => (
                    <PokemonCard
                      key={p.instanceId}
                      pokemon={p}
                      selectable
                      selected={selectedTheirsIds.includes(p.instanceId)}
                      onSelect={() => toggleSelection(p.instanceId, selectedTheirsIds, setSelectedTheirsIds)}
                    />
                  ))}
                </div>
                <GridCount selected={selectedTheirsIds.length} shown={displayedTheirs.length} total={theirPokemons.length} />
              </>
            )}
          </div>
        </div>

        {/* Proposal summary */}
        {(selectedMinePokes.length > 0 || selectedTheirsPokes.length > 0) && (
          <div className="proposal-summary">
            <div className="proposal-side">
              {selectedMinePokes.length > 0 ? (
                <div className="proposal-pokes">
                  {selectedMinePokes.map(p => (
                    <div key={p.instanceId} className="proposal-poke">
                      <img src={p.sprite_url} alt={p.name} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="proposal-placeholder">Sélectionne tes Pokémon</div>
              )}
              <div className="proposal-coins">
                <label>Ajouter des coins</label>
                <input
                  type="number"
                  min={0}
                  max={coins}
                  value={coinsOffered || ''}
                  disabled={coinsRequested > 0}
                  onChange={e => setCoinsOffered(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  placeholder="0"
                />
                <span className={`proposal-coins-hint${coinsOffered > coins ? ' over' : ''}`}>
                  Solde : {coins.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="proposal-arrow"><Swap size={20} /></div>

            <div className="proposal-side">
              {selectedTheirsPokes.length > 0 ? (
                <div className="proposal-pokes">
                  {selectedTheirsPokes.map(p => (
                    <div key={p.instanceId} className="proposal-poke">
                      <img src={p.sprite_url} alt={p.name} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="proposal-placeholder">Sélectionne leurs Pokémon</div>
              )}
              <div className="proposal-coins">
                <label>Demander des coins</label>
                <input
                  type="number"
                  min={0}
                  value={coinsRequested || ''}
                  disabled={coinsOffered > 0}
                  onChange={e => setCoinsRequested(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  placeholder="0"
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              disabled={selectedMineIds.length === 0 || selectedTheirsIds.length === 0 || submitting || coinsOffered > coins}
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

const RARITY_COLOR: Record<string, string> = {
  COMMON:    '#9ca3af',
  RARE:      '#3b82f6',
  EPIC:      '#a855f7',
  LEGENDARY: '#f5a623',
};
const SHINY_GOLD = '#d4af37';

// A side's Pokémon, shown in FULL (no truncation): every sprite + name + a
// rarity-colored indicator, wrapping onto multiple rows as needed. Trust matters
// in a trade - the user must see exactly what's exchanged before accepting.
function TradeSide({ items }: { items: TradeItemView[] }) {
  if (items.length === 0) return <div className="trade-side trade-side-empty">—</div>;
  return (
    <div className="trade-side">
      {items.map(it => {
        const color = it.is_shiny ? SHINY_GOLD : (RARITY_COLOR[it.pokemon.rarity] ?? '#9ca3af');
        return (
          <div
            key={it.id}
            className={`trade-side-item${it.is_shiny ? ' shiny' : ''}`}
            style={{ '--rc': color } as React.CSSProperties}
            title={it.pokemon.name + (it.is_shiny ? ' ✨' : '')}
          >
            <img src={it.pokemon.sprite_url} alt={it.pokemon.name} className="trade-side-sprite" />
            <span className="trade-side-name">{it.pokemon.name}{it.is_shiny ? ' ✨' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function OfferCard({ offer, onAccept, onDecline }: {
  offer: TradeOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const fromItems = offer.items.filter(i => i.owner === 'from');
  const toItems = offer.items.filter(i => i.owner === 'to');

  return (
    <div className="offer-card">
      <div className="offer-from">De {offer.from_user.display_name}</div>
      <div className="offer-exchange">
        <TradeSide items={fromItems} />
        <span className="offer-arrow"><Swap size={16} /></span>
        <TradeSide items={toItems} />
      </div>
      {offer.coins_offered > 0 && (
        <div className="offer-coins gain">Vous recevrez {offer.coins_offered.toLocaleString()} coins</div>
      )}
      {offer.coins_requested > 0 && (
        <div className="offer-coins cost">Vous enverrez {offer.coins_requested.toLocaleString()} coins</div>
      )}
      <div className="offer-actions">
        <button className="btn btn-primary" onClick={onAccept}>Accepter</button>
        <button className="btn btn-danger" onClick={onDecline}>Refuser</button>
      </div>
    </div>
  );
}

function SentCard({ trade, onCancel }: { trade: SentTrade; onCancel: () => void }) {
  const fromItems = trade.items.filter(i => i.owner === 'from');
  const toItems = trade.items.filter(i => i.owner === 'to');

  return (
    <div className="offer-card">
      <button className="offer-cancel-btn" onClick={onCancel} title="Annuler l'offre" aria-label="Annuler l'offre">
        <Trash size={16} />
      </button>
      <div className="offer-from">À {trade.to_user.display_name}</div>
      <div className="offer-exchange">
        <TradeSide items={fromItems} />
        <span className="offer-arrow"><Swap size={16} /></span>
        <TradeSide items={toItems} />
      </div>
      {trade.coins_offered > 0 && (
        <div className="offer-coins cost">Vous envoyez {trade.coins_offered.toLocaleString()} coins</div>
      )}
      {trade.coins_requested > 0 && (
        <div className="offer-coins gain">Vous recevez {trade.coins_requested.toLocaleString()} coins</div>
      )}
      <div className="offer-actions">
        <button className="btn btn-danger" onClick={onCancel}>Annuler l'offre</button>
      </div>
    </div>
  );
}

// Post-accept results: grid of every Pokémon received.
function TradeResults({ items, onClose, onPokedex }: {
  items: TradeItemView[];
  onClose: () => void;
  onPokedex: () => void;
}) {
  return (
    <div className="trade-results-overlay" onClick={onClose}>
      <div className="trade-results" onClick={e => e.stopPropagation()}>
        <h2 className="trade-results-title">
          {items.length > 1 ? `${items.length} Pokémon reçus !` : 'Pokémon reçu !'}
        </h2>
        <div className="trade-results-grid">
          {items.map(it => (
            <div key={it.id} className={`trade-result-card${it.is_shiny ? ' shiny' : ''}`}>
              {it.is_shiny && <span className="trade-result-shiny">✨</span>}
              <img src={it.pokemon.sprite_url} alt={it.pokemon.name} className="trade-result-img" />
              <div className="trade-result-name">{it.pokemon.name}</div>
              <RarityBadge rarity={it.pokemon.rarity} size="sm" />
            </div>
          ))}
        </div>
        <div className="trade-results-actions">
          <button className="btn btn-primary" onClick={onPokedex}>Voir mon Pokédex</button>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// Independent display filter bar for one propose-trade grid (reuses the Pokédex
// filter classes for visual consistency). Filters apply instantly.
function GridFilters({ filter, onChange, types, duplicateCount }: { filter: GridFilter; onChange: (f: GridFilter) => void; types: string[]; duplicateCount: number }) {
  const set = (patch: Partial<GridFilter>) => onChange({ ...filter, ...patch });
  return (
    <div className="pokedex-filters trade-grid-filters">
      <input
        className="filter-search"
        type="text"
        placeholder="Rechercher…"
        value={filter.search}
        onChange={e => set({ search: e.target.value })}
      />
      <div className="filter-row">
        <div className="filter-label">Génération</div>
        <div className="filter-group">
          <button className={`filter-chip ${filter.gen === null ? 'active' : ''}`} onClick={() => set({ gen: null })}>Toutes</button>
          {GENERATIONS.map(g => (
            <button
              key={g}
              className={`filter-chip ${filter.gen === g ? 'active' : ''}`}
              onClick={() => set({ gen: filter.gen === g ? null : g })}
            >Gén. {g}</button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <div className="filter-label">Rareté</div>
        <div className="filter-group">
          <button className={`filter-chip ${filter.rarity === null ? 'active' : ''}`} onClick={() => set({ rarity: null })}>Toutes</button>
          {RARITIES.map(r => (
            <button
              key={r}
              className={`filter-chip rarity-chip rarity-${r.toLowerCase()} ${filter.rarity === r ? 'active' : ''}`}
              onClick={() => set({ rarity: filter.rarity === r ? null : r })}
            >{RARITY_FR[r]}</button>
          ))}
        </div>
      </div>
      {types.length > 0 && (
        <div className="filter-row">
          <div className="filter-label">Type</div>
          <div className="filter-group filter-types">
            <button className={`filter-chip ${filter.type === null ? 'active' : ''}`} onClick={() => set({ type: null })}>Tous</button>
            {types.map(t => (
              <button
                key={t}
                className={`filter-chip type-chip ${filter.type === t ? 'active' : ''}`}
                style={{ '--type-color': TYPE_COLORS[t] ?? '#9CA3AF' } as React.CSSProperties}
                onClick={() => set({ type: filter.type === t ? null : t })}
              >{TYPE_FR[t] ?? t}</button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-row">
        <div className="filter-label">Divers</div>
        <div className="filter-group">
          <button
            className={`filter-chip shiny-chip${filter.shiny ? ' active' : ''}`}
            onClick={() => set({ shiny: !filter.shiny })}
          >✨ Shiny</button>
          <button
            className={`filter-chip${filter.duplicates ? ' active' : ''}`}
            onClick={() => set({ duplicates: !filter.duplicates })}
          >Doublons ({duplicateCount})</button>
        </div>
      </div>
    </div>
  );
}

// "X sélectionné(s) · Y affiché(s) · Z au total" under a grid. Selection count is
// independent from the display filter (selected Pokémon stay selected).
function GridCount({ selected, shown, total }: { selected: number; shown: number; total: number }) {
  return (
    <div className="trade-grid-count">
      <strong>{selected}</strong> sélectionné{selected !== 1 ? 's' : ''} · {shown} affiché{shown !== 1 ? 's' : ''} · {total} au total
    </div>
  );
}
