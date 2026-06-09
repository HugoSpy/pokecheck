import { useEffect, useMemo, useRef, useState } from 'react';
import PackRoll from '../components/PackRoll';
import { getPendingAnimation, getPendingTie } from '../socket/battleSocket';
import type { Lobby, BattleAnimationPayload, BattleBeginPayload, BattlePokemon } from '../socket/battleTypes';
import type { RollCardData } from '../api/types';
import './Battle.css';
import './OpenPack.css'; // pokeball loader + preload bar (event-pack loading screen)

interface BattleArenaProps {
  lobby: Lobby;
  battleAnimation: BattleAnimationPayload | null;
  battleBegin: BattleBeginPayload | null;
  isTie: boolean;
  myUserId: string | undefined;
  onReturn: () => void;
  onAck: () => void;
  onClientReady: (roomId: string) => void;
}

// Matches PackRoll's internal timing so we know when every roll has finished.
const ROLL_DURATION = 4000;
const REVEAL_TAIL = 1800;

async function preloadImages(urls: string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const total = urls.length;
  let loaded = 0;
  await Promise.all(
    urls.map(url => new Promise<void>((resolve) => {
      const img = new Image();
      const done = () => { loaded++; onProgress?.(loaded, total); resolve(); };
      img.onload = done;
      img.onerror = done;
      img.src = url;
    })),
  );
}

function displayNameFor(lobby: Lobby, userId: string): string {
  return lobby.players.find(p => p.userId === userId)?.displayName ?? 'Joueur';
}

export default function BattleArena({ lobby, battleAnimation, battleBegin, isTie, myUserId, onReturn, onAck, onClientReady }: BattleArenaProps) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const ackedRef = useRef(false);
  const startAtRef = useRef<number | null>(null);
  const clientReadySentRef = useRef(false);

  // The real start signal (battle:begin), emitted once every client has
  // preloaded. Until it arrives the arena stays on the loading screen. Guarded
  // by roomId so a stale begin from a prior battle is ignored.
  const begin: BattleBeginPayload | null =
    battleBegin && battleBegin.roomId === lobby.id ? battleBegin : null;

  // A tie is active if the hook says so, or a tie landed before this mounted.
  const tieActive = isTie || getPendingTie() !== null;

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

  // A new startAt means a fresh draw (e.g. the resolved roll after a tie):
  // reset the per-roll UI state so the animation re-runs exactly like the first.
  // The PackRoll instances are keyed by startAt below, so they re-mount too.
  useEffect(() => {
    if (anim && anim.startAt !== startAtRef.current) {
      startAtRef.current = anim.startAt;
      setShowOutcome(false);
      setReady(false);
      setProgress(0);
      ackedRef.current = false;
      clientReadySentRef.current = false;
    }
  }, [anim]);

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
      preloadImages(urls, (l, t) => { if (!cancelled) setProgress(l / t); }),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [anim]);

  // Once preloaded, tell the server this client is ready (once per draw). The
  // backend starts the rolls only when every client has signalled ready.
  useEffect(() => {
    if (ready && !clientReadySentRef.current) {
      clientReadySentRef.current = true;
      onClientReady(lobby.id);
    }
  }, [ready, lobby.id, onClientReady]);

  // Reveal the outcome banner once all rolls have finished, and ack the result
  // so the backend persists the BattleRecord (only the first ack writes). Timed
  // from battle:begin's startAt — the shared, real start instant.
  useEffect(() => {
    if (!begin) return;
    const doneIn = Math.max(0, begin.startAt - Date.now()) + ROLL_DURATION + REVEAL_TAIL;
    const t = setTimeout(() => {
      setShowOutcome(true);
      if (!ackedRef.current) {
        ackedRef.current = true;
        onAck();
      }
    }, doneIn + 250);
    return () => clearTimeout(t);
  }, [begin, onAck]);

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

  // Tie overlay — the server pre-resolves ties before sending the final
  // animation_start, so this shows while the client waits between draws.
  const tieOverlay = tieActive ? (
    <div className="battle-tie-overlay">
      <div className="battle-tie-card">
        <div className="battle-tie-title">Égalité !</div>
        <div className="battle-tie-sub">Nouveau tirage en cours…</div>
        <div className="battle-arena-spinner" />
      </div>
    </div>
  ) : null;

  // ── Synchronized loading screen (event-pack style) ──
  // Shown until battle:begin arrives: first while preloading sprites, then while
  // waiting for every other client to finish preloading too.
  if (!anim || !begin) {
    return (
      <div className="pack-page battle-loading-page">
        <div className="scanlines" />
        {tieOverlay}
        <div className="pack-stage">
          <div className="pokeball-wrap spinning">
            <div className="pokeball">
              <div className="pokeball-top" />
              <div className="pokeball-band" />
              <div className="pokeball-bottom" />
              <div className="pokeball-center"><div className="pokeball-button" /></div>
            </div>
            <div className="pokeball-glow" />
          </div>
          <div className="loading-label">
            {!ready ? 'Chargement des cartes…' : 'En attente des autres joueurs…'}
          </div>
          <div className="preload-bar-wrap">
            <div className="preload-bar" style={{ width: `${(ready ? 1 : progress) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const me = order[0] === myUserId ? order[0] : null;
  const others = me ? order.slice(1) : order;

  const toCards = (strip: BattlePokemon[]): RollCardData[] => strip as RollCardData[];
  const winnerOf = (uid: string) => anim.results[uid];

  return (
    <div className="battle-arena-stage">
      {tieOverlay}
      {/* Local player — big, with glow */}
      {me && (
        <div className="battle-roll-block battle-roll-block-me">
          <div className="battle-roll-label">
            {displayNameFor(lobby, me)} <span className="battle-roll-you">toi</span>
            {showOutcome && winnerId === me && <span className="battle-roll-crown">👑</span>}
          </div>
          <div className="battle-roll-cell full">
            <PackRoll
              key={`me-${begin.startAt}`}
              strip={toCards(anim.strips[me])}
              winner={winnerOf(me)}
              startAt={begin.startAt}
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
                  key={`${uid}-${begin.startAt}`}
                  strip={toCards(anim.strips[uid])}
                  winner={winnerOf(uid)}
                  startAt={begin.startAt}
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
          <div className="battle-outcome-prize">
            {winnerId === myUserId
              ? `Tu remportes les ${order.length} Pokémon !`
              : `Remporte les ${order.length} Pokémon`}
          </div>
          <button className="btn btn-primary" onClick={onReturn}>
            Retour au lobby
          </button>
        </div>
      )}
    </div>
  );
}
