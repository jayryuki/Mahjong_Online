import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button, ThemeToggle } from '@games/ui';
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
  const { room, state, error, join } = useGameClient(roomId);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (roomId && displayName && !joinedRef.current) {
      joinedRef.current = true;
      join(displayName);
    }
  }, [roomId, displayName, join]);

  useEffect(() => {
    if (room) {
      setRoom(room, room.sessionId);
    }
  }, [room]);

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
    <div className="lobby-shell mj-lobby-shell">
      <div className="lobby-shell__topbar">
        <Button variant="ghost" onClick={() => { try { room?.leave(); } catch {} clearRoom(); navigate('/'); }}>
          ← Leave
        </Button>
        <div className="lobby-shell__code-group">
          <div className="lobby-shell__code">{roomCode}</div>
          <ThemeToggle />
        </div>
      </div>

      <div className="lobby-shell__hero">
        <div>
          <div className="lobby-shell__eyebrow">Mahjong Online</div>
          <h1 className="lobby-shell__title">Lobby</h1>
          <p className="lobby-shell__subtitle">Seat selection, rules, and table chat now share one responsive surface instead of fighting for space.</p>
        </div>
      </div>

      {error && <div className="game-error">{error}</div>}

      <div className="lobby-grid">
        <section className="lobby-panel lobby-panel--wide">
          <div className="lobby-panel__title">Seats</div>
          <SeatMap players={players} myPlayerId={mySessionId} onChooseSeat={(idx) => room?.send('choose-seat', { seatIndex: idx })} />
        </section>

        <section className="lobby-panel">
          <div className="lobby-panel__title">Players</div>
          <PlayerList players={players} myPlayerId={mySessionId} onChangeName={(name) => { try { localStorage.setItem('mahjong_displayName', name); } catch {} room?.send('change-name', { displayName: name }); }} />
        </section>

        <section className="lobby-panel">
          <div className="lobby-panel__title">Rules</div>
          <RulesSummary />
        </section>

        <section className="lobby-panel lobby-panel--chat">
          <div className="lobby-panel__title">Table Chat</div>
          <div className="lobby-panel__body lobby-panel__body--fill">
            <ChatPanel messages={chatMessages} mySessionId={mySessionId ?? ''} onSend={(text) => room?.send('chat', { text })} />
          </div>
        </section>
      </div>

      <div className="lobby-shell__actions">
        <Button variant="secondary" onClick={() => room?.send('toggle-ready')} style={{ flex: 1 }}>
          {currentPlayer?.isReady ? 'Unready' : 'Ready Up'}
        </Button>
        {isHost && (
          <Button onClick={() => room?.send('start-match')} disabled={!allReady} style={{ flex: 1 }}>
            Start Match
          </Button>
        )}
      </div>
    </div>
  );
}
