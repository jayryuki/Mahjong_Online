import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ThemeToggle } from '@games/ui';
import { useTheme } from '../hooks/useTheme.js';
import { getTileImageUrl } from '../lib/tile-theme.js';

const PREVIEW_TILES = [
  'svg/08-characters-1',
  'svg/17-circles-1',
  'svg/26-bamboos-1',
  'svg/01-white-dragon',
];

interface RoomInfo {
  roomId: string;
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  openSlots: number;
  status: 'lobby' | 'in-progress' | 'finished';
  wallRemaining: number;
}

const ADJECTIVES = ['Swift', 'Calm', 'Bright', 'Keen', 'Bold', 'Fair', 'Warm', 'Cool', 'Wise', 'Coy'];
const NOUNS = ['Fox', 'Crane', 'Lotus', 'Tile', 'Wind', 'Moon', 'Stone', 'River', 'Pine', 'Jade'];

function randomName(): string {
  return ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + NOUNS[Math.floor(Math.random() * NOUNS.length)] + Math.floor(Math.random() * 99);
}

export function StartScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/rooms?game=mahjong')
      .then(res => res.ok ? res.json() : [])
      .then(data => setRooms(data))
      .catch(() => {});
  }, []);

  const getName = () => playerName.trim() || randomName();

  const handleCreateRoom = async () => {
    const name = getName();
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, preset: 'hong-kong', game: 'mahjong' }),
      });
      const data = await res.json();
      navigate(`/lobby/${data.roomCode}?roomId=${data.roomId}&name=${encodeURIComponent(name)}`);
    } catch {
      setError('Failed to create room');
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    const name = getName();
    try {
      const res = await fetch(`/api/rooms/${joinCode.toUpperCase()}`);
      if (!res.ok) {
        setError('Room not found');
        return;
      }
      const data = await res.json();
      if (data.game !== 'mahjong') {
        setError('That room is not a mahjong game');
        return;
      }
      navigate(`/lobby/${joinCode.toUpperCase()}?roomId=${data.roomId}&name=${encodeURIComponent(name)}`);
    } catch {
      setError('Failed to connect');
    }
  };

  const handleJoinRoom = (room: RoomInfo) => {
    const name = getName();
    navigate(`/lobby/${room.roomCode}?roomId=${room.roomId}&name=${encodeURIComponent(name)}`);
  };

  const activeRooms = rooms.filter(r => r.status !== 'finished');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem' }}>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '3rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
        Mahjong
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontStyle: 'italic', fontFamily: "'Newsreader', Georgia, serif", margin: 0 }}>
        A quiet room for a strategic game.
      </p>

      {/* Tile theme preview */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '0.25rem 0' }}>
        {PREVIEW_TILES.map(name => (
          <img
            key={name}
            src={getTileImageUrl(name, theme)}
            alt=""
            width={40}
            height={56}
            style={{ borderRadius: '4px', objectFit: 'contain', display: 'block' }}
          />
        ))}
      </div>

      {/* Your name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '360px' }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>Name</label>
        <input
          value={playerName}
          onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
          placeholder="Leave blank for a random name"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Button size="lg" onClick={handleCreateRoom}>Create Room</Button>
        <ThemeToggle />
      </div>

      {/* Join by code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '360px' }}>
        <input
          value={joinCode}
          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
          placeholder="ROOM CODE"
          maxLength={6}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            letterSpacing: '0.15em',
            textAlign: 'center',
            textTransform: 'uppercase',
            outline: 'none',
          }}
        />
        <Button size="sm" onClick={handleJoinByCode} disabled={!joinCode.trim()}>Join</Button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</div>}

      {/* Active rooms list */}
      {activeRooms.length > 0 && (
        <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Active Rooms
          </div>
          {activeRooms.map((room) => (
            <button
              key={room.roomId}
              onClick={() => handleJoinRoom(room)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'border-color 120ms, background 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-warm)'; e.currentTarget.style.background = 'var(--surface-panel-raised)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface-panel)'; }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {room.hostName || 'Unknown'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.1em' }}>
                  {room.roomCode}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                {room.status === 'in-progress' ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Wall: {room.wallRemaining}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: room.openSlots > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                    {room.openSlots > 0 ? `${room.openSlots} open slot${room.openSlots > 1 ? 's' : ''}` : 'Full'}
                  </span>
                )}
                <div style={{
                  fontSize: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  background: room.status === 'lobby' ? 'rgba(34,197,94,0.12)' : 'rgba(184,92,58,0.12)',
                  color: room.status === 'lobby' ? 'var(--success)' : 'var(--accent-warm)',
                }}>
                  {room.status === 'lobby' ? 'Lobby' : 'In Progress'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
