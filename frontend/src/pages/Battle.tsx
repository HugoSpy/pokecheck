import { useEffect, useState } from 'react';
import { getActiveEvents } from '../api/eventApi';
import { EVENT_PACK_CONFIG } from './Events';
import BoosterPack3D from '../components/BoosterPack3D';
import { useUserCtx } from '../context/UserContext';
import { useBattle } from '../hooks/useBattle';
import BattleArena from './BattleArena';
import { Coins } from '../components/icons';
import type { GameEvent } from '../api/types';
import type { BattleListItem } from '../socket/battleTypes';
import './Battle.css';

type View = 'menu' | 'create' | 'join' | 'lobby' | 'arena';

const PLAYER_COUNTS = [2, 3, 4] as const;

function packPreviewProps(packName: string) {
  return EVENT_PACK_CONFIG[packName];
}

// ── Menu ─────────────────────────────────────────────────────────────────────

function MenuView({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="battle-menu">
      <button className="btn btn-primary battle-menu-btn" onClick={onCreate}>
        Créer une partie
      </button>
      <button className="btn btn-ghost battle-menu-btn" onClick={onJoin}>
        Rejoindre une partie
      </button>
    </div>
  );
}

// ── Create ───────────────────────────────────────────────────────────────────

function CreateView({
  onBack,
  onCreate,
}: {
  onBack: () => void;
  onCreate: (event: GameEvent, maxPlayers: number) => void;
}) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number>(2);

  useEffect(() => {
    getActiveEvents()
      .then(list => {
        setEvents(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = events.find(e => e.id === selectedId) ?? null;

  return (
    <div className="battle-panel">
      <button className="btn btn-ghost battle-back" onClick={onBack}>← Retour</button>
      <h2 className="battle-panel-title">Créer une battle</h2>

      {loading && <div className="battle-hint">Chargement des packs…</div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && events.length === 0 && (
        <div className="battle-hint">Aucun pack d'événement disponible pour le moment.</div>
      )}

      {events.length > 0 && (
        <>
          <div className="battle-pack-grid">
            {events.map(event => (
              <button
                key={event.id}
                type="button"
                className={`battle-pack-option${selectedId === event.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(event.id)}
              >
                <span className="battle-pack-option-name">{event.name}</span>
                <span className="battle-pack-option-price">
                  <Coins size={14} /> {event.price}
                </span>
              </button>
            ))}
          </div>

          <div className="battle-field">
            <span className="battle-field-label">Nombre de joueurs</span>
            <div className="battle-player-count-group">
              {PLAYER_COUNTS.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`battle-player-count${maxPlayers === n ? ' selected' : ''}`}
                  onClick={() => setMaxPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => selected && onCreate(selected, maxPlayers)}
          >
            Valider
          </button>
        </>
      )}
    </div>
  );
}

// ── Join ─────────────────────────────────────────────────────────────────────

function JoinView({
  games,
  onBack,
  onJoin,
}: {
  games: BattleListItem[];
  onBack: () => void;
  onJoin: (roomId: string) => void;
}) {
  return (
    <div className="battle-panel">
      <button className="btn btn-ghost battle-back" onClick={onBack}>← Retour</button>
      <h2 className="battle-panel-title">Parties ouvertes</h2>

      {games.length === 0 ? (
        <div className="battle-hint">Aucune partie ouverte pour le moment.</div>
      ) : (
        <div className="battle-game-list">
          {games.map(game => (
            <div key={game.id} className="battle-game-card">
              <div className="battle-game-preview">
                <BoosterPack3D {...packPreviewProps(game.packName)} />
              </div>
              <div className="battle-game-info">
                <div className="battle-game-name">{game.packName}</div>
                <div className="battle-game-meta">
                  Hôte : {game.hostName} · {game.playerCount}/{game.maxPlayers} joueurs
                </div>
                <button className="btn btn-primary" onClick={() => onJoin(game.id)}>
                  Rejoindre
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lobby ────────────────────────────────────────────────────────────────────

function LobbyView({
  lobby,
  myUserId,
  onReady,
  onLeave,
}: {
  lobby: import('../socket/battleTypes').Lobby;
  myUserId: string | undefined;
  onReady: (ready: boolean) => void;
  onLeave: () => void;
}) {
  const me = lobby.players.find(p => p.userId === myUserId);
  const slots = [...lobby.players, ...Array(Math.max(0, lobby.maxPlayers - lobby.players.length)).fill(null)];

  return (
    <div className="battle-panel">
      <button className="btn btn-ghost battle-back" onClick={onLeave}>← Quitter</button>
      <h2 className="battle-panel-title">{lobby.packName}</h2>
      <div className="battle-hint">{lobby.players.length}/{lobby.maxPlayers} joueurs</div>

      <div className="battle-lobby-slots">
        {slots.map((player, i) =>
          player ? (
            <div key={player.userId} className={`battle-slot${player.ready ? ' ready' : ''}`}>
              <span className="battle-slot-name">
                {player.displayName}
                {player.isHost && <span className="battle-slot-host">Hôte</span>}
              </span>
              <span className="battle-slot-status">{player.ready ? 'Prêt' : 'En attente'}</span>
            </div>
          ) : (
            <div key={`empty-${i}`} className="battle-slot empty">
              <span className="battle-slot-name">En attente d'un joueur…</span>
            </div>
          ),
        )}
      </div>

      <button
        className={`btn ${me?.ready ? 'btn-ghost' : 'btn-primary'}`}
        onClick={() => onReady(!me?.ready)}
      >
        {me?.ready ? 'Annuler' : 'Je suis prêt'}
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Battle() {
  const { profile, refreshProfile } = useUserCtx();
  const {
    openGames, lobby, battleAnimation, battleBegin, battleError, isTie,
    browse, unbrowse, create, join, setReady, leave, resultAck, clientReady, clearBattleError,
  } = useBattle();
  const [view, setView] = useState<View>('menu');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'join') return;
    browse();
    return () => unbrowse();
  }, [view, browse, unbrowse]);

  useEffect(() => {
    if (lobby && view !== 'lobby' && view !== 'arena') setView('lobby');
    if (!lobby && view === 'lobby') setView('menu');
  }, [lobby, view]);

  useEffect(() => {
    if (lobby?.status === 'in_progress') setView('arena');
  }, [lobby?.status]);

  // A battle that just started charged the entry cost - refresh the coin balance.
  useEffect(() => {
    if (battleAnimation) void refreshProfile();
  }, [battleAnimation, refreshProfile]);

  // A failed launch (insufficient coins / missing pack) drops everyone back to
  // the lobby with the server's message.
  useEffect(() => {
    if (!battleError) return;
    setError(battleError);
    setView('lobby');
    clearBattleError();
  }, [battleError, clearBattleError]);

  async function handleCreate(event: GameEvent, maxPlayers: number) {
    setError(null);
    const config = EVENT_PACK_CONFIG[event.name];
    const res = await create({
      eventPackId: event.id,
      packName: event.name,
      packModelUrl: null,
      packImageUrl: config?.textureUrl ?? null,
      maxPlayers,
    });
    if (!res.ok) setError(res.error);
  }

  async function handleJoin(roomId: string) {
    setError(null);
    const res = await join(roomId);
    if (!res.ok) setError(res.error);
  }

  function handleLeave() {
    if (lobby) leave(lobby.id);
    setView('menu');
  }

  return (
    <div className="battle-page">
      <h1 className="battle-title">Battle de caisse</h1>
      {error && <div className="error-banner">{error}</div>}

      {view === 'menu' && (
        <MenuView onCreate={() => setView('create')} onJoin={() => setView('join')} />
      )}
      {view === 'create' && (
        <CreateView onBack={() => setView('menu')} onCreate={handleCreate} />
      )}
      {view === 'join' && (
        <JoinView games={openGames} onBack={() => setView('menu')} onJoin={handleJoin} />
      )}
      {view === 'lobby' && lobby && (
        <LobbyView
          lobby={lobby}
          myUserId={profile?.id}
          onReady={ready => setReady(lobby.id, ready)}
          onLeave={handleLeave}
        />
      )}
      {view === 'arena' && lobby && (
        <BattleArena
          lobby={lobby}
          battleAnimation={battleAnimation}
          battleBegin={battleBegin}
          isTie={isTie}
          myUserId={profile?.id}
          onReturn={handleLeave}
          onAck={() => resultAck(lobby.id)}
          onClientReady={clientReady}
        />
      )}
    </div>
  );
}
