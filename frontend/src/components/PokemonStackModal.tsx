import { useState, useEffect, useCallback } from 'react';
import type { UserPokemonInstance } from '../api/types';
import PokemonDetailCard from './PokemonDetailCard';
import RarityBadge from './RarityBadge';
import './PokemonStackModal.css';

// Cap on how many copies are shown for a big stack: beyond this we display a
// random sample (a real random draw, not the first/last N) so every copy has a
// chance to surface across openings.
const MAX_SHOWN = 10;

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

  // Pick the copies to show once, at mount: a random sample of MAX_SHOWN when
  // the stack is bigger, otherwise every copy.
  const [shown, setShown] = useState<UserPokemonInstance[]>(() =>
    total > MAX_SHOWN ? shuffle(instances).slice(0, MAX_SHOWN) : instances);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Selling a copy from its detail card: drop it from the local view and close
  // the whole stack once nothing is left.
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
      <div className="psm-panel" onClick={e => e.stopPropagation()}>
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

        {/* Each copy is a full detail panel, identical to the standalone modal,
            just repeated and laid out in a responsive 2-3 column grid. */}
        <div className="psm-grid">
          {shown.map(p => (
            <PokemonDetailCard key={p.instanceId} pokemon={p} onSell={handleSell} />
          ))}
        </div>
      </div>
    </div>
  );
}
