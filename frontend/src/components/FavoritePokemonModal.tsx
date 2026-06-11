import { useEffect, useMemo, useState } from 'react';
import { getMyPokedex } from '../api/pokemonApi';
import type { UserPokemonInstance } from '../api/types';
import { RARITY_FR } from '../utils/pokemon';
import PokemonFilters from './PokemonFilters';
import './PokemonSearchModal.css';

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9ca3af', RARE: '#3b82f6', EPIC: '#a855f7', LEGENDARY: '#f5a623',
};

interface Props {
  currentFavoriteId: string | null;
  onPick: (p: UserPokemonInstance) => void;
  onClose: () => void;
}

// Modal to pick the favorite Pokémon among the user's own collection.
// Reuses the search-modal shell (psm-*) and the shared PokemonFilters bar;
// filtering is client-side since the whole pokedex is already loaded.
export default function FavoritePokemonModal({ currentFavoriteId, onPick, onClose }: Props) {
  const [pokemons, setPokemons] = useState<UserPokemonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    getMyPokedex()
      .then(data => setPokemons(data.pokemons))
      .catch(() => setPokemons([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    pokemons.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (rarity !== null && p.rarity !== rarity) return false;
      if (type !== null && !p.types.includes(type)) return false;
      if (generation !== null && p.generation !== generation) return false;
      return true;
    }),
  [pokemons, search, rarity, type, generation]);

  return (
    <div className="psm-backdrop" onClick={onClose}>
      <div className="psm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="psm-header">
          <h2 className="psm-title">Choisir mon Pokémon favori</h2>
          <button className="psm-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="psm-body">
          <PokemonFilters
            search={search} onSearch={setSearch}
            rarity={rarity} onRarity={setRarity}
            type={type} onType={setType}
            generation={generation} onGeneration={setGeneration}
          />

          {loading ? (
            <div className="psm-loading"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="psm-empty">Aucun Pokémon ne correspond.</div>
          ) : (
            <div className="psm-grid">
              {filtered.map(p => {
                const isFavorite = p.instanceId === currentFavoriteId;
                return (
                  <button
                    key={p.instanceId}
                    className="psm-card"
                    style={{
                      position: 'relative',
                      ...(isFavorite ? { borderColor: '#d4af37', boxShadow: '0 0 10px rgba(212,175,55,0.35)' } : {}),
                    }}
                    onClick={() => onPick(p)}
                    title={isFavorite ? 'Pokémon favori actuel' : `Choisir ${p.name}`}
                  >
                    {isFavorite && <span style={{ position: 'absolute', top: 4, right: 6 }}>⭐</span>}
                    <img src={p.sprite_url} alt={p.name} className="psm-card-img" loading="lazy" />
                    <div className="psm-card-name">{p.name}{p.is_shiny ? ' ✨' : ''}</div>
                    <div className="psm-card-rarity" style={{ color: RARITY_COLOR[p.rarity] ?? '#9ca3af' }}>
                      {RARITY_FR[p.rarity] ?? p.rarity}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
