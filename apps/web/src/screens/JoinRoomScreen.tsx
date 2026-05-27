import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, ThemeToggle } from '@games/ui';

export function JoinRoomScreen() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!roomCode.trim() || !displayName.trim()) return;
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '480px' }}>
        <Button variant="ghost" onClick={() => navigate('/')}>&larr; Back</Button>
        <ThemeToggle />
      </div>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '2rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
        Join Room
      </h1>
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Room Code</label>
          <input
            value={roomCode}
            onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder="ABC123"
            maxLength={6}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              fontSize: '1.5rem',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.2em',
              textAlign: 'center',
              textTransform: 'uppercase',
              outline: 'none',
              width: '200px',
            }}
          />
        </div>
        <Input label="Your Name" placeholder="Enter your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', textAlign: 'center' }}>{error}</div>}
        <Button size="lg" onClick={handleJoin} disabled={!roomCode.trim() || !displayName.trim()} style={{ width: '100%' }}>
          Join Room
        </Button>
      </div>
    </div>
  );
}
