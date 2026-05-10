import React from 'react';
import { SeatPosition } from './SeatPosition.js';
import { InfoBar } from './InfoBar.js';

interface TableLayoutProps {
  seats: Array<{
    seatIndex: number;
    displayName: string;
    tileCount: number;
    isDealer: boolean;
    isActive: boolean;
    isRiichi: boolean;
    melds: any[];
    river: any[];
  }>;
  activeSeat: number;
  dealerSeat: number;
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
  children?: React.ReactNode;
}

export function TableLayout({ seats, activeSeat, dealerSeat, roundWind, handNumber, honba, riichiSticks, wallRemaining, children }: TableLayoutProps) {
  const positionMap: Record<number, 'bottom' | 'right' | 'top' | 'left'> = {
    0: 'bottom', 1: 'right', 2: 'top', 3: 'left',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', background: 'var(--surface-table)', display: 'flex', flexDirection: 'column' }}>
      <InfoBar roundWind={roundWind} handNumber={handNumber} honba={honba} riichiSticks={riichiSticks} wallRemaining={wallRemaining} />
      <div style={{ flex: 1, position: 'relative', padding: '1rem' }}>
        {seats.map((seat) => (
          <SeatPosition
            key={seat.seatIndex}
            position={positionMap[seat.seatIndex]}
            displayName={seat.displayName}
            tileCount={seat.tileCount}
            isDealer={seat.isDealer}
            isActive={seat.isActive}
            isRiichi={seat.isRiichi}
          />
        ))}
        {children}
      </div>
    </div>
  );
}
