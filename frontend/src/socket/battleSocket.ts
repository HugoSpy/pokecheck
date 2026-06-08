import { io, Socket } from 'socket.io-client';
import { DEV_TOKEN_STORAGE_KEY } from '../api/client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

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
  }
  return socket;
}
