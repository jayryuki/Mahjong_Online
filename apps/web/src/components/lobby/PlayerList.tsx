
interface PlayerListProps {
  players: Array<{ displayName: string; isConnected: boolean; isReady: boolean }>;
}

export function PlayerList({ players }: PlayerListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {players.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.isConnected ? 'var(--success)' : 'var(--text-muted)' }} />
          <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{p.displayName}</span>
          {p.isReady && <span style={{ fontSize: '0.6875rem', color: 'var(--success)', fontWeight: 500 }}>Ready</span>}
        </div>
      ))}
    </div>
  );
}
