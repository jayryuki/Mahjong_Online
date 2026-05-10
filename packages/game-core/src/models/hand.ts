import { TileDef } from './tile.js';
import { Meld } from './meld.js';

export interface Hand {
  concealed: TileDef[];
  melds: Meld[];
  flowers: TileDef[];
  riichi: boolean;
  riichiTileIndex?: number;
}
