import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@games/ui';
import { GameShell } from '../components/layout/GameShell.js';

const LS_NAME_KEY = 'mahjong_displayName';

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(() => { try { return localStorage.getItem(LS_NAME_KEY) || ''; } catch { return ''; } });
  const [selectedPreset, setSelectedPreset] = useState('hong-kong');

  const presets = [
    { id: 'hong-kong', name: 'Hong Kong', description: 'Traditional Cantonese style — self-draw only with wild cards', active: true },
  ];

  const handleCreate = async () => {
    if (!displayName.trim()) return;
    try { localStorage.setItem(LS_NAME_KEY, displayName.trim()); } catch {}
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, preset: selectedPreset, game: 'mahjong' }),
      });
      const data = await res.json();
      navigate(`/lobby/${data.roomCode}?roomId=${data.roomId}&name=${encodeURIComponent(displayName)}`);
    } catch {}
  };

  return (
    <GameShell
      gameName="Mahjong Online"
      title="Create Room"
      subtitle="Set up a room with a compact layout and variant card that still breathes on smaller screens."
      onBack={() => navigate('/')}
    >
      <div className="game-form-grid">
        <div className="game-field game-field--full">
          <Input label="Your Name" placeholder="Enter your name" value={displayName} onChange={(e) => { setDisplayName(e.target.value); try { localStorage.setItem(LS_NAME_KEY, e.target.value); } catch {} }} />
        </div>
        <div className="game-field game-field--full">
          <label className="game-field__label">Game Variant</label>
          <div className="preset-list">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => p.active && setSelectedPreset(p.id)}
                className={`preset-card ${selectedPreset === p.id ? 'is-selected' : ''}`}
                disabled={!p.active}
              >
                <div className="preset-card__name">{p.name}</div>
                <div className="preset-card__description">{p.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="game-shell__actions">
        <Button size="lg" onClick={handleCreate} disabled={!displayName.trim()} style={{ width: '100%' }}>
          Create Room
        </Button>
      </div>
    </GameShell>
  );
}
