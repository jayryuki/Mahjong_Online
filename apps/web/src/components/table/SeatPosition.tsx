import React from 'react';
import { TileBack } from '@mahjong/ui';
import { RiverArea } from './RiverArea.js';
import { MeldArea } from './MeldArea.js';
import { TileDef } from '@mahjong/game-core';

interface MeldDisplay {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
}

interface SeatPositionProps {
  position: 'bottom' | 'right' | 'top' | 'left';
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  score: number;
  isMe: boolean;
  river: RiverEntry[];
  melds: MeldDisplay[];
}

const SEAT_WIND_LABELS = ['East', 'South', 'West', 'North'];

export function SeatPosition({ position, seatIndex, displayName, tileCount, isDealer, isActive, isRiichi, score, isMe, river, melds }: SeatPositionProps) {
  const isVertical = position === 'left' || position === 'right';

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { position: 'absolute', top: '0.5rem', left: '50%', transform: 'translateX(-50%)' },
    bottom: { position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)' },
    left: { position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)' },
    right: { position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' },
  };

  const tileBackWidth = 20;
  const tileBackHeight = 28;

  return (
    <div style={{
      ...positionStyles[position],
      display: 'flex',
      flexDirection: isVertical ? 'row' : 'column',
      alignItems: 'center',
      gap: '0.375rem',
      zIndex: 2,
    }}>
      <div style={{
        padding: '0.375rem 0.75rem',
        borderRadius: '8px',
        background: 'var(--surface-panel)',
        border: isActive ? '2px solid var(--seat-active-ring)' : '1px solid var(--border-subtle)',
        transition: 'border-color 200ms ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {SEAT_WIND_LABELS[seatIndex]} {isDealer && '(D)'}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: isActive ? 'var(--accent-warm)' : 'var(--text-primary)' }}>
            {displayName}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{score}</div>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {isRiichi && <span style={{ fontSize: '0.5625rem', color: 'var(--accent-warm)', fontWeight: 600 }}>RIICHI</span>}
            {!isMe && <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>{tileCount} tiles</span>}
          </div>
        </div>
      </div>

      {!isMe && tileCount > 0 && (
        <div style={{ display: 'flex', gap: '0.5px', flexShrink: 0, flexWrap: 'nowrap' }}>
          {Array.from({ length: Math.min(tileCount, 13) }).map((_, i) => (
            <TileBack key={i} width={tileBackWidth} height={tileBackHeight} />
          ))}
        </div>
      )}

      {melds.length > 0 && <MeldArea melds={melds} />}
      {river.length > 0 && <RiverArea entries={river} />}
    </div>
  );
}
