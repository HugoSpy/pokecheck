import { useEffect, useCallback } from 'react';
import type { AllBadgeEntry, BadgeProgressEntry, UserPokemonInstance } from '../api/types';
import { Coins } from './icons';
import PokemonCard from './PokemonCard';
import './BadgeDetailModal.css';

const CATEGORY_EMOJI: Record<string, string> = {
  streak: '🔥', trade: '🔄', pokedex: '📖', starters: '🌱', starter_evo: '🌿',
  generation: '🌍', legendary: '⭐', types: '💎', battle: '⚔️', market: '🪙', shiny: '✨',
};

// Unit shown after "X / Y" in the progress bar, per badge family.
function unitFor(badge: AllBadgeEntry): string {
  if (badge.id.startsWith('market_sell')) return 'ventes';
  if (badge.id.startsWith('market_buy')) return 'achats';
  switch (badge.category) {
    case 'battle': return 'victoires';
    case 'trade': return 'échanges';
    case 'streak': return 'jours';
    case 'shiny': return 'shinies';
    case 'types': return 'espèces';
    default: return 'Pokémon';
  }
}

function fallbackEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '🏅';
}

interface Props {
  badge: AllBadgeEntry;
  progress?: BadgeProgressEntry;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export default function BadgeDetailModal({ badge, progress, claiming, onClaim, onClose }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const p = progress?.progress;
  const pct = p && p.required > 0 ? Math.min(100, Math.round((p.current / p.required) * 100)) : 0;

  return (
    <div className="bdm-backdrop" onClick={onClose}>
      <div
        className={`bdm-panel${badge.unlocked ? ' bdm-panel--unlocked' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="bdm-close" onClick={onClose} aria-label="Fermer">✕</button>

        <div className={`bdm-icon${badge.unlocked ? '' : ' locked'}`}>
          {badge.icon_url
            ? <img src={badge.icon_url} alt={badge.name} width={56} height={56} />
            : fallbackEmoji(badge.category)}
        </div>

        <h2 className="bdm-name">{badge.name}</h2>
        <p className="bdm-desc">{badge.description}</p>

        {badge.unlocked ? (
          <>
            <div className="bdm-unlocked-at">
              Débloqué le {badge.unlocked_at ? new Date(badge.unlocked_at).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              }) : '—'}
            </div>
            {badge.claimed ? (
              <div className="bdm-claimed">Récompense réclamée ✓</div>
            ) : (
              <button className="bdm-claim-btn" onClick={onClaim} disabled={claiming}>
                {claiming
                  ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  : <>Réclamer <Coins size={14} /> {badge.coin_reward}</>}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="bdm-reward">
              <Coins size={16} /> {badge.coin_reward.toLocaleString()} coins à la clé
            </div>

            {p && (
              <div className="bdm-progress">
                <div className="bdm-progress-bar">
                  <div className="bdm-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="bdm-progress-label">{p.current} / {p.required} {unitFor(badge)}</div>
              </div>
            )}

            {p?.missingPokemon && p.missingPokemon.length > 0 && (
              <div className="bdm-missing">
                <div className="bdm-missing-title">Pokémon manquants</div>
                <div className="bdm-missing-grid">
                  {p.missingPokemon.map(m => {
                    const inst: UserPokemonInstance = {
                      id: m.id,
                      name: m.name,
                      sprite_url: m.spriteUrl,
                      rarity: m.rarity,
                      points: m.points,
                      types: m.types,
                      generation: m.generation,
                      bst: 0,
                      is_shiny: false,
                      instanceId: `missing-${m.id}`,
                      obtainedAt: '',
                      source: 'missing',
                      tradeable_at: null,
                    };
                    return <PokemonCard key={m.id} pokemon={inst} />;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
