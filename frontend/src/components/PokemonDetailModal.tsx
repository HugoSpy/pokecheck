import { useEffect, useCallback } from 'react';
import type { UserPokemonInstance } from '../api/types';
import PokemonDetailCard from './PokemonDetailCard';
import './PokemonDetailModal.css';

interface Props {
  pokemon: UserPokemonInstance;
  onClose: () => void;
  onSell?: (instanceId: string) => Promise<void>;
}

export default function PokemonDetailModal({ pokemon, onClose, onSell }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="pdm-backdrop" onClick={onClose}>
      <PokemonDetailCard pokemon={pokemon} onClose={onClose} onSell={onSell} />
    </div>
  );
}
