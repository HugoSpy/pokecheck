import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyProfile, getAllBadges, getBadgeProgress, claimDailyLogin, updateUsername, updateFeaturedBadges, updateTrainerProfile, updateTrainerAvatar, claimBadge } from '../api/userApi';
import { getMyPokedex } from '../api/pokemonApi';
import { useUserCtx } from '../context/UserContext';
import type { MyProfile, AllBadgeEntry, BadgeProgressEntry, UserPokemonInstance } from '../api/types';
import { TRAINER_AVATAR_MAP, TRAINER_AVATAR_IDS, badgeIconSrc } from '../config/trainerAvatars';
import Toast from '../components/Toast';
import BadgeDetailModal from '../components/BadgeDetailModal';
import FavoritePokemonModal from '../components/FavoritePokemonModal';
import BoosterPack3D from '../components/BoosterPack3D';
import { Coins, Lock } from '../components/icons';
import './Profile.css';

const CATEGORY_LABELS: Record<string, string> = {
  streak: 'Connexion',
  trade: 'Échanges',
  pokedex: 'Pokédex',
  rarity: 'Rareté',
  starters: 'Starters',
  starter_evo: 'Lignées Starters',
  trainer: 'Dresseurs',
  generation: 'Générations',
  region: 'Régions',
  legendary: 'Légendaires',
  types: 'Types',
  battle: 'Battle',
  market: 'Marché',
  shiny: 'Shinies',
};

// Display order of badge categories. "Lignées Starters" sits between Starters
// and Types; "Rareté" follows Pokédex; "Régions" follows Générations.
const CATEGORY_ORDER = [
  'streak', 'trade', 'pokedex', 'rarity',
  'generation', 'region',
  'starters', 'starter_evo', 'trainer', 'types',
  'legendary', 'shiny', 'battle', 'market',
];

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// Persisted per-category collapse state for the badges page.
const BADGES_COLLAPSED_KEY = 'pokecheck_badges_collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(BADGES_COLLAPSED_KEY);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

