import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { SeatMap } from '../components/lobby/SeatMap.js';
import { PlayerList } from '../components/lobby/PlayerList.js';
import { RulesSummary } from '../components/lobby/RulesSummary.js';
import { useGameClient } from '../hooks/useGameClient.js';
import { setRoom } from '../lib/gameContext.js';

export function LobbyScreen() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const displayName = searchParams.get('name') || '';
  const roomId = searchParams.get('roomId') || '';
  const { room, state, error, join, detachRoom } = useGameClient(roomId);
  const joinedRef = useRef(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (roomId && displayName && !joinedRef.current) {
      joinedRef.current = true;
      join(displayName);
    }
  }, [roomId, displayName, join]);

  // Store room reference in shared context whenever room changes
  useEffect(() => {
    if (room) {
      setRoom(room, room.sessionId);
    }
  }, [room]);

  // Navigate to game screen when phase changes from LOBBY
  useEffect(() => {
    if (state?.phase && state.phase !== 'LOBBY' && !navigatedRef.current) {
      navigatedRef.current = true;
      // Detach room from hook lifecycle so it persists across navigation
      detachRoom();
      navigate(`/game/${roomCode}`);
    }
  }, [state?.phase, roomCode, navigate, detachRoom]);

  const players: any[] = state?.players ? Array.from(state.players.values()) : [];
  const mySessionId = room?.sessionId;
  const currentPlayer = players.find((p: any) => p.playerId === mySessionId);
  const isHost = currentPlayer?.isHost ?? false;
  const allReady = players.length > 0 && players.every((p: any) => p.isReady);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Button variant="ghost" onClick={() => navigate('/')}>&larr; Leave</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent-warm)', fontSize: '1.125rem' }}>
            {roomCode}
          </div>
          <ThemeToggle />
        </div>
      </div>

      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.5rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 1.5rem 0' }}>
        Lobby
      </h1>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

      <SeatMap players={players} myPlayerId={mySessionId} onChooseSeat={(idx) => room?.send('choose-seat', { seatIndex: idx })} />

      <div style={{ marginTop: '1.5rem' }}>
        <PlayerList players={players} />
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <RulesSummary />
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
        <Button
          variant="secondary"
          onClick={() => room?.send('toggle-ready')}
          style={{ flex: 1 }}
        >
          Toggle Ready
        </Button>
        {isHost && (
          <Button
            onClick={() => room?.send('start-match')}
            disabled={!allReady}
            style={{ flex: 1 }}
          >
            Start Match
          </Button>
        )}
      </div>
    </div>
  );
}
