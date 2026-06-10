
import { useState } from 'react';

interface PlayerListProps {
  players: Array<{ playerId?: string; displayName: string; isConnected: boolean; isReady: boolean }>;
  myPlayerId?: string;
  onChangeName?: (name: string) => void;
}

export function PlayerList({ players, myPlayerId, onChangeName }: PlayerListProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {players.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.isConnected ? 'var(--success)' : 'var(--text-muted)' }} />
          {p.playerId === myPlayerId ? (
            editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => {
                  const trimmed = nameInput.trim().slice(0, 20);
                  if (trimmed && trimmed !== p.displayName) {
                    onChangeName?.(trimmed);
                    try { localStorage.setItem('mahjong_displayName', trimmed); } catch {}
                  }
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'var(--surface-panel-raised)',
                  border: '1px solid var(--accent-warm)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.5rem',
                  outline: 'none',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setNameInput(p.displayName); setEditingName(true); }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  padding: '0.2rem 0',
                  cursor: 'pointer',
                }}
                title="Click to change name"
              >
                {p.displayName} ✎
              </button>
            )
          ) : (
            <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</span>
          )}
          {p.isReady && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>Ready</span>}
        </div>
      ))}
    </div>
  );
}
