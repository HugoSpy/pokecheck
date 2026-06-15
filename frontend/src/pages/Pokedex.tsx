import { useEffect, useMemo, useState, useCallback } from 'react';
import { getMyPokedex } from '../api/pokemonApi';
import { sellPokemon, sellPokemonBulk } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { UserInfo, UserPokemonInstance } from '../api/types';
import { getSellPrice } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import Toast from '../components/Toast';
import { Search } from '../components/icons';
import { TYPE_FR, RARITY_FR, RARITIES, TYPE_COLORS } from '../utils/pokemon';
import PokemonSearchModal from '../components/PokemonSearchModal';
import { canExport, getRemainingCooldownSeconds, markExport, toCsv, downloadBlob } from '../utils/exportCollection';
import { apiFetch } from '../api/client';
import './Pokedex.css';

const BULK_SELL_CHUNK = 50; // backend caps each /sell/bulk call at 50 ids

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7];

export default function Pokedex() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pokemons, setPokemons] = useState<UserPokemonInstance[]>([]);
  const [totalPokemon, setTotalPokemon] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const { coins, setCoins } = useUserCtx();

  const handleSell = useCallback(async (instanceId: string) => {
    const result = await sellPokemon(instanceId);
    setPokemons(prev => prev.filter(p => p.instanceId !== instanceId));
    setCoins(coins + result.coins_earned);
  }, [coins, setCoins]);

  // ── Bulk-sell multi-select ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSelling, setBulkSelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const toggleSelect = useCallback((p: UserPokemonInstance) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(p.instanceId)) next.delete(p.instanceId);
      else next.add(p.instanceId);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const [cooldown, setCooldown] = useState(getRemainingCooldownSeconds());

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      const remaining = getRemainingCooldownSeconds();
      setCooldown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    if (!canExport()) return;
    markExport();
    setCooldown(60);
    const data = await apiFetch<Record<string, unknown>[]>('/pokedex/export');
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      downloadBlob(JSON.stringify(data, null, 2), `pokedex_${date}.json`, 'application/json');
    } else {
      downloadBlob(toCsv(data), `pokedex_${date}.csv`, 'text/csv');
    }
  }, []);

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

  // One representative per (species, shiny) group that has duplicates: the oldest
  // copy (obtained_at ASC) - the one that contributes to the score. Maps its
  // instanceId → the group size, so the "doublons" filter shows a single card
  // per duplicated variant (with a ×N badge) instead of every copy.
  const duplicateReps = useMemo(() => {
    const groups = new Map<string, { count: number; oldest: UserPokemonInstance }>();
    for (const p of pokemons) {
      const key = `${p.id}-${p.is_shiny ? 's' : 'n'}`;
      const g = groups.get(key);
      if (!g) {
        groups.set(key, { count: 1, oldest: p });
      } else {
        g.count += 1;
        if (new Date(p.obtainedAt).getTime() < new Date(g.oldest.obtainedAt).getTime()) {
          g.oldest = p;
        }
      }
    }
    const reps = new Map<string, number>();
    for (const g of groups.values()) {
      if (g.count > 1) reps.set(g.oldest.instanceId, g.count);
    }
    return reps;
  }, [pokemons]);

  const duplicateSpeciesCount = duplicateReps.size;

  const distinctOwned = useMemo(() => pokemonIdCounts.size, [pokemonIdCounts]);

  // Instances that are safe to sell without lowering the score: every copy of a
  // variant (species + shiny) beyond the first. Keeping one preserves the Pokédex
  // entry and its points.
  const duplicateInstanceIds = useMemo(() => {
    const seenVariants = new Set<string>();
    const extras = new Set<string>();
    for (const p of pokemons) {
      const key = `${p.id}-${p.is_shiny ? 's' : 'n'}`;
      if (seenVariants.has(key)) extras.add(p.instanceId);
      else seenVariants.add(key);
    }
    return extras;
  }, [pokemons]);

  const selectedTotal = useMemo(() =>
    pokemons
      .filter(p => selectedIds.has(p.instanceId))
      .reduce((sum, p) => sum + getSellPrice(p), 0),
  [pokemons, selectedIds]);

  const selectAllDuplicates = useCallback(() => {
    setSelectedIds(new Set(duplicateInstanceIds));
  }, [duplicateInstanceIds]);

  const handleBulkSell = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkSelling) return;
    if (ids.length > 5 &&
        !window.confirm(`Vendre ${ids.length} Pokémon pour ~${selectedTotal.toLocaleString()} coins ?`)) {
      return;
    }
    setBulkSelling(true);
    try {
      let totalSold = 0;
      let totalCoins = 0;
      for (let i = 0; i < ids.length; i += BULK_SELL_CHUNK) {
        const res = await sellPokemonBulk(ids.slice(i, i + BULK_SELL_CHUNK));
        totalSold += res.sold;
        totalCoins += res.coins_earned;
      }
      const soldSet = new Set(ids);
      setPokemons(prev => prev.filter(p => !soldSet.has(p.instanceId)));
      setCoins(coins + totalCoins);
      setSelectedIds(new Set());
      setSelectMode(false);
      setToast({ msg: `${totalSold} Pokémon vendus - +${totalCoins.toLocaleString()} coins`, type: 'success' });
      // Re-sync authoritative score from the server.
      getMyPokedex().then(data => setUser(data.user)).catch(() => {});
    } catch (e) {
      setToast({ msg: (e as Error).message || 'Échec de la vente groupée', type: 'error' });
    } finally {
      setBulkSelling(false);
    }
  }, [selectedIds, bulkSelling, selectedTotal, coins, setCoins]);

  const filtered = useMemo(() =>
    pokemons.filter(p => {
      // Duplicates filter: keep only the representative (oldest) copy of each
      // duplicated variant, so one card stands for the whole group.
      if (filterDuplicates && !duplicateReps.has(p.instanceId)) return false;
      if (filterGen !== null && p.generation !== filterGen) return false;
      if (filterRarity !== null && p.rarity !== filterRarity) return false;
      if (filterType !== null && !p.types.includes(filterType)) return false;
      if (filterShiny && !p.is_shiny) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
  [pokemons, filterDuplicates, duplicateReps, filterGen, filterRarity, filterType, filterShiny, search]);

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
          <button className="pokedex-search-btn" onClick={() => setSearchModalOpen(true)}>
            <Search size={15} /> Rechercher un Pokémon
          </button>
          <div className="pokedex-export-btns">
            <button
              className="pokedex-search-btn"
              onClick={() => handleExport('csv')}
              disabled={cooldown > 0}
              title={cooldown > 0 ? `Disponible dans ${cooldown}s` : 'Exporter en CSV'}
            >
              {cooldown > 0 ? `CSV (${cooldown}s)` : 'Exporter CSV'}
            </button>
            <button
              className="pokedex-search-btn"
              onClick={() => handleExport('json')}
              disabled={cooldown > 0}
              title={cooldown > 0 ? `Disponible dans ${cooldown}s` : 'Exporter en JSON'}
            >
              {cooldown > 0 ? `JSON (${cooldown}s)` : 'Exporter JSON'}
            </button>
          </div>
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

      {/* Count + selection toolbar */}
      <div className="pokedex-count">
        <span>{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        <div className="pokedex-select-tools">
          {!selectMode ? (
            <button className="filter-chip" onClick={() => setSelectMode(true)}>
              Sélectionner
            </button>
          ) : (
            <>
              <button
                className="filter-chip"
                onClick={selectAllDuplicates}
                disabled={duplicateInstanceIds.size === 0}
              >
                Tout sélectionner les doublons ({duplicateInstanceIds.size})
              </button>
              <button className="filter-chip" onClick={exitSelectMode}>Annuler</button>
            </>
          )}
        </div>
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
            <PokemonCard
              key={p.instanceId}
              pokemon={p}
              selectable={selectMode}
              selected={selectedIds.has(p.instanceId)}
              onSelect={toggleSelect}
              onSell={handleSell}
              duplicateCount={filterDuplicates ? duplicateReps.get(p.instanceId) : undefined}
            />
          ))}
        </div>
      )}

      {/* Bulk-sell action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="pokedex-bulk-bar">
          <span className="pokedex-bulk-count">
            {selectedIds.size} Pokémon sélectionné{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            className="pokedex-bulk-sell-btn"
            onClick={handleBulkSell}
            disabled={bulkSelling}
          >
            {bulkSelling ? 'Vente…' : `Vendre tout (${selectedTotal.toLocaleString()} coins)`}
          </button>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {searchModalOpen && <PokemonSearchModal onClose={() => setSearchModalOpen(false)} />}
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
