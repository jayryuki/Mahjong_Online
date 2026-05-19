import { TileDef } from '@mahjong/game-core';

/** Open meld displayed on the table */
export interface MeldDisplay {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

/** Player seat state for table rendering */
export interface SeatDisplay {
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  melds: MeldDisplay[];
  river: Array<{ tile: TileDef; isLastDiscard?: boolean }>;
  score: number;
}
