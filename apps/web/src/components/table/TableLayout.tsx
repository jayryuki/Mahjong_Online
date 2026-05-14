import React from 'react';
import { SeatPosition } from './SeatPosition.js';
import { InfoBar } from './InfoBar.js';
import { WildCardDisplay } from './WildCardDisplay.js';
import { CenterRiver } from './CenterRiver.js';
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
  wildCardTileId?: string | null;
}

export function TableLayout({ seats, mySeat, activeSeat, dealerSeat, roundWind, handNumber, honba, riichiSticks, wallRemaining, wildCardTileId }: TableLayoutProps) {
  const rightSeat = seats.find(s => s.seatIndex === (mySeat + 1) % 4);
  const acrossSeat = seats.find(s => s.seatIndex === (mySeat + 2) % 4);
  const leftSeat = seats.find(s => s.seatIndex === (mySeat + 3) % 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}>
      <InfoBar roundWind={roundWind} handNumber={handNumber} honba={honba} riichiSticks={riichiSticks} wallRemaining={wallRemaining} />

      {/* Table area */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateColumns: 'auto 1fr auto',
        gridTemplateAreas: `
          ". top ."
          "left center right"
          ". bottom ."
        `,
        minHeight: 0,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #2d5a3d 0%, #1e3f2a 60%, #152b1e 100%)',
        borderRadius: '0 0 8px 8px',
        padding: '6px',
        gap: '4px',
      }}>
        {/* Across seat (top) */}
        <div style={{ gridArea: 'top', justifySelf: 'center', zIndex: 4 }}>
          {acrossSeat && <SeatPosition position="top" seatIndex={acrossSeat.seatIndex} displayName={acrossSeat.displayName} tileCount={acrossSeat.tileCount} isDealer={acrossSeat.isDealer} isActive={acrossSeat.isActive} isRiichi={acrossSeat.isRiichi} score={acrossSeat.score} melds={acrossSeat.melds} />}
        </div>

        {/* Left seat */}
        <div style={{ gridArea: 'left', alignSelf: 'center', justifySelf: 'center', zIndex: 4 }}>
          {leftSeat && <SeatPosition position="left" seatIndex={leftSeat.seatIndex} displayName={leftSeat.displayName} tileCount={leftSeat.tileCount} isDealer={leftSeat.isDealer} isActive={leftSeat.isActive} isRiichi={leftSeat.isRiichi} score={leftSeat.score} melds={leftSeat.melds} />}
        </div>

        {/* Center: river + wild card overlay */}
        <div style={{ gridArea: 'center', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <CenterRiver mySeat={mySeat} seats={seats} />
          <WildCardDisplay wildCardTileId={wildCardTileId} />
        </div>

        {/* Right seat */}
        <div style={{ gridArea: 'right', alignSelf: 'center', justifySelf: 'center', zIndex: 4 }}>
          {rightSeat && <SeatPosition position="right" seatIndex={rightSeat.seatIndex} displayName={rightSeat.displayName} tileCount={rightSeat.tileCount} isDealer={rightSeat.isDealer} isActive={rightSeat.isActive} isRiichi={rightSeat.isRiichi} score={rightSeat.score} melds={rightSeat.melds} />}
        </div>

        {/* Bottom (my seat - empty here, hand is in the bottom panel) */}
        <div style={{ gridArea: 'bottom' }} />
      </div>
    </div>
  );
}
