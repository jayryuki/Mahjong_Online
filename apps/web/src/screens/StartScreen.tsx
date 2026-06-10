import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@games/ui';
import { GameShell } from '../components/layout/GameShell.js';
import { useTheme } from '../hooks/useTheme.js';

const LS_NAME_KEY = 'mahjong_displayName';
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
  const [playerName, setPlayerName] = useState(() => { try { return localStorage.getItem(LS_NAME_KEY) || ''; } catch { return ''; } });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/rooms?game=mahjong')
      .then(res => res.ok ? res.json() : [])
      .then(data => setRooms(data))
      .catch(() => {});
  }, []);

  const getName = () => {
    const name = playerName.trim() || randomName();
    try { localStorage.setItem(LS_NAME_KEY, name); } catch {}
    return name;
  };

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
    <GameShell
      gameName="Mahjong Online"
      title="Mahjong"
      subtitle="A calmer tabletop layout with room cards and controls that adapt smoothly from phone to desktop."
      preview={
        <div className="mj-hero-preview" aria-hidden="true">
          {PREVIEW_TILES.map(name => (
            <img key={name} src={getTileImageUrl(name, theme)} alt="" width={48} height={67} style={{ borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
          ))}
        </div>
      }
      actions={
        <>
          <Button size="lg" onClick={handleCreateRoom} style={{ flex: 1 }}>Create Room</Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/join')} style={{ flex: 1 }}>Join by Code</Button>
        </>
      }
    >
      <div className="game-form-grid">
        <div className="game-field game-field--full">
          <Input
            label="Player Name"
            placeholder="Leave blank for a random name"
            value={playerName}
            onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
          />
        </div>
        <div className="game-field game-field--code">
          <label className="game-field__label">Room Code</label>
          <input
            className="game-code-input"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder="ABC123"
            maxLength={6}
          />
        </div>
        <Button size="lg" variant="ghost" onClick={handleJoinByCode} disabled={!joinCode.trim()} style={{ minHeight: '3.25rem' }}>
          Join Room
        </Button>
      </div>

      {error && <div className="game-error">{error}</div>}

      {activeRooms.length > 0 && (
        <div className="game-room-list">
          <div className="game-room-list__title">Active Rooms</div>
          <div className="game-room-list__items">
            {activeRooms.map((room) => (
              <button key={room.roomId} onClick={() => handleJoinRoom(room)} className="game-room-item">
                <div className="game-room-item__main">
                  <div className="game-room-item__name">{room.hostName || 'Unknown host'}</div>
                  <div className="game-room-item__code">{room.roomCode}</div>
                </div>
                <div className="game-room-item__meta">
                  {room.status === 'in-progress' ? (
                    <span className="game-room-item__slots">Wall: {room.wallRemaining}</span>
                  ) : (
                    <span className={room.openSlots > 0 ? 'game-room-item__slots game-room-item__slots--open' : 'game-room-item__slots'}>
                      {room.openSlots > 0 ? `${room.openSlots} open slot${room.openSlots > 1 ? 's' : ''}` : 'Full'}
                    </span>
                  )}
                  <span className={`game-room-item__badge ${room.status === 'lobby' ? 'is-lobby' : 'is-live'}`}>
                    {room.status === 'lobby' ? 'Lobby' : 'In Progress'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </GameShell>
  );
}
