import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface SeatDisplay {
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  melds: Array<{ type: string; tiles: any[]; isConcealed: boolean }>;
  river: Array<{ tile: TileDef; isLastDiscard?: boolean }>;
  score: number;
}

interface CenterRiverProps {
  mySeat: number;
  seats: SeatDisplay[];
}

const RIVER_TILE_W = 40;
const RIVER_TILE_H = 56;

function renderRiverTile(tile: TileDef) {
  const props = { width: RIVER_TILE_W, height: RIVER_TILE_H };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...props} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...props} />;
  return null;
}

function RiverGrid({ entries, label }: { entries: Array<{ tile: TileDef; isLastDiscard?: boolean }>; label: string }) {
  if (entries.length === 0) {
    return <div style={{ fontSize: '0.5625rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>{label}</div>;
  }

  const cols = Math.min(6, entries.length);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${RIVER_TILE_W}px)`,
      gridTemplateRows: `repeat(${Math.ceil(entries.length / cols)}, ${RIVER_TILE_H}px)`,
      gap: '2px',
    }}>
      {entries.map((e, i) => {
        const isLast = !!e.isLastDiscard;
        return (
          <div key={e.tile.id + '-' + i} style={{
            opacity: isLast ? 1 : 0.75,
            transform: isLast ? 'scale(1.06)' : 'none',
            transition: 'transform 150ms ease',
            ...(isLast && { animation: 'tileDropIn 400ms ease-out' }),
          }}>
            {renderRiverTile(e.tile)}
          </div>
        );
      })}
    </div>
  );
}

export function CenterRiver({ mySeat, seats }: CenterRiverProps) {
  const bottomSeat = seats.find(s => s.seatIndex === mySeat);
  const rightSeat = seats.find(s => s.seatIndex === (mySeat + 1) % 4);
  const topSeat = seats.find(s => s.seatIndex === (mySeat + 2) % 4);
  const leftSeat = seats.find(s => s.seatIndex === (mySeat + 3) % 4);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      gridTemplateAreas: `
        ". top ."
        "left . right"
        ". bottom ."
      `,
      gridTemplateColumns: '1fr auto 1fr',
      gridTemplateRows: '1fr auto 1fr',
      gap: '8px',
      padding: '6px',
      placeItems: 'center',
    }}>
      <div style={{ gridArea: 'top', justifySelf: 'center' }}>
        {topSeat && <RiverGrid entries={topSeat.river} label={topSeat.displayName} />}
      </div>
      <div style={{ gridArea: 'left', alignSelf: 'center' }}>
        {leftSeat && <RiverGrid entries={leftSeat.river} label={leftSeat.displayName} />}
      </div>
      <div style={{ gridArea: 'right', alignSelf: 'center' }}>
        {rightSeat && <RiverGrid entries={rightSeat.river} label={rightSeat.displayName} />}
      </div>
      <div style={{ gridArea: 'bottom', justifySelf: 'center' }}>
        {bottomSeat && <RiverGrid entries={bottomSeat.river} label="me" />}
      </div>
    </div>
  );
}
