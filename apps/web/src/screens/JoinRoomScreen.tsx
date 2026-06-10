import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@games/ui';
import { GameShell } from '../components/layout/GameShell.js';

const LS_NAME_KEY = 'mahjong_displayName';

export function JoinRoomScreen() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState(() => { try { return localStorage.getItem(LS_NAME_KEY) || ''; } catch { return ''; } });
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!roomCode.trim() || !displayName.trim()) return;
    try { localStorage.setItem(LS_NAME_KEY, displayName.trim()); } catch {}
    try {
      const res = await fetch(`/api/rooms/${roomCode.toUpperCase()}`);
      if (!res.ok) {
        setError('Room not found');
        return;
      }
      const roomData = await res.json();
      if (roomData.game !== 'mahjong') {
        setError('That room is not a mahjong game');
        return;
      }
      navigate(`/lobby/${roomCode.toUpperCase()}?roomId=${roomData.roomId}&name=${encodeURIComponent(displayName)}`);
    } catch {
      setError('Failed to connect');
    }
  };

  return (
    <GameShell
      gameName="Mahjong Online"
      title="Join Room"
      subtitle="Enter the room code, keep the typography readable, and get into the table fast from any device."
      onBack={() => navigate('/')}
    >
      <div className="game-form-grid">
        <div className="game-field game-field--code game-field--full">
          <label className="game-field__label">Room Code</label>
          <input
            className="game-code-input game-code-input--large"
            value={roomCode}
            onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder="ABC123"
            maxLength={6}
          />
        </div>
        <div className="game-field game-field--full">
          <Input label="Your Name" placeholder="Enter your name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); try { localStorage.setItem(LS_NAME_KEY, e.target.value); } catch {} }} />
        </div>
      </div>
      {error && <div className="game-error">{error}</div>}
      <div className="game-shell__actions">
        <Button size="lg" onClick={handleJoin} disabled={!roomCode.trim() || !displayName.trim()} style={{ width: '100%' }}>
          Join Room
        </Button>
      </div>
    </GameShell>
  );
}
