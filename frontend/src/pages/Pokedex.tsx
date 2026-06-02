import { useEffect, useMemo, useState, useCallback } from 'react';
import { getMyPokedex } from '../api/pokemonApi';
import { sellPokemon } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { UserInfo, UserPokemonInstance } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import { Search } from '../components/icons';
import { TYPE_FR, RARITY_FR } from '../utils/pokemon';
import './Pokedex.css';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7];
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;


const TYPE_COLORS: Record<string, string> = {
  normal: '#9CA3AF', fire: '#F97316', water: '#3B82F6',
  electric: '#EAB308', grass: '#22C55E', ice: '#67E8F9',
  fighting: '#DC2626', poison: '#A855F7', ground: '#D97706',
  flying: '#818CF8', psychic: '#EC4899', bug: '#84CC16',
  rock: '#78716C', ghost: '#6D28D9', dragon: '#7C3AED',
  dark: '#6B7280', steel: '#94A3B8', fairy: '#F472B6',
};

export default function Pokedex() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pokemons, setPokemons] = useState<UserPokemonInstance[]>([]);
  const [totalPokemon, setTotalPokemon] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { coins, setCoins } = useUserCtx();

  const handleSell = useCallback(async (instanceId: string) => {
    const result = await sellPokemon(instanceId);
    setPokemons(prev => prev.filter(p => p.instanceId !== instanceId));
    setCoins(coins + result.coins_earned);
  }, [coins, setCoins]);

  const [filterDuplicates, setFilterDuplicates] = useState(false);
  const [filterGen, setFilterGen] = useState<number | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterShiny, setFilterShiny] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMyPokedex()
      .then(data => { setUser(data.user); setPokemons(data.pokemons); setTotalPokemon(data.totalPokemon); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    pokemons.forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }, [pokemons]);

  const pokemonIdCounts = useMemo(() => {
    const counts = new Map<number, number>();
    pokemons.forEach(p => counts.set(p.id, (counts.get(p.id) ?? 0) + 1));
    return counts;
  }, [pokemons]);

  const duplicateSpeciesCount = useMemo(() =>
    [...pokemonIdCounts.values()].filter(n => n >= 2).length,
  [pokemonIdCounts]);

  const distinctOwned = useMemo(() => pokemonIdCounts.size, [pokemonIdCounts]);

  const filtered = useMemo(() =>
    pokemons.filter(p => {
      if (filterDuplicates && (pokemonIdCounts.get(p.id) ?? 1) < 2) return false;
      if (filterGen !== null && p.generation !== filterGen) return false;
      if (filterRarity !== null && p.rarity !== filterRarity) return false;
      if (filterType !== null && !p.types.includes(filterType)) return false;
      if (filterShiny && !p.is_shiny) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  [pokemons, filterDuplicates, pokemonIdCounts, filterGen, filterRarity, filterType, filterShiny, search]);

  const legendaryCount = pokemons.filter(p => p.rarity === 'LEGENDARY').length;
  const shinyCount = pokemons.filter(p => p.is_shiny).length;

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      Chargement du Pokédex…
    </div>
  );

  if (error) return (
    <div className="error-banner" style={{ margin: '40px auto', maxWidth: 400 }}>
      Erreur : {error}
    </div>
  );

  if (!user) return null;

  return (
    <div className="pokedex-page">
      {/* Header stats */}
      <div className="pokedex-header">
        <div>
          <h1 className="pokedex-title">Mon Pokédex</h1>
          <div className="pokedex-subtitle">{user.display_name}</div>
        </div>
        <div className="pokedex-stats">
          <StatChip label="Pokémon" value={pokemons.length} color="var(--accent)" />
          <StatChip label="Score" value={user.total_score.toLocaleString()} color="var(--success)" />
          <StatChip label="Coins" value={coins.toLocaleString()} color="var(--gold)" />
          <StatChip label="Légendaires" value={legendaryCount} color="var(--rarity-legendary)" />
          {shinyCount > 0 && <StatChip label="Shiny ✨" value={shinyCount} color="#d4af37" />}
          <StatChip label="Échanges" value={user.trade_count} color="var(--rarity-epic)" />
        </div>
      </div>

      {/* Progression */}
      {totalPokemon > 0 && (
        <div className="pokedex-progress-block">
          <div className="pokedex-progress-header">
            <span className="pokedex-progress-label">Progression</span>
            <span className="pokedex-progress-count">
              <strong>{distinctOwned}</strong> / {totalPokemon}
            </span>
          </div>
          <div className="pokedex-progress-bar">
            <div
              className="pokedex-progress-fill"
              style={{ width: `${Math.min(100, (distinctOwned / totalPokemon) * 100)}%` }}
            />
          </div>
          <div className="pokedex-progress-pct">
            {((distinctOwned / totalPokemon) * 100).toFixed(1)} %
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="pokedex-filters">
        <input
          className="filter-search"
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Génération */}
        <div className="filter-row">
          <div className="filter-label">Génération</div>
          <div className="filter-group">
            <button
              className={`filter-chip ${filterGen === null ? 'active' : ''}`}
              onClick={() => setFilterGen(null)}
            >Toutes</button>
            {GENERATIONS.map(g => (
              <button
                key={g}
                className={`filter-chip ${filterGen === g ? 'active' : ''}`}
                onClick={() => setFilterGen(filterGen === g ? null : g)}
              >Gén. {g}</button>
            ))}
          </div>
        </div>

        {/* Rareté */}
        <div className="filter-row">
          <div className="filter-label">Rareté</div>
          <div className="filter-group">
            <button
              className={`filter-chip ${filterRarity === null ? 'active' : ''}`}
              onClick={() => setFilterRarity(null)}
            >Toutes</button>
            {RARITIES.map(r => (
              <button
                key={r}
                className={`filter-chip rarity-chip rarity-${r.toLowerCase()} ${filterRarity === r ? 'active' : ''}`}
                onClick={() => setFilterRarity(filterRarity === r ? null : r)}
              >{RARITY_FR[r]}</button>
            ))}
          </div>
        </div>

        {/* Shiny + Doublons */}
        <div className="filter-row">
          <div className="filter-label">Divers</div>
          <div className="filter-group">
            <button
              className={`filter-chip shiny-chip${filterShiny ? ' active' : ''}`}
              onClick={() => setFilterShiny(!filterShiny)}
            >✨ Shiny</button>
            <button
              className={`filter-chip${filterDuplicates ? ' active' : ''}`}
              onClick={() => setFilterDuplicates(!filterDuplicates)}
            >
              Doublons ({duplicateSpeciesCount})
            </button>
          </div>
        </div>

        {/* Type */}
        {allTypes.length > 0 && (
          <div className="filter-row">
            <div className="filter-label">Type</div>
            <div className="filter-group filter-types">
              <button
                className={`filter-chip ${filterType === null ? 'active' : ''}`}
                onClick={() => setFilterType(null)}
              >Tous</button>
              {allTypes.map(t => (
                <button
                  key={t}
                  className={`filter-chip type-chip ${filterType === t ? 'active' : ''}`}
                  style={{ '--type-color': TYPE_COLORS[t] ?? '#9CA3AF' } as React.CSSProperties}
                  onClick={() => setFilterType(filterType === t ? null : t)}
                >{TYPE_FR[t] ?? t}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="pokedex-count">
        {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="pokedex-empty">
          <div style={{ marginBottom: 12 }}><Search size={40} /></div>
          Aucun Pokémon ne correspond à ces filtres.
        </div>
      ) : (
        <div className="pokedex-grid">
          {filtered.map(p => (
            <PokemonCard key={p.instanceId} pokemon={p} onSell={handleSell} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-chip" style={{ '--chip-color': color } as React.CSSProperties}>
      <div className="stat-chip-value">{value}</div>
      <div className="stat-chip-label">{label}</div>
    </div>
  );
}
