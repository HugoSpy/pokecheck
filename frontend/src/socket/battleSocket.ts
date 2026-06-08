import { io, Socket } from 'socket.io-client';
import { DEV_TOKEN_STORAGE_KEY } from '../api/client';
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

export function getBattleSocket(): Socket {
  if (!socket) {
    // [DEV ONLY - NEVER MERGE] forward the test-account JWT (stored per-tab in
    // sessionStorage, see Login.tsx loginAsTest) so the socket auth middleware
    // can authenticate this tab even though it shares the browser's session
    // cookie with other tabs logged in as different test accounts.
    const token = sessionStorage.getItem(DEV_TOKEN_STORAGE_KEY);

    socket = io(API_URL, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: token ? { token } : {},
    });

    // Capture the animation payload at module scope the moment it arrives,
    // independent of which component is currently mounted.
    socket.on('battle:animation_start', (payload: BattleAnimationPayload) => {
      _pendingAnimation = payload;
    });
  }
  return socket;
}
