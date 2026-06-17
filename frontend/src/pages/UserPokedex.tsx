import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicPokedex } from '../api/pokemonApi';
import type { UserInfo, UserPokemonInstance, FavoritePokemonInfo } from '../api/types';
import PokemonCard from '../components/PokemonCard';
import { TRAINER_AVATAR_MAP } from '../config/trainerAvatars';
import './Pokedex.css';

// Same animated-GIF slug derivation as PokemonDetailModal / TradeAnimation3D:
// the slug is the sprite filename, and projectpokemon.org hosts the GIFs.
function animatedGifUrl(fav: FavoritePokemonInfo): string {
  const slug = fav.pokemon.sprite_url.split('/').pop()?.replace('.png', '') ?? '';
  return fav.is_shiny
    ? `https://projectpokemon.org/images/shiny-sprite/${slug}.gif`
    : `https://projectpokemon.org/images/normal-sprite/${slug}.gif`;
}

// Average trainer height in metres - the reference the companion is scaled
// against so a Pokémon looks proportionally sized next to the human sprite.
const HUMAN_REF_M = 1.7;
// Base on-screen height (px) of the companion at scale 1 (a ~1.7m Pokémon).
const FAV_BASE_H = 132;
// Clamp so a tiny Pokémon (Caterpie 0.3m) stays visible and a giant one
// (Wailord 14.5m, Onix 8.8m) never completely buries the trainer.
const FAV_MIN_SCALE = 0.45;
const FAV_MAX_SCALE = 1.9;

function favoriteScale(heightM?: number | null): number {
  if (!heightM || heightM <= 0) return 1;
  return Math.min(FAV_MAX_SCALE, Math.max(FAV_MIN_SCALE, heightM / HUMAN_REF_M));
}

// Trainer avatar + favorite Pokémon companion, shown on the public profile.
// The companion stands beside the trainer on the same ground line, scaled to
// its real-world size relative to a human.
function TrainerDisplay({ user }: { user: UserInfo }) {
  const fav = user.favorite_pokemon;
  const [gifError, setGifError] = useState(false);

  // A selected trainer avatar (a claimed trainer badge) overrides the default
  // gendered base sprite. Fall back to the gendered base when no avatar is set.
  const trainerAvatar = user.trainer_avatar ? TRAINER_AVATAR_MAP[user.trainer_avatar] : null;
  const avatarSrc = trainerAvatar
    ?? (user.trainer_gender === 'M' ? '/base_trainer_m.gif'
      : user.trainer_gender === 'F' ? '/base_trainer_f.gif'
      : null);
  if (!avatarSrc) return null;

  const scale = fav ? favoriteScale(fav.pokemon.height_m) : 1;
  // Reserve horizontal room so the (absolutely positioned) companion isn't
  // clipped; widens with scale for large Pokémon.
  const spacerWidth = Math.round(Math.max(150, FAV_BASE_H * scale * 0.95));

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-end', marginBottom: 10, minHeight: 192 }}>
      {fav && (
        <img
          src={gifError ? fav.pokemon.sprite_url : animatedGifUrl(fav)}
          alt={fav.pokemon.name}
          title={`${fav.pokemon.name}${fav.is_shiny ? ' ✨' : ''} - Pokémon favori`}
          onError={() => setGifError(true)}
          style={{
            position: 'absolute',
            // Peeks out from behind the trainer's right side, feet on the
            // same ground line (transform-origin anchors growth upward/right).
            left: 116,
            bottom: 0,
            height: FAV_BASE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'left bottom',
            imageRendering: 'pixelated',
            zIndex: 0,
            opacity: 0.95,
            filter: fav.is_shiny
              ? 'drop-shadow(0 0 8px rgba(212,175,55,0.6))'
              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }}
        />
      )}
      <img
        src={avatarSrc}
        alt="Dresseur"
        style={{ position: 'relative', height: 192, imageRendering: 'pixelated', zIndex: 1 }}
      />
      {/* Spacer so the companion isn't clipped by the inline-flex box */}
      {fav && <div style={{ width: spacerWidth }} />}
    </div>
  );
}

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
              padding: '10px 0',
              transition: 'color 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            ← Retour
          </button>
          <TrainerDisplay user={user} />
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
