import { useCallback, useEffect, useRef, useState } from 'react';
import { getBattleSocket } from '../socket/battleSocket';
import type { BattleAck, BattleListItem, CreateBattlePayload, Lobby } from '../socket/battleTypes';

export function useBattle() {
  const socketRef = useRef(getBattleSocket());
  const [connected, setConnected] = useState(false);
  const [openGames, setOpenGames] = useState<BattleListItem[]>([]);
  const [lobby, setLobbyState] = useState<Lobby | null>(null);
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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('battle:list', handleList);
    socket.on('battle:lobby', handleLobby);

    if (!socket.connected) socket.connect();
    else setConnected(true);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('battle:list', handleList);
      socket.off('battle:lobby', handleLobby);
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
  }, []);

  return { connected, openGames, lobby, browse, unbrowse, create, join, setReady, leave };
}
