import { RARITIES, RARITY_FR, ALL_TYPES, TYPE_FR, TYPE_COLORS } from '../utils/pokemon';

// Reusable Pokémon filter bar (name search + rarity + type) - same markup,
// CSS classes and constants as the Pokédex filters. Used by the global Pokémon
// search modal. Rarity/type are single-select toggles (click again to clear).
interface Props {
  search: string;
  onSearch: (v: string) => void;
  rarity: string | null;
  onRarity: (r: string | null) => void;
  type: string | null;
  onType: (t: string | null) => void;
}

export default function PokemonFilters({ search, onSearch, rarity, onRarity, type, onType }: Props) {
  return (
    <div className="pokedex-filters">
      <input
        className="filter-search"
        type="text"
        placeholder="Rechercher un Pokémon…"
        value={search}
        onChange={e => onSearch(e.target.value)}
        autoFocus
      />

      {/* Rareté */}
      <div className="filter-row">
        <div className="filter-label">Rareté</div>
        <div className="filter-group">
          <button
            className={`filter-chip ${rarity === null ? 'active' : ''}`}
            onClick={() => onRarity(null)}
          >Toutes</button>
          {RARITIES.map(r => (
            <button
              key={r}
              className={`filter-chip rarity-chip rarity-${r.toLowerCase()} ${rarity === r ? 'active' : ''}`}
              onClick={() => onRarity(rarity === r ? null : r)}
            >{RARITY_FR[r]}</button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="filter-row">
        <div className="filter-label">Type</div>
        <div className="filter-group filter-types">
          <button
            className={`filter-chip ${type === null ? 'active' : ''}`}
            onClick={() => onType(null)}
          >Tous</button>
          {ALL_TYPES.map(t => (
            <button
              key={t}
              className={`filter-chip type-chip ${type === t ? 'active' : ''}`}
              style={{ '--type-color': TYPE_COLORS[t] ?? '#9CA3AF' } as React.CSSProperties}
              onClick={() => onType(type === t ? null : t)}
            >{TYPE_FR[t] ?? t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
