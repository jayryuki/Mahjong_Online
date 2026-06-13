import { useState, useCallback, useRef } from 'react';
import { colyseusClient } from '../lib/colyseus.js';

const PLAYER_KEY_STORAGE = 'mahjong_playerKey';

function getPersistentPlayerKey() {
  try {
    const existing = localStorage.getItem(PLAYER_KEY_STORAGE);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mahjong-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PLAYER_KEY_STORAGE, created);
    return created;
  } catch {
    return `mahjong-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function useGameClient(roomId: string) {
  const [room, setRoom] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<any>(null);

  const join = useCallback(async (displayName: string) => {
    try {
      const playerKey = getPersistentPlayerKey();
      const r = await colyseusClient.joinById(roomId, { displayName, playerKey });
      roomRef.current = r;
      setRoom(r);
      r.onStateChange((s: any) => {
        setState({ ...s });
      });
      r.onError((code: number, msg?: string) => setError(msg ?? 'Unknown error'));
    } catch (e: any) {
      setError(e.message || 'Failed to join room');
    }
  }, [roomId]);

  const leave = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    setRoom(null);
    setState(null);
  }, []);

  // Detach the room from this hook's lifecycle without leaving it.
  // Used when navigating from lobby to game screen so the room persists.
  const detachRoom = useCallback(() => {
    roomRef.current = null;
  }, []);

  // NOTE: We intentionally do NOT auto-leave on unmount because the room
  // reference is shared via gameContext. The room should only be left
  // explicitly when the user chooses to leave the game.

  return { room, state, error, join, leave, detachRoom };
}
