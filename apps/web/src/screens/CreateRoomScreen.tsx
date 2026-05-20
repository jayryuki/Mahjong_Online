import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('hong-kong');

  const presets = [
    { id: 'hong-kong', name: 'Hong Kong', description: 'Traditional Cantonese style — self-draw only with wild cards', active: true },
  ];

  const handleCreate = async () => {
    if (!displayName.trim()) return;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, preset: selectedPreset, game: 'mahjong' }),
      });
      const data = await res.json();
      navigate(`/lobby/${data.roomCode}?roomId=${data.roomId}&name=${encodeURIComponent(displayName)}`);
    } catch {
      // Error handling for Phase 2
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '480px' }}>
        <Button variant="ghost" onClick={() => navigate('/')}>&larr; Back</Button>
        <ThemeToggle />
      </div>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '2rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
        Create Room
      </h1>
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Input label="Your Name" placeholder="Enter your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Game Variant</span>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => p.active && setSelectedPreset(p.id)}
              style={{
                padding: '1rem',
                borderRadius: '8px',
                border: selectedPreset === p.id ? '2px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
                background: selectedPreset === p.id ? 'var(--surface-panel-raised)' : 'var(--surface-panel)',
                cursor: p.active ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                opacity: p.active ? 1 : 0.5,
              }}
            >
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{p.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{p.description}</div>
            </button>
          ))}
        </div>
        <Button size="lg" onClick={handleCreate} disabled={!displayName.trim()} style={{ width: '100%' }}>
          Create Room
        </Button>
      </div>
    </div>
  );
}
