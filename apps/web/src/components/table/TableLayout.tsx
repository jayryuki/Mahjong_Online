import React from 'react';
import { SeatPosition } from './SeatPosition.js';
import { InfoBar } from './InfoBar.js';
import { DoraDisplay } from './DoraDisplay.js';
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

interface TableLayoutProps {
  seats: SeatDisplay[];
  mySeat: number;
  activeSeat: number;
  dealerSeat: number;
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
  doraIndicatorIds: string[];
  children?: React.ReactNode;
}

type Position = 'bottom' | 'right' | 'top' | 'left';

function getSeatPosition(seatIndex: number, mySeat: number): Position {
  const offset = (seatIndex - mySeat + 4) % 4;
  const positions: Position[] = ['bottom', 'right', 'top', 'left'];
  return positions[offset];
}

export function TableLayout({ seats, mySeat, activeSeat, dealerSeat, roundWind, handNumber, honba, riichiSticks, wallRemaining, doraIndicatorIds, children }: TableLayoutProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', background: 'var(--surface-table)', display: 'flex', flexDirection: 'column' }}>
      <InfoBar roundWind={roundWind} handNumber={handNumber} honba={honba} riichiSticks={riichiSticks} wallRemaining={wallRemaining} />
      <div style={{ flex: 1, position: 'relative', padding: '0.5rem', overflow: 'hidden' }}>
        {seats.map((seat) => (
          <SeatPosition
            key={seat.seatIndex}
            position={getSeatPosition(seat.seatIndex, mySeat)}
            seatIndex={seat.seatIndex}
            displayName={seat.displayName}
            tileCount={seat.tileCount}
            isDealer={seat.isDealer}
            isActive={seat.isActive}
            isRiichi={seat.isRiichi}
            score={seat.score}
            isMe={seat.seatIndex === mySeat}
            river={seat.river}
            melds={seat.melds}
          />
        ))}
        <DoraDisplay doraIndicatorIds={doraIndicatorIds} />
        {children}
      </div>
    </div>
  );
}
