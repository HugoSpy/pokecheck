import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getBattleSocket,
  getPendingAnimation,
  clearPendingAnimation,
  getPendingTie,
  clearPendingTie,
  getPendingBegin,
  clearPendingBegin,
} from '../socket/battleSocket';
import type {
  BattleAck,
  BattleAnimationPayload,
  BattleBeginPayload,
  BattleErrorPayload,
  BattleListItem,
  CreateBattlePayload,
  Lobby,
} from '../socket/battleTypes';

export function useBattle() {
  const socketRef = useRef(getBattleSocket());
  const [connected, setConnected] = useState(false);
  const [openGames, setOpenGames] = useState<BattleListItem[]>([]);
  const [lobby, setLobbyState] = useState<Lobby | null>(null);
  const [battleAnimation, setBattleAnimation] = useState<BattleAnimationPayload | null>(null);
  const [battleBegin, setBattleBegin] = useState<BattleBeginPayload | null>(getPendingBegin());
  const [battleError, setBattleError] = useState<string | null>(null);
  const [isTie, setIsTie] = useState<boolean>(getPendingTie() !== null);
  const lobbyIdRef = useRef<string | null>(null);

  const setLobby = useCallback((next: Lobby | null) => {
    lobbyIdRef.current = next?.id ?? null;
    setLobbyState(next);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;

    function handleConnect() { setConnected(true); }
    function handleDisconnect() { setConnected(false); }
    function handleList(list: BattleListItem[]) { setOpenGames(list); }
    function handleLobby(next: Lobby) {
      if (lobbyIdRef.current === next.id) setLobby(next);
    }
    function handleAnimationStart(payload: BattleAnimationPayload) {
      // The authoritative copy is already in the module store (battleSocket.ts);
      // mirror it into React state so the arena re-renders. The resolved draw
      // ends any tie state.
      if (lobbyIdRef.current === payload.roomId) {
        setBattleError(null);
        setIsTie(false);
        setBattleBegin(null); // a fresh draw clears the previous begin
        setBattleAnimation(getPendingAnimation() ?? payload);
      }
    }
    function handleBegin(payload: BattleBeginPayload) {
      if (lobbyIdRef.current === payload.roomId) setBattleBegin(payload);
    }
    function handleTie() {
      // battle:tie isn't roomId-scoped, but ties only fire for the room this
      // client is mid-launch in, so trust it while we have a lobby.
      if (lobbyIdRef.current) setIsTie(true);
    }
    function handleError(payload: BattleErrorPayload) {
      if (lobbyIdRef.current === payload.roomId) {
        setBattleAnimation(null);
        setBattleError(payload.message);
      }
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('battle:list', handleList);
    socket.on('battle:lobby', handleLobby);
    socket.on('battle:animation_start', handleAnimationStart);
    socket.on('battle:begin', handleBegin);
    socket.on('battle:tie', handleTie);
    socket.on('battle:error', handleError);

    if (!socket.connected) socket.connect();
    else setConnected(true);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('battle:list', handleList);
      socket.off('battle:lobby', handleLobby);
      socket.off('battle:animation_start', handleAnimationStart);
      socket.off('battle:begin', handleBegin);
      socket.off('battle:tie', handleTie);
      socket.off('battle:error', handleError);
    };
  }, []);

  const browse = useCallback(() => {
    socketRef.current.emit('battle:browse');
  }, []);

  const unbrowse = useCallback(() => {
    socketRef.current.emit('battle:unbrowse');
    setOpenGames([]);
  }, []);

  const create = useCallback((payload: CreateBattlePayload): Promise<BattleAck> => {
    return new Promise(resolve => {
      socketRef.current.emit('battle:create', payload, (res: BattleAck) => {
        if (res.ok) setLobby(res.room);
        resolve(res);
      });
    });
  }, []);

  const join = useCallback((roomId: string): Promise<BattleAck> => {
    return new Promise(resolve => {
      socketRef.current.emit('battle:join', { roomId }, (res: BattleAck) => {
        if (res.ok) setLobby(res.room);
        resolve(res);
      });
    });
  }, []);

  const setReady = useCallback((roomId: string, ready: boolean) => {
    socketRef.current.emit('battle:ready', { roomId, ready });
  }, []);

  const leave = useCallback((roomId: string) => {
    socketRef.current.emit('battle:leave', { roomId });
    setLobby(null);
    setBattleAnimation(null);
    setBattleBegin(null);
    setBattleError(null);
    setIsTie(false);
    clearPendingAnimation();
    clearPendingTie();
    clearPendingBegin();
  }, [setLobby]);

  // Phase 2.1 - the arena calls this once its strip sprites are preloaded; the
  // backend starts the rolls only when every client has signalled ready.
  const clientReady = useCallback((roomId: string) => {
    socketRef.current.emit('battle:client_ready', { roomId });
  }, []);

  // Phase 2 - fired by the arena once a player's animation finishes; the backend
  // persists the BattleRecord on the first ack it receives.
  const resultAck = useCallback((roomId: string) => {
    socketRef.current.emit('battle:result_ack', { roomId });
  }, []);

  const clearBattleError = useCallback(() => setBattleError(null), []);

  return {
    connected, openGames, lobby, battleAnimation, battleBegin, battleError, isTie,
    browse, unbrowse, create, join, setReady, leave, resultAck, clientReady, clearBattleError,
  };
}
