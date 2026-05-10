import { useState, useEffect, useCallback } from 'react';
import { colyseusClient } from '../lib/colyseus.js';

export function useGameClient(roomCode: string) {
  const [room, setRoom] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (displayName: string) => {
    try {
      const r = await colyseusClient.joinById(roomCode, { displayName });
      setRoom(r);
      r.onStateChange((s: any) => setState({ ...s }));
      r.onError((code: number, msg?: string) => setError(msg ?? 'Unknown error'));
    } catch (e: any) {
      setError(e.message || 'Failed to join room');
    }
  }, [roomCode]);

  const leave = useCallback(() => {
    room?.leave();
    setRoom(null);
    setState(null);
  }, [room]);

  useEffect(() => {
    return () => { room?.leave(); };
  }, [room]);

  return { room, state, error, join, leave };
}
