import { useState, useEffect, useCallback } from 'react';
import type { UserPokemonInstance } from '../api/types';
import PokemonDetailModal from './PokemonDetailModal';
import RarityBadge from './RarityBadge';
import './PokemonStackModal.css';

const SHINY_GOLD = '#d4af37';

// Cap on how many copies are shown for a big stack: beyond this we display a
// random sample (a real random draw, not the first/last N) so every copy has a
// chance to surface across openings.
const MAX_SHOWN = 10;

// User-facing French labels for the server-side `source` of a copy.
const SOURCE_FR: Record<string, string> = {
  draw:        'Tirage',
  attendance:  'Présence',
  event:       'Événement',
  market:      'Marché',
  trade:       'Échange',
  shop:        'Boutique',
  battle:      'Combat',
  shiny_daily: 'Pack shiny',
  admin:       'Admin',
};

function sourceLabel(source: string): string {
  return SOURCE_FR[source] ?? source;
}

// Fisher-Yates: returns a fresh randomly-ordered copy of the array.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Props {
  instances: UserPokemonInstance[];
  onClose: () => void;
  onSell?: (instanceId: string) => Promise<void>;
}

export default function PokemonStackModal({ instances, onClose, onSell }: Props) {
  const total = instances.length;
  const rep = instances[0];
  const isShiny = rep.is_shiny ?? false;

  // Pick the copies to show once, at mount: a random sample of MAX_SHOWN when
  // the stack is bigger, otherwise every copy.
  const [shown, setShown] = useState<UserPokemonInstance[]>(() =>
    total > MAX_SHOWN ? shuffle(instances).slice(0, MAX_SHOWN) : instances);

  // The individual copy whose full detail modal is open (null = none).
  const [detail, setDetail] = useState<UserPokemonInstance | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Selling a copy from the nested detail modal: drop it from the local view and
  // close the whole stack once nothing is left.
  const handleSell = onSell
    ? async (instanceId: string) => {
        await onSell(instanceId);
        setShown(prev => {
          const next = prev.filter(p => p.instanceId !== instanceId);
          if (next.length === 0) onClose();
          return next;
        });
      }
    : undefined;

  return (
    <div className="psm-backdrop" onClick={onClose}>
      <div
        className={`psm-panel${isShiny ? ' psm-panel--shiny' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="psm-close" onClick={onClose} aria-label="Fermer">✕</button>

        <div className="psm-header">
          <h2 className="psm-title">{rep.name}</h2>
          <div className="psm-rarity-row">
            <RarityBadge rarity={rep.rarity} size="md" />
            <span className="psm-count">×{total}</span>
          </div>
          {total > MAX_SHOWN && (
            <div className="psm-sample-note">
              {MAX_SHOWN} exemplaires affichés au hasard sur {total}
            </div>
          )}
        </div>

        <div className="psm-grid">
          {shown.map(p => {
            const locked = p.tradeable_at && new Date(p.tradeable_at) > new Date();
            return (
              <button
                key={p.instanceId}
                className="psm-copy"
                onClick={() => setDetail(p)}
                title="Voir le détail"
              >
                <img
                  src={p.sprite_url}
                  alt={p.name}
                  className="psm-copy-sprite"
                  style={{
                    filter: isShiny
                      ? `drop-shadow(0 0 6px ${SHINY_GOLD}aa)`
                      : 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
                  }}
                />
                <div className="psm-copy-row">
                  <span className="psm-copy-label">Obtenu</span>
                  <span className="psm-copy-value">
                    {new Date(p.obtainedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="psm-copy-row">
                  <span className="psm-copy-label">Source</span>
                  <span className="psm-copy-value">{sourceLabel(p.source)}</span>
                </div>
                <div className="psm-copy-row">
                  <span className="psm-copy-label">Échange</span>
                  <span className="psm-copy-value">
                    {locked
                      ? `dès le ${new Date(p.tradeable_at!).toLocaleDateString('fr-FR')}`
                      : 'disponible'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {detail && (
        <PokemonDetailModal
          pokemon={detail}
          onClose={() => setDetail(null)}
          onSell={handleSell}
        />
      )}
    </div>
  );
}
