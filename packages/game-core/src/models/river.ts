import { TileDef } from './tile.js';

export interface RiverEntry {
  tile: TileDef;
  calledBy?: number;
  isRiichiDiscard?: boolean;
  isLastDiscard?: boolean;
}

export interface River {
  entries: RiverEntry[];
}

export function addToRiver(river: River, tile: TileDef, isRiichiDiscard: boolean = false): River {
  return {
    entries: [
      ...river.entries,
      { tile, isRiichiDiscard },
    ],
  };
}

export function markLastDiscard(river: River): River {
  if (river.entries.length === 0) return river;
  const entries = river.entries.map((e, i) =>
    i === river.entries.length - 1 ? { ...e, isLastDiscard: true } : { ...e, isLastDiscard: false }
  );
  return { entries };
}
