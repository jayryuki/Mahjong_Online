import React from 'react';

interface SeatMapProps {
  players: Array<{ playerId: string; displayName: string; seatIndex: number; isReady: boolean; isHost: boolean }>;
  myPlayerId?: string;
  onChooseSeat?: (seatIndex: number) => void;
}

export function SeatMap({ players, myPlayerId, onChooseSeat }: SeatMapProps) {
  const seats = [0, 1, 2, 3];
  const seatLabels = ['East', 'South', 'West', 'North'];
  const seatColors = ['var(--accent-warm)', 'var(--success)', '#6b8abd', 'var(--warm-accent-dim)'];

  const getPlayerAtSeat = (idx: number) => players.find(p => p.seatIndex === idx);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: '400px', margin: '0 auto' }}>
      {seats.map((idx) => {
        const player = getPlayerAtSeat(idx);
        const isOccupied = !!player;
        const isMe = player?.playerId === myPlayerId;

        return (
          <button
            key={idx}
            onClick={() => !isOccupied && onChooseSeat?.(idx)}
            style={{
              padding: '1rem',
              borderRadius: '12px',
              border: isOccupied ? `2px solid ${seatColors[idx]}` : '2px dashed var(--border-subtle)',
              background: isOccupied ? 'var(--surface-panel-raised)' : 'var(--surface-panel)',
              cursor: isOccupied ? 'default' : 'pointer',
              textAlign: 'center',
              transition: 'all 120ms ease',
              opacity: isOccupied && !isMe ? 0.8 : 1,
            }}
          >
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: seatColors[idx], fontWeight: 600, marginBottom: '0.25rem' }}>
              {seatLabels[idx]}
            </div>
            {isOccupied ? (
              <>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{player.displayName}</div>
                {player.isReady && <div style={{ fontSize: '0.6875rem', color: 'var(--success)' }}>Ready</div>}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Empty</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
