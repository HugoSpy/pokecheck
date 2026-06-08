import { io, Socket } from 'socket.io-client';
import type { BattleAnimationPayload } from './battleTypes';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

// battle:animation_start can land before the React tree has swapped to the arena
// view (the switch is driven by the battle:lobby status change, which may arrive
// in the same tick). Holding the payload at module scope — next to the socket
// singleton — means a re-mount or navigation can't drop it: useBattle seeds from
// here and BattleArena reads it directly on mount. startAt keeps everyone synced.
let _pendingAnimation: BattleAnimationPayload | null = null;

export function getPendingAnimation(): BattleAnimationPayload | null {
  return _pendingAnimation;
}

export function clearPendingAnimation(): void {
  _pendingAnimation = null;
}

// Same module-scope durability for tie notifications: a battle:tie may arrive
// while the arena is between renders. Holds the latest tie until the next
// battle:animation_start (the resolved, non-tied draw) supersedes it.
let _pendingTie: { attempt: number } | null = null;

export function getPendingTie(): { attempt: number } | null {
  return _pendingTie;
}

export function clearPendingTie(): void {
  _pendingTie = null;
}

export function getBattleSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });

    // Capture the animation payload at module scope the moment it arrives,
    // independent of which component is currently mounted. A resolved draw also
    // clears any pending tie — the tie is over once the real animation starts.
    socket.on('battle:animation_start', (payload: BattleAnimationPayload) => {
      _pendingAnimation = payload;
      _pendingTie = null;
    });

    socket.on('battle:tie', (payload: { attempt: number }) => {
      _pendingTie = payload;
    });
  }
  return socket;
}
