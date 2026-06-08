import { useEffect, useMemo, useRef, useState } from 'react';
import PackRoll from '../components/PackRoll';
import { getPendingAnimation } from '../socket/battleSocket';
import type { Lobby, BattleAnimationPayload, BattlePokemon } from '../socket/battleTypes';
import type { RollCardData } from '../api/types';
import './Battle.css';

interface BattleArenaProps {
  lobby: Lobby;
  battleAnimation: BattleAnimationPayload | null;
  myUserId: string | undefined;
  onReturn: () => void;
  onAck: () => void;
}

// Matches PackRoll's internal timing so we know when every roll has finished.
const ROLL_DURATION = 4000;
const REVEAL_TAIL = 1800;

async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(url => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    })),
  );
}

function displayNameFor(lobby: Lobby, userId: string): string {
  return lobby.players.find(p => p.userId === userId)?.displayName ?? 'Joueur';
}

export default function BattleArena({ lobby, battleAnimation, myUserId, onReturn, onAck }: BattleArenaProps) {
  const [ready, setReady] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const ackedRef = useRef(false);

  // Fall back to the module-level store if the prop hasn't propagated yet — the
  // arena can mount in the same tick the event arrives, before useBattle's React
  // state updates. Guard by roomId so a stale payload from a prior battle is
  // never used. startAt still keeps every client's animation in sync.
  const pending = getPendingAnimation();
  const anim: BattleAnimationPayload | null =
    battleAnimation && battleAnimation.roomId === lobby.id
      ? battleAnimation
      : pending && pending.roomId === lobby.id
        ? pending
        : null;

  // Order players: me first (rendered big), everyone else after (rendered mini).
  const order = useMemo(() => {
    if (!anim) return [];
    const ids = Object.keys(anim.strips);
    return ids.sort((a, b) => {
      if (a === myUserId) return -1;
      if (b === myUserId) return 1;
      return 0;
    });
  }, [anim, myUserId]);

  // Preload every sprite of every strip before arming the animation, so no card
  // pops in mid-roll. Falls back after 8s if some sprites are slow.
  useEffect(() => {
    if (!anim) return;
    let cancelled = false;
    const urls = Object.values(anim.strips).flat().map(c => c.sprite_url);
    Promise.race([
      preloadImages(urls),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [anim]);

  // Reveal the outcome banner once all rolls have finished, and ack the result
  // so the backend persists the BattleRecord (only the first ack writes).
  useEffect(() => {
    if (!anim || !ready) return;
    const doneIn = Math.max(0, anim.startAt - Date.now()) + ROLL_DURATION + REVEAL_TAIL;
    const t = setTimeout(() => {
      setShowOutcome(true);
      if (!ackedRef.current) {
        ackedRef.current = true;
        onAck();
      }
    }, doneIn + 250);
    return () => clearTimeout(t);
  }, [anim, ready, onAck]);

  // Winner = highest-points result. Ties resolve to the first in player order.
  const winnerId = useMemo(() => {
    if (!anim) return null;
    let best = -Infinity;
    let id: string | null = null;
    for (const [uid, poke] of Object.entries(anim.results)) {
      if (poke.points > best) { best = poke.points; id = uid; }
    }
    return id;
  }, [anim]);

  // ── Waiting for the draw / sprite preload ──
  if (!anim || !ready) {
    return (
      <div className="battle-arena">
        <div className="battle-arena-spinner" />
        <h1 className="battle-arena-title">La battle va commencer…</h1>
        <p className="battle-arena-pack">{lobby.packName}</p>
      </div>
    );
  }

  const me = order[0] === myUserId ? order[0] : null;
  const others = me ? order.slice(1) : order;

  const toCards = (strip: BattlePokemon[]): RollCardData[] => strip as RollCardData[];
  const winnerOf = (uid: string) => anim.results[uid];

  return (
    <div className="battle-arena-stage">
      {/* Local player — big, with glow */}
      {me && (
        <div className="battle-roll-block battle-roll-block-me">
          <div className="battle-roll-label">
            {displayNameFor(lobby, me)} <span className="battle-roll-you">toi</span>
            {showOutcome && winnerId === me && <span className="battle-roll-crown">👑</span>}
          </div>
          <div className="battle-roll-cell full">
            <PackRoll
              strip={toCards(anim.strips[me])}
              winner={winnerOf(me)}
              startAt={anim.startAt}
              flash
              onDone={() => { /* outcome handled centrally */ }}
            />
          </div>
        </div>
      )}

      {/* Other players — smaller, side by side, glow attenuated via CSS */}
      {others.length > 0 && (
        <div className="battle-roll-others">
          {others.map(uid => (
            <div key={uid} className="battle-roll-block">
              <div className="battle-roll-label">
                {displayNameFor(lobby, uid)}
                {showOutcome && winnerId === uid && <span className="battle-roll-crown">👑</span>}
              </div>
              <div className="battle-roll-cell mini">
                <PackRoll
                  strip={toCards(anim.strips[uid])}
                  winner={winnerOf(uid)}
                  startAt={anim.startAt}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outcome banner + return */}
      {showOutcome && winnerId && (
        <div className="battle-outcome">
          <div className="battle-outcome-title">
            {winnerId === myUserId
              ? '🏆 Tu remportes la battle !'
              : `🏆 ${displayNameFor(lobby, winnerId)} remporte la battle !`}
          </div>
          <div className="battle-outcome-sub">
            {winnerOf(winnerId).name} · {winnerOf(winnerId).points} pts
          </div>
          <button className="btn btn-primary" onClick={onReturn}>
            Retour au lobby
          </button>
        </div>
      )}
    </div>
  );
}
