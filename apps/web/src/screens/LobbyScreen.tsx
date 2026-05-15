import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { SeatMap } from '../components/lobby/SeatMap.js';
import { PlayerList } from '../components/lobby/PlayerList.js';
import { RulesSummary } from '../components/lobby/RulesSummary.js';
import { ChatPanel } from '../components/lobby/ChatPanel.js';
import { useGameClient } from '../hooks/useGameClient.js';
import { setRoom, clearRoom } from '../lib/gameContext.js';
import { GameScreen } from './GameScreen.js';

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

  // When game starts, render GameScreen in-place (same room connection)
  if (state?.phase && state?.phase !== 'LOBBY' && room) {
    return <GameScreen room={room} mySessionId={room.sessionId} roomCode={roomCode ?? ''} />;
  }

  const players: any[] = state?.players ? Array.from(state.players.values()) : [];
  const chatMessages: any[] = state?.chatMessages ? Array.from(state.chatMessages) : [];
  const mySessionId = room?.sessionId;
  const currentPlayer = players.find((p: any) => p.playerId === mySessionId);
  const isHost = currentPlayer?.isHost ?? false;
  const allReady = players.length > 0 && players.every((p: any) => p.isReady);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', padding: '0.75rem', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Button variant="ghost" onClick={() => { try { room?.leave(); } catch {} clearRoom(); navigate('/'); }}>&larr; Leave</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.15em', color: 'var(--accent-warm)', fontSize: '1.125rem' }}>
            {roomCode}
          </div>
          <ThemeToggle />
        </div>
      </div>

      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.5rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0.75rem 0 1rem 0', flexShrink: 0 }}>
        Lobby
      </h1>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '0.5rem', flexShrink: 0 }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0, overflow: 'hidden' }}>
        <SeatMap players={players} myPlayerId={mySessionId} onChooseSeat={(idx) => room?.send('choose-seat', { seatIndex: idx })} />

        <div>
          <PlayerList players={players} />
        </div>

        <div>
          <RulesSummary />
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <ChatPanel
            messages={chatMessages}
            mySessionId={mySessionId ?? ''}
            onSend={(text) => room?.send('chat', { text })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, padding: '0.75rem 0 0' }}>
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
