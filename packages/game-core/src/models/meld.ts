import { TileDef } from './tile.js';

export interface Meld {
  type: 'chi' | 'pon' | 'kan-open' | 'kan-closed' | 'kan-added';
  tiles: TileDef[];
  calledFromSeat?: number;
  isConcealed: boolean;
}
