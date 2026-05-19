
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
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
      {seats.map((idx) => {
        const player = getPlayerAtSeat(idx);
        const isOccupied = !!player;
        const isMe = player?.playerId === myPlayerId;

        return (
          <button
            key={idx}
            onClick={() => !isOccupied && onChooseSeat?.(idx)}
            style={{
              flex: 1,
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              border: isOccupied ? `2px solid ${seatColors[idx]}` : '2px dashed var(--border-subtle)',
              background: isOccupied ? 'var(--surface-panel-raised)' : 'var(--surface-panel)',
              cursor: isOccupied ? 'default' : 'pointer',
              textAlign: 'center',
              transition: 'all 120ms ease',
              opacity: isOccupied && !isMe ? 0.8 : 1,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: seatColors[idx], fontWeight: 600, marginBottom: '0.125rem' }}>
              {seatLabels[idx]}
            </div>
            {isOccupied ? (
              <>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.displayName}</div>
                {player.isReady && <div style={{ fontSize: '0.625rem', color: 'var(--success)' }}>Ready</div>}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Empty</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
