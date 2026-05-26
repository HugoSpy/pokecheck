import { useEffect, useMemo, useState } from 'react';
import { getMyPokedex, type UserInfo, type UserPokemonInstance } from '../api';
import PokemonCard from '../components/PokemonCard';
import './Pokedex.css';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7];
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export default function Pokedex() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pokemons, setPokemons] = useState<UserPokemonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterGen, setFilterGen] = useState<number | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMyPokedex()
      .then(data => { setUser(data.user); setPokemons(data.pokemons); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    pokemons.forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }, [pokemons]);

  const filtered = useMemo(() =>
    pokemons.filter(p => {
      if (filterGen !== null && p.generation !== filterGen) return false;
      if (filterRarity !== null && p.rarity !== filterRarity) return false;
      if (filterType !== null && !p.types.includes(filterType)) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  [pokemons, filterGen, filterRarity, filterType, search]);

  const legendaryCount = pokemons.filter(p => p.rarity === 'LEGENDARY').length;

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
          <StatChip label="Score" value={user.total_score.toLocaleString()} color="#10b981" />
          <StatChip label="Légendaires" value={legendaryCount} color="var(--rarity-legendary)" />
          <StatChip label="Échanges" value={user.trade_count} color="var(--rarity-epic)" />
        </div>
      </div>

      {/* Filters */}
      <div className="pokedex-filters">
        <input
          className="filter-search"
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

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
            >G{g}</button>
          ))}
        </div>

        <div className="filter-group">
          {RARITIES.map(r => (
            <button
              key={r}
              className={`filter-chip rarity-chip rarity-${r.toLowerCase()} ${filterRarity === r ? 'active' : ''}`}
              onClick={() => setFilterRarity(filterRarity === r ? null : r)}
            >{r}</button>
          ))}
        </div>

        {allTypes.length > 0 && (
          <div className="filter-group filter-types">
            <button
              className={`filter-chip ${filterType === null ? 'active' : ''}`}
              onClick={() => setFilterType(null)}
            >Tous types</button>
            {allTypes.map(t => (
              <button
                key={t}
                className={`filter-chip type-chip type-${t} ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(filterType === t ? null : t)}
              >{t}</button>
            ))}
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          Aucun Pokémon ne correspond à ces filtres.
        </div>
      ) : (
        <div className="pokedex-grid">
          {filtered.map(p => (
            <PokemonCard key={p.instanceId} pokemon={p} />
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
