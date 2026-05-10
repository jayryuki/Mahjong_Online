import { useState, useEffect, useCallback, useRef } from 'react';
import { colyseusClient } from '../lib/colyseus.js';

export function useGameClient(roomId: string) {
  const [room, setRoom] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<any>(null);

  const join = useCallback(async (displayName: string) => {
    try {
      const r = await colyseusClient.joinById(roomId, { displayName });
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

  useEffect(() => {
    return () => {
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, []);

  return { room, state, error, join, leave };
}
