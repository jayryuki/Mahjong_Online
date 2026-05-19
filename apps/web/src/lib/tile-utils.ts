import { TileDef } from '@mahjong/game-core';

const SUIT_NAMES = ['man', 'pin', 'sou'];
const WIND_NAMES = ['east', 'south', 'west', 'north'];
const DRAGON_NAMES = ['haku', 'hatsu', 'chun'];
const HONOR_NAMES = [...WIND_NAMES, ...DRAGON_NAMES];

/** Parse a tile ID string (e.g. "man-1-0", "pin-5-3", "east-0") into a TileDef. */
export function parseTileId(id: string): TileDef {
  const parts = id.split('-');

  if (SUIT_NAMES.includes(parts[0])) {
    return {
      id,
      suit: parts[0] as 'man' | 'pin' | 'sou',
      rank: parseInt(parts[1], 10),
      isFlower: false,
    };
  } else if (HONOR_NAMES.includes(parts[0])) {
    return {
      id,
      honorType: WIND_NAMES.includes(parts[0]) ? 'wind' : 'dragon',
      honorName: parts[0] as TileDef['honorName'],
      isFlower: false,
    };
  }

  return { id, isFlower: false };
}
