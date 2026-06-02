import { useEffect, useState, useCallback } from 'react';
import { getMyProfile, getAllBadges, claimDailyLogin, updateFeaturedBadges, claimBadge } from '../api/userApi';
import { useUserCtx } from '../context/UserContext';
import type { MyProfile, AllBadgeEntry } from '../api/types';
import Toast from '../components/Toast';
import { Coins, Lock } from '../components/icons';
import './Profile.css';

const CATEGORY_LABELS: Record<string, string> = {
  streak: 'Connexion',
  trade: 'Échanges',
  pokedex: 'Pokédex',
  starters: 'Starters',
  gen: 'Générations',
  legendary: 'Légendaires',
  type: 'Types',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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
    starters: '🌱',
    gen: '🌍',
    legendary: '⭐',
    type: '💎',
  };
  return map[category] ?? '🏅';
}

export default function Profile() {
  const { setCoins } = useUserCtx();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [badges, setBadges] = useState<AllBadgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    coins_earned: number;
    streak_days: number;
    already_claimed: boolean;
  } | null>(null);
  const [featuredDraft, setFeaturedDraft] = useState<string[]>([]);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [claimingBadge, setClaimingBadge] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [prof, allBadges] = await Promise.all([getMyProfile(), getAllBadges()]);
        if (cancelled) return;
        setProfile(prof);
        setBadges(allBadges);
        setFeaturedDraft(prof.featured_badges ?? []);
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
      showToast(`+${result.coins_earned} coins récupérés !`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally {
      setClaimingBadge(null);
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

  // Group badges by category
  const categories = Array.from(new Set(badges.map(b => b.category)));

  const unlockedBadges = badges.filter(b => b.unlocked);

  // Map badge_id → AllBadgeEntry for featured slot lookup
  const badgeMap = new Map(badges.map(b => [b.id, b]));

  return (
    <div className="profile-page">
      <h1 className="profile-title">Mon Profil</h1>

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
          return (
            <div key={cat} className="badge-category-group">
              <div className="badge-category-title">{categoryLabel(cat)}</div>
              <div className="badges-grid">
                {catBadges.map(badge => (
                  <div
                    key={badge.id}
                    className={`badge-card${badge.unlocked ? '' : ' locked'}${badge.unlocked && !badge.claimed ? ' badge-card--unclaimed' : ''}`}
                    title={badge.description}
                  >
                    {!badge.unlocked && <span className="badge-lock-overlay"><Lock size={11} /></span>}
                    <div className="badge-card-icon">
                      {badge.icon_url ? (
                        <img src={badge.icon_url} alt={badge.name} width={40} height={40} />
                      ) : (
                        categoryFallbackEmoji(badge.category)
                      )}
                    </div>
                    <span className="badge-card-name">{badge.name}</span>
                    {badge.unlocked && badge.claimed && badge.unlocked_at && (
                      <span className="badge-card-date">{formatDate(badge.unlocked_at)}</span>
                    )}
                    {badge.unlocked && !badge.claimed && (
                      <button
                        className="badge-claim-btn"
                        onClick={() => handleClaimBadge(badge)}
                        disabled={claimingBadge === badge.id}
                      >
                        {claimingBadge === badge.id
                          ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                          : <>Récupérer <Coins size={12} /> {badge.coin_reward}</>}
                      </button>
                    )}
                  </div>
                ))}
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
            return (
              <div key={i} className={`featured-slot${badge ? ' filled' : ''}`}>
                {badge ? (
                  <>
                    <div className="badge-card-icon" style={{ fontSize: 28 }}>
                      {badge.icon_url ? (
                        <img src={badge.icon_url} alt={badge.name} width={32} height={32} />
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
                  {badge.icon_url ? (
                    <img src={badge.icon_url} alt={badge.name} width={40} height={40} />
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

      {/* ── Toast ── */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
