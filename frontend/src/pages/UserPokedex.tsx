import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicPokedex } from '../api/pokemonApi';
import type { UserInfo, UserPokemonInstance } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import './Pokedex.css';

export default function UserPokedex() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pokemons, setPokemons] = useState<UserPokemonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getPublicPokedex(id)
      .then(data => { setUser(data.user); setPokemons(data.pokemons); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const legendaryCount = pokemons.filter(p => p.rarity === 'LEGENDARY').length;

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      Chargement…
    </div>
  );

  if (error) return <div className="error-banner" style={{ margin: '40px auto', maxWidth: 500 }}>Erreur : {error}</div>;
  if (!user) return null;

  return (
    <div className="pokedex-page">
      <div className="pokedex-header">
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-condensed)',
              fontSize: 13,
              letterSpacing: '0.06em',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              transition: 'color 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            ← Retour
          </button>
          <h1 className="pokedex-title">{user.display_name}</h1>
          <div className="pokedex-subtitle">Collection publique</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <div className="pokedex-stats">
            <StatChip label="Pokémon" value={pokemons.length} color="var(--accent)" />
            <StatChip label="Score" value={user.total_score.toLocaleString()} color="var(--success)" />
            <StatChip label="Légendaires" value={legendaryCount} color="var(--rarity-legendary)" />
          </div>

          {user.featured_badges && user.featured_badges.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {user.featured_badges.map(badge => (
                <div
                  key={badge.id}
                  title={badge.description}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(245,166,35,0.3)',
                    borderRadius: 'var(--radius)',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-condensed)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--gold)',
                    letterSpacing: '0.04em',
                  }}
                >
                  🏆 {badge.name}
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={() => navigate('/trades', { state: { targetUserId: id, targetUserName: user.display_name } })}
          >
            Proposer un échange
          </button>
        </div>
      </div>

      {pokemons.length === 0 ? (
        <div className="pokedex-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          Cet élève n'a pas encore de Pokémon.
        </div>
      ) : (
        <div className="pokedex-grid">
          {pokemons.map(p => (
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
