import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchPokemonSpecies, getPokemonOwners, type PokemonSpecies, type PokemonOwner, type PokemonMarketInfo } from '../api/pokemonApi';
import { RARITY_FR } from '../utils/pokemon';
import PokemonFilters from './PokemonFilters';
import './PokemonSearchModal.css';

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9ca3af', RARE: '#3b82f6', EPIC: '#a855f7', LEGENDARY: '#f5a623',
};

interface Props {
  onClose: () => void;
}

export default function PokemonSearchModal({ onClose }: Props) {
  const navigate = useNavigate();

  // ── Step 1: species search ──
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [results, setResults] = useState<PokemonSpecies[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Step 2: owners of the selected species ──
  const [selected, setSelected] = useState<PokemonSpecies | null>(null);
  const [owners, setOwners] = useState<PokemonOwner[]>([]);
  const [market, setMarket] = useState<PokemonMarketInfo | null>(null);
  const [loadingOwners, setLoadingOwners] = useState(false);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced species search whenever a filter changes (step 1 only).
  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchPokemonSpecies({ name: search, rarity, type, generation, limit: 60 })
        .then(data => { if (!cancelled) setResults(data.pokemons); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, rarity, type, generation, selected]);

  const openOwners = useCallback((p: PokemonSpecies) => {
    setSelected(p);
    setOwners([]);
    setMarket(null);
    setLoadingOwners(true);
    getPokemonOwners(p.id)
      .then(data => { setOwners(data.owners); setMarket(data.market); })
      .catch(() => { setOwners([]); setMarket(null); })
      .finally(() => setLoadingOwners(false));
  }, []);

  const goToProfile = useCallback((userId: string) => {
    navigate(`/u/${userId}`);
    onClose();
  }, [navigate, onClose]);

  const goToMarket = useCallback(() => {
    navigate('/market');
    onClose();
  }, [navigate, onClose]);

  return (
    <div className="psm-backdrop" onClick={onClose}>
      <div className="psm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="psm-header">
          <h2 className="psm-title">
            {selected ? `Dresseurs - ${selected.name}` : 'Rechercher un Pokémon'}
          </h2>
          <button className="psm-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* ── Step 1: search ── */}
        {!selected && (
          <div className="psm-body">
            <PokemonFilters
              search={search} onSearch={setSearch}
              rarity={rarity} onRarity={setRarity}
              type={type} onType={setType}
              generation={generation} onGeneration={setGeneration}
            />

            {loading ? (
              <div className="psm-loading"><div className="spinner" /></div>
            ) : results.length === 0 ? (
              <div className="psm-empty">Aucun Pokémon ne correspond.</div>
            ) : (
              <div className="psm-grid">
                {results.map(p => (
                  <button key={p.id} className="psm-card" onClick={() => openOwners(p)}>
                    <img src={p.sprite_url} alt={p.name} className="psm-card-img" loading="lazy" />
                    <div className="psm-card-name">{p.name}</div>
                    <div className="psm-card-rarity" style={{ color: RARITY_COLOR[p.rarity] ?? '#9ca3af' }}>
                      {RARITY_FR[p.rarity] ?? p.rarity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: owners ── */}
        {selected && (
          <div className="psm-body">
            <button className="psm-back" onClick={() => setSelected(null)}>← Retour à la recherche</button>

            <div className="psm-owner-head">
              <img src={selected.sprite_url} alt={selected.name} className="psm-owner-sprite" />
              <div>
                <div className="psm-card-name">{selected.name}</div>
                <div className="psm-card-rarity" style={{ color: RARITY_COLOR[selected.rarity] ?? '#9ca3af' }}>
                  {RARITY_FR[selected.rarity] ?? selected.rarity}
                </div>
              </div>
            </div>

            {!loadingOwners && market && (
              <button className="psm-market" onClick={goToMarket}>
                <span className="psm-market-tag">Marché</span>
                <span className="psm-market-price">
                  dès {market.lowest_price.toLocaleString('fr-FR')} coins
                </span>
                {market.count > 1 && (
                  <span className="psm-market-count">{market.count} en vente</span>
                )}
              </button>
            )}

            {loadingOwners ? (
              <div className="psm-loading"><div className="spinner" /></div>
            ) : owners.length === 0 ? (
              <div className="psm-empty">Aucun dresseur ne possède ce Pokémon.</div>
            ) : (
              <ul className="psm-owners">
                {owners.map(o => (
                  <li key={o.userId}>
                    <button className="psm-owner" onClick={() => goToProfile(o.userId)}>
                      <span className="psm-owner-name">{o.displayName}</span>
                      {o.count > 1 && <span className="psm-owner-count">×{o.count}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