// Free daily Shiny pack resets at Paris midnight = 22:00 UTC (CEST/summer),
// mirroring the backend boundary in routes/users.ts.
function shinyPackAvailable(claimedAt: string | null): boolean {
  if (!claimedAt) return true;
  const PARIS_OFFSET_MS = 22 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lastReset = Math.floor((Date.now() - PARIS_OFFSET_MS) / DAY_MS) * DAY_MS + PARIS_OFFSET_MS;
  return new Date(claimedAt).getTime() < lastReset;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function categoryFallbackEmoji(category: string): string {
  const map: Record<string, string> = {
    streak: '🔥',
    trade: '🔄',
    pokedex: '📖',
    rarity: '💠',
    starters: '🌱',
    starter_evo: '🌿',
    trainer: '🧢',
    generation: '🌍',
    region: '🗺️',
    legendary: '⭐',
    types: '💎',
    battle: '⚔️',
    market: '🪙',
    shiny: '✨',
  };
  return map[category] ?? '🏅';
}

export default function Profile() {
  const { setCoins, refreshProfile } = useUserCtx();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [badges, setBadges] = useState<AllBadgeEntry[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, BadgeProgressEntry>>(new Map());
  const [selectedBadge, setSelectedBadge] = useState<AllBadgeEntry | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>(loadCollapsed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    coins_earned: number;
    streak_days: number;
    already_claimed: boolean;
  } | null>(null);
  const [username, setUsername] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [featuredDraft, setFeaturedDraft] = useState<string[]>([]);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [claimingBadge, setClaimingBadge] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [favoritePokemon, setFavoritePokemon] = useState<UserPokemonInstance | null>(null);
  const [trainerSaving, setTrainerSaving] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCats(prev => {
      const next = { ...prev, [cat]: !prev[cat] };
      try { localStorage.setItem(BADGES_COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [prof, allBadges, progress] = await Promise.all([getMyProfile(), getAllBadges(), getBadgeProgress()]);
        if (cancelled) return;
        setProfile(prof);
        setUsername(prof.display_name);
        setBadges(allBadges);
        setProgressMap(new Map(progress.map(p => [p.badgeId, p])));
        setFeaturedDraft(prof.featured_badges ?? []);
        // Resolve the favorite Pokémon instance for display (the profile only
        // carries its id). Only fetch the pokedex when a favorite is set.
        if (prof.favorite_pokemon_id) {
          getMyPokedex()
            .then(data => {
              if (cancelled) return;
              setFavoritePokemon(data.pokemons.find(p => p.instanceId === prof.favorite_pokemon_id) ?? null);
            })
            .catch(() => { /* non-blocking */ });
        }
        if (prof.last_login) {
          const today = new Date().toISOString().slice(0, 10);
          const loginDay = new Date(prof.last_login).toISOString().slice(0, 10);
          if (loginDay === today) {
            setClaimResult({ coins_earned: 0, streak_days: prof.streak_days, already_claimed: true });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleClaim() {
    if (claimLoading || claimResult?.already_claimed) return;
    setClaimLoading(true);
    try {
      const result = await claimDailyLogin();
      setClaimResult({
        coins_earned: result.coins_earned,
        streak_days: result.streak_days,
        already_claimed: result.already_claimed,
      });
      setCoins(result.total_coins);
      setProfile(prev =>
        prev ? { ...prev, coins: result.total_coins, streak_days: result.streak_days } : null
      );
      if (!result.already_claimed) {
        showToast(`+${result.coins_earned} coins récupérés !`, 'success');
      } else {
        showToast('Déjà récupéré aujourd\'hui.', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleClaimBadge(badge: AllBadgeEntry) {
    if (claimingBadge) return;
    setClaimingBadge(badge.id);
    try {
      const result = await claimBadge(badge.id);
      setCoins(result.total_coins);
      setBadges(prev => prev.map(b =>
        b.id === badge.id ? { ...b, claimed: true, claimed_at: new Date().toISOString() } : b
      ));
      // Keep the open modal in sync so it flips to "Récompense réclamée ✓".
      setSelectedBadge(prev => prev && prev.id === badge.id ? { ...prev, claimed: true, claimed_at: new Date().toISOString() } : prev);
      showToast(`+${result.coins_earned} coins récupérés !`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally {
      setClaimingBadge(null);
    }
  }

  async function handleSaveUsername() {
    if (!profile || usernameSaving) return;

    const nextUsername = username.trim();
    if (nextUsername.length < 2) {
      showToast('Nom trop court', 'error');
      return;
    }

    setUsernameSaving(true);
    try {
      const result = await updateUsername(nextUsername);
      setUsername(result.display_name);
      setProfile(prev => prev ? { ...prev, display_name: result.display_name } : null);
      await refreshProfile();
      showToast('Nom sauvegardé !', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de sauvegarde', 'error');
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleSetGender(gender: 'M' | 'F') {
    if (trainerSaving || profile?.trainer_gender === gender) return;
    setTrainerSaving(true);
    try {
      const result = await updateTrainerProfile({ trainer_gender: gender });
      setProfile(prev => prev ? { ...prev, trainer_gender: result.trainer_gender } : null);
      showToast('Dresseur sauvegardé !', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de sauvegarde', 'error');
    } finally {
      setTrainerSaving(false);
    }
  }

  async function handlePickFavorite(p: UserPokemonInstance) {
    if (trainerSaving) return;
    setTrainerSaving(true);
    try {
      const result = await updateTrainerProfile({ favorite_pokemon_id: p.instanceId });
      setProfile(prev => prev ? { ...prev, favorite_pokemon_id: result.favorite_pokemon_id } : null);
      setFavoritePokemon(p);
      setFavoriteModalOpen(false);
      showToast(`${p.name} est ton Pokémon favori !`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de sauvegarde', 'error');
    } finally {
      setTrainerSaving(false);
    }
  }

  async function handleSelectAvatar(badgeId: string | null) {
    if (trainerSaving) return;
    setTrainerSaving(true);
    try {
      const result = await updateTrainerAvatar(badgeId);
      setProfile(prev => prev ? { ...prev, trainer_avatar: result.trainer_avatar } : null);
      showToast(result.trainer_avatar ? 'Avatar dresseur sauvegardé !' : 'Avatar réinitialisé', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de sauvegarde', 'error');
    } finally {
      setTrainerSaving(false);
    }
  }

  async function handleSaveFeatured() {
    setFeaturedSaving(true);
    try {
      await updateFeaturedBadges(featuredDraft);
      setProfile(prev => prev ? { ...prev, featured_badges: featuredDraft } : null);
      showToast('Badges vitrine sauvegardés !', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de sauvegarde', 'error');
    } finally {
      setFeaturedSaving(false);
    }
  }

  function toggleFeatured(badgeId: string) {
    setFeaturedDraft(prev => {
      if (prev.includes(badgeId)) {
        return prev.filter(id => id !== badgeId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, badgeId];
    });
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        Chargement du profil…
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (!profile) return null;

  // Group badges by category, following the explicit display order (unknown
  // categories appended at the end).
  const presentCategories = new Set(badges.map(b => b.category));
  const categories = [
    ...CATEGORY_ORDER.filter(c => presentCategories.has(c)),
    ...Array.from(presentCategories).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const unlockedBadges = badges.filter(b => b.unlocked);

  // Map badge_id → AllBadgeEntry for featured slot lookup
  const badgeMap = new Map(badges.map(b => [b.id, b]));

  return (
    <div className="profile-page">
      <h1 className="profile-title">Mon Profil</h1>

      <section className="profile-section">
        <h2 className="profile-section-title">
          <span>👤</span> Nom d'utilisateur
        </h2>
        <div className="profile-username-row">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={32}
            className="profile-username-input"
            aria-label="Nom d'utilisateur"
          />
          <button
            className="btn btn-primary"
            onClick={handleSaveUsername}
            disabled={usernameSaving || username.trim() === profile.display_name}
          >
            {usernameSaving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
            Sauvegarder
          </button>
        </div>
      </section>

      {/* ── Section: Mon dresseur ── */}
      <section className="profile-section">
        <h2 className="profile-section-title">
          <span>🎽</span> Mon dresseur
        </h2>

        <div className="trainer-customization">
          <div className="trainer-gender-picker">
            {(['M', 'F'] as const).map(g => {
              const selected = profile.trainer_gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  className={`trainer-gender-option${selected ? ' selected' : ''}`}
                  onClick={() => handleSetGender(g)}
                  disabled={trainerSaving}
                  aria-pressed={selected}
                  aria-label={g === 'M' ? 'Dresseur' : 'Dresseuse'}
                >
                  <img
                    src={g === 'M' ? '/base_trainer_m.gif' : '/base_trainer_f.gif'}
                    alt={g === 'M' ? 'Dresseur' : 'Dresseuse'}
                    className="trainer-gender-gif"
                  />
                  <span>{g === 'M' ? 'Dresseur' : 'Dresseuse'}</span>
                </button>
              );
            })}
            {!profile.trainer_gender && (
              <div className="trainer-gender-hint">Choisis ton apparence de dresseur</div>
            )}
          </div>

          <div className="trainer-favorite">
            {favoritePokemon ? (
              <div className="trainer-favorite-current" title="Pokémon favori">
                <img src={favoritePokemon.sprite_url} alt={favoritePokemon.name} className="trainer-favorite-sprite" />
                <span className="trainer-favorite-name">{favoritePokemon.name}{favoritePokemon.is_shiny ? ' ✨' : ''}</span>
              </div>
            ) : (
              <div className="trainer-favorite-empty">Aucun Pokémon favori</div>
            )}
            <button
              className="btn btn-primary"
              onClick={() => setFavoriteModalOpen(true)}
              disabled={trainerSaving}
            >
              {favoritePokemon ? 'Changer mon Pokémon favori' : 'Choisir mon Pokémon favori'}
            </button>
            {favoritePokemon && (
              <p className="trainer-favorite-hint">
                Ton favori t'accompagne sur ton profil public et ne peut être ni vendu ni échangé.
              </p>
            )}
          </div>
        </div>

        {/* ── Avatar Dresseur (équipes de dresseurs débloquées) ── */}
        <div className="trainer-avatar-block">
          <h3 className="trainer-avatar-title">Avatar Dresseur</h3>
          <p className="trainer-avatar-hint">
            Débloque un badge « Équipe de dresseur » pour utiliser son avatar sur ton profil public.
          </p>
          <div className="badges-grid">
            {/* Aucun avatar - revient au dresseur de base */}
            <button
              type="button"
              className={`badge-card badge-card--clickable${!profile.trainer_avatar ? ' selected' : ''}`}
              onClick={() => handleSelectAvatar(null)}
              disabled={trainerSaving}
              title="Aucun avatar"
            >
              {!profile.trainer_avatar && <span className="trainer-avatar-check">✓</span>}
              <div className="badge-card-icon">🚫</div>
              <span className="badge-card-name">Aucun avatar</span>
            </button>

            {TRAINER_AVATAR_IDS.map(id => {
              const badge = badgeMap.get(id);
              const unlocked = !!badge?.unlocked;
              const active = profile.trainer_avatar === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`badge-card badge-card--clickable trainer-avatar-card${unlocked ? '' : ' locked'}${active ? ' selected' : ''}`}
                  // Locked: open the badge detail modal (same trigger as the badge
                  // grid). Unlocked: toggle it as the active avatar.
                  onClick={() => {
                    if (!unlocked) { if (badge) setSelectedBadge(badge); return; }
                    handleSelectAvatar(active ? null : id);
                  }}
                  disabled={trainerSaving && unlocked}
                  style={!unlocked ? { cursor: 'not-allowed' } : undefined}
                  title={badge?.name ?? id}
                >
                  {!unlocked && <span className="badge-lock-overlay"><Lock size={11} /></span>}
                  {active && <span className="trainer-avatar-check">✓</span>}
                  <div className="badge-card-icon">
                    <img
                      src={TRAINER_AVATAR_MAP[id]}
                      alt={badge?.name ?? id}
                      width={40}
                      height={40}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <span className="badge-card-name">{badge?.name ?? id}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 1: Solde & Streak ── */}
      <section className="profile-section">
        <h2 className="profile-section-title">
          <Coins size={18} /> Solde &amp; Streak
        </h2>

        <div className="coins-display">{profile.coins.toLocaleString('fr-FR')} <span className="coins-unit">coins</span></div>

        <div className="profile-meta">
          <span className="streak-display">🔥 {profile.streak_days} jour{profile.streak_days !== 1 ? 's' : ''} de streak</span>
          <span>Dernière connexion&nbsp;: {formatDate(profile.last_login)}</span>
        </div>

        <div className="profile-claim-row">
          {claimResult?.already_claimed ? (
            <span className="claim-done">Déjà récupéré aujourd'hui ✓</span>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleClaim}
              disabled={!!claimResult?.already_claimed || claimLoading}
            >
              {claimLoading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
              Récupérer mes coins du jour
            </button>
          )}

          {shinyPackAvailable(profile.last_shiny_pack_claimed_at) ? (
            <Link to="/events/pack?shiny=1" className="btn btn-primary">
              Ouvrir le pack Canicule
            </Link>
          ) : (
            <span className="claim-done">Pack Canicule - Disponible à 00h00</span>
          )}

          {/* Booster 3D rendu en pleine résolution (300x450) puis réduit en CSS
              pour rester net. Poussé à droite, aligné sur la même ligne que les
              boutons. Idle float + hover tilt conservés. */}
          <div style={{ marginLeft: 'auto', width: 224, height: 336, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ transform: 'scale(0.7467)', transformOrigin: 'center', lineHeight: 0 }}>
              <BoosterPack3D textureUrl="/texture_pack_canicule.png" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Mes badges ── */}
      <section className="profile-section">
        <h2 className="profile-section-title">
          <span>🏅</span> Mes badges
          <span className="badge-count">{unlockedBadges.length}/{badges.length}</span>
        </h2>

        {categories.map(cat => {
          const catBadges = badges.filter(b => b.category === cat);
          const isCollapsed = !!collapsedCats[cat];
          const catUnlocked = catBadges.filter(b => b.unlocked).length;
          const catPct = catBadges.length > 0 ? Math.round((catUnlocked / catBadges.length) * 100) : 0;
          return (
            <div key={cat} className="badge-category-group">
              <button
                type="button"
                className="badge-category-title"
                onClick={() => toggleCategory(cat)}
                aria-expanded={!isCollapsed}
              >
                {categoryLabel(cat)}
                {isCollapsed ? (
                  <span className="badge-category-progress">
                    <span className="badge-category-progress-bar">
                      <span className="badge-category-progress-fill" style={{ width: `${catPct}%` }} />
                    </span>
                    <span className="badge-category-progress-label">{catPct}%</span>
                  </span>
                ) : (
                  <span className="badge-category-line" />
                )}
                <span className="badge-category-arrow">{isCollapsed ? '▶' : '▼'}</span>
              </button>
              <div className={`badge-category-content${isCollapsed ? ' collapsed' : ''}`}>
                <div className="badges-grid">
                {catBadges.map(badge => {
                  const iconSrc = badgeIconSrc(badge.id, badge.icon_url);
                  return (
                  <button
                    type="button"
                    key={badge.id}
                    className={`badge-card badge-card--clickable${badge.unlocked ? '' : ' locked'}${badge.unlocked && !badge.claimed ? ' badge-card--unclaimed' : ''}`}
                    title={badge.description}
                    onClick={() => setSelectedBadge(badge)}
                  >
                    {!badge.unlocked && <span className="badge-lock-overlay"><Lock size={11} /></span>}
                    {badge.unlocked && !badge.claimed && <span className="badge-unclaimed-dot" aria-label="Récompense à réclamer" />}
                    <div className="badge-card-icon">
                      {iconSrc ? (
                        <img src={iconSrc} alt={badge.name} width={40} height={40} />
                      ) : (
                        categoryFallbackEmoji(badge.category)
                      )}
                    </div>
                    <span className="badge-card-name">{badge.name}</span>
                    {badge.unlocked && badge.unlocked_at && (
                      <span className="badge-card-date">{formatDate(badge.unlocked_at)}</span>
                    )}
                  </button>
                  );
                })}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Section 3: Badges vitrine ── */}
      <section className="profile-section">
        <h2 className="profile-section-title">
          <span>✨</span> Badges vitrine
        </h2>
        <p className="profile-vitrine-hint">Sélectionne jusqu'à 3 badges à afficher sur ton profil public.</p>

        {/* Slots */}
        <div className="featured-slots">
          {[0, 1, 2].map(i => {
            const badgeId = featuredDraft[i];
            const badge = badgeId ? badgeMap.get(badgeId) : undefined;
            const iconSrc = badge ? badgeIconSrc(badge.id, badge.icon_url) : null;
            return (
              <div key={i} className={`featured-slot${badge ? ' filled' : ''}`}>
                {badge ? (
                  <>
                    <div className="badge-card-icon" style={{ fontSize: 28 }}>
                      {iconSrc ? (
                        <img src={iconSrc} alt={badge.name} width={32} height={32} />
                      ) : (
                        categoryFallbackEmoji(badge.category)
                      )}
                    </div>
                    <span className="featured-slot-name">{badge.name}</span>
                  </>
                ) : (
                  <span className="featured-slot-empty">+</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Selectable unlocked badges */}
        <div className="badges-grid">
          {unlockedBadges.map(badge => {
            const selected = featuredDraft.includes(badge.id);
            const iconSrc = badgeIconSrc(badge.id, badge.icon_url);
            return (
              <div
                key={badge.id}
                className={`badge-card selectable${selected ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${selected ? 'Retirer' : 'Mettre en vitrine'} : ${badge.name}`}
                onClick={() => toggleFeatured(badge.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFeatured(badge.id);
                  }
                }}
                title={badge.description}
              >
                <div className="badge-card-icon">
                  {iconSrc ? (
                    <img src={iconSrc} alt={badge.name} width={40} height={40} />
                  ) : (
                    categoryFallbackEmoji(badge.category)
                  )}
                </div>
                <span className="badge-card-name">{badge.name}</span>
              </div>
            );
          })}
          {unlockedBadges.length === 0 && (
            <p className="profile-empty-badges">Aucun badge débloqué pour l'instant.</p>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSaveFeatured}
          disabled={featuredSaving}
          style={{ alignSelf: 'flex-start' }}
        >
          {featuredSaving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
          Sauvegarder
        </button>
      </section>

      {/* ── Favorite Pokémon picker ── */}
      {favoriteModalOpen && (
        <FavoritePokemonModal
          currentFavoriteId={profile.favorite_pokemon_id}
          onPick={handlePickFavorite}
          onClose={() => setFavoriteModalOpen(false)}
        />
      )}

      {/* ── Badge detail modal ── */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          progress={progressMap.get(selectedBadge.id)}
          claiming={claimingBadge === selectedBadge.id}
          onClaim={() => handleClaimBadge(selectedBadge)}
          onClose={() => setSelectedBadge(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
