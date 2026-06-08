import type { Lobby } from '../socket/battleTypes';
import './Battle.css';

interface BattleArenaProps {
  lobby: Lobby;
}

// Placeholder landing screen for phase 1 — emitted on `battle:start`.
// Phase 2 will replace this with the pack-opening animation, draw resolution,
// score comparison and Pokémon attribution. Keep this component self-contained
// so that work can be dropped in without touching the lobby flow.
export default function BattleArena({ lobby }: BattleArenaProps) {
  return (
    <div className="battle-arena">
      <div className="battle-arena-spinner" />
      <h1 className="battle-arena-title">La battle va commencer…</h1>
      <p className="battle-arena-pack">{lobby.packName}</p>

      <div className="battle-arena-players">
        {lobby.players.map(player => (
          <div key={player.userId} className="battle-arena-player">
            {player.displayName}
            {player.isHost && <span className="battle-arena-host-tag">Hôte</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
